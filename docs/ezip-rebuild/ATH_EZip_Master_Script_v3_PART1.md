# ATH MASTER ECLIPSE® E-ZIP SCRIPT — v3
## Part 1 of 3: Architecture, Prep Block, Tab 1, and the Money Slide

**Around The House Home Solutions — Standardized Sales Framework**
Profectus Compliant · Accomplish List Driven · Slide-by-Slide
Built against `data/training-content-eclipse.json` · Aerie / Doghouse

---

# SECTION A — THE ARCHITECTURE

## What changes and why

Eclipse currently runs 14 in-deck slides across 3 tabs. Sunesta runs 22 across 5. This
proposal brings Eclipse to **21 in-deck slides across 5 tabs**, using the same narrative arc:
earn the right to talk product, transfer trust to the manufacturer, sell the product, show the
upgrades, then close through warranty and price conditioning.

Seven slides are new. Two are renumbered. One reference entry is retired into the prep block.
Every new slide uses a renderer that already exists in `js/app.js` — nothing here requires new
component work.

## Full slide map

| # | Tab | Deck id | Content id | Renderer | Title | Status |
|---|---|---|---|---|---|---|
| — | PREP | — | `prep_recap` | *(prep)* | Table Recap on the iPad | **NEW** — promoted from `ref_predemo` |
| — | PREP | — | `preframe` | *(prep)* | Pre-Frame | **NEW** |
| 1 | WHY ATH | `ez-intro` | `e01` | herosplit | Eclipse® E-Zip Motorized Screens | existing |
| 2 | WHY ATH | `ez-dealer` | `e02` | splittext | Who We Are — Local & Family-Owned | existing (was e03) |
| 3 | WHY ATH | `ez-lineup` | `e03` | productcards | Your Home Solutions Experts | existing (was e02) |
| 4 | WHY ATH | `ez-install` | `e04` | splitphoto | Installed In-House — Level, Parallel, To the Inch | existing |
| 5 | WHY ATH | `ez-people` | `e05` | splittext | Our People — Who Actually Shows Up | **NEW** |
| 6 | WHY ECLIPSE | `ez-eclipse` | `e06` | splittext | Eclipse® Authorized Dealer | **NEW** |
| 7 | WHY ECLIPSE | `ez-credibility` | `e07` | credibility | Why Eclipse | existing (was e05) |
| 8 | WHY ECLIPSE | `ez-gallery` | `e08` | photogrid | Real Projects — Right Here on the Front Range | existing (was e11) |
| 9 | WHY ECLIPSE | `ez-refmap` | `e09` | refmap | We've Worked in Your Neighborhood | **NEW** — reuse Sunesta asset |
| 10 | THE E-ZIP | `ez-reasons` | `e10` | reasonsphoto | What's Pushing You Back Inside? | existing (was e06) |
| 11 | THE E-ZIP | `ez-how` | `e11` | splittext | How the E-Zip Works | existing (was e07) |
| 12 | THE E-ZIP | `ez-systems` | `e12` | models | Cassette Sizes & System Options | existing (was e08) · **MONEY SLIDE** |
| 13 | THE E-ZIP | `ez-fabric` | `e13` | splittext | The Fabric — SunTex® by Phifer | existing (was e09) |
| 14 | THE E-ZIP | `ez-transform` | `e14` | photogrid | Before · After · Inside | **NEW** |
| 15 | SMART CONTROL | `ez-smart` | `e15` | splittext | Smart Control — One Button, Total Command | existing (was e10) |
| 16 | SMART CONTROL | `ez-mylink` | `e16` | splittext | myLink — Your Screens on Your Phone | **NEW** |
| 17 | THE WRAP-UP | `ez-process` | `e17` | processsteps | Our Proven Process | existing (was e13) |
| 18 | THE WRAP-UP | `ez-warranty` | `e18` | warrantyrecap | The Warranty — Recapped | existing (was e12) |
| 19 | THE WRAP-UP | `ez-options` | `e19` | difference | Other Options — An Honest Comparison | **NEW** |
| 20 | THE WRAP-UP | `ez-pricecond` | `e20` | costscale | Not All Shade Costs the Same | **NEW** |
| 21 | THE WRAP-UP | `ez-viewstays` | `e21` | herosplit | Up, It Disappears. Down, It's Protected. | existing (was e14) |

**Plus one module:** `m_ezip_pricing_transition` — Eclipse currently has zero modules. This
mirrors Sunesta's `m_pricing_transition` with phased pricing script.

