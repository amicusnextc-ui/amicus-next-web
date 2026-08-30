import { isAllowedOrigin, jsonResponse, readJsonBody } from "./_http.js";
import { bumpPrayerCount, notionIsConfigured, recordPrayerParticipation } from "./_notion.js";
import { prayerDepartments } from "./_students.js";

// The directory's "오늘 기도 기록하기" toggle reports a +1/-1 here.
// A per-person tally is always kept. When the device holds a verified partner
// application, the client also sends that partner's name and application ID,
// and a named row is appended to the 기도 참여 기록 database so leaders can
// see who is praying along. Visitors without an application stay anonymous.
// Student rows are resolved server-side from the roster; staff exist only in
// the client's data.js, so their display name is accepted from the request
// under tight validation.

const KEY_PATTERN = /^(preschool|elementaryJr|elementary|youth):(student|staff):([a-z0-9-]{2,60})$/i;
const APPLICATION_ID_PATTERN = /^partner-[a-z0-9-]{5,80}$/i;

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    if (!isAllowedOrigin(request.headers.get("origin"))) {
      return jsonResponse({ error: "요청한 사이트를 확인할 수 없습니다.", code: "origin_not_allowed" }, 403);
    }

    if (!notionIsConfigured()) {
      return jsonResponse({ error: "기록 저장소가 아직 연결되지 않았습니다.", code: "records_not_configured" }, 503);
    }

    try {
      const body = await readJsonBody(request, 2_000);
      const key = String(body.key || "");
      const prayed = body.prayed === true;
      const match = KEY_PATTERN.exec(key);
      if (!match) {
        return jsonResponse({ error: "기록 대상을 확인할 수 없습니다.", code: "invalid_person" }, 400);
      }

      const [, departmentKey, role, personId] = match;
      let name;
      if (role === "student") {
        const student = prayerDepartments[departmentKey]?.students.find((person) => person.id === personId);
        if (!student) {
          return jsonResponse({ error: "기록 대상을 확인할 수 없습니다.", code: "invalid_person" }, 400);
        }
        name = student.name;
      } else {
        name = String(body.name || "").trim().slice(0, 30);
        if (name.length < 2) {
          return jsonResponse({ error: "기록 대상을 확인할 수 없습니다.", code: "invalid_person" }, 400);
        }
      }

      const result = await bumpPrayerCount({
        key: `${departmentKey}:${role}:${personId}`,
        name,
        departmentKey,
        role,
        delta: prayed ? 1 : -1
      });

      if (!result.recorded) {
        return jsonResponse({ error: "기록 저장소를 쓰지 못했습니다.", code: "records_unavailable" }, 502);
      }

      // Optional named check-in for verified partners. Best-effort: a failure
      // here never breaks the anonymous tally that already succeeded.
      let named = false;
      const partnerName = String(body.partner?.name || "").trim().slice(0, 40);
      const applicationId = String(body.partner?.applicationId || "").trim();
      if (partnerName.length >= 2 && APPLICATION_ID_PATTERN.test(applicationId)) {
        const participation = await recordPrayerParticipation({
          partnerName,
          applicationId,
          key: `${departmentKey}:${role}:${personId}`,
          targetName: name,
          departmentKey,
          role,
          prayed
        });
        named = Boolean(participation.recorded);
      }

      return jsonResponse({ recorded: true, named });
    } catch (error) {
      const code = error?.message === "REQUEST_TOO_LARGE" ? "request_too_large" : "record_failed";
      return jsonResponse({ error: "기도 기록을 저장하지 못했습니다.", code }, code === "request_too_large" ? 413 : 500);
    }
  }
};
