/* Cuts gallery lightbox.
   Each card in gallery.html carries its own photo, description and hidden
   step list, so to edit a cut you only edit the HTML. */
(function () {
  "use strict";

  var dialog = document.getElementById("lightbox");
  if (!dialog || typeof dialog.showModal !== "function") return;

  var img = dialog.querySelector(".lightbox__img");
  var title = dialog.querySelector("#lightbox-title");
  var desc = dialog.querySelector(".lightbox__desc");
  var steps = dialog.querySelector(".lightbox__steps");
  var lastTrigger = null;

  document.querySelectorAll(".cut-card").forEach(function (card) {
    card.addEventListener("click", function () {
      var cardImg = card.querySelector("img");
      lastTrigger = card;
      img.src = cardImg.currentSrc || cardImg.src;
      img.alt = cardImg.alt;
      title.textContent = card.querySelector(".cut-card__name").textContent;
      desc.textContent = card.querySelector(".cut-card__desc").textContent;
      steps.innerHTML = "";
      card.querySelectorAll(".cut-card__steps li").forEach(function (li) {
        steps.appendChild(li.cloneNode(true));
      });
      dialog.showModal();
    });
  });

  dialog.querySelector(".lightbox__close").addEventListener("click", function () { dialog.close(); });

  // Click on the dark backdrop closes it
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", function () {
    if (lastTrigger) lastTrigger.focus();
  });
})();
