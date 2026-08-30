import { jsonResponse } from "./_http.js";
import { listAssignedCounts, notionIsConfigured } from "./_notion.js";
import { prayerDepartments } from "./_students.js";

// Read-only waiting numbers derived from the shared application record, so
// every visitor sees the same "N명 대기" instead of a figure computed from
// their own browser's localStorage. No personal data leaves this endpoint —
// only per-student partner counts, for students already listed publicly.
//
// Cached briefly per warm instance so page loads don't hammer Notion.

const CACHE_MS = 30_000;
const cache = globalThis.__amicusAvailabilityCache || { at: 0, body: null };
globalThis.__amicusAvailabilityCache = cache;

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    if (request.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

    if (!notionIsConfigured()) {
      return jsonResponse({ error: "기록 저장소가 아직 연결되지 않았습니다.", code: "records_not_configured" }, 503);
    }

    if (cache.body && Date.now() - cache.at < CACHE_MS) {
      return jsonResponse(cache.body);
    }

    const assigned = await listAssignedCounts();
    if (!assigned) {
      return jsonResponse({ error: "기록 저장소를 읽지 못했습니다.", code: "records_unavailable" }, 502);
    }

    const students = {};
    const departments = {};
    let total = 0;
    for (const [departmentKey, department] of Object.entries(prayerDepartments)) {
      let waiting = 0;
      for (const student of department.students) {
        const count = assigned[student.id] || 0;
        students[student.id] = count;
        if (count === 0) waiting += 1;
      }
      departments[departmentKey] = waiting;
      total += waiting;
    }

    cache.at = Date.now();
    cache.body = { students, departments, total, updatedAt: new Date().toISOString() };
    return jsonResponse(cache.body);
  }
};
