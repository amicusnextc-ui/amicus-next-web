const DEFAULT_ALLOWED_ORIGINS = [
  "https://amicus-prayer-partner.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

// The deployment's own hostnames, injected by Vercel. Without these only the
// production domain passes, so a preview deployment rejects requests from its
// own pages and email can never be exercised before release. This admits the
// deployment itself, not *.vercel.app at large.
function selfOrigins() {
  return [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ]
    .filter(Boolean)
    .map((host) => `https://${String(host).trim()}`);
}

export function isAllowedOrigin(origin) {
  const configured = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...selfOrigins(), ...configured]);
  return Boolean(origin && allowed.has(origin));
}

export async function readJsonBody(request, maxBytes = 12_000) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new Error("REQUEST_TOO_LARGE");
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) throw new Error("REQUEST_TOO_LARGE");
  return JSON.parse(rawBody);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function validateVerificationRequest(body) {
  const eventCode = String(body.eventCode || "").trim().toUpperCase();
  const configuredEventCode = String(process.env.PARTNER_EVENT_CODE || "AMICUS26").trim().toUpperCase();
  const partnerName = String(body.partnerName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const departmentPreference = String(body.departmentPreference || "any");
  const prayerRhythm = String(body.prayerRhythm || "");
  const applicationId = String(body.applicationId || "");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const allowedDepartments = new Set(["any", "preschool", "elementaryJr", "elementary", "youth"]);
  const allowedRhythms = new Set(["weekly", "three-times", "daily"]);

  if (!eventCode || eventCode !== configuredEventCode) return null;
  if (partnerName.length < 2 || partnerName.length > 40 || !emailPattern.test(email)) return null;
  if (!/^[a-z0-9-]{8,100}$/i.test(applicationId)) return null;
  if (!allowedDepartments.has(departmentPreference) || !allowedRhythms.has(prayerRhythm)) return null;

  return { eventCode, partnerName, email, departmentPreference, prayerRhythm, applicationId };
}

export function validateSignedAssignment(body) {
  const application = validateVerificationRequest(body);
  const departmentKey = String(body.departmentKey || "");
  const studentId = String(body.studentId || "");
  if (!application || !/^[a-z0-9-]{4,80}$/i.test(studentId) || !/^[a-zA-Z]{3,30}$/.test(departmentKey)) return null;
  return { ...application, departmentKey, studentId };
}
