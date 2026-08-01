# Doghouse — Training Mode Build Spec

**Version:** 1.1.0 (corrected after repo survey)
**Content file:** `doghouse_sunesta_content_v1.json`
**Date:** 2026-07-31

---

## The one rule

`doghouse_sunesta_content_v1.json` is the single source of truth. **Render it. Do not rewrite it.**

Every script line, coaching note, tone cue, and duration in that file was written deliberately over a long working session. If something reads awkwardly, that is not a bug to fix in code — it is either intentional or it is tracked in that slide's `flags` array. Do not paraphrase, summarize, condense, "clean up," or improve any string value.

If content needs to change, it changes in the JSON. Never in a component.

---

## What this is

An in-home sales presentation runs alongside a slide deck (currently Canva/Ingage). Doghouse training mode is the rep-facing layer that tells a rep **what to say, how to say it, how long it should take, and what to slow down on** for each slide.

Two audiences:
1. **New reps learning the presentation** — read the whole thing, understand why each slide exists.
2. **Experienced reps in the field** — glance at beats, not paragraphs.

The UI has to serve both without compromising either. That drives the core display decision below.

---

## Core display decision: two layers

**Default view = beats.** Each slide renders `display_beats` as a short scannable list. That is what a rep sees on screen at a customer's kitchen table.

**Tap to expand = full script.** One tap reveals `blocks[].script` verbatim.

Rationale: a new rep given full paragraphs on screen will read them aloud to the customer. That is the single most common failure mode this app exists to prevent. Beats force the rep to talk; the script is there for prep and for recovery.

