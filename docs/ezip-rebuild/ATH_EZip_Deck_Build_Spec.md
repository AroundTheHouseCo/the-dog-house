# ECLIPSE E-ZIP — DECK BUILD SPEC v1.0
## Companion to ATH_EZip_Master_Script_v3 Parts 1–3

**Target files:** `js/data-eclipse.js` · `data/training-content-eclipse.json`
**Scope:** 14 slides → 21 slides · 3 tabs → 5 tabs · full content-layer rewrite
**Authority Rule:** deck file owns order, section membership, and all render fields. Content JSON
owns script and coaching, carries zero render keys. They join via `deck_map`, never by position.

---

# 0. CRITICAL BUILD INSTRUCTION — READ FIRST

## Write the content file from scratch. Do not mutate the existing one.

Content IDs are being reassigned in a chained pattern with collisions:

- `e02` and `e03` swap
- `e05` moves to `e07` while a **new** `e05` is created
- `e08` moves to `e12` while `e12` moves to `e18`
- `e11` moves to `e08` while `e08` is already moving

**Any in-place sequential rename will silently corrupt the join.** Build the new `slides[]` array
fresh, keyed by deck id, assigning content ids as you write. Then generate `deck_map` from the
finished array rather than editing the old one.

Validate before commit: every deck slide id resolves to exactly one content entry, and every
content entry with `in_deck: true` is referenced by exactly one deck slide.

---

# 1. RENUMBER MAP

| New # | Tab | Deck id | Old content id | **New content id** | Action |
|---|---|---|---|---|---|
| — | *(prep)* | — | — | `prep_recap` | **CREATE** |
| — | *(prep)* | — | — | `preframe` | **CREATE** |
| 1 | WHY ATH | `ez-intro` | `e01` | `e01` | rewrite content |
| 2 | WHY ATH | `ez-dealer` | `e03` | `e02` | move + rewrite |
| 3 | WHY ATH | `ez-lineup` | `e02` | `e03` | move + rewrite |
| 4 | WHY ATH | `ez-install` | `e04` | `e04` | rewrite content |
| 5 | WHY ATH | `ez-people` | — | `e05` | **CREATE** |
| 6 | WHY ECLIPSE | `ez-eclipse` | — | `e06` | **CREATE** |
| 7 | WHY ECLIPSE | `ez-credibility` | `e05` | `e07` | move + rewrite |
| 8 | WHY ECLIPSE | `ez-gallery` | `e11` | `e08` | move + rewrite |
| 9 | WHY ECLIPSE | `ez-refmap` | — | `e09` | **CREATE** |
| 10 | THE E-ZIP | `ez-reasons` | `e06` | `e10` | move + rewrite |
| 11 | THE E-ZIP | `ez-how` | `e07` | `e11` | move + rewrite |
| 12 | THE E-ZIP | `ez-systems` | `e08` | `e12` | move + rewrite |
| 13 | THE E-ZIP | `ez-fabric` | `e09` | `e13` | move + rewrite |
| 14 | THE E-ZIP | `ez-transform` | — | `e14` | **CREATE** |
| 15 | SMART CONTROL | `ez-smart` | `e10` | `e15` | move + rewrite |
| 16 | SMART CONTROL | `ez-mylink` | — | `e16` | **CREATE** |
| 17 | THE WRAP-UP | `ez-process` | `e13` | `e17` | move + rewrite |
| 18 | THE WRAP-UP | `ez-warranty` | `e12` | `e18` | move + rewrite |
| 19 | THE WRAP-UP | `ez-options` | — | `e19` | **CREATE** |
| 20 | THE WRAP-UP | `ez-pricecond` | — | `e20` | **CREATE** |
| 21 | THE WRAP-UP | `ez-viewstays` | `e14` | `e21` | move + rewrite |

**Reference entries:** `ref_dodont`, `ref_close`, `ref_faq` — retain ids, rewrite content.
**`ref_predemo` — DELETE.** Its content is promoted into `prep_recap`.

## Tab restructure

```
BEFORE (3):  WHY ECLIPSE · THE E-ZIP · WRAP-UP
AFTER  (5):  WHY ATH · WHY ECLIPSE · THE E-ZIP · SMART CONTROL · THE WRAP-UP
```

Content-layer `section` values: `why_ath`, `why_eclipse`, `the_ezip`, `smart_control`,
`wrap_up`, plus `prep` and `reference`.

## prep_ids

Currently `[]`. Set to:
```json
"prep_ids": ["prep_recap", "preframe"]
```

