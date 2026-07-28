// THE DOGHOUSE — Quote Builder. Mirrors Cockpit's pricing engine and catalog
// data EXACTLY: nothing here reimplements pricing math. pricing-engine.js and
// the 7 product catalogs are fetched live from Cockpit and cached (Tier 3 in
// sw.js — see PRICING_CACHE there); this file only builds a UI around
// window.PricingEngine.computeQuote / computeScreenQuote / computeScreenQuoteMulti.
//
// Cache ownership: the cache NAME and product-id list below must stay in
// sync with sw.js's PRICING_CACHE / PRICING_PRODUCT_IDS — sw.js owns the
// background self-healing sync (driven by the SYNC_PRICING message, see
// bottom of js/app.js), this file owns bootstrapping the cache on a
// never-synced device and reading from it to render the UI.
const QB_CACHE = "doghouse-pricing-v1";
const QB_BASE = "https://ath-cockpit.onrender.com";
const QB_KEY = "ATH2026";
const QB_PRODUCT_IDS = [
  "sunesta", "sunstyle", "sunlight",
  "eclipse-ezip-4in-sunstopper", "eclipse-ezip-5in-sunstopper",
  "eclipse-ezip-5in-superduty", "eclipse-ezip-7in-superduty",
  "eclipse-cable-4in", "eclipse-cable-5in",
];
const QB_ACC_LABEL = {
  stdInsideMountLAngle: "STD inside mount “L” angle",
  superDutyInsideMountLAngle: "Super Duty inside mount “L” angle",
  superDutyRecessedTrackU: "Recessed track mounting “U”",
  furOutStrips: "1\" × 2\" fur-out strips",
};

function qbUrls(){
  return [
    `${QB_BASE}/api/pricing/version`,
    `${QB_BASE}/api/pricing/products`,
    ...QB_PRODUCT_IDS.map((id) => `${QB_BASE}/api/pricing/product?id=${id}`),
    `${QB_BASE}/pricing-engine.js`,
  ];
}
function qbAuthedFetch(url){
  return fetch(url, { headers: { "X-Pricing-Key": QB_KEY } });
}

// ── State ───────────────────────────────────────────────────────────────
const QB = { status: "idle", products: null, catalogs: null, syncedAt: null, errorMessage: null };
let qbView = "picker"; // "picker" | "awningForm" | "screenBuilder" | "unitForm"
let qbActiveProductId = null;
let qbInput = null;           // awning form state
let qbScreenUnits = [];       // array of unit drafts
let qbScreenPricing = null;   // quote-level margin/discount for multi-unit screens
let qbUnitDraft = null;
let qbEditingUnitIndex = null;
let qbResult = null;
let qbRepView = false;
let qbEngineTextLoaded = null;

// ── Cache read/write (shared bucket with sw.js's PRICING_CACHE) ──────────
async function qbFetchAndCacheAll(){
  const cache = await caches.open(QB_CACHE);
  const results = await Promise.allSettled(qbUrls().map((u) =>
    qbAuthedFetch(u).then((r) => {
      if (!r.ok) throw new Error(`bad status ${r.status} for ${u}`);
      return cache.put(u, r.clone());
    })
  ));
  return results.filter((r) => r.status === "rejected").length;
}

async function qbSyncNow(){
  if (!navigator.onLine) return { synced: false, reason: "offline" };
  try {
    const verResp = await qbAuthedFetch(`${QB_BASE}/api/pricing/version`);
    if (!verResp.ok) return { synced: false, reason: `http-${verResp.status}` };
    const liveVer = await verResp.clone().json();
    // Cockpit's auth/CORS gate answers with HTTP 200 + {ok:false} on a bad
    // key or disallowed origin — checking only verResp.ok would treat that
    // error envelope as fresher than the cache (no .stamp) and blow away
    // good cached pricing with nothing. Bail out exactly like a network
    // failure instead.
    if (liveVer.ok === false) return { synced: false, reason: "denied" };
    const cache = await caches.open(QB_CACHE);
    const cachedVerResp = await cache.match(`${QB_BASE}/api/pricing/version`);
    const cachedVer = cachedVerResp ? await cachedVerResp.json() : null;
    const stale = !cachedVer || cachedVer.stamp !== liveVer.stamp;
    if (stale) {
      await cache.put(`${QB_BASE}/api/pricing/version`, verResp.clone());
      await qbFetchAndCacheAll();
    } else {
      const already = new Set((await cache.keys()).map((r) => r.url));
      const missing = qbUrls().filter((u) => !already.has(u));
      if (missing.length) {
        await Promise.allSettled(missing.map((u) =>
          qbAuthedFetch(u).then((r) => r.ok && cache.put(u, r))
        ));
      }
    }
    return { synced: true, stale };
  } catch (err) {
    console.warn("Quote Builder sync failed:", err);
    return { synced: false, reason: "error" };
  }
}

async function qbLoadFromCache(){
  const cache = await caches.open(QB_CACHE);
  const verResp = await cache.match(`${QB_BASE}/api/pricing/version`);
  const prodResp = await cache.match(`${QB_BASE}/api/pricing/products`);
  const engResp = await cache.match(`${QB_BASE}/pricing-engine.js`);
  if (!verResp || !prodResp || !engResp) return null;
  const syncedAt = verResp.headers.get("date");
  const catalogs = {};
  for (const id of QB_PRODUCT_IDS) {
    const r = await cache.match(`${QB_BASE}/api/pricing/product?id=${id}`);
    if (!r) return null;
    catalogs[id] = (await r.json()).data;
  }
  const products = (await prodResp.json()).data;
  const engineText = await engResp.text();
  return { products, catalogs, engineText, syncedAt };
}

