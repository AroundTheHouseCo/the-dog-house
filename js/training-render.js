// Shared renderer for training content. Used by BOTH surfaces — the
// rehearsal side-panel (in-appointment, beside the live slide) and the
// standalone Training Coach screen. One dataset, one set of renderers, so
// the two views can never drift apart.
//
// VERBATIM RULE: every string below is emitted exactly as it appears in the
// JSON (or its local edit override — see tcField). The only transformation
// is tcResolve() token substitution, which the spec asks for. Nothing is
// truncated, reflowed, summarised or reworded.
//
// EDITABLE CONTENT (training-mode-v2 Phase 2): every field below that reads
// through tcField(id, path) — instead of the plain tcResolve(entry.field)
// this file used before — is wrapped in a data-tc-path span and becomes
// tap-to-edit when Edit Mode is on (js/training-coach.js). If a field
// ISN'T routed through tcField, that's deliberate: move_recommendation is
// a cross-reference, not authored prose, and tone/duration/status/flags
// are rendering metadata, not text a rep writes. See the Phase 1 report
// for the full allowlist reasoning.

// Which slides are showing full script rather than beats. Persists for the
// session (spec: "a rep who wants full script for slide 14 shouldn't have to
// re-tap every time they navigate back").
const tcExpanded = new Set();
function tcIsExpanded(id){ return tcExpanded.has(id); }
function tcToggleExpanded(id){ tcExpanded.has(id) ? tcExpanded.delete(id) : tcExpanded.add(id); }

const TC_STATUS_LABEL = {
  final_pending_revision: "Pending revision",
  placeholder: "Not yet written",
  parked: "Parked",
};

// ------------------------------------------------------------- pieces ----
function tcStatusBadgeHTML(entry){
  const label = TC_STATUS_LABEL[entry.status];
  if (!label) return "";                       // final / final_revised / final_new render clean
  return `<span class="tc-status ${entry.status}">${label}</span>`;
}

function tcDurationHTML(entry){
  const d = entry.duration;
  return d && d.display ? `<span class="tc-duration">${tcEsc(d.display)}</span>` : "";
}

// tone_mood — "the most-skipped and most-valuable field" per the spec, so it
// gets prominence rather than being tucked in with the metadata.
function tcToneHTML(entry, id){
  return entry.tone_mood
    ? `<div class="tc-tone"><span class="tc-tone-k">Tone</span>${tcField(id, "tone_mood")}</div>` : "";
}

function tcPurposeHTML(entry, id){
  const p = entry.purpose;
  if (!p || !p.length) return "";
  return `<div class="tc-purpose">${p.map((_, i) => `<p>${tcField(id, `purpose.${i}`)}</p>`).join("")}</div>`;
}

// Was a per-slide `personalTouch` field in js/data-sunesta.js, rendered
// only in the legacy fallback branch — which meant it silently stopped
// rendering the moment JSON content covered that slide (s02, always).
// Reusing the same .personal-touch/.pt-label/.pt-body markup here restores
// it, now genuinely visible in the walk it was written for.
function tcPersonalTouchHTML(entry, id){
  if (!entry.personal_touch) return "";
  return `<div class="personal-touch"><div class="pt-label">${ICON.pencil} Personal touch — editable per rep</div><div class="pt-body">${tcField(id, "personal_touch")}</div></div>`;
}

function tcBeatsHTML(entry, id){
  const b = entry.display_beats || [];
  if (!b.length) return "";
  return `<ul class="tc-beats">${b.map((_, i) => `<li>${tcField(id, `display_beats.${i}`)}</li>`).join("")}</ul>`;
}

