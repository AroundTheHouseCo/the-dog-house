# Findings — Phases 1 and 6, plus unanswerable questions

---

# PHASE 1 — LOCATE

## Search performed

Repo-wide search (this session) for: `eclipse`, `e-zip`/`ezip`, `screen`, `zipper`, `cassette`,
`suntex`, `phifer`, `super duty`, `latitude`, `sunesta`, `sunstyle`, `awning` — across all
JSON/JS/HTML/CSS/MD files. Checked explicitly for a `content/`, `data/`, `scripts/`, `decks/`,
`presentations/`, or `slides/` directory structure (only `data/` exists, flat, 5 JSON files).
Checked all `fetch(` call sites for external CMS integration (Contentful, Sanity, Supabase,
Firebase, Airtable, Notion, Google Sheets) by grepping for each product name and for `http`/`https`
URLs in fetch calls. Checked git branches, stash, and comment blocks for drafts/backups/divergent
copies/commented-out content.

## Every Eclipse file (full paths from repo root)

- `js/data-eclipse.js` — `ECLIPSE_DECK` const (customer-facing deck: 14 slides, 3 tabs) +
  `PRODUCT_DATA.eclipse` registration (logo, brand string, 2 Phifer SunTex spec-sheet PDFs)
- `data/training-content-eclipse.json` — training content: 18 `slides[]` (14 in-deck + 4
  reference-only), 0 `modules[]`, 0 `variables[]`, 0 `open_items[]`, empty `prep_ids`
- `images/eclipse/*` — 19 image files (18 referenced, 1 orphaned — see Phase 6)
- `docs/suntex-80-90-samples.pdf`, `docs/suntex-95-97-samples.pdf` — fabric spec sheets, linked
  from `PRODUCT_DATA.eclipse.docs[]`, not from either JSON content file

## Every Sunesta file (full paths from repo root)

- `js/data-sunesta.js` — `DECK` const (22 slides, 5 tabs) + `PRODUCT_DATA.sunesta` registration
  (logo, brand string, `DOC_LIBRARY` docs)
