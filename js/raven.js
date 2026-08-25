// THE DOGHOUSE — Raven: Start Appointment.
//
// Rep searches JobNimbus for the job they're standing in front of, taps it,
// and the app opens an appointment on Cockpit and starts recording audio.
// Audio is written to IndexedDB as it is captured, then uploaded when the
// rep stops. Nothing here touches the Sunesta Coach / training-coach.js
// feature — unrelated surface, deliberately kept separate.
//
// THE CONSTRAINT THIS FILE IS SHAPED AROUND: in standalone PWA mode iOS
// does not keep an audio capture session alive while the app is
// backgrounded (device-tested — see mic-test.html). There is no API that
// buys us background capture from a PWA, so the design is (a) make
// backgrounding visibly discouraged while recording, (b) detect it when it
// happens anyway, (c) tell the rep honestly how much was lost and let them
// decide, and (d) ship every interruption to Cockpit as metadata so the
// transcript's gaps are explainable later rather than mysterious.
//
// Local-first: chunks land in IndexedDB (NOT localStorage — that caps
// around 5-10MB and stores strings only, which cannot hold an hour of
// audio) so an app crash, a reload, or a dead upload never costs the
// appointment. Cache/queue ownership is entirely this file's; sw.js is not
// involved (Raven is live-only data, nothing to precache).

// ── Config ─────────────────────────────────────────────────────────────
// Unlike the Quote Builder (which ships a static X-Pricing-Key constant),
// Raven carries NO shared secret in this file. The rep signs in with a PIN,
// Cockpit hands back a per-rep token, and that token authenticates every
// later call via X-Raven-Token. There is deliberately nothing here to fill
// in before shipping — a key baked into a public static site is exactly
// what this replaced.
const RAVEN_BASE = "https://ath-cockpit.onrender.com";

// 5s slices: small enough that a crash costs almost nothing, large enough
// that an hour-long appointment stays around 720 IndexedDB rows.
const RAVEN_TIMESLICE_MS = 5000;
// audio/mp4 is what iOS Safari actually produces; the fallbacks exist so a
// desktop browser can still exercise the flow during development.
const RAVEN_MIME_CANDIDATES = ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm"];

const RAVEN_DB = "doghouse-raven";
const RAVEN_DB_VERSION = 1;
// Tokens do not expire server-side; revocation is manual. So the session
// persists until a call comes back 401 or the rep taps "Not you?".
const RAVEN_SESSION_LS_KEY = "doghouse.raven.session";

// ── State ──────────────────────────────────────────────────────────────
const RV = {
  view: "search",          // "login" | "search" | "recording" | "review"
  pin: "",                 // never persisted — cleared the moment it is exchanged for a token
  authBusy: false,
  authError: null,         // wrong-PIN / unreachable copy for the login screen
  disabled: false,         // RAVEN_ENABLED is off on Cockpit (503) — distinct from any error
  query: "",
  results: null,           // null = never searched; [] = searched, no hits
  searching: false,
  searchError: null,
  job: null,               // the selected job record
  appointmentId: null,
  startedAt: null,
  status: "idle",          // idle | starting | recording | stopping | uploading | uploaded | pending-upload | error
  errorMessage: null,
  interruptions: [],       // [{at: ISO, ms: number, killedCapture: bool}]
  hiddenAt: null,          // set while the app is backgrounded mid-recording
  pendingInterruption: null, // surfaced to the rep on return to foreground
  captureLost: false,      // true once the OS has actually killed the recorder
  seq: 0,
  bytes: 0,
  mimeType: "",
  pendingCount: 0,         // appointments sitting in IndexedDB awaiting upload
};

let rvRecorder = null;
let rvStream = null;
let rvWakeLock = null;
let rvTimerHandle = null;

