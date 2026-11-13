/* ==========================================================================
   Booking request email — Netlify Function
   URL once deployed:  /.netlify/functions/booking

   When the booking form is submitted this function:
     1. emails the request to Mike, and
     2. sends the client an automatic confirmation.
   Emails are sent with Resend (https://resend.com), a transactional email
   service with a free tier.
   ========================================================================== */

/* ---- CONFIG — the settings to change ----------------------------------- */

// >>> DESTINATION EMAIL: where booking requests are sent. <<<
// Best practice is to set NOTIFY_EMAIL in Netlify's environment variables
// (see README.md). If you'd rather hard-code it, replace the placeholder
// address on the right.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "CHANGE-ME@example.com";

// The "from" address on both emails. It must be on a domain you have verified
// in Resend, e.g. "Mike Ramirez, Barber <bookings@yourdomain.com>".
// Until a domain is verified, Resend's test sender below only delivers to the
// email address you signed up to Resend with — so Mike's notification works
// if NOTIFY_EMAIL is that address, but client confirmations will not send.
const FROM_EMAIL = process.env.FROM_EMAIL || "Mike Ramirez, Barber <onboarding@resend.dev>";

// The Resend API key. Set RESEND_API_KEY in Netlify — never paste it here.
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const PHONE = "(520) 548-9830";
const BOOKING_LINK = "https://getsqr.co/michael-ramirez-6";
const SERVICES = ["Adult Haircut", "Adult Haircut and Beard", "Kids Haircut"];

/* ----------------------------------------------------------------------- */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const clean = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

async function sendEmail({ to, subject, html, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, reply_to: replyTo }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

function prettyDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function prettyTime(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const h = Number(match[1]);
  return `${h % 12 || 12}:${match[2]} ${h < 12 ? "AM" : "PM"}`;
}

const shell = (inner) => `
<div style="background:#0B0B0C;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#F4F1EA">
  <div style="max-width:520px;margin:0 auto;background:#1A1A1D;border:1px solid #2E2E33;border-radius:12px;padding:28px">
    <p style="margin:0 0 20px;font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#F4F1EA">Mike Ramirez, <span style="color:#C9A24B;font-style:italic">Barber</span></p>
    ${inner}
  </div>
</div>`;

const row = (label, value) =>
  `<tr><td style="padding:8px 12px 8px 0;color:#C9A24B;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:8px 0;color:#F4F1EA;font-size:15px">${value}</td></tr>`;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Spam trap: real people never fill the hidden "company" field.
  if (clean(body.company, 100)) return json({ ok: true });

  const data = {
    name: clean(body.name, 80),
    phone: clean(body.phone, 30),
    email: clean(body.email, 120),
    service: clean(body.service, 60),
    date: clean(body.date, 10),
    time: clean(body.time, 5),
    notes: clean(body.notes, 1000),
  };

  if (!data.name || !data.phone || !data.date || !data.time) return json({ error: "Please fill in every required field." }, 400);
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(data.email)) return json({ error: "Please enter a valid email address." }, 400);
  if (!SERVICES.includes(data.service)) return json({ error: "Please choose a service." }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !/^\d{2}:\d{2}$/.test(data.time)) return json({ error: "Please choose a date and time." }, 400);

  if (!RESEND_API_KEY || NOTIFY_EMAIL === "CHANGE-ME@example.com") {
    console.error("Booking email is not configured — set RESEND_API_KEY and NOTIFY_EMAIL in Netlify (see README.md).");
    return json({ error: "Booking email is not set up yet." }, 500);
  }

  const when = `${prettyDate(data.date)} at ${prettyTime(data.time)}`;
  const details = `
    <table style="border-collapse:collapse;width:100%">
      ${row("Service", esc(data.service))}
      ${row("Preferred time", esc(when))}
      ${row("Name", esc(data.name))}
      ${row("Phone", esc(data.phone))}
      ${row("Email", esc(data.email))}
      ${data.notes ? row("Notes", esc(data.notes).replace(/\n/g, "<br>")) : ""}
    </table>`;

  // 1. The request, to Mike. If this fails the client is told to call instead.
  try {
    await sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: data.email,
      subject: `Booking request: ${data.name}, ${data.service}, ${prettyDate(data.date)}`,
      html: shell(`<h1 style="margin:0 0 16px;font-size:22px;color:#F4F1EA">New booking request</h1>${details}
        <p style="margin:20px 0 0;color:#B9B4A8;font-size:14px">Reply to this email to answer ${esc(data.name)} directly.</p>`),
    });
  } catch (error) {
    console.error("Could not email the booking request:", error);
    return json({ error: "We couldn't send your request." }, 502);
  }

  // 2. The automatic confirmation, to the client. A failure here doesn't lose
  //    the booking (Mike already has it), so it is logged rather than shown.
  try {
    await sendEmail({
      to: data.email,
      replyTo: NOTIFY_EMAIL,
      subject: "We got your booking request — Mike Ramirez, Barber",
      html: shell(`<h1 style="margin:0 0 12px;font-size:22px;color:#F4F1EA">Thanks, ${esc(data.name)}. Request received.</h1>
        <p style="margin:0 0 16px;color:#B9B4A8;font-size:15px;line-height:1.6">Mike has your request and will get back to you to confirm a time. Your appointment isn't confirmed until you hear from him.</p>
        ${details}
        <p style="margin:20px 0 0;color:#B9B4A8;font-size:14px;line-height:1.6">Want a confirmed slot right now? Book online: <a href="${BOOKING_LINK}" style="color:#C9A24B">${BOOKING_LINK}</a><br>
        Questions? Call or text ${PHONE}.<br>Double Edged Barbershop, 1065 E Tucson Marketplace Blvd, Tucson, AZ</p>`),
    });
  } catch (error) {
    console.error("Booking request was delivered, but the client confirmation failed:", error);
  }

  return json({ ok: true });
};
