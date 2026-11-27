// RAVN — Content (owners only). RAVN step 4.
//
// Where an owner imports a course file written by Jack's chat-side Claude,
// approves lessons and quizzes to make them live, edits anything in place
// (an edit goes live immediately), and rolls anything back from its history.
// Also lists the presentation training documents (the coaching JSON the
// grader reads) with their history.
//
// All of it is Cockpit's /api/raven/content/* — this file holds no rules of
// its own: what's valid, what's live and who may change it are decided by
// the server. Nothing here is cached on the device.
//
// Designed for iPhone and iPad alike: one column, big tap targets.

const CA = {
  view: "list",          // list | course | lesson | quiz | history
  tree: null, refdocs: null,
  loading: false, error: null, msg: null,
  courseId: null, moduleId: null, lessonId: null,
  history: null, historyOf: null,   // {kind, id, title, back}
  editing: null,         // {kind, id, value, errors}
  importText: "", importReport: null, busy: false,
  // Multi-file import (Jack, 2026-11-27): files picked or dropped, waiting
  // for Import; the per-file results; which "not in this file" items are
  // ticked to retire (default ticked); and the one-by-one review.
  pendingFiles: [],      // [{name, text}]
  imports: null,         // [{name, data}] — data is the /import response
  retireOff: {},         // "kind:id" → true when UN-ticked
  review: null,          // {queue:[{kind,id,moduleId,courseId,title}], at, approved:{}, skipped:{}, justApproved, done}
};

function caIsOwner(){
  const id = (typeof rvIdentity === "function") ? rvIdentity() : null;
  return !!(id && Array.isArray(id.capabilities) && id.capabilities.indexOf("manageTeam") >= 0);
}
// Import / approve / edit courses: owners, or anyone given the "Import and
// approve training content" switch (Cockpit → Owners → Team → Sales Manager
// switches). Cockpit checks the same permission on every call.
function caCanManage(){
  const id = (typeof rvIdentity === "function") ? rvIdentity() : null;
  const c = (id && Array.isArray(id.capabilities)) ? id.capabilities : [];
  return c.indexOf("manageContent") >= 0 || c.indexOf("manageTeam") >= 0;
}
function caBase(){ return self.RAVN_API_BASE || "https://ath-cockpit.onrender.com"; }
async function caApi(path, opts){
  let r;
  try { r = await rvAuthedFetch(caBase() + "/api/raven/content" + path, opts); }
  catch (e) { return { status: 0, data: { ok: false, error: navigator.onLine ? "Couldn't reach Cockpit." : "You're offline." } }; }
  const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  return { status: r.status, data };
}
const caPost = (path, body) => caApi(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function caLoad(){
  CA.loading = true; CA.error = null; renderContentAdmin();
  const [t, d] = await Promise.all([caApi("/tree?view=owner"), caApi("/refdocs")]);
  CA.loading = false;
  if (!t.data.ok) CA.error = t.data.error || "Couldn't load content.";
  else CA.tree = t.data.courses;
  CA.refdocs = d.data.ok ? d.data.docs : [];
  renderContentAdmin();
}

// ── helpers ─────────────────────────────────────────────────────────────
const caE = (s) => (typeof ravnEsc === "function" ? ravnEsc(s) : String(s == null ? "" : s));
const caW = (x) => (x && (x.draft || x.live)) || {};          // working copy (draft over live)
function caChip(status){
  if (status === "live") return `<span class="ca-chip live">Live</span>`;
  if (status === "live+draft") return `<span class="ca-chip pending">Live · changes waiting</span>`;
  return `<span class="ca-chip draft">Draft · not live</span>`;
}
const CA_PRODUCTS = { "foundations": "Foundations", "home-show": "Home Show", "gutter-helmet": "Gutter Helmet", "sunesta": "Sunesta awnings",
  "ezip": "E-Zip screens", "eclipse": "Eclipse (older tag)", "pergola": "Louvered pergolas", "price-building": "Price Building" };
const CA_TYPES = { reading: "Reading", video: "Video", script: "Script", checklist: "Demo checklist", roleplay: "Role-play", document: "Library document" };
const CA_ACTIONS = { "import": "Imported", "approve": "Approved", "approve-with-child": "Published with its lessons", "edit": "Edited (live)",
  "edit-draft": "Edited (draft)", "restore": "Restored", "discard-draft": "Draft discarded", "retire": "Retired","seed": "Copied from the old website" };
function caWhen(t){ const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }
function caCourse(){ return (CA.tree || []).find((c) => c.id === CA.courseId) || null; }
function caModule(){ const c = caCourse(); return c ? c.modules.find((m) => m.id === CA.moduleId) || null : null; }
function caLesson(){ const m = caModule(); return m ? m.lessons.find((l) => l.id === CA.lessonId) || null : null; }

function caLessonPreview(l){
  if (!l) return "";
  const t = l.type;
  let head = "";
  if (t === "video" && l.url) head = `<p><a class="ca-linkbtn" href="${caE(l.url)}" target="_blank" rel="noopener">▶ Open the video</a></p>`;
  if (t === "roleplay") head = `${l.goal ? `<p><b>Goal:</b> ${caE(l.goal)}</p>` : ""}${l.url ? `<p><a class="ca-linkbtn" href="${caE(l.url)}" target="_blank" rel="noopener">Open the role-play ↗</a></p>` : ""}`;
  if (t === "document") head = `<p><b>Opens Library document:</b> <code>${caE(l.doc || "")}</code></p>`;
  const mins = l.minutes ? `<div class="ca-meta">${l.minutes} min</div>` : "";
  return `${mins}${head}<div class="ca-md">${typeof ravnMd === "function" ? ravnMd(l.body || "") : caE(l.body || "")}</div>`;
}
function caQuestionPreview(q){
  if (!q) return "";
  return `<div class="ca-md">${typeof ravnMd === "function" ? ravnMd(q.prompt || "") : caE(q.prompt)}</div>
    <ul class="ca-choices">${(q.choices || []).map((c) => `<li class="${c.correct ? "right" : ""}">${c.correct ? "✓" : "○"} ${caE(c.text)}</li>`).join("")}</ul>
    ${q.multi ? `<div class="ca-meta">Select all that apply</div>` : ""}
    <div class="ca-expl"><b>Explanation:</b> ${caE(q.explanation || "")}</div>`;
}

// ── render ──────────────────────────────────────────────────────────────
function renderContentAdmin(){
  const el = document.getElementById("contentPanel");
  if (!el) return;
  if (!caCanManage()) {
    el.innerHTML = `<div class="qb-status"><h2>Not available</h2><p>Sign in to RAVN with an owner account, or an account an owner has given "Import and approve training content", to manage training content.</p></div>`;
    return;
  }
  if (CA.tree === null && !CA.loading && !CA.error) { caLoad(); return; }
  const msg = CA.msg ? `<div class="rv-note ca-msg">${caE(CA.msg)}</div>` : "";
  let body = "";
  if (CA.loading && !CA.tree) body = `<div class="rv-empty">Loading content…</div>`;
  else if (CA.error) body = `<div class="rv-error">${caE(CA.error)}</div><button class="qb-btn-primary" data-act="reload">Try again</button>`;
  else if (CA.review && CA.review.done) body = caReviewDoneHTML();
  else if (CA.view === "course") body = caCourseHTML();
  else if (CA.view === "lesson") body = caReviewBarHTML() + caLessonHTML();
  else if (CA.view === "quiz") body = caReviewBarHTML() + caQuizHTML();
  else if (CA.view === "history") body = caHistoryHTML();
  else body = caListHTML();
  el.innerHTML = `<div class="ca-wrap">${msg}${body}</div>`;
  el.onclick = caOnClick;
  const f = el.querySelector("#caFile");
  if (f) f.onchange = caOnFile;
  const dz = el.querySelector(".ca-drop");
  if (dz) {
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add("is-over"); };
    dz.ondragleave = () => dz.classList.remove("is-over");
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove("is-over"); caReadFiles(e.dataTransfer && e.dataTransfer.files); };
  }
  el.onchange = (e) => {
    const cb = e.target && e.target.closest && e.target.closest("input[data-retire]");
    if (cb) { if (cb.checked) delete CA.retireOff[cb.dataset.retire]; else CA.retireOff[cb.dataset.retire] = true; renderContentAdmin(); }
  };
  const ta = el.querySelector("#caImportText");
  if (ta) ta.oninput = () => { CA.importText = ta.value; };
}

