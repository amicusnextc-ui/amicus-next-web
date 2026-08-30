// Notion is the shared store for Prayer Partners records. Two databases live
// under the "Prayer Partners 데이터" page in the church workspace:
//
//   기도 파트너 신청 — one row per verified application (who, which student,
//   whether the email went out). Written by verify-send-prayer-card.
//
//   기도 기록 — anonymous prayer counts per person, bumped by record-prayer.
//
// Everything here is best-effort: the site must keep working when Notion is
// unconfigured, slow, or down. Readers return null on failure so callers can
// fall back; writers swallow errors after logging.

const NOTION_VERSION = "2022-06-28";
const APPLICATIONS_DB = process.env.NOTION_APPLICATIONS_DB || "37018bf4e2574ddcb44b74cf57ff5109";
const PRAYER_LOG_DB = process.env.NOTION_PRAYER_LOG_DB || "82d7e115616440a791e6939175c148a2";

const PREFERENCE_LABELS = {
  any: "전체 부서",
  preschool: "유아-유치부",
  elementaryJr: "유년부",
  elementary: "초등부",
  youth: "중고등부"
};

const RHYTHM_LABELS = {
  daily: "매일",
  "three-times": "주 3회",
  weekly: "매주"
};

const DEPARTMENT_LABELS = {
  preschool: "유아-유치부",
  elementaryJr: "유년부",
  elementary: "초등부",
  youth: "중고등부"
};

// NOTION_TOKEN is the name the amicus-checkin project already uses, so the
// value can be copied between projects without renaming.
function notionKey() {
  return process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || "";
}

export function notionIsConfigured() {
  return Boolean(notionKey());
}

async function notionRequest(method, path, body, timeoutMs) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${notionKey()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Notion ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function text(value) {
  return { rich_text: [{ text: { content: String(value ?? "").slice(0, 200) } }] };
}

function title(value) {
  return { title: [{ text: { content: String(value ?? "").slice(0, 200) } }] };
}

function plainText(property) {
  const parts = property?.rich_text || property?.title || [];
  return parts.map((part) => part.plain_text || "").join("");
}

async function findPageBy(databaseId, propertyName, value, timeoutMs) {
  const data = await notionRequest("POST", `/databases/${databaseId}/query`, {
    filter: { property: propertyName, rich_text: { equals: value } },
    page_size: 1
  }, timeoutMs);
  return data.results?.[0] || null;
}

// studentId -> how many verified applications name that student. null means
// "could not find out", which callers must treat differently from "nobody".
export async function listAssignedCounts(timeoutMs = 5_000) {
  if (!notionIsConfigured()) return null;
  try {
    const counts = {};
    let cursor;
    for (let page = 0; page < 10; page += 1) {
      const data = await notionRequest("POST", `/databases/${APPLICATIONS_DB}/query`, {
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {})
      }, timeoutMs);
      for (const row of data.results || []) {
        const studentId = plainText(row.properties?.["학생 ID"]);
        if (studentId) counts[studentId] = (counts[studentId] || 0) + 1;
      }
      if (!data.has_more) break;
      cursor = data.next_cursor;
    }
    return counts;
  } catch (error) {
    console.error("Notion assigned-count read failed", { name: error?.name, status: error?.status });
    return null;
  }
}

// One row per applicationId; a resend updates the existing row instead of
// duplicating it. Never throws — a lost record must not break the applicant.
export async function recordApplication({ application, department, student, pickupCode, emailSent }) {
  if (!notionIsConfigured()) return { recorded: false, reason: "not_configured" };
  try {
    const properties = {
      "파트너 이름": title(application.partnerName),
      "이메일": { email: application.email },
      "희망 부서": { select: { name: PREFERENCE_LABELS[application.departmentPreference] || "전체 부서" } },
      "기도 약속": { select: { name: RHYTHM_LABELS[application.prayerRhythm] || "매주" } },
      "학생": text(student.name),
      "학생 ID": text(student.id),
      "매칭 부서": { select: { name: department.name } },
      "수령번호": text(pickupCode),
      "신청 ID": text(application.applicationId),
      "이메일 발송": { checkbox: Boolean(emailSent) },
      "신청 시각": { date: { start: new Date().toISOString() } }
    };

    const existing = await findPageBy(APPLICATIONS_DB, "신청 ID", application.applicationId, 8_000);
    if (existing) {
      await notionRequest("PATCH", `/pages/${existing.id}`, { properties }, 8_000);
    } else {
      await notionRequest("POST", "/pages", {
        parent: { database_id: APPLICATIONS_DB },
        properties
      }, 8_000);
    }
    return { recorded: true };
  } catch (error) {
    console.error("Notion application record failed", { name: error?.name, status: error?.status });
    return { recorded: false, reason: "write_failed" };
  }
}

// Anonymous per-person tally for the directory's "오늘 기도 기록하기" button.
export async function bumpPrayerCount({ key, name, departmentKey, role, delta }) {
  if (!notionIsConfigured()) return { recorded: false, reason: "not_configured" };
  try {
    const existing = await findPageBy(PRAYER_LOG_DB, "키", key, 6_000);
    if (existing) {
      const current = existing.properties?.["기도 횟수"]?.number || 0;
      const next = Math.max(0, current + delta);
      await notionRequest("PATCH", `/pages/${existing.id}`, {
        properties: {
          "기도 횟수": { number: next },
          ...(delta > 0 ? { "마지막 기도": { date: { start: new Date().toISOString().slice(0, 10) } } } : {})
        }
      }, 6_000);
      return { recorded: true, count: next };
    }

    const initial = Math.max(0, delta);
    await notionRequest("POST", "/pages", {
      parent: { database_id: PRAYER_LOG_DB },
      properties: {
        "대상": title(name),
        "키": text(key),
        "부서": { select: { name: DEPARTMENT_LABELS[departmentKey] || "유아-유치부" } },
        "역할": { select: { name: role === "staff" ? "간사" : "학생" } },
        "기도 횟수": { number: initial },
        ...(delta > 0 ? { "마지막 기도": { date: { start: new Date().toISOString().slice(0, 10) } } } : {})
      }
    }, 6_000);
    return { recorded: true, count: initial };
  } catch (error) {
    console.error("Notion prayer count failed", { name: error?.name, status: error?.status });
    return { recorded: false, reason: "write_failed" };
  }
}
