import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_MS = 10 * 60 * 1000;

// An explicit EMAIL_SIGNING_SECRET wins. Without one, a key is derived from
// RESEND_API_KEY — it only signs 10-minute verification tokens, so rotating
// the Resend key merely voids codes that are already in flight.
function signingSecret() {
  const explicit = String(process.env.EMAIL_SIGNING_SECRET || "");
  if (explicit.length >= 32) return explicit;
  const resendKey = String(process.env.RESEND_API_KEY || "");
  if (resendKey) {
    return createHash("sha256").update(`amicus-prayer-partner-token-signing:${resendKey}`).digest("hex");
  }
  throw new Error("EMAIL_SIGNING_SECRET_NOT_CONFIGURED");
}

export function signingIsConfigured() {
  try {
    signingSecret();
    return true;
  } catch {
    return false;
  }
}

function hmac(value) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createVerificationChallenge(application) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const nonce = randomBytes(18).toString("base64url");
  const payload = {
    version: 1,
    ...application,
    nonce,
    codeDigest: hmac(`code:${nonce}:${code}`),
    expiresAt: Date.now() + TOKEN_LIFETIME_MS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(`token:${encodedPayload}`);
  return { code, token: `${encodedPayload}.${signature}`, expiresAt: payload.expiresAt };
}

export function verifyChallenge(token, code) {
  const [encodedPayload, suppliedSignature, extra] = String(token || "").split(".");
  if (!encodedPayload || !suppliedSignature || extra) return null;
  const expectedSignature = hmac(`token:${encodedPayload}`);
  if (!safeEqual(suppliedSignature, expectedSignature)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.version !== 1 || !Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) return null;
  if (!/^\d{6}$/.test(String(code || ""))) return null;
  const suppliedCodeDigest = hmac(`code:${payload.nonce}:${code}`);
  if (!safeEqual(payload.codeDigest, suppliedCodeDigest)) return null;
  return payload;
}
