// ── Raven — field recording capture client (Phase 1) ─────────────────────────
//
// Records in-home appointments and uploads them in chunks to the Cockpit
// DURING the recording, so most of the audio is server-side before the rep
// ever taps stop. The Dog House is the capture device only — the Cockpit is
// the system of record. No transcription, no AI, no JN writes in Phase 1.
//
// Durability model (the whole point — Rilla's reviewers lose ~10% of calls):
//   • Recorder runs with a ~12s timeslice — every dataavailable blob goes to
//     IndexedDB IMMEDIATELY. That is the durability floor: the most audio a
//     hard crash can cost is the final partial chunk.
//   • Upload cadence is DECOUPLED (~70s batches) so field LTE sees dozens of
//     requests per hour, not hundreds, and the radio can idle between
//     batches (battery). A chunk is deleted locally ONLY after the server
//     acks it.
//   • On every app open, a resume scan uploads any unacked chunks left from
//     a previous session — iOS Safari has no Background Sync, so closing the
//     iPad mid-upload parks the audio locally until the next open.
//   • Interruptions (app switch, lock, incoming call) finalize the current
//     segment; recovery starts a NEW segment under the same session. Wake
//     lock only prevents AUTO-lock, so this recovery path is the primary
//     mechanism, not a fallback. An interruption costs a gap, never the
//     appointment.
//
// Discretion: recording UI lives on the HOME screen only (the app's menu
// surface). One brief confirmation on start, then nothing — no badge, dot,
// timer, or banner anywhere in the presentation views. Ending a recording =
// exit the deck as normal, tap the Raven card on home.
//
// Security: NO credentials in this file or repo. Auth is a per-rep PIN
// exchanged once for an opaque device token (POST /api/raven/auth), held in
// localStorage and sent as X-Raven-Token. A 401 clears it and re-prompts.

"use strict";

const RAVEN_BASE = "https://ath-cockpit.onrender.com";
const RAVEN_LS_TOKEN = "raven.token";
const RAVEN_LS_REP = "raven.repName";
const RAVEN_TIMESLICE_MS = 12000;     // durability floor (spec: 10-15s)
const RAVEN_UPLOAD_TICK_MS = 70000;   // upload cadence (spec: 60-90s)
const RAVEN_DB = "raven-capture";

// ── State ────────────────────────────────────────────────────────────────────
let rvDb = null;                 // IndexedDB handle
let rvSession = null;            // active {sessionId, jnid, jobName, startedAt, seq, segment, interruptions[], stopped}
let rvRecorder = null;
let rvStream = null;
let rvWakeLock = null;
let rvUploadTimer = null;
let rvUploading = false;
let rvBackoffMs = 0;             // grows on failure, reset on success
let rvPanelOpen = false;
let rvSearchTimer = null;

const rvToken = () => localStorage.getItem(RAVEN_LS_TOKEN) || "";
const rvRep = () => localStorage.getItem(RAVEN_LS_REP) || "";

// ── IndexedDB (chunks survive anything short of storage eviction) ────────────
function rvOpenDb(){
  return new Promise((resolve, reject) => {
    if (rvDb) return resolve(rvDb);
    const req = indexedDB.open(RAVEN_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("chunks"))
        db.createObjectStore("chunks", { keyPath: ["sessionId", "seq"] });
      if (!db.objectStoreNames.contains("sessions"))
        db.createObjectStore("sessions", { keyPath: "sessionId" });
    };
    req.onsuccess = () => { rvDb = req.result; resolve(rvDb); };
    req.onerror = () => reject(req.error);
  });
}
function rvTx(store, mode, fn){
  return rvOpenDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
    tx.onerror = () => reject(tx.error);
  }));
}
const rvPutChunk = (rec) => rvTx("chunks", "readwrite", s => s.put(rec));
const rvDelChunk = (sessionId, seq) => rvTx("chunks", "readwrite", s => s.delete([sessionId, seq]));
const rvPutManifest = (m) => rvTx("sessions", "readwrite", s => s.put(m));
const rvDelManifest = (id) => rvTx("sessions", "readwrite", s => s.delete(id));
function rvAllChunks(sessionId){
  return rvTx("chunks", "readonly", s => s.getAll()).then(all =>
    (all || []).filter(c => c.sessionId === sessionId).sort((a, b) => a.seq - b.seq));
}
function rvAllManifests(){
  return rvTx("sessions", "readonly", s => s.getAll()).then(all => all || []);
}