**Reference entries:** `ref_dodont`, `ref_close`, `ref_faq` retained and rewritten.
`ref_predemo` retired — its content is promoted into `prep_recap` so it leads the walk.

## Rationale for each new slide

**`e05` Our People.** Sunesta's strongest trust slide is the three-questions block: how long have
they been doing this, who actually performs the work, are they qualified. Eclipse has no
equivalent, and it's also the natural home for the 1099 technician language so a rep never has
to improvise it.

**`e06` Eclipse Authorized Dealer.** Right now Eclipse-the-manufacturer never gets its own
moment. Sunesta gets a full heritage slide. The homeowner's fear behind a cheap bid isn't just
poor quality, it's an orphaned warranty — two companies standing behind the project is the
answer, and Eclipse currently only argues one.

**`e09` Reference Map.** Reuses the Sunesta asset and the existing `refmap` renderer. Costs
nothing and gets used twice: proof here, and again during price conditioning.

**`e14` Before · After · Inside.** The single most persuasive visual you have. Currently buried
inside the gallery. Three views of one project earns its own slide.

**`e16` myLink.** Screens are motorized as standard, which means the convenience story is
underweighted. This also gives the SMART CONTROL tab a second slide so it isn't a tab of one.

**`e19` Other Options.** The comparison table currently lives inside the money slide, which makes
the money slide do two jobs. Pulling it out lets the money slide be about system selection and
lets the comparison sit where it belongs, immediately before price conditioning.

**`e20` Price Conditioning.** The `costscale` renderer exists and Eclipse doesn't use it. This is
the highest-leverage single addition in the whole proposal.

## Standing content decisions applied throughout

| Item | Ruling |
|---|---|
| Years in business | **22 years** (2004). Applied everywhere, both products. |
| Region wording | **Front Range** |
| Customer count | **Over 4,000** — company total, not Gutter Helmet only |
| Install lead time | **6 to 8 weeks**, all screen projects |
| Motor delta | **$500** over manual crank |
| Fabric naming | **UV blockage** — SunTex 80 / 90 / 95 / 97. "Openness factor" retired. |
| Miami-Dade | Covers **all cassette sizes and both duty levels** |
| 7-inch mounting | **Any mount** — surface or inside |
| Same-week incentive | `{{SAME_WEEK_SAVINGS}}` variable, `status: NOT_SET` |
| Glass sunroom | **$50,000 and up** |
| Referral | **Post-install only** — never in the presentation |
| Subcontractors | Never volunteered. Reactive answer only. |
| Warranty | PPP priced standard; downgrade is a right-sizing lever |

## The wind story — final framing

This is the one place I've deliberately written narrower than the deck.

**Certified, say freely:** Class 6 wind rating, 80 MPH, Miami-Dade County approved across all
sizes and both duty levels.

**Tested, say with attribution:** At Architectural Testing in York, Pennsylvania, E-Zip units
were subjected to a dynamic wind test at speeds up to 130 MPH. SunTex fabric showed no damage
at 130. Two competing fabrics failed earlier in the same test, one at 110 and one at 70.

**Do not say:** "Super Duty is rated to 130 MPH" as a system spec by duty class. The published
test was run on units 10 feet wide by 7 feet drop, mounted in frames, and it measured fabric
integrity. It predates the 7-inch by six years.

**Why this is still a strong story:** the fabric test is a *comparison*, and comparisons sell
better than specs. Two other manufacturers' fabrics tore in the same rig. That's a better line
than a number on a chart, and it's completely defensible.

**To unlock the deck version:** pull the current Eclipse engineering sheet giving system wind
ratings by cassette size and duty class — likely in the dealer portal alongside the size
threshold tables. Logged as `oi01` below.

## Open items registered (Eclipse previously had zero)

| id | Item | Blocks | Owner | Priority |
|---|---|---|---|---|
| `oi01` | System-level wind rating by size and duty class — need Eclipse engineering doc | `e07`, `e12` | Jack | high |
| `oi02` | `{{SAME_WEEK_SAVINGS}}` percentage undecided (10% or 5%) and week definition | `ref_close`, module | Jack | high |
| `oi03` | Real photo for `e15` — currently `smart-control-placeholder.svg` | `e15` | Jack | medium |
| `oi04` | Eclipse published review stats (99.2% / 4.9 / 4.8) unverified | `e07` | Jack | medium |
| `oi05` | PPP downgrade dollar savings not quantified | `e18` | Jack | medium |
| `oi06` | Reference map asset needs Eclipse install pins added | `e09` | Maxx | low |
| `oi07` | Legacy `script`/`talkingPoints`/`coach` fields in `js/data-eclipse.js` go stale on this rewrite — strip or sync | all | Jack | high |

