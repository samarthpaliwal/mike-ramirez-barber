/* Shared sign-in plumbing: storage, session cookies and small helpers.

   Storage is Netlify Blobs (built into Netlify, nothing to set up).
   Sessions are a signed, HttpOnly cookie — JavaScript in the page can't read
   it, and it can't be forged without SESSION_SECRET. */

import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const SESSION_DAYS = 7;
const SESSION_COOKIE = "mr_session";

/* ---- Storage ---- */
export const authStore = () => getStore({ name: "auth", consistency: "strong" });
export const bookingStore = () => getStore({ name: "bookings", consistency: "strong" });

export const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
export const userKey = (email) => `user/${sha256(normalizeEmail(email))}`;

/* ---- Who is the owner? ----
   The owner page opens only for the person who can receive email at
   OWNER_EMAIL (falls back to NOTIFY_EMAIL). Everyone else is a client. */
export function roleFor(email) {
  const owner = normalizeEmail(process.env.OWNER_EMAIL || process.env.NOTIFY_EMAIL);
  return owner && normalizeEmail(email) === owner ? "owner" : "client";
}

/* ---- Responses ---- */
export const json = (body, status = 200, headers = {}) => {
  const h = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  for (const [key, value] of Object.entries(headers)) {
    for (const v of [].concat(value)) h.append(key, v);
  }
  return new Response(JSON.stringify(body), { status, headers: h });
};

/* ---- Cookies ---- */
export function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function cookie(req, name, value, maxAgeSeconds) {
  // "Secure" is left off only on http://localhost so local testing works.
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

/* ---- Signing ---- */
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET is missing or shorter than 32 characters — set it in Netlify (see README.md).");
  return value;
}

export const hmac = (text) => crypto.createHmac("sha256", secret()).update(text).digest("base64url");

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---- Sessions ---- */
export function sessionCookie(req, email) {
  const payload = Buffer.from(JSON.stringify({ email: normalizeEmail(email), exp: Date.now() + SESSION_DAYS * 86400000 })).toString("base64url");
  return cookie(req, SESSION_COOKIE, `${payload}.${hmac(payload)}`, SESSION_DAYS * 86400);
}

export const clearSessionCookie = (req) => cookie(req, SESSION_COOKIE, "", 0);

// Returns { email, role } for a valid, unexpired session cookie, else null.
export function getSession(req) {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !safeEqual(signature, hmac(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.email !== "string" || !(data.exp > Date.now())) return null;
    return { email: data.email, role: roleFor(data.email) };
  } catch {
    return null;
  }
}

/* ---- Cross-site request protection ----
   Requests that change something must come from our own pages. */
export function sameOrigin(req) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}