// ── Server calls ─────────────────────────────────────────────────────────────
function rvAuthedFetch(url, opts = {}){
  opts.headers = Object.assign({}, opts.headers, { "X-Raven-Token": rvToken() });
  return fetch(url, opts).then(r => {
    if (r.status === 401) {
      // Token revoked/expired — clear and force re-auth. Local audio is
      // untouched; the resume scan finishes the job after re-auth.
      localStorage.removeItem(RAVEN_LS_TOKEN);
      localStorage.removeItem(RAVEN_LS_REP);
      rvRenderPanel();
    }
    return r;
  });
}

async function rvUploadOneChunk(c){
  const q = new URLSearchParams({ sessionId: c.sessionId, seq: String(c.seq) });
  if (c.startedAt) q.set("startedAt", c.startedAt);
  if (c.jnid) q.set("jnid", c.jnid);
  if (c.jobName) q.set("jobName", c.jobName);
  const r = await rvAuthedFetch(`${RAVEN_BASE}/api/raven/upload?${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: c.blob
  });
  if (r.ok) return true;
  // 409 session-complete: the server already finalized this session — the
  // straggler is unrecoverable server-side; keep it locally for manual
  // review rather than deleting evidence.
  return false;
}

// Drain every unacked chunk across every session, oldest first. Sequential,
// one in flight — field LTE does better with one steady stream than a burst.
async function rvDrainUploads(){
  if (rvUploading || !rvToken() || !navigator.onLine) return;
  rvUploading = true;
  try {
    const manifests = await rvAllManifests();
    for (const m of manifests) {
      const chunks = await rvAllChunks(m.sessionId);
      for (const c of chunks) {
        const ok = await rvUploadOneChunk(c);
        if (!ok) { rvBackoffMs = Math.min((rvBackoffMs || 15000) * 2, 5 * 60000); rvUploading = false; return; }
        await rvDelChunk(c.sessionId, c.seq);
        rvBackoffMs = 0;
      }
      // All chunks acked. If the recording is over (stopped by the rep, or a
      // dead session found by the resume scan), tell the server to assemble.
      const active = rvSession && rvSession.sessionId === m.sessionId && !rvSession.stopped;
      if (!active && (await rvAllChunks(m.sessionId)).length === 0) {
        const r = await rvAuthedFetch(`${RAVEN_BASE}/api/raven/session/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: m.sessionId,
            durationSec: m.durationSec || Math.round(((m.seq || 0) + 1) * RAVEN_TIMESLICE_MS / 1000),
            segmentCount: m.segment || 1,
            interruptions: m.interruptions || []
          })
        });
        if (r.ok) await rvDelManifest(m.sessionId);
        else break;   // leave the manifest; retry next drain
      }
    }
  } catch (e) {
    rvBackoffMs = Math.min((rvBackoffMs || 15000) * 2, 5 * 60000);
  } finally {
    rvUploading = false;
    rvRenderPanel();
  }
}

function rvStartUploadLoop(){
  if (rvUploadTimer) return;
  rvUploadTimer = setInterval(() => {
    if (rvBackoffMs > 0) { rvBackoffMs -= RAVEN_UPLOAD_TICK_MS; if (rvBackoffMs > 0) return; }
    rvDrainUploads();
  }, RAVEN_UPLOAD_TICK_MS);
}
function rvStopUploadLoopIfIdle(){
  rvAllManifests().then(ms => {
    if (!ms.length && rvUploadTimer && !rvSession) { clearInterval(rvUploadTimer); rvUploadTimer = null; }
  });
}

// ── Wake lock (prevents AUTO-lock only — see header) ─────────────────────────
async function rvAcquireWakeLock(){
  try {
    if ("wakeLock" in navigator) {
      rvWakeLock = await navigator.wakeLock.request("screen");
      rvWakeLock.addEventListener("release", () => { rvWakeLock = null; });
    }
  } catch (e) { /* denied/unsupported — recovery path still covers us */ }
}
function rvReleaseWakeLock(){
  try { rvWakeLock && rvWakeLock.release(); } catch (e) {}
  rvWakeLock = null;
}

// ── Recorder ─────────────────────────────────────────────────────────────────
function rvPickMime(){
  if (typeof MediaRecorder === "undefined") return null;
  // audio/mp4 (AAC) is the dependable iPadOS baseline. webm/opus is feature-
  // detected as a secondary, never assumed (build spec §4.4).
  for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
  }
  return null;
}

