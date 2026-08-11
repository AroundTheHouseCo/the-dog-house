# iPad Touch Test — e19 & e20

**Who:** Jack or Matt · **Where:** a real iPad, not the desktop browser · **Time:** ~10 minutes

Everything else in the Eclipse deck has been verified with desktop clicks and automated
render sweeps. These two slides can't be: both depend on **touch** behavior that desktop
mouse input does not reproduce. Run this on the installed PWA (Add to Home Screen), in
landscape, in **Present mode** — that's the state a customer actually sees.

Report back per numbered check: pass, or what happened instead.

---

## Setup

1. Open the installed DOGHOUSE app on the iPad (home-screen icon, not Safari with a URL bar).
2. Presentations → Eclipse® E-Zip Screens.
3. Confirm bottom-right shows the current build. If anything below looks stale, close the
   app fully (swipe up from app switcher), reopen while on wifi, and try again.

---

## e19 — Comparison Table (THE E-ZIP tab, slide 19)

This is the deck's **first full-bleed scrollable table in Present mode**, and Present mode is
also where swipe-to-advance is live. Those two behaviors compete for the same gesture. That
conflict is the entire reason this test exists.

**1. Vertical scroll inside the table**
Put a finger in the middle of the table and drag **up**.
- ✅ Expect: the table scrolls, the slide does NOT change.
- ❌ Watch for: the slide advancing instead, or the whole page bouncing while the table stays put.

**2. Horizontal swipe to advance, starting ON the table**
Swipe **left** with your finger starting on the table body.
- Either answer is acceptable — just tell us which you get:
  - (a) slide advances, or
  - (b) nothing happens and you must swipe from outside the table.
- We need to know which, because (b) means a rep mid-presentation could feel the deck "stick."

**3. Horizontal swipe starting OFF the table**
Swipe left starting from the margin above/below the table.
- ✅ Expect: advances to the next slide, every time.

**4. Reach the bottom of the table, then keep dragging**
Scroll to the last row and keep pulling up.
- ❌ Watch for: rubber-band bounce that detaches the header, or the tab bar/footer sliding out of place.

**5. Rotate to portrait and back**
- ✅ Expect: table reflows, no horizontal page scroll, nothing clipped off-screen.

**6. Two-finger pinch on the table**
- ❌ Watch for: the whole app zooming (it should not — this is a fixed presentation surface).

---

## e20 — Price Tiers (THE WRAP-UP tab, slide 20)

The tier circles and their popovers were **doubled in size** in a recent round. That change
was verified visually on desktop only. What's untested is whether the bigger targets are
comfortable and correctly hit-tested under a thumb.

**7. Tap each of the tier circles, one at a time**
- ✅ Expect: each opens **its own** popover — the photo and text match the tier you tapped.
- ❌ Watch for: a tap opening the neighbouring tier's popover (targets overlapping after the resize).

**8. Tap accuracy near the edges**
Tap the **outer edge** of a circle rather than dead center.
- ✅ Expect: still opens. If edge taps miss, the visual circle is bigger than its tap target.

**9. Popover size on screen**
With a popover open:
- ✅ Expect: fits fully on screen, nothing cut off top or bottom, text comfortably readable
  at arm's length (this gets shown across a kitchen table).

**10. Dismissing the popover**
Close it via the × **and** by tapping outside it.
- ✅ Expect: both work. Standard for every overlay in this app.

**11. Popover open + swipe**
With a popover open, swipe left.
- ✅ Expect: the popover closes OR nothing happens — the deck must NOT silently advance
  behind an open popover.

**12. Rapid tapping**
Tap several tiers quickly in a row.
- ❌ Watch for: two popovers open at once, or one stuck open.

---

## Anything else worth reporting

- Any spot where a tap needed a second attempt.
- Any lag opening a popover (these carry photos).
- Anything that felt awkward with the iPad **held**, rather than flat on a table — that's the
  real selling posture.
