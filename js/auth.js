/* Sign-in page (login.html) — passkeys with Face ID / Touch ID.
   No password is ever typed or stored. The browser's built-in passkey
   feature (WebAuthn) does the work; this file just talks to
   netlify/functions/auth.mjs. */
(function () {
  "use strict";

  var ENDPOINT = "/.netlify/functions/auth";

  var signInBtn = document.getElementById("passkey-signin");
  var signInStatus = document.getElementById("signin-status");
  var startForm = document.getElementById("setup-start");
  var codeForm = document.getElementById("setup-code");
  var setupStatus = document.getElementById("setup-status");
  var unsupported = document.getElementById("passkey-unsupported");
  if (!signInBtn) return;

  /* ---- helpers ---- */
  function toBuffer(b64url) {
    var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function toB64(buffer) {
    var bytes = new Uint8Array(buffer);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function say(el, text, kind) {
    el.textContent = text;
    el.className = "form-status" + (kind ? " is-" + kind : "");
  }
  function call(action, data) {
    var body = data || {};
    body.action = action;
    return fetch(ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
        return json;
      });
    });
  }
  function goToAccount(role) {
    window.location.href = role === "owner" ? "owner.html" : "account.html";
  }
  // The browser throws NotAllowedError when the person cancels the prompt.
  function friendly(err, fallback) {
    if (err && err.name === "NotAllowedError") return "Cancelled. Tap the button to try again.";
    if (err && err.name === "InvalidStateError") return "This device is already set up. Use the sign-in button above.";
    return (err && err.message) || fallback;
  }

  /* ---- already signed in? go straight to the account ---- */
  fetch("/.netlify/functions/account", { credentials: "same-origin" })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { if (data && data.user) goToAccount(data.user.role); })
    .catch(function () { /* not signed in */ });

  if (!window.PublicKeyCredential || !navigator.credentials) {
    unsupported.hidden = false;
    signInBtn.disabled = true;
    startForm.querySelector("button").disabled = true;
    return;
  }

  /* ---- sign in with an existing passkey ---- */
  signInBtn.addEventListener("click", function () {
    signInBtn.disabled = true;
    say(signInStatus, "Waiting for Face ID / Touch ID…");
    call("login-options")
      .then(function (data) {
        var o = data.options;
        return navigator.credentials.get({
          publicKey: {
            challenge: toBuffer(o.challenge),
            rpId: o.rpId,
            timeout: o.timeout,
            userVerification: o.userVerification,
            allowCredentials: []
          }
        });
      })
      .then(function (cred) {
        var r = cred.response;
        return call("login", {
          response: {
            id: cred.id,
            rawId: toB64(cred.rawId),
            type: cred.type,
            response: {
              clientDataJSON: toB64(r.clientDataJSON),
              authenticatorData: toB64(r.authenticatorData),
              signature: toB64(r.signature),
              userHandle: r.userHandle ? toB64(r.userHandle) : undefined
            },
            clientExtensionResults: cred.getClientExtensionResults(),
            authenticatorAttachment: cred.authenticatorAttachment || undefined
          }
        });
      })
      .then(function (data) {
        say(signInStatus, "Signed in. One moment…", "ok");
        goToAccount(data.role);
      })
      .catch(function (err) {
        say(signInStatus, friendly(err, "Sign-in failed. Please try again."), "err");
        signInBtn.disabled = false;
      });
  });

  /* ---- set up this device: step 1, email a code ---- */
  startForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!startForm.reportValidity()) return;
    var btn = startForm.querySelector("button");
    btn.disabled = true;
    say(setupStatus, "Sending your code…");
    call("start", { name: startForm.elements.name.value, email: startForm.elements.email.value })
      .then(function () {
        startForm.hidden = true;
        codeForm.hidden = false;
        say(setupStatus, "We emailed a 6-digit code to " + startForm.elements.email.value.trim() + ".", "ok");
        codeForm.elements.code.focus();
      })
      .catch(function (err) { say(setupStatus, err.message, "err"); })
      .then(function () { btn.disabled = false; });
  });

  /* ---- step 2 and 3: check the code, then create the passkey ---- */
  codeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!codeForm.reportValidity()) return;
    var btn = codeForm.querySelector("button");
    btn.disabled = true;
    say(setupStatus, "Checking your code…");
    call("verify-code", { code: codeForm.elements.code.value })
      .then(function (data) {
        var o = data.options;
        say(setupStatus, "Code accepted. Follow the Face ID / Touch ID prompt…", "ok");
        o.challenge = toBuffer(o.challenge);
        o.user.id = toBuffer(o.user.id);
        o.excludeCredentials = (o.excludeCredentials || []).map(function (c) {
          return { id: toBuffer(c.id), type: c.type, transports: c.transports };
        });
        return navigator.credentials.create({ publicKey: o });
      })
      .then(function (cred) {
        var r = cred.response;
        return call("register", {
          response: {
            id: cred.id,
            rawId: toB64(cred.rawId),
            type: cred.type,
            response: {
              clientDataJSON: toB64(r.clientDataJSON),
              attestationObject: toB64(r.attestationObject),
              transports: r.getTransports ? r.getTransports() : undefined
            },
            clientExtensionResults: cred.getClientExtensionResults(),
            authenticatorAttachment: cred.authenticatorAttachment || undefined
          }
        });
      })
      .then(function (data) {
        say(setupStatus, "All set. Signing you in…", "ok");
        goToAccount(data.role);
      })
      .catch(function (err) {
        say(setupStatus, friendly(err, "That didn't work. Please try again."), "err");
        btn.disabled = false;
      });
  });

  document.getElementById("setup-restart").addEventListener("click", function () {
    codeForm.hidden = true;
    codeForm.reset();
    startForm.hidden = false;
    say(setupStatus, "");
  });
})();