async function rvStartSegment(){
  rvStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
  });
  const mime = rvPickMime();
  rvRecorder = new MediaRecorder(rvStream, mime
    ? { mimeType: mime, audioBitsPerSecond: 64000 }
    : { audioBitsPerSecond: 64000 });

  rvRecorder.ondataavailable = async (ev) => {
    if (!rvSession || !ev.data || !ev.data.size) return;
    const seq = rvSession.seq++;
    await rvPutChunk({
      sessionId: rvSession.sessionId, seq, blob: ev.data,
      startedAt: rvSession.startedAt, jnid: rvSession.jnid || "", jobName: rvSession.jobName || ""
    });
    await rvPutManifest(rvManifest());
  };

  // Track-level interruption (incoming call, mic stolen by the OS): finalize
  // this segment now so its chunks flush; recovery starts a new one.
  const track = rvStream.getAudioTracks()[0];
  if (track) {
    track.onended = () => rvHandleInterruption("track-ended");
    track.onmute = () => rvHandleInterruption("track-muted");
  }

  rvRecorder.start(RAVEN_TIMESLICE_MS);
}

function rvManifest(){
  return {
    sessionId: rvSession.sessionId, repName: rvRep(),
    jnid: rvSession.jnid || "", jobName: rvSession.jobName || "",
    startedAt: rvSession.startedAt, seq: rvSession.seq - 1,
    segment: rvSession.segment, interruptions: rvSession.interruptions,
    durationSec: Math.round((Date.now() - rvSession.startedMs) / 1000),
    stopped: !!rvSession.stopped
  };
}

function rvHandleInterruption(kind){
  if (!rvSession || rvSession.stopped) return;
  if (rvRecorder && rvRecorder.state === "recording") {
    try { rvRecorder.stop(); } catch (e) {}      // flushes a final dataavailable
  }
  try { rvStream && rvStream.getTracks().forEach(t => t.stop()); } catch (e) {}
  rvRecorder = null; rvStream = null;
  const last = rvSession.interruptions[rvSession.interruptions.length - 1];
  if (!last || last.resumedAt) rvSession.interruptions.push({ at: new Date().toISOString(), kind });
  rvPutManifest(rvManifest());
}

async function rvTryRecover(){
  if (!rvSession || rvSession.stopped) return;
  if (rvRecorder && rvRecorder.state === "recording") return;
  try {
    rvSession.segment++;
    await rvStartSegment();
    const last = rvSession.interruptions[rvSession.interruptions.length - 1];
    if (last && !last.resumedAt) last.resumedAt = new Date().toISOString();
    await rvPutManifest(rvManifest());
    await rvAcquireWakeLock();
  } catch (e) { /* mic still unavailable — next visibilitychange retries */ }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (rvSession && !rvSession.stopped) rvHandleInterruption("hidden");
  } else {
    rvTryRecover();
    if (!rvWakeLock && rvSession && !rvSession.stopped) rvAcquireWakeLock();
  }
});

// ── Session lifecycle ────────────────────────────────────────────────────────
function rvNewSessionId(){
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, "0")).join("");
  return `rvn-${Date.now().toString(36)}-${rand}`;
}

async function rvStartRecording(job){
  if (rvSession) return;
  rvSession = {
    sessionId: rvNewSessionId(),
    jnid: job ? job.jnid : "", jobName: job ? job.name : "",
    startedAt: new Date().toISOString(), startedMs: Date.now(),
    seq: 0, segment: 1, interruptions: [], stopped: false
  };
  try {
    await rvStartSegment();
  } catch (e) {
    rvSession = null;
    rvToast("Microphone unavailable — recording not started");
    return;
  }
  await rvPutManifest(rvManifest());
  await rvAcquireWakeLock();
  rvStartUploadLoop();
  rvToast("Recording started");
  rvClosePanel();
  if (typeof renderHome === "function" && typeof appView !== "undefined" && appView === "home") renderHome();
}

async function rvStopRecording(){
  if (!rvSession) return;
  rvSession.stopped = true;
  const finished = new Promise(res => {
    if (!rvRecorder || rvRecorder.state !== "recording") return res();
    rvRecorder.onstop = res;
    try { rvRecorder.stop(); } catch (e) { res(); }
  });
  await finished;
  await new Promise(r => setTimeout(r, 150));   // let the final ondataavailable IDB write land
  try { rvStream && rvStream.getTracks().forEach(t => t.stop()); } catch (e) {}
  await rvPutManifest(rvManifest());
  rvReleaseWakeLock();
  const done = rvSession; rvSession = null;
  rvRecorder = null; rvStream = null;
  rvToast("Recording saved — uploading");
  rvDrainUploads().then(rvStopUploadLoopIfIdle);
  if (typeof renderHome === "function" && typeof appView !== "undefined" && appView === "home") renderHome();
  return done.sessionId;
}