---

# SECTION B — THE PREP BLOCK

*Leads the training walk. Not deck slides. Mirrors Sunesta's `prep_ids` pattern.*

---

## 🟡 PREP 1 — TABLE RECAP ON THE iPAD
### `prep_recap` · Confirm the Scope Before You Sell Anything

👉 Confirm you and the homeowner are looking at the same project
👉 Surfaces install realities early, when they're a design conversation and not a surprise
⏱ 3:00 – 4:00

**Tone/Mood:** Businesslike and unhurried. This is the one part of the appointment where the rep
sounds like a tradesman rather than a presenter. Reading measurements back is not exciting and
it isn't supposed to be. It's the moment the homeowner decides you're competent.

### Block 1 — Re-open the conversation

> "Before I show you anything — you all said you've been in the home about [X] years, is that
> right?
>
> And this space back here, is this where you spend most of your time outside, or is it more
> where you'd *like* to be spending it?"

*(Let them answer. This is a genuine question and the answer usually adds an Accomplish List item.)*

> "Is this something you've been thinking about for a while?"

### Block 2 — Recap the openings

> "So let me walk you through what I measured, and you tell me if I've got it right.
>
> You've got [X] openings back here. The main one across the back is [X] feet wide with about a
> [X] foot drop. The one on the [side] is [X] by [X].
>
> Every screen is built to the exact opening, so those numbers are what we order to. Nothing
> gets cut down on site."

### Block 3 — Mount type and track surface

> "For mounting, we'd be going [surface mount / inside mount] here, attaching into [wood framing
> / stucco / brick / pergola posts].
>
> The part that matters most on a screen system is that the tracks are perfectly level and
> perfectly parallel to each other. If they're off even a little, the screen binds. That's why we
> take our time here and why we don't hand this to just anybody."

### Block 4 — Power

> "These run on standard 110-volt power, so we'd plan to pull from [this outlet]. No panel work,
> no electrician in most cases.
>
> We run the wire as discreetly as we can — down a post, along the trim, tucked into the soffit.
> If you've got paint on hand we can match it, or we can use one of the standard cover colors."

*(Stage direction: point at the actual outlet and the actual wire path. Do not describe it abstractly.)*

### Block 5 — Sun and orientation

> "Based on the way this faces — [west/south/east/north] — the sun is going to be hardest on you
> roughly [X] to [X]. That lines up with what you told me earlier about [their words].
>
> When the screen is down during those hours, that's the difference between sitting out here and
> going back inside."

### Block 6 — Get the yes

> "Based on everything I just walked through — does this feel like the right approach for your
> space?"

👉 **You need a yes here.** If you get a maybe, stop and find out why. Something is unresolved and
it will cost you at the close.

### Block 7 — Step out

> "Great. I'm going to pop out to the truck and grab a few samples. While I'm out there I'll
> start putting your numbers together. Should I let myself back in, or would you rather I knock?"

*(Update the sales form and prepare the estimates outside. Do not transcribe onto paper yet —
that happens at the table.)*

**Display beats:**
- How long in the home · is this where you spend time
- Recap every opening: width × drop
- Mount type and what we're attaching to
- Tracks must be level and parallel — say why
- 110V, show the actual outlet and wire path
- Sun orientation vs. their stated problem
- Get the yes
- Step outside for samples and numbers

**Slow down on:** *"If they're off even a little, the screen binds."*
Why: this is the entire justification for your install premium, delivered before price exists.
It's a mechanical fact, not a sales claim, which is exactly why it lands.

**Coaching note:** New reps skip this block because it feels like housekeeping and they're eager
to get to the product. It is the opposite of housekeeping. Every install surprise you don't
surface here becomes a change order, a bad review, or a lost sale later. The homeowner who
watches you point at their actual outlet and their actual soffit has already decided you've done
this before.

Never recap measurements from memory. Have them on the screen. Reading them off confidently and
being *slightly* boring here buys you enormous credibility for the next thirty minutes.

**Engagement question:** *"Is this where you spend most of your time outside, or where you'd like
to be?"* — the second half of that question is what produces Accomplish List gold. Most people
answer the second half.

---

## 🟡 PREP 2 — PRE-FRAME
### `preframe` · Set Expectations and Take the Room