// ── IndexedDB ──────────────────────────────────────────────────────────
// Two stores: `appointments` (one small record per appointment, keyed by
// appointmentId) and `chunks` (one row per MediaRecorder slice, indexed by
// appointmentId so a whole appointment can be read back or dropped).
function rvDbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RAVEN_DB, RAVEN_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("appointments")) {
        db.createObjectStore("appointments", { keyPath: "appointmentId" });
      }
      if (!db.objectStoreNames.contains("chunks")) {
        const s = db.createObjectStore("chunks", { keyPath: "id", autoIncrement: true });
        s.createIndex("byAppointment", "appointmentId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function rvTx(db, store, mode, fn){
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function rvPutAppointment(rec){
  const db = await rvDbOpen();
  await rvTx(db, "appointments", "readwrite", (s) => s.put(rec));
  db.close();
}

async function rvGetAppointment(appointmentId){
  const db = await rvDbOpen();
  const rec = await rvTx(db, "appointments", "readonly", (s) => s.get(appointmentId));
  db.close();
  return rec || null;
}

async function rvAllAppointments(){
  const db = await rvDbOpen();
  const all = await rvTx(db, "appointments", "readonly", (s) => s.getAll());
  db.close();
  return all || [];
}

async function rvPutChunk(appointmentId, seq, blob){
  const db = await rvDbOpen();
  await rvTx(db, "chunks", "readwrite", (s) => s.add({ appointmentId, seq, blob, at: Date.now() }));
  db.close();
}

async function rvGetChunks(appointmentId){
  const db = await rvDbOpen();
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction("chunks", "readonly");
    const req = tx.objectStore("chunks").index("byAppointment").getAll(appointmentId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => a.seq - b.seq);
}

async function rvClearAppointment(appointmentId){
  const db = await rvDbOpen();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["chunks", "appointments"], "readwrite");
    const idx = tx.objectStore("chunks").index("byAppointment");
    const cur = idx.openCursor(IDBKeyRange.only(appointmentId));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { c.delete(); c.continue(); }
    };
    tx.objectStore("appointments").delete(appointmentId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

// ── Cockpit API ────────────────────────────────────────────────────────
// Errors carry a `kind` because the UI has to tell three of them apart:
// a wrong/revoked credential, the whole feature being switched off, and an
// ordinary network failure. Collapsing "capture is disabled" into a generic
// error would tell a rep with perfectly good credentials that something is
// broken, when nothing is.
function rvErr(kind, message){
  const e = new Error(message);
  e.kind = kind; // "auth" | "disabled" | "network" | "http"
  return e;
}

async function rvReadJson(r){
  try { return await r.json(); } catch (e) { return null; }
}

// clearTokenOn401: true for every authenticated route (a 401 there means the
// stored token was revoked, so drop it), false for /auth itself (a 401 there
// just means the rep mistyped the PIN — there is no session to discard).
async function rvCheck(r, clearTokenOn401){
  const d = await rvReadJson(r);
  if (r.status === 503) throw rvErr("disabled", (d && d.error) || "Raven capture is disabled");
  if (r.status === 401) {
    if (clearTokenOn401) rvClearSession();
    throw rvErr("auth", (d && d.error) || "invalid or revoked token");
  }
  if (!r.ok) throw rvErr("http", (d && d.error) || `HTTP ${r.status}`);
  if (d && d.ok === false) throw rvErr("http", d.error || "request rejected by Cockpit");
  return d;
}

// Every authenticated Raven call goes through here, so token attachment,
// revocation handling and the disabled-feature check exist in exactly one place.
async function rvApi(path, opts){
  const token = rvGetToken();
  if (!token) throw rvErr("auth", "not signed in");
  const o = opts || {};
  let r;
  try {
    r = await fetch(`${RAVEN_BASE}${path}`, Object.assign({}, o, {
      headers: Object.assign({ "X-Raven-Token": token }, o.headers || {}),
    }));
  } catch (e) {
    throw rvErr("network", e.message || "network request failed");
  }
  return rvCheck(r, true);
}

// PIN → token. The only unauthenticated Raven route.
async function rvLogin(pin){
  let r;
  try {
    r = await fetch(`${RAVEN_BASE}/api/raven/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
  } catch (e) {
    throw rvErr("network", e.message || "network request failed");
  }
  const d = await rvCheck(r, false);
  if (!d || !d.token) throw rvErr("http", "Cockpit did not return a token");
  rvSetSession(d.token, d.repName || "");
  return d;
}

async function rvSearchJobs(q){
  const d = await rvApi(`/api/raven/jobs/search?q=${encodeURIComponent(q)}`);
  return (d && d.data) || [];
}

// The rep is attributed server-side from the token — this deliberately sends
// jnid and nothing else.
async function rvCreateAppointment(jnid){
  const d = await rvApi("/api/raven/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jnid }),
  });
  const id = d && (d.appointmentId || (d.data && d.data.appointmentId));
  if (!id) throw rvErr("http", "Cockpit did not return an appointmentId");
  return id;
}

// Upload contract: base64 inside a JSON body, NOT multipart.
// Rationale: Cockpit is a plain Node http server with no multipart parser
// and no dependency to add one; hand-rolling a boundary parser there is the
// error-prone option. A JSON body is what every other Cockpit POST already
// takes, and it keeps the interruption metadata in the same object as the
// audio instead of split across parts. Cost is base64's ~33% inflation on
// the wire, which is acceptable for a one-shot post-appointment upload over
// wifi and is the reason chunks are stored as raw Blobs locally and only
// encoded at send time.
function rvBlobToBase64(blob){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result);
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    fr.onerror = () => reject(fr.error || new Error("could not read audio blob"));
    fr.readAsDataURL(blob);
  });
}

async function rvUploadAppointment(rec, blob){
  const audioBase64 = await rvBlobToBase64(blob);
  await rvApi(`/api/raven/appointments/${encodeURIComponent(rec.appointmentId)}/audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mimeType: rec.mimeType,
      interrupted: (rec.interruptions || []).length > 0,
      interruptions: rec.interruptions || [],
      startedAt: rec.startedAt,
      endedAt: rec.endedAt || new Date().toISOString(),
      audioBase64,
    }),
  });
  return true;
}

