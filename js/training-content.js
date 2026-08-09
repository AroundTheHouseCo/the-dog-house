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

// A named shared reference block (do_dont, four_sales — the ATH/Profectus
// core that used to be the TRAINING_SHARED const in js/registry.js). Same
// override shape as tcSequence(): a product's own content may define
// reference.<key> to override; absent that, every product falls back to
// the shared file. Split into its own function rather than overloading
// tcSequence() because "sequence" (an ordered step list) and "reference
// block" (do_dont's two lists, four_sales's intro/items/footer) are
// different shapes — same resolution mechanics, different data.
function tcSharedRef(key){
  const a = tcActive();
  const own = a && a.content.reference && a.content.reference[key];
  if (own) return own;
  return (TC_SHARED && TC_SHARED.reference && TC_SHARED.reference[key]) || null;
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

// -------------------------------------------------- content editing ----
// training-mode-v2 Phase 2. A "content path" identifies one editable text
// field as `${entryId}::${dotted.path}` — entryId is a slide_id/module_id
// (tcEntry() resolves either) or the synthetic id `seq:<key>` for a shared
// sequence (tcSequence() — see below), so the SAME path scheme covers both
// lookup mechanisms. dotted.path descends the entry with plain numeric
// indices for arrays (e.g. "blocks.1.script.0"), so it can also be used
// directly to write the edit back into a full copy of the content file on
// export — same path in, same path out, no separate manifest to keep in
// sync with what the renderers actually walk.
function tcGetByPath(obj, fieldPath){
  return fieldPath.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function tcSetByPath(obj, fieldPath, value){
  const keys = fieldPath.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur == null || cur[keys[i]] == null) return false; // path stale (schema changed under it) — drop silently, never throw on export
    cur = cur[keys[i]];
  }
  if (cur == null) return false;
  cur[keys[keys.length - 1]] = value;
  return true;
}
// The object an entryId resolves against for read/write-back — same three
// lookup mechanisms tcEntry()/tcSequence()/tcSharedRef() already use,
// unified here so a content path never needs to know which one applies.
function tcPathRoot(entryId){
  if (!entryId) return null;
  if (entryId.startsWith("seq:")) return tcSequence(entryId.slice(4));
  if (entryId.startsWith("ref:")) return tcSharedRef(entryId.slice(4));
  return tcEntry(entryId);
}
function tcRawFieldValue(entryId, fieldPath){
  const root = tcPathRoot(entryId);
  return root ? tcGetByPath(root, fieldPath) : undefined;
}