These lead the training walk ahead of slide 1, matching Sunesta's pattern.

---

# 2. CORRECTIONS TO EXISTING DECK FIELDS

## 2.1 — `ez-systems` `modelCompare` · Duty & Operation → Mounting

**Current:** 7-inch cell reads `["warn", "Surface only"]`
**Change to:** `["check", "Surface · recess · post"]`

All three sizes now share identical mounting. Confirmed by Jack.

## 2.2 — `ez-systems` `modelCompare` · Engineering → Wind rating

**Current:**
| 4-inch | 5-inch | 7-inch |
|---|---|---|
| `check` Class 6 · 80 mph | `check` Class 6 · 80 mph | `check` Largest-span build |

**Change to:**
| 4-inch | 5-inch | 7-inch |
|---|---|---|
| `check` Class 6 · 80 mph | `check` Class 6 · 80 mph | `check` Class 6 · Super Duty |

**Do not** enter 130 mph in this table. See §6, `oi01`. The 130 figure is a fabric test result
and belongs in script with attribution, not in a system spec table.

## 2.3 — `ez-systems` `comparison` object — REMOVE

The three-column Eclipse / Generic Roll-Down / Glass Sunroom table currently lives on the money
slide. Move it to the new `ez-options` slide (§3.6). Delete `comparison` and `footer` from
`ez-systems`.

## 2.4 — Legacy field removal (`oi07` — Jack approved)

Delete `script`, `talkingPoints`, and `coach` from **all 14 existing slide objects** in
`js/data-eclipse.js`.

Rationale: these are byte-identical to the content JSON today, which means they go stale the
moment this rewrite lands. `js/app.js` `renderRehearsal()` actively serves them on content-load
failure, so a stale copy is a live path to a rep reading pre-rewrite script.

**Verify after removal** that `renderRehearsal()` degrades correctly. Per its own documented
policy the load-failure branch should now render the visible `tc-loadfail` state rather than
legacy content. If that branch reads the fields unconditionally and would throw on undefined,
patch it to fall through to the gap state.

## 2.5 — Lead time correction

Any surviving reference to "three to five weeks" or "eight to ten weeks" becomes **six to eight
weeks**, all screen projects. Appears in the old objection-handling content.

---

# 3. NEW SLIDES — DECK FIELD VALUES

For `refmap`, `difference`, and `costscale`, read the Sunesta slide named as the shape reference
and mirror its field structure exactly. Do not infer the schema from the renderer.

---

## 3.1 — `ez-people` · position 5 · type `splittext`

```
id:      ez-people
type:    splittext
title:   Our People — Who Actually Shows Up
image:   images/eclipse/arched-deck.jpg
```

*(Uses the currently orphaned asset. Replace with a team or install-crew photo when available.)*

```
bullets:
  - Twenty-two years and thousands of projects across the Front Range
  - Certified technicians and install teams who work with us and only us
  - Trained to Eclipse specification — and to our standards on top of that
  - A full operations team on every project, so nothing depends on one person remembering
```

---

## 3.2 — `ez-eclipse` · position 6 · type `splittext`

```
id:      ez-eclipse
type:    splittext
title:   Eclipse® Authorized Dealer
image:   [ASSET NEEDED — see §7]
bullets:
  - Eclipse Shading Systems — Middletown, New York, with manufacturing in Statesville, North Carolina
  - Building the E-Zip since 2002 · the 7-inch line since 2019
  - Custom made in the USA, built to the inch for every opening
  - ATH is a licensed and insured Eclipse authorized dealer
  - Two companies behind your project — not a system assembled from four suppliers
```

---

## 3.3 — `ez-refmap` · position 9 · type `refmap`

**Shape reference:** Sunesta `refmap` / `s10` "We've Worked in Your Neighborhood." Mirror its
field structure.

```
id:      ez-refmap
type:    refmap
title:   We've Worked in Your Neighborhood
```

Map asset currently carries Sunesta install pins only. Eclipse projects must be layered in before
this ships — tracked as `oi06`. If the renderer supports a product filter, use it. If it does not,
the slide ships with combined ATH projects, which is acceptable and arguably stronger.

---

## 3.4 — `ez-transform` · position 14 · type `photogrid`

```
id:      ez-transform
type:    photogrid
title:   Before · After · Inside
photos:
  - img: [ASSET NEEDED] · caption: BEFORE
  - img: [ASSET NEEDED] · caption: AFTER
  - img: [ASSET NEEDED] · caption: INSIDE
```