// ── Session ────────────────────────────────────────────────────────────
// {token, repName} from /api/raven/auth. Persisted because the backend
// issues non-expiring tokens: re-prompting on every app open would be noise
// at a customer's kitchen table. It is dropped only on a 401 (revoked) or
// when the rep explicitly signs out.
function rvGetSession(){
  try {
    const raw = localStorage.getItem(RAVEN_SESSION_LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return (s && s.token) ? s : null;
  } catch (e) { return null; }
}
function rvGetToken(){ const s = rvGetSession(); return s ? s.token : ""; }
function rvRepName(){ const s = rvGetSession(); return (s && s.repName) || ""; }
function rvSetSession(token, repName){
  try {
    localStorage.setItem(RAVEN_SESSION_LS_KEY, JSON.stringify({ token, repName }));
  } catch (e) { /* private mode — the session just won't survive a reload */ }
}
function rvClearSession(){
  try { localStorage.removeItem(RAVEN_SESSION_LS_KEY); } catch (e) { /* nothing to drop */ }
}

// ── Recording ──────────────────────────────────────────────────────────
function rvPickMime(){
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
  for (const c of RAVEN_MIME_CANDIDATES) if (MediaRecorder.isTypeSupported(c)) return c;
  return "";
}

// Screen auto-lock is the likeliest way a rep backgrounds the app without
// meaning to, so hold a wake lock for the duration. Unsupported or refused
// is fine — the visibilitychange safety net below still catches it.
async function rvAcquireWakeLock(){
  try {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      rvWakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) { rvWakeLock = null; }
}
function rvReleaseWakeLock(){
  try { if (rvWakeLock) rvWakeLock.release(); } catch (e) { /* already gone */ }
  rvWakeLock = null;
}

async function rvBeginAppointment(job){
  RV.job = job;
  RV.status = "starting";
  RV.errorMessage = null;
  RV.view = "recording";
  renderRaven();

  let appointmentId;
  try {
    appointmentId = await rvCreateAppointment(job.jnid);
  } catch (err) {
    // Nothing was captured yet, so bounce to whichever screen actually
    // addresses the problem instead of a dead-end error inside the
    // recording view. "auth" already cleared the session, so falling back
    // to the search view renders the login screen.
    if (err.kind === "disabled") { RV.disabled = true; RV.view = "search"; RV.status = "idle"; renderRaven(); return; }
    if (err.kind === "auth") { RV.view = "search"; RV.status = "idle"; renderRaven(); return; }
    RV.status = "error";
    RV.errorMessage = err.message;
    renderRaven();
    return;
  }

  const mime = rvPickMime();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    RV.status = "error";
    RV.errorMessage = "Microphone access was denied — recording cannot start. " + (err.name || "");
    renderRaven();
    return;
  }

  let rec;
  try {
    rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    RV.status = "error";
    RV.errorMessage = "This device can't record audio in a supported format.";
    renderRaven();
    return;
  }

  rvStream = stream;
  rvRecorder = rec;
  RV.appointmentId = appointmentId;
  RV.startedAt = new Date().toISOString();
  RV.mimeType = rec.mimeType || mime || "audio/mp4";
  RV.status = "recording";
  RV.seq = 0;
  RV.bytes = 0;
  RV.interruptions = [];
  RV.captureLost = false;
  RV.pendingInterruption = null;

  await rvPutAppointment({
    appointmentId,
    jnid: job.jnid,
    jobLabel: job.name || job.display_name || "",
    repName: rvRepName(),   // local label only — Cockpit attributes from the token
    startedAt: RV.startedAt,
    mimeType: RV.mimeType,
    status: "recording",
    interruptions: [],
  });

  rec.ondataavailable = (e) => {
    if (!e.data || !e.data.size) return;
    const seq = RV.seq++;
    RV.bytes += e.data.size;
    // Fire-and-forget: a failed chunk write must not stall capture, but it
    // does need to be visible rather than silent.
    rvPutChunk(appointmentId, seq, e.data).catch((err) => {
      console.warn("Raven: chunk write failed", err);
    });
  };
  rec.onerror = (e) => {
    console.warn("Raven: recorder error", e.error);
  };
  rec.onstop = () => { rvFinishRecording(); };

  rec.start(RAVEN_TIMESLICE_MS);
  rvAcquireWakeLock();
  rvStartTimer();
  renderRaven();
}