function caListHTML(){
  const report = caImportSummaryHTML();
  const courses = (CA.tree || []).map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    const liveN = lessons.filter((l) => l.status !== "draft").length;
    const waiting = lessons.filter((l) => l.status !== "live").length + c.modules.filter((m) => m.questions.some((q) => q.status !== "live")).length;
    return `<button class="ca-row-btn" data-act="open-course" data-id="${caE(c.id)}">
      <div><div class="ca-row-title">${caE(caW(c).title || c.id)}</div>
      <div class="ca-meta">${caE(CA_PRODUCTS[caW(c).product] || caW(c).product || "")} · ${liveN} of ${lessons.length} lessons live${waiting ? ` · <b>${waiting} waiting for approval</b>` : ""}</div></div>
      <span class="ca-go">›</span></button>
      <div class="ca-actions ca-preview-row"><button class="ca-small" data-act="preview" data-id="${caE(c.id)}">Preview as a rep</button></div>`;
  }).join("") || `<div class="rv-empty">No courses yet. Import one above.</div>`;
  const docs = (CA.refdocs || []).map((d) => `<div class="ca-row-static"><div><div class="ca-row-title">${caE({ shared: "Shared (all products)", sunesta: "Sunesta presentation", eclipse: "Eclipse presentation", "gutter-helmet": "Gutter Helmet presentation" }[d.key] || d.key)}</div>
      <div class="ca-meta">Updated ${caWhen(d.updatedAt)}${d.updatedBy && d.updatedBy !== "seed" ? " by " + caE(d.updatedBy) : ""}</div></div>
      <button class="ca-small" data-act="history" data-kind="refdoc" data-id="${caE(d.key)}">History</button></div>`).join("")
    || `<div class="ca-meta">Not copied into RAVN yet. Cockpit does this a few seconds after it starts.</div>`;
  return `
    <div class="center-head"><div class="eyebrow">Owners</div><h1>Training content</h1></div>
    <section class="ca-card">
      <h2>Import a course file</h2>
      <p class="ca-help">Pick or drop one or more course files (.md or .json), or paste one below. Everything imports as a draft. Nothing reaches reps until you approve it. Importing never deletes anything.</p>
      <label class="ca-drop">
        <span class="ca-drop-main">Drop course files here</span>
        <span class="ca-drop-sub">or tap to choose several at once</span>
        <input id="caFile" type="file" multiple accept=".md,.markdown,.json,.txt,text/markdown,application/json,text/plain">
      </label>
      ${CA.pendingFiles.length ? `<ul class="ca-files">${CA.pendingFiles.map((f, i) => `<li><span>${caE(f.name)}</span><button class="ca-small" data-act="drop-file" data-id="${i}">Remove</button></li>`).join("")}</ul>` : ""}
      ${CA.pendingFiles.length ? "" : `<details class="ca-paste"${CA.importText ? " open" : ""}><summary>Or paste a course file</summary>
      <textarea id="caImportText" class="ca-textarea" placeholder="---&#10;ravn: course/1&#10;course: foundations&#10;…" spellcheck="false">${caE(CA.importText)}</textarea></details>`}
      <div class="ca-actions">
        <button class="qb-btn-primary" data-act="import"${CA.busy ? " disabled" : ""}>${CA.busy ? "Importing…" : CA.pendingFiles.length > 1 ? `Import ${CA.pendingFiles.length} files` : "Import"}</button>
      </div>
      ${report}
    </section>
    <section class="ca-card"><h2>Courses</h2>${courses}</section>
    ${caIsOwner() ? `<section class="ca-card"><h2>Presentation training</h2>
      <p class="ca-help">The coaching text behind Training Mode, which the AI grader also reads. Edit it in the Training Center (Edit → Save to RAVN); roll back here.</p>
      ${docs}</section>` : ""}`;
}