👉 Position yourself as the guide, not a presenter
👉 Introduce the two-option structure now so pricing later feels expected
⏱ 45 – 60 seconds

**Tone/Mood:** Friendly and confident. Sitting, not standing. Relaxed body language. This is
forty-five seconds of warmth before any content — the rep should sound like a guest who's glad
to be there, because he is.

### Block 1

> "Well — thanks again for having me out. Not everybody offers us water and puts up with us
> tracking through the yard, so I appreciate that.
>
> Here's what I'd like to do. Take about fifteen minutes, walk you through how these screen
> systems actually work, what makes them different from the other things out there, and how we'd
> design this specifically for your space.
>
> Then we'll look at a couple of options together and figure out what actually makes sense for
> you. Sound good?"

*(Get the yes.)*

**Display beats:**
- Thank them, be human for ten seconds
- Fifteen minutes, here's what we'll cover
- Two options at the end — plant it now
- "Sound good?" — get the yes

**Slow down on:** *"figure out what actually makes sense for you."*
Why: it's the sentence that separates a consultation from a pitch, and it's the frame you'll
lean on at every objection later.

**Coaching note:** Reps who skip the pre-frame end up fighting for control of the appointment for
the next half hour. Forty-five seconds of "here's what's about to happen" means the homeowner
stops wondering when the sales part starts, because you already told them.

Say "a couple of options" out loud here. When two options appear at pricing, they'll feel like
the plan instead of a tactic.

---

# SECTION C — TAB 1: WHY ATH

---

## 🟡 SLIDE 1 — ECLIPSE® E-ZIP MOTORIZED SCREENS
### `e01` · `ez-intro` · herosplit

👉 Re-anchor the conversation on their problem, in their words
👉 Last chance to add to the Accomplish List before the presentation starts
⏱ 2:00 – 3:00

**Tone/Mood:** Conversational and curious. The rep is asking, not telling. If the homeowner isn't
doing most of the talking during this slide, it's being run wrong.

### Block 1 — The frustration question

> "Before we jump in — when you're out here trying to enjoy this space, what's the thing that
> pushes you back inside most often?"

*(Let them answer. Do not fill the silence. Listen for sun angle, wind, heat, bugs, or privacy.)*

> "And what time of day is it usually the worst?"

*(West-facing: afternoon. South: midday. East: morning. North: usually wind or privacy.)*

### Block 2 — Frame the goal

> "So really, the whole goal here is to make this space usable on your terms — when *you* want to
> be out here — without fighting the elements every single time.
>
> That's exactly what we're going to walk through."

**Transition out:** "Let me start with who we are, because honestly, who installs this matters
just as much as what gets installed."

**Display beats:**
- "What pushes you back inside most often?" — then stop talking
- "What time of day is worst?" — anchors sun angle
- Reflect it back: usable on your terms, without fighting the elements
- Add anything new to the Accomplish List right now

**Slow down on:** *"on your terms."*
Why: control is what this product actually sells. Not shade — control. Plant the word early and
it pays off at the money slide when you explain the screen stops at any height.

**Coaching note:** Two to three minutes here anchors everything that follows. The clearer the
pain, the easier the close. Reps rush this because it feels like they're not doing anything, but
the homeowner describing their own problem out loud is worth more than any slide you'll show
them.

Write down their exact words. Not your translation of their words. "The wind flat out ruins
dinner out here" is worth ten times "wind mitigation" when you say it back at pricing.

**Engagement question:** *"What sort of things do you all like to do out here?"* — use it if the
first question produces a short answer. Follow with: dinner? drinks? grandkids? Something always
comes loose.

---

## 🟡 SLIDE 2 — WHO WE ARE
### `e02` · `ez-dealer` · splittext

👉 Trust and local positioning — the first credibility slide, before any product talk
👉 Homeowners buy the rep before they buy the company
⏱ 1:45 – 2:00

**Tone/Mood:** Warm, grounded, unhurried. Neighbor, not presenter. No selling energy yet. Roughly
half this slide is the rep's personal story and that half should not be rushed.

### Block 1 — The company

> "Quick background on us.
>
> We're Around The House Home Solutions. Local, family-owned, based right up in Monument. We've
> been in business since 2004, so twenty-two years now, and in that time we've completed
> thousands of projects across the Front Range. Over four thousand customers. This isn't
> something we picked up last year.
>
> Our focus is the exterior of the home — high quality shade and protection solutions, so people
> can actually enjoy living in Colorado instead of hiding from it.
>
> Something our customers really appreciate — we're not a big corporation out of Denver. You call
> us, you get us."

