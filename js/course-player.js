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
};

function cpBase(){ return self.RAVN_API_BASE || "https://ath-cockpit.onrender.com"; }
async function cpApi(path, opts){
  let r;
  try { r = await rvAuthedFetch(cpBase() + "/api/raven/content" + path, opts); }
  catch (e) { return { status: 0, data: { ok: false, error: navigator.onLine ? "Couldn't reach Cockpit." : "You're offline — courses need a connection." } }; }
  const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  return { status: r.status, data };
}
const cpPost = (path, body) => cpApi(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const cpE = (s) => (typeof ravnEsc === "function" ? ravnEsc(s) : String(s == null ? "" : s));
const CP_TYPES = { reading: "Reading", video: "Video", script: "Script", checklist: "Checklist", roleplay: "Role-play", document: "Library document" };

async function cpLoad(){
  CP.loading = true; CP.error = null; renderCourses();
  const r = await cpApi("/learn");
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
function cpBar(pct, label){
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return `<div class="cp-bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${cpE(label || "Progress")}">
    <div class="cp-bar-fill" style="width:${p}%"></div></div>`;
}
const cpLock = () => (typeof ICON !== "undefined" && ICON.lock) || "🔒";
const cpCheck = () => (typeof ICON !== "undefined" && ICON.checkCircle) || "✓";

function renderCourses(){
  const el = document.getElementById("coursePanel");
  if (!el) return;
  if (typeof rvGetSession === "function" && !rvGetSession()) {
    el.innerHTML = `<div class="qb-status"><h2>Sign in first</h2><p>Courses follow your RAVN sign-in. Open Start Appointment to sign in, then come back.</p></div>`;
    return;
  }
  if (CP.data === null && !CP.loading && !CP.error) { cpLoad(); return; }
  let body = "";
  if (CP.loading && !CP.data) body = `<div class="rv-empty">Loading courses…</div>`;
  else if (CP.error) body = `<div class="rv-error">${cpE(CP.error)}</div><button class="qb-btn-primary" data-cp="reload">Try again</button>`;
  else if (CP.view === "course") body = cpCourseHTML();
  else if (CP.view === "lesson") body = cpLessonHTML();
  else if (CP.view === "quiz") body = cpQuizHTML();
  else if (CP.view === "result") body = cpResultHTML();
  else body = cpListHTML();
  el.innerHTML = `<div class="ca-wrap cp-wrap">${body}</div>`;
  el.onclick = cpOnClick;
  el.onchange = cpOnChange;
}

function cpListHTML(){
  const d = CP.data, courses = d.courses || [];
  if (!courses.length) return `<div class="center-head"><div class="eyebrow">Training</div><h1>Courses</h1></div>
    <div class="rv-empty">No courses are published yet. Your owner approves lessons in Content before they show up here.</div>`;
  const cards = courses.map((c) => {
    const state = c.complete ? `<span class="cp-tag done">${cpCheck()} Complete</span>`
      : c.locked ? `<span class="cp-tag locked">${cpLock()} Finish ${cpE(c.requiresTitle)} first</span>`
      : c.unitsDone ? `<span class="cp-tag">${c.percent}% done</span>` : `<span class="cp-tag">Not started</span>`;
    return `<button class="ca-row-btn cp-course${c.locked ? " is-locked" : ""}" data-cp="open-course" data-id="${cpE(c.id)}">
      <span class="cp-course-main"><span class="ca-row-title">${cpE(c.title)}</span>
        ${c.summary ? `<span class="cp-sub">${cpE(c.summary)}</span>` : ""}
        ${cpBar(c.percent, c.title + " progress")}
        <span class="cp-sub">${c.unitsDone} of ${c.units} steps · ${c.modules.length} module${c.modules.length === 1 ? "" : "s"}</span></span>
      ${state}</button>`;
  }).join("");
  return `<div class="center-head"><div class="eyebrow">Training</div><h1>Courses</h1></div>
    <div class="ca-card cp-overall"><div class="cp-overall-head"><b>Your training</b><span>${d.overall.percent}%</span></div>
      ${cpBar(d.overall.percent, "Overall training progress")}
      <div class="cp-sub">${d.overall.unitsDone} of ${d.overall.units} steps across every course</div></div>
    ${cards}`;
}

function cpCourseHTML(){
  const c = cpCourse();
  if (!c) { CP.view = "list"; return cpListHTML(); }
  const mods = c.modules.map((m, mi) => {
    const rows = m.lessons.map((l) => `
      <button class="ca-row-btn cp-lesson${l.locked ? " is-locked" : ""}" data-cp="open-lesson" data-id="${cpE(l.id)}" ${l.locked ? "aria-disabled=\"true\"" : ""}>
        <span><span class="ca-row-title">${cpE(l.title)}</span><span class="cp-sub">${cpE(CP_TYPES[l.type] || l.type)}${l.minutes ? " · " + l.minutes + " min" : ""}</span></span>
        <span class="cp-state">${l.done ? `<span class="cp-tag done">${cpCheck()} Done</span>` : l.locked ? `<span class="cp-tag locked">${cpLock()}</span>` : `<span class="cp-tag go">Start</span>`}</span>
      </button>`).join("");
    const q = m.quiz ? `
      <button class="ca-row-btn cp-lesson cp-quizrow${m.quiz.locked ? " is-locked" : ""}" data-cp="open-quiz" data-id="${cpE(m.id)}" ${m.quiz.locked ? "aria-disabled=\"true\"" : ""}>
        <span><span class="ca-row-title">Quiz — ${m.quiz.count} question${m.quiz.count === 1 ? "" : "s"}</span>
          <span class="cp-sub">Pass mark ${m.pass}%${m.quiz.best ? ` · best ${m.quiz.best.score}%` : ""}</span></span>
        <span class="cp-state">${m.quiz.best && m.quiz.best.passed ? `<span class="cp-tag done">${cpCheck()} Passed</span>` : m.quiz.locked ? `<span class="cp-tag locked">${cpLock()}</span>` : `<span class="cp-tag go">${m.quiz.best ? "Retake" : "Take quiz"}</span>`}</span>
      </button>` : "";
    const pct = m.units ? Math.round((m.unitsDone / m.units) * 100) : 0;
    return `<div class="ca-card cp-module${m.locked ? " is-locked" : ""}">
      <div class="cp-module-head"><h3>${mi + 1}. ${cpE(m.title)}</h3>${m.complete ? `<span class="cp-tag done">${cpCheck()} Complete</span>` : m.locked ? `<span class="cp-tag locked">${cpLock()} Locked</span>` : ""}</div>
      ${cpBar(pct, m.title + " progress")}
      ${m.locked && mi > 0 ? `<div class="cp-sub">Opens when “${cpE(c.modules[mi - 1].title)}” is complete.</div>` : ""}
      ${rows}${q}</div>`;
  }).join("");
  return `<button class="ca-back" data-cp="to-list">← All courses</button>
    <div class="center-head"><div class="eyebrow">${c.locked ? "Locked" : c.percent + "% complete"}</div><h1>${cpE(c.title)}</h1></div>
    ${c.locked ? `<div class="rv-note">${cpLock()} This course opens when you finish <b>${cpE(c.requiresTitle)}</b>.</div>` : ""}
    ${cpBar(c.percent, c.title + " progress")}
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
      ? `<div class="cp-video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0" title="${cpE(l.title)}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`
      : `<a class="qb-btn-primary cp-linkbtn" href="${cpE(l.url)}" target="_blank" rel="noopener noreferrer">Open the video</a>`;
  } else if (l.type === "roleplay") {
    media = `${l.goal ? `<div class="rv-note"><b>Goal:</b> ${cpE(l.goal)}</div>` : ""}
      ${l.url ? `<a class="qb-btn-primary cp-linkbtn" href="${cpE(l.url)}" target="_blank" rel="noopener noreferrer">Open the role-play</a>` : ""}`;
  } else if (l.type === "document") {
    media = `<div class="rv-note">This lesson uses a Resource Library document (<code>${cpE(l.doc || "")}</code>). The Library arrives in the next RAVN update — until then, ask your manager for it.</div>`;
  }
  const next = m.lessons[index + 1];
  const nextBtn = next ? `<button class="qb-btn-primary" data-cp="open-lesson" data-id="${cpE(next.id)}" ${!l.done ? "disabled" : ""}>Next lesson</button>`
    : m.quiz ? `<button class="qb-btn-primary" data-cp="open-quiz" data-id="${cpE(m.id)}" ${!l.done ? "disabled" : ""}>Take the quiz</button>`
    : `<button class="qb-btn-primary" data-cp="open-course" data-id="${cpE(CP.courseId)}" ${!l.done ? "disabled" : ""}>Back to the course</button>`;
  return `<button class="ca-back" data-cp="open-course" data-id="${cpE(CP.courseId)}">← ${cpE(m.title)}</button>
    <div class="center-head"><div class="eyebrow">${cpE(CP_TYPES[l.type] || l.type)}${l.minutes ? " · " + l.minutes + " min" : ""}</div><h1>${cpE(l.title)}</h1></div>
    <div class="ca-card cp-lesson-body">${media}${l.body ? `<div class="cp-md">${md(l.body)}</div>` : ""}</div>
    <div class="cp-actions">
      ${l.done ? `<span class="cp-tag done">${cpCheck()} Done</span>` : `<button class="qb-btn-primary" data-cp="lesson-done" data-id="${cpE(l.id)}" ${CP.busy ? "disabled" : ""}>Mark complete</button>`}
      ${nextBtn}
    </div>`;
}

function cpShuffle(a){ const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
async function cpOpenQuiz(moduleId){
  CP.busy = true; renderCourses();
  const r = await cpApi("/quiz?module=" + encodeURIComponent(moduleId));
  CP.busy = false;
  if (!r.data.ok) { CP.error = null; alert(r.data.error || "Couldn't open the quiz."); return renderCourses(); }
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
    <fieldset class="ca-card cp-q"><legend><b>${qi + 1}.</b> ${cpE(q.prompt)}${q.multi ? ` <span class="cp-sub">(select all that apply)</span>` : ""}</legend>
      ${q.choices.map((c) => `<label class="cp-choice"><input type="${q.multi ? "checkbox" : "radio"}" name="cpq-${cpE(q.id)}" data-q="${cpE(q.id)}" data-i="${c.i}"
        ${z.answers[q.id] && z.answers[q.id].has(c.i) ? "checked" : ""}> <span>${cpE(c.text)}</span></label>`).join("")}
    </fieldset>`).join("");
  return `<button class="ca-back" data-cp="open-course" data-id="${cpE(CP.courseId)}">← Back to the course</button>
    <div class="center-head"><div class="eyebrow">Quiz · pass mark ${z.pass}%</div><h1>${cpE(z.title)}</h1></div>
    ${qs}
    <div class="cp-actions"><span class="cp-sub">${answered} of ${z.questions.length} answered</span>
      <button class="qb-btn-primary" data-cp="submit-quiz" ${answered < z.questions.length || CP.busy ? "disabled" : ""}>Submit answers</button></div>`;
}
function cpResultHTML(){
  const r = CP.result;
  if (!r) { CP.view = "course"; return cpCourseHTML(); }
  const g = r.grade, byId = new Map(r.quiz.questions.map((q) => [q.id, q]));
  const text = (q, idxs) => idxs.map((i) => { const c = q.choices.find((x) => x.i === i); return c ? cpE(c.text) : "?"; }).join(", ") || "—";
  const rows = g.results.map((x, n) => {
    const q = byId.get(x.id); if (!q) return "";
    return `<div class="ca-card cp-res ${x.right ? "right" : "wrong"}"><div><b>${n + 1}. ${cpE(q.prompt)}</b></div>
      <div class="cp-sub">${x.right ? `${cpCheck()} Right` : "Not quite"} — your answer: ${text(q, x.picked)}</div>
      ${x.right ? "" : `<div><b>Correct:</b> ${text(q, x.correct)}</div><div class="cp-expl">${cpE(x.explanation)}</div>`}</div>`;
  }).join("");
  const m = (cpFindModuleNow(r.quiz.moduleId) || {}).module;
  return `<div class="center-head"><div class="eyebrow">${cpE(r.quiz.title)}</div>
      <h1>${g.passed ? "Passed" : "Not passed yet"} — ${g.score}%</h1></div>
    <div class="rv-note">${g.right} of ${g.total} right · pass mark ${g.pass}%. ${g.passed ? (m && m.complete ? "This module is complete." : "") : "Review the answers below and take it again — there's no limit."}</div>
    ${rows}
    <div class="cp-actions">
      ${g.passed ? "" : `<button class="qb-btn-primary" data-cp="open-quiz" data-id="${cpE(r.quiz.moduleId)}">Retake the quiz</button>`}
      <button class="${g.passed ? "qb-btn-primary" : "rv-signout"}" data-cp="open-course" data-id="${cpE(CP.courseId)}">Back to the course</button>
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
  if (act === "open-course") { CP.courseId = id; CP.view = "course"; CP.quiz = null; CP.result = null; renderCourses(); return window.scrollTo(0, 0); }
  if (act === "open-lesson") { const f = cpFindLesson(id); if (!f || f.lesson.locked) return; CP.courseId = f.course.id; CP.lessonId = id; CP.view = "lesson"; renderCourses(); return window.scrollTo(0, 0); }
  if (act === "open-quiz") { await cpOpenQuiz(id); return window.scrollTo(0, 0); }
  if (act === "lesson-done") {
    CP.busy = true; renderCourses();
    const r = await cpPost("/lesson-done", { lessonId: id });
    CP.busy = false;
    if (r.data.ok) cpTake(r.data); else alert(r.data.error || "Couldn't save that.");
    return renderCourses();
  }
  if (act === "submit-quiz") {
    const z = CP.quiz; if (!z) return;
    const answers = {}; for (const q of z.questions) answers[q.id] = [...(z.answers[q.id] || [])];
    CP.busy = true; renderCourses();
    const r = await cpPost("/quiz-submit", { moduleId: z.moduleId, answers });
    CP.busy = false;
    if (!r.data.ok) { alert(r.data.error || "Couldn't submit — your answers are still here."); return renderCourses(); }
    cpTake(r.data);
    CP.result = { grade: r.data.result, quiz: z };
    CP.view = "result"; renderCourses();
    return window.scrollTo(0, 0);
  }
}

// Fresh data each time the Courses screen is opened from Home.
function cpOpen(){ CP.view = "list"; CP.data = null; CP.error = null; CP.quiz = null; CP.result = null; }
// Signing out (or a revoke) must not leave one rep's progress on screen.
function cpReset(){ cpOpen(); const el = document.getElementById("coursePanel"); if (el) el.innerHTML = ""; }
window.addEventListener("raven-session-changed", () => { cpReset(); });
