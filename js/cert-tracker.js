// RAVN — Certification (First 90 Days), RAVN step 10.
//
// Every number and every "ready" is decided by Cockpit (ravn-certify.js,
// /api/raven/cert/*). This file only shows it and sends owner actions.
//
// Reps see their own cards: one per product (Sunesta awnings, E-Zip
// screens, Gutter Helmet) with courses, watch x/6, lead x/6, role-plays
// x/5 and Ready / Certified. Owners, and Sales Managers with the "see
// progress" switch, see every rep. Only an owner can certify; owners and
// Sales Managers with the "mark passed" switch can mark a live role-play
// passed.

const CT = { view: "me", me: null, team: null, loading: false, error: null, busy: false, openRep: null, msg: null };

function ctBase(){ return self.RAVN_API_BASE || "https://ath-cockpit.onrender.com"; }
async function ctApi(path, opts){
  let r;
  try { r = await rvAuthedFetch(ctBase() + "/api/raven/cert" + path, opts); }
  catch (e) { return { status: 0, data: { ok: false, error: navigator.onLine ? "Couldn't reach Cockpit." : "You're offline. Certification needs a connection." } }; }
  const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  return { status: r.status, data };
}
const ctPost = (path, body) => ctApi(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctE = (s) => (typeof ravnEsc === "function" ? ravnEsc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
const ctI = (name) => (typeof LUCIDE !== "undefined" && LUCIDE[name]) || "";
const ctDate = (t) => { try { return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" }); } catch (e) { return ""; } };

function ctOpen(){ CT.view = "me"; CT.me = null; CT.team = null; CT.error = null; CT.msg = null; CT.openRep = null; }
async function ctLoad(){
  CT.loading = true; CT.error = null; renderCert();
  const r = await ctApi("/me");
  if (!r.data.ok) { CT.loading = false; CT.error = r.status === 503 ? "Certification isn't set up on Cockpit yet." : (r.data.error || "Couldn't load your progress."); return renderCert(); }
  CT.me = r.data;
  // Owners aren't trainees: they go straight to the team.
  if (!CT.me.trainee && CT.me.canViewTeam) CT.view = "team";
  if (CT.view === "team") await ctLoadTeam(); else { CT.loading = false; renderCert(); }
}
async function ctLoadTeam(){
  CT.loading = true; renderCert();
  const r = await ctApi("/team");
  CT.loading = false;
  if (!r.data.ok) CT.error = r.data.error || "Couldn't load the team.";
  else CT.team = r.data;
  renderCert();
}

const CT_STATUS = {
  certified: (c) => `<span class="rb-tag done">${ctI("award")}Certified${c.certified && c.certified.action === "grandfather" ? " (set by owner)" : ""}</span>`,
  ready: () => `<span class="rb-tag go">${ctI("circleCheck")}Ready to certify</span>`,
  in_progress: () => `<span class="rb-tag locked">${ctI("arrowRight")}In progress</span>`,
};
function ctBar(n, of, label){
  const p = of ? Math.max(0, Math.min(100, Math.round((n / of) * 100))) : 0;
  return `<div class="rb-bar${n >= of ? " is-done" : ""}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${ctE(label)}"><div class="rb-bar-fill" style="width:${p}%"></div></div>`;
}
function ctLine(label, n, of, extra){
  return `<div class="ct-line"><div class="ct-line-head"><span>${ctE(label)}</span><b>${n >= of ? ctI("circleCheck") : ""}${n} of ${of}</b></div>${ctBar(n, of, label)}${extra || ""}</div>`;
}
function ctCallRows(list, emptyText){
  if (!list || !list.length) return `<div class="rb-hint">${ctE(emptyText)}</div>`;
  return list.map((c) => {
    const q = c.quality || {};
    const verdict = q.waiting ? `<span class="rb-hint">Being graded</span>`
      : q.pass ? `<span class="ct-ok">${ctI("circleCheck")}Passes</span>`
      : `<span class="ct-bad">${ctI("circleX")}${ctE((q.reasons || []).join(", "))}</span>`;
    return `<div class="ct-call"><span>${ctE(ctDate(c.at))} · ${ctE(c.title || "Recording")}${c.roleSource === "owner" ? ' <span class="rb-hint">(set by owner)</span>' : ""}</span>${verdict}</div>`;
  }).join("");
}

// One product card. who = {learner, name} when shown in the team view.
function ctCardHTML(card, who){
  const team = CT.team || {};
  const owner = !!(who && team.isOwner);
  const canMark = !!(who && team.canMarkPassed);
  const courseLine = card.courses.required
    ? ctLine("Courses", card.courses.done, card.courses.required, `<div class="rb-hint">${card.courses.list.map((c) => ctE(c.title) + (c.complete ? " ✓" : ` (${c.percent}%)`)).join(" · ")}</div>`)
    : `<div class="ct-line"><div class="ct-line-head"><span>Courses</span><b>None yet</b></div><div class="rb-hint">No course is published for this product yet.</div></div>`;
  const marks = card.roleplay.marks.map((m) => `<div class="ct-call"><span>${ctE(ctDate(m.at))} · Live role-play, marked passed by ${ctE(m.by)}${m.note ? ": " + ctE(m.note) : ""}</span>
      ${canMark ? `<button class="ct-link" data-ct="unmark" data-id="${ctE(m.id)}">Undo</button>` : ""}</div>`).join("");
  let actions = "";
  if (who) {
    const a = [];
    if (owner && card.status === "ready") a.push(`<button class="rb-btn go-green" data-ct="certify" data-l="${ctE(who.learner)}" data-p="${card.product}">${ctI("award")}Certify</button>`);
    if (owner && card.status !== "certified") a.push(`<button class="rb-btn secondary" data-ct="grandfather" data-l="${ctE(who.learner)}" data-p="${card.product}">Mark certified (no counts)</button>`);
    if (owner && card.status === "certified") a.push(`<button class="rb-btn secondary" data-ct="revoke" data-l="${ctE(who.learner)}" data-p="${card.product}">Undo certification</button>`);
    if (canMark && card.status !== "certified") a.push(`<button class="rb-btn secondary" data-ct="mark" data-l="${ctE(who.learner)}" data-p="${card.product}">Mark a role-play passed</button>`);
    if (a.length) actions = `<div class="rb-actions ct-actions">${a.join("")}</div>`;
  }
  const certLine = card.certified ? `<div class="rb-note">${ctI("award")} Certified ${ctE(ctDate(card.certified.at))} by ${ctE(card.certified.by)}.</div>` : "";
  const todo = card.status !== "certified" && card.blockers.length
    ? `<div class="ct-todo"><b>Still to do</b><ul>${card.blockers.map((b) => `<li>${ctE(b)}</li>`).join("")}</ul></div>` : "";
  return `<div class="rb-card ct-card" data-product="${card.product}">
    <div class="ct-card-head"><h2>${ctE(card.label)}</h2>${CT_STATUS[card.status](card)}</div>
    ${certLine}
    ${courseLine}
    ${ctLine("Watch ride-alongs", card.watch.count, card.watch.required)}
    ${ctLine("Lead ride-alongs", card.lead.count, card.lead.required)}
    ${ctLine("Role-plays passed", card.roleplay.count, card.roleplay.required)}
    ${todo}
    <details class="ct-more"><summary>See the calls</summary>
      <h3>Last 3 lead calls (must each pass)</h3>${ctCallRows(card.lead.lastThree, "No lead calls yet.")}
      <h3>All lead calls</h3>${ctCallRows(card.lead.calls, "None yet.")}
      <h3>Watch calls</h3>${ctCallRows(card.watch.calls, "None yet.")}
      <h3>Role-plays</h3>${ctCallRows(card.roleplay.recorded, "No recorded role-plays yet.")}${marks}
      ${card.pending.length ? `<h3>Still being graded</h3>${ctCallRows(card.pending, "")}` : ""}
      <p class="rb-hint">Passing = no red flags, at most one missed stage, and at least 6 stages graded. A borderline stage counts at its lower level.</p>
    </details>
    ${actions}
  </div>`;
}

function ctHead(eyebrow, title){ return `<div class="rb-head"><div class="rb-eyebrow">${ctE(eyebrow)}</div><h1>${ctE(title)}</h1></div>`; }

function renderCert(){
  const el = document.getElementById("certPanel");
  if (!el) return;
  if (typeof rvGetSession === "function" && !rvGetSession()) {
    el.innerHTML = `${ctHead("Training", "Certification")}<div class="rb-card"><h2>Sign in first</h2>
      <p>Your progress follows your RAVN sign-in. Open Start appointment, sign in, then come back here.</p></div>`;
    return;
  }
  if (CT.me === null && !CT.loading && !CT.error) { ctLoad(); return; }
  let body = "";
  const msg = CT.msg ? `<div class="rb-note ct-msg">${ctE(CT.msg)}</div>` : "";
  if (CT.loading && !CT.me) body = `${ctHead("Training", "Certification")}<div class="rb-empty">Loading…</div>`;
  else if (CT.error) body = `${ctHead("Training", "Certification")}<div class="rb-error">${ctE(CT.error)}</div><button class="rb-btn" data-ct="reload">${ctI("rotateCcw")}Try again</button>`;
  else if (CT.view === "team") body = ctTeamHTML();
  else body = ctMeHTML();
  el.innerHTML = msg + body;
  el.onclick = ctOnClick;
}

function ctMeHTML(){
  const d = CT.me;
  const teamBtn = d.canViewTeam ? `<button class="rb-btn secondary block" data-ct="team">${ctI("users")}See every rep's progress</button>` : "";
  if (!d.trainee) return `${ctHead("Training", "Certification")}<div class="rb-card"><h2>No certification cards for this account</h2><p>Cards are for sales reps.</p></div>${teamBtn}`;
  return `${ctHead("First 90 Days", "Your certification")}
    <p class="rb-meta ct-intro">Each product is certified on its own. You need the course, 6 watch and 6 lead ride-alongs, and 5 role-plays that pass the scorecard. Then an owner certifies you.</p>
    ${d.trainee.products.map((c) => ctCardHTML(c, null)).join("")}${teamBtn}`;
}

function ctTeamHTML(){
  if (!CT.team) return `${ctHead("First 90 Days", "Team progress")}<div class="rb-empty">Loading…</div>`;
  const back = CT.me && CT.me.trainee ? `<button class="rb-back" data-ct="me">${ctI("chevronLeft")}My progress</button>` : "";
  const list = CT.team.trainees;
  if (!list.length) return `${back}${ctHead("First 90 Days", "Team progress")}<div class="rb-card"><h2>No sales reps yet</h2></div>`;
  const rows = list.map((t) => {
    const chips = t.products.map((c) => `<span class="ct-chip ct-${c.status}">${ctE(c.label)}: ${c.status === "certified" ? "Certified" : c.status === "ready" ? "Ready" : `${c.watch.count}/${c.watch.required} watch · ${c.lead.count}/${c.lead.required} lead · ${c.roleplay.count}/${c.roleplay.required} role-play`}</span>`).join("");
    const open = CT.openRep === t.learner;
    return `<div class="rb-card ct-rep">
      <button class="ct-rep-head" data-ct="rep" data-l="${ctE(t.learner)}" aria-expanded="${open}"><span class="rb-row-title">${ctE(t.name)}</span>${ctI(open ? "chevronLeft" : "chevronRight")}</button>
      <div class="ct-chips">${chips}</div>
      ${open ? t.products.map((c) => ctCardHTML(c, t)).join("") : ""}
    </div>`;
  }).join("");
  return `${back}${ctHead("First 90 Days", "Team progress")}${rows}`;
}

async function ctAct(path, body, okMsg){
  if (CT.busy) return;
  CT.busy = true; CT.msg = null;
  const r = await ctPost(path, body);
  CT.busy = false;
  if (!r.data.ok) { CT.msg = r.data.error || "That didn't work."; return renderCert(); }
  CT.msg = okMsg;
  await ctLoadTeam();
}

function ctOnClick(e){
  const b = e.target.closest("[data-ct]");
  if (!b) return;
  const act = b.dataset.ct, l = b.dataset.l, p = b.dataset.p;
  const repName = () => { const t = CT.team && CT.team.trainees.find((x) => x.learner === l); return t ? t.name : "this rep"; };
  const label = () => ({ sunesta: "Sunesta awnings", ezip: "E-Zip screens", "gutter-helmet": "Gutter Helmet" }[p] || p);
  if (act === "reload") { ctOpen(); renderCert(); }
  else if (act === "team") { CT.view = "team"; CT.msg = null; ctLoadTeam(); }
  else if (act === "me") { CT.view = "me"; CT.msg = null; renderCert(); }
  else if (act === "rep") { CT.openRep = CT.openRep === l ? null : l; renderCert(); }
  else if (act === "certify") { if (confirm(`Certify ${repName()} on ${label()}?`)) ctAct("/certify", { learner: l, product: p, action: "certify" }, `${repName()} is certified on ${label()}.`); }
  else if (act === "grandfather") {
    const note = prompt(`Mark ${repName()} certified on ${label()} without the counts (an experienced rep)? Add a note if you like:`, "Experienced rep");
    if (note !== null) ctAct("/certify", { learner: l, product: p, action: "grandfather", note }, `${repName()} is marked certified on ${label()}.`);
  }
  else if (act === "revoke") { if (confirm(`Undo ${repName()}'s ${label()} certification?`)) ctAct("/certify", { learner: l, product: p, action: "revoke" }, "Certification undone."); }
  else if (act === "mark") {
    const note = prompt(`Mark one live ${label()} role-play passed for ${repName()}. A short note (who played the homeowner, when):`, "");
    if (note !== null) ctAct("/roleplay-mark", { learner: l, product: p, note }, "Role-play marked passed.");
  }
  else if (act === "unmark") { if (confirm("Undo this role-play pass?")) ctAct("/roleplay-unmark", { id: b.dataset.id }, "Role-play pass undone."); }
}

// Sign-out or a switch of sign-in clears what was on screen.
window.addEventListener("raven-session-changed", () => { ctOpen(); const el = document.getElementById("certPanel"); if (el && el.offsetParent) renderCert(); });