**Must be three views of the same project.** Source images exist on slide 11 of
`Eclipse_E-Zip_Sales_Presentation_Slides.pdf` and need extracting into `images/eclipse/`.
Suggested filenames: `transform-before.jpg`, `transform-after.jpg`, `transform-inside.jpg`.

If `photogrid` does not support per-photo captions, the BEFORE / AFTER / INSIDE labels must be
burned into the images or the slide switches to a three-panel `splitphoto` variant.

---

## 3.5 — `ez-mylink` · position 16 · type `splittext`

```
id:      ez-mylink
type:    splittext
title:   myLink — Your Screens on Your Phone
image:   [ASSET NEEDED — phone-in-hand app shot]
bullets:
  - Run your screens from anywhere — home or away
  - Weather rolling in? Bring them up from wherever you are
  - Integrates with home automation
  - Optional — most homeowners are happy with the remote and wall switch
```

---

## 3.6 — `ez-options` · position 19 · type `difference`

**Shape reference:** Sunesta `difference` / `s07`. Mirror its field structure.

```
id:      ez-options
type:    difference
title:   Other Options — An Honest Comparison
```

**Migrate the `comparison` object removed from `ez-systems` in §2.3**, then extend it from three
columns to four:

| | Eclipse E-Zip | Generic Roll-Down | Glass Sunroom | Hurricane-Rated |
|---|---|---|---|---|
| | Installed by ATH ★ OUR PICK | No zipper track | Permanent structure | Coastal storm systems |
| Holds fabric in wind | ✓ Zipper-locked, stays taut | ✗ Flaps & billows | ✓ Solid — but sealed in | ✓ Overbuilt for here |
| Keeps the outdoor feel | ✓ Air moves through | ✓ It's a screen | ✗ Traps heat | ✓ It's a screen |
| Bug & no-see-um seal | ✓ Tight SunTex + brush seal | ⚠ Depends on fit | ✓ Sealed | ✓ Yes |
| Retracts out of sight | ✓ Into the cassette | ⚠ Basic housing | ✗ Permanent | ✓ Yes |
| Warranty | ✓ Lifetime via PPP | ✗ Limited / by component | ⚠ Varies by builder | ✓ Varies |
| Investment | ✓ A fraction of a glass room | ✓ Low — but short-lived | ✗ $50,000+ | ✗ $20,000+ |

**Footer:** Glass sunrooms commonly run $50,000 and up and trap heat by design. Generic
roll-downs without a zipper track flap in the wind and fail. Hurricane-rated systems are
excellent engineering for coastal storm zones — and overkill on the Front Range. Always ask
what's actually behind the price.

*(DIY sails and umbrellas are covered in script only. Adding a fifth column makes the table
unreadable at presentation distance.)*

---

## 3.7 — `ez-pricecond` · position 20 · type `costscale`

**Shape reference:** Sunesta `pricecond` / `s22` "Not All Shade Costs the Same." Mirror exactly.

```
id:      ez-pricecond
type:    costscale
title:   Not All Shade Costs the Same
```

**Tiers, low to high:**

| Tier | Range | Label | Detail |
|---|---|---|---|
| 1 | $500 – $1,000 | DIY & temporary | Bamboo roll-ups, sails, outdoor curtains. Fine for a season. |
| 2 | $1,000 – $3,000 | Low-end installed | Per opening. Usually manual, no zipper track, one-year component warranty. |
| 3 | **$4,000 – $12,000** | **Quality motorized — where we live** | Zipper retention, name-brand fabric, real warranty, professional install. |
| 4 | $20,000 – $100,000+ | Hurricane-rated & glass rooms | MagnaTrack-class systems and full sunrooms. Built for a different problem. |

Tier 3 must be visually marked as the ATH band, matching how Sunesta's `costscale` highlights its
own range.

---

# 4. PREP ENTRIES

Both are content-layer only. No deck object, no render fields, `in_deck: false`, listed in
`prep_ids`.

```
prep_recap  · "Table Recap on the iPad"  · section: prep · 7 blocks
preframe    · "Pre-Frame"                · section: prep · 1 block
```

Content is in Part 1, Section B. `prep_recap` supersedes and replaces `ref_predemo`.

---

# 5. MODULE

Eclipse currently has zero modules. Create `modules[]` with one entry.

```
module_id:  m_ezip_pricing_transition
title:      Pricing Transition & Close
is_slide:   false
phases[]:   7 phases (see Part 3)
```

