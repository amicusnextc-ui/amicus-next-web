import { mailtrapIsConfigured, sendMailtrap } from "./_mailtrap.js";

// One door for outgoing mail. The church already sends the check-in app's
// mail through Resend from the verified amicuschurch.com domain, so when
// RESEND_API_KEY is present — the same key the amicus-checkin project uses —
// mail goes that way and no Mailtrap setup is needed at all. Mailtrap remains
// as the fallback for anyone who configured it instead.

const RESEND_DEFAULT_FROM = "noreply@amicuschurch.com";

export function mailIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY) || mailtrapIsConfigured();
}

export async function sendMail(payload) {
  if (process.env.RESEND_API_KEY) return sendResend(payload);
  return sendMailtrap(payload);
}

// The endpoints build Mailtrap-shaped payloads; translate for Resend here so
// they don't need to know which provider is live.
async function sendResend({ to, subject, text, html, attachments }) {
  const fromEmail = process.env.MAIL_FROM_EMAIL || RESEND_DEFAULT_FROM;
  const fromName = process.env.MAIL_FROM_NAME || "AMICUS NEXT CHURCH";

  const message = {
    from: `${fromName} <${fromEmail}>`,
    to: (to || []).map((recipient) => recipient.email),
    subject,
    text,
    html
  };
  if (process.env.MAIL_REPLY_TO) {
    message.reply_to = process.env.MAIL_REPLY_TO;
  }
  if (attachments?.length) {
    message.attachments = attachments.map(({ filename, content }) => ({ filename, content }));
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    console.error("Resend delivery failed", { status: response.status, name: detail?.name });
    return { configured: true, sent: false, status: response.status };
  }
  return { configured: true, sent: true };
}
