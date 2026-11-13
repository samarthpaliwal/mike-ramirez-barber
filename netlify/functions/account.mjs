/* ==========================================================================
   Account data — Netlify Function
   URL once deployed:  /.netlify/functions/account

   GET   returns the signed-in person and their booking requests.
         - a client sees only requests made with their own email address
         - the owner (OWNER_EMAIL) sees every request
   POST  { id, handled }  owner only: tick a request off as handled.

   Everything is checked here on the server; the pages only display what this
   function decides to send.
   ========================================================================== */

import { authStore, bookingStore, getSession, json, userKey, sameOrigin } from "../lib/session.mjs";

const MAX_LISTED = 200;   // newest requests shown

export default async (req) => {
  let session;
  try {
    session = getSession(req);
  } catch (error) {
    console.error("Account function error:", error.message);
    return json({ error: "Sign-in isn't set up yet." }, 500);
  }
  if (!session) return json({ error: "Not signed in" }, 401);

  try {
    const bookings = bookingStore();

    if (req.method === "POST") {
      if (!sameOrigin(req)) return json({ error: "Forbidden" }, 403);
      if (session.role !== "owner") return json({ error: "Forbidden" }, 403);
      const body = await req.json().catch(() => ({}));
      const id = String(body.id || "");
      if (!/^\d{13}-[a-f0-9]{8}$/.test(id)) return json({ error: "Unknown request" }, 400);
      const booking = await bookings.get(id, { type: "json" });
      if (!booking) return json({ error: "Unknown request" }, 404);
      booking.handled = Boolean(body.handled);
      await bookings.setJSON(id, booking);
      return json({ ok: true });
    }

    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

    const user = await authStore().get(userKey(session.email), { type: "json" });
    if (!user) return json({ error: "Not signed in" }, 401);

    // Keys start with a timestamp, so sorting them newest-first is enough.
    const { blobs } = await bookings.list();
    const keys = blobs.map((b) => b.key).sort().reverse();
    const all = (await Promise.all(keys.slice(0, MAX_LISTED * 3).map(async (key) => {
      const booking = await bookings.get(key, { type: "json" });
      return booking && { id: key, ...booking };
    }))).filter(Boolean);

    const visible = session.role === "owner" ? all : all.filter((b) => b.email === session.email);
    const list = visible.slice(0, MAX_LISTED).map((b) =>
      session.role === "owner"
        ? b
        // Clients get their own request details, not internal fields.
        : { id: b.id, service: b.service, date: b.date, time: b.time, notes: b.notes, createdAt: b.createdAt, handled: b.handled });

    return json({
      user: { name: user.name, email: user.email, role: session.role, devices: user.credentials.length },
      bookings: list,
    });
  } catch (error) {
    console.error("Account function error:", error);
    return json({ error: "Something went wrong on our side." }, 500);
  }
};
