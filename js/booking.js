/* Booking request form.
   Sends the form to the Netlify Function at netlify/functions/booking.mjs,
   which emails Mike and sends the client a confirmation.
   The destination email is NOT set here — it is the NOTIFY_EMAIL setting
   described in README.md. */
(function () {
  "use strict";

  var ENDPOINT = "/.netlify/functions/booking";
  var PHONE = "(520) 548-9830";

  var form = document.getElementById("booking-form");
  if (!form) return;

  var status = document.getElementById("form-status");
  var submit = form.querySelector('button[type="submit"]');
  var dateInput = form.querySelector('input[name="date"]');

  // No dates in the past
  if (dateInput) {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    dateInput.min = local.toISOString().slice(0, 10);
  }

  // Pre-select a service from a link like booking.html?service=Kids%20Haircut
  var wanted = new URLSearchParams(window.location.search).get("service");
  if (wanted) {
    var select = form.querySelector('select[name="service"]');
    Array.prototype.forEach.call(select.options, function (opt) {
      if (opt.value === wanted) select.value = wanted;
    });
  }

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = "form-status full" + (kind ? " is-" + kind : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = String(value).trim(); });

    submit.disabled = true;
    setStatus("Sending your request…");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || "Request failed");
          return body;
        });
      })
      .then(function () {
        form.reset();
        setStatus("Request sent. Check your email for a confirmation — Mike will be in touch to lock in your time.", "ok");
      })
      .catch(function () {
        setStatus("Sorry, that didn't go through. Please call or text " + PHONE + " and Mike will get you booked.", "err");
      })
      .then(function () { submit.disabled = false; });
  });
})();
