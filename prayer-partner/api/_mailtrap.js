export function mailtrapIsConfigured() {
  const useSandbox = process.env.MAILTRAP_USE_SANDBOX === "true";
  return Boolean(
    process.env.MAILTRAP_API_KEY &&
    process.env.MAIL_FROM_EMAIL &&
    (!useSandbox || process.env.MAILTRAP_INBOX_ID)
  );
}

export async function sendMailtrap(payload) {
  if (!mailtrapIsConfigured()) return { configured: false, sent: false };

  const useSandbox = process.env.MAILTRAP_USE_SANDBOX === "true";
  const endpoint = useSandbox
    ? `https://sandbox.api.mailtrap.io/api/send/${encodeURIComponent(process.env.MAILTRAP_INBOX_ID)}`
    : "https://send.api.mailtrap.io/api/send";
  const message = {
    from: {
      email: process.env.MAIL_FROM_EMAIL,
      name: process.env.MAIL_FROM_NAME || "AMICUS NEXT CHURCH"
    },
    ...payload
  };

  if (process.env.MAIL_REPLY_TO) {
    message.reply_to = { email: process.env.MAIL_REPLY_TO };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MAILTRAP_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    console.error("Mailtrap delivery failed", { status: response.status });
    return { configured: true, sent: false, status: response.status };
  }

  return { configured: true, sent: true };
}
