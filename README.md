# THE DOGHOUSE — ATHHS Sales Presentation & Training App

The all-product sales asset for Around The House Home Solutions reps: customer-facing
presentations plus rep-only "Training Coach" resources, per product. Sunesta® Awnings
(22-slide deck + Sunesta Coach) and Eclipse® E-Zip Screens (21-slide deck + Eclipse
Coach) are fully built and live; Gutter Helmet® and Louvered Pergolas are registered
shells waiting for content (`PRODUCTS` in `js/registry.js`, flip `ready:true` when a
product ships).

**Live:** https://aroundthehouseco.github.io/the-dog-house/ — GitHub Pages, repo
`AroundTheHouseCo/the-dog-house`, served from `main` `/` (root). Pushing to `main`
redeploys (~30–60s). Installed on iPads via Add to Home Screen (PWA: standalone,
branded icon). Plain HTML/CSS/JS — no build step, no dependencies.

## Architecture

```
index.html           — shell + PWA meta; loads css/js in order
css/styles.css       — all styling, one file
js/images-map.js     — semantic image keys → files in /images (swap photos here)
js/registry.js       — PRODUCT_DATA registry + PRODUCTS list + TRAINING_SHARED (Do & Don't core, Four Sales)
js/data-sunesta.js   — Sunesta content: DECK, TRAINING_REFERENCE → registers PRODUCT_DATA.sunesta
js/data-<key>.js     — one file per product, same shape; registers itself, load order agnostic
js/library-data.js   — GENERATED photo library + docs manifest (asset pipeline output)
js/app.js            — render engine + view routing (touch only for new slide TYPES)
images/              — slide assets, photo library, frame sequences, icons (new products: images/<key>/)
docs/                — spec-sheet + fabric PDFs (Training Center → Docs)
```

**The split is the contract:** content edits live in `js/data-<product>.js`/`images-map.js`
and never require touching `app.js`. Slide numbers (`#N — Title`) are computed from slide
order — never hardcode them anywhere (they drift on every insert/delete).

**Multi-product:** each `js/data-<key>.js` ends with `PRODUCT_DATA.<key> = {deck, training,
logo, brandHTML, photoCats, docs, docsCard}`. `setProduct(key)` in app.js rebinds
`PROD`/`PDECK`/`tabs`/`FLAT_SLIDES`/`libCat`; the picker calls it, boot pins Sunesta.
**Nothing content-derived may be evaluated at script-load time** — that silently pins the
boot product (this was the original single-product coupling). Renderer brand/warranty
strings are data fields with Sunesta-exact fallbacks (`s.sub`, `s.triLabel`, `mo.heroChip`,
`mo.warrantyTiles`, `mc.title`, `mc.columns`, `cmp.title`, `n.logo`/`PROD.logo`) — a new
product overrides them in data, Sunesta needs no data entries. A product is enterable only
when `ready:true` in PRODUCTS **and** its PRODUCT_DATA entry exists; the shared Do & Don't
core lives in `TRAINING_SHARED` and each product's `training.doDont` lists are appended.

**View state machine** (`appView` in app.js): `home` → `present-picker`/`center-picker`
(per-product) → `present` (customer-facing deck) or `center` (Training Coach hub:
deck-with-notes, 10-Step Process, Pre-Demo Recap, Do & Don't, FAQs, Pricing & Close,
Photo Library, Docs). **Customer mode must never show training UI** — no "training",
"coach", "script", or "rep-only" text may be visible; verify with a DOM text sweep, not
by eyeballing. Training Mode reads script/coaching/beats from each product's own
content JSON (`data/doghouse-content-v1.json`, `data/training-content-eclipse.json`),
joined to the deck via that file's `deck_map` — content edits happen in the JSON, never
in `js/data-<product>.js`. A dormant per-slide `script`/`talkingPoints`/`coach` fallback
still lives on the Sunesta deck object for a failed or in-flight content fetch (see
`renderRehearsal()` in `js/app.js`); Eclipse's copy was retired in its 2026-08 rebuild,
so that fallback path is Sunesta-only now.

**Slide types** (all data-driven): videoloop (YouTube segment loop), splittext/splitphoto
(optional `cert`, `scrub` mini-video-scrubber, `docViewer` in-app document book),
herosplit, photogrid, credibility, difference, triangle, reasonsphoto (pill hotspots w/
popup photos), reasonsgrid (`columns:1` variant), productcards (photo cards; `num` chips,
`popPhoto` popovers, `eyebrow`, auto-`dense` grid when >3 rows), models (spec popups +
3-model compare + competitor chart), videoscrub (frame-sequence scrubber), processsteps
(icon timeline), warrantyrecap (tiles + interactive triangle + service strip).
**New-type bar:** only add a type when every existing one demonstrably fails.

## The z-index / stacking-context trap (has bitten repeatedly)

Invisible tap-to-advance nav zones sit at **z-index 5** over most slides. Any
`clip-path`, `transform`, `opacity<1`, or `filter` on a *container* of clickable
children creates a stacking context that silently traps them below the nav zones.

Layer map: nav zones **5** · interactive children (pills, cards, tri-nodes) **6–10** ·
popovers **20** · modals/fullscreen popups **30** · slide-number badge **50** ·
in-app doc viewer **60** (covers the badge deliberately).