Make the expand state persistent per-slide within a session (a rep who wants full script for slide 14 shouldn't have to re-tap every time they navigate back).

---

## Data model

### Top level

```
meta              object   — version, company, runtime estimate
sections[]        array    — 5 sections, each with ordered slide_ids
variables[]       array    — merge fields (see below)
slides[]          array    — 24 entries
modules[]         array    — 1 entry (pricing transition, not a slide)
open_items[]      array    — outstanding decisions, cross-referenced to slides
global_conventions object  — never-say list, product naming, contacts
```

### Slide object

| Field | Type | Notes |
|---|---|---|
| `slide_id` | string | stable key, e.g. `s14` |
| `slide_number` | int | may repeat (prep items are both 0) |
| `display_number` | string | optional, e.g. `0A`, `0B` |
| `section` | string | FK to `sections[].id` |
| `title` | string | |
| `status` | enum | see status values below |
| `in_deck` | bool | false = training-only, no corresponding Canva slide |
| `purpose` | string[] | 1–2 lines, render as the slide's "why" |
| `duration` | object | `min_sec`, `max_sec`, `display` |
| `tone_mood` | string | render prominently — this is the most-skipped and most-valuable field |
| `blocks[]` | array | the script itself, in order |
| `transition_out` | string\|null | |
| `slow_down_on` | object\|null | `{line, why}` |
| `coaching_note` | string | may contain `\n\n` paragraph breaks |
| `engagement_question` | object\|null | `{text, when, branches[]}` |
| `callback_triggers` | string[] | only on `s11` — when to return to a reference slide |
| `variables_used` | string[] | FK to `variables[].key` |
| `verification[]` | array | unverified claims — metadata only, see below |
| `flags[]` | array | known issues, `{severity, issue, recommendation}` |
| `display_beats` | string[] | the default view |
| `is_money_slide` | bool | only `s14` |
| `is_reference_slide` | bool | only `s11` |

### Block object

| Field | Type | Notes |
|---|---|---|
| `block_id` | string | |
| `label` | string\|null | section header within the slide |
| `duration_sec` | int\|null | present on multi-block slides (s14, s15, s22) |
| `script` | string[] | each element is a paragraph |
| `stage_directions` | string[] | render visually distinct from script — these are actions, not words |
| `conditional` | bool | if true, rep may skip entirely |
| `conditional_note` | string | when to include |
| `alternates[]` | array | `{condition, script[]}` — branching script |
| `sample` | string | a filled-in example of a variable block |
| `incomplete` | bool | **if true, render a visible warning — do not deliver as written** |
| `move_recommendation` | string | slide_id this block should move to; informational only |

### Status values

| Status | Meaning | Render |
|---|---|---|
| `final` | ready to use | normal |
| `final_revised` | rewritten this session | normal |
| `final_new` | written from scratch this session | normal |
| `final_pending_revision` | usable but flagged for rewrite | subtle marker |
| `placeholder` | slide exists, no content | visible "not yet written" state |
| `parked` | intentionally deferred | visible "parked" state, deprioritized in nav |

`placeholder` and `parked` slides must still appear in navigation. A rep needs to know slide 17 exists and has nothing behind it — silently hiding it creates a worse surprise in the field.

---

## Variables

`variables[]` defines merge fields that appear in script text as `{{KEY}}`.

Three sources:

- `rep_profile` — set once per rep (`REP_NAME`, `REP_PERSONAL_STORY`)
- `company_settings` — set once, admin-editable (`LEAD_TIME_WEEKS`, all five `PRICE_*` fields, `CURRENT_PROMO`)
- `discovery` / `measure` / `proposal` — entered per appointment (`ACCOMPLISH_LIST`, `THEIR_AREA`, etc.)

**Requirements:**

1. Company settings must be editable in-app by an admin without a code change. Price conditioning ranges and lead times move; a rep quoting a two-year-old range at a kitchen table is worse than not conditioning at all.
2. Unfilled variables render as a visible placeholder chip (e.g. a highlighted `[Their area]`), never as raw `{{THEIR_AREA}}` and never as blank space.
3. `variables[]` entries with `"status": "NOT_SET"` should surface in an admin setup checklist. Six fields are currently unset and four of them block slide 22 entirely.
4. `ACCOMPLISH_LIST` is the highest-value field in the system. If the rep enters it during discovery, it should render on-screen at `preframe`, `s06`, `s12`, `s19`, `s22`, and `m_pricing_transition`. A new rep who cannot skip the Accomplish List callback is the single biggest behavioural win available here.

---

## The pricing transition module

`modules[]` contains one entry that is **not a slide** — it has no Canva counterpart. It uses `phases[]` instead of `blocks[]` and adds:

- `training_notes` — `{do[], do_not[]}`
- `reactive_scripts[]` — financing and subcontractor Q&A, triggered by customer question rather than sequence

Render it as its own screen, reachable from the end of the deck and from a persistent nav item. Reps will want it before an appointment without walking 22 slides.

Reactive scripts need to be reachable **fast** — a rep gets asked about financing mid-presentation and needs the answer in two taps, not by scrolling a module. Consider surfacing them in a persistent quick-access drawer.

---

## Verification metadata

Some claims in the scripts are not yet confirmed with the manufacturer. These are recorded in each slide's `verification[]` array with `status: "unverified"` and a `note`.

**Per the owner's instruction, this metadata does not render to reps in v1.** Script text displays exactly as written, unmarked.

The field exists so that when a claim is confirmed or corrected, it is a one-line edit in a known location rather than a search through 24 slides. Three entries carry `"priority": "highest"` or `"high"` — the 98 MPH wind figure (appears twice), the arm warranty terms, and the wind sensor mechanism.

Build the field into the schema. Do not build UI for it yet. Leave a clean insertion point.

---

## Flags

`flags[]` is a known-issues list per slide: `{severity, issue, recommendation}`. Severities are `high`, `medium`, `low`. There are 75 across the deck.

This is **internal content-maintenance data**, not rep-facing. Suggested: an admin-only view that lists all flags sorted by severity, filterable by slide. Useful when Jack sits down to do a content pass.

`open_items[]` at the top level is the same idea rolled up — 20 outstanding decisions, each with `blocks[]` listing which slides it holds up. An admin dashboard showing "these 6 items are blocking 11 slides" would be genuinely useful.

---

## Navigation requirements

1. **Linear walk** — prev/next through the full sequence, respecting `sections[].order` and `slide_ids` order.
2. **Section jump** — 5 sections: Before You Start, Why Us, Why Sunesta, Awnings, Pricing & Close.
3. **Bookmarking** — `s11` (`is_reference_slide: true`) is designed to be returned to during objection handling. It needs one-tap access from anywhere. Its `callback_triggers` array lists exactly when.
4. **Search** — reps will look for "financing" or "warranty" mid-appointment. Search across `title`, `blocks[].script`, and `reactive_scripts[].question`.

Note that section 2 is labelled **"Why Us"**, not "Why Sunesta." The source deck mislabelled it; slides 2–6 are all ATH content. The corrected label is in the JSON.

---

## Timing display

`duration.display` is a human string ("1:45 – 2:00"). `min_sec` / `max_sec` are the machine values.

Total runtime for slides with timing set is roughly 30–36 minutes, plus 3–4 for the pricing transition. The pre-frame promises the customer "about twenty minutes," which is a known and accepted mismatch — the promise is deliberately conservative.

If you build a timer feature: make it a rehearsal tool, not a live-appointment tool. A rep watching a countdown clock at someone's kitchen table is worse than a rep running long.

---

## Corrections applied in v1.1

| v1.0 said | Actual | Note |
|---|---|---|
| 75 flags | 68 on slides, 75 including the module's 7 | Both correct, different scope |
| "six" unset variables (list named seven) | **7** | `CURRENT_PROMO` was dropped from the prose |
| `ACCOMPLISH_LIST` on 6 slides incl. `s19` | **5** — `preframe`, `s06`, `s12`, `s22`, `m_pricing_transition` | `s19` has no token, correctly. Its tie-back is a coaching instruction, not scripted text — the rep repeats the customer's own wording, and templating it would make it wooden. |
| Runtime 30–36 min | **32:50 – 40:00** across slides, plus 3–4 for the module | The pre-frame promises "about twenty minutes." Known and accepted mismatch — but see note below. |

`variables_used[]` has been regenerated from actual `{{TOKEN}}` occurrences on every slide. It is now accurate, but **drive rendering off actual tokens regardless** and treat this field as advisory.

`REP_NAME` is declared and unused. Retained for future use; harmless.

### Runtime note

40 minutes against a 20-minute promise is a real content problem, not a rendering one. It is tracked as a content decision, not a build blocker — do not attempt to solve it in code.

## Explicitly out of scope for this build

- Editing content in-app (v2)
- Syncing with Canva/Ingage
- Slide imagery — the JSON has no image references
- Analytics
- Any UI for `verification[]`

---

## Migration notes — CORRECTED IN v1.1

**This does NOT replace `data-sunesta.js`.** The v1.0 wording ("replaces whatever content structure currently exists") was wrong and, taken literally, would destroy the customer-facing deck.

This JSON contains **zero render keys** — no `type`, `image`, `hotspots`, `models`, `photos`, `scrub`. It cannot drive the customer deck and was never meant to. It replaces only the **training slice** of each slide object (`script`, `talkingPoints`, `coach`, `personalTouch`).

The two coexist, joined by ID through an adapter.

### Authority rule

> **The live deck owns slide ORDER and SECTION membership. This JSON owns CONTENT.**

`sections_advisory[]` in the JSON is metadata only. Do not route from it. Section membership and sequence come from `data-sunesta.js`.

Reason: the JSON was built from the script document and encodes the slide order as it stood at authoring time. The deck has moved since (Drop Screen relocated from AWNINGS to SMART TECHNOLOGY) and will move again. Routing from the JSON guarantees recurring drift; routing from the deck eliminates it permanently.

`m_pricing_transition` has been removed from `sections_advisory[].slide_ids` — it lives in `modules[]`, not `slides[]`, and a naive `slide_ids → slides[]` lookup returned `undefined`. It still needs an explicit special case wherever it appears in the walk.

Preserve existing routing, auth, layout, nav-zone/z-index contract, service worker caching, and `registry.js` binding. The content path is what's being overhauled — not the shell.
