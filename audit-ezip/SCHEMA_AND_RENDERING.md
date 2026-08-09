# Schema, Sunesta Reference Model, and Rendering — Phases 2, 4, 5

Methodology note: field lists below were computed by loading the real JSON/JS files and
taking the union of keys actually present (Python `set` union over all `slides[]` entries in
each file, and a Node `vm` sandbox executing the real deck files in `index.html`'s script-tag
order). Nothing here is retyped by hand or inferred from naming conventions.

---

# PHASE 2 — SCHEMA

## No formal schema exists

Confirmed absent (repo-wide search, this session): no `.ts`/`.tsx` files, no `interface`/`type
X =`/`@typedef` declarations, no JSON Schema files, no zod/yup/ajv/joi or any other validation
library. The app is static HTML/CSS/JS with no build step. **The closest thing to a schema is
the field-union computed below, plus the prose rule in every content file's own
`meta.notes_for_engineers`**: *"This file is the single source of truth for [product] Doghouse
training mode. Do not paraphrase, summarize, rewrite, or 'improve' any value in this file.
Render it. All content changes happen in this file, not in code."*

## File inventory (verbatim source of truth)

| File | Role |
|---|---|
| `js/data-sunesta.js` | `DECK` const — Sunesta's customer-facing deck: slide order, section/tab membership, render type, and every visual field (image, bullets, hotspots, etc.) |
| `js/data-eclipse.js` | `ECLIPSE_DECK` const — same role, for Eclipse |
| `data/doghouse-content-v1.json` | Sunesta's training-content layer |
| `data/training-content-eclipse.json` | Eclipse's training-content layer |
| `data/training-content-shared.json` | Cross-product content (ten-step process, Do & Don't core, Four Sales) |
| `js/registry.js` | `PRODUCT_DATA` — binds each product key to its deck const + content file path |
| `js/training-content.js` | Adapter: fetches/caches content JSON, resolves `{{TOKEN}}`s, join logic, search, edit-overlay |
| `js/training-render.js` | Shared HTML renderer for one content entry (slide or module) |
| `js/training-coach.js` | Standalone Training Coach screens (walk, setup, flags) — edit-mode wiring |
| `js/app.js` | Customer-facing deck slide-type renderers; in-appointment rehearsal panel; legacy-fallback logic |

## Top-level keys per content file

```
sunesta (data/doghouse-content-v1.json): deck_map, global_conventions, meta, modules,
                                          open_items, prep_ids, sections_advisory, slides, variables
eclipse (data/training-content-eclipse.json): deck_map, meta, modules, open_items,
                                          prep_ids, slides, variables
shared  (data/training-content-shared.json): meta, reference, sequences
```

Eclipse's content file is missing `global_conventions` and `sections_advisory` — both confirmed
absent by direct key check, not by omission from a list.

## `slides[]` — field union (every key seen on any slide entry, either product)

| Field | Type | Sunesta usage | Eclipse usage | What it holds |
|---|---|---|---|---|
| `slide_id` | string | 28/28 | 18/18 | Content-layer identity, e.g. `s02`, `e01`, `ref_faq`. Joined to the deck via `deck_map`, never by position. |
| `slide_number` | number | 28/28 | 18/18 | Display-only ordinal (e.g. `2`). **Not used for ordering** — see "Slide identity/ordering" below. `ref_*` entries have this `EMPTY`. |
| `title` | string | 28/28 | 18/18 | The rendered heading. |
| `section` | string | 28/28 | 18/18 | A label (`why_ath`, `the_ezip`, `reference`, …) — descriptive metadata only. Deck-tab membership is NOT driven by this field (see below). |
| `status` | string | 28/28 | 18/18 (all `"final"`) | One of `final, final_new, final_revised, final_pending_revision, parked, placeholder`. Only the last 3 render a visible status badge (see Phase 5). Sunesta uses 6 distinct values; Eclipse uses only `"final"` — confirmed by direct distinct-value check. |
| `in_deck` | boolean | 28/28 (22 `true`, 6 `false`) | 18/18 (14 `true`, 4 `false`) | `false` = reference-only entry, reached from a hub card, excluded from the sequential walk. |
| `blocks[]` | array of objects | 28/28 | 18/18 | The script, chunked into labeled units. See block fields below. |
| `coaching_note` | string | 28/28 (some empty) | 18/18 (some empty) | Rep-only guidance, never shown to the customer. Split on `\n\n` into paragraphs at render time. |
| `reactive_scripts[]` | array | present schema-wide | populated only on `ref_faq` (14/18 entries `EMPTY`) | `{tag, question, answer[]/script[], trigger?, note?}` — conditional Q&A, rendered as a `<details>` disclosure. |
| `training_notes` | object | present schema-wide | populated only on `ref_dodont` (17/18 entries `EMPTY`) | `{do[], do_not[]}`. |
| `talking_points` | array of strings | **not used — 0/28** | 18/18 | **Eclipse-only field.** Content-JSON snake_case field, distinct from the legacy camelCase `talkingPoints` still living on the deck object (see Phase 6). Sunesta expresses the same kind of content through `purpose`/`display_beats` instead. |
| `callback_triggers[]` | array | populated on some slides | 18/18 `EMPTY` | "Come back here when…" triggers. |
| `display_beats[]` | array of strings | populated on most slides | 18/18 `EMPTY` | Short bullet "beats" — the default collapsed view before a rep taps to see the full script. |
| `display_number` | string | rarely populated | 18/18 `EMPTY` | Overrides `slide_number` in the header eyebrow when set. |
| `duration` | object `{min_sec,max_sec,display}` | populated on several slides | 18/18 `EMPTY` | Descriptive pacing text only — confirmed no timer/countdown logic anywhere reads it (see Phase 5). |
| `engagement_question` | object `{text, when?, branches[]?}` | populated on some slides | 18/18 `EMPTY` | A question the rep asks the customer, with optional response branches. |
| `flags[]` | array `{severity, issue, recommendation}` | populated on some slides + the module | 18/18 `EMPTY` | Structured, admin-visible content-QA flags (severity-ranked, filterable — see Phase 5's Content Flags view). |
| `is_money_slide` | boolean | 1/28 (`s14`) | 18/18 `EMPTY` | Drives a visible "Money slide" header badge. |
| `is_reference_slide` | boolean | 1/28 (`s11`) | 18/18 `EMPTY` | Marks the walk-screen's one-tap "★ 10 Reasons" bookmark target. Eclipse has no bookmark target at all — confirmed no Eclipse slide sets this. |
| `personal_touch` | string | populated (e.g. `s02`) | 18/18 `EMPTY` | A rep-authored personal story block, rendered with a pencil icon as explicitly "editable per rep." |
| `purpose[]` | array of strings | populated on most slides | 18/18 `EMPTY` | Why this slide exists in the arc — internal framing, not spoken copy. |
| `slow_down_on` | object `{line, why}` | populated on some slides | 18/18 `EMPTY` | Calls out one specific line worth pacing deliberately. |
| `tone_mood` | string | populated on most slides | 18/18 `EMPTY` | Prose direction on delivery tone — code comment calls this "the most-skipped and most-valuable field." |
| `transition_out` | string | populated on some slides | 18/18 `EMPTY` | The bridging line into the next slide. |
| `variables_used[]` | array of strings | populated where `{{TOKEN}}`s appear | 18/18 `EMPTY` | Declares which `{{TOKEN}}` keys a slide's text references. |
| `verification[]` | array `{claim, status, note}` | populated on some slides | 18/18 `EMPTY` | Tracks unverified factual claims pending confirmation. |

**Computed field diff:**
- **Sunesta-only** (15 fields, all confirmed `EMPTY` on every one of Eclipse's 18 entries): `callback_triggers, display_beats, display_number, duration, engagement_question, flags, is_money_slide, is_reference_slide, personal_touch, purpose, slow_down_on, tone_mood, transition_out, variables_used, verification`.
- **Eclipse-only**: `talking_points` (1 field).
- **Shared**: `blocks, coaching_note, in_deck, reactive_scripts, section, slide_id, slide_number, status, title, training_notes`.

Eclipse's 18 entries use only **11 of the 26** fields that exist anywhere in the schema (42%).

## `blocks[]` — field union

| Field | Holds |
|---|---|
| `block_id` | e.g. `b1`, `b2` |
| `label` | Optional heading for the block (Eclipse: `EMPTY` on every block, all 14 slides — confirmed) |
| `script[]` | Array of strings — the verbatim spoken lines |
| `stage_directions[]` | Actions, not words — rendered visually distinct from script |
| `alternates[]` | `{condition, script[]}` — conditional branches within a block |
| `conditional` / `conditional_note` | Marks a block as optional, with a reason |
| `duration_sec` | Per-block pacing |
| `incomplete` | Boolean flag → renders "Unfinished — do not deliver as written." (Not set `true` on any Eclipse or Sunesta block found this audit.) |
| `move_recommendation` | Cross-reference to another `slide_id` — not editable, not authored prose |
| `sample` | An example/model answer, distinct from the block's own script |

Eclipse's 14 slides use exactly one field beyond the bare minimum: every block is `{block_id,
label: EMPTY, script[], stage_directions: EMPTY}` — none of `alternates`, `conditional`,
`duration_sec`, `incomplete`, `move_recommendation`, or `sample` appear anywhere in Eclipse's
content file (confirmed: 0 occurrences in the block-field union check).

## Section/tab/module grouping

Two independent grouping systems exist, and they are **not the same thing**:

1. **Deck section (tab)** — the customer-facing tab a slide's card sits under. Comes from
   the deck file's own object structure: `DECK`/`ECLIPSE_DECK` is `{ "SECTION NAME": [slide, slide, …] }`.
   Eclipse has 3 tabs (`WHY ECLIPSE`, `THE E-ZIP`, `WRAP-UP`); Sunesta has 5 (`WHY SUNESTA`,
   `STORY OF SUNESTA`, `AWNINGS`, `SMART TECHNOLOGY`, `THE WRAP-UP`).
2. **Content `section` field** — a label on the content-JSON entry (`why_eclipse`,
   `the_ezip`, `wrap_up` for Eclipse; `why_ath`, `why_sunesta`, `awnings`, `reference`, `prep`
   for Sunesta). This is metadata carried alongside the content, not a second source of truth
   for grouping — the walk screen displays it as the "section chip," but it does not drive tab
   membership; the deck file does.

Sunesta additionally has **`sections_advisory[]`** (Eclipse: confirmed absent) — a 5-entry
array (`prep, why_ath, why_sunesta, awnings, pricing`) mapping each advisory section to an
ordered `slide_ids[]` list. Its own `meta.authority_rule` states: *"sections\[\] below is
advisory only — do not use it for routing."* It exists purely as a second, human-readable
cross-check, not a rendering input.

**Modules** are a separate top-level array (`modules[]`), for content that is not a slide at
all — Sunesta has exactly 1 (`m_pricing_transition`, `is_slide: false`); Eclipse has 0
(confirmed by direct count).

## Slide identity / ordering mechanism

Authoritative order comes from **array position in the deck file** — `tcWalk()`
(`js/training-content.js`) iterates `PDECK[tab]` in the literal order the arrays are written,
for each tab in the literal order the tabs object's keys are written. `slide_number` is a
display label only; nothing in the codebase sorts or iterates by it (confirmed: no `.sort(` on
`slide_number` anywhere, and `tcWalk`'s only ordering input is the deck array/tab structure).
Prep slides (`prep_ids`, Sunesta only) are prepended ahead of the deck walk; the pricing module
is appended after it as a hardcoded special case (`js/training-content.js`, `tcWalk()`).

Identity join: deck slide `id` (e.g. `ez-intro`) → content-JSON `slide_id` (e.g. `e01`) via
that content file's own `deck_map` object — an explicit, hand-maintained `{deckId: contentId}`
table, not a positional or `slide_number`-based lookup. Both products' `deck_map`s were checked
this audit for orphans in both directions (deck id with no map entry; map entry pointing at a
missing content id) — **zero problems found in either product** (see FINDINGS.md Phase 6).

---

# PHASE 4 — SUNESTA REFERENCE MODEL

## Full slide list (22 in-deck, in render order) + 6 reference-only entries

| # | Deck section | Deck id | Content id | Type | Title |
|---|---|---|---|---|---|
| 1 | WHY SUNESTA | introvideo | s01 | videoloop | Opening Video Loop |
| 2 | WHY SUNESTA | dealer | s02 | splittext | Your Exclusive Sunesta Dealer |
| 3 | WHY SUNESTA | products | s03 | productcards | Our Products |
| 4 | WHY SUNESTA | training | s04 | splittext | Sunesta Factory Training |
| 5 | WHY SUNESTA | doypeople | s05 | splittext | Dealer of the Year — Our People |
| 6 | WHY SUNESTA | local | s06 | photogrid | Fall In Love With Your Home Again |
| 7 | STORY OF SUNESTA | difference | s07 | difference | Experience the Sunesta Difference |
| 8 | STORY OF SUNESTA | badges | s08 | credibility | Trust & Credibility |
| 9 | STORY OF SUNESTA | process | s09 | processsteps | Our Proven Process |
| 10 | STORY OF SUNESTA | refmap | s10 | refmap | We've Worked in Your Neighborhood |
| 11 | STORY OF SUNESTA | tenreasons | s11 | reasonsgrid | 10 Reasons to Choose Sunesta |
| 12 | AWNINGS | reasons | s12 | reasonsphoto | Reasons for Shade |
| 13 | AWNINGS | scrub | s13 | videoscrub | See it in action |
| 14 | AWNINGS | models | s14 | models | Custom Made For You *(is_money_slide: true)* |
| 15 | AWNINGS | fabrics | s15 | splittext | Fabrics & Frame Colors |
| 16 | SMART TECHNOLOGY | smarttitle | s16 | herosplit | Smart Technology |
| 17 | SMART TECHNOLOGY | dropscreen | s17 | splittext | Drop Screen — Block the Low Sun |
| 18 | SMART TECHNOLOGY | mylink | s18 | splittext | myLink — Your Awning on Your Phone |
| 19 | SMART TECHNOLOGY | sensors | s19 | reasonsphoto | Automatic Sensors — Wind, Rain, Sun |
| 20 | SMART TECHNOLOGY | led | s20 | herosplit | LED Lighting — Enjoy the Space After Dark |
| 21 | THE WRAP-UP | warrantyrecap | s21 | warrantyrecap | The Warranty — Recapped |
| 22 | THE WRAP-UP | pricecond | s22 | costscale | Not All Shade Costs the Same |

Reference-only (`in_deck: false`, not in the walk above): `prep_recap` ("Table Recap on iPad"),
`preframe` ("Pre-Frame") — both listed in `prep_ids`, so they DO lead the training-coach walk
even though they're not deck slides; plus `ref_dodont`, `ref_close`, `ref_predemo`, `ref_faq` —
the same 4-entry reference-hub pattern Eclipse also has, reached only from hub cards.

## One representative slide, fully verbatim: `dealer` / `s02`

Chosen as the single richest in-deck slide by optional-field population (10 of the 15
Sunesta-only fields populated at once) — deliberately not the money slide, so this shows the
schema's descriptive/coaching range rather than duplicating the money-slide example already
covered by Eclipse's `e08` in EZIP_CONTENT_DUMP.md.

### A. Deck fields — `js/data-sunesta.js`, `DECK["WHY SUNESTA"]`

```json
{
  "id": "dealer",
  "type": "splittext",
  "image": "images/dealer-family.jpg",
  "title": "Your Exclusive Sunesta Dealer",
  "bullets": [
    "Family-owned & operated — founded 2004, based in Monument",
    "20+ years · thousands of projects across southern Colorado",
    "Exclusive Sunesta dealer for Southern Colorado",
    "You call us, you get us — local design, install & service"
  ],
  "script": "A quick background on us —\n\nWe are Around the House Home Solutions. We're a local, family-owned company based right up in Monument. We've been in business since 2004 — a little over 20 years — and in that time we've completed thousands of projects throughout southern Colorado, so this isn't something we just picked up last year.\n\nOur focus is the exterior of the house — high-quality shade solutions so homeowners can enjoy their outdoor living space, and living in Colorado, to the fullest.\n\nSomething our clients really appreciate — we're not some big corporation out of Denver… you call us, you get us. As a company we care deeply about our customers, our employees, and the local communities we serve.\n\n👉 INSERT PERSONAL TOUCH — why YOU work here (see the editable block below; swap it for your own story)\n\nTransition: \"Outside of family, your home is typically your largest investment — so we only install quality products, to the highest standards, with great warranties to back them up.\"",
  "talkingPoints": [
    "Founded 2004 · family-owned · based in Monument",
    "Thousands of projects — 20+ years, not picked up last year",
    "Not a Denver corporation: you call us, you get us",
    "Founded by Kirt & Vicki, now led with sons Maxx & Jack",
    "End on the largest-investment transition — it sets up Our Products"
  ],
  "coach": "Keep this warm and personal — don't sound like a commercial. The Personal Touch block is Matt's version: each rep should replace it with their own story (now editable in Training Mode — see the personal_touch field on s02 in data/doghouse-content-v1.json, or use the in-app editor once it ships)."
}
```

(Same legacy `script`/`talkingPoints`/`coach` fallback pattern documented for Eclipse in
EZIP_CONTENT_DUMP.md — Sunesta carries it too, on every deck slide.)

### B. Content fields — `data/doghouse-content-v1.json`, `slide_id: "s02"`

```json
{
  "slide_id": "s02",
  "slide_number": 2,
  "section": "why_ath",
  "title": "Your Exclusive Sunesta Dealer",
  "status": "final",
  "in_deck": true,
  "purpose": [
    "Trust and local positioning",
    "First credibility slide — establishes who ATH is before any product talk"
  ],
  "duration": { "min_sec": 105, "max_sec": 120, "display": "1:45 – 2:00" },
  "tone_mood": "Warm, grounded, unhurried. Conversational, not rehearsed. This is the slide where the rep sounds like a neighbor, not a presenter. No selling energy yet.",
  "blocks": [
    {
      "block_id": "b1",
      "label": null,
      "script": [
        "“A quick background on us —\nWe are Around the House Home Solutions. We're a local, family-owned company based right up in Monument. We've been in business since 2004, so a little over 20 years. In that time, we've completed thousands of projects throughout southern Colorado so this isn't something we just picked up last year.” Our focus is on the exterior of the house providing high quality shade solutions so homeowners can enjoy their outdoor living space and living in Colorado to the fullest.",
        "“Something our clients really appreciate — we're not some big corporation out of Denver… you call us, you get us. As a company, we care deeply about our customers, employees, and the local communities we serve as well."
      ],
      "stage_directions": []
    },
    {
      "block_id": "b2",
      "label": "INSERT PERSONAL TOUCH (WHY YOU WORK HERE)",
      "script": ["{{REP_PERSONAL_STORY}}"],
      "stage_directions": [],
      "sample": "FOR MATT: “Myself, I've been in the home remodeling industry since I graduated from College in 2014. I've worked with organizations ranging from large, national remodeling companies to small, owner-operated contractors, helping design and deliver projects from full home additions, interior remodels and outdoor improvements like decks and concrete patios. Over the years, I realized I have to be happy and love where I work so when I met Jack and his brother Maxx, I couldn't pass up the opportunity to work with good people that have integrity and communicate well, so I'm really happy to have found my home here at Around the House.”"
    }
  ],
  "transition_out": "Outside of awnings, we specialize in a few other products.",
  "slow_down_on": { "line": "you call us, you get us", "why": "Let it land. It's the whole slide in five words." },
  "coaching_note": "The personal touch is not filler and it is not optional. Homeowners buy the rep before they buy the company. A new rep who skips this because it feels self-indulgent will feel the difference at the close. Write your own version — same shape as the sample: where you came from, why you chose here, what you think of the people you work with. Keep it under 60 seconds and make it true.",
  "engagement_question": null,
  "variables_used": ["REP_PERSONAL_STORY"],
  "verification": [
    { "claim": "\"Exclusive\" Sunesta dealer", "status": "unverified", "note": "Exclusive in what territory? Verify with Sunesta before print." }
  ],
  "flags": [
    { "severity": "high", "issue": "Slide title says 'Your Exclusive Sunesta Dealer' but the script never says Sunesta or exclusive. Homeowner reads a claim the rep doesn't support.", "recommendation": "Retitle to 'Who We Are' / 'Local, Family-Owned Since 2004', or add a line that earns the title." },
    { "severity": "medium", "issue": "'A little over 20 years' conflicts with Slide 3's 'all 22 years'.", "recommendation": "Standardize. 2004 to 2026 is 22." }
  ],
  "display_beats": [
    "Local, family-owned, Monument",
    "Since 2004 — thousands of projects",
    "Exterior focus, shade solutions",
    "Not a Denver corporation — you call us, you get us",
    "YOUR personal story"
  ],
  "personal_touch": "Myself, I've actually been in the home remodeling industry since I graduated from college in 2014. I've worked with organizations ranging from large national remodeling companies to small owner-operated contractors, helping design and deliver projects from full home additions to interior remodels and outdoor improvements like decks and concrete patios. Over the years I realized I have to be happy and love where I work — so when I met Jack and his brother Maxx, I couldn't pass up the opportunity to work with good people who have integrity and communicate well. I'm really happy to have found my home here at Around the House."
}
```

Note the `flags[]` entry above is a live, unresolved, structured content-QA flag on Sunesta's
own reference slide — a mechanism that exists in the schema but that Eclipse's content never
populates (see FINDINGS.md).

## Sunesta-only content modules and where they live

- **`modules[0]` — `m_pricing_transition`** (`data/doghouse-content-v1.json`, top-level
  `modules[]`): the pricing-transition script. Not a slide (`is_slide: false`), has its own
  `phases[]` (6 phases, each with `phase/label/duration_sec/script[]`) instead of `blocks[]`,
  and carries its own `flags[]` (7 entries, high/medium/low), `reactive_scripts[]` (financing +
  subcontractor FAQ answers), `training_notes`, `slow_down_on`, `coaching_note`,
  `variables_used`. Eclipse has zero entries in `modules[]` — confirmed by direct count, not a
  missing-field inference.
- **`global_conventions`** (top-level object): `never_say[]` (6 banned phrases/claims across
  ALL products, e.g. `"95 MPH"`, `"petroleum-based product"`), `always[]` (4 standing rules),
  `product_naming` (canonical name for every ATH product line, including Eclipse's own —
  `"Eclipse® motorized zipper screens / E-Zip"`), `contacts` (office/Jack/Matt/web). This is
  the one place in the repo where Eclipse-relevant naming/prohibition rules are declared — and
  it lives entirely inside Sunesta's content file. Eclipse's own content file has no
  `global_conventions` key at all.
- **`sections_advisory[]`** — described under Phase 2 above.
- **`variables[]`** (18 entries) — `{key, label, type, source, required?, guidance?, status?}`.
  Sunesta declares variable metadata for tokens like `ACCOMPLISH_LIST`, `LEAD_TIME_WEEKS`,
  `CURRENT_PROMO`; 5 are `status: "NOT_SET"` (no company-wide default configured yet). Eclipse:
  0 variables declared — confirmed by direct count — even though Eclipse's own script text
  contains no `{{TOKEN}}` placeholders either (checked: zero `{{` occurrences anywhere in
  `data/training-content-eclipse.json`), so this is consistent, not a gap in isolation.
- **`open_items[]`** (20 entries) — `{id, item, blocks[], owner, status, priority?}`, an
  explicit backlog of unresolved content questions, each naming exactly which slide(s)/module
  it blocks (e.g. `oi16`: "Slide 4 subcontractor line fix", blocking `s04`). Eclipse: 0 open
  items — confirmed by direct count (see FINDINGS.md for why this matters given Eclipse has at
  least one comparable unresolved tension of its own).
- **`prep_ids`**: `["prep_recap", "preframe"]` — Sunesta-only pre-appointment content that
  leads the training walk ahead of slide 1. Eclipse: empty array.

---

# PHASE 5 — RENDERING AND UI

## Two independent rendering layers

1. **Customer-facing deck** (`js/app.js` slide-type renderers, ~19 `s.type===` branches) —
   draws the actual presentation slide shown on screen/projected to the customer. Reads deck
   fields ONLY (`js/data-<product>.js`). Deck-layer string fields are inserted as raw
   `innerHTML` with **no escaping** — confirmed directly: `js/app.js` renders
   `` `${s.subtext?...s.subtext...}` `` verbatim into the DOM (lines 625, 694, 770, 875, 898),
   which is why fields like `ez-intro.subtext` and `ez-warranty.subtext` can and do contain raw
   `<br><br>` and `<span style="...">` markup (see EZIP_CONTENT_DUMP.md) — this is trusted,
   developer-authored HTML, not user input.
2. **Training/rehearsal layer** (`js/training-render.js` + `js/training-content.js` +
   `js/training-coach.js`) — the rep-facing script/coaching companion, shown either in a side
   panel next to the live customer deck (in-appointment "Rehearse" mode) or standalone
   (Training Center → Coach). Reads content-JSON fields ONLY. **One renderer, two call sites**
   — `js/training-coach.js`'s own comment states this explicitly: *"All content rendering goes
   through js/training-render.js — the same renderers the rehearsal side-panel uses, so the two
   surfaces cannot drift."*

## How a slide displays in the training layer

- **Beats-by-default, tap-to-expand-full-script.** If `display_beats[]` is non-empty, the
  collapsed view shows those short bullets with a "Show full script" toggle button; tapping
  swaps in the complete `blocks[].script[]` text and the button becomes "Show beats." Expansion
  state is tracked in a page-lifetime `Set` (`tcExpanded`, `js/training-render.js`) keyed by
  entry id — it persists while navigating back and forth between slides in one open session,
  but is not saved to `localStorage` and resets on reload. **Entries with no `display_beats`
  (any module, and any slide that doesn't populate the field) show the full script with no
  toggle at all** — this is Eclipse's situation on all 18 entries (0/18 have `display_beats`),
  so every Eclipse slide always shows full verbatim script with no beats/collapse option.
- **Script is chunked into `blocks[]`**, each block rendered as its own `<div class="tc-block">`
  containing (in order, each independently optional): a label + optional per-block seconds
  count, an "Unfinished" warning if `incomplete`, an "Optional" tag if `conditional`, every
  `script[]` line as its own `<p>`, `stage_directions[]` rendered in a visually distinct style
  from spoken lines, `alternates[]` (condition + its own script lines), a labeled `sample`
  block, and a "Suggested move to `<slide_id>`" cross-reference if `move_recommendation` is set.
- **Status badges**: only `final_pending_revision` → "Pending revision", `placeholder` → "Not
  yet written", `parked` → "Parked" render a badge. `final`, `final_revised`, and `final_new`
  render with **no badge at all** ("render clean" per the code's own comment) — so Eclipse's
  18-for-18 `status: "final"` entries never show a status indicator of any kind.
  `is_money_slide` renders a "Money slide" badge; `in_deck: false` renders a "Not in deck" badge.
- **Field-specific renderers**, each only appearing when its field is non-empty: tone (`Tone`
  label + text), purpose (one `<p>` per item), personal touch (pencil icon + "editable per rep"
  label), slow-down-on (its own callout with `line` + `why`), engagement question (question text
  + optional "when" context + optional bulleted `branches[]`), callback triggers ("Come back
  here when" bulleted list), training notes (two columns, Do / Do not), reactive scripts (each
  rendered as a `<details><summary>` disclosure — question is the visible summary, trigger +
  answer/script + stage directions + note are hidden until tapped), coaching note (split on
  literal `\n\n` into separate paragraphs, with a lightbulb icon), transition-out (labeled
  callout). **None of these render for any Eclipse slide except `reactive_scripts` and
  `training_notes` on the two reference entries that populate them** (`ref_faq`, `ref_dodont`)
  — every other field is schema-EMPTY across all 18 Eclipse entries, confirmed in Phase 2/3.
- **`{{ACCOMPLISH_LIST}}` live callout**: any entry whose raw JSON contains that literal token
  string gets a standing "Their Accomplish List" callout showing the rep's actual filled-in
  values (a live per-appointment value, not authored content, and not editable from this view).

## Character/length limits, truncation, overflow

**None found on any content field.** No `maxlength` HTML attribute exists anywhere in the
codebase (repo-wide search). No CSS `line-clamp`/`text-overflow`/`overflow:hidden` truncation
applies to any content field — the only `text-overflow: ellipsis` rule in the entire stylesheet
targets `.footer-banner .footer-title` (`css/styles.css:639`), an unrelated app-chrome element,
not training or deck content. The one length cap found is UI-cosmetic, not a content
constraint: the walk-screen search results dropdown truncates each hit's preview snippet to 110
characters (`js/training-coach.js:204`, `.slice(0, 110)`) — this affects only the preview text
shown in the results list, not the slide content itself once opened.

## Markdown / HTML / rich-text support

- **Training-layer fields** (everything read through `tcResolve()`/`tcField()`) are HTML-escaped
  first (`tcEsc()` replaces `& < > "`), then only `{{TOKEN}}` placeholders are substituted (each
  becoming either a filled-in `<span class="tc-var-filled">` or an unfilled placeholder "chip"
  carrying the variable's label). **No markdown syntax is interpreted anywhere** — text is
  rendered as plain escaped text plus the app's own generated wrapper markup. Literal smart
  quotes, em dashes, and emoji in the source JSON pass through as plain characters.
  `coaching_note` alone gets one extra transformation: after resolving, its HTML is split on
  literal `\n\n` sequences into separate `<p>` tags — the only field-specific "reflow" found
  anywhere in the renderer, and it's whitespace-splitting, not markup interpretation.
- **Deck-layer fields** (`subtext` etc., customer-facing only) are the opposite: inserted as raw
  trusted `innerHTML` with no escaping at all, which is how `<br>` line breaks and inline
  `<span style="...">` sizing/opacity tricks appear directly inside a few slides' `subtext`
  values (e.g. Eclipse's `ez-warranty` slide). This is developer-authored markup baked into the
  JS source file, not a rich-text authoring feature — there's no editor affordance for it, and
  it isn't available on any training-layer field.

## Timing

`duration.display` (e.g. `"1:45 – 2:00"`) renders as a plain badge in the entry header when
present. **This is descriptive text only** — confirmed no timer, countdown, or `setInterval`
anywhere in the codebase reads `duration` (the only `setInterval` in the app drives the intro
video loop, unrelated). Sunesta populates `duration` on several slides plus the pricing module
(`180–240s` range); Eclipse populates it on none of its 18 entries.

## Search / filter / quick-reference

`tcSearch(q)` (`js/training-content.js`) requires ≥2 characters, then walks `tcWalk()` — the
same ordered walk used for slide navigation, which by construction **excludes the 4
reference-only entries** (`ref_dodont`/`ref_close`/`ref_predemo`/`ref_faq` are not in `prep_ids`
and not deck-mapped into the walk) — matching case-insensitively against: the title, every
`blocks[]`/`phases[]` script line, and every `reactive_scripts[].question`. Critically, it reads
through `tcFieldValue()` — the same **local-edit-overlay-aware** resolver every renderer uses —
so a search matches a rep's in-app edits, not just the originally committed JSON text (verified
this session as part of the prior merge-review follow-up work). Results show live as the rep
types, with no pagination or hit-count cap; selecting a hit jumps the walk position to that
slide and, if the match came from script (not the title), auto-expands the full-script view.
Because reference-only entries are excluded from `tcWalk()`, **search cannot find content that
lives only in `ref_faq`/`ref_dodont`/`ref_close`/`ref_predemo`** — those are reachable only by
manually opening their hub card.

Separately, the standalone Training Coach's **"Content Flags & Open Items"** view
(`js/training-coach.js`, `tcvRenderFlags`) is a dedicated quick-reference/filter surface: every
`flags[]` entry across all slides+modules, sorted by severity (high→medium→low, resolved flags
demoted to the bottom), filterable by a severity chip row, alongside every `open_items[]` entry
showing which slide(s) it blocks. This view is populated for Sunesta and effectively empty for
Eclipse (0 flags, 0 open items to show).

## Live Ingage deck embed?

**NOT FOUND.** Zero occurrences of "ingage" (case-insensitive) anywhere in the repository —
no script tag, no iframe, no fetch URL, no config reference. The app is fully self-contained:
every `fetch()` call targets either a local static JSON file under `data/` or (unrelated to
presentation content) the ATH Cockpit pricing API. There is no live or embedded third-party
deck of any kind.
