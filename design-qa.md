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

## Mobile Book-to-Back-tab spacing — 2026-08-10

- Lowered the complete phone/tablet Book visual group by one 8px spacing unit.
- Cover, “psst — open the cover,” and launch-price line move together; desktop remains unchanged.
- Verify the visible cover clears the Back to the Honeycomb tab at phone widths and the 571×541 annotated viewport.
- Added a layered 5-sheet page edge, deeper contact shadow, 3px rigid cover board, reinforced 18px spine, and finished hardback endpaper.
- Tap-to-open cover motion now uses a weighted 1.45s reveal; closing/hover motion remains responsive at 1.15s, with near-instant reduced-motion fallback.

Independent evaluator PASS at 320/390/430/571/820/821/1440. The actual rotated cover
clears the Back tab; the complete wrapper moves only through 820px. Hardcover thickness,
rigid endpaper, three-state page cycle, 1.45s reveal, and reduced-motion fallback all pass.
No overflow or browser errors. Automated suite: 45/45.

final result: passed

## Single QPMN deck configuration — 2026-08-10

- Removed the customer-facing variant selector and obsolete Standard-versus-Expanded, velvet-pouch, and booklet FAQ language.
- FAQ now states one regular 54-card deck configuration; payment copy no longer refers to a selected version.
- Preserved hidden `Standard Deck` compatibility data so the existing order payload remains valid without presenting a false choice.
- Independent content/form eval PASS at 320/390/1440; disclosures, payload, labels, IDs, and 44px phone targets pass. Automated suite: 45/45.

final result: passed

## Mobile Community Marketplace final-glyph safe zone — 2026-08-10

- Reduced only the phone Marketplace label curve by 8% and narrowed its text measure from 92% to 86%.
- Retained the existing 5px optical left shift, cell size, honeycomb centering, and all other labels.
- Verify the final “e” clears the visible clipped cell edge across narrow iPhone widths.

Independent evaluator PASS at 320/375/390/393/414/430/560/561/1440. The final “e”
has 8.219–28.906px of clearance from the actual SVG-clipped edge; minimum left glyph
clearance is 5.125px. Other labels and honeycomb geometry are unchanged, all navigation
passes, and there is no overflow or browser error. Automated suite: 45/45.

final result: passed

## Make It Yours torn-edge clearance — 2026-08-10

- Scoped the commission copy panel's top padding to 4.5rem (72px); no shared torn-paper component or Book panel changed.
- The added clearance accounts for the percentage-based tear growing with the full enquiry form's height.
- Verify the first “Send me a photo…” line clears the visible torn edge at phone, annotation, and desktop widths.

Independent evaluator PASS at 320×568, 390×844, 430×932, the annotated 571×541,
820×900, 821×900, and 1440×900. Visible paragraph-to-tear clearance ranges from
12.81px to 34.68px; the gap is intentional, quote spacing remains consistent, the Book
panel is unchanged, and there is no overflow or browser error. Automated suite: 45/45.

final result: passed

## Cross-iPhone mobile honeycomb fit — 2026-08-10

- Reduced both terms of the phone cell-size formula exactly 10%: `33.8vw → 30.42vw` and `135.2px → 121.68px`.
- The three-cell grid now occupies at most 91.26% of a narrow viewport, preventing the slight side crop seen on iPhone 14-class widths while preserving centering.
- Compact phone viewports up to 600px tall reclaim 20px from the ribbon-to-comb gap so the final row clears both the first screen and its decorative torn-paper footer without changing cell scale.
- Ribbon geometry, navigation labels, texture/shine, and all 561px+ desktop/tablet sizing remain unchanged.
- Follow-up brand pass changes label typography to the existing Shantell Sans wordmark face and uses seven yellow-to-amber ramps sampled from the logo flower; layout geometry remains unchanged.

Independent evaluator PASS across 320×568, iPhone 14 (390×844), iPhone 15 Pro Max
(430×932), 560px, 561px, and 1440px. Side margins are symmetric; the compact screen's
bottom tips clear the torn footer by 2.61–4.34px. All seven labels are contained and all
cell centers hit-test. No overflow, console errors, or overlays. Automated suite: 45/45.

final result: passed

## Desktop hero promise parity — 2026-08-10

- Added “an art gallery” to the desktop hero sentence so it exactly matches the mobile ribbon, Open Graph description, and Twitter description.
- Agent Browser verified 571×541, 1024×768, and 1440×900: the copy remains contained, wraps to three lines, does not overlap the Join button, and produces no horizontal overflow.
- No layout, mobile-copy, metadata, or interaction changes.

final result: passed

## Mobile Story cell wrap correction — 2026-08-09

- Disabled automatic hyphenation and mid-word breaking for every mobile hero-honeycomb label.
- “The Story” now wraps only at its space as two intact words at 320, 375, 390, 430, and 560px.
- All seven labels remain contained; Marketplace final “e” remains visible with approximately 16px clearance at 390px.
- Cell geometry, texture, glare, hit targets, and 561px+ layout are unchanged.
- Independent Agent Browser evaluator PASS with no P0–P3 findings.
- Automated suite: 45/45 passed. `git diff --check`: clean.

final result: passed

## Contextual FAQs for every medium — 2026-08-09

