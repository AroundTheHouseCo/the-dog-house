// THE DOGHOUSE — service worker. Two independently-versioned caches:
//
// Tier 1 (TIER1_CACHE) — everything needed to run both decks (customer +
// training, Sunesta + Eclipse) fully offline: app shell, both decks'
// images, the awning-extend and drop-screen frame sequences, the fabric
// book pages, and the price-conditioning photos. ~18MB. Precached
// synchronously on install — the app must never wait on this.
//
// Tier 2 (TIER2_CACHE) — Photo Library (304 files) + Docs & Spec Sheets
// (7 PDFs), ~80MB, rep-reference-only. Not required for a demo to run,
// so it's never allowed to block install or first render — it starts
// downloading in the background once the SW activates (see
// cacheTier2InBackground below), and is re-nudged from app.js on every
// online app open so a first attempt interrupted by spotty wifi doesn't
// leave it silently incomplete forever.
//
// No build step in this project, so there's no commit hash to embed
// automatically — bump the relevant VERSION by hand any time that tier's
// file *content* changes (even if the path stays the same); without a
// bump, a returning client keeps the old bytes forever, since the fetch
// handler below is cache-first. New files don't need a bump on their
// own — they're just new URLs list entries, picked up on next deploy —
// but an edit to an *existing* file's content does. The two versions are
// independent on purpose: a Tier 1 content change shouldn't force every
// installed client to re-download 80MB of Tier 2, and vice versa.
const TIER1_VERSION = "2026-08-06.3";
const TIER2_VERSION = "2026-07-20.1";
const TIER1_CACHE = `doghouse-tier1-${TIER1_VERSION}`;
const TIER2_CACHE = `doghouse-tier2-${TIER2_VERSION}`;

// Tier 3 (PRICING_CACHE) — the Quote Builder's live data from Cockpit:
// pricing-engine.js + all 7 product catalogs + the version probe. ~33KB
// gzipped, so this is cheap, but unlike Tier 1/2 it's LIVE data, not
// static per-deploy content — there's no version string to bump by hand.
// Freshness is tracked by comparing Cockpit's own `stamp` (in the cached
// /api/pricing/version response) against a fresh probe; the cache name
// itself stays constant across deploys. Same self-healing-retry shape as
// Tier 2: Promise.allSettled so one failed file doesn't block the rest,
// re-driven on every online app open via postMessage (see js/quote-builder.js).
const PRICING_CACHE = "doghouse-pricing-v1";
const COCKPIT_BASE = "https://ath-cockpit.onrender.com";
const PRICING_KEY = "ATH2026";
const PRICING_PRODUCT_IDS = [
  "sunesta", "sunstyle", "sunlight",
  "eclipse-ezip-4in-sunstopper", "eclipse-ezip-5in-sunstopper",
  "eclipse-ezip-5in-superduty", "eclipse-ezip-7in-superduty",
  "eclipse-cable-4in", "eclipse-cable-5in",
];
function pricingUrls(){
  return [
    `${COCKPIT_BASE}/api/pricing/version`,
    `${COCKPIT_BASE}/api/pricing/products`,
    ...PRICING_PRODUCT_IDS.map((id) => `${COCKPIT_BASE}/api/pricing/product?id=${id}`),
    `${COCKPIT_BASE}/pricing-engine.js`,
  ];
}
function pricingFetch(url){
  return fetch(url, { headers: { "X-Pricing-Key": PRICING_KEY } });
}

