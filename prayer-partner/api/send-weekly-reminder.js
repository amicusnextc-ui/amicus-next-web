import { escapeHtml, jsonResponse } from "./_http.js";
import { mailIsConfigured, sendMail } from "./_mail.js";
import { listParticipationDays, listPartnerApplications, notionIsConfigured } from "./_notion.js";
import { findPrayerStudent, schoolAndGrade } from "./_students.js";

// The Sunday-evening nudge. One mail per verified partner: their student, the
// prayer topic, the promise they made, and the weeks they have recorded so
// far. Nothing here writes; if Notion is unreachable the run is abandoned
// rather than sent to a partial list.
//
// Vercel Hobby crons fire at most once a day, so vercel.json schedules this
// daily and the Sunday check below decides whether it is really a send day.

const SITE = "https://amicus-prayer-partner.vercel.app";
const SEMESTER_START = "2026-08-30"; // Sunday of week 1
const REPLY_TO = "amicusnextc@gmail.com";
const DAY_MS = 86_400_000;
const CHART_WEEKS = 8;
const SEND_HOUR_PT = 18;

const RHYTHM_TARGET = { "매일": 7, "주 3회": 3, "매주": 1 };

// Wall-clock date in the church's own timezone, so a Sunday send is Sunday in
// San Diego whatever the server thinks and whether or not DST is on.
function pacificParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    weekday: get("weekday") // "Sun" … "Sat"
  };
}