- `data/doghouse-content-v1.json` — training content: 28 `slides[]` (22 in-deck + 6
  reference-only: `prep_recap`, `preframe`, `ref_dodont`, `ref_close`, `ref_predemo`, `ref_faq`),
  1 module (`m_pricing_transition`), 18 `variables[]`, 20 `open_items[]`, plus
  `global_conventions` and `sections_advisory` (both confirmed absent from Eclipse's file)

## Shared / engine files (both products)

`data/training-content-shared.json`, `js/registry.js`, `js/training-content.js`,
`js/training-render.js`, `js/training-coach.js`, `js/app.js`.

## Storage: in-repo, static, no external CMS

**Confirmed 100% in-repo.** No database, no CMS, no env-configured endpoint. Every content
`fetch()` call targets a local relative path with no host, e.g.:

```js
fetch("data/training-content-shared.json", {cache:"no-cache"})   // js/training-content.js:43
fetch(file, { cache: "no-cache" })   // js/training-content.js:66 — file = PRODUCT_DATA[key].trainingContentFile,
                                      // itself a local path string ("data/training-content-eclipse.json" etc.)
fetch("data/company-settings.json", {cache:"no-cache"})           // js/training-content.js:219
```

The only network call anywhere in the app that isn't a same-origin static file is the unrelated
ATH Cockpit pricing API (not presentation content, out of this audit's scope). No Ingage
integration exists — see SCHEMA_AND_RENDERING.md, Phase 5.

## Multiple versions of Eclipse content? NOT FOUND — single canonical version

Checked and ruled out each of the following:

- **Drafts/backups**: none found — only the 2 files listed above hold Eclipse content anywhere in the repo.
- **Branches**: 3 branches exist (`main`, `training-mode-v2`, `deck-polish-round1`), all also on
  `origin`. `training-mode-v2` is fully merged into `main` (commit `7b7290c`, confirmed this
  session's earlier work). `deck-polish-round1` is *also* fully merged
  (`git log main..deck-polish-round1` returns **zero** commits — nothing on that branch is
  unmerged). Its own copy of `data/doghouse-content-v1.json` differs from `main`'s only in
  being an **older, already-superseded snapshot** (`content_version: "1.3.0"` vs current
  `"1.4.0"`, predating the `training-mode-v2` migration) — not a draft, fork, or alternate
  version anyone is actively maintaining. It is stale branch clutter, not a content-integrity
  risk (see Phase 6.9).
- **Commented-out content**: only 2 multi-line comment blocks exist in `js/data-eclipse.js`
  (lines 1–17, a file-header explaining conventions; lines 393–403, prose explaining the
  training-mode-v2 migration) — both read in full this session; neither contains commented-out
  slide/script data.
- **Stash**: `git stash list` — empty.

---

# PHASE 6 — INTEGRITY AND GAPS

## 6.1 — Headline finding: Eclipse's legacy/content duplication is accidental, not durable, and Sunesta already shows what happens when it breaks

Every Eclipse deck slide (`js/data-eclipse.js`) still carries its pre-migration `script` /
`talkingPoints` / `coach` fields alongside the migrated content JSON. This session's automated,
byte-for-byte comparison across **all 14 Eclipse slides** found:

| Field pair | Identical |
|---|---|
| legacy `script` ↔ content `blocks[].script[]` (joined) | **14 / 14** |
| legacy `talkingPoints` ↔ content `talking_points` | **14 / 14** |
| legacy `coach` ↔ content `coaching_note` | **14 / 14** |

The same check run against **all 22 Sunesta slides**, for comparison, found:

| Field pair | Identical |
|---|---|
| legacy `script` ↔ content `blocks[].script[]` (joined) | **0 / 22** |
| legacy `coach` ↔ content `coaching_note` | **0 / 22** |

This is not a bug in either product — it is the direct, mechanical consequence of one fact:
**nothing keeps the two copies in sync.** Sunesta's content JSON has been actively revised since
its migration (`meta.content_version: "1.4.0"`, `meta.source: "ATH Sunesta script refinement
session, July 2026"`); its legacy deck-file fields were frozen at migration time and never
touched again, so 8 months (in content-version terms) of edits have made every single one of
them stale. Directly confirmed by diffing one pair verbatim (`dealer`/`s02`): legacy `script` is
996 characters starting `"A quick background on us —\n\nWe are..."`; content `blocks[].script`
joined is 744 characters starting `""A quick background on us —\n\nWe are..."` — related but
demonstrably rewritten (different wording, different length, not a formatting artifact).

**Eclipse's 14/14 match today is a snapshot of "hasn't been edited since migration" — the same
state Sunesta was in immediately after its own migration, before its refinement pass.** The
moment anyone edits `data/training-content-eclipse.json` (which is exactly what the user's
planned script rebuild will do) without also touching `js/data-eclipse.js`'s legacy fields, this
will flip to Sunesta's 0/22 pattern. This matters concretely because of the documented fallback
behavior (6.2 below): the legacy fields are not inert — the app **actively serves them** to a
rep whenever the content JSON fails to load or is still loading, so a stale legacy copy is a
real, if narrow, path to a rep seeing outdated script.

## 6.2 — The fallback behavior itself is well-designed and non-silent (verified from source)

`js/app.js` (`renderRehearsal()`, lines ~1278–1314) implements a documented 3-way policy, quoted
verbatim from its own comment:

> Covered product, content loaded, slide unmapped → VISIBLE gap state. Never the legacy fields:
> a rep silently reading stale pre-overhaul content is worse than a visible hole, and the
> startup audit (`tcAuditMapping`) has already flagged it loudly.
> Covered product, content file failed to load → legacy fields WITH a warning banner (different
> failure, still never silent).
> Content still loading → legacy fields, unchanged, no banner.

The "unmapped" case renders `<div class="tc-missing">No training content for this slide</div>`.
The "load failed" case renders the legacy fields plus `<div class="tc-loadfail">Training content
file failed to load — showing legacy notes. Reconnect or reinstall the app.</div>`. Only the
transient "still loading" case is silent, and it resolves itself as soon as the fetch completes
(`onTrainingContentReady()` re-renders automatically). **This session's fresh mapping audit found
zero orphaned or missing `deck_map` entries in either product** — every deck slide resolves to a
real content entry and vice versa, in both `js/data-eclipse.js`/`training-content-eclipse.json`
and `js/data-sunesta.js`/`doghouse-content-v1.json`.

## 6.3 — Confirmed orphaned image asset

`images/eclipse/arched-deck.jpg` exists on disk and is referenced **nowhere** — not in
`js/data-eclipse.js`, not in `js/images-map.js`'s `IMAGES` table, not in
`data/training-content-eclipse.json`. Checked directly: every one of the other 18 files in
`images/eclipse/` is referenced at least once; this is the sole exception.

## 6.4 — Confirmed, honestly-labeled placeholder (not disguised as real content)

`images/eclipse/smart-control-placeholder.svg` is the live `image` on slide `ez-smart` (e10) —
not a stray unused file, an actual in-use placeholder. Its own `coaching_note` says so directly:
*"Photo is a clearly-labeled placeholder — swap in a real shot of someone using the remote or
the app once Jack supplies one."* Zero `lorem ipsum` text found anywhere in the repo (checked).

## 6.5 — Dead slide-type renderer code (used by neither product)

`js/app.js` implements 19 distinct `s.type===` render branches. Cross-referencing the full list
against both decks' actual `type` values (verified via executing the real deck files, not
inferred from naming):

- **Used by at least one product (16)**: videoloop, photogrid, reasonsphoto, difference,
  credibility, productcards, costscale, refmap, splitphoto, splittext, herosplit, videoscrub,
  processsteps, warrantyrecap, models, reasonsgrid
- **Used by neither (3)**: **triangle, hotspot, slider** — live, functioning renderer code
  (confirmed present and non-trivial in `js/app.js`) with zero deck slides of either product
  currently set to any of these three `type` values.

## 6.6 — Subcontractor-language tension: inherited by Eclipse from Sunesta, but untracked

Eclipse's `ez-install` (e04) `coaching_note` states a hard rule: *"we say our installers 'work
for us — and only us' — never 'they're not subcontractors.'"* Eclipse's own `ref_faq` reactive
script, answering *"Will you all be doing this work or do you use subcontractors?"*, says:
*"Yes! We work with subcontractor partners. We train with them, critique, and perform final
inspections. They work for us and only us…"*

This exact phrasing is not an Eclipse-specific inconsistency invented independently — it is
near-verbatim the same language as Sunesta's own `m_pricing_transition` module
`reactive_scripts` "subcontractor" entry: *"Yes — we work with subcontractor partners. We train
with them, critique the work, and perform final inspections. They work for us and only us…"*
**Sunesta explicitly tracks this exact tension as an open, owned, high-visibility item** —
`open_items` entry `oi16`, *"Slide 4 subcontractor line fix,"* owner Jack, blocking `s04`.
**Eclipse has zero `open_items`** (confirmed by direct count), so the identical tension exists in
Eclipse's content with nothing in the schema flagging it for resolution.

## 6.7 — Structured content-QA fields exist in the schema but Eclipse never uses them

`flags[]`, `verification[]`, and `open_items[]` are real, working, severity-ranked/filterable
mechanisms (see SCHEMA_AND_RENDERING.md Phase 5 — the Content Flags & Open Items admin view).
Sunesta uses all three live — e.g. its own `s02` carries a `high`-severity structured flag on
itself (*"Slide title says 'Your Exclusive Sunesta Dealer' but the script never says Sunesta or
exclusive"*). Eclipse has functionally identical situations expressed only as informal prose
inside `coaching_note` instead of a structured, filterable flag — for example `ez-credibility`
(e05)'s coaching note: *"The review stats live in your script only until they're verified — the
slide carries what we can prove"* (an unverified-claim situation Sunesta's schema would express
as a `verification[]` entry), and `ez-systems` (e08)'s *"never a '130 mph' figure for Super
Duty; none is documented"* (a rep-guardrail Sunesta's schema would express as a `flags[]`
entry). These are real, live content-integrity concerns already being manually flagged in prose
— they are simply invisible to the Content Flags admin view, search, and severity filtering that
exist specifically to surface this kind of thing.

## 6.8 — Schema utilization gap, quantified

Eclipse's 18 content entries use **11 of the 26** fields that exist anywhere in the slide-level
schema (42%) — the other 15 (`callback_triggers, display_beats, display_number, duration,
engagement_question, flags, is_money_slide, is_reference_slide, personal_touch, purpose,
slow_down_on, tone_mood, transition_out, variables_used, verification`) are confirmed `EMPTY` on
literally every one of the 18 entries (see EZIP_CONTENT_DUMP.md — every field is explicitly
marked, not omitted). Practically, this means: no beats/full-script collapse behavior on any
Eclipse slide (every Eclipse slide always shows full script, full length, no progressive
reveal), no money-slide badge even on the slide Eclipse's own coaching text calls "YOUR MONEY
SLIDE" (e08), no bookmark/reference-slide target, no pacing/timing display, no personal-touch
block, no engagement questions.

## 6.9 — Stale branch clutter (hygiene note, not a content-integrity risk)

`deck-polish-round1` is fully merged into `main` (zero unmerged commits, confirmed via
`git log main..deck-polish-round1`) but the branch ref still exists both locally and on
`origin`. Nothing reads from it, so it poses no risk of anyone accidentally working from stale
content — flagged only because the user may want it deleted for hygiene. **Not acted on**: this
audit is read-only and branch deletion was not in scope.

## 6.10 — No hardcoded Eclipse content in components

Checked `js/app.js` for any hardcoded "Eclipse"/"E-Zip" string outside the data files: exactly 3
matches, all inside code comments (lines 276, 566, 1209) — zero customer-facing or training copy
for Eclipse is hardcoded into a renderer; everything customer- or rep-facing comes from
`js/data-eclipse.js` or `data/training-content-eclipse.json`.

## 6.11 — Git freshness comparison (last commit touching each file)

| File | Last commit | Date | Message |
|---|---|---|---|
| `js/data-eclipse.js` | `114f2ca` | 2026-08-05 | Product-agnostic training-content engine; retire legacy TRAINING_REFERENCE |
| `data/training-content-eclipse.json` | `114f2ca` | 2026-08-05 | (same) |
| `js/data-sunesta.js` | `114f2ca` | 2026-08-05 | (same) |
| `data/doghouse-content-v1.json` | `114f2ca` | 2026-08-05 | (same) |
| `data/training-content-shared.json` | `9073c76` | 2026-08-06 | Merge-review follow-ups: shared reference editable, edit-aware search |
| `js/training-content.js` | `9073c76` | 2026-08-06 | (same) |
| `js/app.js` | `9073c76` | 2026-08-06 | (same) |
| `js/registry.js` | `9073c76` | 2026-08-06 | (same) |
| `js/training-render.js` | `24b9d03` | 2026-08-05 | In-app training content editor: tap-to-edit + Export Content |

Reading this table alone would suggest Eclipse and Sunesta's content files were last touched
identically (both `114f2ca`) — **that commit is the schema migration itself, not a content
edit**. The full history for the two Eclipse-specific files (`git log --all` across all
branches) shows the real editorial timeline:

```
114f2ca  Product-agnostic training-content engine; retire legacy TRAINING_REFERENCE   (schema-only move)
377b34f  Migrate legacy training content into unified JSON schema                     (schema-only move)
79b9606  Eclipse revision pass: layout bugs, footer logo, placeholder, badges
bde14e5  Eclipse: terminology consistency pass — Southern Colorado -> Front Range
e58f89d  Eclipse: confirm 12-month Shade Service, fix Front Range copy mismatch
4a1c93d  Round 3: Eclipse deck back-half — money/fabric/smart/warranty + finalized close
a293320  Round 2: Eclipse E-Zip deck (slides 1-11) + training + assets
```

The last commit that changed actual Eclipse *script/copy content* (as opposed to moving it
between files) was `e58f89d` — earlier than Sunesta's ongoing July 2026 "script refinement
session" work reflected in its `content_version: 1.4.0`. This is the direct cause of finding 6.1.

---

# UNANSWERABLE QUESTIONS

1. **Is `data/training-content-eclipse.json` a complete, faithful transcription of "E-Zip Script
   (1).docx"** (named as the source in the file's own `meta.source`: *"Migrated from
   js/data-eclipse.js (...), training-mode-v2 Phase 2 migration. Source doc: \"E-Zip Script
   (1).docx\", blessed by Jack 2026-07-15."*)? **Cannot be determined** — the `.docx` file itself
   is not in the repo (confirmed: `find . -iname "*.docx"` returns nothing anywhere in the
   working tree). Would need the actual document to diff against.
