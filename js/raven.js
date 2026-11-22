// RAVEN — Start Appointment.
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
// Raven carries NO shared secret in this file (and since the Nov 2026 hotfix
// neither does the Quote Builder — it now rides this same sign-in). The rep signs in with a PIN,
// Cockpit hands back a per-rep token, and that token authenticates every
// later call via X-Raven-Token. There is deliberately nothing here to fill
// in before shipping — a key baked into a public static site is exactly
// what this replaced.
const RAVEN_BASE = self.RAVN_API_BASE || "https://ath-cockpit.onrender.com";   // js/env.js picks prod vs staging

// 5s slices: small enough that a crash costs almost nothing, large enough
// that an hour-long appointment stays around 720 IndexedDB rows.
const RAVEN_TIMESLICE_MS = 5000;
// Cockpit rejects anything over 100MB (RAVEN_MAX_AUDIO_BYTES, server.js) —
// not enforced client-side; an oversized file just fails the upload the
// normal way and stays queued. This constant is only the client-side
// give-up point so an upload can never hang the UI indefinitely. Raised
// from 35000 (Phase 0 diagnostic, RAVEN-UPLOAD-RELIABILITY-PHASE0-REPORT.md
// in ath-cockpit): 35s is not enough to land a real multi-MB appointment
// recording over a weak/throttled cellular upload, and every timeout here
// was indistinguishable server-side from the mic-acquisition and
// abandoned-recording gaps closed elsewhere in this file — this one still
// needed its own fix.
const RAVEN_UPLOAD_TIMEOUT_MS = 120000;
// audio/mp4 is what iOS Safari actually produces; the fallbacks exist so a
// desktop browser can still exercise the flow during development.
const RAVEN_MIME_CANDIDATES = ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm"];

// Shown on the Device check screen, so a phone can say which app version it
// is actually running (bump with sw.js TIER1_VERSION).
const RAVN_APP_BUILD = "2026-11-22.2";
const RAVEN_DB = "doghouse-raven";
const RAVEN_DB_VERSION = 1;
// Tokens do not expire server-side; revocation is manual. So the session
// persists until Cockpit says the sign-in is over or the rep taps "Sign out".
const RAVEN_SESSION_LS_KEY = "doghouse.raven.session";

// ── State ──────────────────────────────────────────────────────────────
const RV = {
  view: "search",          // "login" | "search" | "recording" | "review"
  pin: "",                 // never persisted — cleared the moment it is exchanged for a token
  loginMode: "account",    // "account" (email + password + 2FA) | "pin" (kept until PINs are retired)
  email: "",               // remembered between screens; the password never is
  mfa: null,               // {challenge, backup} while waiting for a 2FA code
  signedOutReason: null,   // "revoked" | "credentials" | "expired" — shown on the sign-in screen
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
  interruptions: [],       // [{at: ISO, ms: number, offsetMs: number|null, killedCapture: bool}]
  hiddenAt: null,          // set while the app is backgrounded mid-recording
  pendingInterruption: null, // surfaced to the rep on return to foreground
  captureLost: false,      // true once the OS has actually killed the recorder
  seq: 0,
  bytes: 0,
  mimeType: "",
  pendingCount: 0,         // appointments sitting in IndexedDB awaiting upload
  deviceRecordings: [],    // the same, with size/state, for the on-device list
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
// broken, when nothing is. `code` and `body` carry Cockpit's own answer.
function rvErr(kind, message, code, body){
  const e = new Error(message);
  e.kind = kind; // "auth" | "disabled" | "network" | "http"
  e.code = code || null;
  e.body = body || null;
  return e;
}

async function rvReadJson(r){
  try { return await r.json(); } catch (e) { return null; }
}

async function rvCheck(r){
  const d = await rvReadJson(r);
  if (r.status === 503) throw rvErr("disabled", (d && d.error) || "RAVN capture is disabled", "disabled", d);
  if (r.status === 401) throw rvErr("auth", (d && d.error) || "not signed in", d && d.code, d);
  if (!r.ok) throw rvErr("http", (d && d.error) || `HTTP ${r.status}`, d && d.code, d);
  if (d && d.ok === false) throw rvErr("http", d.error || "request rejected by Cockpit", d.code, d);
  return d;
}

// ── Sign-in (RAVN step 3) ──────────────────────────────────────────────
// Two kinds of sign-in live side by side until Jack retires PINs:
//   account: email + password (+ 2FA) → a 15-minute access token, renewed
//            with a refresh token. Sent as Authorization: Bearer.
//   pin:     the original per-rep PIN → a device token (X-Raven-Token).
// Every Cockpit call in the app goes through rvAuthedFetch, so refreshing,
// revocation and the wipe each exist in exactly one place.
//
// THE WIPE NEVER TOUCHES A RECORDING. Signing out — by choice, or because an
// owner revoked this device — clears pricing, the reference map and the
// tokens. Recordings live in IndexedDB and are only ever deleted after
// Cockpit confirms it has them (rvTryUpload). Before clearing anything, the
// app tries once more to upload what is waiting; whatever can't go up stays
// on the device and uploads when someone signs back in.
function rvSessionKind(){ const s = rvGetSession(); return s ? (s.kind === "account" ? "account" : "pin") : null; }

let rvRefreshing = null;   // single-flight: one refresh at a time, everyone waits on it
async function rvRefreshNow(){
  if (rvRefreshing) return rvRefreshing;
  rvRefreshing = (async () => {
    const s = rvGetSession();
    if (!s || s.kind !== "account" || !s.refresh) throw rvErr("auth", "not signed in", "unauthenticated");
    let r;
    try {
      r = await fetch(`${RAVEN_BASE}/api/raven/app/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: s.refresh }),
      });
    } catch (e) { throw rvErr("network", e.message || "network request failed"); }
    const d = await rvReadJson(r);
    if (!r.ok || !d || !d.ok) {
      if (r.status === 401) throw rvErr("auth", (d && d.error) || "Sign in again.", d && d.code, d);
      throw rvErr("http", (d && d.error) || `HTTP ${r.status}`);
    }
    rvSaveAccountSession(d, false);
    return d;
  })();
  try { return await rvRefreshing; } finally { rvRefreshing = null; }
}

// Headers for one Cockpit call. Refreshes an access token that is about to
// lapse. A network failure while refreshing is NOT a sign-out — the call
// just goes out with what we have and fails like any offline call would.
async function rvAuthHeaders(){
  const s = rvGetSession();
  if (!s) return null;
  if (s.kind !== "account") return { "X-Raven-Token": s.token };
  if (!s.access || !s.accessExp || s.accessExp - Date.now() < 60000) {
    try { await rvRefreshNow(); }
    catch (e) {
      if (e.kind === "auth") { await rvSignedOutByServer(e.code, e.body && e.body.wipe); return null; }
    }
  }
  const s2 = rvGetSession();
  return s2 && s2.access ? { Authorization: "Bearer " + s2.access } : null;
}

function rvRawAuthHeaders(){
  const s = rvGetSession();
  if (!s) return null;
  if (s.kind !== "account") return { "X-Raven-Token": s.token };
  return s.access ? { Authorization: "Bearer " + s.access } : null;
}

// fetch() with the current sign-in attached. Retries once after a refresh if
// Cockpit says the access token lapsed. A final "you're signed out / revoked"
// answer runs the sign-out path (upload first, then wipe). Returns the
// Response; callers read it as they always did.
async function rvAuthedFetch(url, opts, _retried){
  const o = opts || {};
  // Uploads use the stored credential as-is: Cockpit accepts a lapsed access
  // token (and a just-revoked one, for a week) on the audio route, so an
  // upload never waits on — or is blocked by — a refresh.
  const auth = o._raw ? rvRawAuthHeaders() : await rvAuthHeaders();
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: "not signed in", code: "unauthenticated" }),
      { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const fo = Object.assign({}, o, { headers: Object.assign({}, o.headers || {}, auth) });
  delete fo._raw; delete fo._noSignOut;
  const r = await fetch(url, fo);
  if (r.status !== 401) return r;
  const d = await rvReadJson(r.clone());
  const code = d && d.code;
  // invalid_token too: if Cockpit's signing key ever changes, the refresh
  // token (stored separately) still gets a fresh access token — nobody is
  // signed out by a key change.
  if ((code === "token_expired" || code === "invalid_token") && !_retried && !o._noSignOut && rvSessionKind() === "account") {
    try { await rvRefreshNow(); } catch (e) {
      if (e.kind === "auth") await rvSignedOutByServer(e.code, e.body && e.body.wipe);
      return r;
    }
    return rvAuthedFetch(url, opts, true);
  }
  // Grace uploads answer normally, so a 401 here is final for this sign-in.
  if (!o._noSignOut) await rvSignedOutByServer(code, d && d.wipe);
  return r;
}

// Every authenticated RAVN call goes through here.
async function rvApi(path, opts){
  if (!rvGetSession()) throw rvErr("auth", "not signed in", "unauthenticated");
  let r;
  try { r = await rvAuthedFetch(`${RAVEN_BASE}${path}`, opts); }
  catch (e) { throw rvErr("network", e.message || "network request failed"); }
  return rvCheck(r);
}

// Cockpit said this sign-in is over (revoked, disabled, password changed…).
// Upload what's waiting while the old credential still gets the upload grace,
// THEN clear tokens and cached pricing/map. Recordings are never deleted here.
let rvSigningOut = null;
async function rvSignedOutByServer(code, wipe){
  if (rvSigningOut) return rvSigningOut;
  if (!rvGetSession()) return;
  rvSigningOut = (async () => {
    RV.signedOutReason = wipe ? "revoked" : (code === "credentials_changed" ? "credentials" : "expired");
    try { await rvRetryPendingUploads({ grace: true }); } catch (e) { /* keep going — the recordings stay local */ }
    rvClearSession();
    await rvRefreshPendingCount();
    if (typeof appView !== "undefined" && appView === "raven") renderRaven();
  })();
  try { await rvSigningOut; } finally { rvSigningOut = null; }
}

// PIN → device token. Kept until Jack retires PINs.
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
  const d = await rvCheck(r);
  if (!d || !d.token) throw rvErr("http", "Cockpit did not return a token");
  rvSetSession(d.token, d.repName || "");
  return d;
}

function rvDeviceLabel(){
  const ua = navigator.userAgent || "";
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  return "Browser";
}

// Email + password. Returns {mfa:{challenge,…}} when a code is needed next,
// or signs in and returns the identity.
async function rvAccountLogin(email, password){
  let r;
  try {
    r = await fetch(`${RAVEN_BASE}/api/raven/app/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, device: rvDeviceLabel() }),
    });
  } catch (e) { throw rvErr("network", e.message || "network request failed"); }
  const d = await rvReadJson(r);
  if (!r.ok || !d || !d.ok) throw rvErr(r.status === 401 ? "auth" : "http", (d && d.error) || `HTTP ${r.status}`, d && d.code, d);
  if (d.mfa) return { mfa: d.mfa };
  rvSaveAccountSession(d, true);
  return { identity: d.identity };
}
async function rvAccount2fa(challenge, code, backup){
  let r;
  try {
    r = await fetch(`${RAVEN_BASE}/api/raven/app/2fa`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, code, backup: !!backup }),
    });
  } catch (e) { throw rvErr("network", e.message || "network request failed"); }
  const d = await rvReadJson(r);
  if (!r.ok || !d || !d.ok) throw rvErr(r.status === 401 ? "auth" : "http", (d && d.error) || `HTTP ${r.status}`, d && d.code, d);
  rvSaveAccountSession(d, true);
  return { identity: d.identity };
}

