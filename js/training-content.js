// Training content adapter — one JSON file per product, plus one small
// shared file for content that's genuinely ATH-wide (see tcSequence below).
//
// THE ONE RULE (DOGHOUSE_BUILD_SPEC.md): the content files are the single
// source of truth and are rendered VERBATIM. Nothing in this file
// paraphrases, summarises, truncates, reflows or "improves" any string
// value. The only transformation performed anywhere is {{TOKEN}}
// substitution, which the spec explicitly asks for. Content changes happen
// in the JSON, never here.
//
// AUTHORITY RULE (spec v1.1):
//   The live deck (js/data-<product>.js) owns slide ORDER and SECTION
//   membership. A product's content JSON owns CONTENT. They join by id via
//   that content file's own `deck_map` — an explicit hand-verified map
//   rather than a positional or slide_number-based lookup, because a deck
//   has been reordered before (Drop Screen moved AWNINGS -> SMART
//   TECHNOLOGY) and will be again. An explicit map survives that; an index
//   does not.
//
// PRODUCT-AGNOSTIC ENGINE (training-mode-v2 Phase 2): this file used to
// hardcode a single covered product (TC_PRODUCT = "sunesta") and a single
// global TRAINING_CONTENT. Both products now ship a content file
// (PROD.trainingContentFile, set in each js/data-<product>.js), loaded and
// cached per product, so a future product (Gutter Helmet, Louvered
// Pergolas) needs only its own deck file + its own content JSON + a
// registry entry — no changes here.
//
// A content JSON carries ZERO render keys — no type/image/hotspots/models.
// It cannot and must not drive the customer-facing deck. It replaces only
// the training slice of each slide.

// productKey -> {content, byId, varsByKey} once settled, or null if that
// product has no trainingContentFile / it failed to load. Absent = never
// requested yet.
let TC_CACHE = {};
let TC_INFLIGHT = {};

// Genuinely cross-product content (e.g. the 10-step sales process) lives in
// one shared file instead of being owned by one product and aliased by
// another — see tcSequence(). undefined = not yet loaded, null = failed.
let TC_SHARED;
function loadSharedContent(){
  return fetch("data/training-content-shared.json", {cache:"no-cache"})
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { TC_SHARED = d || null; })
    .catch(() => { TC_SHARED = null; });
}

function indexContent(content){
  const byId = {};
  for (const s of content.slides || []) byId[s.slide_id] = s;
  for (const m of content.modules || []) byId[m.module_id] = m;
  const varsByKey = {};
  for (const v of content.variables || []) varsByKey[v.key] = v;
  return { content, byId, varsByKey };
}

// Fetches + indexes a product's content file if not already cached or in
// flight; resolves to the cache entry (or null) either way. Safe to call
// repeatedly — setProduct() calls this on every product switch.
function tcEnsureProductContent(productKey){
  if (productKey in TC_CACHE) return Promise.resolve(TC_CACHE[productKey]);
  if (TC_INFLIGHT[productKey]) return TC_INFLIGHT[productKey];
  const file = (PRODUCT_DATA[productKey] || {}).trainingContentFile;
  if (!file) { TC_CACHE[productKey] = null; return Promise.resolve(null); }
  const p = fetch(file, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const content = (json && Array.isArray(json.slides) && json.slides.length) ? json : null;
      TC_CACHE[productKey] = content ? indexContent(content) : null;
      delete TC_INFLIGHT[productKey];
      if (content) tcAuditMapping(productKey);
      if (typeof onTrainingContentReady === "function") onTrainingContentReady();
      return TC_CACHE[productKey];
    })
    .catch(() => {
      TC_CACHE[productKey] = null;
      delete TC_INFLIGHT[productKey];
      if (typeof onTrainingContentReady === "function") onTrainingContentReady();
      return null;
    });
  TC_INFLIGHT[productKey] = p;
  return p;
}

function tcActive(){ return TC_CACHE[activeProduct] || null; }
function tcReady(){ return !!tcActive(); }
// Distinguishes "still loading" (key not yet in TC_CACHE) from "settled and
// failed" (key present, value null) — used only for the legacy-fallback
// warning banner, so a slow fetch doesn't briefly flash a false failure.
function tcLoadFailed(){
  return (activeProduct in TC_CACHE) && TC_CACHE[activeProduct] === null
    && !!(PRODUCT_DATA[activeProduct] || {}).trainingContentFile;
}

