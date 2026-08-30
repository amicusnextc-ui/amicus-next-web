import { createHash } from "node:crypto";
import { isAllowedOrigin, jsonResponse, readJsonBody, escapeHtml, validateVerificationRequest } from "./_http.js";
import { mailIsConfigured, sendMail } from "./_mail.js";
import { selectPrayerStudent } from "./_students.js";
import { createVerificationChallenge } from "./_verification.js";
import { listAssignedCounts } from "./_notion.js";

const REQUEST_COOLDOWN_MS = 60_000;
const recentRequests = globalThis.__amicusVerificationRequests || new Map();
globalThis.__amicusVerificationRequests = recentRequests;

function verificationHtml(partnerName, code) {
  return `<!doctype html>
  <html lang="ko">
    <body style="margin:0;background:#f5f0e4;color:#2b2118;font-family:Arial,'Apple SD Gothic Neo',sans-serif;">
      <div style="max-width:560px;margin:0 auto;padding:36px 20px;">
        <div style="background:#fffdf8;border-radius:20px;padding:38px;">
          <p style="margin:0 0 12px;color:#6b6259;font-size:13px;">AMICUS NEXT 기도동행</p>
          <h1 style="margin:0;font-size:25px;line-height:1.4;">${escapeHtml(partnerName)}님의<br>이메일 인증코드입니다.</h1>
          <div style="margin-top:28px;padding:22px;border-radius:14px;background:#dfe6c7;text-align:center;font-size:32px;letter-spacing:8px;font-weight:700;">${code}</div>
          <p style="margin:24px 0 0;color:#6b6259;line-height:1.7;">신청 화면에 인증코드를 입력하면 매칭된 학생의 기도카드 PDF가 이 이메일로 발송됩니다. 인증코드는 10분 동안 사용할 수 있습니다.</p>
          <p style="margin:18px 0 0;color:#6b6259;font-size:12px;line-height:1.7;">본인이 신청하지 않았다면 이 이메일을 무시해 주세요. 이 단계에서는 학생 정보가 전송되지 않습니다.</p>
        </div>
      </div>
    </body>
  </html>`;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    if (!isAllowedOrigin(request.headers.get("origin"))) {
      return jsonResponse({ error: "요청한 사이트를 확인할 수 없습니다.", code: "origin_not_allowed" }, 403);
    }

    try {
      const body = await readJsonBody(request);
      const application = validateVerificationRequest(body);
      if (!application) return jsonResponse({ error: "신청 정보를 확인해 주세요.", code: "invalid_application" }, 400);
      if (!mailIsConfigured() || String(process.env.EMAIL_SIGNING_SECRET || "").length < 32) {
        return jsonResponse({ error: "이메일 발송 설정이 아직 완료되지 않았습니다.", code: "email_not_configured" }, 503);
      }

      const requestKey = createHash("sha256").update(application.email).digest("hex");
      const lastRequest = recentRequests.get(requestKey) || 0;
      if (Date.now() - lastRequest < REQUEST_COOLDOWN_MS) {
        return jsonResponse({ error: "인증코드를 방금 보냈습니다. 잠시 후 다시 시도해 주세요.", code: "verification_rate_limited" }, 429);
      }
      recentRequests.set(requestKey, Date.now());

      const assignedCounts = await listAssignedCounts();
      const assignment = selectPrayerStudent(
        application.departmentPreference,
        application.email,
        application.partnerName,
        assignedCounts
      );
      if (!assignment) {
        return jsonResponse({ error: "선택한 부서의 모든 학생이 이미 연결되었습니다.", code: "department_unavailable" }, 409);
      }

      const challenge = createVerificationChallenge({
        ...application,
        departmentKey: assignment.departmentKey,
        studentId: assignment.student.id
      });
      const delivery = await sendMail({
        to: [{ email: application.email, name: application.partnerName }],
        subject: "[AMICUS NEXT] 기도동행 이메일 인증코드",
        text: `${application.partnerName}님의 이메일 인증코드는 ${challenge.code}입니다. 신청 화면에 입력하면 매칭된 학생의 기도카드 PDF가 발송됩니다. 인증코드는 10분 동안 사용할 수 있습니다.`,
        html: verificationHtml(application.partnerName, challenge.code),
        category: "prayer-partner-verification"
      });

      if (!delivery.sent) {
        return jsonResponse({ error: "인증코드 이메일을 보내지 못했습니다.", code: "verification_delivery_failed" }, 502);
      }

      return jsonResponse({
        verificationRequired: true,
        verificationToken: challenge.token,
        expiresAt: challenge.expiresAt
      });
    } catch (error) {
      const code = error?.message === "REQUEST_TOO_LARGE" ? "request_too_large" : "verification_request_failed";
      const status = code === "request_too_large" ? 413 : 500;
      console.error("Email verification request failed", { name: error?.name || "Error", code });
      return jsonResponse({ error: "이메일 인증을 시작하지 못했습니다.", code }, status);
    }
  }
};