function rvStartTimer(){
  rvStopTimer();
  rvTimerHandle = setInterval(() => {
    const el = document.getElementById("rvElapsed");
    if (el && RV.startedAt) el.textContent = rvFormatElapsed(Date.now() - new Date(RV.startedAt).getTime());
  }, 1000);
}
function rvStopTimer(){
  if (rvTimerHandle) clearInterval(rvTimerHandle);
  rvTimerHandle = null;
}

function rvFormatElapsed(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function rvFormatGap(ms){
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.round(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

function rvRequestStop(){
  if (RV.status !== "recording") return;
  RV.status = "stopping";
  rvStopTimer();
  rvReleaseWakeLock();
  renderRaven();
  if (rvRecorder && rvRecorder.state !== "inactive") {
    rvRecorder.stop(); // onstop → rvFinishRecording()
  } else {
    rvFinishRecording();
  }
}

// Assemble → upload → clear. On any failure the appointment stays in
// IndexedDB marked pending-upload and is retried on next open / next time
// the device comes back online; nothing is ever discarded on a failed send.
async function rvFinishRecording(){
  if (rvStream) { rvStream.getTracks().forEach((t) => t.stop()); rvStream = null; }
  rvRecorder = null;
  rvStopTimer();
  rvReleaseWakeLock();

  const appointmentId = RV.appointmentId;
  if (!appointmentId) { RV.view = "search"; renderRaven(); return; }

  const endedAt = new Date().toISOString();
  const rec = (await rvGetAppointment(appointmentId)) || {};
  rec.appointmentId = appointmentId;
  rec.endedAt = endedAt;
  rec.interruptions = RV.interruptions.slice();
  rec.mimeType = RV.mimeType;
  rec.status = "pending-upload";
  await rvPutAppointment(rec);

  RV.status = "uploading";
  RV.view = "review";
  renderRaven();

  const ok = await rvTryUpload(rec);
  RV.status = ok ? "uploaded" : "pending-upload";
  if (!ok) RV.errorMessage = "Upload didn't go through — it's saved on this iPad and will retry automatically.";
  await rvRefreshPendingCount();
  renderRaven();
}

async function rvTryUpload(rec){
  try {
    const chunks = await rvGetChunks(rec.appointmentId);
    if (!chunks.length) {
      // Nothing was ever captured — don't leave a phantom pending upload
      // sitting in the queue forever.
      await rvClearAppointment(rec.appointmentId);
      return true;
    }
    const blob = new Blob(chunks.map((c) => c.blob), { type: rec.mimeType || "audio/mp4" });
    await rvUploadAppointment(rec, blob);
    await rvClearAppointment(rec.appointmentId);
    return true;
  } catch (err) {
    console.warn("Raven: upload failed, keeping local copy —", err.message);
    return false;
  }
}

// ── The backgrounding safety net ───────────────────────────────────────
// iOS will not keep capture alive behind the app. We cannot prevent that,
// so we measure it: stamp the moment we lose the foreground, and on return
// work out how long we were gone and whether the recorder actually
// survived. `rvRecorder.state` is the honest signal — if the OS tore the
// session down it reads "inactive" and we must not claim the rep can just
// carry on.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (RV.status === "recording") RV.hiddenAt = Date.now();
    return;
  }
  if (RV.hiddenAt == null) return;
  const ms = Date.now() - RV.hiddenAt;
  RV.hiddenAt = null;
  if (RV.status !== "recording" && RV.status !== "stopping") return;

  const stillLive = !!rvRecorder && rvRecorder.state === "recording";
  const entry = { at: new Date().toISOString(), ms, killedCapture: !stillLive };
  RV.interruptions.push(entry);
  RV.pendingInterruption = entry;
  if (!stillLive) {
    RV.captureLost = true;
    rvStopTimer();
  }
  // Persist immediately — if the app is killed before Stop is ever tapped,
  // the interruption log still survives with the audio.
  if (RV.appointmentId) {
    rvGetAppointment(RV.appointmentId).then((rec) => {
      if (!rec) return;
      rec.interruptions = RV.interruptions.slice();
      return rvPutAppointment(rec);
    }).catch(() => { /* best effort */ });
  }
  renderRaven();
});