function weekIndex(day) {
  const diff = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${SEMESTER_START}T00:00:00Z`);
  return Math.floor(diff / (7 * DAY_MS));
}

// Weekly counts from week 1 up to the week we are in now, capped so a long
// semester still renders as a readable chart.
function weeklyBuckets(days, currentWeek) {
  const total = Math.min(Math.max(currentWeek + 1, 1), CHART_WEEKS);
  const buckets = new Array(total).fill(0);
  for (const day of days) {
    const index = weekIndex(day);
    if (index >= 0 && index < total) buckets[index] += 1;
  }
  return buckets;
}

function studentHref(departmentKey, studentId) {
  return `${SITE}/department.html?dept=${encodeURIComponent(departmentKey)}&student=${encodeURIComponent(studentId)}`;
}

// Horizontal bars as plain table rows: no images, no scripts, nothing an email
// client has to be talked into rendering.
function chartHtml(buckets, target) {
  const scale = Math.max(target, ...buckets, 1);
  const rows = buckets.map((count, index) => {
    const width = Math.round((count / scale) * 100);
    const isNow = index === buckets.length - 1;
    const bar = count === 0
      ? `<span style="display:inline-block;height:10px;width:100%;border-radius:5px;background:#eae1cf;"></span>`
      : `<span style="display:inline-block;height:10px;width:${Math.max(width, 6)}%;border-radius:5px;background:${isNow ? "#b55d28" : "#c9b48c"};"></span>`;
    return `<tr>
      <td style="padding:5px 10px 5px 0;font-size:12px;color:#6b6259;white-space:nowrap;">${index + 1}주차</td>
      <td style="padding:5px 10px 5px 0;width:100%;">${bar}</td>
      <td style="padding:5px 0;font-size:12px;color:${isNow ? "#b55d28" : "#6b6259"};white-space:nowrap;font-weight:${isNow ? "bold" : "normal"};">${count}회</td>
    </tr>`;
  }).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows}</table>`;
}

function chartText(buckets) {
  return buckets
    .map((count, index) => `${index + 1}주차 ${"■".repeat(Math.min(count, 10)) || "·"} ${count}회`)
    .join("\n");
}

function reminderHtml({ partnerName, department, student, rhythmLabel, buckets, href }) {
  const thisWeek = buckets[buckets.length - 1] || 0;
  const target = RHYTHM_TARGET[rhythmLabel] || 0;
  const total = buckets.reduce((sum, count) => sum + count, 0);
  const school = schoolAndGrade(student);
  const status = total === 0
    ? "아직 이번 학기 기록이 없습니다. 오늘 첫 기록을 남겨 보세요."
    : target && thisWeek >= target
      ? `이번 주 ${thisWeek}회 — 약속하신 ${escapeHtml(rhythmLabel)}를 지키셨습니다. 감사합니다.`
      : `이번 주 ${thisWeek}회 기록하셨습니다.`;

  return `<!doctype html>
  <html lang="ko">
    <body style="margin:0;background:#f5f0e4;color:#2b2118;font-family:Arial,'Apple SD Gothic Neo',sans-serif;">
      <div style="max-width:620px;margin:0 auto;padding:36px 20px;">
        <div style="background:#fffdf8;border-radius:20px;padding:38px;">
          <p style="margin:0 0 12px;color:#6b6259;font-size:13px;">2026 가을학기 기도동행</p>
          <h1 style="margin:0;font-size:25px;line-height:1.4;">${escapeHtml(partnerName)}님,<br>오늘 ${escapeHtml(student.name)} 학생을 위해<br>기도해 주세요.</h1>

          <div style="margin-top:28px;padding:24px;border-radius:14px;background:#f0e4cf;">
            <strong style="display:block;margin-bottom:8px;">${escapeHtml(department.name)}</strong>
            ${school ? `<span style="display:block;color:#6b6259;font-size:13px;">${escapeHtml(school)}</span>` : ""}
            <p style="margin:18px 0 0;line-height:1.75;">${escapeHtml(student.prayer)}</p>
          </div>

          <p style="margin:30px 0 10px;color:#6b6259;font-size:13px;">나의 기도 약속 · ${escapeHtml(rhythmLabel || "매주")}</p>
          ${chartHtml(buckets, target)}
          <p style="margin:14px 0 0;font-size:13px;line-height:1.7;">${status}</p>

          <p style="margin:30px 0 0;">
            <a href="${href}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#b55d28;color:#fffdf8;font-weight:bold;text-decoration:none;font-size:15px;">오늘 기도 기록하기 →</a>
          </p>

          <div style="margin-top:30px;padding-top:22px;border-top:1px solid #eae1cf;">
            <strong style="display:block;font-size:13px;margin-bottom:10px;">기록하는 방법</strong>
            <ol style="margin:0;padding-left:18px;color:#6b6259;font-size:13px;line-height:1.9;">
              <li>위 버튼을 누르면 ${escapeHtml(student.name)} 학생의 카드가 바로 열립니다.</li>
              <li>"오늘 기도했습니다" 버튼을 한 번 누르면 끝입니다.</li>
              <li>하루 한 번만 기록되고, 잘못 누르면 다시 눌러 취소됩니다.</li>
            </ol>
            <p style="margin:14px 0 0;color:#6b6259;font-size:12px;line-height:1.7;">기록은 교육부가 함께 기도하는 분들을 확인하고 감사로 나누는 데에만 사용됩니다.</p>
          </div>
        </div>
        <p style="margin:18px 0 0;color:#6b6259;font-size:11px;line-height:1.8;text-align:center;">
          AMICUS NEXT CHURCH 교육부<br>
          이 메일은 기도 파트너 신청자에게 주 1회 발송됩니다.<br>
          받지 않으시려면 이 메일에 회신해 주세요 (${REPLY_TO}).<br>
          학생의 이름과 기도제목은 기도 목적으로만 사용해 주시고, 화면 캡처와 외부 공유는 삼가 주세요.
        </p>
      </div>
    </body>
  </html>`;
}

function reminderText({ partnerName, department, student, rhythmLabel, buckets, href }) {
  const school = schoolAndGrade(student, " | ");
  return `${partnerName}님, 오늘 ${student.name} 학생을 위해 기도해 주세요.

부서: ${department.name}
${school ? `학교와 학년: ${school}\n` : ""}
기도제목
${student.prayer}

