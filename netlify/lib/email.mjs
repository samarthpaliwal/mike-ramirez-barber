/* Shared email helper (used by the booking form and the sign-in codes).
   Emails are sent with Resend — https://resend.com */

// The "from" address on every email. It must be on a domain you have verified
// in Resend, e.g. "Mike Ramirez, Barber <bookings@yourdomain.com>".
// Until a domain is verified, Resend's test sender below only delivers to the
// email address you signed up to Resend with.
export const FROM_EMAIL = process.env.FROM_EMAIL || "Mike Ramirez, Barber <onboarding@resend.dev>";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function sendEmail({ to, subject, html, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, reply_to: replyTo }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

// Dark, branded wrapper used by every email.
export const shell = (inner) => `
<div style="background:#0B0B0C;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#F4F1EA">
  <div style="max-width:520px;margin:0 auto;background:#1A1A1D;border:1px solid #2E2E33;border-radius:12px;padding:28px">
    <p style="margin:0 0 20px;font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#F4F1EA">Mike Ramirez, <span style="color:#C9A24B;font-style:italic">Barber</span></p>
    ${inner}
  </div>
</div>`;
