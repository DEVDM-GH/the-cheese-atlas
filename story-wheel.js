window.CheeseStoryWheel = (function(){
  "use strict";

  var bag = null;
  var seed = Date.now() % 2147483647;
  var triggerBtn = null;

  // Mulberry32 — small deterministic PRNG for injectable seeds.
  function makeRand(startSeed){
    var s = startSeed >>> 0;
    if (!s) s = 1;
    return function(){
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, rand){
    var arr = items.slice();
    var i;
    for (i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // Pure. Deterministic for a given seed. Returns the pick and the remaining bag,
  // reshuffling only once the pool is exhausted, so every cheese appears before any repeats.
  function drawStory(pool, seedValue, currentBag){
    var list = pool || [];
    if (!list.length) return { cheese: null, bag: [] };

    var rand = makeRand(seedValue >>> 0);
    var nextBag = currentBag && currentBag.length ? currentBag.slice() : shuffle(list, rand);

    if (!nextBag.length) {
      nextBag = shuffle(list, rand);
    }

    var cheese = nextBag.shift();
    return { cheese: cheese, bag: nextBag };
  }

  function featureOn(){
    return !!(window.TCA_CONFIG && window.TCA_CONFIG.features && window.TCA_CONFIG.features.storyWheel);
  }

  function escapeHtml(str){
    if (window.CheeseAtlas && typeof window.CheeseAtlas.escapeHtml === "function") {
      return window.CheeseAtlas.escapeHtml(str);
    }
    return String(str).replace(/[&<>"']/g, function(ch){
      return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch];
    });
  }

  function pool(){
    return (window.CHEESES || []).filter(function(c){ return c.isBizarreLore === true; });
  }

  function spotlightHtml(cheese){
    var photo = "";
    if (cheese.images && cheese.images.length && cheese.images[0] && cheese.images[0].url) {
      var img = cheese.images[0];
      photo =
        '<figure class="spotlight-photo">' +
          '<img src="' + escapeHtml(img.url) + '" alt="' + escapeHtml(img.alt || cheese.name) + '" crossorigin="anonymous">' +
          (img.credit ? '<figcaption class="spotlight-credit">' + escapeHtml(img.credit) + '</figcaption>' : '') +
        '</figure>';
    }

    return (
      '<div class="spotlight">' +
        '<div class="spotlight-copy">' +
          '<p class="spotlight-kicker">Curd Nerd fact</p>' +
          '<h2 class="spotlight-name">' + escapeHtml(cheese.name) + '</h2>' +
          '<blockquote class="spotlight-quote">' + escapeHtml(cheese.fact) + '</blockquote>' +
          '<div class="spotlight-actions">' +
            '<button type="button" class="spotlight-reroll" id="spotlightReroll">Roll again</button>' +
            '<button type="button" class="spotlight-detail" id="spotlightDetail">Full entry</button>' +
          '</div>' +
        '</div>' +
        photo +
      '</div>'
    );
  }

  function openSpotlight(cheese){
    if (!cheese || !window.Modal) return;
    Modal.open({
      html: spotlightHtml(cheese),
      label: "Surprise cheese story",
      variant: "spotlight",
      onOpen: function(){
        var reroll = document.getElementById("spotlightReroll");
        var detail = document.getElementById("spotlightDetail");
        if (reroll) {
          reroll.addEventListener("click", function(){
            roll();
          });
        }
        if (detail) {
          detail.addEventListener("click", function(){
            Modal.close();
            if (window.CheeseAtlas && typeof window.CheeseAtlas.openDetail === "function") {
              window.CheeseAtlas.openDetail(cheese);
            }
          });
        }
      },
      onClose: function(){
        // Focus restoration handled by Modal.
      }
    });
  }

  function roll(){
    var result = drawStory(pool(), seed, bag);
    bag = result.bag;
    // Advance seed slightly so a full reshuffle after exhaustion is not identical.
    seed = (seed + 0x9E3779B9) >>> 0;
    openSpotlight(result.cheese);
  }

  function init(){
    if (!featureOn()) return;
    try {
      var stats = document.querySelector(".hero-stats");
      if (!stats) return;

      triggerBtn = document.createElement("button");
      triggerBtn.type = "button";
      triggerBtn.className = "story-wheel-trigger";
      triggerBtn.id = "storyWheelTrigger";
      triggerBtn.textContent = "Roll the Wheel";
      triggerBtn.setAttribute("aria-haspopup", "dialog");
      triggerBtn.addEventListener("click", function(){ roll(); });

      stats.insertAdjacentElement("afterend", triggerBtn);
    } catch (e) {
      console.error("Story wheel failed to initialize; page continues without it.", e);
      if (triggerBtn && triggerBtn.parentNode) triggerBtn.parentNode.removeChild(triggerBtn);
      triggerBtn = null;
    }
  }

  return {
    init: init,
    drawStory: drawStory
  };
})();
