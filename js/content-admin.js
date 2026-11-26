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
};

function caIsOwner(){
  const id = (typeof rvIdentity === "function") ? rvIdentity() : null;
  return !!(id && Array.isArray(id.capabilities) && id.capabilities.indexOf("manageTeam") >= 0);
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
  if (!caIsOwner()) {
    el.innerHTML = `<div class="qb-status"><h2>Owners only</h2><p>Sign in to RAVN with an owner account (email and password) to manage training content.</p></div>`;
    return;
  }
  if (CA.tree === null && !CA.loading && !CA.error) { caLoad(); return; }
  const msg = CA.msg ? `<div class="rv-note ca-msg">${caE(CA.msg)}</div>` : "";
  let body = "";
  if (CA.loading && !CA.tree) body = `<div class="rv-empty">Loading content…</div>`;
  else if (CA.error) body = `<div class="rv-error">${caE(CA.error)}</div><button class="qb-btn-primary" data-act="reload">Try again</button>`;
  else if (CA.view === "course") body = caCourseHTML();
  else if (CA.view === "lesson") body = caLessonHTML();
  else if (CA.view === "quiz") body = caQuizHTML();
  else if (CA.view === "history") body = caHistoryHTML();
  else body = caListHTML();
  el.innerHTML = `<div class="ca-wrap">${msg}${body}</div>`;
  el.onclick = caOnClick;
  const f = el.querySelector("#caFile");
  if (f) f.onchange = caOnFile;
  const ta = el.querySelector("#caImportText");
  if (ta) ta.oninput = () => { CA.importText = ta.value; };
}

function caListHTML(){
  const rep = CA.importReport;
  let report = "";
  if (rep && !rep.ok) {
    report = `<div class="rv-error ca-report"><b>Nothing was imported. Fix these and try again:</b><ul>${(rep.errors || []).map((e) =>
      `<li>${e.line ? `Line ${e.line}: ` : e.path ? `${caE(e.path)}: ` : ""}${caE(e.message)}</li>`).join("")}</ul></div>`;
  } else if (rep && rep.ok) {
    // Every row names the item: kind, id and title (Jack saw bare bullets on
    // staging, 2026-11-26). A row with nothing to show is left out, never blank.
    const CA_KIND = { course: "Course", module: "Module", lesson: "Lesson", question: "Question" };
    const item = (x) => (x && typeof x === "object") ? x : { id: String(x == null ? "" : x) };
    const list = (arr) => (arr || []).map(item).filter((x) => x.id || x.title).map((x) =>
      `<li><b>${caE(CA_KIND[x.kind] || x.kind || "Item")}</b> <code>${caE(x.id || "")}</code>${x.title ? ": " + caE(x.title) : ""}</li>`).join("");
    const r = rep.report;
    report = `<div class="rv-note ca-report"><b>Imported “${caE(rep.course.title)}” as drafts.</b>
      ${r.created.length} new · ${r.updated.length} updated · ${r.unchanged.length} unchanged${r.moved && r.moved.length ? ` · ${r.moved.length} moved` : ""}.
      ${r.created.length ? `<details><summary>New</summary><ul>${list(r.created)}</ul></details>` : ""}
      ${r.updated.length ? `<details open><summary>Updated (waiting for your approval)</summary><ul>${list(r.updated)}</ul></details>` : ""}
      ${r.notInFile.length ? `<details open><summary>In RAVN but not in this file (kept, not deleted)</summary><ul>${r.notInFile.map((x) =>
        `<li>${caE(x.kind)} <code>${caE(x.id)}</code>${x.title ? ": " + caE(x.title) : ""}${x.retired ? " · retired"
          : (x.kind === "lesson" || x.kind === "question") ? ` <button class="ca-small" data-act="retire" data-kind="${caE(x.kind)}" data-id="${caE(x.id)}">Retire</button>` : ""}</li>`).join("")}</ul></details>` : ""}
      ${(r.warnings || []).length ? `<div>Warnings: ${r.warnings.map((w) => caE(w.message)).join("; ")}</div>` : ""}
      <button class="qb-btn-primary" data-act="open-course" data-id="${caE(rep.course.id)}">Review and approve</button></div>`;
  }
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
      <p class="ca-help">Paste a course file from Claude, or upload the .md or .json file. Everything imports as a draft. Nothing reaches reps until you approve it. Importing never deletes anything.</p>
      <textarea id="caImportText" class="ca-textarea" placeholder="---&#10;ravn: course/1&#10;course: foundations&#10;…" spellcheck="false">${caE(CA.importText)}</textarea>
      <div class="ca-actions">
        <label class="ca-small ca-file">Upload a file<input id="caFile" type="file" accept=".md,.markdown,.json,.txt,text/markdown,application/json,text/plain"></label>
        <button class="qb-btn-primary" data-act="import"${CA.busy ? " disabled" : ""}>${CA.busy ? "Importing…" : "Import"}</button>
      </div>
      ${report}
    </section>
    <section class="ca-card"><h2>Courses</h2>${courses}</section>
    <section class="ca-card"><h2>Presentation training</h2>
      <p class="ca-help">The coaching text behind Training Mode, which the AI grader also reads. Edit it in the Training Center (Edit → Save to RAVN); roll back here.</p>
      ${docs}</section>`;
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

function caOnFile(ev){
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { CA.importText = String(rd.result || ""); renderContentAdmin(); };
  rd.readAsText(f);
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
  if (act === "import") {
    const text = (document.getElementById("caImportText") || {}).value || "";
    if (!text.trim()) { CA.importReport = { ok: false, errors: [{ message: "Paste a course file or upload one first." }] }; return renderContentAdmin(); }
    CA.busy = true; CA.importText = text; renderContentAdmin();
    const r = await caPost("/import", { text });
    CA.busy = false; CA.importReport = r.data;
    if (r.data.ok) CA.importText = "";
    return caRefresh();
  }
  if (act === "approve") {
    const what = kind === "quiz" ? "this quiz (every question in it)" : "this lesson";
    if (!confirm(`Make ${what} live for every rep now?`)) return;
    const r = await caPost("/approve", { kind, id });
    return caRefresh(r.data.ok ? (kind === "quiz" ? "Quiz approved. It's live." : "Approved. Reps can see it now.") : (r.data.error || "Couldn't approve."));
  }
  if (act === "retire") {
    if (!confirm(`Retire this ${kind}? Reps stop seeing it right away. It stays in its history and comes back if a later import includes it.`)) return;
    const r = await caPost("/retire", { kind, id });
    if (r.data.ok && CA.importReport && CA.importReport.report) {
      for (const x of CA.importReport.report.notInFile) if (x.kind === kind && x.id === id) x.retired = true;
    }
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
  Object.assign(CA, { view: "list", tree: null, refdocs: null, error: null, msg: null, editing: null, history: null, importReport: null, importText: "" });
  if (typeof appView !== "undefined" && appView === "home" && typeof renderHome === "function") renderHome();
});