const TIER1_URLS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  // Leaflet is vendored rather than pulled from a CDN so the map library
  // itself works offline and precaches here; only the tile imagery needs
  // a live connection (see js/reference-map.js).
  "vendor/leaflet.css",
  "vendor/leaflet.js",
  "js/icons.js",
  "js/training-content.js",
  "js/training-render.js",
  "js/training-coach.js",
  "data/doghouse-content-v1.json",
  "data/training-content-eclipse.json",
  "data/training-content-shared.json",
  "data/company-settings.json",
  "js/reference-map.js",
  // Reference Map dataset (jittered coords + abbreviated names, 13KB).
  // Precached so the town list works offline; only the map tiles need a
  // live connection.
  "data/reference-map.json",
  // Reference Map region tile backgrounds (CC BY — see js/reference-map.js)
  "images/regions/pikes-peak.jpg",
  "images/regions/southern-colorado.jpg",
  "images/regions/denver-metro.jpg",
  "js/registry.js",
  "js/data-sunesta.js",
  "js/data-eclipse.js",
  "js/images-map.js",
  "js/library-data.js",
  // quote-builder.js is loaded by index.html but was missing from this list,
  // so the Quote Builder — whose own card promises "works offline" — had no
  // offline copy of its script.
  "js/quote-builder.js",
  "js/app.js",
  "images/app-icon.svg",
  "images/icon-120.png",
  "images/icon-152.png",
  "images/icon-167.png",
  "images/icon-180.png",
  "images/icon-192.png",
  "images/icon-512.png",
  "images/dealer-family.jpg",
  "images/training-photo.jpg",
  "images/training-cert.jpg",
  "images/ath-logo.jpg",
  "images/badge-45years.png",
  "images/icon-ruler.jpg",
  "images/american-built.png",
  "images/badge-miamidade.png",
  "images/badge-bbb.jpg",
  "images/badge-skincancer.jpg",
  "images/reasons-photo.jpg",
  "images/perfect-day.jpg",
  "images/smarttech-title.jpg",
  "images/sensors.jpg",
  "images/beach-before.jpg",
  "images/beach-after.jpg",
  "images/opt-fabric.jpg",
  "images/opt-arm.jpg",
  "images/opt-mount-wide.jpg",
  "images/opt-mount-close.jpg",
  "images/opt-dropscreen.jpg",
  "images/falllove-1.jpg",
  "images/falllove-2.jpg",
  "images/falllove-3.jpg",
  "images/falllove-4.jpg",
  "images/award.jpg",
  "images/sunesta-logo.jpg",
  "images/led-night.svg",
  "images/mylink-app.svg",
  "images/mylink-app-phone.jpg",
  "images/mylink-tahoma-hub.jpg",
  "images/smarttech-illus.svg",
  "images/sensors-illus.svg",
  "images/sensor-wind.jpg",
  "images/led-awning-arms.jpg",
  "images/fabric-swatches.svg",
  "images/service-badge.svg",
  "images/prod-gutter.svg",
  "images/prod-screen.svg",
  "images/prod-louver.svg",
  "images/prod-gutter-photo.jpg",
  "images/prod-screen-photo.jpg",
  "images/prod-louver-photo.jpg",
  "images/logo-gutterhelmet.jpg",
  "images/logo-eclipse.png",
  "images/tri-ath-family.jpg",
  "images/tri-sunesta-awning.jpg",
  "images/reason-thermometer.svg",
  "images/reason-rain.svg",
  "images/reason-uvwood.svg",
  "images/refmap-placeholder.svg",
  "images/proc-manager.svg",
  "images/proc-site.svg",
  "images/proc-install.svg",
  "images/proc-walkthrough.svg",
  "images/proc-warranty.svg",
  "images/proc-service.svg",
  "images/eclipse/byerly-1.jpg",
  "images/eclipse/byerly-2.jpg",
  "images/eclipse/byerly-night.jpg",
  "images/eclipse/monument-18ft-up.jpg",
  "images/eclipse/monument-18ft-down.jpg",
  "images/eclipse/monument-18ft-down-outside.jpg",
  "images/eclipse/garcia-inside.jpg",
  "images/eclipse/three-ezips-porch.jpg",
  "images/eclipse/ezip-with-awning.jpg",
  "images/eclipse/sunroom-drop-screen.jpg",
  "images/eclipse/part-way-up.jpg",
  "images/eclipse/waterlander-full.jpg",
  "images/eclipse/recessed-stone.jpg",
  "images/eclipse/ez-how-it-works.svg",
  "images/eclipse/logo-somfy.png",
  "images/eclipse/service-badge-ez.svg",
  "images/eclipse/badge-class6-wind.svg",
  "images/eclipse/smart-control-placeholder.svg",
  "images/eclipse/eclipse-dealer-placeholder.svg",
  "images/eclipse/arched-deck.jpg",
  "images/eclipse/mylink-phone.jpg",
  "images/eclipse/transform-before.jpg",
  "images/eclipse/transform-after.jpg",
  "images/eclipse/transform-inside.jpg",
  "images/pricecond/tier1-shadesail.jpg",
  "images/pricecond/tier2-diy.jpg",
  "images/pricecond/tier3-lowgrade.jpg",
  "images/pricecond/tier4-midtier.jpg",
  "images/pricecond/tier5-highend.jpg",
  "images/pricecond/tier6-pergola.jpg",
  "images/awning-frames/frame-00.jpg",
  "images/awning-frames/frame-01.jpg",
  "images/awning-frames/frame-02.jpg",
  "images/awning-frames/frame-03.jpg",
  "images/awning-frames/frame-04.jpg",
  "images/awning-frames/frame-05.jpg",
  "images/awning-frames/frame-06.jpg",
  "images/awning-frames/frame-07.jpg",
  "images/awning-frames/frame-08.jpg",
  "images/awning-frames/frame-09.jpg",
  "images/awning-frames/frame-10.jpg",
  "images/awning-frames/frame-11.jpg",
  "images/awning-frames/frame-12.jpg",
  "images/awning-frames/frame-13.jpg",
  "images/awning-frames/frame-14.jpg",
  "images/awning-frames/frame-15.jpg",
  "images/awning-frames/frame-16.jpg",
  "images/awning-frames/frame-17.jpg",
  "images/awning-frames/frame-18.jpg",
  "images/awning-frames/frame-19.jpg",
  "images/awning-frames/frame-20.jpg",
  "images/awning-frames/frame-21.jpg",
  "images/awning-frames/frame-22.jpg",
  "images/awning-frames/frame-23.jpg",
  "images/awning-frames/frame-24.jpg",
  "images/awning-frames/frame-25.jpg",
  "images/awning-frames/frame-26.jpg",
  "images/awning-frames/frame-27.jpg",
  "images/awning-frames/frame-28.jpg",
  "images/awning-frames/frame-29.jpg",
  "images/awning-frames/frame-30.jpg",
  "images/awning-frames/frame-31.jpg",
  "images/dropscreen-frames/frame-00.jpg",
  "images/dropscreen-frames/frame-01.jpg",
  "images/dropscreen-frames/frame-02.jpg",
  "images/dropscreen-frames/frame-03.jpg",
  "images/dropscreen-frames/frame-04.jpg",
  "images/dropscreen-frames/frame-05.jpg",
  "images/dropscreen-frames/frame-06.jpg",
  "images/dropscreen-frames/frame-07.jpg",
  "images/dropscreen-frames/frame-08.jpg",
  "images/dropscreen-frames/frame-09.jpg",
  "images/dropscreen-frames/frame-10.jpg",
  "images/dropscreen-frames/frame-11.jpg",
  "images/dropscreen-frames/frame-12.jpg",
  "images/dropscreen-frames/frame-13.jpg",
  "images/dropscreen-frames/frame-14.jpg",
  "images/dropscreen-frames/frame-15.jpg",
  "images/dropscreen-frames/frame-16.jpg",
  "images/dropscreen-frames/frame-17.jpg",
  "images/dropscreen-frames/frame-18.jpg",
  "images/dropscreen-frames/frame-19.jpg",
  "images/dropscreen-frames/frame-20.jpg",
  "images/dropscreen-frames/frame-21.jpg",
  "images/dropscreen-frames/frame-22.jpg",
  "images/dropscreen-frames/frame-23.jpg",
  "images/dropscreen-frames/frame-24.jpg",
  "images/dropscreen-frames/frame-25.jpg",
  "images/dropscreen-frames/frame-26.jpg",
  "images/dropscreen-frames/frame-27.jpg",
  "images/fabric-pages/page-01.jpg",
  "images/fabric-pages/page-02.jpg",
  "images/fabric-pages/page-03.jpg",
  "images/fabric-pages/page-04.jpg",
  "images/fabric-pages/page-05.jpg",
  "images/fabric-pages/page-06.jpg",
  "images/fabric-pages/page-07.jpg",
  "images/fabric-pages/page-08.jpg",
  "images/fabric-pages/z-frame-colors.jpg",
  "images/fabric-pages/z-smartdrop-colors.jpg"
];

