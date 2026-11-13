/* ==========================================================================
   Sign-in with passkeys (Face ID / Touch ID) — Netlify Function
   URL once deployed:  /.netlify/functions/auth

   There are no passwords anywhere. A passkey is a key pair: the private half
   stays in the person's keychain (iCloud Keychain, Google Password Manager…)
   behind Face ID / Touch ID, and only the public half is stored here.

   Setting up a device (first time, or a new phone):
     1. start        — the person enters their name and email; we email a
                       6-digit code to prove the address is theirs
     2. verify-code  — they type the code; we return passkey-creation options
     3. register     — the browser creates the passkey; we verify and store it

   Signing in afterwards:
     4. login-options — we return a one-time challenge
     5. login         — Face ID / Touch ID signs it; we verify the signature

   Needs these environment variables (see README.md):
     SESSION_SECRET   signs the session cookie
     RESEND_API_KEY   sends the 6-digit codes
     OWNER_EMAIL      the email that gets the owner page (default: NOTIFY_EMAIL)
   ========================================================================== */

import crypto from "node:crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { emailConfigured, sendEmail, shell, esc } from "../lib/email.mjs";
import {
  authStore, json, cookie, readCookie, hmac, safeEqual, sha256, normalizeEmail, userKey,
  roleFor, sessionCookie, clearSessionCookie, sameOrigin,
} from "../lib/session.mjs";

const RP_NAME = "Mike Ramirez, Barber";   // the name shown in the Face ID / Touch ID prompt
const FLOW_COOKIE = "mr_flow";
const FLOW_MINUTES = 10;                  // how long a code / challenge stays valid
const MAX_CODE_ATTEMPTS = 5;
const RESEND_WAIT_SECONDS = 60;           // minimum gap between codes to one address
const MAX_PASSKEYS = 10;                  // per account

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const fail = (message, status = 400) => json({ error: message }, status);

/* A "flow" is the short-lived server-side record of a sign-up or sign-in in
   progress. Its random id lives in an HttpOnly cookie. */
async function saveFlow(store, id, flow) {
  await store.setJSON(`flow/${id}`, { ...flow, exp: Date.now() + FLOW_MINUTES * 60000 });
}
async function loadFlow(store, req) {
  const id = readCookie(req, FLOW_COOKIE);
  if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id)) return {};
  const flow = await store.get(`flow/${id}`, { type: "json" });
  if (!flow || flow.exp < Date.now()) return {};
  return { id, flow };
}
const flowCookie = (req, id) => cookie(req, FLOW_COOKIE, id, FLOW_MINUTES * 60);
const clearFlowCookie = (req) => cookie(req, FLOW_COOKIE, "", 0);

const toBytes = (b64url) => new Uint8Array(Buffer.from(b64url, "base64url"));
const toB64 = (bytes) => Buffer.from(bytes).toString("base64url");

/* ---- 1. start ---------------------------------------------------------- */
async function start(req, body, store) {
  const email = normalizeEmail(body.email).slice(0, 120);
  const name = String(body.name || "").trim().slice(0, 80);
  if (!EMAIL_RE.test(email)) return fail("Please enter a valid email address.");
  if (!name) return fail("Please enter your name.");
  if (!emailConfigured()) {
    console.error("Sign-in codes can't be sent — set RESEND_API_KEY in Netlify (see README.md).");
    return fail("Sign-in isn't set up yet. Please call or text (520) 548-9830.", 503);
  }

  // One code per address per minute.
  const rateKey = `rate/${sha256(email)}`;
  const last = await store.get(rateKey, { type: "json" });
  if (last && Date.now() - last.at < RESEND_WAIT_SECONDS * 1000) {
    return fail("We just sent a code to that address. Please wait a minute before asking for another.", 429);
  }
  await store.setJSON(rateKey, { at: Date.now() });

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const id = crypto.randomBytes(24).toString("base64url");
  await saveFlow(store, id, { kind: "register", email, name, codeHash: hmac(`${id}:${code}`), attempts: 0, verified: false });

  try {
    await sendEmail({
      to: email,
      subject: `${code} is your sign-in code — Mike Ramirez, Barber`,
      html: shell(`<h1 style="margin:0 0 12px;font-size:22px;color:#F4F1EA">Your sign-in code</h1>
        <p style="margin:0 0 8px;color:#B9B4A8;font-size:15px;line-height:1.6">Hi ${esc(name)}, enter this code on the website to set up Face ID / Touch ID sign-in on your device:</p>
        <p style="margin:16px 0;font-size:34px;font-weight:bold;letter-spacing:8px;color:#C9A24B">${code}</p>
        <p style="margin:0;color:#B9B4A8;font-size:14px;line-height:1.6">It expires in ${FLOW_MINUTES} minutes. If you didn't ask for this, you can ignore this email — nothing will happen.</p>`),
    });
  } catch (error) {
    console.error("Could not send the sign-in code:", error);
    return fail("We couldn't send your code. Please try again, or call or text (520) 548-9830.", 502);
  }

  return json({ ok: true }, 200, { "Set-Cookie": flowCookie(req, id) });
}

