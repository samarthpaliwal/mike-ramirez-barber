/* Signed-in pages: account.html (clients) and owner.html (Mike).
   The server decides what each person may see; this file only displays it.
   Anyone not signed in is sent to login.html. */
(function () {
  "use strict";

  var ACCOUNT = "/.netlify/functions/account";
  var AUTH = "/.netlify/functions/auth";
  var page = document.body.getAttribute("data-page");   // "account" or "owner"

  var greeting = document.getElementById("greeting");
  var summary = document.getElementById("summary");
  var list = document.getElementById("request-list");
  var content = document.getElementById("account-content");
  var ownerLink = document.getElementById("owner-link");
  if (!list) return;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function prettyWhen(date, time) {
    var d = new Date(date + "T" + (time || "12:00") + ":00");
    if (isNaN(d.getTime())) return date + " " + time;
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) +
      " at " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function detail(label, node) {
    var row = el("div", "request__row");
    row.appendChild(el("span", "request__label", label));
    var value = el("span", "request__value");
    if (typeof node === "string") value.textContent = node; else value.appendChild(node);
    row.appendChild(value);
    return row;
  }

  function link(href, text) {
    var a = el("a", null, text);
    a.href = href;
    return a;
  }

  function render(data) {
    var isOwner = page === "owner";
    var items = data.bookings;
    greeting.textContent = isOwner ? "Booking requests" : "Hi, " + data.user.name.split(" ")[0] + ".";

    if (isOwner) {
      var open = items.filter(function (b) { return !b.handled; }).length;
      summary.textContent = items.length
        ? open + " waiting on you, " + (items.length - open) + " handled."
        : "No requests yet. They'll appear here as soon as someone uses the form on the booking page.";
    } else {
      summary.textContent = items.length
        ? "Here are the booking requests you've sent with " + data.user.email + "."
        : "You haven't sent any booking requests with " + data.user.email + " yet.";
      if (data.user.role === "owner" && ownerLink) ownerLink.hidden = false;
    }

    list.innerHTML = "";
    items.forEach(function (b) {
      var card = el("li", "card request" + (b.handled ? " is-handled" : ""));
      var head = el("div", "request__head");
      head.appendChild(el("h3", null, isOwner ? b.name : b.service));
      var pill = el("span", "pill" + (b.handled ? " pill--done" : ""), b.handled ? (isOwner ? "Handled" : "Seen by Mike") : (isOwner ? "New" : "Waiting on Mike"));
      head.appendChild(pill);
      card.appendChild(head);

      if (isOwner) card.appendChild(detail("Service", b.service));
      card.appendChild(detail("Preferred", prettyWhen(b.date, b.time)));
      if (isOwner) {
        card.appendChild(detail("Phone", link("tel:" + b.phone.replace(/[^\d+]/g, ""), b.phone)));
        card.appendChild(detail("Email", link("mailto:" + b.email, b.email)));
      }
      if (b.notes) card.appendChild(detail("Notes", b.notes));
      if (b.createdAt) card.appendChild(detail("Sent", new Date(b.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })));

      if (isOwner) {
        var btn = el("button", "btn btn--ghost btn--sm", b.handled ? "Mark as new" : "Mark as handled");
        btn.type = "button";
        btn.addEventListener("click", function () {
          btn.disabled = true;
          fetch(ACCOUNT, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: b.id, handled: !b.handled })
          }).then(function (res) {
            if (!res.ok) throw new Error();
            b.handled = !b.handled;
            render(data);
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = "Couldn't save — try again";
          });
        });
        card.appendChild(btn);
      }
      list.appendChild(card);
    });

    content.hidden = false;
  }

  fetch(ACCOUNT, { credentials: "same-origin" })
    .then(function (res) {
      if (res.status === 401) { window.location.replace("login.html"); return null; }
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      // The owner page is for the owner only. (The server never sends other
      // people's requests to a client, whatever page they open.)
      if (page === "owner" && data.user.role !== "owner") { window.location.replace("account.html"); return; }
      render(data);
    })
    .catch(function () {
      greeting.textContent = "We couldn't load your account.";
      summary.textContent = "Please refresh the page, or call or text (520) 548-9830.";
      content.hidden = false;
    });

  var signOut = document.getElementById("sign-out");
  if (signOut) {
    signOut.addEventListener("click", function () {
      fetch(AUTH, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" })
      }).catch(function () { /* ignore */ }).then(function () { window.location.href = "index.html"; });
    });
  }
})();