// Photo Library (all 5 categories, full + thumb) and Docs & Spec Sheets
// (Sunesta's 5 PDFs + Eclipse's 2 PDFs). Sunesta's two "kind":"image" doc
// entries (Frame Colors, SmartDrop Screen Colors) were repointed at their
// already-Tier-1-cached images/fabric-pages/z-*.jpg twins (js/library-data.js)
// instead of the docs/ originals, so they're deliberately NOT listed here —
// caching them twice under two paths would be pure waste. ~80MB total.
const TIER2_URLS = [
  "images/library/sunesta/2026-03-10-21-22-36z-1.jpg",
  "images/library/sunesta/thumb/2026-03-10-21-22-36z-1.jpg",
  "images/library/sunesta/2026-03-10-21-22-36z.jpg",
  "images/library/sunesta/thumb/2026-03-10-21-22-36z.jpg",
  "images/library/sunesta/2026-03-11-18-20-46z.jpg",
  "images/library/sunesta/thumb/2026-03-11-18-20-46z.jpg",
  "images/library/sunesta/2026-03-11-18-20-58z.jpg",
  "images/library/sunesta/thumb/2026-03-11-18-20-58z.jpg",
  "images/library/sunesta/2026-03-18-19-41-38z-1.jpg",
  "images/library/sunesta/thumb/2026-03-18-19-41-38z-1.jpg",
  "images/library/sunesta/2026-03-18-19-41-38z-2.jpg",
  "images/library/sunesta/thumb/2026-03-18-19-41-38z-2.jpg",
  "images/library/sunesta/2026-03-18-19-41-38z-3.jpg",
  "images/library/sunesta/thumb/2026-03-18-19-41-38z-3.jpg",
  "images/library/sunesta/2026-03-18-19-41-38z-4.jpg",
  "images/library/sunesta/thumb/2026-03-18-19-41-38z-4.jpg",
  "images/library/sunesta/2026-03-18-19-41-38z.jpg",
  "images/library/sunesta/thumb/2026-03-18-19-41-38z.jpg",
  "images/library/sunesta/2026-03-18-19-41-52z.jpg",
  "images/library/sunesta/thumb/2026-03-18-19-41-52z.jpg",
  "images/library/sunesta/2026-03-31-17-47-50z.jpg",
  "images/library/sunesta/thumb/2026-03-31-17-47-50z.jpg",
  "images/library/sunesta/2026-03-31-17-51-02z.jpg",
  "images/library/sunesta/thumb/2026-03-31-17-51-02z.jpg",
  "images/library/sunesta/2026-03-31-17-51-16z.jpg",
  "images/library/sunesta/thumb/2026-03-31-17-51-16z.jpg",
  "images/library/sunesta/2026-04-01-16-50-02z-1.jpg",
  "images/library/sunesta/thumb/2026-04-01-16-50-02z-1.jpg",
  "images/library/sunesta/2026-04-01-16-50-02z-2.jpg",
  "images/library/sunesta/thumb/2026-04-01-16-50-02z-2.jpg",
  "images/library/sunesta/2026-04-01-16-50-02z.jpg",
  "images/library/sunesta/thumb/2026-04-01-16-50-02z.jpg",
  "images/library/sunesta/2026-04-01-21-03-24z-1.jpg",
  "images/library/sunesta/thumb/2026-04-01-21-03-24z-1.jpg",
  "images/library/sunesta/2026-04-01-21-03-24z.jpg",
  "images/library/sunesta/thumb/2026-04-01-21-03-24z.jpg",
  "images/library/sunesta/2026-04-01-21-04-12z.jpg",
  "images/library/sunesta/thumb/2026-04-01-21-04-12z.jpg",
  "images/library/sunesta/2026-04-01-21-04-24z.jpg",
  "images/library/sunesta/thumb/2026-04-01-21-04-24z.jpg",
  "images/library/sunesta/2026-04-02-21-50-49z.jpg",
  "images/library/sunesta/thumb/2026-04-02-21-50-49z.jpg",
  "images/library/sunesta/2026-04-02-21-50-56z.jpg",
  "images/library/sunesta/thumb/2026-04-02-21-50-56z.jpg",
  "images/library/sunesta/2026-04-02-21-51-04z.jpg",
  "images/library/sunesta/thumb/2026-04-02-21-51-04z.jpg",
  "images/library/sunesta/2026-04-02-21-51-18z.jpg",
  "images/library/sunesta/thumb/2026-04-02-21-51-18z.jpg",
  "images/library/sunesta/2026-04-02-21-51-31z.jpg",
  "images/library/sunesta/thumb/2026-04-02-21-51-31z.jpg",
  "images/library/sunesta/2026-04-07-20-35-41z.jpg",
  "images/library/sunesta/thumb/2026-04-07-20-35-41z.jpg",
  "images/library/sunesta/2026-04-07-20-36-57z.jpg",
  "images/library/sunesta/thumb/2026-04-07-20-36-57z.jpg",
  "images/library/sunesta/2026-04-10-16-24-19z-1.jpg",
  "images/library/sunesta/thumb/2026-04-10-16-24-19z-1.jpg",
  "images/library/sunesta/2026-04-10-16-24-19z.jpg",
  "images/library/sunesta/thumb/2026-04-10-16-24-19z.jpg",
  "images/library/sunesta/2026-04-15-20-46-21z.jpg",
  "images/library/sunesta/thumb/2026-04-15-20-46-21z.jpg",
  "images/library/sunesta/2026-04-15-20-46-46z.jpg",
  "images/library/sunesta/thumb/2026-04-15-20-46-46z.jpg",
  "images/library/sunesta/2026-04-21-01-41-39z-3.jpg",
  "images/library/sunesta/thumb/2026-04-21-01-41-39z-3.jpg",
  "images/library/sunesta/2026-05-05-19-40-49z.jpg",
  "images/library/sunesta/thumb/2026-05-05-19-40-49z.jpg",
  "images/library/sunesta/2026-05-07-20-46-21z.jpg",
  "images/library/sunesta/thumb/2026-05-07-20-46-21z.jpg",
  "images/library/sunesta/2026-05-07-20-47-44z.jpg",
  "images/library/sunesta/thumb/2026-05-07-20-47-44z.jpg",
  "images/library/sunesta/2026-05-07-23-43-08z-1.jpg",
  "images/library/sunesta/thumb/2026-05-07-23-43-08z-1.jpg",
  "images/library/sunesta/2026-05-07-23-43-08z.jpg",
  "images/library/sunesta/thumb/2026-05-07-23-43-08z.jpg",
  "images/library/sunesta/2026-05-08-23-17-40z-2.jpg",
  "images/library/sunesta/thumb/2026-05-08-23-17-40z-2.jpg",
  "images/library/sunesta/2026-05-08-23-17-40z-3.jpg",
  "images/library/sunesta/thumb/2026-05-08-23-17-40z-3.jpg",
  "images/library/sunesta/2026-05-08-23-17-40z-4.jpg",
  "images/library/sunesta/thumb/2026-05-08-23-17-40z-4.jpg",
  "images/library/sunesta/2026-05-15-16-32-52z-1.jpg",
  "images/library/sunesta/thumb/2026-05-15-16-32-52z-1.jpg",
  "images/library/sunesta/2026-05-15-16-32-52z-2.jpg",
  "images/library/sunesta/thumb/2026-05-15-16-32-52z-2.jpg",
  "images/library/sunesta/2026-05-15-16-32-52z.jpg",
  "images/library/sunesta/thumb/2026-05-15-16-32-52z.jpg",
  "images/library/sunesta/2026-05-20-16-55-34z-1.jpg",
  "images/library/sunesta/thumb/2026-05-20-16-55-34z-1.jpg",
  "images/library/sunesta/2026-05-20-16-55-34z-2.jpg",
  "images/library/sunesta/thumb/2026-05-20-16-55-34z-2.jpg",
  "images/library/sunesta/2026-05-20-16-55-34z.jpg",
  "images/library/sunesta/thumb/2026-05-20-16-55-34z.jpg",
  "images/library/sunesta/2026-06-10-17-16-00z-1.jpg",
  "images/library/sunesta/thumb/2026-06-10-17-16-00z-1.jpg",
  "images/library/sunesta/2026-06-10-17-16-00z-2.jpg",
  "images/library/sunesta/thumb/2026-06-10-17-16-00z-2.jpg",
  "images/library/sunesta/2026-06-10-17-16-00z-3.jpg",
  "images/library/sunesta/thumb/2026-06-10-17-16-00z-3.jpg",
  "images/library/sunesta/2026-06-10-17-16-00z.jpg",
  "images/library/sunesta/thumb/2026-06-10-17-16-00z.jpg",
  "images/library/sunesta/2026-06-18-19-16-07z-1.jpg",
  "images/library/sunesta/thumb/2026-06-18-19-16-07z-1.jpg",
  "images/library/sunesta/2026-06-18-19-16-07z-2.jpg",
  "images/library/sunesta/thumb/2026-06-18-19-16-07z-2.jpg",
  "images/library/sunesta/2026-06-18-19-16-07z.jpg",
  "images/library/sunesta/thumb/2026-06-18-19-16-07z.jpg",
  "images/library/sunesta/2026-06-19-16-42-03z.jpg",
  "images/library/sunesta/thumb/2026-06-19-16-42-03z.jpg",
  "images/library/sunesta/2026-06-19-16-42-20z.jpg",
  "images/library/sunesta/thumb/2026-06-19-16-42-20z.jpg",
  "images/library/sunesta/2026-06-19-16-42-30z.jpg",
  "images/library/sunesta/thumb/2026-06-19-16-42-30z.jpg",
  "images/library/sunesta/2026-07-02-17-58-37z.jpg",
  "images/library/sunesta/thumb/2026-07-02-17-58-37z.jpg",
  "images/library/sunesta/2026-07-02-17-59-02z.jpg",
  "images/library/sunesta/thumb/2026-07-02-17-59-02z.jpg",
  "images/library/sunesta/2026-07-02-17-59-21z.jpg",
  "images/library/sunesta/thumb/2026-07-02-17-59-21z.jpg",
  "images/library/sunesta/5-8-26-06-40-35-pm-1.jpg",
  "images/library/sunesta/thumb/5-8-26-06-40-35-pm-1.jpg",
  "images/library/sunesta/brown-tan-stripe-charcoal-deck-fascia-mount.jpg",
  "images/library/sunesta/thumb/brown-tan-stripe-charcoal-deck-fascia-mount.jpg",
  "images/library/sunesta/brown-tan-stripe-charcoal-deck-fascia-mount-b.jpg",
  "images/library/sunesta/thumb/brown-tan-stripe-charcoal-deck-fascia-mount-b.jpg",
  "images/library/sunesta/brown-tan-stripe-charcoal-deck-fascia-mount-c.jpg",
  "images/library/sunesta/thumb/brown-tan-stripe-charcoal-deck-fascia-mount-c.jpg",
  "images/library/sunesta/brown-tan-stripe-charcoal-deck-fascia-mount-d.jpg",
  "images/library/sunesta/thumb/brown-tan-stripe-charcoal-deck-fascia-mount-d.jpg",
  "images/library/sunesta/brown-tan-stripe-charcoal-deck-fascia-mount-e.jpg",
  "images/library/sunesta/thumb/brown-tan-stripe-charcoal-deck-fascia-mount-e.jpg",
  "images/library/sunesta/charcoal-solid-brown-soffit-mount-with-drop-screen.jpg",
  "images/library/sunesta/thumb/charcoal-solid-brown-soffit-mount-with-drop-screen.jpg",
  "images/library/sunesta/charcoal-solid-charcoal-siding-wall-mount.jpg",
  "images/library/sunesta/thumb/charcoal-solid-charcoal-siding-wall-mount.jpg",
  "images/library/sunesta/charcoal-solid-charcoal-siding-wall-mount-b.jpg",
  "images/library/sunesta/thumb/charcoal-solid-charcoal-siding-wall-mount-b.jpg",
  "images/library/sunesta/charcoal-solid-charcoal-siding-wall-mount-c.jpg",
  "images/library/sunesta/thumb/charcoal-solid-charcoal-siding-wall-mount-c.jpg",
  "images/library/sunesta/charcoal-solid-charcoal-siding-wall-mount-with-drop-screen.jpg",
  "images/library/sunesta/thumb/charcoal-solid-charcoal-siding-wall-mount-with-drop-screen.jpg",
  "images/library/sunesta/charcoal-solid-charcoal-siding-wall-mount-with-drop-screen-b.jpg",
  "images/library/sunesta/thumb/charcoal-solid-charcoal-siding-wall-mount-with-drop-screen-b.jpg",
  "images/library/sunesta/cream-solid-brown-stucco-wall-mount.jpg",
  "images/library/sunesta/thumb/cream-solid-brown-stucco-wall-mount.jpg",
  "images/library/sunesta/cream-solid-brown-stucco-wall-mount-with-drop-screen.jpg",
  "images/library/sunesta/thumb/cream-solid-brown-stucco-wall-mount-with-drop-screen.jpg",
  "images/library/sunesta/cream-solid-white-deck-wall-mount.jpg",
  "images/library/sunesta/thumb/cream-solid-white-deck-wall-mount.jpg",
  "images/library/sunesta/cream-solid-white-deck-wall-mount-b.jpg",
  "images/library/sunesta/thumb/cream-solid-white-deck-wall-mount-b.jpg",
  "images/library/sunesta/cream-solid-white-siding-wall-mount-bracket-closeup.jpg",
  "images/library/sunesta/thumb/cream-solid-white-siding-wall-mount-bracket-closeup.jpg",
  "images/library/sunesta/cream-solid-white-stucco-wall-mount.jpg",
  "images/library/sunesta/thumb/cream-solid-white-stucco-wall-mount.jpg",
  "images/library/sunesta/cream-solid-white-stucco-wall-mount-b.jpg",
  "images/library/sunesta/thumb/cream-solid-white-stucco-wall-mount-b.jpg",
  "images/library/sunesta/cream-solid-white-stucco-wall-mount-c.jpg",
  "images/library/sunesta/thumb/cream-solid-white-stucco-wall-mount-c.jpg",
  "images/library/sunesta/gray-green-stripe-charcoal-stucco-wall-mount.jpg",
  "images/library/sunesta/thumb/gray-green-stripe-charcoal-stucco-wall-mount.jpg",
  "images/library/sunesta/gray-white-stripe-charcoal-stucco-wall-mount.jpg",
  "images/library/sunesta/thumb/gray-white-stripe-charcoal-stucco-wall-mount.jpg",
  "images/library/sunesta/gray-white-stripe-charcoal-stucco-wall-mount-b.jpg",
  "images/library/sunesta/thumb/gray-white-stripe-charcoal-stucco-wall-mount-b.jpg",
  "images/library/sunesta/gray-white-stripe-charcoal-stucco-wall-mount-c.jpg",
  "images/library/sunesta/thumb/gray-white-stripe-charcoal-stucco-wall-mount-c.jpg",
  "images/library/sunesta/gray-white-stripe-charcoal-stucco-wall-mount-d.jpg",
  "images/library/sunesta/thumb/gray-white-stripe-charcoal-stucco-wall-mount-d.jpg",
  "images/library/sunesta/gray-white-stripe-charcoal-stucco-wall-mount-e.jpg",
  "images/library/sunesta/thumb/gray-white-stripe-charcoal-stucco-wall-mount-e.jpg",
  "images/library/sunesta/gray-white-stripe-charcoal-stucco-wall-mount-f.jpg",
  "images/library/sunesta/thumb/gray-white-stripe-charcoal-stucco-wall-mount-f.jpg",
  "images/library/sunesta/gray-white-stripe-white-siding-wall-mount.jpg",
  "images/library/sunesta/thumb/gray-white-stripe-white-siding-wall-mount.jpg",
  "images/library/sunesta/gray-white-stripe-white-siding-wall-mount-b.jpg",
  "images/library/sunesta/thumb/gray-white-stripe-white-siding-wall-mount-b.jpg",
  "images/library/sunesta/gray-solid-white-deck-wall-mount.jpg",
  "images/library/sunesta/thumb/gray-solid-white-deck-wall-mount.jpg",
  "images/library/sunesta/gray-solid-white-deck-wall-mount-b.jpg",
  "images/library/sunesta/thumb/gray-solid-white-deck-wall-mount-b.jpg",
  "images/library/sunesta/navy-solid-white-siding-wall-mount-with-drop-screen.jpg",
  "images/library/sunesta/thumb/navy-solid-white-siding-wall-mount-with-drop-screen.jpg",
  "images/library/sunesta/sunesta-awning-on-ledger-board.jpg",
  "images/library/sunesta/thumb/sunesta-awning-on-ledger-board.jpg",
  "images/library/sunesta/tan-natural-stripe-charcoal-overhead-mount.jpg",
  "images/library/sunesta/thumb/tan-natural-stripe-charcoal-overhead-mount.jpg",
  "images/library/sunesta/tan-white-stripe-black-deck-wall-mount.jpg",
  "images/library/sunesta/thumb/tan-white-stripe-black-deck-wall-mount.jpg",
  "images/library/sunesta/tan-white-stripe-black-deck-wall-mount-b.jpg",
  "images/library/sunesta/thumb/tan-white-stripe-black-deck-wall-mount-b.jpg",
  "images/library/sunesta/tan-white-stripe-black-fascia-mount.jpg",
  "images/library/sunesta/thumb/tan-white-stripe-black-fascia-mount.jpg",
  "images/library/sunesta/tan-solid-beige-soffit-mount-with-drop-screen.jpg",
  "images/library/sunesta/thumb/tan-solid-beige-soffit-mount-with-drop-screen.jpg",
  "images/library/sunesta/tan-solid-black-stucco-wall-mount.jpg",
  "images/library/sunesta/thumb/tan-solid-black-stucco-wall-mount.jpg",
  "images/library/sunesta/tan-solid-black-stucco-wall-mount-with-drop-screen.jpg",
  "images/library/sunesta/thumb/tan-solid-black-stucco-wall-mount-with-drop-screen.jpg",
  "images/library/sunesta/tan-solid-black-stucco-wall-mount-with-drop-screen-b.jpg",
  "images/library/sunesta/thumb/tan-solid-black-stucco-wall-mount-with-drop-screen-b.jpg",
  "images/library/sunesta/tan-solid-black-stucco-wall-mount-with-drop-screen-c.jpg",
  "images/library/sunesta/thumb/tan-solid-black-stucco-wall-mount-with-drop-screen-c.jpg",
  "images/library/sunesta/tan-solid-white-deck-wall-mount.jpg",
  "images/library/sunesta/thumb/tan-solid-white-deck-wall-mount.jpg",
  "images/library/sunesta/white-solid-white-deck-wall-mount.jpg",
  "images/library/sunesta/thumb/white-solid-white-deck-wall-mount.jpg",
  "images/library/sunesta/white-solid-white-deck-wall-mount-b.jpg",
  "images/library/sunesta/thumb/white-solid-white-deck-wall-mount-b.jpg",
  "images/library/sunstyle/2026-04-13-16-32-06z.jpg",
  "images/library/sunstyle/thumb/2026-04-13-16-32-06z.jpg",
  "images/library/sunstyle/2026-04-13-16-37-09z-1.jpg",
  "images/library/sunstyle/thumb/2026-04-13-16-37-09z-1.jpg",
  "images/library/sunstyle/2026-04-13-16-37-09z.jpg",
  "images/library/sunstyle/thumb/2026-04-13-16-37-09z.jpg",
  "images/library/sunstyle/tan-solid-charcoal-stucco-wall-mount.jpg",
  "images/library/sunstyle/thumb/tan-solid-charcoal-stucco-wall-mount.jpg",
  "images/library/sunstyle/tan-solid-charcoal-stucco-wall-mount-b.jpg",
  "images/library/sunstyle/thumb/tan-solid-charcoal-stucco-wall-mount-b.jpg",
  "images/library/sunstyle/tan-solid-charcoal-stucco-wall-mount-retracted.jpg",
  "images/library/sunstyle/thumb/tan-solid-charcoal-stucco-wall-mount-retracted.jpg",
  "images/library/sunstyle/tan-solid-charcoal-stucco-wall-mount-retracted-b.jpg",
  "images/library/sunstyle/thumb/tan-solid-charcoal-stucco-wall-mount-retracted-b.jpg",
  "images/library/sunlight/brown-tan-stripe-charcoal-deck-fascia-mount.jpg",
  "images/library/sunlight/thumb/brown-tan-stripe-charcoal-deck-fascia-mount.jpg",
  "images/library/sunlight/brown-tan-stripe-charcoal-deck-fascia-mount-b.jpg",
  "images/library/sunlight/thumb/brown-tan-stripe-charcoal-deck-fascia-mount-b.jpg",
  "images/library/sunlight/brown-tan-stripe-charcoal-deck-fascia-mount-c.jpg",
  "images/library/sunlight/thumb/brown-tan-stripe-charcoal-deck-fascia-mount-c.jpg",
  "images/library/sunlight/brown-tan-stripe-charcoal-deck-fascia-mount-d.jpg",
  "images/library/sunlight/thumb/brown-tan-stripe-charcoal-deck-fascia-mount-d.jpg",
  "images/library/sunlight/brown-tan-stripe-charcoal-deck-fascia-mount-e.jpg",
  "images/library/sunlight/thumb/brown-tan-stripe-charcoal-deck-fascia-mount-e.jpg",
  "images/library/sunlight/gray-white-stripe-charcoal-stucco-wall-mount.jpg",
  "images/library/sunlight/thumb/gray-white-stripe-charcoal-stucco-wall-mount.jpg",
  "images/library/sunlight/gray-white-stripe-charcoal-stucco-wall-mount-b.jpg",
  "images/library/sunlight/thumb/gray-white-stripe-charcoal-stucco-wall-mount-b.jpg",
  "images/library/sunlight/gray-white-stripe-charcoal-stucco-wall-mount-c.jpg",
  "images/library/sunlight/thumb/gray-white-stripe-charcoal-stucco-wall-mount-c.jpg",
  "images/library/sunlight/gray-white-stripe-charcoal-stucco-wall-mount-d.jpg",
  "images/library/sunlight/thumb/gray-white-stripe-charcoal-stucco-wall-mount-d.jpg",
  "images/library/sunlight/gray-white-stripe-charcoal-stucco-wall-mount-e.jpg",
  "images/library/sunlight/thumb/gray-white-stripe-charcoal-stucco-wall-mount-e.jpg",
  "images/library/sunlight/gray-white-stripe-charcoal-stucco-wall-mount-f.jpg",
  "images/library/sunlight/thumb/gray-white-stripe-charcoal-stucco-wall-mount-f.jpg",
  "images/library/sunlight/gray-white-stripe-white-siding-wall-mount.jpg",
  "images/library/sunlight/thumb/gray-white-stripe-white-siding-wall-mount.jpg",
  "images/library/awnings/colorado-shades-awning.jpg",
  "images/library/awnings/thumb/colorado-shades-awning.jpg",
  "images/library/awnings/fickel-awning-1.jpg",
  "images/library/awnings/thumb/fickel-awning-1.jpg",
  "images/library/awnings/fickle-awning-with-people-under-it.jpg",
  "images/library/awnings/thumb/fickle-awning-with-people-under-it.jpg",
  "images/library/awnings/gray-black-stripe-black-indoor-showroom-display.jpg",
  "images/library/awnings/thumb/gray-black-stripe-black-indoor-showroom-display.jpg",
  "images/library/awnings/gray-white-stripe-black-siding-wall-mount.jpg",
  "images/library/awnings/thumb/gray-white-stripe-black-siding-wall-mount.jpg",
  "images/library/awnings/gray-solid-charcoal-fascia-mount.jpg",
  "images/library/awnings/thumb/gray-solid-charcoal-fascia-mount.jpg",
  "images/library/awnings/green-white-red-stripe-white-wind-sensor-closeup.jpg",
  "images/library/awnings/thumb/green-white-red-stripe-white-wind-sensor-closeup.jpg",
  "images/library/awnings/mhs-solar-eclipse-full-cassette-with-drop-shade.jpg",
  "images/library/awnings/thumb/mhs-solar-eclipse-full-cassette-with-drop-shade.jpg",
  "images/library/awnings/multi-color-stripe-white-siding-wall-mount-with-drop-screen.jpg",
  "images/library/awnings/thumb/multi-color-stripe-white-siding-wall-mount-with-drop-screen.jpg",
  "images/library/awnings/tan-cream-stripe-beige-siding-wall-mount.jpg",
  "images/library/awnings/thumb/tan-cream-stripe-beige-siding-wall-mount.jpg",
  "images/library/awnings/tan-red-olive-stripe-beige-wind-sensor-closeup.jpg",
  "images/library/awnings/thumb/tan-red-olive-stripe-beige-wind-sensor-closeup.jpg",
  "images/library/screens/1469-hi-screen-1-image-3-v2.jpg",
  "images/library/screens/thumb/1469-hi-screen-1-image-3-v2.jpg",
  "images/library/screens/1497-hi-sunesta-screen-bug-and-privacy-1.jpg",
  "images/library/screens/thumb/1497-hi-sunesta-screen-bug-and-privacy-1.jpg",
  "images/library/screens/22-1882229199-anderson-reda-install-2013-09-06-002.jpg",
  "images/library/screens/thumb/22-1882229199-anderson-reda-install-2013-09-06-002.jpg",
  "images/library/screens/22-50910762-tulsa-area-screen-sunesta.jpg",
  "images/library/screens/thumb/22-50910762-tulsa-area-screen-sunesta.jpg",
  "images/library/screens/22-578031152-reynolds-straight.jpg",
  "images/library/screens/thumb/22-578031152-reynolds-straight.jpg",
  "images/library/screens/22-60262557-anderson-reda-install-2013-09-06-007.jpg",
  "images/library/screens/thumb/22-60262557-anderson-reda-install-2013-09-06-007.jpg",
  "images/library/screens/25-12-07-07-pm-1.jpg",
  "images/library/screens/thumb/25-12-07-07-pm-1.jpg",
  "images/library/screens/25-12-07-07-pm-2.jpg",
  "images/library/screens/thumb/25-12-07-07-pm-2.jpg",
  "images/library/screens/25-12-07-07-pm-3.jpg",
  "images/library/screens/thumb/25-12-07-07-pm-3.jpg",
  "images/library/screens/25-12-07-07-pm-4.jpg",
  "images/library/screens/thumb/25-12-07-07-pm-4.jpg",
  "images/library/screens/25-12-07-07-pm-5.jpg",
  "images/library/screens/thumb/25-12-07-07-pm-5.jpg",
  "images/library/screens/25-12-07-07-pm-6.jpg",
  "images/library/screens/thumb/25-12-07-07-pm-6.jpg",
  "images/library/screens/25-12-07-07-pm-7.jpg",
  "images/library/screens/thumb/25-12-07-07-pm-7.jpg",
  "images/library/screens/25-12-07-07-pm-8.jpg",
  "images/library/screens/thumb/25-12-07-07-pm-8.jpg",
  "images/library/screens/25-12-07-07-pm.jpg",
  "images/library/screens/thumb/25-12-07-07-pm.jpg",
  "images/library/screens/family-screen-inside.jpg",
  "images/library/screens/thumb/family-screen-inside.jpg",
  "images/library/screens/family-in-screens-gpt-enhanced.jpg",
  "images/library/screens/thumb/family-in-screens-gpt-enhanced.jpg",
  "images/library/screens/people-in-patio-with-screens-half-way.jpg",
  "images/library/screens/thumb/people-in-patio-with-screens-half-way.jpg",
  "docs/sunesta-spec-sheet.pdf",
  "docs/sunlight-spec-sheet.pdf",
  "docs/sunplus-spec-sheet.pdf",
  "docs/sunstyle-spec-sheet.pdf",
  "docs/sunesta-fabric-collection.pdf",
  "docs/suntex-80-90-samples.pdf",
  "docs/suntex-95-97-samples.pdf"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(TIER1_CACHE)
      .then((cache) => cache.addAll(TIER1_URLS))
      .then(() => self.skipWaiting())
  );
});