// DECK_TO_CONTENT (now each content file's own `deck_map`) is a manual
// artifact, which means it can rot: a slide added to the deck without a map
// entry would silently fall back to stale pre-overhaul content — the worst
// failure mode for a training tool. This audit runs once per product, as
// soon as that product's content settles, and screams to the console about
// (a) covered-deck slides with no map entry, (b) map entries pointing at
// ids that don't exist in the content file, and (c) stale map keys for
// deck slides that no longer exist. The admin Flags view surfaces the same
// list for the active product.
function tcAuditMapping(productKey, opts){
  productKey = productKey || activeProduct;
  const problems = [];
  const cache = TC_CACHE[productKey];
  const prod = (typeof PRODUCT_DATA === "object") && PRODUCT_DATA[productKey];
  if (cache && prod && prod.deck) {
    const deckMap = cache.content.deck_map || {};
    const deckIds = [];
    for (const tab of Object.keys(prod.deck)) for (const sl of prod.deck[tab]) {
      deckIds.push(sl.id);
      if (!(sl.id in deckMap))
        problems.push(`deck slide "${sl.id}" (${tab}) has no deck_map entry — reps see a visible gap, not stale content`);
      else if (!cache.byId[deckMap[sl.id]])
        problems.push(`deck slide "${sl.id}" maps to "${deckMap[sl.id]}", which does not exist in the content file`);
    }
    for (const k of Object.keys(deckMap))
      if (!deckIds.includes(k))
        problems.push(`deck_map has an entry for "${k}", which is no longer in the deck (stale after a slide removal?)`);
  }
  if (problems.length && !(opts && opts.silent))
    console.error(`TRAINING CONTENT MAPPING PROBLEMS (${productKey}, js/training-content.js):\n  - ` + problems.join("\n  - "));
  return problems;
}
function tcEntry(id){ const a = tcActive(); return (a && a.byId[id]) || null; }
function tcModule(){ const a = tcActive(); return (a && a.content.modules && a.content.modules[0]) || null; }
function tcForDeckSlide(deckId){
  const a = tcActive();
  if (!a) return null;
  const contentId = (a.content.deck_map || {})[deckId];
  return contentId ? (a.byId[contentId] || null) : null;
}

// A named sequence (currently just "ten_steps"): the active product's own
// content may define its own sequences.<key> to override; absent that,
// every product falls back to the shared file. Same resolution shape as
// tcValues() (committed default, then override) — applied to content
// instead of variable values. This is what replaced Eclipse's old
// `tenSteps: TRAINING_REFERENCE.tenSteps` object-reference alias: previously
// editing "Sunesta's" copy silently changed Eclipse's too, because it was
// the same JS object; now there is genuinely one committed resource, and
// neither product can accidentally mutate the other's view of it.
function tcSequence(key){
  const a = tcActive();
  const own = a && a.content.sequences && a.content.sequences[key];
  if (own) return own;
  return (TC_SHARED && TC_SHARED.sequences && TC_SHARED.sequences[key]) || null;
}

// The full ordered training walk. Order and section labels come from the
// DECK (authority rule); prep items (declared per-product via
// content.prep_ids — Sunesta has 2, Eclipse has none) lead, and the pricing
// module is appended as an explicit special case — it lives in modules[],
// not slides[], so no slide lookup can ever return it. Reference-only
// entries (ref_dodont, ref_close, ref_predemo, ref_faq — in_deck:false,
// NOT in prep_ids) are deliberately excluded: they're reached from their
// own Training Center hub cards, not the sequential walk.
function tcWalk(){
  const a = tcActive();
  if (!a) return [];
  const prepIds = a.content.prep_ids || [];
  const out = prepIds
    .filter((id) => a.byId[id])
    .map((id) => ({ kind: "slide", id, section: "Before You Start", entry: a.byId[id], deckId: null }));

  if (typeof PDECK === "object" && typeof tabs !== "undefined") {
    for (const tab of tabs) {
      for (const s of PDECK[tab]) {
        const e = tcForDeckSlide(s.id);
        if (e) out.push({ kind: "slide", id: e.slide_id, section: tab, entry: e, deckId: s.id });
      }
    }
  }
  const m = tcModule();
  if (m) out.push({ kind: "module", id: m.module_id, section: "Pricing & Close", entry: m, deckId: null });
  return out;
}

// --------------------------------------------------------- variables ----
// Two tiers, deliberately:
//
//   company_settings  -> data/company-settings.json, COMMITTED and deployed.
//        These are company values, not per-rep values. Left on per-device
//        storage, two reps enter two different price ranges and slide 22
//        teaches two different things at two different kitchen tables — the
//        same drift the authority rule exists to prevent.
//
//   rep_profile / discovery / measure / proposal -> localStorage, per device.
//        Correctly per-person and per-appointment, and shared across
//        whichever product is active in one appointment — a rep's name
//        doesn't change between a Sunesta demo and an Eclipse demo on the
//        same visit, so unlike content edits (see training-render.js /
//        TC_CONTENT_EDITS_KEY) these are NOT namespaced per product.
//
// A rep may still override a company value locally for one appointment; the
// setup form shows when a value differs from the committed default and
// offers a one-tap revert. Resolution order is local-override -> committed
// default -> unset (visible placeholder chip).
let TC_COMPANY = null;          // null until the file loads (or if it 404s)
function loadCompanySettings(){
  return fetch("data/company-settings.json", {cache:"no-cache"})
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { TC_COMPANY = (d && d.values) || {}; })
    .catch(() => { TC_COMPANY = {}; });
}
function tcCompanyDefault(key){
  return (TC_COMPANY && typeof TC_COMPANY[key] === "string" && TC_COMPANY[key] !== "")
    ? TC_COMPANY[key] : "";
}
// True when the rep has set a local value that differs from the committed one.
function tcIsOverridden(key){
  const a = tcActive();
  if (!a || (a.varsByKey[key] || {}).source !== "company_settings") return false;
  const local = tcLocalValues()[key];
  return !!local && local !== tcCompanyDefault(key);
}