function caCourseHTML(){
  const c = caCourse();
  if (!c) return `<button class="ca-back" data-act="to-list">‹ All content</button><div class="rv-empty">That course is gone.</div>`;
  const w = caW(c);
  const mods = c.modules.map((m) => {
    const mw = caW(m);
    const qStatus = !m.questions.length ? null : m.questions.every((q) => q.status === "live") ? "live" : m.questions.every((q) => q.status === "draft") ? "draft" : "live+draft";
    return `<div class="ca-module">
      <div class="ca-module-head"><h3>${caE(mw.title || m.id)}</h3>${m.status !== "live" ? caChip(m.status) : ""}</div>
      <div class="ca-meta">Pass mark ${mw.pass || 80}%</div>
      ${m.lessons.map((l) => `<button class="ca-row-btn" data-act="open-lesson" data-module="${caE(m.id)}" data-id="${caE(l.id)}">
        <div><div class="ca-row-title">${caE(caW(l).title || l.id)}</div><div class="ca-meta">${caE(CA_TYPES[caW(l).type] || caW(l).type)}</div></div>
        ${caChip(l.status)}</button>`).join("")}
      ${m.questions.length ? `<button class="ca-row-btn" data-act="open-quiz" data-module="${caE(m.id)}">
        <div><div class="ca-row-title">Quiz</div><div class="ca-meta">${m.questions.length} question${m.questions.length === 1 ? "" : "s"}</div></div>${caChip(qStatus)}</button>` : ""}
    </div>`;
  }).join("");
  return `<button class="ca-back" data-act="to-list">‹ All content</button>
    <div class="center-head"><div class="eyebrow">${caE(CA_PRODUCTS[w.product] || w.product || "")}</div><h1>${caE(w.title || c.id)}</h1></div>
    ${c.status !== "live" ? `<div class="ca-meta">${caChip(c.status)} The course title and summary go live with its first approved lesson.</div>` : ""}
    ${w.summary ? `<p class="ca-help">${caE(w.summary)}</p>` : ""}
    <div class="ca-actions"><button class="qb-btn-primary" data-act="preview" data-id="${caE(c.id)}">Preview as a rep</button><button class="ca-small" data-act="export">Export as a file</button></div>
    ${mods}`;
}

function caEditFormHTML(){
  const e = CA.editing, v = e.value || {};
  const errs = e.errors && e.errors.length ? `<div class="rv-error"><ul>${e.errors.map((x) => `<li>${caE(x.message)}</li>`).join("")}</ul></div>` : "";
  const goesLive = e.wasLive ? "Save. Reps see it now." : "Save draft";
  if (e.kind === "lesson") {
    return `<section class="ca-card ca-edit"><h2>Edit lesson</h2>
      <label>Title<input class="rv-input" id="caF_title" value="${caE(v.title)}"></label>
      <label>Type<select class="rv-input" id="caF_type">${Object.keys(CA_TYPES).map((t) => `<option value="${t}"${t === v.type ? " selected" : ""}>${CA_TYPES[t]}</option>`).join("")}</select></label>
      <label>Minutes (optional)<input class="rv-input" id="caF_minutes" inputmode="numeric" value="${caE(v.minutes || "")}"></label>
      <label>Link: video or role-play (https://…)<input class="rv-input" id="caF_url" value="${caE(v.url || "")}"></label>
      <label>Library document id (document lessons)<input class="rv-input" id="caF_doc" value="${caE(v.doc || "")}"></label>
      <label>Role-play goal<input class="rv-input" id="caF_goal" value="${caE(v.goal || "")}"></label>
      <label>Text (Markdown)<textarea class="ca-textarea" id="caF_body">${caE(v.body || "")}</textarea></label>
      ${errs}
      <div class="ca-actions"><button class="ca-small" data-act="edit-cancel">Cancel</button><button class="qb-btn-primary" data-act="edit-save">${goesLive}</button></div>
    </section>`;
  }
  const choices = (v.choices || []).map((c) => `[${c.correct ? "x" : " "}] ${c.text}`).join("\n");
  return `<section class="ca-card ca-edit"><h2>Edit question</h2>
    <label>Question<textarea class="ca-textarea short" id="caF_prompt">${caE(v.prompt || "")}</textarea></label>
    <label>Choices: one per line, [x] marks a right answer<textarea class="ca-textarea short" id="caF_choices">${caE(choices)}</textarea></label>
    <label>Explanation (shown when a rep gets it wrong)<textarea class="ca-textarea short" id="caF_expl">${caE(v.explanation || "")}</textarea></label>
    ${errs}
    <div class="ca-actions"><button class="ca-small" data-act="edit-cancel">Cancel</button><button class="qb-btn-primary" data-act="edit-save">${goesLive}</button></div>
  </section>`;
}