2. **Same question for Sunesta's `Matt_Notes_-_Sunesta_Awning_Script.docx`**, named in
   `Claude_Code_Prompt_Sunesta_Overhaul.md` ("I've attached `Matt_Notes_-_Sunesta_Awning_Script.docx`
   — this is Matt's working..."). Same limitation: not in the repo.
3. **Will the legacy/content duplication (6.1) be kept in sync going forward?** Nothing in the
   codebase enforces it (no test, no lint, no build step at all). This is a process decision for
   the user, not something derivable from repo state — flagged as directly relevant to the
   planned Eclipse rewrite, not answered.
4. **Is `deck-polish-round1` (and its `origin` counterpart) safe to delete?** Technically yes by
   the evidence gathered (fully merged, zero unmanaged commits) — but confirming no one has a
   reason to keep it (e.g. as a reference point) is outside what repo state alone can answer.
5. Several business-fact questions are already tracked *inside* the app itself and are Jack's
   calls, not technical findings this audit can resolve: Sunesta's `LEAD_TIME_WEEKS` and
   `CURRENT_PROMO` (`status: "NOT_SET"`), the wind-rating documentation gaps both products'
   coaching notes warn reps away from overstating (Eclipse's undocumented "130 mph" figure,
   Sunesta's `oi03` "98 MPH framing" open item), and the `20 vs. 22 years in business` /
   `Dealer of the Year scope` open items. These are listed here only because they surfaced during
   the audit, not because this audit is positioned to resolve them.