// Resume scan — run on every load. Any manifest left behind means a prior
// session didn't finish uploading (closed iPad, crash, dead battery).
async function rvResumeScan(){
  try {
    const ms = await rvAllManifests();
    if (ms.length) rvStartUploadLoop();
    if (ms.length) rvDrainUploads();
  } catch (e) { /* IDB unavailable (private mode) — capture simply won't offer */ }
}

// ── UI — home-screen card + panel ────────────────────────────────────────────
// The ONLY Raven surfaces in the app. Nothing renders in any deck view.
const RV_CSS = `
.rv-card.recording{border:1px solid #C0392B;background:#FFF9F8}
.rv-panel-wrap{position:fixed;inset:0;background:rgba(13,26,19,.55);z-index:400;display:flex;align-items:center;justify-content:center}
.rv-panel{background:#fff;border-radius:16px;max-width:520px;width:92%;max-height:80vh;overflow:auto;padding:26px}
.rv-panel h2{margin:0 0 4px;font-size:20px}
.rv-panel .rv-sub{color:#8a8a8a;font-size:12.5px;margin-bottom:16px}
.rv-input{width:100%;border:1px solid #E2E2DE;border-radius:10px;padding:11px 12px;font-size:15px;box-sizing:border-box}
.rv-btn{display:inline-block;border:0;border-radius:10px;padding:11px 20px;font-size:14px;font-weight:700;cursor:pointer;background:#1b5e3f;color:#fff}
.rv-btn.stop{background:#C0392B}
.rv-btn.ghost{background:#F0F0EC;color:#333}
.rv-job{padding:10px 12px;border:1px solid #ECECEA;border-radius:10px;margin:6px 0;cursor:pointer;font-size:13.5px}
.rv-job:hover{background:#F7F7F4}
.rv-job .rv-job-sub{color:#8a8a8a;font-size:11.5px;margin-top:2px}
.rv-row{display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}
.rv-stat{font-size:12.5px;color:#555;background:#F5F5F1;border-radius:8px;padding:6px 10px}
.rv-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#1b2e24;color:#fff;padding:10px 18px;border-radius:999px;font-size:13.5px;z-index:500;opacity:0;transition:opacity .2s}
`;
(function(){ const s = document.createElement("style"); s.textContent = RV_CSS; document.head.appendChild(s); })();

