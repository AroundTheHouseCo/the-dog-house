// RAVN — Courses (RAVN step 6): the course, lesson and quiz player.
//
// Everything about WHAT a rep may open and HOW FAR ALONG they are is decided
// by Cockpit (/api/raven/content/learn — ravn-progress.js there): this file
// only shows it. Quizzes are graded on the server; the app never receives the
// correct answers or explanations until the rep submits.
//
// Rules the server applies (Jack's defaults, 2026-11-22): lessons open in
// order; a module opens when the one before it is complete; a module's quiz
// opens when its lessons are done; pass mark per module (default 80%),
// unlimited retakes, questions and choices shuffled on every try; a course
// with a prerequisite stays locked until that course is complete. Progress
// is kept per person in Cockpit, so it follows the rep across devices.
//
// One column, big tap targets — iPhone and iPad alike.

const CP = {
  view: "list",      // list | course | lesson | quiz | result
  data: null, loading: false, error: null, busy: false,
  courseId: null, lessonId: null, moduleId: null,
  quiz: null,        // {moduleId, title, pass, questions (shuffled), answers:{qid:Set}}
  result: null,      // server grade + the quiz it was for
  // "Preview as a rep" (owners, from Content): one course with its drafts,
  // played with the rep rules. Progress lives only here and is sent with
  // every call; Cockpit stores nothing. null = a normal rep session.
  preview: null,     // {courseId, progress:{lessonsDone:[], quizBest:{}}}
};