async function rvSearchJobs(q){
  const d = await rvApi(`/api/raven/jobs/search?q=${encodeURIComponent(q)}`);
  return (d && d.results) || [];
}

// The rep is attributed server-side from the token — this deliberately sends
// jnid and nothing else.
async function rvCreateAppointment(jnid){
  const d = await rvApi("/api/raven/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jnid }),
  });
  const id = d && d.appointmentId;
  if (!id) throw rvErr("http", "Cockpit did not return an appointmentId");
  return id;
}

// Fix for the Phase 0 diagnostic's #1 root cause
// (RAVEN-UPLOAD-RELIABILITY-PHASE0-REPORT.md, ath-cockpit): rvBeginAppointment
// creates the Cockpit-side appointment BEFORE getUserMedia()/MediaRecorder
// setup runs, so a failure there used to leave that appointment orphaned at
// 'started' forever — nothing is ever written to IndexedDB for it, so it's
// invisible to the retry queue below. Best-effort and fire-and-forget on
// purpose: this is called from inside an error path that's already showing
// the rep a real problem, and if the cancel call itself fails (offline, token
// revoked), the appointment is still caught later by Cockpit's own
// stale-appointment sweep — it just costs a day's delay, not a silent loss.
async function rvCancelAppointment(appointmentId, reason){
  try {
    await rvApi(`/api/raven/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  } catch (e) {
    console.warn("Raven: appointment cancel failed (will go stale server-side instead) —", e.message);
  }
}

// Upload contract: multipart/form-data, matching Cockpit's actual route
// (server.js, POST /api/raven/appointments/:id/audio — parseMultipart,
// the same binary-safe parser already proven on /api/training/upload).
// The audio binary goes under a field literally named `file`; the server
// pulls its own recorded startedAt/mimeType from the appointment record it
// already holds, so nothing else about the recording needs to travel here
// except the interruption metadata: `interrupted` ("true"/"false") and
// `interruptedAt` (JSON array of ms-offsets into the recording, filtered
// server-side to numbers only). No base64 — the stored Blob goes straight
// into the FormData part, which is also what avoids base64's ~33% size
// inflation on a file that can already run into the tens of MB.
function rvFileNameForMime(mimeType){
  const m = String(mimeType || "");
  if (m.indexOf("mp4") >= 0) return "recording.m4a";
  if (m.indexOf("webm") >= 0) return "recording.webm";
  if (m.indexOf("ogg") >= 0) return "recording.ogg";
  return "recording.audio";
}

// ── Upload (RAVN step 5) ──────────────────────────────────────────────
// Chunked and resumable: the recording goes up in 5 MB pieces. Each piece is
// retried on its own, and Cockpit remembers which pieces it already has, so
// a dropped connection, a reload or a dead battery only costs the piece in
// flight — the next try (same device, any time later) picks up where it
// stopped. No size limit beyond Cockpit's 2 GB.
//
// The recording on this device is NEVER deleted here. rvTryUpload deletes it
// only after Cockpit says the whole file is stored, at the right size.
const RAVEN_PART_TIMEOUT_MS = 90000;
const RAVEN_PART_TRIES = 4;
const rvUploadProgress = {};   // appointmentId → {sent, total} while uploading

function rvSetProgress(appointmentId, sent, total){
  rvUploadProgress[appointmentId] = { sent, total };
  const pct = total ? Math.min(100, Math.floor((sent / total) * 100)) : 0;
  document.querySelectorAll(`[data-rv-pct="${appointmentId}"]`).forEach((n) => { n.textContent = pct + "%"; });
  document.querySelectorAll(`[data-rv-bar="${appointmentId}"]`).forEach((n) => { n.style.width = pct + "%"; });
}

// One upload call, with the stored credential as-is (Cockpit accepts a
// lapsed or just-revoked sign-in on the upload routes, so an upload never
// waits on a refresh). `timeoutMs` gives every call an explicit give-up.
async function rvUploadCall(rec, path, opts, timeoutMs){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs || 30000);
  try {
    return await rvApi(path, Object.assign({ signal: controller.signal, _raw: true, _noSignOut: !!(rec && rec._grace) }, opts));
  } finally { clearTimeout(t); }
}
const rvSleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Worth trying the same piece again? Network trouble and server hiccups yes;
// a definite "no" from Cockpit (wrong owner, already uploaded…) no.
const rvRetryable = (err) => err.kind === "network" || (err.kind === "http" && err.code === "store_failed");

async function rvUploadAppointment(rec, blob){
  try {
    return await rvUploadChunked(rec, blob);
  } catch (err) {
    // Cockpit without step 5 (or an older one) has no chunked routes: use
    // the original single upload, which still works for files under 100 MB.
    if (err.kind === "http" && /Unknown raven endpoint/.test(err.message || "")) return rvUploadSingle(rec, blob);
    // Cockpit already holds audio for this appointment. Only if it is the
    // SAME size as ours (a retry after a lost response) is it safe to let
    // go of the local copy; anything else stays on the device.
    if (err.code === "already_uploaded" && err.body && err.body.bytes === blob.size) return true;
    throw err;
  } finally {
    delete rvUploadProgress[rec.appointmentId];
  }
}

async function rvUploadChunked(rec, blob){
  const id = encodeURIComponent(rec.appointmentId);
  const J = { "Content-Type": "application/json" };
  const interruptions = rec.interruptions || [];
  for (let round = 0; round < 3; round++) {
    // start = "begin, or tell me what you already have"
    const st = await rvUploadCall(rec, `/api/raven/appointments/${id}/upload/start`,
      { method: "POST", headers: J, body: JSON.stringify({ bytes: blob.size, contentType: rec.mimeType || "audio/mp4" }) }, 30000);
    const have = new Set(st.received || []);
    let sent = 0;
    for (const n of have) sent += n < st.totalParts ? st.partSize : blob.size - st.partSize * (st.totalParts - 1);
    rvSetProgress(rec.appointmentId, sent, blob.size);
    for (let n = 1; n <= st.totalParts; n++) {
      if (have.has(n)) continue;
      const piece = blob.slice((n - 1) * st.partSize, Math.min(blob.size, n * st.partSize));
      for (let attempt = 1; ; attempt++) {
        try {
          await rvUploadCall(rec, `/api/raven/appointments/${id}/upload/part?n=${n}&uploadId=${encodeURIComponent(st.uploadId)}`,
            { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: piece }, RAVEN_PART_TIMEOUT_MS);
          break;
        } catch (err) {
          if (err.name === "AbortError") err.kind = "network";
          if (attempt >= RAVEN_PART_TRIES || !rvRetryable(err)) throw err;
          await rvSleep(1500 * attempt * attempt);
        }
      }
      sent += piece.size;
      rvSetProgress(rec.appointmentId, sent, blob.size);
    }
    try {
      await rvUploadCall(rec, `/api/raven/appointments/${id}/upload/complete`, { method: "POST", headers: J,
        body: JSON.stringify({ interrupted: interruptions.length > 0,
          interruptedAt: interruptions.map((i) => (typeof i.offsetMs === "number" ? i.offsetMs : null)) }) }, 120000);
      return true;
    } catch (err) {
      // A piece went missing between our send and Cockpit's check (or the
      // upload was replaced): go round again — start reports what's there.
      if (err.code === "parts_missing" || err.code === "upload_replaced" || err.code === "no_upload") continue;
      throw err;
    }
  }
  throw rvErr("http", "Upload did not finish — it will try again.", "upload_incomplete");
}

// The original one-request upload (kept for a Cockpit without step 5).
async function rvUploadSingle(rec, blob){
  const interruptions = rec.interruptions || [];
  const form = new FormData();
  form.append("file", blob, rvFileNameForMime(rec.mimeType));
  form.append("interrupted", interruptions.length > 0 ? "true" : "false");
  // offsetMs is missing on interruptions logged before offsets existed —
  // JSON.stringify emits null and Cockpit drops non-numbers.
  form.append("interruptedAt", JSON.stringify(interruptions.map((i) => (typeof i.offsetMs === "number" ? i.offsetMs : null))));
  // No Content-Type header: the browser sets the multipart boundary itself.
  await rvUploadCall(rec, `/api/raven/appointments/${encodeURIComponent(rec.appointmentId)}/audio`,
    { method: "POST", body: form }, RAVEN_UPLOAD_TIMEOUT_MS);
  return true;
}

// ── Session ────────────────────────────────────────────────────────────
// Stored in localStorage under the original key (renaming it would sign
// every device out on update). Two shapes:
//   PIN:     {token, repName}
//   account: {kind:"account", access, accessExp, refresh, repName, userId, identity}
// Dropped when the rep signs out or Cockpit says the sign-in is over.
function rvGetSession(){
  try {
    const raw = localStorage.getItem(RAVEN_SESSION_LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && s.kind === "account") return s.refresh ? s : null;
    return (s && s.token) ? s : null;
  } catch (e) { return null; }
}
// "Is anyone signed in?" — callers only test it for truthiness. The real
// credential for a call always comes from rvAuthHeaders().
function rvGetToken(){ const s = rvGetSession(); return s ? (s.token || s.refresh || "") : ""; }
function rvRepName(){ const s = rvGetSession(); return (s && s.repName) || ""; }
function rvUserId(){ const s = rvGetSession(); return (s && s.userId) || null; }
function rvIdentity(){ const s = rvGetSession(); return (s && s.identity) || null; }
function rvSetSession(token, repName){
  try {
    localStorage.setItem(RAVEN_SESSION_LS_KEY, JSON.stringify({ token, repName }));
  } catch (e) { /* private mode — the session just won't survive a reload */ }
  RV.signedOutReason = null;
  rvAnnounceSession(true);
}
function rvSaveAccountSession(d, announce){
  const prev = rvGetSession() || {};
  const id = d.identity || prev.identity || {};
  try {
    localStorage.setItem(RAVEN_SESSION_LS_KEY, JSON.stringify({
      kind: "account", access: d.accessToken, accessExp: d.accessExpiresAt, refresh: d.refreshToken,
      repName: id.name || prev.repName || "", userId: id.userId || prev.userId || null, identity: id,
    }));
  } catch (e) { /* private mode */ }
  if (announce) { RV.signedOutReason = null; rvAnnounceSession(true); }
}
function rvClearSession(){
  try { localStorage.removeItem(RAVEN_SESSION_LS_KEY); } catch (e) { /* nothing to drop */ }
  rvAnnounceSession(false);
}
// Since the Nov 2026 security hotfix the Raven sign-in also unlocks the Quote
// Builder's pricing (js/quote-builder.js) and the Reference Map's customer
// data (js/reference-map.js). They listen for this to fetch on sign-in and to
// wipe their cached copies on sign-out or a revoked token (rvCheck's 401 path
// calls rvClearSession, so revocation reaches them too).
function rvAnnounceSession(signedIn){
  try { window.dispatchEvent(new CustomEvent("raven-session-changed", { detail: { signedIn } })); }
  catch (e) { /* listener errors must never break sign-in */ }
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
    // appointmentId already exists on Cockpit at this point (rvCreateAppointment
    // above succeeded) but nothing was ever written to IndexedDB for it — don't
    // leave it orphaned at 'started' forever.
    rvCancelAppointment(appointmentId, "getUserMedia failed: " + (err.name || err.message || "unknown"));
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
    rvCancelAppointment(appointmentId, "MediaRecorder construction failed: " + (err.name || err.message || "unknown"));
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
    ownerUserId: rvUserId(),   // which sign-in this recording belongs to (null for a PIN)
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

const rvUploadingNow = new Set();   // one upload per recording at a time
async function rvTryUpload(rec){
  if (rvUploadingNow.has(rec.appointmentId)) return false;
  rvUploadingNow.add(rec.appointmentId);
  rvRefreshDeviceList();
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
    // The ONLY place a recording is deleted: after Cockpit confirmed it.
    await rvClearAppointment(rec.appointmentId);
    return true;
  } catch (err) {
    console.warn("RAVN: upload failed, keeping local copy —", err.message);
    // Remember answers that won't change on a retry, so the 4-minute tick
    // stops re-sending a big file Cockpit will refuse. The recording stays.
    if (err.code === "not_owner" || err.code === "already_uploaded") {
      try {
        const cur = await rvGetAppointment(rec.appointmentId);
        if (cur) { cur.uploadConflict = err.code; cur.uploadConflictBy = rvUserId() || rvRepName(); await rvPutAppointment(cur); }
      } catch (e) { /* best effort */ }
    }
    try {
      const cur = await rvGetAppointment(rec.appointmentId);
      if (cur) { cur.lastUploadError = String(err.message || "upload failed").slice(0, 200); cur.lastUploadTryAt = Date.now(); await rvPutAppointment(cur); }
    } catch (e) { /* best effort */ }
    return false;
  } finally {
    rvUploadingNow.delete(rec.appointmentId);
    rvRefreshDeviceList();
  }
}

// Does this saved recording belong to whoever is signed in now? On a shared
// iPad, recordings wait for their own rep. Older recordings with no owner
// recorded are tried for anyone (Cockpit has the final say).
function rvRecordingIsMine(rec){
  if (rec.ownerUserId && rvUserId()) return rec.ownerUserId === rvUserId();
  const a = String(rec.repName || "").trim().toLowerCase();
  const b = String(rvRepName() || "").trim().toLowerCase();
  return !a || !b || a === b;
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
  const hiddenSince = RV.hiddenAt;   // wall-clock moment the gap started
  const ms = Date.now() - hiddenSince;
  RV.hiddenAt = null;
  if (RV.status !== "recording" && RV.status !== "stopping") return;

  const stillLive = !!rvRecorder && rvRecorder.state === "recording";
  // offsetMs is elapsed time INTO the recording where it dropped — what
  // Cockpit's interruptedAt field actually stores (server.js: "timestamp(s)
  // into the recording where it dropped"). `ms` (the gap's own duration) is
  // a different number and would be the wrong thing to send there.
  const offsetMs = RV.startedAt ? Math.max(0, hiddenSince - new Date(RV.startedAt).getTime()) : null;
  const entry = { at: new Date().toISOString(), ms, offsetMs, killedCapture: !stillLive };
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

// ── Abandoned-recording finalize ───────────────────────────────────────
// Fix for the Phase 0 diagnostic's #2 root cause
// (RAVEN-UPLOAD-RELIABILITY-PHASE0-REPORT.md, ath-cockpit): if the rep
// closes/force-quits the app — or iOS kills the backgrounded tab outright
// instead of merely hiding it — without ever tapping "Stop & Upload", the
// appointment stays in IndexedDB at status:"recording" forever, with real
// audio chunks sitting right next to it. rvRefreshPendingCount and
// rvRetryPendingUploads below only ever look for status:"pending-upload", so
// a "recording"-status row was invisible to both — the chunks were safe on
// disk but permanently inert. Runs once at startup, before the
// pending-upload scan, so anything it promotes is picked up by the normal
// retry path immediately after. Module-level `rvRecorder`/`RV` reset on
// every fresh page load, so any "recording"-status row this finds can only
// be a genuinely abandoned one from a previous session — never the one
// currently live.
async function rvFinalizeAbandonedRecordings(){
  let all;
  try { all = await rvAllAppointments(); } catch (e) { RV.storageError = e.message || String(e); return; }
  // Any saved recording that isn't already queued (only "recording" exists
  // today, but nothing should ever sit outside the queue) moves into it.
  // Never the one being recorded right now.
  const abandoned = all.filter((a) => a.status !== "pending-upload" &&
    !(a.appointmentId === RV.appointmentId && rvIsRecording()));
  for (const rec of abandoned) {
    rec.endedAt = rec.endedAt || new Date().toISOString();
    rec.status = "pending-upload";
    try { await rvPutAppointment(rec); }
    catch (e) { console.warn("Raven: failed to finalize abandoned recording", rec.appointmentId, e.message); }
  }
  // RAVN step 5b: audio pieces whose appointment record is missing would
  // never be found by the queue. Give each group a record so it uploads like
  // any other recording. Additive only — nothing is deleted or changed.
  try {
    const known = new Set(all.map((a) => a.appointmentId));
    const groups = await rvChunkSummary();
    for (const g of groups) {
      if (known.has(g.appointmentId) || !g.appointmentId) continue;
      if (g.appointmentId === RV.appointmentId && rvIsRecording()) continue;
      await rvPutAppointment({
        appointmentId: g.appointmentId,
        jobLabel: "Recovered recording",
        repName: "",
        ownerUserId: null,
        startedAt: g.firstAt ? new Date(g.firstAt).toISOString() : null,
        endedAt: g.lastAt ? new Date(g.lastAt).toISOString() : new Date().toISOString(),
        mimeType: g.type || "audio/mp4",
        status: "pending-upload",
        interruptions: [],
        recovered: true,
      });
      console.warn("Raven: recovered audio pieces with no record for", g.appointmentId);
    }
  } catch (e) { console.warn("Raven: orphan-piece check failed", e.message); }
}

// Every saved audio piece, grouped by appointment, WITHOUT reading the audio
// (Blob.size and type are metadata). Read-only.
async function rvChunkSummary(){
  const db = await rvDbOpen();
  const groups = await new Promise((resolve, reject) => {
    const out = new Map();
    const tx = db.transaction("chunks", "readonly");
    const cur = tx.objectStore("chunks").openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return;
      const v = c.value || {};
      const id = v.appointmentId || "";
      const g = out.get(id) || { appointmentId: id, pieces: 0, bytes: 0, firstAt: null, lastAt: null, type: "" };
      g.pieces++; g.bytes += (v.blob && v.blob.size) || 0;
      if (v.at) { g.firstAt = g.firstAt ? Math.min(g.firstAt, v.at) : v.at; g.lastAt = Math.max(g.lastAt || 0, v.at); }
      if (!g.type && v.blob && v.blob.type) g.type = v.blob.type;
      out.set(id, g);
      c.continue();
    };
    tx.oncomplete = () => resolve([...out.values()]);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return groups;
}

// ── Device check (RAVN step 5b) — READ-ONLY ───────────────────────────
// What this phone is actually holding: app version, every recording record
// in any state, audio pieces with no record, storage use and any storage
// error. It writes nothing, deletes nothing and never signs anyone out.
async function rvInspectDevice(){
  const r = { build: RAVN_APP_BUILD, at: new Date().toISOString(), signedInAs: rvRepName() || null,
    signIn: rvSessionKind(), standalone: !!(window.navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches)),
    online: navigator.onLine, serviceWorker: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    storage: null, persisted: null, databases: null, errors: [], appointments: [], pieces: [] };
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); r.storage = { usedMB: +(e.usage / 1048576).toFixed(1), quotaMB: +(e.quota / 1048576).toFixed(0) }; } } catch (e) { r.errors.push("storage estimate: " + e.message); }
  try { if (navigator.storage && navigator.storage.persisted) r.persisted = await navigator.storage.persisted(); } catch (e) {}
  let exists = true;
  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      r.databases = dbs.map((d) => `${d.name} (v${d.version})`);
      exists = dbs.some((d) => d.name === RAVEN_DB);
    }
  } catch (e) { r.errors.push("database list: " + e.message); }
  if (!exists) { r.errors.push(`no "${RAVEN_DB}" database on this device`); return r; }
  try {
    const all = await rvAllAppointments();
    const pieces = await rvChunkSummary();
    const byId = new Map(pieces.map((g) => [g.appointmentId, g]));
    r.appointments = all.map((a) => {
      const g = byId.get(a.appointmentId);
      return { appointmentId: a.appointmentId, label: a.jobLabel || "", status: a.status, startedAt: a.startedAt || null,
        endedAt: a.endedAt || null, rep: a.repName || "", pieces: g ? g.pieces : 0, MB: g ? +(g.bytes / 1048576).toFixed(1) : 0,
        conflict: a.uploadConflict || null, lastError: a.lastUploadError || null, recovered: !!a.recovered };
    });
    const known = new Set(all.map((a) => a.appointmentId));
    r.pieces = pieces.filter((g) => !known.has(g.appointmentId)).map((g) => ({ appointmentId: g.appointmentId || "(none)",
      pieces: g.pieces, MB: +(g.bytes / 1048576).toFixed(1), firstAt: g.firstAt ? new Date(g.firstAt).toISOString() : null }));
  } catch (e) { r.errors.push("reading recordings: " + (e.name ? e.name + ": " : "") + e.message); }
  return r;
}

function rvDeviceReportText(r){
  const L = [`RAVN device check — ${r.at}`, `App build: ${r.build}`, `Signed in: ${r.signedInAs || "no"} (${r.signIn || "-"})`,
    `Home-screen app: ${r.standalone ? "yes" : "no"} · Online: ${r.online ? "yes" : "no"} · Offline cache: ${r.serviceWorker ? "yes" : "no"}`,
    `Storage used: ${r.storage ? r.storage.usedMB + " MB of " + r.storage.quotaMB + " MB" : "unknown"} · Protected from cleanup: ${r.persisted == null ? "unknown" : (r.persisted ? "yes" : "no")}`,
    `Databases: ${r.databases ? (r.databases.join(", ") || "none") : "not reported by this browser"}`,
    `Recordings saved: ${r.appointments.length}`];
  r.appointments.forEach((a, i) => L.push(`  ${i + 1}. ${a.label || "Appointment"} — ${a.status}, ${a.MB} MB in ${a.pieces} pieces, started ${a.startedAt || "?"}` +
    `${a.rep ? ", rep " + a.rep : ""}${a.conflict ? ", conflict " + a.conflict : ""}${a.lastError ? ", last error: " + a.lastError : ""} [${a.appointmentId}]`));
  L.push(`Audio pieces with no record: ${r.pieces.length}`);
  r.pieces.forEach((p) => L.push(`  ${p.appointmentId}: ${p.MB} MB in ${p.pieces} pieces, from ${p.firstAt || "?"}`));
  if (r.errors.length) { L.push("Problems:"); r.errors.forEach((e) => L.push("  " + e)); }
  return L.join("\n");
}

async function rvRenderDeviceCheck(el){
  el.innerHTML = `<div class="center-head"><div class="eyebrow">Read-only</div><h1>Device check</h1></div><div class="rv-empty">Reading this device…</div>`;
  const r = await rvInspectDevice();
  const text = rvDeviceReportText(r);
  el.innerHTML = `
    <div class="center-head"><div class="eyebrow">Read-only — changes nothing</div><h1>Device check</h1></div>
    <pre class="rv-devcheck">${rvEsc(text)}</pre>
    <div class="rv-devcheck-actions">
      <button class="qb-btn-primary" id="rvDevCopy">Copy report</button>
      <button class="rv-signout" id="rvDevBack">Back</button>
    </div>
    <p class="rv-gap-log" id="rvDevCopied"></p>`;
  document.getElementById("rvDevBack").onclick = () => { RV.view = "search"; renderRaven(); };
  document.getElementById("rvDevCopy").onclick = async () => {
    const note = document.getElementById("rvDevCopied");
    try { await navigator.clipboard.writeText(text); note.textContent = "Copied — paste it into the chat."; }
    catch (e) { note.textContent = "Couldn't copy automatically — press and hold the text above to select it."; }
  };
}

// ── Pending-upload retry ───────────────────────────────────────────────
// Same posture as the Quote Builder's cache refresh: try on open, try again
// when connectivity returns, never block the UI on either.
async function rvRefreshPendingCount(){
  try {
    const all = await rvAllAppointments();
    const pending = all.filter((a) => a.status === "pending-upload");
    RV.pendingCount = pending.length;
    // Sizes come from the saved pieces' metadata (no audio is read).
    const list = [];
    for (const a of pending) {
      let bytes = 0;
      try { (await rvGetChunks(a.appointmentId)).forEach((c) => { bytes += (c.blob && c.blob.size) || 0; }); } catch (e) { /* size unknown */ }
      list.push({ appointmentId: a.appointmentId, label: a.jobLabel || "", startedAt: a.startedAt || a.endedAt || null, bytes,
        mine: rvRecordingIsMine(a), repName: a.repName || "", conflict: a.uploadConflict || null, lastError: a.lastUploadError || null });
    }
    list.sort((x, y) => String(x.startedAt || "").localeCompare(String(y.startedAt || "")));
    RV.deviceRecordings = list;
    RV.storageError = null;
  } catch (e) { RV.pendingCount = 0; RV.deviceRecordings = []; RV.storageError = (e && e.message) || String(e); }
  rvRefreshDeviceList();
}

// ── Recordings on this device (RAVN step 5) ───────────────────────────
// Every recording still waiting to upload, with its size and state, and an
// Upload button. Nothing here deletes anything — a recording leaves the
// device only after Cockpit confirms it (rvTryUpload).
function rvFmtBytes(n){
  if (!n) return "size unknown";
  return n >= 1048576 ? (n / 1048576).toFixed(n >= 104857600 ? 0 : 1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
}
function rvDeviceListHTML(){
  const list = RV.deviceRecordings || [];
  const check = `<button class="rv-devcheck-link" data-rv-devcheck="1">Device check</button>`;
  if (RV.storageError) return `<div id="rvDeviceList" class="rv-pending-banner rv-devlist"><div class="rv-dev-head">Couldn't read the recordings saved on this device: ${rvEsc(RV.storageError)}</div>Nothing has been deleted. Close RAVN completely and reopen it. ${check}</div>`;
  if (!list.length) return `<div id="rvDeviceList"><div class="rv-devcheck-row">No recordings waiting on this device. ${check}</div></div>`;
  const rows = list.map((r) => {
    const id = rvEsc(r.appointmentId);
    const when = r.startedAt ? new Date(r.startedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    let state, btn = "";
    if (rvUploadingNow.has(r.appointmentId)) {
      state = `Uploading… <b data-rv-pct="${id}">0%</b><div class="rv-progress"><div class="rv-progress-bar" data-rv-bar="${id}"></div></div>`;
    } else if (!r.mine) {
      state = `Waiting for ${rvEsc(r.repName || "its rep")} to sign in on this device`;
    } else if (r.conflict === "not_owner") {
      state = "Cockpit says this recording belongs to another rep — it stays on this device.";
    } else if (r.conflict === "already_uploaded") {
      state = "Cockpit already has a different recording for this appointment — this copy stays on the device. Tell Jack.";
    } else {
      state = r.lastError ? `Waiting to upload — last try: ${rvEsc(r.lastError)}` : "Waiting to upload";
      btn = `<button class="qb-btn-primary rv-up-btn" data-rv-up="${id}"${navigator.onLine ? "" : " disabled"}>Upload now</button>`;
    }
    return `<div class="rv-dev-row">
      <div class="rv-dev-main"><div class="rv-job-name">${rvEsc(r.label || "Appointment")}</div>
        <div class="rv-job-meta">${rvEsc(when)} · ${rvFmtBytes(r.bytes)}</div>
        <div class="rv-dev-state">${state}</div></div>${btn}</div>`;
  }).join("");
  return `<div id="rvDeviceList" class="rv-pending-banner rv-devlist">
    <div class="rv-dev-head">${list.length} recording${list.length === 1 ? "" : "s"} saved on this device, not yet uploaded${navigator.onLine ? "" : " — you're offline; they'll send when you're back online"}</div>
    ${rows}<div class="rv-devcheck-row">${check}</div></div>`;
}
function rvRefreshDeviceList(){
  const el = document.getElementById("rvDeviceList");
  if (!el) return;
  el.outerHTML = rvDeviceListHTML();
  for (const r of rvUploadingNow) { const p = rvUploadProgress[r]; if (p) rvSetProgress(r, p.sent, p.total); }
  document.querySelectorAll("[data-rv-up]").forEach((b) => {
    b.onclick = async () => {
      const rec = await rvGetAppointment(b.getAttribute("data-rv-up"));
      if (!rec) return rvRefreshPendingCount();
      const p = rvTryUpload(rec);
      rvRefreshDeviceList();
      await p;
      await rvRefreshPendingCount();
    };
  });
}

async function rvRetryPendingUploads(opts){
  if (!navigator.onLine || !rvGetSession()) return;
  const grace = !!(opts && opts.grace);
  let all;
  try { all = await rvAllAppointments(); } catch (e) { return; }
  const me = rvUserId() || rvRepName();
  const pending = all.filter((a) => a.status === "pending-upload")
    .filter((a) => rvRecordingIsMine(a))
    .filter((a) => !(a.uploadConflict && a.uploadConflictBy === me));
  for (const rec of pending) {
    if (rec.appointmentId === RV.appointmentId && RV.status === "recording") continue;
    await rvTryUpload(grace ? Object.assign({}, rec, { _grace: true }) : rec);
  }
  await rvRefreshPendingCount();
  if (typeof appView !== "undefined" && appView === "raven") renderRaven();
}

window.addEventListener("online", () => { rvRetryPendingUploads(); });

// Page-load and the `online` event above were the only two retry triggers
// that existed before this (Phase 0 diagnostic, RAVEN-UPLOAD-RELIABILITY-
// PHASE0-REPORT.md) — a rep who leaves Dog House open/backgrounded across a
// whole day of appointments, the normal way an installed home-screen PWA
// gets used, got exactly one retry opportunity per cold start, plus whatever
// offline→online transitions happened to fire (which a merely-slow
// connection, as opposed to a genuinely dropped one, never triggers). This
// adds a modest ticking safety net on top of both. Foreground-only by
// `document.hidden` check — this can't and shouldn't try to run in the
// background anyway, see the file-level comment on iOS PWA backgrounding —
// and reuses rvRetryPendingUploads as-is, which already skips the live
// in-progress recording on its own (see its own guard above), so this is
// safe to tick even mid-appointment.
const RAVEN_RETRY_TICK_MS = 4 * 60 * 1000;
setInterval(() => {
  if (document.hidden) return;
  rvRetryPendingUploads();
}, RAVEN_RETRY_TICK_MS);

// ── Views ──────────────────────────────────────────────────────────────
function rvEsc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// One handler for every "Device check" link, signed in or out.
document.addEventListener("click", (e) => {
  const b = e.target && e.target.closest && e.target.closest("[data-rv-devcheck]");
  if (!b || rvIsRecording()) return;
  RV.view = "devcheck";
  renderRaven();
});

function renderRaven(){
  const el = document.getElementById("ravenPanel");
  if (!el) return;
  // Recording and review come first on purpose: if a token is revoked
  // mid-appointment, capture keeps running locally and the upload queue
  // retries later. Dropping a rep onto a login screen mid-visit would
  // unmount the only Stop control they have.
  if (RV.view === "recording") return rvRenderRecording(el);
  if (RV.view === "review") return rvRenderReview(el);
  if (RV.view === "devcheck") return rvRenderDeviceCheck(el);
  if (RV.disabled) return rvRenderDisabled(el);
  if (!rvGetToken()) return rvRenderLogin(el);
  return rvRenderSearch(el);
}

function rvRenderLogin(el){
  const reason = {
    revoked: "This device was signed out by an owner. Any recordings saved on it are kept and will upload after you sign in.",
    credentials: "Your password or two-factor changed — please sign in again.",
    expired: "Please sign in again.",
  }[RV.signedOutReason] || "";
  const waiting = (RV.pendingCount
    ? `<div class="rv-pending-banner">${RV.pendingCount} recording${RV.pendingCount === 1 ? "" : "s"} saved on this device ${RV.pendingCount === 1 ? "is" : "are"} waiting to upload. ${RV.pendingCount === 1 ? "It" : "They"} will go up after you sign in.</div>` : "") +
    `<div class="rv-devcheck-row"><button class="rv-devcheck-link" data-rv-devcheck="1">Device check</button></div>`;
  const err = RV.authError ? `<div class="rv-error">${rvEsc(RV.authError)}</div>` : "";
  const busy = RV.authBusy;
  let body;
  if (RV.loginMode === "pin") {
    body = `
      <p class="rv-login-copy">Enter your PIN.</p>
      <input id="rvPin" class="rv-pin" type="password" inputmode="numeric" pattern="[0-9]*"
             autocomplete="off" placeholder="••••" value="${rvEsc(RV.pin)}">
      ${err}
      <button class="qb-btn-primary" id="rvGoBtn"${busy ? " disabled" : ""}>${busy ? "Checking…" : "Sign in"}</button>
      <button class="rv-link" id="rvModeBtn" type="button">Sign in with email instead</button>`;
  } else if (RV.mfa) {
    body = `
      <p class="rv-login-copy">${RV.mfa.backup ? "Enter one of your backup codes." : "Enter the 6-digit code from your authenticator app."}</p>
      <input id="rvCode" class="rv-pin" type="text" ${RV.mfa.backup ? 'autocapitalize="characters"' : 'inputmode="numeric" pattern="[0-9]*"'}
             autocomplete="one-time-code" placeholder="${RV.mfa.backup ? "XXXX-XXXX" : "123456"}" value="">
      ${err}
      <button class="qb-btn-primary" id="rvGoBtn"${busy ? " disabled" : ""}>${busy ? "Checking…" : "Verify"}</button>
      <button class="rv-link" id="rvBackupBtn" type="button">${RV.mfa.backup ? "Use my authenticator app" : "Use a backup code"}</button>
      <button class="rv-link" id="rvStartOverBtn" type="button">Start over</button>`;
  } else {
    body = `
      <p class="rv-login-copy">Sign in with your Cockpit email and password. You'll stay signed in on this ${rvDeviceLabel() === "iPhone" ? "phone" : "device"}.</p>
      <input id="rvEmail" class="rv-input" type="email" autocomplete="username" autocapitalize="off" placeholder="Email" value="${rvEsc(RV.email || "")}">
      <input id="rvPassword" class="rv-input" type="password" autocomplete="current-password" placeholder="Password">
      ${err}
      <button class="qb-btn-primary" id="rvGoBtn"${busy ? " disabled" : ""}>${busy ? "Signing in…" : "Sign in"}</button>
      <button class="rv-link" id="rvModeBtn" type="button">Use PIN instead</button>`;
  }
  el.innerHTML = `
    <div class="center-head">
      <div class="eyebrow">Rep-only</div>
      <h1>Sign in to RAVN</h1>
    </div>
    <div class="rv-login">
      ${reason ? `<div class="rv-note">${rvEsc(reason)}</div>` : ""}
      ${waiting}
      ${body}
    </div>`;

  const $ = (id) => document.getElementById(id);
  const go = () => {
    if (RV.authBusy) return;
    if (RV.loginMode === "pin") { const pin = $("rvPin").value.trim(); if (pin) rvDoLogin(pin); return; }
    if (RV.mfa) { const code = $("rvCode").value.trim(); if (code) rvDoCode(code); return; }
    const email = $("rvEmail").value.trim(), pw = $("rvPassword").value;
    RV.email = email;
    if (email && pw) rvDoAccountLogin(email, pw);
  };
  $("rvGoBtn").onclick = go;
  ["rvPin", "rvCode", "rvEmail", "rvPassword"].forEach((id) => { const f = $(id); if (f) f.onkeydown = (e) => { if (e.key === "Enter") go(); }; });
  if ($("rvPin")) $("rvPin").oninput = () => { RV.pin = $("rvPin").value; };
  if ($("rvModeBtn")) $("rvModeBtn").onclick = () => { RV.loginMode = RV.loginMode === "pin" ? "account" : "pin"; RV.authError = null; RV.pin = ""; renderRaven(); };
  if ($("rvBackupBtn")) $("rvBackupBtn").onclick = () => { RV.mfa.backup = !RV.mfa.backup; RV.authError = null; renderRaven(); };
  if ($("rvStartOverBtn")) $("rvStartOverBtn").onclick = () => { RV.mfa = null; RV.authError = null; renderRaven(); };
  if (!RV.authBusy) {
    const f = $("rvPin") || $("rvCode") || (RV.email ? $("rvPassword") : $("rvEmail"));
    try { f && f.focus(); } catch (e) { /* not focusable yet */ }
  }
}

// RAVEN_ENABLED is off on Cockpit. Deliberately NOT worded as an error:
// this state is reachable with a perfectly valid PIN and token, and telling
// a rep their credentials failed would send them chasing the wrong problem.
function rvRenderDisabled(el){
  el.innerHTML = `
    <div class="qb-status">
      <div class="qb-status-icon">${ICON.lock}</div>
      <h2>RAVN recording is currently turned off</h2>
      <p>Appointment recording has been switched off on Cockpit. This isn't a problem with this iPad or your sign-in — try again later.</p>
      <button class="qb-btn-primary" id="rvDisabledRetry">Try again</button>
    </div>`;
  document.getElementById("rvDisabledRetry").onclick = () => { RV.disabled = false; renderRaven(); };
}

function rvAuthErrorText(err, fallback){
  if (err.kind === "network") {
    return navigator.onLine ? "Couldn't reach Cockpit — check your connection and try again."
                            : "You're offline — signing in needs a connection.";
  }
  if (err.code === "throttled") return "Too many attempts. Wait 15 minutes and try again.";
  return err.message || fallback;
}
function rvAfterSignIn(){
  RV.pin = ""; RV.mfa = null; RV.authError = null; RV.disabled = false;
  RV.signedOutReason = null; RV.view = "search";
  rvRetryPendingUploads();   // recordings that waited for this person go up now
}

async function rvDoLogin(pin){
  RV.authBusy = true; RV.authError = null;
  renderRaven();
  try {
    await rvLogin(pin);
    rvAfterSignIn();
  } catch (err) {
    if (err.kind === "disabled") {
      // Correct PIN is entirely possible here — the feature is just off.
      RV.disabled = true;
      RV.pin = "";
    } else if (err.kind === "auth") {
      RV.authError = "Incorrect PIN, try again";
    } else {
      RV.authError = rvAuthErrorText(err, "Couldn't sign in.");
    }
  }
  RV.authBusy = false;
  renderRaven();
}

async function rvDoAccountLogin(email, password){
  RV.authBusy = true; RV.authError = null;
  renderRaven();
  try {
    const r = await rvAccountLogin(email, password);
    if (r.mfa) RV.mfa = { challenge: r.mfa.challenge, backup: false };
    else rvAfterSignIn();
  } catch (err) {
    RV.authError = rvAuthErrorText(err, "Couldn't sign in.");
  }
  RV.authBusy = false;
  renderRaven();
}

async function rvDoCode(code){
  RV.authBusy = true; RV.authError = null;
  renderRaven();
  try {
    await rvAccount2fa(RV.mfa.challenge, code, RV.mfa.backup);
    rvAfterSignIn();
  } catch (err) {
    if (err.code === "no_challenge" || err.code === "challenge_exhausted") RV.mfa = null;
    RV.authError = rvAuthErrorText(err, "That code didn't work.");
  }
  RV.authBusy = false;
  renderRaven();
}

// Sign out by choice. Uploads first; anything that can't go up stays on the
// device (never deleted) and the rep is told so before anything is cleared.
async function rvSignOut(){
  await rvRetryPendingUploads();
  let mine = 0;
  try { mine = (await rvAllAppointments()).filter((a) => a.status === "pending-upload" && rvRecordingIsMine(a)).length; } catch (e) { mine = 0; }
  if (mine && !window.confirm(`${mine} recording${mine === 1 ? " hasn't" : "s haven't"} uploaded yet. ${mine === 1 ? "It stays" : "They stay"} on this device and will upload when you sign back in. Sign out now?`)) return;
  const s = rvGetSession();
  if (s && s.kind === "account" && s.access) {
    try {
      await fetch(`${RAVEN_BASE}/api/raven/app/logout`, { method: "POST", headers: { Authorization: "Bearer " + s.access } });
    } catch (e) { /* offline — the token simply lapses; the refresh token is dropped below */ }
  }
  rvClearSession();
  RV.pin = ""; RV.mfa = null; RV.authError = null; RV.results = null; RV.searchError = null;
  RV.signedOutReason = null;
  RV.loginMode = "account";   // email sign-in is the default; PIN stays one tap away
  RV.view = "search";   // renderRaven falls through to the login screen
  await rvRefreshPendingCount();
  renderRaven();
}

// On open: pick up any change an owner made (Sales Manager switches, a
// revoke, a disabled account) without waiting for the next real call.
async function rvRefreshIdentity(){
  const s = rvGetSession();
  if (!s || s.kind !== "account" || !navigator.onLine) return;
  try {
    const r = await rvAuthedFetch(`${RAVEN_BASE}/api/raven/app/me`);
    const d = await rvReadJson(r);
    const cur = rvGetSession();
    if (r.ok && d && d.identity && cur && cur.kind === "account") {
      cur.identity = d.identity; cur.repName = d.identity.name || cur.repName;
      try { localStorage.setItem(RAVEN_SESSION_LS_KEY, JSON.stringify(cur)); } catch (e) { /* private mode */ }
    }
  } catch (e) { /* offline — try next open */ }
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
    ${rvDeviceListHTML()}
    <div class="rv-signed-in">
      <span>Signed in as <b>${rvEsc(rvRepName() || "this iPad")}</b></span>
      <button class="rv-signout" id="rvSignOut">Sign out</button>
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
  rvRefreshDeviceList();
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
        <span class="rv-live-text">${RV.captureLost ? "Recording ended" : "Appointment in progress"}</span>
      </div>
      <div class="rv-elapsed" id="rvElapsed">${rvFormatElapsed(RV.startedAt ? Date.now() - new Date(RV.startedAt).getTime() : 0)}</div>
      <div class="rv-job-card">
        <div class="rv-job-name">${rvEsc(job.name || job.display_name || "")}</div>
        <div class="rv-job-meta">${rvEsc(job.address || "")}</div>
      </div>
      ${!RV.captureLost ? `<p class="rv-warn-copy">You can switch to another part of the app and come back — this picks up right where it left off. Just don't switch to a different app or let the screen lock; iOS stops the recording when that happens.</p>` : ""}
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
    const id = rvEsc(RV.appointmentId || "");
    el.innerHTML = `<div class="qb-status"><div class="qb-status-icon">⏳</div>
      <div>Uploading recording to Cockpit… <b data-rv-pct="${id}">0%</b></div>
      <div class="rv-progress"><div class="rv-progress-bar" data-rv-bar="${id}"></div></div>
      <p class="rv-gap-log">You can leave this screen — it keeps going, and picks up where it stopped if the connection drops.</p></div>`;
    const p = rvUploadProgress[RV.appointmentId];
    if (p) rvSetProgress(RV.appointmentId, p.sent, p.total);
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

// True while a recording is live. app.js uses this to (a) decide whether to
// show a quiet "Appointment in progress" way back into this screen from
// elsewhere in the app, and (b) skip rvResetToSearch() on the way out, since
// that would null RV.appointmentId out from under the still-running
// MediaRecorder's onstop handler (rvFinishRecording reads RV.appointmentId,
// not a closure variable) and strand the upload. The recorder itself keeps
// running regardless of which screen is visible — navigating elsewhere in
// this same page never touches rvStream/rvRecorder — so nothing here needs
// to pause or resume capture, only the view needs to come back correctly.
function rvIsRecording(){
  return RV.status === "recording" || RV.status === "stopping";
}

// Finalize any abandoned "recording"-status rows BEFORE the pending-upload
// scan below, so anything it promotes is counted and retried immediately
// rather than waiting for the next trigger.
rvFinalizeAbandonedRecordings().then(() => {
  rvRefreshPendingCount().then(() => {
    rvRetryPendingUploads();
  });
});
rvRefreshIdentity();