**Shape reference:** Sunesta `m_pricing_transition`. Mirror the `phases[]` structure —
`{phase, label, duration_sec, script[]}` — rather than `blocks[]`.

Phases: Lay Off Price (60s) · Present Two Options (60s) · Rebuild Excitement (40s) ·
Micro-Close (15s) · Close Transition (15s) · Right-Sizing Order (no timing) · Step-Outside (300s).

Carries its own `flags[]`, `training_notes`, `slow_down_on`, `coaching_note`, and
`variables_used: ["SAME_WEEK_SAVINGS", "ACCOMPLISH_LIST"]`.

`js/training-content.js` `tcWalk()` appends the pricing module after the deck walk as a hardcoded
special case for Sunesta. **Verify it generalizes to Eclipse** or patch it to read from
`modules[]` per product.

---

# 6. VARIABLES AND OPEN ITEMS

## 6.1 — `variables[]` — currently 0 entries, create

```json
[
  {
    "key": "SAME_WEEK_SAVINGS",
    "label": "Same-week savings offer",
    "type": "text",
    "source": "company",
    "required": true,
    "status": "NOT_SET",
    "guidance": "Percentage or dollar amount for customers scheduling within the current week. Set company-wide, not per rep. Introduced once, after price lands."
  },
  {
    "key": "ACCOMPLISH_LIST",
    "label": "Their Accomplish List",
    "type": "list",
    "source": "appointment",
    "required": true,
    "guidance": "Filled per appointment. Confirmed at e10 before any product is presented."
  },
  {
    "key": "REP_PERSONAL_STORY",
    "label": "Rep personal story",
    "type": "longtext",
    "source": "rep",
    "required": false,
    "guidance": "Editable per rep on e02. Where you came from, why you chose ATH, what you think of the people you work with. Under 60 seconds."
  },
  {
    "key": "LEAD_TIME_WEEKS",
    "label": "Current install lead time",
    "type": "text",
    "source": "company",
    "required": true,
    "status": "SET",
    "value": "6 to 8 weeks"
  }
]
```

## 6.2 — `open_items[]` — currently 0 entries, create

```json
[
  {"id":"oi01","item":"System-level wind rating by cassette size and duty class — need current Eclipse engineering documentation. Published 130 MPH figure is a 2013 fabric test (Architectural Testing, York PA) on 120\"×84\" units, not a system rating by duty class.","blocks":["e07","e12"],"owner":"Jack","status":"open","priority":"high"},
  {"id":"oi02","item":"SAME_WEEK_SAVINGS percentage undecided (10% or 5%) and the week boundary is undefined — signed by Sunday, or seven days from appointment?","blocks":["m_ezip_pricing_transition","ref_close"],"owner":"Jack","status":"open","priority":"high"},
  {"id":"oi03","item":"Real photo for e15 Smart Control — currently smart-control-placeholder.svg","blocks":["e15"],"owner":"Jack","status":"open","priority":"medium"},
  {"id":"oi04","item":"Eclipse published review statistics (99.2% recommend, 4.9 product, 4.8 dealer) unverified — rep-only with attribution until confirmed","blocks":["e07"],"owner":"Jack","status":"open","priority":"medium"},
  {"id":"oi05","item":"PPP downgrade dollar savings not quantified — reps need a figure before this is usable as a right-sizing lever","blocks":["e18"],"owner":"Jack","status":"open","priority":"medium"},
  {"id":"oi06","item":"Reference map asset carries Sunesta pins only — needs Eclipse projects layered in","blocks":["e09"],"owner":"Maxx","status":"open","priority":"low"},
  {"id":"oi07","item":"Legacy script/talkingPoints/coach fields stripped from js/data-eclipse.js this commit — verify renderRehearsal() load-failure branch degrades to visible gap state","blocks":[],"owner":"Jack","status":"resolved_this_commit","priority":"high"},
  {"id":"oi08","item":"Before/After/Inside photo set for e14 must be extracted from the PDF deck into images/eclipse/","blocks":["e14"],"owner":"Jack","status":"open","priority":"high"},
  {"id":"oi09","item":"Hero image needed for e06 Eclipse Authorized Dealer","blocks":["e06"],"owner":"Jack","status":"open","priority":"medium"},
  {"id":"oi10","item":"myLink app screenshot needed for e16","blocks":["e16"],"owner":"Jack","status":"open","priority":"medium"}
]
```

## 6.3 — `global_conventions` — recommended, optional