function cpBase(){ return self.RAVN_API_BASE || "https://ath-cockpit.onrender.com"; }
async function cpApi(path, opts){
  let r;
  try { r = await rvAuthedFetch(cpBase() + "/api/raven/content" + path, opts); }
  catch (e) { return { status: 0, data: { ok: false, error: navigator.onLine ? "Couldn't reach Cockpit." : "You're offline. Courses need a connection." } }; }
  const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  return { status: r.status, data };
}
const cpPost = (path, body) => cpApi(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const cpE = (s) => (typeof ravnEsc === "function" ? ravnEsc(s) : String(s == null ? "" : s));
const CP_TYPES = { reading: "Reading", video: "Video", script: "Script", checklist: "Checklist", roleplay: "Role-play", document: "Library document" };

const cpPrev = (op, extra) => cpPost("/preview", Object.assign({ op, courseId: CP.preview.courseId, progress: CP.preview.progress }, extra || {}));
async function cpLoad(){
  CP.loading = true; CP.error = null; renderCourses();
  const r = CP.preview ? await cpPrev("view") : await cpApi("/learn");
  CP.loading = false;
  if (!r.data.ok) CP.error = r.status === 503 ? "Courses aren't set up on Cockpit yet." : (r.data.error || "Couldn't load courses.");
  else CP.data = r.data;
  renderCourses();
}
function cpTake(data){ if (data && data.courses) { CP.data.courses = data.courses; CP.data.overall = data.overall; } }

const cpCourse = () => (CP.data && CP.data.courses || []).find((c) => c.id === CP.courseId) || null;
function cpFindLesson(id){
  for (const c of (CP.data && CP.data.courses) || []) for (const m of c.modules) {
    const i = m.lessons.findIndex((l) => l.id === id);
    if (i >= 0) return { course: c, module: m, lesson: m.lessons[i], index: i };
  }
  return null;
}
function cpBar(pct, label, done){
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return `<div class="rb-bar${done ? " is-done" : ""}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${cpE(label || "Progress")}">
    <div class="rb-bar-fill" style="width:${p}%"></div></div>`;
}
const cpI = (name) => (typeof LUCIDE !== "undefined" && LUCIDE[name]) || "";
// Every status is an icon AND a word.
const cpTagDone = (word) => `<span class="rb-tag done cp-tag">${cpI("circleCheck")}${word}</span>`;
const cpTagLock = (word) => `<span class="rb-tag locked cp-tag">${cpI("lock")}${word}</span>`;
const cpTagGo = (word) => `<span class="rb-tag go cp-tag">${cpI("arrowRight")}${word}</span>`;
const cpHead = (eyebrow, title) => `<div class="rb-head"><div class="rb-eyebrow">${cpE(eyebrow)}</div><h1>${cpE(title)}</h1></div>`;
const cpBack = (act, id, label) => `<button class="rb-back" data-cp="${act}"${id ? ` data-id="${cpE(id)}"` : ""}>${cpI("chevronLeft")}${cpE(label)}</button>`;

function renderCourses(){
  const el = document.getElementById("coursePanel");
  if (!el) return;
  if (typeof rvGetSession === "function" && !rvGetSession()) {
    el.innerHTML = `${cpHead("Training", "Courses")}<div class="rb-card"><h2>Sign in first</h2>
      <p>Your courses follow your RAVN sign-in. Open Start appointment, sign in, then come back here.</p></div>`;
    return;
  }
  if (CP.data === null && !CP.loading && !CP.error) { cpLoad(); return; }
  let body = "";
  const banner = CP.preview ? `<div class="rb-note cp-preview-banner">${cpI("bookOpen")} <b>Preview as a rep.</b> Drafts are included. Nothing you do here is saved, and reps only see what you approve.</div>` : "";
  if (CP.loading && !CP.data) body = `${cpHead("Training", "Courses")}<div class="rb-empty">Loading your courses…</div>`;
  else if (CP.error) body = `${cpHead("Training", "Courses")}<div class="rb-error">${cpE(CP.error)}</div>
    <button class="rb-btn" data-cp="reload">${cpI("rotateCcw")}Try again</button>`;
  else if (CP.view === "course") body = cpCourseHTML();
  else if (CP.view === "lesson") body = cpLessonHTML();
  else if (CP.view === "quiz") body = cpQuizHTML();
  else if (CP.view === "result") body = cpResultHTML();
  else body = cpListHTML();
  el.innerHTML = banner + body;
  el.onclick = cpOnClick;
  el.onchange = cpOnChange;
}

function cpListHTML(){
  const d = CP.data, courses = d.courses || [];
  if (!courses.length) return `${cpHead("Training", "Courses")}
    <div class="rb-card cp-empty"><h2>No courses yet. Check back soon.</h2></div>`;
  const cards = courses.map((c) => {
    const state = c.complete ? cpTagDone("Complete")
      : c.locked ? cpTagLock(`Finish ${cpE(c.requiresTitle)} first`)
      : `<span class="rb-btn block cp-tag cp-start">${c.unitsDone ? "Continue" : "Start"}${cpI("arrowRight")}</span>`;
    return `<button class="rb-row rb-course cp-course${c.locked ? " is-locked" : ""}" data-cp="open-course" data-id="${cpE(c.id)}">
      <span class="rb-row-main"><span class="rb-row-title">${cpE(c.title)}</span>
        ${c.summary ? `<span class="rb-meta">${cpE(c.summary)}</span>` : ""}
        ${cpBar(c.percent, c.title + " progress")}
        <span class="rb-meta">${c.unitsDone} of ${c.units} steps · ${c.modules.length} module${c.modules.length === 1 ? "" : "s"}</span></span>
      ${state}</button>`;
  }).join("");
  return `${cpHead("Training", "Courses")}
    <div class="rb-card cp-overall"><div class="cp-overall-head"><h2>Your training</h2><span class="rb-score-num cp-pct">${d.overall.percent}%</span></div>
      ${cpBar(d.overall.percent, "Your overall training progress")}
      <div class="rb-meta">${d.overall.unitsDone} of ${d.overall.units} steps done across every course</div></div>
    ${cards}`;
}

function cpCourseHTML(){
  const c = cpCourse();
  if (!c) { CP.view = "list"; return cpListHTML(); }
  const mods = c.modules.map((m, mi) => {
    const rows = m.lessons.map((l) => `
      <button class="rb-row cp-lesson${l.locked ? " is-locked" : ""}" data-cp="open-lesson" data-id="${cpE(l.id)}" ${l.locked ? "aria-disabled=\"true\"" : ""}>
        <span class="rb-row-main"><span class="rb-row-title">${cpE(l.title)}</span><span class="rb-hint">${cpE(CP_TYPES[l.type] || l.type)}${l.minutes ? " · " + l.minutes + " min" : ""}</span></span>
        ${l.done ? cpTagDone("Done") : l.locked ? cpTagLock("Locked") : cpTagGo("Start")}
      </button>`).join("");
    const q = m.quiz ? `
      <button class="rb-row cp-lesson cp-quizrow${m.quiz.locked ? " is-locked" : ""}" data-cp="open-quiz" data-id="${cpE(m.id)}" ${m.quiz.locked ? "aria-disabled=\"true\"" : ""}>
        <span class="rb-row-main"><span class="rb-row-title">Quiz · ${m.quiz.count} question${m.quiz.count === 1 ? "" : "s"}</span>
          <span class="rb-hint">Pass mark ${m.pass}%${m.quiz.best ? ` · your best ${m.quiz.best.score}%` : ""}</span></span>
        ${m.quiz.best && m.quiz.best.passed ? cpTagDone("Passed") : m.quiz.locked ? cpTagLock("Locked") : cpTagGo(m.quiz.best ? "Retake" : "Take quiz")}
      </button>` : "";
    const pct = m.units ? Math.round((m.unitsDone / m.units) * 100) : 0;
    return `<div class="rb-card cp-module${m.locked ? " is-locked" : ""}">
      <div class="cp-module-head"><h3>${mi + 1}. ${cpE(m.title)}</h3>${m.complete ? cpTagDone("Complete") : m.locked ? cpTagLock("Locked") : ""}</div>
      ${cpBar(pct, m.title + " progress")}
      ${m.locked && mi > 0 ? `<div class="rb-hint">Opens when you finish “${cpE(c.modules[mi - 1].title)}”.</div>` : ""}
      ${rows}${q}</div>`;
  }).join("");
  return `${CP.preview ? cpBack("exit-preview", "", "Back to Content") : cpBack("to-list", "", "All courses")}
    ${cpHead(c.locked ? "Locked" : c.complete ? "Complete" : c.percent + "% done", c.title)}
    ${c.locked ? `<div class="rb-note">${cpI("lock")} This course opens when you finish <b>${cpE(c.requiresTitle)}</b>.</div>` : ""}
    ${mods}`;
}

function cpYouTubeId(u){
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(u || ""));
  return m ? m[1] : null;
}
function cpLessonHTML(){
  const f = cpFindLesson(CP.lessonId);
  if (!f) { CP.view = "course"; return cpCourseHTML(); }
  const { module: m, lesson: l, index } = f;
  const md = (s) => (typeof ravnMd === "function" ? ravnMd(s || "") : `<p>${cpE(s)}</p>`);
  let media = "";
  if (l.type === "video" && l.url) {
    const yt = cpYouTubeId(l.url);
    media = yt
      ? `<div class="rb-video cp-video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0" title="${cpE(l.title)}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`
      : `<a class="rb-btn secondary" href="${cpE(l.url)}" target="_blank" rel="noopener noreferrer">${cpI("externalLink")}Open the video</a>`;
  } else if (l.type === "roleplay") {
    media = `${l.goal ? `<div class="rb-note"><b>Your goal:</b> ${cpE(l.goal)}</div>` : ""}
      ${l.url ? `<a class="rb-btn secondary" href="${cpE(l.url)}" target="_blank" rel="noopener noreferrer">${cpI("externalLink")}Open the role-play</a>` : ""}`;
  } else if (l.type === "document") {
    media = `<div class="rb-note">${cpI("fileText")} This lesson uses a document from the Resource Library, which comes in the next RAVN update. Until then, ask your manager for it.</div>`;
  }
  const next = m.lessons[index + 1];
  const nextBtn = next ? `<button class="rb-btn${l.done ? "" : " secondary"}" data-cp="open-lesson" data-id="${cpE(next.id)}" ${!l.done ? "disabled" : ""}>Next lesson${cpI("arrowRight")}</button>`
    : m.quiz ? `<button class="rb-btn${l.done ? "" : " secondary"}" data-cp="open-quiz" data-id="${cpE(m.id)}" ${!l.done ? "disabled" : ""}>Take the quiz${cpI("arrowRight")}</button>`
    : `<button class="rb-btn${l.done ? "" : " secondary"}" data-cp="open-course" data-id="${cpE(CP.courseId)}" ${!l.done ? "disabled" : ""}>Back to the course</button>`;
  return `${cpBack("open-course", CP.courseId, m.title)}
    ${cpHead((CP_TYPES[l.type] || l.type) + (l.minutes ? " · " + l.minutes + " min" : ""), l.title)}
    <div class="rb-card cp-lesson-body">${media}${l.body ? `<div class="rb-md cp-md">${md(l.body)}</div>` : ""}</div>
    <div class="rb-actions cp-actions">
      ${l.done ? cpTagDone("Done") : `<button class="rb-btn" data-cp="lesson-done" data-id="${cpE(l.id)}" ${CP.busy ? "disabled" : ""}>${cpI("circleCheck")}Mark as done</button>`}
      ${nextBtn}
    </div>`;
}