function rvDismissInterruption(){
  RV.pendingInterruption = null;
  renderRaven();
}

// ── Pending-upload retry ───────────────────────────────────────────────
// Same posture as the Quote Builder's cache refresh: try on open, try again
// when connectivity returns, never block the UI on either.
async function rvRefreshPendingCount(){
  try {
    const all = await rvAllAppointments();
    RV.pendingCount = all.filter((a) => a.status === "pending-upload").length;
  } catch (e) { RV.pendingCount = 0; }
}

async function rvRetryPendingUploads(){
  if (!navigator.onLine) return;
  let all;
  try { all = await rvAllAppointments(); } catch (e) { return; }
  const pending = all.filter((a) => a.status === "pending-upload");
  for (const rec of pending) {
    if (rec.appointmentId === RV.appointmentId && RV.status === "recording") continue;
    await rvTryUpload(rec);
  }
  await rvRefreshPendingCount();
  if (typeof appView !== "undefined" && appView === "raven") renderRaven();
}

window.addEventListener("online", () => { rvRetryPendingUploads(); });

// ── Views ──────────────────────────────────────────────────────────────
function rvEsc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function renderRaven(){
  const el = document.getElementById("ravenPanel");
  if (!el) return;
  // Recording and review come first on purpose: if a token is revoked
  // mid-appointment, capture keeps running locally and the upload queue
  // retries later. Dropping a rep onto a login screen mid-visit would
  // unmount the only Stop control they have.
  if (RV.view === "recording") return rvRenderRecording(el);
  if (RV.view === "review") return rvRenderReview(el);
  if (RV.disabled) return rvRenderDisabled(el);
  if (!rvGetToken()) return rvRenderLogin(el);
  return rvRenderSearch(el);
}