const TC_VALUES_KEY = "doghouse.training.values";
// Raw per-device storage — what the rep actually typed on this iPad.
function tcLocalValues(){
  try { return JSON.parse(localStorage.getItem(TC_VALUES_KEY) || "{}"); }
  catch { return {}; }
}
// The resolved view every renderer uses: committed company defaults first,
// then anything set on this device on top.
function tcValues(){
  const out = {};
  if (TC_COMPANY) for (const [k, v] of Object.entries(TC_COMPANY)) if (v) out[k] = v;
  return Object.assign(out, tcLocalValues());
}
function tcSetValue(key, val){
  const v = tcLocalValues();
  if (val === "" || val == null) delete v[key]; else v[key] = val;
  localStorage.setItem(TC_VALUES_KEY, JSON.stringify(v));
}
function tcClearAppointment(){
  const a = tcActive();
  const v = tcLocalValues(), keep = {};
  for (const [k, val] of Object.entries(v)) {
    const src = a && (a.varsByKey[k] || {}).source;
    if (src === "rep_profile" || src === "company_settings") keep[k] = val;
  }
  localStorage.setItem(TC_VALUES_KEY, JSON.stringify(keep));
}
function tcVarsBySource(src){
  const a = tcActive();
  return a ? Object.values(a.varsByKey).filter((v) => v.source === src) : [];
}
// Declared NOT_SET in the active product's content *and* still not filled
// in locally.
function tcUnsetVars(){
  const a = tcActive();
  if (!a) return [];
  const vals = tcValues();          // resolved: committed default + local
  return Object.values(a.varsByKey).filter((v) => v.status === "NOT_SET" && !vals[v.key]);
}

// Resolve {{TOKEN}} against stored values. Unfilled tokens become a visible
// placeholder chip carrying the variable's own label — never raw braces,
// never blank space (spec, Variables §2).
const tcEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
function tcResolve(text){
  if (typeof text !== "string") return "";
  const vals = tcValues();
  const a = tcActive();
  return tcEsc(text).replace(/\{\{([A-Z_0-9]+)\}\}/g, (raw, key) => {
    const v = vals[key];
    if (v) return `<span class="tc-var-filled">${tcEsc(v)}</span>`;
    const varDef = a && a.varsByKey[key];
    const label = (varDef && varDef.label) || key;
    const unset = varDef && varDef.status === "NOT_SET";
    return `<span class="tc-var-chip${unset ? " unset" : ""}" title="${tcEsc(
      unset ? "Not set — admin needs to fill this in" : "Fill in during discovery")}">[${tcEsc(label)}]</span>`;
  });
}

// ------------------------------------------------------------- search ----
// title + every script paragraph + the module's reactive_scripts questions
// (spec, Navigation §4).
function tcSearch(q){
  if (!tcReady() || !q || q.trim().length < 2) return [];
  const needle = q.trim().toLowerCase();
  const hits = [];
  for (const node of tcWalk()) {
    const e = node.entry;
    const found = [];
    if ((e.title || "").toLowerCase().includes(needle)) found.push({ where:"Title", text:e.title });
    const groups = e.blocks || e.phases || [];
    for (const g of groups) {
      for (const line of g.script || []) {
        if (line.toLowerCase().includes(needle)) found.push({ where:g.label || "Script", text:line });
      }
    }
    for (const r of e.reactive_scripts || []) {
      if ((r.question || "").toLowerCase().includes(needle)) found.push({ where:"Q&A", text:r.question });
    }
    if (found.length) hits.push({ node, matches:found });
  }
  return hits;
}

// -------------------------------------------------------------- admin ----
function tcAllFlags(){
  const a = tcActive();
  if (!a) return [];
  const rank = { high:0, medium:1, low:2 };
  const rows = [];
  for (const s of a.content.slides || []) for (const f of s.flags || []) rows.push({ ...f, on:s.slide_id, title:s.title });
  for (const m of a.content.modules || []) for (const f of m.flags || []) rows.push({ ...f, on:m.module_id, title:m.title });
  return rows.sort((a2, b2) => (rank[a2.severity] ?? 9) - (rank[b2.severity] ?? 9));
}
function tcOpenItems(){ const a = tcActive(); return (a && a.content.open_items) || []; }

// activeProduct/setProduct() are declared in js/app.js, which loads AFTER
// this file (see index.html) — this file must not reference activeProduct
// at its own top level, only from inside functions called later. setProduct()
// calls tcEnsureProductContent(key) itself on every product bind/rebind,
// including the initial boot bind, so nothing needs to kick off here beyond
// the two files that aren't product-specific.
loadSharedContent();
loadCompanySettings();
