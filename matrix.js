window.CheeseMatrix = (function(){
  "use strict";

  var FAMILY_FALLBACK = {
    "fresh": { mildStinky: 2, softHard: 2 },
    "whey-other": { mildStinky: 1, softHard: 2 },
    "semi-soft": { mildStinky: 2, softHard: 3 },
    "soft-ripened": { mildStinky: 5, softHard: 2 },
    "pasta-filata": { mildStinky: 3, softHard: 4 },
    "semi-hard": { mildStinky: 2, softHard: 5 },
    "washed-rind": { mildStinky: 8, softHard: 2 },
    "blue": { mildStinky: 8, softHard: 4 },
    "hard": { mildStinky: 3, softHard: 8 }
  };

  var X_POWER = 0.75;
  var BOUNDARY_SAMPLES = 48;
  var GOLDEN_ANGLE = 137.5 * Math.PI / 180;
  var MOBILE_MQ = "(max-width: 720px)";

  var LANDMARKS = [
    { id: "mild-soft", label: "Mild & Soft", xSign: -1, ySign: -1 },
    { id: "mild-hard", label: "Mild & Hard", xSign: -1, ySign: 1 },
    { id: "stinky-soft", label: "Stinky & Soft", xSign: 1, ySign: -1 },
    { id: "stinky-hard", label: "Stinky & Hard", xSign: 1, ySign: 1 }
  ];

  var root = null;
  var plot = null;
  var svg = null;
  var dotsGroup = null;
  var boundary = null;
  var crosshair = null;
  var liveCount = null;
  var clearBtn = null;
  var toggleBtn = null;
  var panel = null;

  var X_MIN = 1;
  var X_MAX = 10;
  var Y_MIN = 1;
  var Y_MAX = 10;
  var plotW = 0;
  var plotH = 0;
  var pad = { top: 28, right: 18, bottom: 36, left: 44 };

  var landmarkTargets = {};
  var dotPositions = [];
  var cheeses = [];

  var rafPending = false;
  var pendingPointer = null;
  var dragging = false;
  var animating = false;

  function featureOn(){
    return !!(window.TCA_CONFIG && window.TCA_CONFIG.features && window.TCA_CONFIG.features.matrix);
  }

  function scoresFor(c){
    var ms = c.mildStinky;
    var sh = c.softHard;
    if (typeof ms === "number" && typeof sh === "number") {
      return { mildStinky: ms, softHard: sh };
    }
    var fb = FAMILY_FALLBACK[c.family] || FAMILY_FALLBACK.fresh;
    return { mildStinky: fb.mildStinky, softHard: fb.softHard };
  }

  function deriveDomain(list){
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    list.forEach(function(c){
      var s = scoresFor(c);
      if (s.mildStinky < xmin) xmin = s.mildStinky;
      if (s.mildStinky > xmax) xmax = s.mildStinky;
      if (s.softHard < ymin) ymin = s.softHard;
      if (s.softHard > ymax) ymax = s.softHard;
    });
    if (!isFinite(xmin)) { xmin = 1; xmax = 10; ymin = 1; ymax = 10; }
    if (xmin === xmax) { xmin -= 0.5; xmax += 0.5; }
    if (ymin === ymax) { ymin -= 0.5; ymax += 0.5; }
    X_MIN = xmin; X_MAX = xmax; Y_MIN = ymin; Y_MAX = ymax;
  }

  function xToPixel(mildStinky){
    var t = (mildStinky - X_MIN) / (X_MAX - X_MIN);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return pad.left + plotW * Math.pow(t, X_POWER);
  }

  function yToPixel(softHard){
    var t = (softHard - Y_MIN) / (Y_MAX - Y_MIN);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return pad.top + plotH * (1 - t);
  }

  function pixelToScore(px, py){
    var nx = (px - pad.left) / plotW;
    var ny = (py - pad.top) / plotH;
    if (nx < 0) nx = 0;
    if (nx > 1) nx = 1;
    if (ny < 0) ny = 0;
    if (ny > 1) ny = 1;
    var mildStinky = X_MIN + (X_MAX - X_MIN) * Math.pow(nx, 1 / X_POWER);
    var softHard = Y_MIN + (Y_MAX - Y_MIN) * (1 - ny);
    return { x: mildStinky, y: softHard };
  }

  function deriveLandmarks(list){
    var xMid = (X_MIN + X_MAX) / 2;
    var yMid = (Y_MIN + Y_MAX) / 2;
    landmarkTargets = {};

    LANDMARKS.forEach(function(lm){
      var cornerX = lm.xSign < 0 ? X_MIN : X_MAX;
      var cornerY = lm.ySign < 0 ? Y_MIN : Y_MAX;
      var candidates = list.filter(function(c){
        var s = scoresFor(c);
        var inX = lm.xSign < 0 ? s.mildStinky <= xMid : s.mildStinky >= xMid;
        var inY = lm.ySign < 0 ? s.softHard <= yMid : s.softHard >= yMid;
        return inX && inY;
      });
      if (!candidates.length) candidates = list.slice();

      var best = null;
      var bestD = Infinity;
      candidates.forEach(function(c){
        var s = scoresFor(c);
        var d = Math.hypot(s.mildStinky - cornerX, s.softHard - cornerY);
        if (d < bestD || (d === bestD && best && c.id < best.id) || (d === bestD && !best)) {
          bestD = d;
          best = c;
        }
      });
      var s = scoresFor(best);
      landmarkTargets[lm.id] = { x: s.mildStinky, y: s.softHard, id: best.id };
    });
  }

  function buildDotLayout(list){
    var groups = {};
    list.forEach(function(c){
      var s = scoresFor(c);
      var key = s.mildStinky + "," + s.softHard;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    var unitX = plotW / Math.max(1, X_MAX - X_MIN);
    var unitY = plotH / Math.max(1, Y_MAX - Y_MIN);
    var spiralC = 0.22 * Math.min(unitX, unitY);

    dotPositions = [];
    Object.keys(groups).forEach(function(key){
      var cluster = groups[key].slice().sort(function(a, b){ return a.id < b.id ? -1 : 1; });
      cluster.forEach(function(c, k){
        var s = scoresFor(c);
        var cx = xToPixel(s.mildStinky);
        var cy = yToPixel(s.softHard);
        var dx = 0;
        var dy = 0;
        if (k > 0) {
          var theta = k * GOLDEN_ANGLE;
          var r = spiralC * Math.sqrt(k);
          dx = Math.cos(theta) * r;
          dy = Math.sin(theta) * r;
        }
        dotPositions.push({
          id: c.id,
          cheese: c,
          trueX: s.mildStinky,
          trueY: s.softHard,
          px: cx + dx,
          py: cy + dy
        });
      });
    });
  }

  function svgEl(name, attrs){
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) {
      Object.keys(attrs).forEach(function(k){ el.setAttribute(k, attrs[k]); });
    }
    return el;
  }

  function measurePlot(){
    if (!svg) return;
    var rect = svg.getBoundingClientRect();
    var w = Math.max(200, rect.width);
    var h = Math.max(180, rect.height || w * 0.62);
    plotW = Math.max(40, w - pad.left - pad.right);
    plotH = Math.max(40, h - pad.top - pad.bottom);
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", String(h));
  }

  function setCrosshairVisual(x, y, animate){
    if (!crosshair) return;
    var px = xToPixel(x);
    var py = yToPixel(y);
    if (animate) {
      crosshair.classList.add("is-animating");
    } else {
      crosshair.classList.remove("is-animating");
    }
    crosshair.style.transform = "translate(" + px + "px, " + py + "px)";
    crosshair.setAttribute(
      "aria-valuetext",
      "Mild–Stinky " + x.toFixed(1) + ", Soft–Hard " + y.toFixed(1)
    );
    crosshair.setAttribute("aria-label",
      "Taste crosshair at mild-stinky " + x.toFixed(1) + ", soft-hard " + y.toFixed(1)
    );
  }

  function boundaryPoints(cx, cy, radius){
    var pts = [];
    var i;
    for (i = 0; i < BOUNDARY_SAMPLES; i++) {
      var angle = (i / BOUNDARY_SAMPLES) * Math.PI * 2;
      var sx = cx + Math.cos(angle) * radius;
      var sy = cy + Math.sin(angle) * radius;
      pts.push(xToPixel(sx) + "," + yToPixel(sy));
    }
    return pts.join(" ");
  }

  function effectiveRadius(selected, m){
    var max = 0;
    selected.forEach(function(c){
      var s = scoresFor(c);
      var d = Math.hypot(s.mildStinky - m.x, s.softHard - m.y);
      if (d > max) max = d;
    });
    return max;
  }

  function updateToggleLabel(){
    if (!toggleBtn) return;
    var m = CheeseStore.get().matrix;
    var expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    if (m.active) {
      toggleBtn.textContent = expanded ? "Hide taste filter" : "Taste filter on — show";
    } else {
      toggleBtn.textContent = "Filter by taste";
    }
  }

  function syncFromStore(){
    var state = CheeseStore.get();
    var m = state.matrix;
    var selected = CheeseStore.selectVisible(window.CHEESES || []);
    var selectedIds = {};
    selected.forEach(function(c){ selectedIds[c.id] = true; });

    setCrosshairVisual(m.x, m.y, animating);

    if (boundary) {
      if (m.active && selected.length) {
        var er = effectiveRadius(selected, m);
        boundary.setAttribute("points", boundaryPoints(m.x, m.y, er || 0.01));
        boundary.setAttribute("visibility", "visible");
      } else {
        boundary.setAttribute("visibility", "hidden");
      }
    }

    if (dotsGroup) {
      Array.prototype.forEach.call(dotsGroup.querySelectorAll(".matrix-dot"), function(dot){
        var id = dot.getAttribute("data-id");
        var on = !m.active || selectedIds[id];
        dot.classList.toggle("is-dimmed", m.active && !on);
        dot.classList.toggle("is-selected", m.active && !!selectedIds[id]);
      });
    }

    if (liveCount) {
      if (m.active) {
        liveCount.textContent = selected.length + (selected.length === 1 ? " cheese nearby" : " cheeses nearby");
      } else {
        liveCount.textContent = "Tap or drag to filter by taste";
      }
    }

    if (clearBtn) {
      clearBtn.disabled = !m.active;
    }

    root.classList.toggle("is-active", !!m.active);
    updateToggleLabel();
    animating = false;
  }

  function writeMatrix(patch, animate){
    if (animate) animating = true;
    CheeseStore.set({ matrix: patch });
  }

  function activateAt(x, y, animate){
    var radius = CheeseStore.MATRIX_RADIUS;
    writeMatrix({ active: true, x: x, y: y, radius: radius }, animate);
  }

  function clearMatrix(){
    writeMatrix({ active: false }, false);
  }

  function pointerToLocal(e){
    var rect = svg.getBoundingClientRect();
    var vb = svg.viewBox.baseVal;
    var sx = vb.width / rect.width;
    var sy = vb.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy
    };
  }

  function schedulePointer(e){
    pendingPointer = e;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function(){
      rafPending = false;
      if (!pendingPointer) return;
      var local = pointerToLocal(pendingPointer);
      pendingPointer = null;
      var score = pixelToScore(local.x, local.y);
      activateAt(score.x, score.y, false);
      setCrosshairVisual(score.x, score.y, false);
    });
  }

  function onPlotPointerDown(e){
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    try { plot.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    schedulePointer(e);
  }

  function onPlotPointerMove(e){
    if (!dragging) return;
    schedulePointer(e);
  }

  function onPlotPointerUp(e){
    if (!dragging) return;
    dragging = false;
    try { plot.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  function onCrosshairKey(e){
    var m = CheeseStore.get().matrix;
    var step = e.shiftKey ? 5 : 1;
    var x = m.x;
    var y = m.y;
    var handled = true;

    if (e.key === "ArrowLeft") x -= step;
    else if (e.key === "ArrowRight") x += step;
    else if (e.key === "ArrowDown") y -= step;
    else if (e.key === "ArrowUp") y += step;
    else if (e.key === "Home") { x = 3; y = 4; }
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      clearMatrix();
      return;
    } else {
      handled = false;
    }

    if (!handled) return;
    e.preventDefault();
    e.stopPropagation();
    if (x < X_MIN) x = X_MIN;
    if (x > X_MAX) x = X_MAX;
    if (y < Y_MIN) y = Y_MIN;
    if (y > Y_MAX) y = Y_MAX;
    activateAt(x, y, false);
  }

  function snapLandmark(id){
    var t = landmarkTargets[id];
    if (!t) return;
    activateAt(t.x, t.y, true);
  }

  function setExpanded(expanded){
    if (!root || !toggleBtn || !panel) return;
    root.classList.toggle("is-collapsed", !expanded);
    toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    panel.hidden = !expanded;
    updateToggleLabel();
    if (expanded) {
      measurePlot();
      rebuildPlotGeometry();
      syncFromStore();
    }
  }

  function rebuildPlotGeometry(){
    buildDotLayout(cheeses);
    if (!dotsGroup) return;
    while (dotsGroup.firstChild) dotsGroup.removeChild(dotsGroup.firstChild);
    dotPositions.forEach(function(d){
      var circle = svgEl("circle", {
        "class": "matrix-dot",
        "data-id": d.id,
        cx: String(d.px),
        cy: String(d.py),
        r: "4",
        "aria-hidden": "true"
      });
      dotsGroup.appendChild(circle);
    });

    // axis ticks (low-poly)
    var axes = svg.querySelector(".matrix-axes");
    if (axes) {
      while (axes.firstChild) axes.removeChild(axes.firstChild);
      axes.appendChild(svgEl("line", {
        x1: String(pad.left), y1: String(pad.top + plotH),
        x2: String(pad.left + plotW), y2: String(pad.top + plotH),
        "class": "matrix-axis-line"
      }));
      axes.appendChild(svgEl("line", {
        x1: String(pad.left), y1: String(pad.top),
        x2: String(pad.left), y2: String(pad.top + plotH),
        "class": "matrix-axis-line"
      }));
      axes.appendChild(svgEl("text", {
        x: String(pad.left + plotW / 2),
        y: String(pad.top + plotH + 28),
        "class": "matrix-axis-label",
        "text-anchor": "middle"
      })).textContent = "Mild \u2192 Stinky";
      var yLabel = svgEl("text", {
        x: String(14),
        y: String(pad.top + plotH / 2),
        "class": "matrix-axis-label",
        "text-anchor": "middle",
        transform: "rotate(-90 14 " + (pad.top + plotH / 2) + ")"
      });
      yLabel.textContent = "Soft \u2192 Hard";
      axes.appendChild(yLabel);
    }

    var lmLayer = svg.querySelector(".matrix-landmarks-svg");
    if (lmLayer) {
      while (lmLayer.firstChild) lmLayer.removeChild(lmLayer.firstChild);
      LANDMARKS.forEach(function(lm){
        var t = landmarkTargets[lm.id];
        if (!t) return;
        var tx = xToPixel(t.x);
        var ty = yToPixel(t.y);
        var anchor =
          (lm.xSign < 0 ? "start" : "end") ;
        var label = svgEl("text", {
          x: String(tx + (lm.xSign < 0 ? 8 : -8)),
          y: String(ty + (lm.ySign < 0 ? 14 : -8)),
          "class": "matrix-landmark-hint",
          "text-anchor": anchor,
          "aria-hidden": "true"
        });
        label.textContent = lm.label;
        lmLayer.appendChild(label);
      });
    }
  }

  function buildDOM(mountAfter){
    root = document.createElement("section");
    root.className = "matrix-section";
    root.id = "matrixSection";

    var wrap = document.createElement("div");
    wrap.className = "wrap";

    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "matrix-toggle";
    toggleBtn.id = "matrixToggle";
    toggleBtn.setAttribute("aria-controls", "matrixPanel");
    toggleBtn.setAttribute("aria-expanded", "true");
    toggleBtn.textContent = "Filter by taste";

    panel = document.createElement("div");
    panel.className = "matrix-panel";
    panel.id = "matrixPanel";

    var head = document.createElement("div");
    head.className = "matrix-head";
    head.innerHTML =
      "<div class=\"matrix-title-block\">" +
        "<h2 class=\"matrix-title\">Flavor &amp; Texture</h2>" +
        "<p class=\"matrix-sub\">Drag the crosshair to find cheeses near a taste.</p>" +
      "</div>";

    var tools = document.createElement("div");
    tools.className = "matrix-tools";
    liveCount = document.createElement("div");
    liveCount.className = "matrix-live-count";
    liveCount.setAttribute("aria-live", "polite");
    clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "matrix-clear";
    clearBtn.textContent = "Clear";
    clearBtn.disabled = true;
    tools.appendChild(liveCount);
    tools.appendChild(clearBtn);
    head.appendChild(tools);

    var landmarkRow = document.createElement("div");
    landmarkRow.className = "matrix-landmark-row";
    landmarkRow.setAttribute("role", "group");
    landmarkRow.setAttribute("aria-label", "Taste corner landmarks");
    LANDMARKS.forEach(function(lm){
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "matrix-landmark-btn";
      btn.dataset.landmark = lm.id;
      btn.textContent = lm.label;
      btn.addEventListener("click", function(){ snapLandmark(lm.id); });
      landmarkRow.appendChild(btn);
    });

    plot = document.createElement("div");
    plot.className = "matrix-plot";

    svg = svgEl("svg", {
      "class": "matrix-svg",
      role: "img",
      "aria-label": "Cheese flavor and texture plot"
    });

    svg.appendChild(svgEl("g", { "class": "matrix-axes" }));
    svg.appendChild(svgEl("g", { "class": "matrix-landmarks-svg" }));
    boundary = svgEl("polygon", {
      "class": "matrix-boundary",
      points: "",
      visibility: "hidden"
    });
    svg.appendChild(boundary);
    dotsGroup = svgEl("g", { "class": "matrix-dots" });
    svg.appendChild(dotsGroup);

    crosshair = svgEl("g", {
      "class": "matrix-crosshair",
      tabindex: "0",
      role: "slider",
      "aria-valuemin": "1",
      "aria-valuemax": "10"
    });
    crosshair.appendChild(svgEl("line", { x1: "-10", y1: "0", x2: "10", y2: "0", "class": "matrix-crosshair-arm" }));
    crosshair.appendChild(svgEl("line", { x1: "0", y1: "-10", x2: "0", y2: "10", "class": "matrix-crosshair-arm" }));
    crosshair.appendChild(svgEl("circle", { cx: "0", cy: "0", r: "5", "class": "matrix-crosshair-hub" }));
    svg.appendChild(crosshair);

    plot.appendChild(svg);
    panel.appendChild(head);
    panel.appendChild(landmarkRow);
    panel.appendChild(plot);

    wrap.appendChild(toggleBtn);
    wrap.appendChild(panel);
    root.appendChild(wrap);

    mountAfter.parentNode.insertBefore(root, mountAfter);

    toggleBtn.addEventListener("click", function(){
      var expanded = toggleBtn.getAttribute("aria-expanded") === "true";
      setExpanded(!expanded);
    });
    clearBtn.addEventListener("click", clearMatrix);
    plot.addEventListener("pointerdown", onPlotPointerDown);
    plot.addEventListener("pointermove", onPlotPointerMove);
    plot.addEventListener("pointerup", onPlotPointerUp);
    plot.addEventListener("pointercancel", onPlotPointerUp);
    crosshair.addEventListener("keydown", onCrosshairKey);
    // Prevent plot pointer from stealing keyboard focus clicks on crosshair exclusively —
    // crosshair still receives focus via tab; pointer on plot activates filter.
    crosshair.addEventListener("pointerdown", function(e){
      e.stopPropagation();
      dragging = true;
      try { plot.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      schedulePointer(e);
    });
  }

  function applyResponsiveDefault(){
    var mobile = window.matchMedia && window.matchMedia(MOBILE_MQ).matches;
    setExpanded(!mobile);
  }

  function init(){
    if (!featureOn()) return;
    try {
      cheeses = (window.CHEESES || []).slice();
      if (!cheeses.length) return;

      var controls = document.querySelector(".controls");
      var gridSection = document.querySelector(".grid-section");
      if (!controls || !gridSection) return;

      deriveDomain(cheeses);
      deriveLandmarks(cheeses);
      buildDOM(gridSection);
      measurePlot();
      rebuildPlotGeometry();

      var m = CheeseStore.get().matrix;
      setCrosshairVisual(m.x, m.y, false);
      syncFromStore();
      CheeseStore.subscribe(syncFromStore);

      applyResponsiveDefault();
      window.addEventListener("resize", function(){
        if (!root || root.classList.contains("is-collapsed")) return;
        measurePlot();
        rebuildPlotGeometry();
        syncFromStore();
      });
    } catch (e) {
      console.error("Matrix failed to initialize; page continues without it.", e);
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = null;
    }
  }

  return { init: init };
})();
