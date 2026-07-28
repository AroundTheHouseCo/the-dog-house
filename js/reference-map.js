// Reference Map — "We've Worked in Your Neighborhood".
//
// Two views inside one slide:
//   1. Region list (3 tiles), sorted by combined job count.
//   2. Tap a region -> one combined map with every pin from every town in
//      that region, bounded to fit all of them. Tap a pin -> one name.
//
// Regions rather than a per-town list: 20 individual towns was too granular
// for a quick glance mid-conversation, and a single state-wide map with
// clusters is harder to hit reliably on an iPad than three big tiles. This
// still degrades gracefully when the map tiles can't load — the region list
// answers "have you worked near me?" on its own, no network required.
//
// DATA: data/reference-map.json, built by tools/build-reference-map.mjs.
// Coordinates in that file are already jittered 100-300ft and names are
// already abbreviated — this module does no privacy work of its own, it only
// renders what the build step produced. Nothing here geocodes at runtime.
// The town->region mapping below is presentation-layer only — it does not
// touch the build pipeline, the geocoding, or the privacy handling.
//
// TILES need connectivity (as any map app does). The library itself is
// vendored locally, so a missing network degrades to a clear branded panel,
// never a blank grey box.

// Every city currently in data/reference-map.json, mapped to exactly one of
// three regions. Sourced from a straight-line-distance check against
// Colorado Springs / Pueblo / Denver, with two close calls (Larkspur,
// Cañon City) resolved by hand — see the 2026-07-28 report for the full
// distance table and reasoning.
const REFMAP_REGIONS = ["Pikes Peak Region", "Southern Colorado", "Denver Metro"];
const REGION_BY_CITY = {
  "Colorado Springs": "Pikes Peak Region",
  "Monument":          "Pikes Peak Region",
  "Peyton":            "Pikes Peak Region",
  "Widefield":         "Pikes Peak Region",
  "Fountain":          "Pikes Peak Region",
  "Manitou Springs":   "Pikes Peak Region",
  "Woodland Park":     "Pikes Peak Region",
  "Elbert":            "Pikes Peak Region",
  "Larkspur":          "Pikes Peak Region",
  "Pueblo":            "Southern Colorado",
  "Canon City":        "Southern Colorado",
  "Penrose":           "Southern Colorado",
  "Avondale":          "Southern Colorado",
  "Castle Rock":       "Denver Metro",
  "Arvada":            "Denver Metro",
  "Littleton":         "Denver Metro",
  "Highlands Ranch":   "Denver Metro",
  "Denver":            "Denver Metro",
  "Westminster":       "Denver Metro",
  "Parker":            "Denver Metro",
};
// Fallback for a town added by a future rebuild that isn't in the table
// above yet: nearest-anchor distance, logged loudly rather than guessed at
// silently. Keeps the UI at exactly three regions without ever dropping pins.
const REGION_ANCHORS = {
  "Pikes Peak Region": [38.8339, -104.8214],
  "Southern Colorado": [38.2545, -104.6091],
  "Denver Metro":      [39.7392, -104.9903],
};
function regionFor(city, center){
  if (REGION_BY_CITY[city]) return REGION_BY_CITY[city];
  console.error(`Reference Map: "${city}" has no region mapping — falling back to nearest anchor. Add it to REGION_BY_CITY in js/reference-map.js.`);
  const distSq = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2;  // relative compare only, no need for haversine
  return REFMAP_REGIONS.reduce((best, r) =>
    distSq(center, REGION_ANCHORS[r]) < distSq(center, REGION_ANCHORS[best]) ? r : best, REFMAP_REGIONS[0]);
}

// Groups REFMAP_DATA.towns into the three regions, combining every town's
// pins into one flat array per region. Recomputed on demand (20 towns, cheap)
// rather than cached, so it always reflects whatever REFMAP_DATA currently is.
function regionGroups(){
  const byRegion = new Map(REFMAP_REGIONS.map((r) => [r, { name: r, count: 0, pins: [] }]));
  for (const t of REFMAP_DATA.towns) {
    const g = byRegion.get(regionFor(t.city, t.center));
    g.count += t.count;
    g.pins.push(...t.pins);
  }
  return [...byRegion.values()].sort((a, b) => b.count - a.count);
}

// undefined = still loading · null = no dataset shipped · object = data
let REFMAP_DATA;
let refmapRegion = null;    // active index into regionGroups(), or null for the list view
let refmapPin = null;       // active pin index within the region, or null
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
  refmapRegion = null;
  refmapPin = null;
  _tileFailed = false;
  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
}

// True while the rep is inside a region map, so swipe-nav and tap-to-advance
// stand down (same contract as every other overlay — see isSlideOverlayOpen).
function refmapIsOpen(){ return refmapRegion !== null; }

// Whether a built dataset is actually present. Until it is, renderSlide()
// keeps showing the original placeholder rather than an empty map.
function refmapHasData(){ return !!(REFMAP_DATA && REFMAP_DATA.towns && REFMAP_DATA.towns.length); }

// ---------------------------------------------------------------- views --
function refmapListHTML(s, regions){
  const total = REFMAP_DATA.totalPins;
  return `
    <div class="refmap-head">
      <h2>${s.title}</h2>
      <div class="refmap-sub">${total.toLocaleString()} completed projects across ${regions.length} regions — tap a region to see the map.</div>
    </div>
    <div class="refmap-regions">
      ${regions.map((r, i) => `
        <button class="refmap-town region" data-i="${i}">
          <span class="refmap-town-name">${r.name}</span>
          <span class="refmap-town-count">${r.count}</span>
        </button>`).join("")}
    </div>`;
}

function refmapMapHTML(r){
  return `
    <div class="refmap-mapbar">
      <button class="refmap-back" id="refmapBack">‹ All regions</button>
      <div class="refmap-mapbar-title">${r.name} <span>· ${r.count} project${r.count === 1 ? "" : "s"}</span></div>
    </div>
    <div class="refmap-mapwrap">
      <div class="refmap-canvas" id="refmapCanvas"></div>
      <div class="refmap-offline" id="refmapOffline" hidden>
        ${ICON.signal}
        <h3>Map needs a connection</h3>
        <p>The map imagery loads over the internet, same as any map app. The region list still works offline — reconnect to see pin locations.</p>
      </div>
      <div class="refmap-approx">Pin locations are approximate — shown to the block, not the address.</div>
    </div>`;
}

// ---------------------------------------------------------------- render --
// Called from the "refmap" branch of renderSlide().
function renderReferenceMap(area, s){
  const panel = document.createElement("div");
  panel.className = "refmap-panel";
  const regions = regionGroups();

  if (refmapRegion === null) {
    panel.innerHTML = refmapListHTML(s, regions) + footerBannerHTML(s.title);
    area.appendChild(panel);
    panel.querySelectorAll(".refmap-town").forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); refmapRegion = +b.dataset.i; refmapPin = null; renderSlide(); };
    });
    return;
  }

  const r = regions[refmapRegion];
  panel.innerHTML = refmapMapHTML(r);
  area.appendChild(panel);
  panel.querySelector("#refmapBack").onclick = (e) => {
    e.stopPropagation();
    if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
    refmapRegion = null; refmapPin = null; renderSlide();
  };
  mountLeaflet(panel, r);
}

function mountLeaflet(panel, r){
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
  // Bounds are computed over EVERY pin in the region (all its towns
  // combined), not any single town — a wide region like Pikes Peak (Woodland
  // Park to Peyton) needs the full spread in view, not just its biggest town.
  const pts = r.pins.map((p) => p.ll);
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

  r.pins.forEach((p, i) => {
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
