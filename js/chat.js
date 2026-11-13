/* Chat assistant widget — loaded on every page.
   The browser only ever talks to our own serverless function
   (netlify/functions/chat.mjs). The Claude API key lives on the server in an
   environment variable and never appears in this file. */
(function () {
  "use strict";

  var ENDPOINT = "/.netlify/functions/chat";
  var PHONE = "(520) 548-9830";
  var STORE_KEY = "mr-chat-v1";
  var GREETING = "Hey! I'm Mike's booking assistant. Ask me about prices, the shop, or what cut might suit you — or I can walk you through booking.";
  var FALLBACK = "Sorry, I can't help with that right now. Please call or text Mike at " + PHONE + ".";
  var QUICK = ["Prices", "Book an appointment", "Where are you located"];

  var messages = [];   // [{ role: "user" | "assistant", content: "..." }]
  var busy = false;

  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]");
    if (Array.isArray(saved)) messages = saved;
  } catch (err) { /* storage unavailable — start fresh */ }

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-20))); } catch (err) { /* ignore */ }
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text) node.textContent = text;
    return node;
  }

  /* ---- Build the widget ---- */
  var fab = el("button", { type: "button", class: "chat-fab", "aria-label": "Chat with our assistant", "aria-expanded": "false", "aria-controls": "chat-panel" });
  fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>';

  var panel = el("section", { id: "chat-panel", class: "chat-panel", role: "dialog", "aria-label": "Chat with Mike's assistant", hidden: "" });

  var head = el("div", { class: "chat-head" });
  head.appendChild(el("div", { class: "chat-head__avatar", "aria-hidden": "true" }, "M"));
  var headText = el("div");
  headText.appendChild(el("div", { class: "chat-head__title" }, "Mike's Assistant"));
  headText.appendChild(el("div", { class: "chat-head__sub" }, "Prices, location and booking help"));
  head.appendChild(headText);
  var closeBtn = el("button", { type: "button", class: "chat-close", "aria-label": "Close chat" }, "×");
  head.appendChild(closeBtn);

  var log = el("div", { class: "chat-log", role: "log", "aria-live": "polite", tabindex: "0", "aria-label": "Conversation" });

  var quick = el("div", { class: "chat-quick" });
  QUICK.forEach(function (label) {
    var b = el("button", { type: "button" }, label);
    b.addEventListener("click", function () { send(label); });
    quick.appendChild(b);
  });

  var form = el("form", { class: "chat-form" });
  var input = el("input", { type: "text", name: "message", placeholder: "Type your question…", autocomplete: "off", maxlength: "500", "aria-label": "Your message" });
  var sendBtn = el("button", { type: "submit", "aria-label": "Send message" });
  sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>';
  form.appendChild(input);
  form.appendChild(sendBtn);

  var foot = el("div", { class: "chat-foot" }, "AI assistant — for anything it can't answer, call or text " + PHONE + ".");

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(quick);
  panel.appendChild(form);
  panel.appendChild(foot);
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  /* ---- Rendering ---- */
  // Turns URLs, the request-form path and the phone number into links,
  // building DOM nodes directly so reply text is never treated as HTML.
  var LINK_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"]|\/?booking\.html(?:#[\w-]+)?|\(520\) 548-9830)/g;

  function fill(node, text) {
    var last = 0;
    text.replace(LINK_RE, function (match, _g, offset) {
      if (offset > last) node.appendChild(document.createTextNode(text.slice(last, offset)));
      var a = document.createElement("a");
      if (match.charAt(0) === "(") {
        a.href = "tel:+15205489830";
        a.textContent = match;
      } else if (/^https?:/.test(match)) {
        a.href = match;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = match.replace(/^https?:\/\//, "");
      } else {
        a.href = "booking.html" + (match.split("#")[1] ? "#" + match.split("#")[1] : "");
        a.textContent = "the booking request form";
      }
      node.appendChild(a);
      last = offset + match.length;
      return match;
    });
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  function addBubble(role, text) {
    var bubble = el("div", { class: "chat-msg chat-msg--" + (role === "user" ? "user" : "bot") });
    fill(bubble, text);
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function showTyping() {
    var bubble = el("div", { class: "chat-msg chat-msg--bot", "aria-label": "Assistant is typing" });
    bubble.innerHTML = '<span class="chat-typing"><i></i><i></i><i></i></span>';
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  addBubble("assistant", GREETING);
  messages.forEach(function (m) { addBubble(m.role, m.content); });

  /* ---- Sending ---- */
  function send(text) {
    text = String(text || "").trim().slice(0, 500);
    if (!text || busy) return;
    busy = true;
    sendBtn.disabled = true;
    quick.hidden = true;

    messages.push({ role: "user", content: text });
    addBubble("user", text);
    var typing = showTyping();

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-12) })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Chat request failed");
        return res.json();
      })
      .then(function (data) {
        var reply = (data && data.reply) || FALLBACK;
        typing.remove();
        messages.push({ role: "assistant", content: reply });
        addBubble("assistant", reply);
        save();
      })
      .catch(function () {
        typing.remove();
        messages.pop(); // drop the unanswered question so history stays valid
        addBubble("assistant", FALLBACK);
      })
      .then(function () {
        busy = false;
        sendBtn.disabled = false;
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value;
    input.value = "";
    send(text);
  });

  /* ---- Open / close ---- */
  function open() {
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    log.scrollTop = log.scrollHeight;
    input.focus();
  }
  function close() {
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    fab.focus();
  }
  fab.addEventListener("click", function () { panel.hidden ? open() : close(); });
  closeBtn.addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  // Any element with data-open-chat (e.g. the hero button) opens the chat
  document.querySelectorAll("[data-open-chat]").forEach(function (trigger) {
    trigger.addEventListener("click", function (e) { e.preventDefault(); open(); });
  });
})();
