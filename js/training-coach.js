// Standalone Training Coach views (Training Center → Sunesta Coach hub):
//
//   "script" — the full walk: every training node in DECK order (authority
//              rule), prev/next, section-jump chips, one-tap s11 bookmark,
//              search, and a quick-access drawer for reactive scripts.
//   "setup"  — the variable form. Deliberately plain: it exists so the seven
//              NOT_SET company values get entered, not to be admired.
//   "cflags" — content maintenance: 75 flags by severity, 20 open items with
//              the slides they block, plus any live mapping-audit problems.
//
// All content rendering goes through js/training-render.js — the same
// renderers the rehearsal side-panel uses, so the two surfaces cannot drift.

// Session state for the walk screen.
const tcv = { i: 0, q: "", drawer: false, sev: "all" };

function tcvIsView(v){ return v === "script" || v === "setup" || v === "cflags"; }

// Hub cards for these views — only offered on the covered product once the
// content file has actually loaded.
function tcvHubCards(){
  if (activeProduct !== TC_PRODUCT || !tcReady()) return [];
  const unset = tcUnsetVars().length;
  return [
    {key:"script", icon:ICON.book, name:"Full Script & Coaching",
     sub:"Every slide — beats, verbatim script, timing, tone & coaching"},
    {key:"setup",  icon:ICON.pencil, name:"Variables & Setup",
     sub: unset ? `${unset} required value${unset===1?"":"s"} not set — fill in before rep use` : "Rep profile, company settings, per-appointment"},
    {key:"cflags", icon:ICON.warn, name:"Content Flags & Open Items",
     sub:"Admin — known issues and outstanding decisions"},
  ];
}

function tcvBodyHTML(view){
  return `<div id="tcvRoot" data-view="${view}"></div>`;
}

function tcvBind(container, view){
  const root = container.querySelector("#tcvRoot");
  if (!root) return;
  if (view === "script") tcvRenderWalk(root);
  if (view === "setup")  tcvRenderSetup(root);
  if (view === "cflags") tcvRenderFlags(root);
}

// ------------------------------------------------------------- walk ------
function tcvRenderWalk(root){
  const walk = tcWalk();
  if (!walk.length){ root.innerHTML = `<div class="tc-empty">Training content not loaded.</div>`; return; }
  tcv.i = Math.max(0, Math.min(tcv.i, walk.length - 1));
  const node = walk[tcv.i];
  const sections = [...new Set(walk.map(n => n.section))];
  const s11At = walk.findIndex(n => n.entry.is_reference_slide);
  const m = tcModule();

  root.innerHTML = `
    <div class="tcv-wrap">
      <div class="tcv-bar">
        <input id="tcvSearch" class="tcv-search" type="search" placeholder="Search titles, script, Q&A…" value="${tcEsc(tcv.q)}">
        ${s11At >= 0 ? `<button class="tcv-mark${tcv.i===s11At?" here":""}" id="tcvMark" title="10 Reasons — the reference slide">★ 10 Reasons</button>` : ""}
        ${m ? `<button class="tcv-drawer-btn" id="tcvDrawerBtn">If they ask…</button>` : ""}
      </div>
      <div id="tcvResults"></div>
      <div class="tcv-chips">${sections.map(sec =>
        `<button class="tcv-chip${sec===node.section?" active":""}" data-sec="${tcEsc(sec)}">${tcEsc(sec)}</button>`).join("")}</div>
      <div class="tc-panel tcv-body">${tcEntryHTML(node.entry, {section: node.section})}</div>
      <div class="tcv-nav">
        <button id="tcvPrev" ${tcv.i===0?"disabled":""}>‹ Prev</button>
        <span class="tcv-pos">${tcv.i+1} / ${walk.length}</span>
        <button id="tcvNext" ${tcv.i===walk.length-1?"disabled":""}>Next ›</button>
      </div>
      ${m ? `<div class="tcv-drawer" id="tcvDrawer" ${tcv.drawer?"":"hidden"}>
        <div class="tcv-drawer-head">If they ask… <button id="tcvDrawerClose">✕</button></div>
        ${tcReactiveHTML(m)}
      </div>` : ""}
    </div>`;

  const rerender = () => tcvRenderWalk(root);
  tcBindToggles(root, rerender);
  root.querySelector("#tcvPrev").onclick = () => { tcv.i--; tcv.drawer = false; rerender(); root.scrollIntoView(); };
  root.querySelector("#tcvNext").onclick = () => { tcv.i++; tcv.drawer = false; rerender(); root.scrollIntoView(); };
  root.querySelectorAll(".tcv-chip").forEach(c => {
    c.onclick = () => { tcv.i = walk.findIndex(n => n.section === c.dataset.sec); tcv.drawer = false; rerender(); };
  });
  const mark = root.querySelector("#tcvMark");
  if (mark) mark.onclick = () => { tcv.i = s11At; tcv.drawer = false; rerender(); };
  const db = root.querySelector("#tcvDrawerBtn");
  if (db) db.onclick = () => { tcv.drawer = !tcv.drawer; rerender(); };
  const dc = root.querySelector("#tcvDrawerClose");
  if (dc) dc.onclick = () => { tcv.drawer = false; rerender(); };

  // Search: results update live in their own container so the input never
  // loses focus; picking a hit jumps the walk (and pre-expands the script
  // layer when the match came from script text, since that's what the rep
  // is looking for).
  const input = root.querySelector("#tcvSearch");
  const resBox = root.querySelector("#tcvResults");
  const renderResults = () => {
    const hits = tcSearch(tcv.q);
    resBox.innerHTML = !tcv.q.trim() ? "" : (hits.length
      ? `<div class="tcv-hits">${hits.map(h => {
          const at = walk.findIndex(n => n.id === h.node.id);
          return `<button class="tcv-hit" data-at="${at}" data-id="${tcEsc(h.node.id)}"
            data-script="${h.matches.some(x => x.where !== "Title")}">
            <span class="tcv-hit-title">${tcEsc(h.node.entry.title)}</span>
            <span class="tcv-hit-where">${tcEsc(h.node.section)} · ${tcEsc(h.matches[0].where)}</span>
            <span class="tcv-hit-text">${tcEsc(h.matches[0].text.slice(0, 110))}</span>
          </button>`;}).join("")}</div>`
      : `<div class="tcv-hits none">No matches.</div>`);
    resBox.querySelectorAll(".tcv-hit").forEach(b => {
      b.onclick = () => {
        tcv.i = +b.dataset.at;
        if (b.dataset.script === "true") tcExpanded.add(b.dataset.id);
        tcv.q = ""; tcv.drawer = false;
        tcvRenderWalk(root);
      };
    });
  };
  input.oninput = () => { tcv.q = input.value; renderResults(); };
  renderResults();
}