Eclipse's content file has no `global_conventions` key. Sunesta's file carries the cross-product
rules — including Eclipse's own canonical product naming — which means Eclipse-relevant
prohibitions live inside another product's file.

**Recommendation:** move `global_conventions` to `data/training-content-shared.json`, where
cross-product content already lives, and have both products read it from there.

**Eclipse-specific additions to `never_say[]` regardless of where it lives:**
- `"95% openness"` — SunTex 95 blocks ~95% of UV and is ~5% open. The number is blockage.
- `"Super Duty is rated to 130 MPH"` — fabric test result, requires attribution
- `"we don't use subcontractors"` — never volunteer; reactive answer only

If moving the file is out of scope for this commit, add a minimal `global_conventions` block to
Eclipse's own file and log the consolidation as a follow-up.

---

# 7. ASSET REQUESTS

| Slide | Asset | Priority | Notes |
|---|---|---|---|
| `e14` | 3 photos, same project | **high** | Extract from PDF slide 11 → `transform-before/after/inside.jpg` |
| `e06` | Eclipse dealer hero | medium | Manufacturing, product detail, or authorized-dealer badge composition |
| `e16` | myLink app screenshot | medium | Phone in hand showing the app |
| `e15` | Real Smart Control photo | medium | Replaces `smart-control-placeholder.svg` |
| `e05` | Team or install-crew photo | low | Currently reusing orphaned `arched-deck.jpg` |
| `e09` | Map with Eclipse pins | low | `oi06` |

`images/eclipse/arched-deck.jpg` is currently orphaned and is assigned to `e05` by this spec — it
is no longer an unreferenced asset after this commit.

---

# 8. FIELD ADOPTION

All 15 previously-unused schema fields are now populated across Eclipse. Per-entry expectations:

| Field | Applies to |
|---|---|
| `purpose[]` | every in-deck slide — 2 entries each |
| `duration` | every in-deck slide + module phases |
| `tone_mood` | every in-deck slide |
| `display_beats[]` | every in-deck slide — enables the beats-first collapsed view |
| `slow_down_on` | every in-deck slide except `e16` (explicitly none — fastest slide) |
| `transition_out` | every in-deck slide except `e21` (hands to the module) |
| `coaching_note` | every in-deck slide |
| `engagement_question` | `prep_recap`, `e01`, `e04`, `e09`, `e10`, `e17` |
| `callback_triggers[]` | `e03`, `e09`, `e10`, `e12`, `e14`, `e20` |
| `flags[]` | `e02`, `e07`, `e09`, `e12`, `e15`, `e18` |
| `verification[]` | `e07`, `e12` |
| `is_money_slide` | `e12` only — `true` |
| `is_reference_slide` | `e20` only — `true` *(bookmark target; Eclipse currently has none)* |
| `personal_touch` | `e02` only |
| `variables_used[]` | `e02`, module |

**Set `status` per entry:** `final_new` on the 7 created slides and 2 prep entries,
`final_revised` on the 14 rewritten. Neither renders a badge, but it makes the next audit
readable.

**Bump `meta.content_version` to `2.0.0`** and set `meta.source` to reference this spec and the
v3 script.

---

# 9. VALIDATION CHECKLIST

Before commit:

- [ ] 21 deck slides across 5 tabs, in the order in §1
- [ ] `deck_map` generated from the finished content array, not edited from the old one
- [ ] Every deck id resolves to exactly one content entry, and the reverse
- [ ] No content id appears twice
- [ ] `ref_predemo` deleted; `prep_recap` and `preframe` created and in `prep_ids`
- [ ] `script` / `talkingPoints` / `coach` removed from all 14 legacy slide objects
- [ ] `renderRehearsal()` load-failure branch verified after removal
- [ ] `comparison` moved off `ez-systems` onto `ez-options`
- [ ] Mounting row shows `Surface · recess · post` for all three sizes
- [ ] No `130` appears anywhere in `modelCompare`
- [ ] `tcWalk()` appends the Eclipse pricing module
- [ ] `tcSearch()` returns hits from the new slides
- [ ] `{{SAME_WEEK_SAVINGS}}` renders as an unfilled chip, not literal text
- [ ] `{{REP_PERSONAL_STORY}}` renders as editable on `e02`
- [ ] Beats-first collapse works on every slide, with "Show full script" toggling
- [ ] Content Flags view shows 6 flags and 10 open items
- [ ] `e12` shows the Money slide badge
- [ ] Every new slide renders without console errors

---

*Companion documents: ATH_EZip_Master_Script_v3 Parts 1, 2, and 3.*
