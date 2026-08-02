// Training content adapter — data/doghouse-content-v1.json.
//
// THE ONE RULE (DOGHOUSE_BUILD_SPEC.md): that JSON is the single source of
// truth and is rendered VERBATIM. Nothing in this file paraphrases,
// summarises, truncates, reflows or "improves" any string value. The only
// transformation performed anywhere is {{TOKEN}} substitution, which the
// spec explicitly asks for. Content changes happen in the JSON, never here.
//
// AUTHORITY RULE (spec v1.1):
//   The live deck (js/data-sunesta.js) owns slide ORDER and SECTION
//   membership. This JSON owns CONTENT. They join by id.
//
// That is why DECK_TO_CONTENT below is an explicit hand-verified map rather
// than a positional or slide_number-based lookup. The JSON's slide_number
// happens to match the deck's current order today, but the deck has been
// reordered before (Drop Screen moved AWNINGS -> SMART TECHNOLOGY) and will
// be again. An explicit map survives that; an index does not.
//
// The JSON carries ZERO render keys — no type/image/hotspots/models. It
// cannot and must not drive the customer-facing deck. It replaces only the
// training slice of each slide.

// undefined = still loading · null = not shipped/failed · object = loaded
let TRAINING_CONTENT;

// Which product's deck this content file covers. The mapping audit and the
// rehearsal panel's "missing content" state apply ONLY to this product —
// every other product (Eclipse today) legitimately has no JSON content and
// keeps the legacy data-<product>.js training fields.
const TC_PRODUCT = "sunesta";

// deck slide id (js/data-sunesta.js)  ->  JSON slide_id
// Verified 1:1 by title against all 22 in-deck slides.
const DECK_TO_CONTENT = {
  introvideo: "s01",  dealer:     "s02",  products:  "s03",  training:   "s04",
  doypeople:  "s05",  local:      "s06",  difference:"s07",  badges:     "s08",
  process:    "s09",  refmap:     "s10",  tenreasons:"s11",  reasons:    "s12",
  scrub:      "s13",  models:     "s14",  fabrics:   "s15",  smarttitle: "s16",
  dropscreen: "s17",  mylink:     "s18",  sensors:   "s19",  led:        "s20",
  warrantyrecap: "s21", pricecond: "s22",
};

// Training-only items: real content with no Canva/deck counterpart
// (in_deck:false). They exist only in the standalone Training Coach walk.
const CONTENT_PREP_IDS = ["prep_recap", "preframe"];

// ---------------------------------------------------------------- load ----
function loadTrainingContent(){
  // company settings are fetched in parallel; this awaits them so the first
  // render already has the committed defaults resolved
  return loadCompanySettings().then(() => fetch("data/doghouse-content-v1.json", {cache:"no-cache"}))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      TRAINING_CONTENT = (d && Array.isArray(d.slides) && d.slides.length) ? d : null;
      if (TRAINING_CONTENT) { indexContent(); tcAuditMapping(); }
      if (typeof onTrainingContentReady === "function") onTrainingContentReady();
    })
    .catch(() => {
      TRAINING_CONTENT = null;
      if (typeof onTrainingContentReady === "function") onTrainingContentReady();
    });
}

let _byId = {}, _varsByKey = {};
function indexContent(){
  _byId = {};
  for (const s of TRAINING_CONTENT.slides) _byId[s.slide_id] = s;
  for (const m of TRAINING_CONTENT.modules || []) _byId[m.module_id] = m;
  _varsByKey = {};
  for (const v of TRAINING_CONTENT.variables || []) _varsByKey[v.key] = v;
}

function tcReady(){ return !!(TRAINING_CONTENT && TRAINING_CONTENT.slides); }

