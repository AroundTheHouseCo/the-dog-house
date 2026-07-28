// Reference Map — "We've Worked in Your Neighborhood".
//
// Two views inside one slide:
//   1. Town list, sorted by job count. The rep scans for the customer's town.
//   2. Tap a town -> focused map of that town's pins. Tap a pin -> one name.
//
// A town list rather than one zoomed-out state map with clusters: on an iPad
// held in front of a customer, reading a name off a list is faster and far
// more reliably tappable than hitting a cluster bubble, and it degrades
// gracefully when the map tiles can't load — the list still answers "have you
// worked near me?" on its own.
//
// DATA: data/reference-map.json, built by tools/build-reference-map.mjs.
// Coordinates in that file are already jittered 100-300ft and names are
// already abbreviated — this module does no privacy work of its own, it only
// renders what the build step produced. Nothing here geocodes at runtime.
//
// TILES need connectivity (as any map app does). The library itself is
// vendored locally, so a missing network degrades to a clear branded panel,
// never a blank grey box.

// undefined = still loading · null = no dataset shipped · object = data
let REFMAP_DATA;
let refmapTown = null;      // active town index, or null for the list view
let refmapPin = null;       // active pin index within the town, or null
let _leafletMap = null;     // live L.Map instance, torn down on view change
let _tileFailed = false;

// Kick the fetch off once at boot. Absent file (404) is a normal, expected
// state — it means the dataset hasn't been produced yet, and the slide shows
// its placeholder exactly as it did before this feature existed.
function loadReferenceMap(){
  fetch("data/reference-map.json", {cache:"no-cache"})
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      REFMAP_DATA = (d && Array.isArray(d.towns) && d.towns.length) ? d : null;
      if (typeof currentSlide === "function" && currentSlide()?.type === "refmap") renderSlide();
    })
    .catch(() => {
      REFMAP_DATA = null;
      if (typeof currentSlide === "function" && currentSlide()?.type === "refmap") renderSlide();
    });
}

function refmapReset(){
  refmapTown = null;
  refmapPin = null;
  _tileFailed = false;
  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
}

// True while the rep is inside a town map, so swipe-nav and tap-to-advance
// stand down (same contract as every other overlay — see isSlideOverlayOpen).
function refmapIsOpen(){ return refmapTown !== null; }

// Whether a built dataset is actually present. Until it is, renderSlide()
// keeps showing the original placeholder rather than an empty map.
function refmapHasData(){ return !!(REFMAP_DATA && REFMAP_DATA.towns && REFMAP_DATA.towns.length); }

// ---------------------------------------------------------------- views --
function refmapListHTML(s){
  const d = REFMAP_DATA;
  const total = d.totalPins;
  return `
    <div class="refmap-head">
      <h2>${s.title}</h2>
      <div class="refmap-sub">${total.toLocaleString()} completed projects across ${d.towns.length} towns — tap a town to see the map.</div>
    </div>
    <div class="refmap-towns">
      ${d.towns.map((t, i) => `
        <button class="refmap-town" data-i="${i}">
          <span class="refmap-town-name">${t.city}</span>
          <span class="refmap-town-count">${t.count}</span>
        </button>`).join("")}
    </div>`;
}

function refmapMapHTML(t){
  return `
    <div class="refmap-mapbar">
      <button class="refmap-back" id="refmapBack">‹ All towns</button>
      <div class="refmap-mapbar-title">${t.city} <span>· ${t.count} project${t.count === 1 ? "" : "s"}</span></div>
    </div>
    <div class="refmap-mapwrap">
      <div class="refmap-canvas" id="refmapCanvas"></div>
      <div class="refmap-offline" id="refmapOffline" hidden>
        ${ICON.signal}
        <h3>Map needs a connection</h3>
        <p>The map imagery loads over the internet, same as any map app. The town list still works offline — reconnect to see pin locations.</p>
      </div>
      <div class="refmap-approx">Pin locations are approximate — shown to the block, not the address.</div>
    </div>`;
}

// ---------------------------------------------------------------- render --
// Called from the "refmap" branch of renderSlide().
function renderReferenceMap(area, s){
  const panel = document.createElement("div");
  panel.className = "refmap-panel";

  if (refmapTown === null) {
    panel.innerHTML = refmapListHTML(s) + footerBannerHTML(s.title);
    area.appendChild(panel);
    panel.querySelectorAll(".refmap-town").forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); refmapTown = +b.dataset.i; refmapPin = null; renderSlide(); };
    });
    return;
  }

  const t = REFMAP_DATA.towns[refmapTown];
  panel.innerHTML = refmapMapHTML(t);
  area.appendChild(panel);
  panel.querySelector("#refmapBack").onclick = (e) => {
    e.stopPropagation();
    if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
    refmapTown = null; refmapPin = null; renderSlide();
  };
  mountLeaflet(panel, t);
}

function mountLeaflet(panel, t){
  const host = panel.querySelector("#refmapCanvas");
  const offline = panel.querySelector("#refmapOffline");
  if (typeof L === "undefined") { offline.hidden = false; return; }

  const map = L.map(host, {
    zoomControl: true,
    attributionControl: true,
    // the slide sits inside a tap-to-advance surface; keep map gestures
    // contained so a pan never reads as a slide swipe
    tap: false
  });
  _leafletMap = map;

  // Set the view BEFORE requesting any tiles. Adding the layer first and
  // then calling fitBounds makes Leaflet abort the in-flight requests for
  // the old view, and those aborts arrive as `tileerror` — which is why an
  // error-triggered offline panel used to flash on every open.
  const pts = t.pins.map((p) => p.ll);
  map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 15 });

  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap"
  });

  // No tiles == no map, but a single tileerror is not evidence of that (one
  // tile can 404 at the edge of coverage while the rest are fine). Only
  // conclude "offline" if nothing at all has painted after a grace period,
  // and let any later success clear it.
  let loadedAny = false;
  tiles.on("tileload", () => { loadedAny = true; _tileFailed = false; offline.hidden = true; });
  offline.hidden = navigator.onLine;              // instant, reliable signal
  setTimeout(() => {
    if (!loadedAny) { _tileFailed = true; offline.hidden = false; }
  }, 4000);

  tiles.addTo(map);

  t.pins.forEach((p, i) => {
    const m = L.circleMarker(p.ll, {
      radius: 9, weight: 2.5,
      color: "#ffffff", fillColor: "#1b5e3f", fillOpacity: 0.95
    }).addTo(map);
    // One name, on demand, for the tapped pin only. Nothing renders a name
    // until this fires, and only ever one at a time (Leaflet closes the
    // previous popup when a new one opens).
    m.bindPopup(`<div class="refmap-pop">${p.n || "Completed project"}</div>`, {
      closeButton: true, autoPan: true
    });
    m.on("click", () => { refmapPin = i; });
  });

  // Leaflet needs a size recalc once the panel has been laid out.
  setTimeout(() => map.invalidateSize(), 60);
}

loadReferenceMap();