const TC_EDITS_KEY = "doghouse.training.contentEdits";
// {[productKey]: {"<entryId>::<fieldPath>": "edited text", ...}} — namespaced
// per product (not just per device) because a local edit to nominally
// shared content (e.g. the ten-step sequence, viewed from one product's
// Coach) must NOT leak into the other product's view. See training-content.js's
// tcSequence() comment for why the committed layer is shared but the edit
// layer deliberately is not.
function tcAllContentEdits(){
  try { return JSON.parse(localStorage.getItem(TC_EDITS_KEY) || "{}"); }
  catch { return {}; }
}
function tcContentEdits(){ return tcAllContentEdits()[activeProduct] || {}; }
function tcContentPath(entryId, fieldPath){ return `${entryId}::${fieldPath}`; }
function tcIsFieldEdited(entryId, fieldPath){
  return tcContentPath(entryId, fieldPath) in tcContentEdits();
}
// The value actually shown: this device's local edit for this product, if
// any, else whatever's in the committed content file. Same resolution
// order as tcValues() (local override -> committed default), same reason.
function tcFieldValue(entryId, fieldPath){
  const key = tcContentPath(entryId, fieldPath);
  const edits = tcContentEdits();
  return (key in edits) ? edits[key] : tcRawFieldValue(entryId, fieldPath);
}
function tcSetContentEdit(entryId, fieldPath, value){
  const all = tcAllContentEdits();
  const key = tcContentPath(entryId, fieldPath);
  const original = tcRawFieldValue(entryId, fieldPath);
  if (!all[activeProduct]) all[activeProduct] = {};
  if (value == null || value === original) delete all[activeProduct][key];
  else all[activeProduct][key] = value;
  if (!Object.keys(all[activeProduct]).length) delete all[activeProduct];
  localStorage.setItem(TC_EDITS_KEY, JSON.stringify(all));
}
// Resolved display HTML for one field — escaped, {{TOKEN}}-aware, same as
// tcResolve — WITHOUT the editable wrapper. Exists as its own step only
// for the rare field (coaching_note) that needs to post-process the
// resolved HTML (split it into paragraphs) before the editable span goes
// around the outside; every other call site should use tcField() below.
function tcFieldHTML(entryId, fieldPath){
  const val = tcFieldValue(entryId, fieldPath);
  return (val == null || val === "") ? "" : tcResolve(String(val));
}
// Tags innerHTML with the content path so the edit-mode UI
// (js/training-coach.js) can find, focus and persist it on tap.
function tcEditWrap(entryId, fieldPath, innerHTML){
  const edited = tcIsFieldEdited(entryId, fieldPath) ? " tc-edited" : "";
  return `<span class="tc-editable${edited}" data-tc-path="${tcEsc(tcContentPath(entryId, fieldPath))}">${innerHTML}</span>`;
}
// Renders one editable text field end to end: resolve + wrap. Every call
// site that used to read tcResolve(x) directly reads
// tcField(entryId, "field.path") instead — the only behavioural difference
// when not in edit mode is the wrapping <span>.
function tcField(entryId, fieldPath){
  const html = tcFieldHTML(entryId, fieldPath);
  return html ? tcEditWrap(entryId, fieldPath, html) : "";
}

// Deep-merges every local edit for the ACTIVE product onto a fresh copy of
// its committed content file — this is the "Export Content" action's data
// step (js/training-coach.js does the download). Edits targeting a shared
// sequence or reference block (seq:<key> / ref:<key>) materialize as that
// product's own sequences.<key> / reference.<key> override in the exported
// file, which is the correct, intended effect of editing nominally-shared
// content from one product's Coach: it's no longer aliased, it's now this
// product's explicit copy.
function tcExportContent(){
  const a = tcActive();
  if (!a) return null;
  const merged = JSON.parse(JSON.stringify(a.content));
  for (const [key, value] of Object.entries(tcContentEdits())) {
    const sep = key.indexOf("::");
    const entryId = key.slice(0, sep), fieldPath = key.slice(sep + 2);
    if (entryId.startsWith("seq:")) {
      const seqKey = entryId.slice(4);
      merged.sequences = merged.sequences || {};
      merged.sequences[seqKey] = merged.sequences[seqKey] || JSON.parse(JSON.stringify(tcSequence(seqKey) || {}));
      tcSetByPath(merged.sequences[seqKey], fieldPath, value);
      continue;
    }
    if (entryId.startsWith("ref:")) {
      const refKey = entryId.slice(4);
      merged.reference = merged.reference || {};
      merged.reference[refKey] = merged.reference[refKey] || JSON.parse(JSON.stringify(tcSharedRef(refKey) || {}));
      tcSetByPath(merged.reference[refKey], fieldPath, value);
      continue;
    }
    const entry = (merged.slides || []).find((s) => s.slide_id === entryId)
      || (merged.modules || []).find((m) => m.module_id === entryId);
    if (entry) tcSetByPath(entry, fieldPath, value);
  }
  return merged;
}