let rvToastTimer = null;
function rvToast(msg){
  let el = document.getElementById("rvToast");
  if (!el) { el = document.createElement("div"); el.id = "rvToast"; el.className = "rv-toast"; document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = "1";
  clearTimeout(rvToastTimer);
  rvToastTimer = setTimeout(() => { el.style.opacity = "0"; }, 1800);
}
const rvEsc = (s) => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

// Appended by renderHome() via the one-line hook in app.js.
function ravenMountHome(){
  const cards = document.querySelector("#homeScreen .home-cards");
  if (!cards || document.getElementById("rvHomeCard")) return;
  const rec = !!rvSession && !rvSession.stopped;
  const div = document.createElement("div");
  div.className = "home-card secondary rv-card" + (rec ? " recording" : "");
  div.id = "rvHomeCard";
  div.innerHTML = `
    <div class="home-card-icon">${typeof ICON !== "undefined" && ICON.mic ? ICON.mic
      : '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0014 0v-1M12 18v4"/></svg>'}</div>
    <div class="home-card-name">${rec ? "Recording in progress" : "Raven"}</div>
    <div class="home-card-sub">${rec ? "Tap to manage or end the session" : "Rep-only — record an appointment"}</div>`;
  div.onclick = rvOpenPanel;
  cards.appendChild(div);
}

function rvOpenPanel(){ rvPanelOpen = true; rvRenderPanel(); }
function rvClosePanel(){
  rvPanelOpen = false;
  const w = document.getElementById("rvPanelWrap");
  if (w) w.remove();
}

let rvSelectedJob = null;
function rvRenderPanel(){
  if (!rvPanelOpen) return;
  let w = document.getElementById("rvPanelWrap");
  if (!w) {
    w = document.createElement("div");
    w.id = "rvPanelWrap"; w.className = "rv-panel-wrap";
    w.onclick = (e) => { if (e.target === w) rvClosePanel(); };
    document.body.appendChild(w);
  }
  const rec = !!rvSession && !rvSession.stopped;

  if (!rvToken()) {
    w.innerHTML = `<div class="rv-panel">
      <h2>Raven — rep sign-in</h2>
      <div class="rv-sub">One-time setup on this iPad. Enter your rep PIN.</div>
      <input id="rvPin" class="rv-input" type="password" inputmode="numeric" autocomplete="off" placeholder="Rep PIN">
      <div class="rv-row">
        <button class="rv-btn" id="rvPinGo">Sign in</button>
        <button class="rv-btn ghost" id="rvPinCancel">Cancel</button>
        <span class="rv-stat" id="rvPinMsg" style="display:none"></span>
      </div>
    </div>`;
    document.getElementById("rvPinCancel").onclick = rvClosePanel;
    document.getElementById("rvPinGo").onclick = async () => {
      const pin = document.getElementById("rvPin").value.trim();
      const msg = document.getElementById("rvPinMsg");
      msg.style.display = ""; msg.textContent = "Checking…";
      try {
        const r = await fetch(`${RAVEN_BASE}/api/raven/auth`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin })
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.ok) {
          localStorage.setItem(RAVEN_LS_TOKEN, d.token);
          localStorage.setItem(RAVEN_LS_REP, d.repName);
          rvRenderPanel();
        } else msg.textContent = d.error || `Sign-in failed (${r.status})`;
      } catch (e) { msg.textContent = "Network error — is the iPad online?"; }
    };
    return;
  }

  if (rec) {
    const secs = Math.round((Date.now() - rvSession.startedMs) / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
    w.innerHTML = `<div class="rv-panel">
      <h2>Recording in progress</h2>
      <div class="rv-sub">${rvEsc(rvSession.jobName || "No job selected — tag it in the Cockpit afterward")}</div>
      <div class="rv-row">
        <span class="rv-stat">Elapsed ${mm}:${ss}</span>
        <span class="rv-stat">Segment ${rvSession.segment}</span>
        <span class="rv-stat">Chunks ${rvSession.seq}</span>
      </div>
      <div class="rv-row">
        <button class="rv-btn stop" id="rvStop">End recording</button>
        <button class="rv-btn ghost" id="rvHide">Close (keeps recording)</button>
      </div>
    </div>`;
    document.getElementById("rvHide").onclick = rvClosePanel;
    document.getElementById("rvStop").onclick = async () => { await rvStopRecording(); rvClosePanel(); };
    return;
  }

  w.innerHTML = `<div class="rv-panel">
    <h2>Record an appointment</h2>
    <div class="rv-sub">Signed in as ${rvEsc(rvRep())}. Search the customer's job, or start without one and tag it later.</div>
    <input id="rvSearch" class="rv-input" type="search" placeholder="Search customer name or address…" autocomplete="off">
    <div id="rvResults"></div>
    <div class="rv-row">
      <button class="rv-btn" id="rvStart">${rvSelectedJob ? "Start recording — " + rvEsc(rvSelectedJob.name) : "Start without a job"}</button>
      <button class="rv-btn ghost" id="rvCancel">Cancel</button>
    </div>
    <div class="rv-sub" style="margin-top:12px">Recording confirms once, then shows nothing on screen during the presentation. End it from this card afterward.</div>
  </div>`;
  document.getElementById("rvCancel").onclick = () => { rvSelectedJob = null; rvClosePanel(); };
  document.getElementById("rvStart").onclick = () => { const j = rvSelectedJob; rvSelectedJob = null; rvStartRecording(j); };
  const input = document.getElementById("rvSearch");
  input.oninput = () => {
    clearTimeout(rvSearchTimer);
    rvSearchTimer = setTimeout(async () => {
      const q = input.value.trim();
      const box = document.getElementById("rvResults");
      if (!box) return;
      if (q.length < 2) { box.innerHTML = ""; return; }
      try {
        const r = await rvAuthedFetch(`${RAVEN_BASE}/api/raven/jobs?q=${encodeURIComponent(q)}`);
        const d = await r.json().catch(() => ({}));
        box.innerHTML = (d.jobs || []).map((j, i) => `
          <div class="rv-job" data-i="${i}">
            <div><b>${rvEsc(j.name)}</b> <span style="color:#8a8a8a">· ${rvEsc(j.status)}</span></div>
            <div class="rv-job-sub">${rvEsc(j.address || "no address")} · ${rvEsc(j.recordType)}</div>
          </div>`).join("") || `<div class="rv-sub" style="margin-top:8px">No matches.</div>`;
        box.querySelectorAll(".rv-job").forEach(el => {
          el.onclick = () => { rvSelectedJob = d.jobs[parseInt(el.dataset.i, 10)]; rvRenderPanel(); };
        });
      } catch (e) { box.innerHTML = `<div class="rv-sub" style="margin-top:8px">Search failed — offline?</div>`; }
    }, 300);
  };
}

// ── Boot ─────────────────────────────────────────────────────────────────────
if ("indexedDB" in window) rvResumeScan();
