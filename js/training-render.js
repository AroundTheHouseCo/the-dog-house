// Shared renderer for training content. Used by BOTH surfaces — the
// rehearsal side-panel (in-appointment, beside the live slide) and the
// standalone Training Coach screen. One dataset, one set of renderers, so
// the two views can never drift apart.
//
// VERBATIM RULE: every string below is emitted exactly as it appears in the
// JSON. The only transformation is tcResolve() token substitution, which the
// spec asks for. Nothing is truncated, reflowed, summarised or reworded.

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
function tcToneHTML(entry){
  return entry.tone_mood
    ? `<div class="tc-tone"><span class="tc-tone-k">Tone</span>${tcResolve(entry.tone_mood)}</div>` : "";
}

function tcPurposeHTML(entry){
  const p = entry.purpose;
  if (!p || !p.length) return "";
  return `<div class="tc-purpose">${p.map((x) => `<p>${tcResolve(x)}</p>`).join("")}</div>`;
}

function tcBeatsHTML(entry){
  const b = entry.display_beats || [];
  if (!b.length) return "";
  return `<ul class="tc-beats">${b.map((x) => `<li>${tcResolve(x)}</li>`).join("")}</ul>`;
}

// A block or a module phase — same shape for our purposes.
function tcBlockHTML(b){
  const bits = [];
  if (b.label) bits.push(`<div class="tc-block-label">${tcResolve(b.label)}${
    b.duration_sec ? `<span class="tc-block-secs">${b.duration_sec}s</span>` : ""}</div>`);

  // An unfinished sentence must never be read to a customer.
  if (b.incomplete) bits.push(
    `<div class="tc-warn">${ICON.warn} Unfinished — do not deliver as written.</div>`);

  if (b.conditional) bits.push(
    `<div class="tc-conditional">Optional${b.conditional_note ? ` — ${tcResolve(b.conditional_note)}` : ""}</div>`);

  for (const line of b.script || []) bits.push(`<p class="tc-script">${tcResolve(line)}</p>`);

  // Actions, not words — deliberately distinct from script.
  for (const sd of b.stage_directions || []) bits.push(`<div class="tc-stage">${tcResolve(sd)}</div>`);

  for (const alt of b.alternates || []) {
    bits.push(`<div class="tc-alt"><div class="tc-alt-cond">${tcResolve(alt.condition)}</div>${
      (alt.script || []).map((l) => `<p class="tc-script">${tcResolve(l)}</p>`).join("")}</div>`);
  }
  if (b.sample) bits.push(`<div class="tc-sample"><span class="tc-sample-k">Example</span>${tcResolve(b.sample)}</div>`);
  if (b.move_recommendation) bits.push(
    `<div class="tc-move">Suggested move to ${tcEsc(b.move_recommendation)}</div>`);

  return `<div class="tc-block">${bits.join("")}</div>`;
}

function tcScriptHTML(entry){
  const groups = entry.blocks || entry.phases || [];
  if (!groups.length) return `<div class="tc-empty">No script written for this slide yet.</div>`;
  return groups.map(tcBlockHTML).join("");
}

function tcSlowDownHTML(entry){
  const s = entry.slow_down_on;
  if (!s) return "";
  return `<div class="tc-slow"><div class="tc-slow-k">Slow down on</div>
    <p class="tc-slow-line">${tcResolve(s.line)}</p>
    <p class="tc-slow-why">${tcResolve(s.why)}</p></div>`;
}

// branches[] is an array of plain STRINGS, not objects — each is already a
// complete "If yes: …" instruction written for the rep. Rendered as-is.
function tcEngagementHTML(entry){
  const q = entry.engagement_question;
  if (!q) return "";
  return `<div class="tc-engage"><div class="tc-engage-k">Ask${q.when ? ` — ${tcResolve(q.when)}` : ""}</div>
    <p class="tc-engage-q">${tcResolve(q.text)}</p>
    ${(q.branches || []).length
      ? `<ul class="tc-branches">${q.branches.map((b) => `<li>${tcResolve(b)}</li>`).join("")}</ul>` : ""}</div>`;
}

