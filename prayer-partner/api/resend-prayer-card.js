import { escapeHtml, jsonResponse } from "./_http.js";
import { mailIsConfigured, sendMail } from "./_mail.js";
import { listPartnerApplications, notionIsConfigured } from "./_notion.js";
import { createPrayerCardPdf } from "./_pdf.js";
import { findPrayerStudent, pickupCodeForStudent, prayerText, schoolAndGrade } from "./_students.js";

// Operator resend. A student's prayer topic often arrives weeks after their
// partner has already been matched and mailed a card — the card that went out
// then said only "기도제목은 곧 등록될 예정입니다". This endpoint takes the
// student, finds whoever is praying for them in the Notion record, rebuilds the
// card from today's roster and mails it again.
//
// It is a leader's tool, not a member's: there is no origin check and no
// six-digit code, so it is closed behind the same CRON_SECRET bearer token the
// weekly reminder uses. It writes nothing — the application row already exists,
// and a resend should not create a second one.

const SITE = "https://amicus-prayer-partner.vercel.app";
const REPLY_TO = "amicusnextc@gmail.com";

function authorized(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  return (request.headers.get("authorization") || "") === `Bearer ${secret}`;
}

function guideHref(departmentKey, studentId) {
  return `${SITE}/guide.html?dept=${encodeURIComponent(departmentKey)}&student=${encodeURIComponent(studentId)}`;
}

// Deliberately neutral about whether this is the topic's first arrival or a
// revision, because one endpoint serves both and the partner cannot tell the
// difference from their side anyway.
function resendText({ partnerName, department, student, pickupCode, departmentKey }) {
  const schoolLine = schoolAndGrade(student, " | ");
  return `${partnerName}님, ${student.name} 학생의 기도제목을 전해 드립니다.

가정에서 보내온 기도제목입니다. 새 기도카드를 첨부해 드리니, 이전 카드는 이 카드로 대신해 주세요.

부서: ${department.name}
${schoolLine ? `학교와 학년: ${schoolLine}\n` : ""}수령번호: ${pickupCode}

기도제목
${prayerText(student)}

10분 기도 가이드: ${guideHref(departmentKey, student.id)}

학생 정보와 기도제목은 기도 목적으로만 사용하고 외부에 공유하지 말아 주세요.

AMICUS NEXT CHURCH`;
}

function resendHtml({ partnerName, department, student, pickupCode, departmentKey }) {
  const safePartner = escapeHtml(partnerName);
  const safeStudent = escapeHtml(student.name);
  const safeDepartment = escapeHtml(department.name);
  const safeSchoolAndGrade = escapeHtml(schoolAndGrade(student));
  const safePrayer = escapeHtml(prayerText(student));
  const safePickupCode = escapeHtml(pickupCode);
  const guide = escapeHtml(guideHref(departmentKey, student.id));

  return `<!doctype html>
  <html lang="ko">
    <body style="margin:0;background:#f5f0e4;color:#2b2118;font-family:Arial,'Apple SD Gothic Neo',sans-serif;">
      <div style="max-width:620px;margin:0 auto;padding:36px 20px;">
        <div style="background:#fffdf8;border-radius:20px;padding:38px;">
          <p style="margin:0 0 12px;color:#6b6259;font-size:13px;">2026 가을학기 기도동행</p>
          <h1 style="margin:0;font-size:27px;line-height:1.35;">${safePartner}님,<br>${safeStudent} 학생의 기도제목을 전해 드립니다.</h1>
          <p style="margin:22px 0 0;color:#6b6259;line-height:1.7;">가정에서 보내온 기도제목입니다. 새 기도카드를 첨부해 드리니, 이전 카드는 이 카드로 대신해 주세요.</p>
          <div style="margin-top:28px;padding:24px;border-radius:14px;background:#f0e4cf;">
            <strong style="display:block;margin-bottom:8px;">${safeDepartment} | ${safePickupCode}</strong>
            ${safeSchoolAndGrade ? `<span style="display:block;color:#6b6259;font-size:13px;">${safeSchoolAndGrade}</span>` : ""}
            <p style="margin:20px 0 0;line-height:1.75;">${safePrayer}</p>
          </div>
          <p style="margin:28px 0 0;">
            <a href="${guide}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#9c5b3c;color:#fffdf8;font-weight:bold;text-decoration:none;">10분 기도 가이드 열기</a>
          </p>
          <p style="margin:24px 0 0;color:#6b6259;font-size:12px;line-height:1.7;">학생 정보와 기도제목은 기도 목적으로만 사용하고 외부에 공유하지 말아 주세요.</p>
        </div>
        <p style="margin:18px 0 0;text-align:center;color:#6b6259;font-size:11px;">AMICUS NEXT CHURCH</p>
      </div>
    </body>
  </html>`;
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }
    if (!authorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    if (!mailIsConfigured() || !notionIsConfigured()) {
      return jsonResponse({ error: "mail_or_notion_not_configured" }, 503);
    }

    const url = new URL(request.url);
    const studentId = String(url.searchParams.get("student") || "").trim();
    const testTo = String(url.searchParams.get("test") || "").trim();
    const dryRun = url.searchParams.get("dry") === "1";
    if (!studentId) return jsonResponse({ error: "student_required" }, 400);

    const applications = await listPartnerApplications();
    if (!applications) return jsonResponse({ error: "notion_read_failed" }, 502);

    const matches = applications.filter((row) => row.studentId === studentId);
    if (!matches.length) return jsonResponse({ error: "no_partner_for_student", studentId }, 404);

    const results = [];
    for (const application of matches) {
      const found = findPrayerStudent(application.departmentKey, application.studentId);
      if (!found) {
        results.push({ email: application.email, sent: false, reason: "student_not_in_roster" });
        continue;
      }
      const { department, student } = found;
      const pickupCode = pickupCodeForStudent(department, student);
      const parts = {
        partnerName: application.partnerName,
        department,
        student,
        pickupCode,
        departmentKey: application.departmentKey
      };
      const to = testTo || application.email;

      if (dryRun) {
        results.push({
          email: to,
          sent: false,
          dryRun: true,
          partnerName: application.partnerName,
          student: student.name,
          pickupCode,
          prayer: prayerText(student),
          subject: `[AMICUS NEXT] ${student.name} 학생의 기도제목을 전해 드립니다`,
          text: resendText(parts)
        });
        continue;
      }

      const pdfBytes = await createPrayerCardPdf(parts);
      const delivery = await sendMail({
        to: [{ email: to, name: application.partnerName }],
        subject: `[AMICUS NEXT] ${student.name} 학생의 기도제목을 전해 드립니다`,
        text: resendText(parts),
        html: resendHtml(parts),
        category: "prayer-partner-topic-update",
        replyTo: REPLY_TO,
        attachments: [
          {
            content: Buffer.from(pdfBytes).toString("base64"),
            filename: "amicus-prayer-card.pdf",
            type: "application/pdf",
            disposition: "attachment"
          }
        ]
      });
      results.push({
        email: to,
        partnerName: application.partnerName,
        student: student.name,
        pickupCode,
        sent: Boolean(delivery.sent)
      });
      // Resend allows 2 requests a second; a student rarely has more than one
      // partner, but pace it anyway so a duplicate match never trips the limit.
      if (matches.length > 1) await new Promise((resolve) => setTimeout(resolve, 600));
    }

    return jsonResponse({ studentId, dryRun, count: results.length, results });
  }
};