// DECK_TO_CONTENT is a manual artifact, which means it can rot: a slide
// added to the deck without a map entry would silently fall back to stale
// pre-overhaul content — the worst failure mode for a training tool. This
// audit runs once at load and screams to the console about (a) covered-deck
// slides with no map entry, (b) map entries pointing at slide_ids that
// don't exist in the content file, and (c) stale map keys for deck slides
// that no longer exist. The admin Flags view surfaces the same list.
function tcAuditMapping(opts){
  const problems = [];
  const prod = (typeof PRODUCT_DATA === "object") && PRODUCT_DATA[TC_PRODUCT];
  if (prod && prod.deck) {
    const deckIds = [];
    for (const tab of Object.keys(prod.deck)) for (const sl of prod.deck[tab]) {
      deckIds.push(sl.id);
      if (!(sl.id in DECK_TO_CONTENT))
        problems.push(`deck slide "${sl.id}" (${tab}) has no DECK_TO_CONTENT entry — reps see a visible gap, not stale content`);
      else if (!_byId[DECK_TO_CONTENT[sl.id]])
        problems.push(`deck slide "${sl.id}" maps to "${DECK_TO_CONTENT[sl.id]}", which does not exist in the content file`);
    }
    for (const k of Object.keys(DECK_TO_CONTENT))
      if (!deckIds.includes(k))
        problems.push(`DECK_TO_CONTENT has an entry for "${k}", which is no longer in the deck (stale after a slide removal?)`);
  }
  if (problems.length && !(opts && opts.silent))
    console.error("TRAINING CONTENT MAPPING PROBLEMS (js/training-content.js):\n  - " + problems.join("\n  - "));
  return problems;
}
function tcEntry(id){ return _byId[id] || null; }
function tcModule(){ return (TRAINING_CONTENT && TRAINING_CONTENT.modules && TRAINING_CONTENT.modules[0]) || null; }
function tcForDeckSlide(deckId){ return tcReady() ? (_byId[DECK_TO_CONTENT[deckId]] || null) : null; }

// The full ordered training walk. Order and section labels come from the
// DECK (authority rule); the prep items lead, and the pricing module is
// appended as an explicit special case — it lives in modules[], not
// slides[], so no slide lookup can ever return it.
function tcWalk(){
  if (!tcReady()) return [];
  const out = CONTENT_PREP_IDS
    .filter((id) => _byId[id])
    .map((id) => ({ kind:"slide", id, section:"Before You Start", entry:_byId[id], deckId:null }));

  if (typeof PDECK === "object" && typeof tabs !== "undefined") {
    for (const tab of tabs) {
      for (const s of PDECK[tab]) {
        const e = tcForDeckSlide(s.id);
        if (e) out.push({ kind:"slide", id:e.slide_id, section:tab, entry:e, deckId:s.id });
      }
    }
  }
  const m = tcModule();
  if (m) out.push({ kind:"module", id:m.module_id, section:"Pricing & Close", entry:m, deckId:null });
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
//        Correctly per-person and per-appointment.
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
  if ((_varsByKey[key] || {}).source !== "company_settings") return false;
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
  const v = tcLocalValues(), keep = {};
  for (const [k, val] of Object.entries(v)) {
    const src = (_varsByKey[k] || {}).source;
    if (src === "rep_profile" || src === "company_settings") keep[k] = val;
  }
  localStorage.setItem(TC_VALUES_KEY, JSON.stringify(keep));
}
function tcVarsBySource(src){ return (TRAINING_CONTENT.variables || []).filter((v) => v.source === src); }
// Declared NOT_SET in the JSON *and* still not filled in locally.
function tcUnsetVars(){
  const vals = tcValues();          // resolved: committed default + local
  return (TRAINING_CONTENT.variables || []).filter((v) => v.status === "NOT_SET" && !vals[v.key]);
}

// Resolve {{TOKEN}} against stored values. Unfilled tokens become a visible
// placeholder chip carrying the variable's own label — never raw braces,
// never blank space (spec, Variables §2).
const tcEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
function tcResolve(text){
  if (typeof text !== "string") return "";
  const vals = tcValues();
  return tcEsc(text).replace(/\{\{([A-Z_0-9]+)\}\}/g, (raw, key) => {
    const v = vals[key];
    if (v) return `<span class="tc-var-filled">${tcEsc(v)}</span>`;
    const label = (_varsByKey[key] && _varsByKey[key].label) || key;
    const unset = _varsByKey[key] && _varsByKey[key].status === "NOT_SET";
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
  if (!tcReady()) return [];
  const rank = { high:0, medium:1, low:2 };
  const rows = [];
  for (const s of TRAINING_CONTENT.slides) for (const f of s.flags || []) rows.push({ ...f, on:s.slide_id, title:s.title });
  for (const m of TRAINING_CONTENT.modules || []) for (const f of m.flags || []) rows.push({ ...f, on:m.module_id, title:m.title });
  return rows.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
}
function tcOpenItems(){ return (tcReady() && TRAINING_CONTENT.open_items) || []; }

loadTrainingContent();