Rules: interactive *containers* stay free of those four properties; interactive
*children* get explicit z-index ≥6; `photogrid` and `models` have **no nav zones by
design** (arrows/dots only). Fullscreen headers need top padding (~46px) or the #N
badge overlaps them.

## Verification standard (every change)

1. `node --check` all touched JS.
2. Walk **all** slides in both customer and training modes: every slide has its badge,
   no `img` with missing/`undefined` src, zero console errors/warnings.
3. Hit-test every touched interactive slide with `document.elementFromPoint()` at real
   coordinates — programmatic `.click()` bypasses the stacking bug you're checking for.
   Confirm: element receives the tap AND empty space still advances.
4. Screenshot anything structurally new for review before it ships.
5. After push: poll the live URL until the change lands, `diff` live files vs committed
   (`git show HEAD:path` vs `curl`), and spot-check new assets return 200 with correct
   MIME types. Pages caches ~10 min — hard-refresh the iPad after deploys.

### The service worker will serve you stale files while you test

**This has burned three separate rounds. It is not a browser bug or a preview-tool bug —
it's `sw.js` working exactly as designed**, and the same offline-first behaviour reps
depend on in a basement with no signal:

- The fetch handler is **cache-first**: `caches.match(request, {ignoreSearch: true})`
  returns the cached copy and never revalidates.
- `{ignoreSearch: true}` means **`?bust=123` cannot work.** A cache-busting query string
  matches the same cached entry. Don't reach for it; it will silently lie to you.
- The cache lives in the **browser**, so restarting the preview server, opening a fresh
  tab, or `location.reload()` all change nothing.
- `curl` bypasses the SW entirely, which is why curl and the app disagree. **curl tells
  you what the server has; only an in-page fetch tells you what the app sees.** Both are
  useful — don't treat curl agreement as proof the app is fixed.

**Do this instead** (order matters — clearing *before* you edit is the classic mistake:
the SW re-precaches on the next load and you're stale again):

1. Edit the file. 2. Sync it to the preview mirror. 3. *Then* clear:

```js
(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const k of await caches.keys()) await caches.delete(k); })()
```

4. Reload.

**Faster alternative:** bump `TIER1_VERSION` in `sw.js` *before* browser testing. The
version is the cache *name*, so changing it orphans the old cache and forces a fresh
precache — which is the same bump the change needs before shipping anyway.

**When you can't get a trustworthy read** (rare, and you've already done the above): inject
the rule as an inline `<style>` and measure real layout — inline styles never touch the
network or the SW. Verify data-only edits (JSON/doc strings) with direct file reads instead
of the browser; they have no rendering path worth booting a browser for.

## Design language

- Palette via CSS vars: `--green-dark #1b5e3f`, `--green #2e7d4f`, `--orange #F5A623`,
  charcoal/cream/bg (see `:root`). Em-dash-heavy, plain-spoken copy.
- **Native SVG over screenshots** — never bake text into raster images. Icon style:
  200×200 viewBox, `#eef6ee` rounded-18 background, green/orange strokes.
- Recurring motifs: green chevron divider, ATH footer banner, pill hotspots, warranty
  tiles (`.wt`), numbered chips. GitHub Pages is **case-sensitive** and serves from a
  subpath — asset paths stay lowercase and **relative** (never leading-slash).

## Content rules (binding — see the script doc + project memory for rulings)

- Source of truth for Sunesta copy: `Sunesta Awning Master Script — FINAL DRAFT
  2026-07-14.md` (Rev 2, Desktop) — use its language verbatim, don't paraphrase.
- Warranty per the 2026 doc: frame lifetime · arms Sunesta lifetime / Sunstyle 15yr /
  Sunlight 12yr · fabric 10yr · motor 10yr · electronics 5yr. Wind sensor is **standard**
  on motorized units, never an add-on.
- Unverified claims (NC/FL manufacturing, 80k cycles, wind-sensor mechanism) stay OUT of
  customer-facing copy — training scripts only, prefixed `⚠️ UNVERIFIED`.
- Rep-facing pricing (drop-screen motor ~$1k, LED return-trip, rebuttal scripts) lives in
  `script`/`coach` fields only, never in bullets/labels customers see.
- CC-licensed photos require credits (kept as comments in `js/data.js`).

## Known gaps / backlog

- Reference Map slide ships a labeled placeholder — real map asset pending.
- Pending from Matt: crossarms explainer, drop-screen selling points, high-end price
  rebuttal ending, competitor estimate photos. Money Fork / Thermometer Close: blocked
  until Jack supplies the Profectus material.
- DoY/Our People slide is a marked first draft. Awaiting real crew photo, lit-awning
  night shot, myLink app screenshots.
- Eclipse E-Zip deck shipped (14-slide deck + Eclipse Coach). Open follow-ups: Slide 11
  gallery could gain a videoscrub if Jack supplies landscape footage; 12-month "Shade
  Service" stays coach-only until confirmed; minor copy picks (Front Range vs Southern
  Colorado, customer-count phrasing) flagged for Jack's on-sight correction.
- Gutter Helmet / Pergola decks + coaches: shells only.
- Cross-device training content sync — edits currently save to localStorage per device;
  sync requires a Cockpit-proxy write-back to the content JSON files, scoped as a future
  round. "Export Content" (Training Coach, Edit Mode) is the bridge until then: download
  the merged file and commit it by hand.
- Someday: native app wrap (Capacitor).
