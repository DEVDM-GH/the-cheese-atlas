(function(){
  "use strict";

  var COUNTRY_FLAGS = {
    "Italy": "🇮🇹", "France": "🇫🇷", "Switzerland": "🇨🇭",
    "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    "Netherlands": "🇳🇱", "Spain": "🇪🇸", "Greece": "🇬🇷", "Cyprus": "🇨🇾",
    "Germany": "🇩🇪", "Belgium": "🇧🇪",
    "Norway": "🇳🇴", "Denmark": "🇩🇰", "Iceland": "🇮🇸",
    "Slovakia": "🇸🇰", "Poland": "🇵🇱", "Bulgaria": "🇧🇬",
    "Lebanon": "🇱🇧", "Palestine": "🇵🇸", "Syria": "🇸🇾", "Jordan": "🇯🇴", "Egypt": "🇪🇬",
    "United States": "🇺🇸", "Mexico": "🇲🇽",
    "India": "🇮🇳", "Georgia": "🇬🇪", "Armenia": "🇦🇲"
  };

  function flagsFor(countryStr){
    var clean = String(countryStr).replace(/\s*\([^)]*\)/g, "");
    var parts = clean.split("/").map(function(s){ return s.trim(); });
    var flags = parts.map(function(p){ return COUNTRY_FLAGS[p] || ""; }).filter(Boolean);
    return flags.join(" ");
  }

  var FAMILY_LABELS = {
    "fresh": "Fresh",
    "soft-ripened": "Soft-Ripened",
    "washed-rind": "Washed-Rind",
    "semi-soft": "Semi-Soft",
    "semi-hard": "Semi-Hard",
    "hard": "Hard & Aged",
    "blue": "Blue",
    "pasta-filata": "Stretched-Curd",
    "whey-other": "Whey & Other"
  };

  var FAMILY_ORDER = ["fresh","soft-ripened","washed-rind","semi-soft","semi-hard","hard","blue","pasta-filata","whey-other"];
  var REGION_ORDER = ["Europe","Americas","Middle East & Africa","Asia & Caucasus"];

  var state = {
    query: "",
    family: "all",
    region: "all"
  };

  var grid = document.getElementById("grid");
  var resultCount = document.getElementById("resultCount");
  var searchInput = document.getElementById("searchInput");
  var familyChips = document.getElementById("familyChips");
  var regionChips = document.getElementById("regionChips");
  var modalOverlay = document.getElementById("modalOverlay");
  var modalBody = document.getElementById("modalBody");
  var modalCloseBtn = document.getElementById("modalCloseBtn");
  var totalCountEl = document.getElementById("totalCount");
  var countryCountEl = document.getElementById("countryCount");

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(ch){
      return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch];
    });
  }

  function buildChips(container, items, labelFn, key){
    var allBtn = makeChip("All", "all", key);
    container.appendChild(allBtn);
    items.forEach(function(item){
      container.appendChild(makeChip(labelFn(item), item, key));
    });
  }

  function makeChip(label, value, key){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = label;
    btn.dataset.value = value;
    btn.setAttribute("aria-pressed", value === "all" ? "true" : "false");
    btn.addEventListener("click", function(){
      state[key] = value;
      var siblings = container_for(key).querySelectorAll(".chip");
      siblings.forEach(function(s){ s.setAttribute("aria-pressed", s.dataset.value === value ? "true" : "false"); });
      render();
    });
    return btn;
  }

  function container_for(key){
    return key === "family" ? familyChips : regionChips;
  }

  function matches(cheese){
    var q = state.query.trim().toLowerCase();
    if (state.family !== "all" && cheese.family !== state.family) return false;
    if (state.region !== "all" && cheese.region !== state.region) return false;
    if (!q) return true;
    var haystack = [
      cheese.name, cheese.country, cheese.origin, cheese.milk
    ].join(" ").toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  function cardTeaser(cheese){
    var flag = flagsFor(cheese.country);
    return (flag ? flag + " " : "") + cheese.milk + " milk \u2022 " + cheese.country;
  }

  function renderCard(cheese){
    var card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.setAttribute("aria-haspopup", "dialog");
    card.innerHTML =
      '<div class="card-top">' +
        '<div class="wheel ' + cheese.family + '" aria-hidden="true"></div>' +
        '<div>' +
          '<div class="card-name">' + escapeHtml(cheese.name) + '</div>' +
          '<div class="card-meta">' + escapeHtml(cardTeaser(cheese)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-hook">' + escapeHtml(cheese.texture) + '</div>' +
      '<div class="card-fam-tag">' + escapeHtml(FAMILY_LABELS[cheese.family] || cheese.family) + '</div>';
    card.addEventListener("click", function(){ openModal(cheese); });
    return card;
  }

  function render(){
    var filtered = CHEESES.filter(matches);
    grid.innerHTML = "";
    if (filtered.length === 0){
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No cheese matches that search. Try a different region, family, or word.";
      grid.appendChild(empty);
    } else {
      var frag = document.createDocumentFragment();
      filtered.forEach(function(cheese){ frag.appendChild(renderCard(cheese)); });
      grid.appendChild(frag);
    }
    resultCount.textContent = filtered.length + (filtered.length === 1 ? " cheese" : " cheeses");
  }

  function openModal(cheese){
    modalBody.innerHTML =
      photoSection(cheese) +
      '<div class="modal-head">' +
        '<div class="modal-wheel wheel ' + cheese.family + '" aria-hidden="true"></div>' +
        '<div>' +
          '<h2 class="modal-name">' + escapeHtml(cheese.name) + '</h2>' +
          '<div class="modal-meta">' + (flagsFor(cheese.country) ? flagsFor(cheese.country) + ' \u2022 ' : '') + escapeHtml(cheese.milk) + ' milk \u2022 ' + escapeHtml(FAMILY_LABELS[cheese.family] || cheese.family) + ' \u2022 ' + escapeHtml(cheese.region) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-body">' +
        field("Origin", cheese.origin) +
        field("Texture", cheese.texture) +
        field("History", cheese.history) +
        field("Where it's prevalent", cheese.prevalence) +
        field("How it's used", cheese.usage) +
        '<div class="fact-box"><div class="label">Curd Nerd fact</div><div class="value">' + escapeHtml(cheese.fact) + '</div></div>' +
      '</div>';
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    modalCloseBtn.focus();
    wireCarousel();
  }

  function photoSection(cheese){
    if (!cheese.images || !cheese.images.length) return "";
    var slides = cheese.images.map(function(img, i){
      return '<div class="carousel-slide" data-index="' + i + '" style="' + (i === 0 ? '' : 'display:none;') + '">' +
        '<img src="' + escapeHtml(img.url) + '" alt="' + escapeHtml(img.alt || cheese.name) + '" loading="lazy">' +
        (img.credit ? '<div class="carousel-credit">' + escapeHtml(img.credit) + '</div>' : '') +
        '</div>';
    }).join("");
    var nav = cheese.images.length > 1
      ? '<button class="carousel-nav carousel-prev" aria-label="Previous photo">\u2039</button>' +
        '<button class="carousel-nav carousel-next" aria-label="Next photo">\u203a</button>' +
        '<div class="carousel-dots">' + cheese.images.map(function(_, i){ return '<span class="carousel-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i + '"></span>'; }).join("") + '</div>'
      : "";
    return '<div class="carousel" id="photoCarousel">' + slides + nav + '</div>';
  }

  function wireCarousel(){
    var carousel = document.getElementById("photoCarousel");
    if (!carousel) return;
    var slides = carousel.querySelectorAll(".carousel-slide");
    var dots = carousel.querySelectorAll(".carousel-dot");
    var current = 0;
    function show(i){
      current = (i + slides.length) % slides.length;
      slides.forEach(function(s, idx){ s.style.display = idx === current ? "" : "none"; });
      dots.forEach(function(d, idx){ d.classList.toggle("active", idx === current); });
    }
    var prevBtn = carousel.querySelector(".carousel-prev");
    var nextBtn = carousel.querySelector(".carousel-next");
    if (prevBtn) prevBtn.addEventListener("click", function(){ show(current - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function(){ show(current + 1); });
    dots.forEach(function(d){ d.addEventListener("click", function(){ show(parseInt(d.dataset.index, 10)); }); });
  }

  function field(label, value){
    return '<div class="field"><div class="label">' + escapeHtml(label) + '</div><div class="value">' + escapeHtml(value) + '</div></div>';
  }

  function closeModal(){
    modalOverlay.hidden = true;
    document.body.style.overflow = "";
  }

  modalCloseBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", function(e){
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
  });

  searchInput.addEventListener("input", function(){
    state.query = searchInput.value;
    render();
  });

  buildChips(familyChips, FAMILY_ORDER, function(f){ return FAMILY_LABELS[f]; }, "family");
  buildChips(regionChips, REGION_ORDER, function(r){ return r; }, "region");

  totalCountEl.textContent = CHEESES.length;
  var uniqueCountries = new Set(CHEESES.map(function(c){ return c.country; }));
  countryCountEl.textContent = uniqueCountries.size;

  render();
})();
