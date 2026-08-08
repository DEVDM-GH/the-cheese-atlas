(function(){
  "use strict";

  var features = {
    matrix: true,
    cheeseWire: true,
    storyWheel: true
  };

  // QA override: ?flags=matrix:off or ?flags=matrix:off,storyWheel:off
  // Deploy-time flags alone cannot cover every combo without a push; this can.
  try {
    var raw = new URLSearchParams(window.location.search).get("flags");
    if (raw) {
      raw.split(",").forEach(function(pair){
        var parts = pair.split(":");
        var name = String(parts[0] || "").trim();
        var value = String(parts[1] || "").trim().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(features, name)) return;
        if (value === "off" || value === "false" || value === "0") {
          features[name] = false;
        } else if (value === "on" || value === "true" || value === "1") {
          features[name] = true;
        }
      });
    }
  } catch (e) {
    // Malformed query or missing URLSearchParams — keep file defaults.
  }

  window.TCA_CONFIG = Object.freeze({
    features: Object.freeze(features)
  });
})();
