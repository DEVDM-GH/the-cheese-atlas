window.CheeseStore = (function(){
  "use strict";

  var MATRIX_RADIUS = 2.0;
  var MATRIX_MIN = 6;
  var MATRIX_MAX = 24;

  var bus = new EventTarget();
  var state = {
    query: "",
    family: "all",
    region: "all",
    matrix: { active: false, x: 3, y: 4, radius: MATRIX_RADIUS }
  };

  function get(){
    return state;
  }

  function set(patch){
    if (!patch) return;
    Object.keys(patch).forEach(function(key){
      if (key === "matrix" && patch.matrix && typeof patch.matrix === "object") {
        state.matrix = Object.assign({}, state.matrix, patch.matrix);
      } else {
        state[key] = patch[key];
      }
    });
    bus.dispatchEvent(new CustomEvent("change", { detail: state }));
  }

  function subscribe(fn){
    bus.addEventListener("change", fn);
  }

  // pure: sorts by distance, applies radius, then clamps the result count
  function matrixFilter(cheeses, m){
    var ranked = cheeses
      .map(function(c){
        return { c: c, d: Math.hypot(c.mildStinky - m.x, c.softHard - m.y) };
      })
      .sort(function(a, b){
        return a.d - b.d || (a.c.id < b.c.id ? -1 : 1);
      });

    var within = ranked.filter(function(e){ return e.d <= m.radius; }).length;
    var n = Math.min(Math.max(within, MATRIX_MIN), MATRIX_MAX);
    return ranked.slice(0, n);
  }

  function matrixFeatureOn(){
    return !!(window.TCA_CONFIG && window.TCA_CONFIG.features && window.TCA_CONFIG.features.matrix);
  }

  // pure: (state, cheeses) -> filtered array. No DOM access.
  function selectVisible(cheeses){
    var filtered = cheeses.filter(function(cheese){
      var q = state.query.trim().toLowerCase();
      if (state.family !== "all" && cheese.family !== state.family) return false;
      if (state.region !== "all" && cheese.region !== state.region) return false;
      if (!q) return true;
      var haystack = [
        cheese.name, cheese.country, cheese.origin, cheese.milk
      ].join(" ").toLowerCase();
      return haystack.indexOf(q) !== -1;
    });

    if (matrixFeatureOn() && state.matrix.active) {
      return matrixFilter(filtered, state.matrix).map(function(e){ return e.c; });
    }
    return filtered;
  }

  return {
    get: get,
    set: set,
    subscribe: subscribe,
    selectVisible: selectVisible,
    MATRIX_MIN: MATRIX_MIN,
    MATRIX_MAX: MATRIX_MAX,
    MATRIX_RADIUS: MATRIX_RADIUS
  };
})();