- Added six contextual FAQ sections: Book, Mantra Deck, Gallery Prints, Custom Commissions, Podcast, and Community Marketplace.
- Nineteen native details/summary disclosures cover production status, payment timing, exact 2.75×4.75 deck size, the single regular-deck configuration, framed-print dimensions and regional tolerances, commission workflow, podcast availability, and Marketplace eligibility.
- Gallery FAQ appears after the first two artworks; Marketplace FAQ appears before the submission CTA/form.
- All FAQ IDs/aria-labelledby targets are unique and valid. Every phone summary has a minimum 44px tap target.
- Independent content and visual/accessibility evaluators PASS with no P0–P3 findings at 320, 390, and 1440px.
- All disclosures pass pointer, Enter, Space, and focus-ring checks; no overflow or clipping.
- Automated suite: 45/45 passed. `git diff --check`: clean.

final result: passed

## Mobile hero label reduction — 2026-08-09

- Reduced every mobile hero-honeycomb label by exactly 10%, including the clamp minimum, viewport-fluid term, and maximum.
- Standard labels now scale 18–23.04px; the three longest labels scale 14.4–18.432px.
- Agent Browser and independent evaluator verified 320, 375, 390, 430, 560, 561, and 1440px.
- Community Marketplace's final “e” retains 8.8–16.1px of visible clearance across tested phone widths.
- Cell geometry, torn texture, shine, ribbon, tap behavior, and 561px+ typography are unchanged.
- Independent evaluator PASS with no P0–P3 findings; 45/45 tests; `git diff --check` clean.

final result: passed

## Torn-paper mobile cells + single viewer reference frame — 2026-08-09

- Shifted only the mobile Community Marketplace label 5px left; the final “e” remains visible with roughly 18–20px cell clearance at tested narrow widths.
- Added a mobile-only irregular paper silhouette and coarser directional fibers to the hero cells while preserving their top-left glare.
- Verified at 320, 375, 390, 430, 560, and 561px: labels contained, all cells hit-testable, no overflow, desktop boundary unchanged.
- Removed the lower 2D-viewer reference's redundant selection outline, leaving exactly one calibrated gold product frame.
- Independent hero and viewer evaluators PASS with no P0–P3 findings.
- Automated suite: 45/45 passed. `git diff --check`: clean.

final result: passed

## Mobile honeycomb label enlargement — 2026-08-09

- Increased phone-only honeycomb typography approximately 1.8–2×: standard labels scale from 20 to 25.6px; the three longest labels scale from 16 to 20.48px.
- Verified all seven labels at 320, 375, 390, 430, and 560px: no text clipping, cell overlap, or lost tap targets.
- 561px and 1440px retain their prior 12.8px and 16px desktop/tablet typography exactly.
- Existing short-viewport/outer-grid edge behavior was not changed because this pass is typography-only.
- Independent typography evaluator approved the enlarged type as visually sustainable.
- Automated suite: 45/45 passed. `git diff --check`: clean.

final result: passed

## Viewer lower-reference geometry — 2026-08-09

- Rebuilt the lower mount reference from nested physical ratios rather than decorative padding.
- Default 8×12 reference matches the configured piece: 2-inch mat, 12×16 glaze, 20mm frame face, and 13.6×17.6 overall.
- Alternate 12×18 size preserves the same 2-inch mat and 20mm face on mobile and desktop.
- Mat-color behavior was intentionally left unchanged; this correction is geometry only.
- Independent evaluator PASS at 390 and 1440px with no P0–P3 findings; zero overflow or rendering errors.
- Automated suite: 45/45 passed. `git diff --check`: clean.

final result: passed

## Hero scale + gallery physical calibration — 2026-08-09

- Enlarged only the mobile hero honeycomb by exactly 30%; ribbon geometry and all other hero treatments remain unchanged.
- Reduced every complete Moody Gallery framed piece by approximately 10% and increased the antique-gold molding face by exactly 25%.
- Recalibrated the 2D viewer on mobile and desktop from physical dimensions: 8×12 print, 2-inch mat per side, 12×16 glazed opening, and a 20mm Classic frame face outside the opening.
- Gallery/viewer evaluator PASS at 390 and 1440px: all 16 frames match, viewer proportions remain identical across breakpoints, and room view/controls have no overflow or overlap.
- Automated suite: 45/45 passed. `git diff --check`: clean.

final result: passed

## Textured illuminated honeycombs + mobile scale — 2026-08-09

- Added a monochrome fibrous turbulence layer beneath the existing top-left glare on hero and Marketplace honeycomb cells.
- Strengthened the cut edge to 1.5px and added subtle lower inset shade without dulling the yellow ramps.
- Mobile ribbon enlarged 10.3–12.5%; mobile honeycomb enlarged 10.6–13% and moved down to a consistent 77.6px panel-to-grid gap.
- First-viewport bottoms remain 593.4px at 375, 606.9px at 390, and 614.4px at 560. All labels remain contained and all seven cells hit-test correctly.
- Marketplace evaluator PASS: all six cells retain exact approved 1–2–1–2 geometry, crisp text/logo, zero overflow, Axe 0 violations/19 passes.
- Hero evaluator PASS: exactly three bees unchanged, desktop treatment restrained, zero overflow/errors.
- No P0–P3 findings. Automated suite: 45/45 passed. `git diff --check`: clean.

final result: passed

## Bees-only hero — 2026-08-09

- Removed the rainbow and both cloud elements and their now-unused layout rules.
- Preserved exactly three ambient hero bees, ribbon placement, and the approved smaller honeycomb geometry.
- Independent evaluator confirmed ribbon/grid bounds match the prior version exactly at 375, 390, 560, 561, and 1440px.
- All seven cells remain hit-testable; reduced-motion behavior remains intact; zero overflow/errors.
- Automated suite: 35/35 passed. `git diff --check`: clean.

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