function caLessonHTML(){
  const c = caCourse(), l = caLesson();
  const back = `<button class="ca-back" data-act="open-course" data-id="${caE(CA.courseId)}">‹ ${caE(caW(c).title || "Course")}</button>`;
  if (!l) return back + `<div class="rv-empty">That lesson is gone.</div>`;
  if (CA.editing && CA.editing.kind === "lesson" && CA.editing.id === l.id) return back + caEditFormHTML();
  const w = caW(l);
  return `${back}
    <div class="center-head"><div class="eyebrow">${caE(CA_TYPES[w.type] || w.type)}</div><h1>${caE(w.title || l.id)}</h1></div>
    <div class="ca-meta">${caChip(l.status)} <code>${caE(l.id)}</code>${l.approvedBy ? ` · approved ${caWhen(l.approvedAt)} by ${caE(l.approvedBy)}` : ""}</div>
    ${l.draft ? `<section class="ca-card ca-draft"><h2>${l.live ? "Changes waiting for approval" : "Draft, waiting for approval"}</h2>${caLessonPreview(l.draft)}
      <div class="ca-actions">${l.live ? `<button class="ca-small" data-act="discard" data-kind="lesson" data-id="${caE(l.id)}">Discard changes</button>` : ""}
      <button class="qb-btn-primary" data-act="approve" data-kind="lesson" data-id="${caE(l.id)}">Approve and make it live</button></div></section>` : ""}
    ${l.live ? `<section class="ca-card"><h2>Live: what reps see</h2>${caLessonPreview(l.live)}</section>` : ""}
    <div class="ca-actions"><button class="ca-small" data-act="retire" data-kind="lesson" data-id="${caE(l.id)}">Retire this lesson</button></div>
    <div class="ca-actions">
      <button class="ca-small" data-act="history" data-kind="lesson" data-id="${caE(l.id)}">History</button>
      <button class="qb-btn-primary" data-act="edit" data-kind="lesson" data-id="${caE(l.id)}">Edit</button>
    </div>`;
}

function caQuizHTML(){
  const c = caCourse(), m = caModule();
  const back = `<button class="ca-back" data-act="open-course" data-id="${caE(CA.courseId)}">‹ ${caE(caW(c).title || "Course")}</button>`;
  if (!m) return back + `<div class="rv-empty">That quiz is gone.</div>`;
  if (CA.editing && CA.editing.kind === "question") return back + caEditFormHTML();
  const waiting = m.questions.some((q) => q.draft);
  return `${back}
    <div class="center-head"><div class="eyebrow">Quiz · pass mark ${caW(m).pass || 80}%</div><h1>${caE(caW(m).title || m.id)}</h1></div>
    ${waiting ? `<div class="rv-note">Quizzes are approved as a whole. Approving makes every question below live at once.
      <div class="ca-actions"><button class="qb-btn-primary" data-act="approve" data-kind="quiz" data-id="${caE(m.id)}">Approve quiz</button></div></div>` : ""}
    ${m.questions.map((q, i) => `<section class="ca-card">
      <div class="ca-module-head"><h3>Question ${i + 1}</h3>${caChip(q.status)}</div>
      ${q.draft && q.live ? `<div class="ca-meta">Showing the changes waiting for approval.</div>` : ""}
      ${caQuestionPreview(caW(q))}
      <div class="ca-actions">${q.draft && q.live ? `<button class="ca-small" data-act="discard" data-kind="question" data-id="${caE(q.id)}">Discard changes</button>` : ""}
        <button class="ca-small" data-act="history" data-kind="question" data-id="${caE(q.id)}">History</button>
        <button class="ca-small" data-act="edit" data-kind="question" data-id="${caE(q.id)}">Edit</button></div>
    </section>`).join("")}`;
}

function caHistoryHTML(){
  const h = CA.historyOf || {};
  const back = `<button class="ca-back" data-act="history-back">‹ Back</button>`;
  if (!CA.history) return back + `<div class="rv-empty">Loading history…</div>`;
  return `${back}
    <div class="center-head"><div class="eyebrow">History</div><h1>${caE(h.title || h.id)}</h1></div>
    <p class="ca-help">Every change is kept. Restoring puts that version back exactly as it was (and is itself saved here, so it can be undone).</p>
    ${CA.history.map((v, i) => `<div class="ca-row-static">
      <div><div class="ca-row-title">${caE(CA_ACTIONS[v.action] || v.action)}${i === 0 ? " · current" : ""}</div>
      <div class="ca-meta">${caWhen(v.at)}${v.by ? " · " + caE(v.by) : ""}${v.note ? " · " + caE(v.note) : ""}</div></div>
      ${i === 0 ? "" : `<button class="ca-small" data-act="restore" data-version="${v.versionId}">Restore</button>`}
    </div>`).join("") || `<div class="rv-empty">No history yet.</div>`}`;
}

// ── actions ─────────────────────────────────────────────────────────────
async function caRefresh(msg){
  CA.msg = msg || null;
  const t = await caApi("/tree?view=owner");
  if (t.data.ok) CA.tree = t.data.courses;
  const d = await caApi("/refdocs");
  if (d.data.ok) CA.refdocs = d.data.docs;
  renderContentAdmin();
}

function caOnFile(ev){ caReadFiles(ev.target.files); }
// Picked or dropped files wait in CA.pendingFiles until Import.
async function caReadFiles(list){
  const files = Array.from(list || []).slice(0, 30);
  if (!files.length) return;
  const read = (f) => new Promise((res) => { const rd = new FileReader(); rd.onload = () => res({ name: f.name, text: String(rd.result || "") }); rd.onerror = () => res(null); rd.readAsText(f); });
  for (const f of files) {
    const got = await read(f);
    if (!got) continue;
    const i = CA.pendingFiles.findIndex((x) => x.name === got.name);
    if (i >= 0) CA.pendingFiles[i] = got; else CA.pendingFiles.push(got);
  }
  renderContentAdmin();
}

function caFindItem(kind, id){
  for (const c of CA.tree || []) for (const m of c.modules) {
    if (kind === "lesson") { const l = m.lessons.find((x) => x.id === id); if (l) return l; }
    if (kind === "question") { const q = m.questions.find((x) => x.id === id); if (q) return q; }
  }
  return null;
}

function caReadEditForm(){
  const g = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  if (CA.editing.kind === "lesson") {
    const v = { title: g("caF_title").trim(), type: g("caF_type"), body: g("caF_body") };
    const mins = g("caF_minutes").trim(); if (mins) v.minutes = mins;
    for (const k of ["url", "doc", "goal"]) { const x = g("caF_" + k).trim(); if (x) v[k] = x; }
    return v;
  }
  const choices = g("caF_choices").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^\[( |x|X)\]\s*(.*)$/.exec(l);
    return m ? { text: m[2], correct: m[1] !== " " } : { text: l, correct: false };
  });
  return { prompt: g("caF_prompt").trim(), choices, explanation: g("caF_expl").trim() };
}

