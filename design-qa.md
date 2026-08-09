# Design QA — Mobile hero spacing, Tower deck backs, and Moody Gallery mounts

## Visual targets

- Physical-frame reference: `/Users/maxstrong/Downloads/prodigi-global-cfpm-16x20-black-frame-snow-white-mount.png`.
- Close reference crop: `/var/folders/zz/1_6dprwn2mvd6tzxzcsm30pm0000gn/T/TemporaryItems/NSIRD_screencaptureui_YONcNQ/Screenshot 2026-08-08 at 11.01.16 PM.png`.
- Side-by-side source/implementation comparison: `/tmp/tbh-gallery-reference-comparison.png`.
- Real deck-back artwork: `assets/prints/tower-of-knowledge.jpg`, 1000 × 1500.
- Tested implementation states: cover, unrevealed Mantra Deck, framed Moody Gallery, and gallery viewer.

## Mobile hero

- At 390 × 844, ribbon y-position is 111.19px: exactly 24px above commit `5abcde5`.
- Honeycomb grid y-position is 329.48px: exactly 24px below commit `5abcde5`.
- Honeycomb bottom is 627.83px, fully inside the viewport.
- Horizontal overflow is zero.
- The change is scoped to the ≤560px media query; desktop structure remains untouched.

## Mantra Deck

- All four cards start face down with `aria-pressed="false"`.
- Every reverse uses the real saturated Tower of Knowledge asset, not the faded hero collage.
- At 390 × 844, all four cards fit in two rows between y=137.42px and y=577.89px.
- The existing tap/keyboard reveal behavior remains wired to the same cards.
- Horizontal overflow is zero.

## Moody Gallery source comparison

The supplied product reference establishes a thin physical molding surrounding a generous white mount, with the artwork substantially smaller than the outer frame. The implementation reproduces that hierarchy using one shared geometry for every catalog item:

- Outer opening: 3:4.
- Artwork: 2:3, centered without distortion.
- Artwork width: 68% of the mount opening.
- Artwork height: 76.5% of the mount opening.
- White mount: consistent across all 15 pieces.
- Antique-gold molding: 8.80px per side at 390px and 12.47px per side at 1440px.

Independent measurements confirm identical geometry: at 375 × 812 each outer frame is 359 × 472.8px with 232.16 × 348.22px artwork; at 390 × 844 it is 374 × 492.8px with 242.34 × 363.52px artwork; at 1440 × 900 it is 531 × 699.69px with 344.11 × 516.17px artwork. No piece is larger or smaller than another.

## Visual and interaction checks

- Gold molding uses the existing four-sided miter renderer and remains responsive.
- White mount retains the existing top-lit paper treatment and contact shadow.
- Museum picture lights remain centered above the frames.
- Gallery title remains centered beneath the cream mobile navigation bar.
- Artwork remains fully visible and proportional.
- “Click to see it closer” and the gallery viewer remain attached to the full interactive plate.
- Browser console errors: zero in local review.
- Independent hero/deck evaluator: PASS at 375, 390, 560, 561, and 1440px.
- Independent gallery evaluator: PASS at 375, 390, and 1440px with no P0–P3 findings.
- Automated suite: 34/34 passed.
- `git diff --check`: clean.

## Implementation checklist

- [x] Move mobile ribbon up three 8px spaces.
- [x] Move mobile honeycomb down three 8px spaces.
- [x] Restore real colorful Tower of Knowledge card backs.
- [x] Reduce gallery artwork to create a generous mount reveal.
- [x] Use one consistent white mount across the complete gallery.
- [x] Increase the initially-too-thin gold molding after visual review.
- [x] Preserve gallery lights, hover hint, viewer, and ordering behavior.
- [x] Verify phone and desktop geometry and automated tests.

final result: passed