function cpShuffle(a){ const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
async function cpOpenQuiz(moduleId){
  CP.busy = true; renderCourses();
  const r = CP.preview ? await cpPrev("quiz", { moduleId }) : await cpApi("/quiz?module=" + encodeURIComponent(moduleId));
  CP.busy = false;
  if (!r.data.ok) { alert(r.data.error || "Couldn't open the quiz. Check your connection and try again."); return renderCourses(); }
  // A fresh order every attempt: questions and their choices.
  const questions = cpShuffle(r.data.questions).map((q) => Object.assign({}, q, { choices: cpShuffle(q.choices) }));
  CP.quiz = { moduleId: r.data.moduleId, title: r.data.title, pass: r.data.pass, questions, answers: {} };
  CP.view = "quiz"; CP.moduleId = moduleId;
  renderCourses();
}
function cpQuizHTML(){
  const z = CP.quiz;
  if (!z) { CP.view = "course"; return cpCourseHTML(); }
  const answered = z.questions.filter((q) => z.answers[q.id] && z.answers[q.id].size).length;
  const qs = z.questions.map((q, qi) => `
    <fieldset class="rb-card rb-q cp-q"><legend>${qi + 1}. ${cpE(q.prompt)}</legend>
      ${q.choices.map((c) => `<label class="rb-choice cp-choice"><input type="${q.multi ? "checkbox" : "radio"}" name="cpq-${cpE(q.id)}" data-q="${cpE(q.id)}" data-i="${c.i}"
        ${z.answers[q.id] && z.answers[q.id].has(c.i) ? "checked" : ""}> <span>${cpE(c.text)}</span></label>`).join("")}
    </fieldset>`).join("");
  return `${cpBack("open-course", CP.courseId, "Back to the course")}
    ${cpHead("Quiz · pass mark " + z.pass + "%", z.title)}
    ${qs}
    <div class="rb-actions cp-actions"><span class="rb-meta">${answered} of ${z.questions.length} answered</span>
      <button class="rb-btn" data-cp="submit-quiz" ${answered < z.questions.length || CP.busy ? "disabled" : ""}>Submit answers</button></div>`;
}
function cpResultHTML(){
  const r = CP.result;
  if (!r) { CP.view = "course"; return cpCourseHTML(); }
  const g = r.grade, byId = new Map(r.quiz.questions.map((q) => [q.id, q]));
  const text = (q, idxs) => idxs.map((i) => { const c = q.choices.find((x) => x.i === i); return c ? cpE(c.text) : "?"; }).join(", ") || "Nothing picked";
  const rows = g.results.map((x, n) => {
    const q = byId.get(x.id); if (!q) return "";
    return `<div class="rb-card rb-res cp-res ${x.right ? "right" : "wrong"}"><div><b>${n + 1}. ${cpE(q.prompt)}</b></div>
      <div class="rb-res-verdict ${x.right ? "right" : "wrong"}">${x.right ? cpI("circleCheck") + "Right" : cpI("circleX") + "Not quite"}</div>
      <div class="rb-meta">Your answer: ${text(q, x.picked)}</div>
      ${x.right ? "" : `<div><b>Correct:</b> ${text(q, x.correct)}</div><div class="rb-expl cp-expl">${cpE(x.explanation)}</div>`}</div>`;
  }).join("");
  const m = (cpFindModuleNow(r.quiz.moduleId) || {}).module;
  const note = g.passed
    ? (m && m.complete ? "Nice work. This module is complete." : "Nice work.")
    : `You need ${g.pass}% to pass. Read the answers below, then take it again. There's no limit.`;
  return `${cpHead(r.quiz.title, g.passed ? `Passed: ${g.score}%` : `Not passed yet: ${g.score}%`)}
    <div class="rb-card cp-scorecard"><div class="rb-score">${g.passed ? `<span class="rb-res-verdict right cp-verdict">${cpI("circleCheck")}Passed</span>` : `<span class="rb-res-verdict wrong cp-verdict">${cpI("circleX")}Not passed yet</span>`}
      <span class="rb-meta">${g.right} of ${g.total} right · pass mark ${g.pass}%</span></div>
      ${cpBar(g.score, "Your score", g.passed)}<p class="rb-meta cp-result-note" style="margin:8px 0 0">${note}</p></div>
    ${rows}
    <div class="rb-actions cp-actions">
      ${g.passed ? "" : `<button class="rb-btn" data-cp="open-quiz" data-id="${cpE(r.quiz.moduleId)}">${cpI("rotateCcw")}Retake the quiz</button>`}
      <button class="rb-btn${g.passed ? "" : " secondary"}" data-cp="open-course" data-id="${cpE(CP.courseId)}">Back to the course</button>
    </div>`;
}
function cpFindModuleNow(id){
  for (const c of (CP.data && CP.data.courses) || []) for (const m of c.modules) if (m.id === id) return { course: c, module: m };
  return null;
}

function cpOnChange(e){
  const t = e.target;
  if (!t || !t.dataset || !t.dataset.q || !CP.quiz) return;
  const q = CP.quiz.questions.find((x) => x.id === t.dataset.q); if (!q) return;
  const i = Number(t.dataset.i);
  if (!q.multi) CP.quiz.answers[q.id] = new Set([i]);
  else { const s = CP.quiz.answers[q.id] || new Set(); t.checked ? s.add(i) : s.delete(i); CP.quiz.answers[q.id] = s; }
  // Update the counter and the Submit button without re-rendering the form.
  const z = CP.quiz, answered = z.questions.filter((x) => z.answers[x.id] && z.answers[x.id].size).length;
  const el = document.getElementById("coursePanel");
  const sub = el && el.querySelector('[data-cp="submit-quiz"]');
  if (sub) { sub.disabled = answered < z.questions.length; const lab = sub.previousElementSibling; if (lab) lab.textContent = `${answered} of ${z.questions.length} answered`; }
}

async function cpOnClick(e){
  const b = e.target && e.target.closest && e.target.closest("[data-cp]");
  if (!b || b.disabled || b.getAttribute("aria-disabled") === "true") return;
  const act = b.dataset.cp, id = b.dataset.id;
  if (act === "reload") { CP.data = null; CP.error = null; return cpLoad(); }
  if (act === "to-list") { CP.view = "list"; return renderCourses(); }
  if (act === "exit-preview") return cpExitPreview();
  if (act === "open-course") { CP.courseId = id; CP.view = "course"; CP.quiz = null; CP.result = null; renderCourses(); return window.scrollTo(0, 0); }
  if (act === "open-lesson") { const f = cpFindLesson(id); if (!f || f.lesson.locked) return; CP.courseId = f.course.id; CP.lessonId = id; CP.view = "lesson"; renderCourses(); return window.scrollTo(0, 0); }
  if (act === "open-quiz") { await cpOpenQuiz(id); return window.scrollTo(0, 0); }
  if (act === "lesson-done") {
    if (CP.preview) {
      if (!CP.preview.progress.lessonsDone.includes(id)) CP.preview.progress.lessonsDone.push(id);
      CP.busy = true; renderCourses();
      const v = await cpPrev("view"); CP.busy = false;
      if (v.data.ok) cpTake(v.data); else alert(v.data.error || "Couldn't update the preview.");
      return renderCourses();
    }
    CP.busy = true; renderCourses();
    const r = await cpPost("/lesson-done", { lessonId: id });
    CP.busy = false;
    if (r.data.ok) cpTake(r.data); else alert(r.data.error || "That didn't save. Check your connection and tap Mark as done again.");
    return renderCourses();
  }
  if (act === "submit-quiz") {
    const z = CP.quiz; if (!z) return;
    const answers = {}; for (const q of z.questions) answers[q.id] = [...(z.answers[q.id] || [])];
    CP.busy = true; renderCourses();
    const r = CP.preview ? await cpPrev("submit", { moduleId: z.moduleId, answers }) : await cpPost("/quiz-submit", { moduleId: z.moduleId, answers });
    if (r.data.ok && CP.preview) {
      // Keep the best attempt, the way Cockpit does for a real rep.
      const g = r.data.result, qb = CP.preview.progress.quizBest, old = qb[z.moduleId];
      if (!old || (g.passed && !old.passed) || (g.passed === old.passed && g.score > old.score)) qb[z.moduleId] = { score: g.score, passed: g.passed };
      const v = await cpPrev("view"); if (v.data.ok) cpTake(v.data);
    }
    CP.busy = false;
    if (!r.data.ok) { alert(r.data.error || "Couldn't submit. Your answers are still here."); return renderCourses(); }
    if (!CP.preview) cpTake(r.data);
    CP.result = { grade: r.data.result, quiz: z };
    CP.view = "result"; renderCourses();
    return window.scrollTo(0, 0);
  }
}

// Fresh data each time the Courses screen is opened from the Training Center.
function cpOpen(){ CP.preview = null; CP.view = "list"; CP.data = null; CP.error = null; CP.quiz = null; CP.result = null; }
// Owners: open one course from Content with its drafts (see CP.preview).
function cpStartPreview(courseId){
  cpOpen();
  CP.preview = { courseId, progress: { lessonsDone: [], quizBest: {} } };
  CP.view = "course"; CP.courseId = courseId;
}
function cpIsPreview(){ return !!CP.preview; }
// Leaving a preview throws its progress away and returns to Content.
function cpExitPreview(){
  cpOpen();
  const el = document.getElementById("coursePanel"); if (el) el.innerHTML = "";
  if (typeof appView !== "undefined") { appView = "content"; if (typeof renderApp === "function") renderApp(); }
  window.scrollTo(0, 0);
}
// Signing out (or a revoke) must not leave one rep's progress on screen.
function cpReset(){ cpOpen(); const el = document.getElementById("coursePanel"); if (el) el.innerHTML = ""; }
window.addEventListener("raven-session-changed", () => { cpReset(); });