### Block 2 — Personal touch *(editable per rep)*

> `{{REP_PERSONAL_STORY}}`

**Sample — Matt:** *"Myself, I've been in home remodeling since I graduated college in 2014. I've
worked for everything from big national remodeling companies to small owner-operated
contractors — full home additions, interior remodels, decks, concrete patios. Somewhere along the
way I figured out I have to actually like where I work. So when I met Jack and his brother Maxx,
and saw how they treat customers and each other, I couldn't pass it up. I'm really happy I found
my home here."*

**Transition out:** "Outside of screens, we handle a few other things around the house too."

**Display beats:**
- Local, family-owned, Monument
- Since 2004 — twenty-two years, thousands of projects, 4,000+ customers
- Exterior focus — enjoy Colorado, don't hide from it
- Not a Denver corporation: you call us, you get us
- YOUR personal story

**Slow down on:** *"You call us, you get us."*
Why: it's the whole slide in five words. Say it, stop, let it land.

**Coaching note:** The personal touch is not filler and it is not optional. Homeowners buy the rep
before they buy the company. A new rep who skips it because it feels self-indulgent will feel the
difference at the close.

Write your own version. Same shape as Matt's: where you came from, why you chose here, what you
think of the people you work with. Under sixty seconds, and make it true. A story you're
embarrassed to tell is worse than no story.

**Flags:**
- 🟡 *medium* — Slide title in the deck currently reads "Your Eclipse Dealer — Local &
  Family-Owned," but the script never mentions Eclipse. Retitle to "Who We Are." Eclipse gets its
  own slide at `e06`.

---

## 🟡 SLIDE 3 — YOUR HOME SOLUTIONS EXPERTS
### `e03` · `ez-lineup` · productcards

👉 Establish ATH as a full exterior company, not a one-product screen outfit
👉 Opens the cross-sell door without forcing it
⏱ 1:15 – 1:30 — brisk, this is a flyover

**Tone/Mood:** Confident and moving. The one slide where the rep is allowed to sound like he's
covering ground. Breadth is the point; depth belongs to the screens.

### Block 1

> "So a lot of homeowners don't realize the full picture of what we do.
>
> We've been the authorized dealer for Gutter Helmet and heat cable systems for all twenty-two
> years we've been in business — that's a patented gutter and roof protection system, so you
> never clean your gutters again. Keeps people off ladders and protects the exterior of the home.
>
> Sunesta retractable awnings for overhead shade — we're actually Sunesta's Dealer of the Year.
>
> Motorized louvered roof systems, attached and freestanding. Commercial grade, built for the
> wind we get out here. A lot of our customers pair those with screens to create a real
> three-season outdoor room.
>
> And of course the motorized screens, which is what we're here for today.
>
> Everything's made in the USA and most of it carries a lifetime warranty."

**Transition out:** "Outside of family, your home is usually the biggest investment you've got.
So we only install products we'd put on our own houses, and we install them to a standard we can
stand behind."

**Display beats:**
- Gutter Helmet — 22 years, never clean your gutters again
- Sunesta awnings — Dealer of the Year
- Louvered roofs — commercial grade, pairs with screens
- Motorized screens — today's focus
- Made in USA, mostly lifetime warranties
- Offer to measure anything else — then move on

**Slow down on:** *"all twenty-two years we've been in business."*
Why: longevity is the proof point on this slide. Say the number, pause a beat, move on.

**Coaching note:** The offer to look at other products is a seed, not an invitation. If the
homeowner bites — "actually, what would a louvered roof run?" — acknowledge it and park it:
"Great question, let's absolutely look at that. Let me finish walking you through the screens
first and we'll come back to it." Chasing a second product mid-presentation doubles the length
and usually costs you both sales. Plant it here, harvest it after the close.

**Callback triggers:**
- Homeowner mentions a pergola or louvered roof later
- Homeowner asks about gutters, ice, or roof runoff
- At the close, if a second product came up and you parked it

---

## 🟡 SLIDE 4 — INSTALLED IN-HOUSE
### `e04` · `ez-install` · splitphoto
### *Level, Parallel, To the Inch*

👉 Differentiate install quality — this is the slide that justifies price before price exists
👉 Screens are less forgiving than almost anything else we install, and that's the whole argument
⏱ 2:00 – 2:15

