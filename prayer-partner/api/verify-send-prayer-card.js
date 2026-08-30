import { createHash } from "node:crypto";
import { escapeHtml, isAllowedOrigin, jsonResponse, readJsonBody, validateSignedAssignment } from "./_http.js";
import { mailtrapIsConfigured, sendMailtrap } from "./_mailtrap.js";
import { createPrayerCardPdf } from "./_pdf.js";
import { findPrayerStudent, pickupCodeForStudent, schoolAndGrade } from "./_students.js";
import { verifyChallenge } from "./_verification.js";

const attemptsByToken = globalThis.__amicusCodeAttempts || new Map();
const sendsByToken = globalThis.__amicusPdfSends || new Map();
globalThis.__amicusCodeAttempts = attemptsByToken;
globalThis.__amicusPdfSends = sendsByToken;

function prayerCardHtml({ partnerName, department, student, pickupCode }) {
  const safePartner = escapeHtml(partnerName);
  const safeStudent = escapeHtml(student.name);
  const safeDepartment = escapeHtml(department.name);
  const safeSchoolAndGrade = escapeHtml(schoolAndGrade(student));
  const safePrayer = escapeHtml(student.prayer);
  const safePickupCode = escapeHtml(pickupCode);

  return `<!doctype html>
  <html lang="ko">
    <body style="margin:0;background:#f5f0e4;color:#2b2118;font-family:Arial,'Apple SD Gothic Neo',sans-serif;">
      <div style="max-width:620px;margin:0 auto;padding:36px 20px;">
        <div style="background:#fffdf8;border-radius:20px;padding:38px;">
          <p style="margin:0 0 12px;color:#6b6259;font-size:13px;">2026 가을학기 기도동행</p>
          <h1 style="margin:0;font-size:27px;line-height:1.35;">${safePartner}님,<br>${safeStudent} 학생과 연결되었습니다.</h1>
          <p style="margin:22px 0 0;color:#6b6259;line-height:1.7;">첨부된 PDF를 성경이나 휴대전화에 보관하고 이번 학기 동안 함께 기도해 주세요.</p>
          <div style="margin-top:28px;padding:24px;border-radius:14px;background:#f0e4cf;">
            <strong style="display:block;margin-bottom:8px;">${safeDepartment} | ${safePickupCode}</strong>
            ${safeSchoolAndGrade ? `<span style="display:block;color:#6b6259;font-size:13px;">${safeSchoolAndGrade}</span>` : ""}
            <p style="margin:20px 0 0;line-height:1.75;">${safePrayer}</p>
          </div>
          <p style="margin:24px 0 0;color:#6b6259;font-size:12px;line-height:1.7;">학생 정보와 기도제목은 기도 목적으로만 사용하고 외부에 공유하지 말아 주세요.</p>
        </div>
        <p style="margin:18px 0 0;text-align:center;color:#6b6259;font-size:11px;">AMICUS NEXT CHURCH</p>
      </div>
    </body>
  </html>`;
}

function prayerCardText({ partnerName, department, student, pickupCode }) {
  return `${partnerName}님, ${student.name} 학생과 연결되었습니다.\n\n부서: ${department.name}\n${schoolAndGrade(student, " | ") ? `학교와 학년: ${schoolAndGrade(student, " | ")}\n` : ""}수령번호: ${pickupCode}\n\n기도제목\n${student.prayer}\n\n첨부된 PDF 기도카드를 이번 학기 동안 보관해 주세요. 학생 정보와 기도제목은 기도 목적으로만 사용하고 외부에 공유하지 말아 주세요.\n\nAMICUS NEXT CHURCH`;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    if (!isAllowedOrigin(request.headers.get("origin"))) {
      return jsonResponse({ error: "요청한 사이트를 확인할 수 없습니다.", code: "origin_not_allowed" }, 403);
    }

    try {
      if (!mailtrapIsConfigured() || String(process.env.EMAIL_SIGNING_SECRET || "").length < 32) {
        return jsonResponse({ error: "이메일 발송 설정이 아직 완료되지 않았습니다.", code: "email_not_configured" }, 503);
      }

      const body = await readJsonBody(request);
      const token = String(body.verificationToken || "");
      const code = String(body.verificationCode || "").trim();
      if (token.length < 80 || token.length > 4_000 || !/^\d{6}$/.test(code)) {
        return jsonResponse({ error: "6자리 인증코드를 확인해 주세요.", code: "invalid_verification" }, 400);
      }

      const tokenKey = createHash("sha256").update(token).digest("hex");
      const failedAttempts = attemptsByToken.get(tokenKey) || 0;
      if (failedAttempts >= 5) {
        return jsonResponse({ error: "인증 시도 횟수를 초과했습니다. 새 인증코드를 받아 주세요.", code: "verification_attempts_exceeded" }, 429);
      }

      const payload = verifyChallenge(token, code);
      if (!payload) {
        attemptsByToken.set(tokenKey, failedAttempts + 1);
        return jsonResponse({ error: "인증코드가 맞지 않거나 유효시간이 지났습니다.", code: "invalid_verification" }, 400);
      }

      const application = validateSignedAssignment(payload);
      const match = application && findPrayerStudent(application.departmentKey, application.studentId);
      if (!application || !match) {
        return jsonResponse({ error: "매칭 정보를 확인할 수 없습니다.", code: "invalid_match" }, 400);
      }

      const lastSend = sendsByToken.get(tokenKey) || 0;
      if (Date.now() - lastSend < 30_000) {
        return jsonResponse({ error: "PDF 이메일을 방금 보냈습니다.", code: "pdf_rate_limited" }, 429);
      }

      const { department, student } = match;
      const pickupCode = pickupCodeForStudent(department, student);
      const pdfBytes = await createPrayerCardPdf({
        partnerName: application.partnerName,
        department,
        student,
        pickupCode
      });
      const delivery = await sendMailtrap({
        to: [{ email: application.email, name: application.partnerName }],
        subject: `[AMICUS NEXT] ${student.name} 학생 기도동행 카드`,
        text: prayerCardText({ partnerName: application.partnerName, department, student, pickupCode }),
        html: prayerCardHtml({ partnerName: application.partnerName, department, student, pickupCode }),
        category: "prayer-partner-match",
        attachments: [
          {
            content: Buffer.from(pdfBytes).toString("base64"),
            filename: "amicus-prayer-card.pdf",
            type: "application/pdf",
            disposition: "attachment"
          }
        ]
      });

      if (!delivery.sent) {
        return jsonResponse({ error: "PDF 이메일을 보내지 못했습니다.", code: "pdf_delivery_failed" }, 502);
      }

      sendsByToken.set(tokenKey, Date.now());
      attemptsByToken.delete(tokenKey);
      return jsonResponse({
        sent: true,
        filename: "amicus-prayer-card.pdf",
        assignment: {
          id: application.applicationId,
          eventCode: application.eventCode,
          name: application.partnerName,
          email: application.email,
          departmentPreference: application.departmentPreference,
          prayerRhythm: application.prayerRhythm,
          studentId: application.studentId,
          departmentKey: application.departmentKey,
          createdAt: new Date().toISOString(),
          emailSentAt: new Date().toISOString()
        }
      });
    } catch (error) {
      const code = error?.message === "REQUEST_TOO_LARGE" ? "request_too_large" : "pdf_email_failed";
      const status = code === "request_too_large" ? 413 : 500;
      console.error("Verified prayer card email failed", { name: error?.name || "Error", code });
      return jsonResponse({ error: "PDF 이메일을 준비하지 못했습니다.", code }, status);
    }
  }
};
