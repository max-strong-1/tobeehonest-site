# Design QA — Mobile hero translated from desktop composition

## Evidence

- Source visual truth: `/tmp/codex-remote-attachments/019fe264-926f-7083-9cd8-c080f09240ad/7DD1E822-78BB-4DA1-AE80-1E545AD1F3F3/1-Photo-1.jpg`
- Source pixels: 1280 × 1280 photograph of the desktop application; browser chrome and surrounding monitor are reference context, not app-owned UI.
- Implementation screenshot: `/Users/maxstrong/.agent-browser/tmp/screenshots/screenshot-1786240233009.png`
- Implementation viewport/pixels: 390 × 844 CSS px at deviceScaleFactor 1; screenshot is 390 × 844 pixels.
- Combined comparison: `/Users/maxstrong/.agent-browser/tmp/screenshots/screenshot-1786240287162.png` (1600 × 1100).
- Additional independent captures: `/tmp/tbh-mobile-390x844.png`, `/tmp/tbh-mobile-375x812.png`, and `/tmp/tbh-desktop-1440x900.png`.
- State: cover/hero, before navigation.
- Normalization: exact pixel matching is intentionally not applicable because the source is an oblique photograph of a desktop viewport and the implementation is the requested phone translation. Comparison uses composition, hierarchy, assets, copy, and responsive containment.

## Full-view comparison

The phone implementation preserves the source hierarchy rather than stacking it: the real circular bee/flower logo leads a vertical torn-paper identity card on the left; the complete seven-cell honeycomb sits immediately to the right with its instruction above; and the collage remains full bleed behind both. The 31/69 column split is the responsive adaptation required to fit all seven cells at usable sizes.

At 390 × 844 the card is x=11.69–125.33 and the honeycomb is x=129.33–378.31, leaving a 4px layout gap and 11.69px right clearance. At 375 × 812 the corresponding values are x=11.25–120.52 and x=124.52–363.75. There is no page overflow.

## Focused-region comparison

- Identity card: the source's circular Nicolas logo is restored as the supplied 1170 × 1245 raster asset, not recreated. It renders at 90.27px on 390px phones and 88.48px at 375px, remains sharp, and sits inside the torn-paper card.
- Honeycomb: all seven labels and cells are complete. The smallest tested cell is 78.75 × 90.92px; all center-point hit tests pass.
- Foreground/background: the full-bleed art uses `object-fit:cover`, `object-position:50% 30%`, and no transform. The translucent paper card and shaded cells maintain foreground separation.
- Focused comparison was required because the logo, headline wrapping, and honeycomb labels are too small to judge reliably in the full-view composite alone.

## Required fidelity surfaces

- Fonts and typography: existing Caprasimo/Shantell Sans system retained. The headline remains the card's dominant text and “Scrapbook” no longer breaks mid-word. Honeycomb labels remain legible at 13.33px.
- Spacing and layout rhythm: card-left/comb-right desktop hierarchy retained. Four-pixel track gap at both phone checks; no visual collision, clipping, or overflow.
- Colors and visual tokens: existing paper, honey, bark, and ink tokens retained; no new palette introduced.
- Image quality and asset fidelity: original `assets/IMG_5190.jpeg` logo and `assets/web/cover-hero.jpg` background retained. No placeholder, synthetic reconstruction, or CSS substitute was introduced.
- Copy and content: wordmark, headline, lede, Join the Hive action, instruction, and all seven section labels remain unchanged.

## Findings

No actionable P0, P1, P2, or P3 findings remain.

## Comparison history

1. Initial two-column implementation centered the composition vertically and left excess empty space above the identity card. Fixed by aligning the mobile grid to the upper hero region.
2. Initial narrow-card typography broke “Scrapbook” in the middle of the word. Fixed by reducing the phone-only display size and disabling forced word breaking/hyphenation.
3. Post-fix comparison and two independent evaluator passes found no remaining actionable issues.

## Interaction and regression evidence

- All seven cells navigate to the correct hashes and visible tiers: `#book`, `#deck`, `#gallery`, `#story`, `#yours`, `#podcast`, and `#market`.
- Console errors: zero.
- Page errors: zero.
- Automated suite: 34/34 passed.
- Desktop 1440 × 900 remains unchanged with a 400px panel, 220px logo, original -0.45° rotation, and 45.41px panel-to-comb clearance.

## Implementation checklist

- [x] Restore real logo inside mobile identity card.
- [x] Translate desktop card-left/honeycomb-right structure to ≤560px.
- [x] Keep full collage background.
- [x] Keep all seven navigation cells visible and functional.
- [x] Preserve desktop layout.
- [x] Verify 375px, 390px, 560px, and 1440px widths.

final result: passed
