// js/env.js — which Cockpit this copy of the app talks to (RAVN step 1).
//
// ONE place decides it, read by raven.js, quote-builder.js, reference-map.js
// and sw.js (via importScripts). The live site on GitHub Pages always talks to
// production Cockpit. Only a copy served from a staging host (the Render
// static site "ravn-staging", deployed from the `staging` branch) talks to
// staging Cockpit, which blocks every text, email and JobNimbus write.
//
// Deliberately NOT configurable from the URL or localStorage: a value a page
// visitor can change would let anyone point a rep's sign-in at another server.
(function (g) {
  var PROD_API = "https://ath-cockpit.onrender.com";
  var STAGING_API = "https://ath-cockpit-staging.onrender.com";
  var host = (g.location && g.location.hostname) || "";
  var isStaging = /(^|[.-])staging[.-]/i.test(host) && /\.onrender\.com$/i.test(host);
  g.RAVN_ENV = isStaging ? "staging" : "production";
  g.RAVN_API_BASE = isStaging ? STAGING_API : PROD_API;

  // A thin red bar on the staging copy so a test session is never mistaken
  // for the real app. Pages only (the service worker has no document).
  if (isStaging && g.document) {
    var addBar = function () {
      if (g.document.getElementById("ravn-staging-bar")) return;
      var bar = g.document.createElement("div");
      bar.id = "ravn-staging-bar";
      bar.textContent = "STAGING — test copy. Texts, email and JobNimbus writes are blocked.";
      bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#b91c1c;color:#fff;" +
        "font:600 12px/24px system-ui,sans-serif;text-align:center;pointer-events:none;" +
        "padding-bottom:env(safe-area-inset-bottom)";
      g.document.body.appendChild(bar);
    };
    if (g.document.readyState === "loading") g.document.addEventListener("DOMContentLoaded", addBar);
    else addBar();
  }
})(typeof self !== "undefined" ? self : this);