function tcCoachHTML(entry){
  if (!entry.coaching_note) return "";
  // \n\n are real paragraph breaks in the source; preserve them as written.
  const paras = entry.coaching_note.split("\n\n").map((p) => `<p>${tcResolve(p)}</p>`).join("");
  return `<div class="tc-coach"><div class="tc-coach-k">${ICON.bulb} Coaching</div>${paras}</div>`;
}

function tcTransitionHTML(entry){
  return entry.transition_out
    ? `<div class="tc-transition"><span class="tc-transition-k">Transition out</span>${tcResolve(entry.transition_out)}</div>` : "";
}

function tcCallbackHTML(entry){
  if (!entry.callback_triggers || !entry.callback_triggers.length) return "";
  return `<div class="tc-callback"><div class="tc-callback-k">Come back here when</div>
    <ul>${entry.callback_triggers.map((t) => `<li>${tcResolve(t)}</li>`).join("")}</ul></div>`;
}

function tcTrainingNotesHTML(entry){
  const n = entry.training_notes;
  if (!n) return "";
  const col = (k, label, cls) => (n[k] && n[k].length)
    ? `<div class="tc-tn ${cls}"><div class="tc-tn-k">${label}</div><ul>${
        n[k].map((x) => `<li>${tcResolve(x)}</li>`).join("")}</ul></div>` : "";
  return `<div class="tc-tn-wrap">${col("do", "Do", "do")}${col("do_not", "Do not", "dont")}</div>`;
}

// reactive_scripts[] use `answer[]`, not `script[]`, and carry a `trigger`
// telling the rep when it's safe to use (financing must never precede price).
function tcReactiveHTML(entry){
  const rs = entry.reactive_scripts || [];
  if (!rs.length) return "";
  return `<div class="tc-reactive"><div class="tc-reactive-k">If they ask</div>${
    rs.map((r) => `<details class="tc-qa"><summary>${tcResolve(r.question)}</summary>
      ${r.trigger ? `<div class="tc-qa-trigger">${tcResolve(r.trigger)}</div>` : ""}
      ${(r.answer || r.script || []).map((l) => `<p class="tc-script">${tcResolve(l)}</p>`).join("")}
      ${(r.stage_directions || []).map((s) => `<div class="tc-stage">${tcResolve(s)}</div>`).join("")}
      ${r.note ? `<div class="tc-qa-note">${tcResolve(r.note)}</div>` : ""}</details>`).join("")}</div>`;
}

// The highest-value field in the system (spec, Variables §4): when the rep
// has filled ACCOMPLISH_LIST, surface it as a standing callout on every
// node whose text actually carries the token — visible in BOTH layers, so
// the tie-back can't be skipped by staying in beats view. Detection scans
// the entry itself, so it can never disagree with the script below it.
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
      <h2>${tcResolve(entry.title)}</h2>
      ${entry.subtitle ? `<div class="tc-subtitle">${tcResolve(entry.subtitle)}</div>` : ""}
    </div>
    ${tcToneHTML(entry)}
    ${tcAccomplishHTML(entry)}
    ${tcPurposeHTML(entry)}
    <div class="tc-layer">
      ${hasBeats ? `<button class="tc-toggle" data-tc-toggle="${tcEsc(id)}" aria-expanded="${expanded}">
        ${expanded ? "Show beats" : "Show full script"}
      </button>` : ""}
      ${(expanded || !hasBeats) ? tcScriptHTML(entry) : tcBeatsHTML(entry)}
    </div>
    ${tcSlowDownHTML(entry)}
    ${tcEngagementHTML(entry)}
    ${tcCallbackHTML(entry)}
    ${tcTrainingNotesHTML(entry)}
    ${tcReactiveHTML(entry)}
    ${tcCoachHTML(entry)}
    ${tcTransitionHTML(entry)}`;
}

// Wire the expand toggles inside any container that just got tcEntryHTML.
function tcBindToggles(root, rerender){
  root.querySelectorAll("[data-tc-toggle]").forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); tcToggleExpanded(b.dataset.tcToggle); rerender(); };
  });
}