function rvRenderLogin(el){
  el.innerHTML = `
    <div class="center-head">
      <div class="eyebrow">Rep-only</div>
      <h1>Sign in to Raven</h1>
    </div>
    <div class="rv-login">
      <p class="rv-login-copy">Enter your PIN to record appointments. You'll stay signed in on this iPad.</p>
      <input id="rvPin" class="rv-pin" type="password" inputmode="numeric" pattern="[0-9]*"
             autocomplete="off" placeholder="••••" value="${rvEsc(RV.pin)}">
      ${RV.authError ? `<div class="rv-error">${rvEsc(RV.authError)}</div>` : ""}
      <button class="qb-btn-primary" id="rvPinBtn"${RV.authBusy ? " disabled" : ""}>${RV.authBusy ? "Checking…" : "Sign in"}</button>
    </div>`;
  const pinEl = document.getElementById("rvPin");
  const go = () => {
    const pin = pinEl.value.trim();
    if (!pin || RV.authBusy) return;
    rvDoLogin(pin);
  };
  document.getElementById("rvPinBtn").onclick = go;
  pinEl.onkeydown = (e) => { if (e.key === "Enter") go(); };
  pinEl.oninput = () => { RV.pin = pinEl.value; };
  if (!RV.authBusy) { try { pinEl.focus(); } catch (e) { /* not focusable yet */ } }
}

// RAVEN_ENABLED is off on Cockpit. Deliberately NOT worded as an error:
// this state is reachable with a perfectly valid PIN and token, and telling
// a rep their credentials failed would send them chasing the wrong problem.
function rvRenderDisabled(el){
  el.innerHTML = `
    <div class="qb-status">
      <div class="qb-status-icon">${ICON.lock}</div>
      <h2>Raven capture is currently turned off</h2>
      <p>Appointment recording has been switched off on Cockpit. This isn't a problem with this iPad or your sign-in — try again later.</p>
      <button class="qb-btn-primary" id="rvDisabledRetry">Try again</button>
    </div>`;
  document.getElementById("rvDisabledRetry").onclick = () => { RV.disabled = false; renderRaven(); };
}

async function rvDoLogin(pin){
  RV.authBusy = true; RV.authError = null;
  renderRaven();
  try {
    await rvLogin(pin);
    RV.pin = "";           // never keep the PIN around once it's a token
    RV.disabled = false;
    RV.view = "search";
  } catch (err) {
    if (err.kind === "disabled") {
      // Correct PIN is entirely possible here — the feature is just off.
      RV.disabled = true;
      RV.pin = "";
    } else if (err.kind === "auth") {
      RV.authError = "Incorrect PIN, try again";
    } else if (err.kind === "network") {
      RV.authError = navigator.onLine
        ? "Couldn't reach Cockpit — check your connection and try again."
        : "You're offline — signing in needs a connection.";
    } else {
      RV.authError = err.message;
    }
  }
  RV.authBusy = false;
  renderRaven();
}

function rvSignOut(){
  rvClearSession();
  RV.pin = ""; RV.authError = null; RV.results = null; RV.searchError = null;
  RV.view = "search";   // renderRaven falls through to the login screen
  renderRaven();
}