async function caOnClick(ev){
  const b = ev.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act, id = b.dataset.id, kind = b.dataset.kind;
  if (act === "reload") { CA.tree = null; CA.error = null; return caLoad(); }
  if (act === "to-list") { CA.view = "list"; CA.editing = null; CA.msg = null; return renderContentAdmin(); }
  if (act === "preview") {
    // Plays the course with its drafts, the way a rep will see it once approved.
    // Nothing is published or saved (see cpStartPreview in js/course-player.js).
    if (typeof cpStartPreview !== "function") return;
    cpStartPreview(id); appView = "courses"; renderApp(); return window.scrollTo(0, 0);
  }
  if (act === "open-course") { CA.view = "course"; CA.courseId = id; CA.editing = null; CA.msg = null; return renderContentAdmin(); }
  if (act === "open-lesson") { CA.view = "lesson"; CA.moduleId = b.dataset.module; CA.lessonId = id; CA.editing = null; CA.msg = null; return renderContentAdmin(); }
  if (act === "open-quiz") { CA.view = "quiz"; CA.moduleId = b.dataset.module; CA.editing = null; CA.msg = null; return renderContentAdmin(); }
  if (act === "drop-file") { CA.pendingFiles.splice(+id, 1); return renderContentAdmin(); }
  if (act === "import") {
    let files = CA.pendingFiles.slice();
    if (!files.length) {
      const text = (document.getElementById("caImportText") || {}).value || "";
      if (!text.trim()) { CA.imports = [{ name: "", data: { ok: false, errors: [{ message: "Choose course files, or paste one, first." }] } }]; return renderContentAdmin(); }
      CA.importText = text; files = [{ name: "Pasted file", text }];
    }
    CA.busy = true; CA.review = null; CA.retireOff = {}; renderContentAdmin();
    const results = [];
    for (const f of files) {
      const r = await caPost("/import", { text: f.text, format: /\.json$/i.test(f.name) ? "json" : undefined });
      results.push({ name: f.name, data: r.data });
    }
    CA.busy = false; CA.imports = results;
    if (results.every((x) => x.data.ok)) { CA.pendingFiles = []; CA.importText = ""; }
    else CA.pendingFiles = files.filter((f, i) => !results[i].data.ok && f.name !== "Pasted file");
    return caRefresh();
  }
  if (act === "approve-all") {
    const n = caPendingCount(), retire = caRetireList();
    if (!n && !retire.length) { CA.msg = "Nothing is waiting for approval."; return renderContentAdmin(); }
    const q = `Approve ${n} item${n === 1 ? "" : "s"}${retire.length ? ` and retire ${retire.length}` : ""}? Reps see the approved items right away.`;
    if (!confirm(q)) return;
    CA.busy = true; renderContentAdmin();
    const r = await caPost("/approve-all", { courseIds: caImportedCourseIds(), retire });
    CA.busy = false;
    if (r.data.ok) for (const x of retire) caMarkRetired(x.kind, x.id);
    return caRefresh(r.data.ok ? `Approved ${r.data.approved} item${r.data.approved === 1 ? "" : "s"}${r.data.retired ? ` and retired ${r.data.retired}` : ""}. Reps see them now.` : (r.data.error || "Couldn't approve."));
  }
  if (act === "review-start" || act === "review-item") {
    CA.review = { queue: caReviewQueue(), at: 0, approved: {}, skipped: {}, justApproved: null, done: false };
    if (act === "review-item") {
      const i = CA.review.queue.findIndex((x) => x.kind === kind && x.id === id);
      if (i < 0) { CA.review = null; CA.msg = "That item is already live."; return renderContentAdmin(); }
      CA.review.at = i;
    }
    if (!CA.review.queue.length) { CA.review = null; CA.msg = "Nothing is waiting for approval."; return renderContentAdmin(); }
    return caReviewOpen(CA.review.at);
  }
  if (act === "review-go") return caReviewOpen(+id);
  if (act === "review-skip") {
    const r = CA.review; if (!r) return;
    const cur = r.queue[r.at]; if (cur) r.skipped[cur.kind + ":" + cur.id] = true;
    return caReviewOpen(r.at + 1);
  }
  if (act === "review-next-pending") return caReviewOpen(caReviewNextPending(CA.review.at));
  if (act === "review-exit") { CA.review = null; CA.view = "list"; CA.editing = null; CA.msg = null; renderContentAdmin(); return window.scrollTo(0, 0); }
  if (act === "approve") {
    const quick = b.dataset.quick === "1" || !!CA.review;
    const what = kind === "quiz" ? "this quiz (every question in it)" : "this lesson";
    if (!quick && !confirm(`Make ${what} live for every rep now?`)) return;
    const r = await caPost("/approve", { kind, id });
    if (r.data.ok && CA.review) {
      const key = kind + ":" + id;
      CA.review.approved[key] = true; delete CA.review.skipped[key];
      CA.review.justApproved = key;
      // The last one waiting? Straight to "All done".
      if (caReviewNextPending(CA.review.at) >= CA.review.queue.length) CA.review.done = true;
      return caRefresh(r.data.ok ? null : (r.data.error || "Couldn't approve."));
    }
    return caRefresh(r.data.ok ? (kind === "quiz" ? "Quiz approved. It's live." : "Approved. Reps can see it now.") : (r.data.error || "Couldn't approve."));
  }
  if (act === "retire") {
    if (!confirm(`Retire this ${kind}? Reps stop seeing it right away. It stays in its history and comes back if a later import includes it.`)) return;
    const r = await caPost("/retire", { kind, id });
    if (r.data.ok) caMarkRetired(kind, id);
    if (r.data.ok && CA.view === "lesson") { CA.view = "course"; CA.editing = null; }
    return caRefresh(r.data.ok ? "Retired. Reps no longer see it." : (r.data.error || "Couldn't retire."));
  }
  if (act === "discard") {
    if (!confirm("Throw away the changes waiting for approval? The live version stays as it is.")) return;
    const r = await caPost("/discard", { kind, id });
    return caRefresh(r.data.ok ? "Changes discarded." : (r.data.error || "Couldn't discard."));
  }
  if (act === "edit") {
    const item = caFindItem(kind, id);
    if (!item) return;
    CA.editing = { kind, id, value: JSON.parse(JSON.stringify(caW(item))), wasLive: !!item.live, errors: null };
    return renderContentAdmin();
  }
  if (act === "edit-cancel") { CA.editing = null; return renderContentAdmin(); }
  if (act === "edit-save") {
    const value = caReadEditForm();
    CA.editing.value = value;
    const r = await caPost("/edit", { kind: CA.editing.kind, id: CA.editing.id, value });
    if (!r.data.ok) { CA.editing.errors = r.data.errors || [{ message: r.data.error || "Couldn't save." }]; return renderContentAdmin(); }
    const live = r.data.target === "live";
    CA.editing = null;
    return caRefresh(r.data.unchanged ? "No changes to save." : live ? "Saved. Reps see it now." : "Draft saved. Approve it to make it live.");
  }
  if (act === "history") {
    const item = kind === "refdoc" ? null : caFindItem(kind, id);
    CA.historyOf = { kind, id, title: kind === "refdoc" ? `Presentation training: ${id}` : (caW(item).title || (caW(item).prompt || "").slice(0, 60) || id), back: { view: CA.view } };
    CA.history = null; CA.view = "history"; CA.msg = null; renderContentAdmin();
    const r = await caApi(`/history?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
    CA.history = r.data.ok ? r.data.versions : [];
    if (!r.data.ok) CA.msg = r.data.error || "Couldn't load history.";
    return renderContentAdmin();
  }
  if (act === "history-back") { CA.view = (CA.historyOf && CA.historyOf.back && CA.historyOf.back.view) || "list"; CA.history = null; return renderContentAdmin(); }
  if (act === "restore") {
    if (!confirm("Restore this version? It replaces what's there now (you can undo this from History).")) return;
    const r = await caPost("/restore", { versionId: Number(b.dataset.version) });
    if (r.data.ok && CA.historyOf && CA.historyOf.kind === "refdoc" && typeof tcResetContent === "function") tcResetContent();
    CA.view = (CA.historyOf && CA.historyOf.back && CA.historyOf.back.view) || "list"; CA.history = null;
    return caRefresh(r.data.ok ? "Restored." : (r.data.error || "Couldn't restore."));
  }
  if (act === "export") {
    try {
      const r = await rvAuthedFetch(`${caBase()}/api/raven/content/export?course=${encodeURIComponent(CA.courseId)}`);
      if (!r.ok) { CA.msg = "Couldn't export that course."; return renderContentAdmin(); }
      const text = await r.text();
      const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
      const a = document.createElement("a"); a.href = url; a.download = `${CA.courseId}.md`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { CA.msg = "Couldn't export that course."; renderContentAdmin(); }
  }
}

// Sign-out or a different person: forget everything this screen loaded.
window.addEventListener("raven-session-changed", () => {
  Object.assign(CA, { view: "list", tree: null, refdocs: null, error: null, msg: null, editing: null, history: null, importReport: null, importText: "",
    pendingFiles: [], imports: null, retireOff: {}, review: null });
  if (typeof appView !== "undefined" && appView === "home" && typeof renderHome === "function") renderHome();
});

// ── Import summary (Jack, 2026-11-27) ──────────────────────────────────
const CA_KIND = { course: "Course", module: "Module", lesson: "Lesson", question: "Question" };
function caImportedCourseIds(){ return (CA.imports || []).filter((x) => x.data && x.data.ok).map((x) => x.data.course.id); }
function caTreeCourse(id){ return (CA.tree || []).find((c) => c.id === id) || null; }
// The item's current state in RAVN (from the tree): live, waiting or gone.
function caItemState(kind, id){
  if (kind === "lesson" || kind === "question") {
    const it = caFindItem(kind, id);
    if (!it) return "gone";
    return it.draft ? "waiting" : "live";
  }
  for (const c of CA.tree || []) {
    if (kind === "course" && c.id === id) return c.draft ? "waiting" : "live";
    for (const m of c.modules) if (kind === "module" && m.id === id) return m.draft ? "waiting" : "live";
  }
  return "gone";
}
function caPendingCount(){
  let n = 0;
  for (const id of caImportedCourseIds()) {
    const c = caTreeCourse(id); if (!c) continue;
    if (c.draft) n++;
    for (const m of c.modules) { if (m.draft) n++; n += m.lessons.filter((l) => l.draft).length + m.questions.filter((q) => q.draft).length; }
  }
  return n;
}
function caRetireList(){
  const out = [];
  for (const imp of CA.imports || []) {
    if (!imp.data || !imp.data.ok) continue;
    for (const x of imp.data.report.notInFile || []) {
      if ((x.kind !== "lesson" && x.kind !== "question") || x.retired) continue;
      if (CA.retireOff[x.kind + ":" + x.id]) continue;
      out.push({ kind: x.kind, id: x.id });
    }
  }
  return out;
}
function caMarkRetired(kind, id){
  for (const imp of CA.imports || []) if (imp.data && imp.data.ok) for (const x of imp.data.report.notInFile || []) if (x.kind === kind && x.id === id) x.retired = true;
}

// Word-level change view: removed words struck through in red, added in
// green. Each item is turned into plain text (title, then body or question).
function caItemText(kind, v){
  v = v || {};
  if (kind === "question") return [v.prompt || "", ...(v.choices || []).map((c) => `${c.correct ? "[x]" : "[ ]"} ${c.text}`), v.explanation ? "Explanation: " + v.explanation : ""].join("\n");
  if (kind === "lesson") {
    const meta = [v.type ? "Type: " + v.type : "", v.minutes ? "Minutes: " + v.minutes : "", v.url ? "Link: " + v.url : "", v.goal ? "Goal: " + v.goal : ""].filter(Boolean).join("\n");
    return [v.title ? "Title: " + v.title : "", meta, v.body || ""].filter(Boolean).join("\n");
  }
  return [v.title ? "Title: " + v.title : "", v.summary || "", v.pass ? "Pass mark: " + v.pass : ""].filter(Boolean).join("\n");
}
function caDiff(a, b){
  const A = String(a).split(/(\s+)/), B = String(b).split(/(\s+)/);
  // Trim the common start and end so the table stays small.
  let s0 = 0; while (s0 < A.length && s0 < B.length && A[s0] === B[s0]) s0++;
  let e = 0; while (e < A.length - s0 && e < B.length - s0 && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
  const a2 = A.slice(s0, A.length - e), b2 = B.slice(s0, B.length - e);
  const ops = [];
  if (a2.length * b2.length > 2500000) { ops.push(["-", a2.join("")], ["+", b2.join("")]); }
  else {
    const n = a2.length, m = b2.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a2[i] === b2[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) { if (a2[i] === b2[j]) { ops.push(["=", a2[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) ops.push(["-", a2[i++]]); else ops.push(["+", b2[j++]]); }
    while (i < n) ops.push(["-", a2[i++]]); while (j < m) ops.push(["+", b2[j++]]);
  }
  return { head: A.slice(0, s0).join(""), ops, tail: A.slice(A.length - e).join("") };
}
function caDiffHTML(kind, before, after){
  const d = caDiff(caItemText(kind, before), caItemText(kind, after));
  const clip = (t, keepEnd) => { const w = t.split(/(\s+)/); return w.length > 24 ? (keepEnd ? "… " + w.slice(-24).join("") : w.slice(0, 24).join("") + " …") : t; };
  let added = 0, removed = 0;
  const mid = d.ops.map(([op, t]) => {
    if (op === "=") return caE(t);
    if (/^\s+$/.test(t)) return caE(t);
    if (op === "+") { added++; return `<ins class="ca-ins">${caE(t)}</ins>`; }
    removed++; return `<del class="ca-del">${caE(t)}</del>`;
  }).join("");
  return { html: `<div class="ca-diff">${caE(clip(d.head, true))}${mid}${caE(clip(d.tail, false))}</div>`, added, removed };
}

function caImportSummaryHTML(){
  const imps = CA.imports;
  if (!imps || !imps.length) return "";
  const okOnes = imps.filter((x) => x.data && x.data.ok);
  const blocks = imps.map((imp) => {
    const d = imp.data || {};
    if (!d.ok) return `<div class="rv-error ca-report"><b>${imp.name ? caE(imp.name) + ": " : ""}nothing was imported from this file. Fix these and try again:</b><ul>${(d.errors || [{ message: d.error || "Couldn't import." }]).map((e) =>
      `<li>${e.line ? `Line ${e.line}: ` : e.path ? `${caE(e.path)}: ` : ""}${caE(e.message)}</li>`).join("")}</ul></div>`;
    const r = d.report, cid = d.course.id;
    const row = (x, withDiff) => {
      const st = caItemState(x.kind, x.id), key = x.kind + ":" + x.id;
      const canReview = x.kind === "lesson" || x.kind === "question";
      const reviewKind = x.kind === "question" ? "quiz" : x.kind, reviewId = x.kind === "question" ? x.parent : x.id;
      const actions = st === "waiting" && canReview ? `<span class="ca-row-acts">
          <button class="ca-small" data-act="review-item" data-kind="${caE(reviewKind)}" data-id="${caE(reviewId)}">Review</button>
          <button class="ca-small ca-approve" data-act="approve" data-quick="1" data-kind="${caE(reviewKind)}" data-id="${caE(reviewId)}">${x.kind === "question" ? "Approve quiz" : "Approve"}</button></span>` : "";
      const chip = st === "live" ? `<span class="ca-chip live">Live</span>` : st === "waiting" ? `<span class="ca-chip pending">Waiting</span>` : `<span class="ca-chip draft">Gone</span>`;
      let diff = "";
      if (withDiff && (x.before || x.after)) {
        const dd = caDiffHTML(x.kind, x.before, x.after);
        diff = `<details class="ca-changes"><summary>Show changes${dd.added || dd.removed ? ` <span class="ca-meta">(${dd.removed ? dd.removed + " removed" : ""}${dd.removed && dd.added ? ", " : ""}${dd.added ? dd.added + " added" : ""})</span>` : ""}</summary>${dd.html}</details>`;
      }
      return `<li class="ca-irow" data-key="${caE(key)}"><div class="ca-irow-main"><span class="ca-kind">${caE(CA_KIND[x.kind] || x.kind)}</span>
        <span class="ca-irow-title">${caE(x.title || x.id)}</span> <code>${caE(x.id)}</code></div>
        <div class="ca-irow-side">${chip}${actions}</div>${diff}</li>`;
    };
    const sec = (title, arr, open, withDiff) => arr.length ? `<details class="ca-isec"${open ? " open" : ""}><summary><b>${title}</b> <span class="ca-count">${arr.length}</span></summary><ul class="ca-ilist">${arr.map((x) => row(x, withDiff)).join("")}</ul></details>` : "";
    const nif = (r.notInFile || []).length ? `<details class="ca-isec" open><summary><b>Not in this file</b> <span class="ca-count">${r.notInFile.length}</span></summary>
      <p class="ca-help">These are in RAVN but not in the file. Ticked lessons and questions are retired when you tap "Approve all and retire checked". Untick anything you want to keep.</p>
      <ul class="ca-ilist">${r.notInFile.map((x) => {
        const key = x.kind + ":" + x.id, can = x.kind === "lesson" || x.kind === "question";
        return `<li class="ca-irow"><div class="ca-irow-main">${can && !x.retired ? `<label class="ca-check"><input type="checkbox" data-retire="${caE(key)}"${CA.retireOff[key] ? "" : " checked"}> Retire</label>` : ""}
          <span class="ca-kind">${caE(CA_KIND[x.kind] || x.kind)}</span> <span class="ca-irow-title">${caE(x.title || x.id)}</span> <code>${caE(x.id)}</code></div>
          <div class="ca-irow-side">${x.retired ? `<span class="ca-chip draft">Retired</span>` : can ? "" : `<span class="ca-meta">Kept</span>`}</div></li>`;
      }).join("")}</ul></details>` : "";
    return `<section class="ca-icourse">
      <div class="ca-icourse-head"><div><div class="ca-eyebrow">${caE(imp.name || "")}</div><h3>${caE(d.course.title || cid)}</h3></div>
        <button class="ca-small" data-act="open-course" data-id="${caE(cid)}">Open course</button></div>
      <div class="ca-tally"><span><b>${r.created.length}</b> new</span><span><b>${r.updated.length}</b> updated</span><span><b>${r.unchanged.length}</b> unchanged</span><span><b>${(r.notInFile || []).length}</b> not in this file</span></div>
      ${sec("New", r.created, true, false)}${sec("Updated", r.updated, true, true)}${sec("Unchanged", r.unchanged, false, false)}${nif}
      ${(r.warnings || []).length ? `<div class="ca-meta">Warnings: ${r.warnings.map((w) => caE(w.message)).join("; ")}</div>` : ""}
    </section>`;
  }).join("");
  const pending = caPendingCount(), retire = caRetireList().length;
  const foot = okOnes.length ? `<div class="ca-ifoot">
      <div class="ca-meta">${pending} waiting for approval${retire ? ` · ${retire} to retire` : ""}</div>
      <div class="ca-actions">
        <button class="ca-small" data-act="review-start"${pending ? "" : " disabled"}>Review one by one</button>
        <button class="qb-btn-primary" data-act="approve-all"${CA.busy || (!pending && !retire) ? " disabled" : ""}>Approve all and retire checked</button>
      </div></div>` : "";
  return `<div class="ca-isummary"><h2 class="ca-isum-title">Import summary</h2>${blocks}${foot}</div>`;
}

// ── Review one by one ───────────────────────────────────────────────────
function caReviewQueue(){
  const q = [];
  for (const cid of caImportedCourseIds()) {
    const c = caTreeCourse(cid); if (!c) continue;
    for (const m of c.modules) {
      for (const l of m.lessons) if (l.draft) q.push({ kind: "lesson", id: l.id, moduleId: m.id, courseId: c.id, title: caW(l).title || l.id });
      if (m.questions.some((x) => x.draft)) q.push({ kind: "quiz", id: m.id, moduleId: m.id, courseId: c.id, title: `${caW(m).title || m.id}: quiz` });
    }
  }
  return q;
}
// The next item after `from` that hasn't been approved (queue length = none).
function caReviewNextPending(from){
  const r = CA.review; if (!r) return 0;
  for (let i = from + 1; i < r.queue.length; i++) if (!r.approved[r.queue[i].kind + ":" + r.queue[i].id]) return i;
  return r.queue.length;
}
function caReviewOpen(i){
  const r = CA.review; if (!r) return;
  if (i >= r.queue.length) { r.done = true; renderContentAdmin(); return window.scrollTo(0, 0); }
  r.at = Math.max(0, i); r.justApproved = null; r.done = false;
  const it = r.queue[r.at];
  CA.courseId = it.courseId; CA.moduleId = it.moduleId; CA.editing = null; CA.msg = null;
  if (it.kind === "lesson") { CA.view = "lesson"; CA.lessonId = it.id; } else CA.view = "quiz";
  renderContentAdmin(); window.scrollTo(0, 0);
}
function caReviewBarHTML(){
  const r = CA.review; if (!r || r.done) return "";
  const it = r.queue[r.at]; if (!it) return "";
  const key = it.kind + ":" + it.id, n = r.queue.length;
  const nextI = caReviewNextPending(r.at), next = r.queue[nextI];
  const ok = r.justApproved === key ? `<div class="ca-approved"><div class="ca-approved-title">Approved. Reps can see it now.</div>
      ${next ? `<button class="qb-btn-primary" data-act="review-next-pending">Next: ${caE(next.title)}</button>` : `<button class="qb-btn-primary" data-act="review-go" data-id="${n}">All done</button>`}</div>` : "";
  return `<div class="ca-rbar">
      <button class="ca-rnav" data-act="review-go" data-id="${r.at - 1}"${r.at === 0 ? " disabled" : ""} aria-label="Previous item">‹ Back</button>
      <div class="ca-rpos"><b>${r.at + 1} of ${n}</b><span>${r.approved[key] ? "Approved" : r.skipped[key] ? "Skipped" : "Waiting for approval"}</span></div>
      <button class="ca-rnav" data-act="review-go" data-id="${r.at + 1}" aria-label="Next item">Next ›</button>
    </div>
    <div class="ca-rlinks"><button class="ca-link" data-act="review-exit">Back to the summary</button>${r.approved[key] ? "" : `<button class="ca-link" data-act="review-skip">Skip</button>`}</div>
    ${ok}`;
}
function caReviewDoneHTML(){
  const r = CA.review;
  const approved = Object.keys(r.approved).length;
  const skipped = Object.keys(r.skipped).filter((k) => !r.approved[k]).length;
  return `<section class="ca-card ca-done">
      <div class="ca-eyebrow">Review</div><h2>All done</h2>
      <div class="ca-tally big"><span><b>${approved}</b> approved</span><span><b>${skipped}</b> skipped</span></div>
      ${skipped ? `<p class="ca-help">Skipped items are still waiting for approval. You'll find them in the summary.</p>` : ""}
      <div class="ca-actions"><button class="qb-btn-primary" data-act="review-exit">Back to the summary</button></div>
    </section>`;
}