**Tone/Mood:** Calm authority. Not defensive, not bitter about competitors. The rep is describing
how a professional does it and letting the contrast speak. Slight smile on the "chuck in a truck"
line so it lands as observation rather than attack.

### Block 1 — Why install matters more here

> "This is worth a minute before we get to the product.
>
> You can buy a great screen system and still end up unhappy, because a screen is less forgiving
> than almost anything else we install. The two side tracks have to be perfectly level and
> perfectly parallel to each other. Not close — parallel. If they're off, the fabric binds, the
> motor works against itself, and eventually something gives.
>
> It's not like hanging a curtain. There's real precision to it."

### Block 2 — Who does the work

> "Our install teams work exclusively for us. Same crews that do our awnings and our louvered
> roofs — they're trained by us, they know these systems, and we inspect and warranty every job.
>
> A lot of companies out there, it's more of a 'chuck in a truck' situation. They'll install four
> or five of these a year, so they slap it up and hope for the best. There's no consistency from
> one job to the next, and that's how homeowners end up paying for the same project twice."

*(Slight smile on "chuck in a truck." Let it land as a joke about the industry, not a specific competitor.)*

### Block 3 — Licensing and accountability

> "Most shade products in Colorado don't require a permit, which keeps the barrier to entry very
> low for inexperienced companies. Because we also do larger structures like pergolas, we hold our
> PPRBD license in good standing and we build to code regardless of project size.
>
> We're licensed and insured, so if something happens on the job, you're protected and we're
> protected.
>
> And we do a final walkthrough on every install. If anything ever comes up, you call our 719
> number and we come out. That's it."

**Transition out:** "So that's us. Let me tell you about the people who'll actually be at your
house."

**Display beats:**
- Screens are unforgiving — tracks must be level AND parallel
- Off by a little = binding, motor strain, failure
- Our teams, exclusively ours, trained by us
- "Chuck in a truck" — light delivery
- No permit required in CO = low barrier for bad companies
- PPRBD licensed, insured, build to code anyway
- Final walkthrough, one number to call

**Slow down on:** *"Not close — parallel."*
Why: it's the most specific, most technical, most credible thing on the slide, and it's
completely verifiable. A homeowner who understands why precision matters has a reason to
distrust a cheap bid that they came up with themselves.

**Coaching note:** This is the highest-leverage trust slide in the deck and the easiest one to
rush, because it's all company talk and no product. Don't. Every dollar of difference between
your number and a cheaper bid gets defended right here. Skip it and the price objection arrives
later with nothing to push back against.

Deliver "chuck in a truck" lightly. The moment it sounds like you're running down competitors,
the homeowner starts defending them.

**Engagement question:** *"Have you had work done on the home before? How was that experience?"*
— If good: agree, be glad for them, move on. If bad: this industry is notorious for it, and
communication and timelines are what people complain about most, which is exactly why we run it
the way we do.

**Reactive script — asked only if raised:**

> **"Do you use subcontractors?"**
>
> "Our crew is 1099 technicians. But our install teams work exclusively for us — they're trained
> by us, we inspect every job, and we warranty every job. And our production and quality
> assurance guys are full-time employees.
>
> So the accountability doesn't move. It's us either way."

👉 **Never volunteer this.** Do not say "we don't use subcontractors" and do not bring the word
into the room. If asked, answer plainly and move on. The honesty is the point — a rep who dodges
this question loses more than one who answers it.

---

## 🟡 SLIDE 5 — OUR PEOPLE
### `e05` · `ez-people` · splittext · **NEW SLIDE**
### *Who Actually Shows Up*

👉 Answer the question every homeowner has and almost none of them ask
👉 Hands the homeowner a framework they'll use to evaluate the next bid they get
⏱ 1:30 – 1:45

**Tone/Mood:** Steady and matter-of-fact. Not proud, not pitching. The rep is answering a fair
question directly, which is itself the persuasive part.

### Block 1 — The pivot

> "You can build a great company and a great process, but if you don't have the right people on a
> project, it doesn't go well. So when people are vetting a contractor, it really comes down to
> three questions."

### Block 2 — The three questions

> "**How long have they been doing this?** We've been at it twenty-two years and installed
> thousands of projects across the Front Range. That takes a lot of people management to get
> right.
>
> **Who's actually performing the work?** Our own certified technicians, a fully staffed
> operations department, and install teams who work with us and only us.
>
> **Are they qualified?** Our teams are trained to Eclipse's specification and to our own
> standards on top of that — and ours are higher. We do that because we want your screens to look
> right on day one and still look right in fifteen years.
>
> And behind all of it there's an operations team on every project, so you're not depending on me
> to remember to follow up."