function rvRenderSearch(el){
  const rows = RV.results;
  let listHTML = "";
  if (RV.searching) {
    listHTML = `<div class="rv-empty">Searching JobNimbus…</div>`;
  } else if (RV.searchError) {
    listHTML = `<div class="rv-error">${rvEsc(RV.searchError)}</div>`;
  } else if (rows && !rows.length) {
    listHTML = `<div class="rv-empty">No jobs matched “${rvEsc(RV.query)}”.</div>`;
  } else if (rows) {
    listHTML = `<div class="rv-list">${rows.map((j, i) => `
      <button class="rv-job" data-i="${i}">
        <div class="rv-job-name">${rvEsc(j.name || j.display_name || "Unnamed job")}</div>
        <div class="rv-job-meta">${rvEsc(j.address || "")}</div>
        <div class="rv-job-chips">
          ${j.status_name ? `<span class="rv-chip">${rvEsc(j.status_name)}</span>` : ""}
          ${j.rep ? `<span class="rv-chip alt">${rvEsc(j.rep)}</span>` : ""}
        </div>
      </button>`).join("")}</div>`;
  }

  el.innerHTML = `
    <div class="center-head">
      <div class="eyebrow">Rep-only</div>
      <h1>Start Appointment</h1>
    </div>
    ${RV.pendingCount ? `<div class="rv-pending-banner">${RV.pendingCount} recording${RV.pendingCount === 1 ? "" : "s"} still waiting to upload. ${navigator.onLine ? "Retrying now…" : "Will send automatically once you're back online."}</div>` : ""}
    <div class="rv-signed-in">
      <span>Signed in as <b>${rvEsc(rvRepName() || "this iPad")}</b></span>
      <button class="rv-signout" id="rvSignOut">Not you?</button>
    </div>
    <div class="rv-search-row">
      <input id="rvQuery" type="search" value="${rvEsc(RV.query)}" placeholder="Customer name or address" autocomplete="off" autocapitalize="words">
      <button class="qb-btn-primary" id="rvSearchBtn">Search</button>
    </div>
    ${listHTML}
  `;

  const soEl = document.getElementById("rvSignOut");
  if (soEl) soEl.onclick = rvSignOut;
  const qEl = document.getElementById("rvQuery");
  const go = () => {
    RV.query = qEl.value.trim();
    if (RV.query.length < 2) return;
    rvDoSearch();
  };
  document.getElementById("rvSearchBtn").onclick = go;
  qEl.onkeydown = (e) => { if (e.key === "Enter") go(); };
  el.querySelectorAll(".rv-job").forEach((b) => {
    b.onclick = () => {
      const j = RV.results[Number(b.dataset.i)];
      if (j) rvBeginAppointment(j);
    };
  });
}

async function rvDoSearch(){
  RV.searching = true; RV.searchError = null;
  renderRaven();
  try {
    RV.results = await rvSearchJobs(RV.query);
  } catch (err) {
    RV.results = null;
    if (err.kind === "disabled") {
      RV.disabled = true; RV.searchError = null;
    } else if (err.kind === "auth") {
      // Token was revoked server-side and has just been cleared — say so,
      // then let renderRaven fall through to the login screen.
      RV.searchError = null;
      RV.authError = "Your sign-in was revoked. Enter your PIN again.";
    } else if (err.kind === "network") {
      RV.searchError = navigator.onLine
        ? `Couldn't search JobNimbus: ${err.message}`
        : "You're offline — job search needs a connection.";
    } else {
      RV.searchError = `Couldn't search JobNimbus: ${err.message}`;
    }
  }
  RV.searching = false;
  renderRaven();
}