// ------------------------------------------------------------ setup ------
// A form, not a feature. Values persist in localStorage on this device.
const TCV_SOURCES = [
  ["company_settings", "Company settings", "Company-wide, from the committed <code>data/company-settings.json</code> — the same values on every rep's iPad. Editing here overrides that default on this device only, for one appointment."],
  ["rep_profile", "Rep profile", "Set once per rep on their own iPad."],
  ["discovery", "This appointment — discovery", "Entered during discovery, cleared after the appointment."],
  ["measure", "This appointment — measure", ""],
  ["proposal", "This appointment — proposal", ""],
];

function tcvRenderSetup(root){
  const unset = tcUnsetVars();
  const vals = tcValues();              // resolved: committed default + local
  const local = tcLocalValues();
  // which slides each unset var actually blocks — computed from live tokens
  const blockedBy = (key) => tcWalk()
    .filter(n => JSON.stringify(n.entry).includes(`{{${key}}}`))
    .map(n => n.entry.display_number || n.entry.slide_number || n.id);

  root.innerHTML = `
    <div class="tcv-setup">
      ${unset.length ? `
      <div class="tcv-unset">
        <div class="tcv-unset-k">${ICON.warn} ${unset.length} required value${unset.length===1?"":"s"} not set</div>
        <ul>${unset.map(v => {
          const b = blockedBy(v.key);
          return `<li><b>${tcEsc(v.label)}</b>${b.length ? ` — blocks slide${b.length===1?"":"s"} ${b.join(", ")}` : ""}</li>`;}).join("")}</ul>
      </div>` : `<div class="tcv-allset">${ICON.checkCircle} All required values are set.</div>`}
      ${TCV_SOURCES.map(([src, label, note]) => {
        const vars = tcVarsBySource(src);
        if (!vars.length) return "";
        return `<div class="tcv-group">
          <h3>${label}</h3>
          ${note ? `<p class="tcv-group-note">${note}</p>` : ""}
          ${vars.map(v => {
            const isCo = src === "company_settings";
            const overridden = isCo && tcIsOverridden(v.key);
            const shown = isCo ? (local[v.key] ?? tcCompanyDefault(v.key)) : (vals[v.key] || "");
            return `
            <label class="tcv-field">
              <span class="tcv-field-label">${tcEsc(v.label)}${v.required ? ' <em>required</em>' : ""}
                ${v.status === "NOT_SET" && !vals[v.key] ? '<span class="tc-var-chip unset">not set</span>' : ""}
                ${overridden ? '<span class="tcv-override">overridden on this device</span>' : ""}</span>
              ${(v.type === "longtext" || v.type === "list")
                ? `<textarea data-var="${v.key}" rows="3">${tcEsc(shown)}</textarea>`
                : `<input type="text" data-var="${v.key}" value="${tcEsc(shown)}">`}
              ${overridden ? `<button class="tcv-revert" data-revert="${v.key}">Revert to company value${
                  tcCompanyDefault(v.key) ? ` (${tcEsc(tcCompanyDefault(v.key))})` : " (not set)"}</button>` : ""}
              ${v.guidance ? `<span class="tcv-field-guide">${tcEsc(v.guidance)}</span>` : ""}
            </label>`;}).join("")}
        </div>`;}).join("")}
      <button class="tcv-clear" id="tcvClearAppt">Clear appointment data</button>
      <p class="tcv-group-note">Clears discovery, measure and proposal values on this device. Rep profile stays; company settings come from the committed file and are unaffected.</p>
    </div>`;

  root.querySelectorAll("[data-var]").forEach(el => {
    el.onchange = () => { tcSetValue(el.dataset.var, el.value.trim()); tcvRenderSetup(root); };
  });
  root.querySelectorAll("[data-revert]").forEach(b => {
    b.onclick = (e) => { e.preventDefault(); tcSetValue(b.dataset.revert, ""); tcvRenderSetup(root); };
  });
  root.querySelector("#tcvClearAppt").onclick = () => {
    if (confirm("Clear this appointment's discovery, measure and proposal values?")) {
      tcClearAppointment(); tcvRenderSetup(root);
    }
  };
}

