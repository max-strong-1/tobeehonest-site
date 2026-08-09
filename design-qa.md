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

## Mobile annotation follow-up — 2026-08-09

- The selected ribbon is centered at exactly 80vw at 375px and 390px, producing 10vw margins on both sides. At 560px it respects the 390px cap and remains centered.
- Logo and copy remain fully contained at all three phone widths.
- Honeycomb cells now carry a stronger top-left highlight, darker lower-right inset shading, and a shared lower-right drop shadow for clearer dimensional separation.
- All seven labels remain readable and every cell center still hit-tests to its own navigation target.
- Independent evaluator: PASS at 375, 390, 560, 561, and 1440px. Desktop geometry and styles remain unchanged above 560px.
- Horizontal overflow and browser errors: zero. Automated tests: 34/34.

final result: passed

## Gallery color-rhythm reorder — 2026-08-09

- Moved Leopard Stare from beside Bali Rice Terraces to exactly between Blue Dolphins and Whimsical Sofa.
- Rendered order is Blue Dolphins → Leopard Stare → Whimsical Sofa at mobile and desktop widths.
- All 16 captions remain unique; no omissions or duplicates. Viewer image/title/order-field mappings remain correct for all three adjacent pieces.
- Independent evaluator PASS with no P0–P3; frame geometry unchanged, zero overflow/errors.
- Automated suite: 34/34 passed. `git diff --check`: clean.

final result: passed

## Rainbow clouds + ambient hero bees — 2026-08-09

- Added one generated transparent fluffy-paper cloud asset, mirrored at the two rainbow feet on mobile.
- Added exactly three small cursor-style SVG bees with distinct 13s, 16s, and 14.5s hero flight paths.
- Bees fly behind the ribbon/honeycomb, use `pointer-events:none`, and leave the viewport with the cover after navigation.
- At 375, 390, and 560px both clouds overlap the rainbow endpoints; rainbow/clouds remain hidden at 561px and desktop.
- Reduced-motion mode disables all bee animation and lowers their opacity.
- Independent evaluator PASS with no P0–P3; all seven cells hit-test correctly, zero overflow/errors.
- Automated suite: 34/34 passed. `git diff --check`: clean.

final result: passed

## Encapsulating six-color mobile rainbow — 2026-08-09

- Preserved the previous compact-rainbow implementation on branch `codex/mobile-rainbow-v1` at `725645a`.
- Replaced the mobile asset with a transparent torn-paper arch in red, orange, yellow, green, blue, and violet; no gray band.
- Enlarged and raised the arch so it spans over and down both sides of the honeycomb. Reduced the mobile grid to 264–276px wide so it fits within the opening.
- Rainbow is decorative (`pointer-events:none`, layer 0); all seven honeycomb cells remain above it and hit-test correctly.
- Rainbow is mobile-only through 560px and hidden at 561px/desktop. Zero horizontal overflow or browser errors.
- Independent evaluator PASS after resolving its only P3 typography note at 560px; no remaining P0–P3 findings.
- Automated suite: 34/34 passed. `git diff --check`: clean.

final result: passed

## Mobile rainbow + sixteen-piece gallery — 2026-08-09

- Removed “Choose a cell to see what the bees are building” from phone and desktop.
- Added the transparent torn-paper rainbow asset above the honeycomb at widths through 560px; it is hidden at 561px and above.
- Added “The Sun Stone Theory” first in the gallery with a 320×480 thumbnail and 1000×1500 full asset.
- Gallery presentation and ordering are framed-and-matted only. Retired controls and values are absent from the UI, hidden form controls, and API validation.
- Public preview and thumbnail return HTTP 200; remote thumbnail SHA-256 matches the local asset exactly.
- Independent hero evaluator: PASS at 375, 390, 560, 561, and 1440px; all seven cells hit-test correctly; no overflow or browser errors.
- Independent gallery evaluator: PASS at 390 and 1440px; all 16 frames share identical geometry; viewer payload uses Antique Gold + White; no P0–P3 findings.
- Automated suite: 34/34 passed. `git diff --check`: clean.

final result: passed