// ------------------------------------------------------------- search ----
// title + every script paragraph + the module's reactive_scripts questions
// (spec, Navigation §4).
// Searches the same merged view rendering uses — local edit overlay first,
// else committed text (tcFieldValue) — never the raw committed JSON
// directly, so a rep who retitles a beat or rewords a line can find it by
// the NEW wording, and the OLD pre-edit wording stops matching. Walks the
// exact same three field categories (title, blocks/phases script lines,
// reactive_scripts questions) via the same entryId + path scheme every
// other resolved read in this file uses, rather than a second, divergent
// traversal of the raw entry object.
// Reference entries (ref_faq, ref_dodont, ref_close) are deliberately NOT in
// tcWalk() — they're reached from their own hub cards, not the sequential
// deck walk. But they hold a large share of what a rep actually needs to look
// up under pressure: Eclipse's 16 FAQ/objection answers live entirely in
// ref_faq, and its pricing module carries no reactive_scripts to backfill
// them through (that's deliberate — see app.js's FAQ view, which concatenates
// module + ref_faq and would otherwise double-render). The net effect was
// that searching "hail" or "financing" on Eclipse returned nothing at all.
//
// So search runs over a corpus, not the walk: every walk node, plus the
// reference entries, each tagged with where it lives so the caller can route
// a hit correctly. Sunesta gains the same coverage — its ref_faq answers
// weren't searchable either; they only appeared to be because its module
// duplicates two of them.
const TC_REF_VIEW = { ref_dodont: "dodont", ref_faq: "faq", ref_close: "close", ref_predemo: "recap" };
function tcSearchCorpus(){
  const a = tcActive();
  if (!a) return [];
  const nodes = tcWalk().map((n) => ({ ...n, inWalk: true }));
  for (const [id, view] of Object.entries(TC_REF_VIEW)) {
    const entry = a.byId[id];
    // Skip anything already in the walk (a product could legitimately put a
    // reference entry in prep_ids) so a hit can't be listed twice.
    if (entry && !nodes.some((n) => n.id === id))
      nodes.push({ kind: "reference", id, section: "Reference", entry, deckId: null, inWalk: false, refView: view });
  }
  return nodes;
}

function tcSearch(q){
  if (!tcReady() || !q || q.trim().length < 2) return [];
  const needle = q.trim().toLowerCase();
  const hits = [];
  for (const node of tcSearchCorpus()) {
    const e = node.entry;
    const id = e.slide_id || e.module_id;
    const found = [];
    const title = tcFieldValue(id, "title");
    if ((title || "").toLowerCase().includes(needle)) found.push({ where:"Title", text:title });
    const groupKey = e.blocks ? "blocks" : e.phases ? "phases" : null;
    const groups = (groupKey && e[groupKey]) || [];
    groups.forEach((g, gi) => {
      (g.script || []).forEach((_, si) => {
        const line = tcFieldValue(id, `${groupKey}.${gi}.script.${si}`);
        if ((line || "").toLowerCase().includes(needle)) found.push({ where:g.label || "Script", text:line });
      });
    });
    // Questions AND answers. A rep searching "hail" is looking for the answer
    // body, not a question that happens to contain the word — matching only
    // questions made most of ref_faq invisible even once it was in the corpus.
    (e.reactive_scripts || []).forEach((r, ri) => {
      const question = tcFieldValue(id, `reactive_scripts.${ri}.question`);
      const qHit = (question || "").toLowerCase().includes(needle);
      if (qHit) found.push({ where:"Q&A", text:question });
      const answerKey = r.answer ? "answer" : r.script ? "script" : null;
      if (answerKey) (r[answerKey] || []).forEach((_, li) => {
        const line = tcFieldValue(id, `reactive_scripts.${ri}.${answerKey}.${li}`);
        if ((line || "").toLowerCase().includes(needle))
          // Label the hit with its question so the result is self-explaining.
          found.push({ where: question ? `Q&A — ${question}` : "Q&A", text: line });
      });
    });
    // Do & Don't lists — short, high-recall lines a rep looks up by phrase.
    const tn = e.training_notes || {};
    for (const kind of ["do", "do_not"]) {
      (tn[kind] || []).forEach((_, i) => {
        const line = tcFieldValue(id, `training_notes.${kind}.${i}`);
        if ((line || "").toLowerCase().includes(needle))
          found.push({ where: kind === "do" ? "Do" : "Do not", text: line });
      });
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