나의 기도 약속 · ${rhythmLabel || "매주"}
${chartText(buckets)}

오늘 기도 기록하기
${href}

기록하는 방법
1. 위 주소를 열면 ${student.name} 학생의 카드가 바로 열립니다.
2. "오늘 기도했습니다" 버튼을 한 번 누르면 끝입니다.
3. 하루 한 번만 기록되고, 잘못 누르면 다시 눌러 취소됩니다.

기록은 교육부가 함께 기도하는 분들을 확인하고 감사로 나누는 데에만 사용됩니다.

AMICUS NEXT CHURCH 교육부
이 메일은 기도 파트너 신청자에게 주 1회 발송됩니다.
받지 않으시려면 이 메일에 회신해 주세요 (${REPLY_TO}).
학생의 이름과 기도제목은 기도 목적으로만 사용해 주시고, 화면 캡처와 외부 공유는 삼가 주세요.`;
}

// Vercel signs cron requests with CRON_SECRET; the same secret lets a leader
// trigger a dry run or a test send by hand. Without it configured the endpoint
// refuses outright rather than exposing the member list.
function authorized(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
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
    const testTo = String(url.searchParams.get("test") || "").trim();
    const dryRun = url.searchParams.get("dry") === "1";
    const force = url.searchParams.get("force") === "1";

    const now = pacificParts();
    const isSendWindow = now.weekday === "Sun" && now.hour >= SEND_HOUR_PT;
    if (!force && !testTo && !dryRun && !isSendWindow) {
      return jsonResponse({ skipped: true, reason: "not_sunday_evening", pacific: now });
    }

    const applications = await listPartnerApplications();
    if (!applications) return jsonResponse({ error: "notion_read_failed" }, 502);

    const participation = await listParticipationDays({ since: SEMESTER_START });
    if (!participation) return jsonResponse({ error: "notion_read_failed" }, 502);

    const currentWeek = Math.max(weekIndex(now.day), 0);

    // In test mode one real assignment is rendered in full but delivered only
    // to the address given, so a leader sees exactly what members will get.
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) | 0);
    const recipients = testTo ? applications.slice(0, 1) : applications.slice(offset);

    // A Hobby function is killed at 60s. Stopping ourselves first turns a
    // half-finished run into a reported `nextOffset` instead of a timeout.
    const deadline = Date.now() + 48_000;
    const results = { sent: 0, failed: 0, skipped: 0, total: recipients.length, nextOffset: null };
    for (const [index, application] of recipients.entries()) {
      if (!dryRun && Date.now() > deadline) {
        results.nextOffset = offset + index;
        break;
      }
      const match = findPrayerStudent(application.departmentKey, application.studentId);
      if (!match) { results.skipped += 1; continue; }

      const days = participation[application.applicationId] || [];
      const view = {
        partnerName: application.partnerName,
        department: match.department,
        student: match.student,
        rhythmLabel: application.rhythmLabel,
        buckets: weeklyBuckets(days, currentWeek),
        href: studentHref(application.departmentKey, application.studentId)
      };

      if (dryRun) { results.skipped += 1; continue; }

      const delivery = await sendMail({
        to: [{ email: testTo || application.email, name: application.partnerName }],
        subject: `${testTo ? "[테스트] " : ""}[AMICUS NEXT] 이번 주, 한 사람을 위해 기도해 주세요`,
        text: reminderText(view),
        html: reminderHtml(view),
        category: "prayer-partner-reminder",
        replyTo: REPLY_TO
      });
      if (delivery.sent) results.sent += 1; else results.failed += 1;

      // Resend's default rate limit is 2 requests/second.
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    console.log("Weekly reminder run", { ...results, test: Boolean(testTo), dryRun });
    return jsonResponse({ ...results, pacific: now, currentWeek: currentWeek + 1, test: Boolean(testTo), dryRun });
  }
};
