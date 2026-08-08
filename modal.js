window.Modal = (function(){
  "use strict";

  var overlay = document.getElementById("modalOverlay");
  var panel = overlay ? overlay.querySelector(".modal") : null;
  var body = document.getElementById("modalBody");
  var closeBtn = document.getElementById("modalCloseBtn");

  var previousActive = null;
  var onCloseCb = null;
  var isOpen = false;

  var FOCUSABLE =
    'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])';

  function isVisible(el){
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function focusableNodes(){
    if (!panel) return [];
    return Array.prototype.filter.call(panel.querySelectorAll(FOCUSABLE), function(el){
      return isVisible(el) && el.getAttribute("aria-hidden") !== "true";
    });
  }

  function onKeydown(e){
    if (!isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    if (e.key !== "Tab") return;

    var nodes = focusableNodes();
    if (!nodes.length) {
      e.preventDefault();
      return;
    }

    var first = nodes[0];
    var last = nodes[nodes.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !panel.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !panel.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  function cheeseWireAllowed(){
    try {
      if (!(window.TCA_CONFIG && window.TCA_CONFIG.features && window.TCA_CONFIG.features.cheeseWire)) {
        return false;
      }
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearCheeseWire(){
    if (!panel) return;
    var existing = panel.querySelector(".cheese-wire");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function playCheeseWire(){
    if (!cheeseWireAllowed() || !panel) return;
    try {
      clearCheeseWire();

      var wrap = document.createElement("div");
      wrap.className = "cheese-wire";
      wrap.setAttribute("aria-hidden", "true");
      wrap.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">' +
          '<g class="cheese-wire-group">' +
            '<line class="cheese-wire-trail" x1="0" y1="0" x2="0" y2="100"></line>' +
            '<line class="cheese-wire-blade" x1="0" y1="0" x2="0" y2="100"></line>' +
          '</g>' +
        '</svg>';
      panel.appendChild(wrap);

      // Reflow so the starting transform is applied before the run class.
      void wrap.offsetWidth;
      wrap.classList.add("is-running");

      wrap.addEventListener("animationend", function(){
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      });
    } catch (e) {
      console.error("Cheese wire failed; modal remains usable.", e);
      clearCheeseWire();
    }
  }

  function open(opts){
    if (!overlay || !panel || !body || !closeBtn) return;
    opts = opts || {};

    previousActive = document.activeElement;
    onCloseCb = typeof opts.onClose === "function" ? opts.onClose : null;

    overlay.setAttribute("aria-label", opts.label || "Dialog");
    panel.classList.remove("modal--detail", "modal--spotlight");
    if (opts.variant === "spotlight") {
      panel.classList.add("modal--spotlight");
    } else {
      panel.classList.add("modal--detail");
    }

    body.innerHTML = opts.html || "";
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    isOpen = true;

    playCheeseWire();
    closeBtn.focus();

    if (typeof opts.onOpen === "function") opts.onOpen();
  }

  function close(){
    if (!isOpen || !overlay) return;
    isOpen = false;
    clearCheeseWire();
    overlay.hidden = true;
    document.body.style.overflow = "";
    body.innerHTML = "";

    var cb = onCloseCb;
    onCloseCb = null;
    if (cb) cb();

    if (previousActive && typeof previousActive.focus === "function") {
      try { previousActive.focus(); } catch (e) { /* element may be gone */ }
    }
    previousActive = null;
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", close);
  }
  if (overlay) {
    overlay.addEventListener("click", function(e){
      if (e.target === overlay) close();
    });
  }
  document.addEventListener("keydown", onKeydown);

  return { open: open, close: close };
})();