function rvRenderRecording(el){
  const job = RV.job || {};
  if (RV.status === "starting") {
    el.innerHTML = `<div class="qb-status"><div class="qb-status-icon">⏳</div><div>Starting appointment…</div></div>`;
    return;
  }
  if (RV.status === "error") {
    el.innerHTML = `<div class="qb-status">
      <div class="qb-status-icon">${ICON.warn}</div>
      <h2>Couldn't start recording</h2>
      <p>${rvEsc(RV.errorMessage || "")}</p>
      <button class="qb-btn-primary" id="rvBackToSearch">Back to search</button>
    </div>`;
    document.getElementById("rvBackToSearch").onclick = () => { rvResetToSearch(); renderRaven(); };
    return;
  }

  const interruptionHTML = RV.pendingInterruption ? `
    <div class="rv-interrupt">
      <div class="rv-interrupt-title">${RV.pendingInterruption.killedCapture ? "Recording stopped" : "Recording was interrupted"}</div>
      <p>${RV.pendingInterruption.killedCapture
        ? `The app was in the background for about ${rvEsc(rvFormatGap(RV.pendingInterruption.ms))} and iOS ended the recording. Everything captured before that is saved.`
        : `The app was in the background for about ${rvEsc(rvFormatGap(RV.pendingInterruption.ms))}. Audio from that stretch is missing.`}</p>
      <div class="rv-interrupt-actions">
        ${RV.pendingInterruption.killedCapture
          ? `<button class="qb-btn-primary" id="rvStopBtn2">Save what was recorded</button>`
          : `<button class="qb-btn-primary" id="rvContinueBtn">Continue recording</button>
             <button class="rv-btn-ghost" id="rvStopBtn2">Stop &amp; upload</button>`}
      </div>
    </div>` : "";

  el.innerHTML = `
    <div class="rv-recording-wrap">
      <div class="rv-live ${RV.captureLost ? "lost" : ""}">
        <span class="rv-dot"></span>
        <span class="rv-live-text">${RV.captureLost ? "Recording ended" : "Recording — stay on this screen."}</span>
      </div>
      <div class="rv-elapsed" id="rvElapsed">${rvFormatElapsed(RV.startedAt ? Date.now() - new Date(RV.startedAt).getTime() : 0)}</div>
      <div class="rv-job-card">
        <div class="rv-job-name">${rvEsc(job.name || job.display_name || "")}</div>
        <div class="rv-job-meta">${rvEsc(job.address || "")}</div>
      </div>
      ${!RV.captureLost ? `<p class="rv-warn-copy">Leaving this app — switching apps, or letting the screen lock — stops the recording. iOS does not let this app record in the background.</p>` : ""}
      ${RV.interruptions.length ? `<div class="rv-gap-log">${RV.interruptions.length} interruption${RV.interruptions.length === 1 ? "" : "s"} logged and sent with the recording.</div>` : ""}
      ${interruptionHTML}
      <button class="rv-stop-btn" id="rvStopBtn">${RV.status === "stopping" ? "Stopping…" : "Stop &amp; Upload"}</button>
    </div>
  `;

  const stop = document.getElementById("rvStopBtn");
  if (stop) stop.onclick = rvRequestStop;
  const stop2 = document.getElementById("rvStopBtn2");
  if (stop2) stop2.onclick = () => { RV.pendingInterruption = null; rvRequestStop(); };
  const cont = document.getElementById("rvContinueBtn");
  if (cont) cont.onclick = rvDismissInterruption;
  if (RV.status === "recording" && !RV.captureLost) rvStartTimer();
}

function rvRenderReview(el){
  const gaps = RV.interruptions.length;
  if (RV.status === "uploading") {
    el.innerHTML = `<div class="qb-status"><div class="qb-status-icon">⏳</div><div>Uploading recording to Cockpit…</div></div>`;
    return;
  }
  const uploaded = RV.status === "uploaded";
  el.innerHTML = `
    <div class="qb-status">
      <div class="qb-status-icon">${uploaded ? ICON.checkCircle : ICON.signal}</div>
      <h2>${uploaded ? "Recording uploaded" : "Saved on this iPad"}</h2>
      <p>${uploaded
        ? "The recording is with Cockpit."
        : rvEsc(RV.errorMessage || "It will upload automatically next time you're online.")}</p>
      ${gaps ? `<p class="rv-gap-log">${gaps} interruption${gaps === 1 ? "" : "s"} were logged and sent with it.</p>` : ""}
      <button class="qb-btn-primary" id="rvDone">Done</button>
    </div>`;
  document.getElementById("rvDone").onclick = () => { rvResetToSearch(); renderRaven(); };
}

// ── Lifecycle hooks used by app.js ─────────────────────────────────────
function rvResetToSearch(){
  RV.view = "search";
  RV.job = null;
  RV.appointmentId = null;
  RV.startedAt = null;
  RV.status = "idle";
  RV.errorMessage = null;
  RV.interruptions = [];
  RV.pendingInterruption = null;
  RV.captureLost = false;
  RV.results = null;
  RV.searchError = null;
  RV.pin = "";
  RV.authError = null;
  RV.authBusy = false;
  // RV.disabled is deliberately NOT reset: if Cockpit has capture switched
  // off, walking back to Home and in again should still say so rather than
  // silently offering a search that cannot work.
}

// True while a recording is live — app.js uses this to refuse navigation
// away from the recording screen, since leaving it unmounts the only Stop
// control the rep has.
function rvIsRecording(){
  return RV.status === "recording" || RV.status === "stopping";
}

rvRefreshPendingCount().then(() => {
  rvRetryPendingUploads();
});