// ------------------------------------------------------------ flags ------
function tcvRenderFlags(root){
  const audit = tcAuditMapping({silent:true});
  const flags = tcAllFlags().filter(f => tcv.sev === "all" || f.severity === tcv.sev);
  const items = tcOpenItems();
  const blocked = new Set(); items.forEach(o => (o.blocks || []).forEach(b => blocked.add(b)));
  const counts = {high:0, medium:0, low:0};
  tcAllFlags().forEach(f => { if (counts[f.severity] != null) counts[f.severity]++; });

  root.innerHTML = `
    <div class="tcv-flags">
      ${audit.length ? `<div class="tcv-unset"><div class="tcv-unset-k">${ICON.warn} Mapping problems (live audit)</div>
        <ul>${audit.map(p => `<li>${tcEsc(p)}</li>`).join("")}</ul></div>` : ""}
      <h3>Content flags <span class="tcv-count">${tcAllFlags().length}</span></h3>
      <div class="tcv-chips">${["all","high","medium","low"].map(s =>
        `<button class="tcv-chip${tcv.sev===s?" active":""}" data-sev="${s}">${s === "all" ? "All" : `${s} (${counts[s]})`}</button>`).join("")}</div>
      <div class="tcv-flaglist">${flags.map(f => `
        <div class="tcv-flag sev-${f.severity}">
          <div class="tcv-flag-head"><span class="tcv-sev ${f.severity}">${f.severity}</span>
            <b>${tcEsc(f.on)}</b> · ${tcEsc(f.title)}</div>
          <div class="tcv-flag-issue">${tcEsc(f.issue)}</div>
          ${f.recommendation ? `<div class="tcv-flag-rec">→ ${tcEsc(f.recommendation)}</div>` : ""}
        </div>`).join("")}</div>
      <h3>Open items <span class="tcv-count">${items.length}</span> <span class="tcv-count-note">blocking ${blocked.size} slides/modules</span></h3>
      <div class="tcv-flaglist">${items.map(o => `
        <div class="tcv-flag${o.priority === "high" ? " sev-high" : ""}">
          <div class="tcv-flag-head">${o.priority === "high" ? `<span class="tcv-sev high">high</span>` : ""}
            <b>${tcEsc(o.id)}</b> · ${tcEsc(o.item)} <span class="tcv-owner">${tcEsc(o.owner || "")}</span></div>
          ${(o.blocks || []).length ? `<div class="tcv-flag-rec">Holds up: ${o.blocks.map(b => `<code>${tcEsc(b)}</code>`).join(" ")}</div>` : ""}
        </div>`).join("")}</div>
    </div>`;

  root.querySelectorAll("[data-sev]").forEach(c => {
    c.onclick = () => { tcv.sev = c.dataset.sev; tcvRenderFlags(root); };
  });
}