// Tier 2 is deliberately NOT in the install event — it must never delay
// Tier 1 being ready. Individual cache.add() calls (not addAll) so one
// missing/failed file doesn't abort the other ~310. Skips files already
// present so re-running this (see the message listener below) after a
// partial first attempt only fetches what's still missing.
async function cacheTier2InBackground(){
  try {
    const cache = await caches.open(TIER2_CACHE);
    const already = new Set((await cache.keys()).map((r) => r.url));
    const missing = TIER2_URLS.filter((u) => !already.has(new URL(u, self.location).href));
    if (!missing.length) return;
    const results = await Promise.allSettled(missing.map((u) => cache.add(u)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) {
      console.warn(`Tier 2 background cache: ${failed}/${missing.length} files failed — will retry on next online app open`);
    }
  } catch (err) {
    console.warn("Tier 2 background cache did not start:", err);
  }
}

// Tier 3 sync: fetch the version probe live; if its `stamp` differs from
// the one in the cached version response (or nothing is cached yet), every
// pricing URL is re-fetched and replace the cache wholesale — a stamp
// covers the engine file too, so an engine-only edit still invalidates the
// catalogs' companions. If the stamp is unchanged, only fill in whatever's
// missing (mirrors Tier 2's top-up behavior). Never throws past this
// function — a failed fetch (offline, Cockpit down) just leaves the
// existing cache in place, and app.js's own online/offline branching
// handles the user-facing state.
async function syncPricingTier(){
  try {
    const liveVerResp = await pricingFetch(`${COCKPIT_BASE}/api/pricing/version`);
    if (!liveVerResp.ok) return;
    const liveVer = await liveVerResp.clone().json();
    // A bad key or disallowed origin answers HTTP 200 + {ok:false} — that
    // has no .stamp, so comparing only verResp.ok would read it as fresher
    // than the cache and overwrite good pricing with the error envelope.
    if (liveVer.ok === false) return;

    const cache = await caches.open(PRICING_CACHE);
    const cachedVerResp = await cache.match(`${COCKPIT_BASE}/api/pricing/version`);
    const cachedVer = cachedVerResp ? await cachedVerResp.json() : null;
    const stale = !cachedVer || cachedVer.stamp !== liveVer.stamp;

    const already = new Set((await cache.keys()).map((r) => r.url));
    const urls = pricingUrls();
    const targets = stale ? urls : urls.filter((u) => !already.has(u));
    if (!targets.length) return;

    const results = await Promise.allSettled(targets.map((u) =>
      (u === `${COCKPIT_BASE}/api/pricing/version` ? Promise.resolve(liveVerResp) : pricingFetch(u))
        .then((r) => { if (!r.ok) throw new Error(`bad status ${r.status} for ${u}`); return cache.put(u, r); })
    ));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) {
      console.warn(`Pricing cache: ${failed}/${targets.length} files failed — will retry on next sync`);
    }
  } catch (err) {
    console.warn("Pricing sync did not run (likely offline):", err);
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== TIER1_CACHE && n !== TIER2_CACHE && n !== PRICING_CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
      .then(() => cacheTier2InBackground())
      .then(() => syncPricingTier())
  );
});

// app.js pings this on every online app open (not just first install) so
// a Tier 2 pass interrupted by spotty wifi — or a version bump that added
// new Tier 2 files — gets picked back up instead of silently staying
// incomplete forever. Same idea for Tier 3 (SYNC_PRICING): also re-checks
// Cockpit's freshness stamp every open, not just on first sync.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CACHE_TIER2") {
    event.waitUntil(cacheTier2InBackground());
  }
  if (event.data && event.data.type === "SYNC_PRICING") {
    event.waitUntil(syncPricingTier());
  }
});

// Cache-first for everything precached (both tiers are static per-version,
// no need to hit the network). ignoreSearch so a cache-busting or tracking
// query string on an otherwise-precached URL still hits the cache instead
// of falling through to the network. Anything not precached — the YouTube
// iframe, any future addition outside both tiers — falls through to the
// network and is intentionally not cached.
//
// Navigation requests (app launch / reload) get an extra fallback to the
// cached shell if nothing matches even with ignoreSearch, so relaunching
// with an unfamiliar URL never hard-fails offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, {ignoreSearch: true}).then((cached) => {
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        return caches.match("index.html").then((shell) => shell || fetch(event.request));
      }
      return fetch(event.request);
    })
  );
});