/* ---- 2. verify-code ---------------------------------------------------- */
async function verifyCode(req, body, store, rp) {
  const { id, flow } = await loadFlow(store, req);
  if (!flow || flow.kind !== "register") return fail("That code has expired. Please start again.", 410);
  if (flow.attempts >= MAX_CODE_ATTEMPTS) return fail("Too many wrong codes. Please start again.", 429);

  const code = String(body.code || "").replace(/\D/g, "");
  if (!safeEqual(hmac(`${id}:${code}`), flow.codeHash)) {
    await saveFlow(store, id, { ...flow, attempts: flow.attempts + 1 });
    return fail("That code isn't right. Check the email and try again.");
  }

  const user = (await store.get(userKey(flow.email), { type: "json" })) || {
    id: crypto.randomBytes(16).toString("base64url"),
    email: flow.email,
    name: flow.name,
    credentials: [],
  };
  if (user.credentials.length >= MAX_PASSKEYS) return fail("This account already has the maximum number of devices.");

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.id,
    userName: user.email,
    userDisplayName: user.name,
    userID: toBytes(user.id),
    attestationType: "none",
    excludeCredentials: user.credentials.map((c) => ({ id: c.id, transports: c.transports })),
    authenticatorSelection: {
      residentKey: "required",       // saved in the keychain, so no typing at sign-in
      userVerification: "required",  // Face ID / Touch ID (or device passcode) every time
    },
  });

  await saveFlow(store, id, { ...flow, verified: true, userId: user.id, challenge: options.challenge });
  return json({ options });
}

/* ---- 3. register ------------------------------------------------------- */
async function register(req, body, store, rp) {
  const { id, flow } = await loadFlow(store, req);
  if (!flow || flow.kind !== "register" || !flow.verified || !flow.challenge) return fail("Your session expired. Please start again.", 410);

  let result;
  try {
    result = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: flow.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: true,
    });
  } catch (error) {
    console.error("Passkey registration failed verification:", error.message);
    return fail("We couldn't verify that passkey. Please try again.");
  }
  if (!result.verified) return fail("We couldn't verify that passkey. Please try again.");

  const { credential } = result.registrationInfo;
  const user = (await store.get(userKey(flow.email), { type: "json" })) || {
    id: flow.userId, email: flow.email, name: flow.name, credentials: [], createdAt: new Date().toISOString(),
  };
  user.credentials.push({
    id: credential.id,
    publicKey: toB64(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
    addedAt: new Date().toISOString(),
  });
  await store.setJSON(userKey(user.email), user);
  await store.setJSON(`cred/${credential.id}`, { email: user.email });   // lets sign-in find the account
  await store.delete(`flow/${id}`);

  return json({ ok: true, role: roleFor(user.email) }, 200, {
    "Set-Cookie": [sessionCookie(req, user.email), clearFlowCookie(req)],
  });
}

/* ---- 4. login-options -------------------------------------------------- */
async function loginOptions(req, store, rp) {
  const options = await generateAuthenticationOptions({ rpID: rp.id, userVerification: "required" });
  const id = crypto.randomBytes(24).toString("base64url");
  await saveFlow(store, id, { kind: "login", challenge: options.challenge });
  return json({ options }, 200, { "Set-Cookie": flowCookie(req, id) });
}

/* ---- 5. login ---------------------------------------------------------- */
async function login(req, body, store, rp) {
  const { id, flow } = await loadFlow(store, req);
  if (!flow || flow.kind !== "login") return fail("Your session expired. Please try again.", 410);
  await store.delete(`flow/${id}`);   // a challenge is good for one attempt only

  const unknown = () => fail("We don't recognise that passkey. If this is a new device, set it up below.", 401);
  const credId = String(body.response?.id || "");
  if (!/^[A-Za-z0-9_-]{10,}$/.test(credId)) return unknown();
  const link = await store.get(`cred/${credId}`, { type: "json" });
  const user = link && (await store.get(userKey(link.email), { type: "json" }));
  const saved = user?.credentials.find((c) => c.id === credId);
  if (!saved) return unknown();

  let result;
  try {
    result = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: flow.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: true,
      credential: { id: saved.id, publicKey: toBytes(saved.publicKey), counter: saved.counter, transports: saved.transports },
    });
  } catch (error) {
    console.error("Passkey sign-in failed verification:", error.message);
    return unknown();
  }
  if (!result.verified) return unknown();

  saved.counter = result.authenticationInfo.newCounter;
  saved.lastUsedAt = new Date().toISOString();
  await store.setJSON(userKey(user.email), user);

  return json({ ok: true, role: roleFor(user.email) }, 200, {
    "Set-Cookie": [sessionCookie(req, user.email), clearFlowCookie(req)],
  });
}

/* ----------------------------------------------------------------------- */
export default async (req) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);
  if (!sameOrigin(req)) return fail("Forbidden", 403);

  let body;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON");
  }

  // Passkeys are tied to the website's address. To pin it (for example after
  // adding a custom domain), set SITE_ORIGIN to e.g. https://yourdomain.com
  const origin = process.env.SITE_ORIGIN || new URL(req.url).origin;
  const rp = { origin, id: new URL(origin).hostname };

  try {
    hmac("check");   // fails early, with a clear log line, if SESSION_SECRET is missing
    const store = authStore();
    switch (body.action) {
      case "start": return await start(req, body, store);
      case "verify-code": return await verifyCode(req, body, store, rp);
      case "register": return await register(req, body, store, rp);
      case "login-options": return await loginOptions(req, store, rp);
      case "login": return await login(req, body, store, rp);
      case "logout": return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(req) });
      default: return fail("Unknown action");
    }
  } catch (error) {
    console.error("Auth function error:", error);
    return fail("Something went wrong on our side. Please try again.", 500);
  }
};