// A block or a module phase — same shape either way, just a different key
// on the parent (blocks vs phases), which the caller passes as groupKey so
// the content path matches the real JSON structure.
function tcBlockHTML(id, groupKey, b, bi){
  const bits = [];
  const p = (sub) => `${groupKey}.${bi}.${sub}`;
  if (b.label) bits.push(`<div class="tc-block-label">${tcField(id, p("label"))}${
    b.duration_sec ? `<span class="tc-block-secs">${b.duration_sec}s</span>` : ""}</div>`);

  // An unfinished sentence must never be read to a customer.
  if (b.incomplete) bits.push(
    `<div class="tc-warn">${ICON.warn} Unfinished — do not deliver as written.</div>`);

  if (b.conditional) bits.push(
    `<div class="tc-conditional">Optional${b.conditional_note ? ` — ${tcField(id, p("conditional_note"))}` : ""}</div>`);

  (b.script || []).forEach((_, si) => bits.push(`<p class="tc-script">${tcField(id, p(`script.${si}`))}</p>`));

  // Actions, not words — deliberately distinct from script.
  (b.stage_directions || []).forEach((_, di) => bits.push(`<div class="tc-stage">${tcField(id, p(`stage_directions.${di}`))}</div>`));

  (b.alternates || []).forEach((alt, ai) => {
    const ap = (sub) => p(`alternates.${ai}.${sub}`);
    bits.push(`<div class="tc-alt"><div class="tc-alt-cond">${tcField(id, ap("condition"))}</div>${
      (alt.script || []).map((_, si) => `<p class="tc-script">${tcField(id, ap(`script.${si}`))}</p>`).join("")}</div>`);
  });
  if (b.sample) bits.push(`<div class="tc-sample"><span class="tc-sample-k">Example</span>${tcField(id, p("sample"))}</div>`);
  // Cross-reference to another slide_id, not authored prose — not editable here.
  if (b.move_recommendation) bits.push(
    `<div class="tc-move">Suggested move to ${tcEsc(b.move_recommendation)}</div>`);

  return `<div class="tc-block">${bits.join("")}</div>`;
}

function tcScriptHTML(entry, id){
  const groupKey = entry.blocks ? "blocks" : entry.phases ? "phases" : null;
  const groups = entry[groupKey] || [];
  if (!groups.length) return `<div class="tc-empty">No script written for this slide yet.</div>`;
  return groups.map((b, bi) => tcBlockHTML(id, groupKey, b, bi)).join("");
}

function tcSlowDownHTML(entry, id){
  const s = entry.slow_down_on;
  if (!s) return "";
  return `<div class="tc-slow"><div class="tc-slow-k">Slow down on</div>
    <p class="tc-slow-line">${tcField(id, "slow_down_on.line")}</p>
    <p class="tc-slow-why">${tcField(id, "slow_down_on.why")}</p></div>`;
}

// branches[] is an array of plain STRINGS, not objects — each is already a
// complete "If yes: …" instruction written for the rep. Rendered as-is.
function tcEngagementHTML(entry, id){
  const q = entry.engagement_question;
  if (!q) return "";
  return `<div class="tc-engage"><div class="tc-engage-k">Ask${q.when ? ` — ${tcField(id, "engagement_question.when")}` : ""}</div>
    <p class="tc-engage-q">${tcField(id, "engagement_question.text")}</p>
    ${(q.branches || []).length
      ? `<ul class="tc-branches">${q.branches.map((_, i) => `<li>${tcField(id, `engagement_question.branches.${i}`)}</li>`).join("")}</ul>` : ""}</div>`;
}

function tcCoachHTML(entry, id){
  if (!entry.coaching_note) return "";
  // \n\n are real paragraph breaks in the source; preserve them as written.
  // coaching_note is ONE string field in the schema (not an array), so it's
  // ONE editable unit — resolve first, then split the resolved HTML into
  // <p>s for display, same as before token/escape substitution wouldn't
  // ever introduce or remove a \n\n boundary.
  const html = tcFieldHTML(id, "coaching_note");
  const paras = html.split("\n\n").map((p) => `<p>${p}</p>`).join("");
  return `<div class="tc-coach"><div class="tc-coach-k">${ICON.bulb} Coaching</div>${tcEditWrap(id, "coaching_note", paras)}</div>`;
}

function tcTransitionHTML(entry, id){
  return entry.transition_out
    ? `<div class="tc-transition"><span class="tc-transition-k">Transition out</span>${tcField(id, "transition_out")}</div>` : "";
}

function tcCallbackHTML(entry, id){
  if (!entry.callback_triggers || !entry.callback_triggers.length) return "";
  return `<div class="tc-callback"><div class="tc-callback-k">Come back here when</div>
    <ul>${entry.callback_triggers.map((_, i) => `<li>${tcField(id, `callback_triggers.${i}`)}</li>`).join("")}</ul></div>`;
}

function tcTrainingNotesHTML(entry, id){
  const n = entry.training_notes;
  if (!n) return "";
  const col = (k, label, cls) => (n[k] && n[k].length)
    ? `<div class="tc-tn ${cls}"><div class="tc-tn-k">${label}</div><ul>${
        n[k].map((_, i) => `<li>${tcField(id, `training_notes.${k}.${i}`)}</li>`).join("")}</ul></div>` : "";
  return `<div class="tc-tn-wrap">${col("do", "Do", "do")}${col("do_not", "Do not", "dont")}</div>`;
}