// Executes the fetched pricing-engine.js text as a real <script> (via a
// blob: URL, not eval) so it runs exactly as Cockpit's own dashboard runs
// it — same UMD wrapper, same window.PricingEngine global.
function qbEnsureEngine(text){
  if (qbEngineTextLoaded === text && window.PricingEngine) return Promise.resolve(window.PricingEngine);
  return new Promise((resolve, reject) => {
    const blob = new Blob([text], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => { URL.revokeObjectURL(url); qbEngineTextLoaded = text; resolve(window.PricingEngine); };
    s.onerror = () => { URL.revokeObjectURL(url); reject(new Error("script load failed")); };
    document.head.appendChild(s);
  });
}

async function qbLoadData(){
  let data = await qbLoadFromCache();
  if (!data) {
    if (navigator.onLine) {
      try {
        await qbFetchAndCacheAll();
        data = await qbLoadFromCache();
      } catch (err) {
        QB.status = "error";
        QB.errorMessage = "Network error while syncing pricing: " + err.message;
        return;
      }
    }
    if (!data) {
      QB.status = navigator.onLine ? "error" : "offline-empty";
      if (navigator.onLine) QB.errorMessage = "Cockpit did not return complete pricing data.";
      return;
    }
  } else if (navigator.onLine) {
    qbSyncNow(); // silent background refresh — don't block first paint
  }
  QB.products = data.products;
  QB.catalogs = data.catalogs;
  QB.syncedAt = data.syncedAt;
  try {
    await qbEnsureEngine(data.engineText);
  } catch (err) {
    QB.status = "error";
    QB.errorMessage = "Pricing engine failed to load: " + err.message;
    return;
  }
  QB.status = "ready";
}

// Regains connectivity mid-session → resync silently and refresh the
// currently-open view's numbers without yanking the user back to the picker.
window.addEventListener("online", () => {
  if (QB.status !== "ready") return;
  qbSyncNow().then(async (r) => {
    if (r.synced) {
      const data = await qbLoadFromCache();
      if (data) { QB.products = data.products; QB.catalogs = data.catalogs; QB.syncedAt = data.syncedAt; }
    }
    if (typeof appView !== "undefined" && appView === "quote") renderQuoteBuilder();
  });
});

// ── Small helpers ──────────────────────────────────────────────────────
function qbMoney(n){
  return n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function qbSyncIndicatorHTML(){
  const when = QB.syncedAt ? new Date(QB.syncedAt) : null;
  const label = when ? when.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never";
  const online = navigator.onLine;
  return `<div class="qb-sync-badge">${online ? "●" : "○"} Pricing last synced: ${label}${online ? "" : " — offline, using cached data"}</div>`;
}

// ── Top-level dispatcher, called by app.js whenever appView becomes "quote" ──
function renderQuoteBuilder(){
  const el = document.getElementById("quoteBuilder");
  if (!el) return;
  if (QB.status === "idle") {
    QB.status = "loading";
    el.innerHTML = qbLoadingHTML();
    qbLoadData().then(() => { if (typeof appView !== "undefined" && appView === "quote") renderQuoteBuilder(); });
    return;
  }
  if (QB.status === "loading") { el.innerHTML = qbLoadingHTML(); return; }
  if (QB.status === "offline-empty" || QB.status === "error") {
    el.innerHTML = QB.status === "offline-empty" ? qbNeedsSyncHTML() : qbErrorHTML();
    const btn = document.getElementById("qbRetrySync");
    if (btn) btn.onclick = () => { QB.status = "idle"; renderQuoteBuilder(); };
    return;
  }
  if (qbView === "awningForm") return qbRenderAwningForm(el);
  if (qbView === "screenBuilder") return qbRenderScreenBuilder(el);
  if (qbView === "unitForm") return qbRenderUnitForm(el);
  return qbRenderPicker(el);
}

function qbResetToPicker(){
  qbView = "picker"; qbResult = null; qbActiveProductId = null; qbEditingUnitIndex = null;
}

function qbLoadingHTML(){
  return `<div class="qb-status"><div class="qb-status-icon">⏳</div><div>Loading live pricing from Cockpit…</div></div>`;
}
function qbNeedsSyncHTML(){
  return `<div class="qb-status">
    <div class="qb-status-icon">${ICON.signal}</div>
    <h2>Quote Builder needs to sync once before it can work offline</h2>
    <p>Connect to WiFi or cellular data, then try again to pull live pricing from Cockpit. After the first sync it keeps working offline.</p>
    <button class="qb-btn-primary" id="qbRetrySync">Try again</button>
  </div>`;
}
function qbErrorHTML(){
  return `<div class="qb-status">
    <div class="qb-status-icon">${ICON.warn}</div>
    <h2>Couldn't reach Cockpit</h2>
    <p>${QB.errorMessage || "Pricing data could not be loaded."}</p>
    <button class="qb-btn-primary" id="qbRetrySync">Try again</button>
  </div>`;
}

// ── Picker ─────────────────────────────────────────────────────────────
function qbRenderPicker(el){
  const awnings = QB.products.filter((p) => p.family === "Awnings");
  const screens = QB.products.filter((p) => p.family === "Eclipse EZIP Screens");
  el.innerHTML = `
    <div class="center-head">
      <div class="eyebrow">Rep tool · live pricing from Cockpit</div>
      <h1>Quote Builder</h1>
      ${qbSyncIndicatorHTML()}
    </div>
    <div class="center-cards">
      ${awnings.map((p) => `
        <div class="center-card product" data-kind="awning" data-id="${p.id}">
          <div class="center-card-icon">${PRODUCT_ICON.sunesta}</div>
          <div>
            <div class="center-card-name">${p.product}</div>
            <div class="center-card-sub">Retractable awning</div>
          </div>
        </div>`).join("")}
      <div class="center-card product" data-kind="screens">
        <div class="center-card-icon">${PRODUCT_ICON.eclipse}</div>
        <div>
          <div class="center-card-name">Eclipse EZIP Screens</div>
          <div class="center-card-sub">${screens.length} products · multi-unit quotes</div>
        </div>
      </div>
    </div>
  `;
  el.querySelectorAll(".center-card.product").forEach((card) => {
    card.onclick = () => {
      if (card.dataset.kind === "awning") {
        qbActiveProductId = card.dataset.id;
        qbInput = qbDefaultAwningInput(QB.catalogs[qbActiveProductId]);
        qbResult = null; qbRepView = false;
        qbView = "awningForm";
      } else {
        qbScreenUnits = [];
        const firstScreen = screens[0];
        const defMargin = firstScreen ? (QB.catalogs[firstScreen.id].pricingConfig.defaultMargin || 0.7) : 0.7;
        qbScreenPricing = { marginPct: Math.round(defMargin * 100), discountMode: "amount", discountValue: 0, manualRetail: "" };
        qbResult = null; qbRepView = false;
        qbView = "screenBuilder";
      }
      renderQuoteBuilder();
    };
  });
}

// ── Shared margin/discount/override block ─────────────────────────────
function qbPricingControlsHTML(state){
  return `
  <div class="qb-pricing-block">
    <h3>Margin &amp; pricing</h3>
    <div class="qb-form">
      <div class="qb-field"><label>Margin %</label><input type="number" min="0" max="99" class="qb-margin" value="${state.marginPct}"></div>
      <div class="qb-field">
        <label>Discount</label>
        <div class="qb-discount-row">
          <select class="qb-disc-mode">
            <option value="amount" ${state.discountMode === "amount" ? "selected" : ""}>$ off</option>
            <option value="percent" ${state.discountMode === "percent" ? "selected" : ""}>% off</option>
          </select>
          <input type="number" min="0" class="qb-disc-value" value="${state.discountValue}">
        </div>
      </div>
      <div class="qb-field"><label>Manual retail override</label><input type="number" min="0" class="qb-manual-retail" placeholder="blank = use margin/discount" value="${state.manualRetail}"></div>
    </div>
  </div>`;
}
function qbWirePricingControls(el, state, onChange){
  el.querySelector(".qb-margin").onchange = (e) => { state.marginPct = Number(e.target.value) || 0; onChange && onChange(); };
  el.querySelector(".qb-disc-mode").onchange = (e) => { state.discountMode = e.target.value; onChange && onChange(); };
  el.querySelector(".qb-disc-value").onchange = (e) => { state.discountValue = Number(e.target.value) || 0; onChange && onChange(); };
  el.querySelector(".qb-manual-retail").onchange = (e) => { state.manualRetail = e.target.value; onChange && onChange(); };
}

// ── Awning flow ────────────────────────────────────────────────────────
function qbDefaultAwningInput(product){
  return {
    widthFt: product.sizeGrid.widths[0],
    projIdx: 0,
    enclosure: "None",
    drive: "Gear",
    mountType: product.hardware.mounting.default || ((product.hardware.mounting.types[0] || {}).id),
    handCrank: null,
    hangerBolts: false,
    controls: {},
    units: 1,
    marginPct: Math.round((product.pricingConfig.defaultMargin || 0.7) * 100),
    discountMode: "amount",
    discountValue: 0,
    manualRetail: "",
  };
}

function qbBuildAwningEngineInput(product){
  const controls = Object.entries(qbInput.controls).map(([name, qty]) => ({ name, qty }));
  return {
    widthIn: qbInput.widthFt * 12,
    projectionIn: product.axes.projectionInches[qbInput.projIdx],
    enclosure: qbInput.enclosure,
    drive: qbInput.drive,
    controls,
    units: qbInput.units,
    mountType: qbInput.mountType,
    handCrank: qbInput.handCrank,
    hangerBolts: qbInput.hangerBolts,
    margin: Math.min(0.99, Math.max(0, qbInput.marginPct / 100)),
    discount: { mode: qbInput.discountMode, value: qbInput.discountValue },
    manualRetail: qbInput.manualRetail,
  };
}

function qbRenderAwningForm(el){
  const product = QB.catalogs[qbActiveProductId];
  const meta = QB.products.find((p) => p.id === qbActiveProductId);
  const motors = [...new Set((product.driveOptions.motors || []).map((m) => m.name))];
  const mountTypes = product.hardware.mounting.types || [];
  const hc = product.hardware.handCranks || {};
  const showHandCrank = (hc.options || []).length && (hc.requiredWhen === "always" || (hc.requiredWhen === "gear" && qbInput.drive === "Gear"));
  if (showHandCrank && !qbInput.handCrank) qbInput.handCrank = hc.options[0].name;

  el.innerHTML = `
    <div class="center-head">
      <div class="eyebrow">Awning · ${meta.catalogVersion}</div>
      <h1>${product.product} Quote</h1>
      ${qbSyncIndicatorHTML()}
    </div>
    <div class="qb-form">
      <div class="qb-field">
        <label>Width</label>
        <select id="qbWidth">${product.sizeGrid.widths.map((w) => `<option value="${w}" ${w === qbInput.widthFt ? "selected" : ""}>${w}'</option>`).join("")}</select>
      </div>
      <div class="qb-field">
        <label>Projection</label>
        <select id="qbProj">${product.axes.projections.map((p, i) => `<option value="${i}" ${i === qbInput.projIdx ? "selected" : ""}>${p}</option>`).join("")}</select>
      </div>
      <div class="qb-field">
        <label>Enclosure</label>
        <select id="qbEnclosure">
          <option value="None" ${qbInput.enclosure === "None" ? "selected" : ""}>None</option>
          ${product.enclosureOptions.available.map((e) => `<option value="${e}" ${e === qbInput.enclosure ? "selected" : ""}>${e}</option>`).join("")}
        </select>
      </div>
      <div class="qb-field">
        <label>Operation</label>
        <select id="qbDrive">
          <option value="Gear" ${qbInput.drive === "Gear" ? "selected" : ""}>Manual gear / hand crank</option>
          ${motors.map((m) => `<option value="${m}" ${m === qbInput.drive ? "selected" : ""}>${m}</option>`).join("")}
        </select>
      </div>
      ${showHandCrank ? `
      <div class="qb-field">
        <label>Hand crank length</label>
        <select id="qbHandCrank">${hc.options.map((o) => `<option value="${o.name}" ${o.name === qbInput.handCrank ? "selected" : ""}>${o.name}</option>`).join("")}</select>
      </div>` : ""}
      <div class="qb-field">
        <label>Mounting</label>
        <select id="qbMount">${mountTypes.map((t) => `<option value="${t.id}" ${t.id === qbInput.mountType ? "selected" : ""}>${t.label}</option>`).join("")}</select>
      </div>
      ${product.hangerBolts ? `
      <div class="qb-field qb-check">
        <label><input type="checkbox" id="qbHangerBolts" ${qbInput.hangerBolts ? "checked" : ""}> Hanger bolts (stucco / masonry mount)</label>
      </div>` : ""}
      <div class="qb-field">
        <label>Units on this quote</label>
        <input type="number" min="1" id="qbUnits" value="${qbInput.units}">
      </div>
    </div>

    <div class="qb-controls-block">
      <h3>Controls &amp; accessories</h3>
      <div class="qb-controls-grid">
        ${product.controls.filter((c) => !c.discontinued).map((c) => `
          <label class="qb-control-row">
            <input type="checkbox" data-control="${c.name}" ${qbInput.controls[c.name] ? "checked" : ""}>
            <span>${c.name}</span>
            <input type="number" min="1" class="qb-control-qty" data-control-qty="${c.name}" value="${qbInput.controls[c.name] || 1}" ${qbInput.controls[c.name] ? "" : 'style="display:none"'}>
          </label>`).join("")}
      </div>
    </div>

    ${qbPricingControlsHTML(qbInput)}

    <div class="qb-actions">
      <button class="qb-btn-primary" id="qbCalc">Calculate quote</button>
    </div>

    <div id="qbResultArea">${qbResult ? qbResultHTML(qbResult) : ""}</div>
  `;

  document.getElementById("qbWidth").onchange = (e) => { qbInput.widthFt = Number(e.target.value); qbResult = null; qbRenderAwningForm(el); };
  document.getElementById("qbProj").onchange = (e) => { qbInput.projIdx = Number(e.target.value); qbResult = null; qbRenderAwningForm(el); };
  document.getElementById("qbEnclosure").onchange = (e) => { qbInput.enclosure = e.target.value; qbResult = null; qbRenderAwningForm(el); };
  document.getElementById("qbDrive").onchange = (e) => { qbInput.drive = e.target.value; qbResult = null; qbRenderAwningForm(el); };
  const hcEl = document.getElementById("qbHandCrank"); if (hcEl) hcEl.onchange = (e) => { qbInput.handCrank = e.target.value; qbResult = null; };
  document.getElementById("qbMount").onchange = (e) => { qbInput.mountType = e.target.value; qbResult = null; };
  const hbEl = document.getElementById("qbHangerBolts"); if (hbEl) hbEl.onchange = (e) => { qbInput.hangerBolts = e.target.checked; qbResult = null; };
  document.getElementById("qbUnits").onchange = (e) => { qbInput.units = Math.max(1, Number(e.target.value) || 1); qbResult = null; };

  el.querySelectorAll("[data-control]").forEach((cb) => {
    cb.onchange = (e) => {
      const name = e.target.dataset.control;
      if (e.target.checked) qbInput.controls[name] = qbInput.controls[name] || 1;
      else delete qbInput.controls[name];
      qbResult = null;
      qbRenderAwningForm(el);
    };
  });
  el.querySelectorAll("[data-control-qty]").forEach((inp) => {
    inp.onchange = (e) => { qbInput.controls[e.target.dataset.controlQty] = Math.max(1, Number(e.target.value) || 1); qbResult = null; };
  });

  qbWirePricingControls(el, qbInput, () => { qbResult = null; });

  document.getElementById("qbCalc").onclick = () => {
    const engineInput = qbBuildAwningEngineInput(product);
    qbResult = window.PricingEngine.computeQuote(product, engineInput);
    qbRepView = false;
    qbRenderAwningForm(el);
    const ra = document.getElementById("qbResultArea");
    if (ra) ra.scrollIntoView({ behavior: "smooth" });
  };
  const repToggle = document.getElementById("qbRepToggle");
  if (repToggle) repToggle.onclick = () => { qbRepView = !qbRepView; qbRenderAwningForm(el); };
}

// ── Result rendering (single-unit) ────────────────────────────────────
function qbResultHTML(r){
  if (!r) return "";
  if (r.ok === false) return `<div class="qb-result"><div class="qb-error">${ICON.warn} ${r.error}</div></div>`;
  const proposal = r.proposal || { lines: [], retail: null };
  return `
  <div class="qb-result">
    <div class="qb-proposal-card">
      <div class="qb-proposal-price">${proposal.retail == null ? "Call the office" : qbMoney(proposal.retail)}</div>
      <div class="qb-proposal-lines">
        ${proposal.lines.map((l) => `<div class="qb-proposal-line"><span>${l.label}</span><span>${l.value}</span></div>`).join("")}
      </div>
    </div>
    <button class="qb-rep-toggle" id="qbRepToggle">${qbRepView ? "Hide" : "Show"} cost breakdown (rep only) ${ICON.lock}</button>
    ${qbRepView ? qbBreakdownHTML(r) : ""}
  </div>`;
}

function qbBreakdownHTML(r){
  const lines = r.lines || [];
  const detailed = lines.length && lines[0].cogs !== undefined;
  const rows = detailed
    ? lines.map((l) => `<tr><td>${l.label}</td><td>${qbMoney(l.msrp)}</td><td>${l.discountRate != null ? Math.round(l.discountRate * 100) + "%" : "—"}</td><td>${l.qty || 1}</td><td>${qbMoney(l.cogs)}</td></tr>`).join("")
    : lines.map((l) => `<tr><td colspan="4">${l.label}</td><td>${qbMoney(l.amount)}</td></tr>`).join("");
  const cogsTotal = r.cogs && typeof r.cogs === "object" ? r.cogs.total : r.cogs;
  return `
  <div class="qb-breakdown">
    <table class="qb-breakdown-table">
      <thead><tr><th>Item</th><th>MSRP</th><th>Rate</th><th>Qty</th><th>Cost</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="qb-breakdown-totals">
      <div><span>COGS</span><span>${qbMoney(cogsTotal)}</span></div>
      <div><span>Labor</span><span>${qbMoney(r.labor.total)}</span></div>
      <div><span>Shipping</span><span>${qbMoney(r.shipping.total)}</span></div>
      <div class="qb-total-cost"><span>Total cost</span><span>${qbMoney(r.totalCost)}</span></div>
      <div><span>Margin</span><span>${Math.round(r.margin * 100)}%</span></div>
      <div><span>Baseline retail</span><span>${qbMoney(r.baselineRetail)}</span></div>
      ${r.discount && r.discount.amount ? `<div><span>Discount${r.discount.mode === "percent" ? " (" + r.discount.value + "%)" : ""}</span><span>-${qbMoney(r.discount.amount)}</span></div>` : ""}
      <div class="qb-total-retail"><span>Retail</span><span>${qbMoney(r.retail)}</span></div>
      <div><span>Effective margin</span><span>${r.effectiveMargin != null ? Math.round(r.effectiveMargin * 100) + "%" : "—"}</span></div>
    </div>
    ${(r.warnings && r.warnings.length) ? `<div class="qb-warnings">${r.warnings.map((w) => `<div>${ICON.warn} ${w}</div>`).join("")}</div>` : ""}
  </div>`;
}

// ── Screens: multi-unit builder ────────────────────────────────────────
// Fabric Group (Phase 6) — a rep SELECTION, not a product property. Each
// group carries its own price grid / size limits / no-cassette table /
// restricted cells; the engine resolves all of that internally once
// input.fabricGroup is passed to computeScreenQuote (fabricGroupView()) —
// this file only needs the group's sizeGrid, to know which width/drop
// options to offer. A product with no fabricGroupConfig is unaffected
// (this just returns its one and only sizeGrid).
function qbGroupSizeGrid(product, group){
  const cfg = product.fabricGroupConfig;
  if (!cfg) return product.sizeGrid;
  const ov = (product.fabricGroups || {})[group || cfg.default];
  return (ov && ov.sizeGrid) || product.sizeGrid;
}

function qbDefaultScreenUnit(productId){
  const product = QB.catalogs[productId];
  const fabricGroup = product.fabricGroupConfig ? product.fabricGroupConfig.default : null;
  const grid = qbGroupSizeGrid(product, fabricGroup);
  return {
    product: productId,
    fabricGroup,
    widthFt: grid.widths[0],
    dropFt: grid.drops[0],
    noCassette: false,
    drive: "standard",
    mountType: "surface",
    accessories: {},
    linearFootAccessories: {},
    hemBarBrush: "",
    hardwareColor: "standard",
    controls: {},
    acknowledgedRestriction: false,
    ackKey: null,
  };
}

function qbBuildScreenEngineInput(unit){
  const controls = Object.entries(unit.controls).map(([name, qty]) => ({ name, qty }));
  const accessories = {};
  Object.entries(unit.accessories || {}).forEach(([k, v]) => { if (v > 0) accessories[k] = v; });
  const linearFootAccessories = {};
  Object.entries(unit.linearFootAccessories || {}).forEach(([k, v]) => { if (v) linearFootAccessories[k] = true; });
  return {
    widthIn: unit.widthFt * 12,
    dropIn: unit.dropFt * 12,
    fabricGroup: unit.fabricGroup || undefined,
    noCassette: unit.noCassette,
    drive: unit.drive,
    mountType: unit.mountType,
    accessories,
    linearFootAccessories,
    hemBarBrush: unit.hemBarBrush || null,
    hardwareColor: unit.hardwareColor,
    controls,
    units: 1,
    acknowledgedRestriction: unit.acknowledgedRestriction,
  };
}

function qbUnitPreviewResult(unit){
  const product = QB.catalogs[unit.product];
  return window.PricingEngine.computeScreenQuote(product, qbBuildScreenEngineInput(unit));
}

function qbUnitSizeChanged(unit){
  unit.acknowledgedRestriction = false;
  unit.ackKey = null;
}

function qbOpenAddUnit(){
  const firstScreen = QB.products.find((p) => p.family === "Eclipse EZIP Screens");
  qbUnitDraft = qbDefaultScreenUnit(firstScreen.id);
  qbEditingUnitIndex = null;
  qbView = "unitForm";
  renderQuoteBuilder();
}
function qbOpenEditUnit(i){
  qbUnitDraft = JSON.parse(JSON.stringify(qbScreenUnits[i]));
  qbEditingUnitIndex = i;
  qbView = "unitForm";
  renderQuoteBuilder();
}

function qbRenderScreenBuilder(el){
  el.innerHTML = `
    <div class="center-head">
      <div class="eyebrow">Eclipse EZIP Screens · multi-unit quote</div>
      <h1>Screens Quote</h1>
      ${qbSyncIndicatorHTML()}
    </div>
    <div class="qb-unit-list">
      ${qbScreenUnits.length === 0 ? '<div class="qb-empty">No units added yet.</div>' : qbScreenUnits.map((u, i) => {
        const product = QB.catalogs[u.product];
        return `<div class="qb-unit-card">
          <div><b>${product.product}</b> — ${u.widthFt}' W × ${u.dropFt}' drop</div>
          <div class="qb-unit-card-actions">
            <button data-edit="${i}">Edit</button>
            <button data-remove="${i}">Remove</button>
          </div>
        </div>`;
      }).join("")}
    </div>
    <div class="qb-actions">
      <button class="qb-btn-secondary" id="qbAddUnit">+ Add unit</button>
    </div>

    ${qbScreenUnits.length ? qbPricingControlsHTML(qbScreenPricing) : ""}

    <div class="qb-actions">
      <button class="qb-btn-primary" id="qbCalcMulti" ${qbScreenUnits.length ? "" : "disabled"}>Calculate quote</button>
    </div>

    <div id="qbResultArea">${qbResult ? qbResultHTMLMulti(qbResult) : ""}</div>
  `;
  el.querySelectorAll("[data-edit]").forEach((b) => { b.onclick = () => qbOpenEditUnit(Number(b.dataset.edit)); });
  el.querySelectorAll("[data-remove]").forEach((b) => { b.onclick = () => { qbScreenUnits.splice(Number(b.dataset.remove), 1); qbResult = null; renderQuoteBuilder(); }; });
  document.getElementById("qbAddUnit").onclick = qbOpenAddUnit;
  if (qbScreenUnits.length) qbWirePricingControls(el, qbScreenPricing, () => { qbResult = null; });
  const calcBtn = document.getElementById("qbCalcMulti");
  if (calcBtn) calcBtn.onclick = () => {
    const unitSpecs = qbScreenUnits.map((u) => ({ product: QB.catalogs[u.product], input: qbBuildScreenEngineInput(u) }));
    const pricingInput = {
      margin: Math.min(0.99, Math.max(0, qbScreenPricing.marginPct / 100)),
      discount: { mode: qbScreenPricing.discountMode, value: qbScreenPricing.discountValue },
      manualRetail: qbScreenPricing.manualRetail,
    };
    qbResult = window.PricingEngine.computeScreenQuoteMulti(unitSpecs, pricingInput);
    qbRepView = false;
    renderQuoteBuilder();
    const ra = document.getElementById("qbResultArea");
    if (ra) ra.scrollIntoView({ behavior: "smooth" });
  };
  const repToggle = document.getElementById("qbRepToggle");
  if (repToggle) repToggle.onclick = () => { qbRepView = !qbRepView; renderQuoteBuilder(); };
}

function qbResultHTMLMulti(r){
  if (!r) return "";
  if (r.ok === false) return `<div class="qb-result"><div class="qb-error">${ICON.warn} ${r.error}</div></div>`;
  const blocked = r.blocked;
  return `
  <div class="qb-result">
    ${blocked ? `<div class="qb-restriction-banner">
        ${r.restrictedUnits.map((u) => `<div>${ICON.warn} Unit ${u.unit}: ${(u.notes || []).join(" ")}</div>`).join("")}
        <div>Go back into the restricted unit(s) and confirm the size to unlock pricing.</div>
      </div>` : ""}
    <div class="qb-proposal-card">
      <div class="qb-proposal-price">${(blocked || r.retail == null) ? "Call the office" : qbMoney(r.retail)}</div>
      ${r.proposal.units.map((u) => `
        <div class="qb-proposal-unit">
          <div class="qb-proposal-unit-head">Unit ${u.index}</div>
          ${u.lines.map((l) => `<div class="qb-proposal-line"><span>${l.label}</span><span>${l.value}</span></div>`).join("")}
        </div>`).join("")}
    </div>
    <button class="qb-rep-toggle" id="qbRepToggle">${qbRepView ? "Hide" : "Show"} cost breakdown (rep only) ${ICON.lock}</button>
    ${qbRepView ? qbBreakdownHTMLMulti(r) : ""}
  </div>`;
}

function qbBreakdownHTMLMulti(r){
  return `
  <div class="qb-breakdown">
    ${r.units.map((u) => `
      <div class="qb-breakdown-unit">
        <h4>Unit ${u.index} — ${u.product}</h4>
        <table class="qb-breakdown-table"><tbody>
          ${u.lines.map((l) => `<tr><td colspan="4">${l.label}</td><td>${qbMoney(l.amount)}</td></tr>`).join("")}
        </tbody></table>
        <div class="qb-breakdown-totals-mini"><span>COGS ${qbMoney(u.cogs)}</span><span>Labor ${qbMoney(u.labor.total)}</span></div>
      </div>`).join("")}
    <div class="qb-breakdown-totals">
      <div><span>Combined COGS</span><span>${qbMoney(r.cogs)}</span></div>
      <div><span>Combined labor</span><span>${qbMoney(r.labor.total)}</span></div>
      <div><span>Shipping</span><span>${qbMoney(r.shipping.total)}</span></div>
      <div class="qb-total-cost"><span>Total cost</span><span>${qbMoney(r.totalCost)}</span></div>
      <div><span>Margin</span><span>${Math.round(r.margin * 100)}%</span></div>
      <div><span>Baseline retail</span><span>${qbMoney(r.baselineRetail)}</span></div>
      ${r.discount && r.discount.amount ? `<div><span>Discount</span><span>-${qbMoney(r.discount.amount)}</span></div>` : ""}
      <div class="qb-total-retail"><span>Retail</span><span>${qbMoney(r.retail)}</span></div>
      <div><span>Effective margin</span><span>${r.effectiveMargin != null ? Math.round(r.effectiveMargin * 100) + "%" : "—"}</span></div>
    </div>
    ${(r.warnings && r.warnings.length) ? `<div class="qb-warnings">${r.warnings.map((w) => `<div>${ICON.warn} ${w}</div>`).join("")}</div>` : ""}
  </div>`;
}

// ── Screens: single-unit editor ─────────────────────────────────────────
function qbRenderUnitForm(el){
  const unit = qbUnitDraft;
  const product = QB.catalogs[unit.product];
  const dv = product.driveOptions;
  const driveChoices = [{ v: "standard", l: `${dv.standardMotor} (included)` }, { v: "manualGear", l: "Manual gear / hand crank" }];
  if (dv.simuDowngradeDeduct != null) driveChoices.push({ v: "simuDowngrade", l: "Simu RTS (downgrade)" });
  if (dv.somfyMaestriaAdd != null) driveChoices.push({ v: "somfyMaestria", l: "Somfy Maestria RTS (upgrade)" });
  if (dv.autoSun != null) driveChoices.push({ v: "autoSun", l: "Auto Sun (solar)" });

  const mh = product.mountHardware || {};
  const mountChoices = [{ v: "surface", l: "Wall / overhead surface" }];
  if (mh.insideFrame) mountChoices.push({ v: "insideFrame", l: "Inside a frame" });
  if (mh.recessedTrack) mountChoices.push({ v: "recessedTrack", l: "Recessed track" });

  // accessoriesByDrop.parts/linearFootItems are identical across fabric
  // groups (only the per-drop prices differ, which the engine resolves) —
  // safe to read off the top-level (Group C) product for the checkbox list.
  const accCfg = product.accessoriesByDrop || {};
  const lfItems = accCfg.linearFootItems || [];
  const mandatoryRefs = [mh.insideFrame && mh.insideFrame.required, mh.recessedTrack && mh.recessedTrack.required].filter(Boolean);
  const optionalPerPair = (accCfg.parts || []).filter((ref) => !lfItems.includes(ref) && !mandatoryRefs.includes(ref));
  const optionalLF = lfItems.filter((ref) => !mandatoryRefs.includes(ref) || ref === (mh.insideFrame && mh.insideFrame.required));

  const fabricCfg = product.fabricGroupConfig;
  const grid = qbGroupSizeGrid(product, unit.fabricGroup);
  // A product with no cassette-less build at all (4" Cable & Track) rejects
  // noCassette outright in the engine — hide the checkbox rather than let a
  // rep pick an option that always errors.
  const showNoCassette = product.noCassetteAvailable !== false && !!product.noCassetteDeduction;

  const preview = qbUnitPreviewResult(unit);
  // Fabric group is part of the identity of "this size" — Group B and C have
  // their own restricted/pending cells, so a group switch must clear any
  // acknowledgment made under the other group's gate, even at the same
  // width/drop numbers.
  const sizeKey = preview.ok ? `${unit.fabricGroup || ""}:${preview.rounded.widthFt}x${preview.rounded.dropFt}` : null;
  if (sizeKey && unit.ackKey !== sizeKey) { unit.acknowledgedRestriction = false; unit.ackKey = sizeKey; }

  el.innerHTML = `
    <div class="center-head">
      <div class="eyebrow">Eclipse EZIP Screens</div>
      <h1>${qbEditingUnitIndex == null ? "Add unit" : "Edit unit"}</h1>
    </div>
    <div class="qb-form">
      <div class="qb-field">
        <label>Product</label>
        <select id="qbUProduct">${QB.products.filter((p) => p.family === "Eclipse EZIP Screens").map((p) => `<option value="${p.id}" ${p.id === unit.product ? "selected" : ""}>${p.product}</option>`).join("")}</select>
      </div>
      ${fabricCfg ? `
      <div class="qb-field">
        <label>Fabric group</label>
        <select id="qbUFabricGroup">${fabricCfg.available.map((g) => `<option value="${g}" ${g === unit.fabricGroup ? "selected" : ""}>${(fabricCfg.labels || {})[g] || g}</option>`).join("")}</select>
      </div>` : ""}
      <div class="qb-field">
        <label>Width</label>
        <select id="qbUWidth">${grid.widths.map((w) => `<option value="${w}" ${w === unit.widthFt ? "selected" : ""}>${w}'</option>`).join("")}</select>
      </div>
      <div class="qb-field">
        <label>Drop</label>
        <select id="qbUDrop">${grid.drops.map((d) => `<option value="${d}" ${d === unit.dropFt ? "selected" : ""}>${d}'</option>`).join("")}</select>
      </div>
      ${showNoCassette ? `<div class="qb-field qb-check"><label><input type="checkbox" id="qbUNoCassette" ${unit.noCassette ? "checked" : ""}> No cassette box (end brackets only)</label></div>` : ""}
      <div class="qb-field">
        <label>Operation</label>
        <select id="qbUDrive">${driveChoices.map((c) => `<option value="${c.v}" ${c.v === unit.drive ? "selected" : ""}>${c.l}</option>`).join("")}</select>
      </div>
      <div class="qb-field">
        <label>Mounting</label>
        <select id="qbUMount">${mountChoices.map((c) => `<option value="${c.v}" ${c.v === unit.mountType ? "selected" : ""}>${c.l}</option>`).join("")}</select>
      </div>
      ${product.hemBarBrush ? `
      <div class="qb-field">
        <label>Hem bar brush</label>
        <select id="qbUHemBar">
          <option value="">None</option>
          ${product.hemBarBrush.options.map((o) => `<option value="${o.height}" ${o.height === unit.hemBarBrush ? "selected" : ""}>${o.height}</option>`).join("")}
        </select>
      </div>` : ""}
      ${product.hardwareColors ? `
      <div class="qb-field">
        <label>Hardware colour</label>
        <select id="qbUColor">
          <option value="standard" ${unit.hardwareColor === "standard" ? "selected" : ""}>Standard</option>
          <option value="premium" ${unit.hardwareColor === "premium" ? "selected" : ""}>Premium (+${product.hardwareColors.premiumAddPct || 0}%)</option>
          <option value="ral" ${unit.hardwareColor === "ral" ? "selected" : ""}>RAL custom</option>
        </select>
      </div>` : ""}
    </div>

    ${optionalPerPair.length ? `
    <div class="qb-controls-block">
      <h3>Additional hardware (per pair)</h3>
      ${optionalPerPair.map((ref) => `
        <label class="qb-control-row">
          <input type="checkbox" data-acc="${ref}" ${unit.accessories[ref] ? "checked" : ""}>
          <span>${QB_ACC_LABEL[ref] || ref}</span>
        </label>`).join("")}
    </div>` : ""}

    ${optionalLF.length ? `
    <div class="qb-controls-block">
      <h3>Mounting hardware (per linear foot)</h3>
      ${optionalLF.map((ref) => `
        <label class="qb-control-row">
          <input type="checkbox" data-lf="${ref}" ${unit.linearFootAccessories[ref] ? "checked" : ""}>
          <span>${QB_ACC_LABEL[ref] || ref}</span>
        </label>`).join("")}
    </div>` : ""}

    <div class="qb-controls-block">
      <h3>Controls &amp; accessories</h3>
      <div class="qb-controls-grid">
        ${product.controls.map((c) => `
          <label class="qb-control-row">
            <input type="checkbox" data-ucontrol="${c.name}" ${unit.controls[c.name] ? "checked" : ""}>
            <span>${c.name}</span>
          </label>`).join("")}
      </div>
    </div>

    ${preview.ok && preview.isRestricted ? `
      <div class="qb-restriction-banner">
        ${preview.restrictedNotes.map((n) => `<div>${ICON.warn} ${n}</div>`).join("")}
        <label class="qb-ack-row">
          <input type="checkbox" id="qbAck" ${unit.acknowledgedRestriction ? "checked" : ""}>
          I called the office and confirmed this size
        </label>
      </div>` : ""}
    ${(preview.ok === false) ? `<div class="qb-error">${ICON.warn} ${preview.error}</div>` : ""}

    <div class="qb-actions">
      <button class="qb-btn-secondary" id="qbUnitCancel">Cancel</button>
      <button class="qb-btn-primary" id="qbUnitSave" ${preview.ok === false ? "disabled" : ""}>${qbEditingUnitIndex == null ? "Add unit" : "Save unit"}</button>
    </div>
  `;

  const onSizeChange = () => { qbUnitSizeChanged(unit); qbRenderUnitForm(el); };
  document.getElementById("qbUProduct").onchange = (e) => {
    unit.product = e.target.value;
    const np = QB.catalogs[unit.product];
    unit.fabricGroup = np.fabricGroupConfig ? np.fabricGroupConfig.default : null;
    const npGrid = qbGroupSizeGrid(np, unit.fabricGroup);
    unit.widthFt = npGrid.widths[0]; unit.dropFt = npGrid.drops[0];
    unit.accessories = {}; unit.linearFootAccessories = {}; unit.controls = {};
    unit.drive = "standard"; unit.mountType = "surface"; unit.hemBarBrush = ""; unit.noCassette = false;
    onSizeChange();
  };
  const fgEl = document.getElementById("qbUFabricGroup");
  if (fgEl) fgEl.onchange = (e) => {
    unit.fabricGroup = e.target.value;
    // Each group has its own size limits — reset to the new group's grid
    // rather than let a now-invalid width/drop silently error on Calculate.
    const newGrid = qbGroupSizeGrid(product, unit.fabricGroup);
    if (!newGrid.widths.includes(unit.widthFt)) unit.widthFt = newGrid.widths[0];
    if (!newGrid.drops.includes(unit.dropFt)) unit.dropFt = newGrid.drops[0];
    onSizeChange();
  };
  document.getElementById("qbUWidth").onchange = (e) => { unit.widthFt = Number(e.target.value); onSizeChange(); };
  document.getElementById("qbUDrop").onchange = (e) => { unit.dropFt = Number(e.target.value); onSizeChange(); };
  const ncEl = document.getElementById("qbUNoCassette"); if (ncEl) ncEl.onchange = (e) => { unit.noCassette = e.target.checked; qbRenderUnitForm(el); };
  document.getElementById("qbUDrive").onchange = (e) => { unit.drive = e.target.value; qbRenderUnitForm(el); };
  document.getElementById("qbUMount").onchange = (e) => { unit.mountType = e.target.value; qbRenderUnitForm(el); };
  const hbEl = document.getElementById("qbUHemBar"); if (hbEl) hbEl.onchange = (e) => { unit.hemBarBrush = e.target.value || ""; };
  const colorEl = document.getElementById("qbUColor"); if (colorEl) colorEl.onchange = (e) => { unit.hardwareColor = e.target.value; };
  el.querySelectorAll("[data-acc]").forEach((cb) => { cb.onchange = (e) => { unit.accessories[e.target.dataset.acc] = e.target.checked ? 1 : 0; }; });
  el.querySelectorAll("[data-lf]").forEach((cb) => { cb.onchange = (e) => { unit.linearFootAccessories[e.target.dataset.lf] = e.target.checked; qbRenderUnitForm(el); }; });
  el.querySelectorAll("[data-ucontrol]").forEach((cb) => { cb.onchange = (e) => { const n = e.target.dataset.ucontrol; if (e.target.checked) unit.controls[n] = 1; else delete unit.controls[n]; }; });
  const ackEl = document.getElementById("qbAck"); if (ackEl) ackEl.onchange = (e) => { unit.acknowledgedRestriction = e.target.checked; qbRenderUnitForm(el); };

  document.getElementById("qbUnitCancel").onclick = () => { qbView = "screenBuilder"; qbEditingUnitIndex = null; renderQuoteBuilder(); };
  document.getElementById("qbUnitSave").onclick = () => {
    if (qbEditingUnitIndex == null) qbScreenUnits.push(unit);
    else qbScreenUnits[qbEditingUnitIndex] = unit;
    qbEditingUnitIndex = null; qbResult = null; qbView = "screenBuilder";
    renderQuoteBuilder();
  };
}