**Transition out:** "That's who we are. Let me tell you who builds the product."

**Display beats:**
- Great company + wrong people = bad project
- Three questions: how long · who does the work · are they qualified
- 22 years, thousands of projects
- Our technicians, our ops team, our install crews
- Trained to Eclipse spec AND our standards — ours are higher
- Ops team on every project — not depending on me to follow up

**Slow down on:** *"you're not depending on me to remember to follow up."*
Why: it's disarmingly honest and it's the fear behind every one-truck operation. Say it plainly.

**Coaching note:** The three questions do quiet competitive work. A cheaper bidder usually can't
answer any of them well, and you've just handed the homeowner a framework to evaluate that bid
with. They'll use it whether you're in the room or not.

Don't oversell this slide. It's a straight answer to a fair question and it's most persuasive
when it sounds like one.

---

# SECTION D — THE MONEY SLIDE
### *Included here as a depth specimen from later in the deck*

---

## 🟡 SLIDE 12 — CASSETTE SIZES & SYSTEM OPTIONS
### `e12` · `ez-systems` · models · **`is_money_slide: true`**

👉 THIS IS WHERE THE SYSTEM GETS SOLD
👉 Sets up the secondary two-option fork — everything at pricing comes back to choices made here
⏱ 4:00 – 5:00 (longest slide in the deck)

**Tone/Mood:** This is the shift from presenting to recommending. The rep stops being neutral and
takes a position. Confident, hands-on, slower than anything before it. The samples come out. The
homeowner should be touching things, not just watching.

### ▸ Block 1 — Sizing is not their decision ⏱ 1:00

> "So Eclipse builds three cassette sizes — a four inch, a five inch, and a seven inch — and here's
> the thing I want to be clear about up front: **the size isn't really your decision. It's your
> opening's decision.**
>
> The four inch handles up to about fourteen feet wide with a twelve foot drop.
>
> The five inch is what we install most often — up to twenty-four feet wide, sixteen to twenty
> feet of drop. That covers the vast majority of what we see on the Front Range.
>
> The seven inch is the big one. Twenty-six feet wide, twenty foot drop, with a roller tube up to
> a hundred and forty millimeters.
>
> For your openings at [X] by [X], we'd be looking at the [X] inch."

### ▸ Block 2 — Build quality ⏱ 45 sec

*(Hand them the cassette sample.)*

> "Feel that. That's two-piece powder-coated extruded aluminum. Every size, same construction.
>
> The reason I hand you that is a lot of cheaper systems use roll-form housing, which is basically
> painted sheet metal bent into a shape. This is structurally a different thing.
>
> And inside it is the largest roller tube that'll fit that cassette. A bigger tube resists sag,
> which means your fabric hangs flat and stays flat — not just this year, in ten years."

### ▸ Block 3 — Standard vs Super Duty ⏱ 1:30

*(Hand them both track sections. Standard first, then Super Duty. Let them feel the difference before you explain it.)*

> "Now here's the actual choice.
>
> Both versions carry the same warranty — lifetime on the frame, the fabric, the motor, and the
> electronics. That doesn't change either way you go.
>
> **The Standard** is what we put on most residential projects. Class 6 wind rating, eighty miles
> per hour, Miami-Dade County approved. Fixed side tracks, the fabric edge locks in, the hem bar
> seals at the bottom. For most homes out here, that's the right call and it handles our wind
> extremely well.
>
> **The Super Duty** is a step up. Spring-retention tracks instead of fixed."

*(Point at the two samples in their hands.)*

> "You can feel it — the Standard track holds the fabric edge. The Super Duty track holds it and
> keeps tension on it under load. The hem bar's heavier too, with an internal steel channel.
>
> On a wide opening or a really exposed spot, that extra side tension is what keeps the fabric
> dead flat instead of just contained."

### ▸ Block 4 — The wind proof ⏱ 45 sec

> "And on the fabric side — Eclipse ran these through dynamic wind testing at Architectural
> Testing in Pennsylvania. Engine-driven fan, ramped up to a hundred and thirty miles an hour.
>
> The SunTex fabric came through with no damage at one-thirty. Two competing fabrics in the same
> test failed earlier — one at a hundred and ten, one at seventy.
>
> That's not a number on a brochure. That's three fabrics in the same rig and ours was the one
> still standing."

