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

    closeBtn.focus();

    if (typeof opts.onOpen === "function") opts.onOpen();
  }

  function close(){
    if (!isOpen || !overlay) return;
    isOpen = false;
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