// reactive_scripts[] use `answer[]`, not `script[]`, and carry a `trigger`
// telling the rep when it's safe to use (financing must never precede price).
function tcReactiveHTML(entry, id){
  const rs = entry.reactive_scripts || [];
  if (!rs.length) return "";
  return `<div class="tc-reactive"><div class="tc-reactive-k">If they ask</div>${
    rs.map((r, ri) => { const p = (sub) => `reactive_scripts.${ri}.${sub}`;
      return `<details class="tc-qa"><summary>${tcField(id, p("question"))}</summary>
      ${r.trigger ? `<div class="tc-qa-trigger">${tcField(id, p("trigger"))}</div>` : ""}
      ${(r.answer || r.script || []).map((_, li) => `<p class="tc-script">${tcField(id, p(`${r.answer ? "answer" : "script"}.${li}`))}</p>`).join("")}
      ${(r.stage_directions || []).map((_, di) => `<div class="tc-stage">${tcField(id, p(`stage_directions.${di}`))}</div>`).join("")}
      ${r.note ? `<div class="tc-qa-note">${tcField(id, p("note"))}</div>` : ""}</details>`; }).join("")}</div>`;
}

// The highest-value field in the system (spec, Variables §4): when the rep
// has filled ACCOMPLISH_LIST, surface it as a standing callout on every
// node whose text actually carries the token — visible in BOTH layers, so
// the tie-back can't be skipped by staying in beats view. Detection scans
// the entry itself, so it can never disagree with the script below it.
// This shows a live per-appointment VALUE, not authored content — not
// editable here (see the Setup view for that).
function tcAccomplishHTML(entry){
  const v = tcValues().ACCOMPLISH_LIST;
  if (!v) return "";
  if (!JSON.stringify(entry).includes("{{ACCOMPLISH_LIST}}")) return "";
  return `<div class="tc-accomplish"><span class="tc-accomplish-k">Their Accomplish List</span>${tcEsc(v)}</div>`;
}

// ------------------------------------------------------------ assembly ----
// The two-layer display. Beats by default; one tap swaps in the verbatim
// script. This is the single most important behaviour in the app — a new rep
// handed full paragraphs reads them aloud to the customer.
function tcEntryHTML(entry, opts){
  opts = opts || {};
  const id = entry.slide_id || entry.module_id;
  const expanded = tcIsExpanded(id);
  // No display_beats (the module, and any future beats-less entry) => there
  // is no beats layer to default to — show the script itself, no toggle.
  const hasBeats = !!(entry.display_beats && entry.display_beats.length);
  const num = entry.display_number || (entry.slide_number ? `${entry.slide_number}` : "");

  return `
    <div class="tc-head">
      <div class="tc-eyebrow">
        ${num ? `<span class="tc-num">${tcEsc(num)}</span>` : ""}
        ${opts.section ? `<span class="tc-section">${tcEsc(opts.section)}</span>` : ""}
        ${tcDurationHTML(entry)}
        ${tcStatusBadgeHTML(entry)}
        ${entry.is_money_slide ? `<span class="tc-money">Money slide</span>` : ""}
        ${entry.in_deck === false ? `<span class="tc-nodeck">Not in deck</span>` : ""}
      </div>
      <h2>${tcField(id, "title")}</h2>
      ${entry.subtitle ? `<div class="tc-subtitle">${tcField(id, "subtitle")}</div>` : ""}
    </div>
    ${tcToneHTML(entry, id)}
    ${tcAccomplishHTML(entry)}
    ${tcPurposeHTML(entry, id)}
    ${tcPersonalTouchHTML(entry, id)}
    <div class="tc-layer">
      ${hasBeats ? `<button class="tc-toggle" data-tc-toggle="${tcEsc(id)}" aria-expanded="${expanded}">
        ${expanded ? "Show beats" : "Show full script"}
      </button>` : ""}
      ${(expanded || !hasBeats) ? tcScriptHTML(entry, id) : tcBeatsHTML(entry, id)}
    </div>
    ${tcSlowDownHTML(entry, id)}
    ${tcEngagementHTML(entry, id)}
    ${tcCallbackHTML(entry, id)}
    ${tcTrainingNotesHTML(entry, id)}
    ${tcReactiveHTML(entry, id)}
    ${tcCoachHTML(entry, id)}
    ${tcTransitionHTML(entry, id)}`;
}

// Wire the expand toggles inside any container that just got tcEntryHTML.
function tcBindToggles(root, rerender){
  root.querySelectorAll("[data-tc-toggle]").forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); tcToggleExpanded(b.dataset.tcToggle); rerender(); };
  });
}