### ▸ Block 5 — Which one, and why ⏱ 30 sec

> "For your situation, I'd recommend [the Standard / the Super Duty] because [their exposure,
> their opening width, what they told you about wind].
>
> We'll price both so you can see exactly what the difference looks like. But I don't want you
> buying up if you don't need it."

**Transition out:** "Let's talk about the fabric, because that's the part you'll actually be
looking through every day."

**Display beats:**
- Three sizes — the opening picks the size, not you
- 4" → 14'w × 12'd · 5" → 24'w × 16–20'd · 7" → 26'w × 20'd
- Hand them the cassette: 2-pc extruded aluminum vs roll-form sheet metal
- Largest roller tube possible = fabric hangs flat for years
- Hand them BOTH tracks — Standard then Super Duty
- Same lifetime warranty either way
- Standard: Class 6, 80 MPH, Miami-Dade
- Super Duty: spring-retention tracks, heavier hem bar, steel channel
- Wind test: SunTex no damage at 130, competitors failed at 110 and 70
- Make a recommendation. Don't sell up without a reason.

**Slow down on:** *"the size isn't really your decision, it's your opening's decision."*
Why: it removes a choice the homeowner doesn't want to make and frees all their attention for the
one that matters. It also makes you sound like an engineer instead of a salesman thirty seconds
before you recommend an upgrade.

**Coaching note:** This is the fork in the road. Everything before it built permission to
recommend; this is where you actually do. Take a position. A rep who presents three cassette
sizes and two duty levels neutrally has handed the homeowner six options and no guidance, and
confusion doesn't buy.

Get the samples into their hands. Physical contact with the product changes the conversation more
than any statistic. A homeowner who has felt the difference between a fixed track and a
spring-retention track has a reason to say no to a cheaper bid that they invented themselves —
and self-generated reasons survive comparison shopping.

Watch the clock. Five minutes is the longest stretch in the presentation and it's all product. If
the room goes flat, cut Block 2 and keep the tracks. The cassette informs; the tracks close.

Never sell Super Duty by default. On a fourteen-foot sheltered opening it's not the right
recommendation, and a homeowner who later learns that will remember you sold it anyway.

**Verification:**
- ⚠️ **130 MPH figure.** Source is Eclipse's published test writeup (Architectural Testing, York
  PA, April 2013). Test units were 120" × 84" mounted in wooden frames, and the finding was fabric
  integrity, not system rating. SunTex confirmed by Jack as the tested fabric. **Say it as a
  fabric test with attribution. Do not present it as a Super Duty system spec by duty class.**
  Blocked on `oi01`.
- ⚠️ **Miami-Dade scope.** Confirmed by Jack as covering all cassette sizes and both duty levels.
  Pending a copy of the approval document for the file.

**Flags:**
- 🔴 *high* — The deck's `modelCompare` Engineering row currently shows the 7-inch wind rating as
  "Largest-span build" rather than a figure, and shows the 5-inch as Class 6 / 80 MPH with no
  Super Duty alternative. Needs correction once `oi01` resolves.
- 🔴 *high* — The existing `e08` coaching note instructs reps to never quote 130. That guardrail
  must be replaced with the fabric-test framing above, not simply deleted.
- 🟡 *medium* — The 7-inch mounting cell reads "Surface only." Jack confirms any mount, surface or
  inside. Correct in `js/data-eclipse.js`.
- 🟡 *medium* — The competitor comparison table currently lives on this slide. Recommend moving it
  to the new `e19` so this slide does one job.

**Callback triggers:**
- Price objection — come back and rebuild value on the track difference
- "We're getting another quote" — the two track samples are your strongest comparison asset
- Homeowner asks what makes this different from the cheaper one

---

# WHAT'S NEXT

**Part 2** — Tabs 2 and 3: Why Eclipse (4 slides), The E-Zip (remaining 4 slides).
**Part 3** — Tabs 4 and 5: Smart Control (2), The Wrap-Up (5), the pricing transition module,
price conditioning content built on the confirmed tiers, and the rewritten reference entries
(`ref_dodont`, `ref_close`, `ref_faq`).

Then the deck spec, then both output formats.

---

*Around The House Home Solutions*
*Sunesta® Awnings | Eclipse® Shades*
*Jack: 719-482-6183 · Jack@aroundthehouseco.com*
*Matt: 719-644-9333 · Matt@aroundthehouseco.com*
*www.AroundTheHouseCo.com*
