# Design QA — Centered mobile hero and shared-link artwork

## Evidence

- Source visual truth: `/tmp/codex-remote-attachments/019fe264-926f-7083-9cd8-c080f09240ad/7DD1E822-78BB-4DA1-AE80-1E545AD1F3F3/1-Photo-1.jpg` (1280 × 1280 photograph of the desktop composition).
- Implementation capture: `/tmp/tbh-center-390.png` at 390 × 844 CSS px, deviceScaleFactor 1.
- Additional captures: `/tmp/tbh-center-375.png` and `/tmp/tbh-center-1440.png`.
- Combined source/implementation comparison: `/Users/maxstrong/.agent-browser/tmp/screenshots/screenshot-1786243121980.png` at 1600 × 1100.
- Social asset: `assets/web/social-share-tower-logo-v4.png`, 1200 × 630; restored from the user's preferred first rendition.
- State: cover hero before navigation.
- Normalization: the source is an oblique desktop photograph while the implementation is the requested phone redesign. Comparison therefore evaluates preserved brand identity, asset fidelity, hierarchy, copy, and responsive geometry rather than literal pixel correspondence.

## Full-view comparison

The requested phone hierarchy is now vertical and centered: the unchanged “To Bee Honest” wordmark remains at the top; a landscape torn-paper ribbon follows with the real circular logo on the left and exact requested copy on the right; the enlarged seven-cell honeycomb sits centered beneath it. The collage remains full bleed.

At 390 × 844 the ribbon is x=15.59–374.39 and y=151.19–255.45. The honeycomb grid is x=39.97–350.02 and y=288.22–586.56, with a center delta of 0.01px from the viewport. At 375 × 812 the center delta is 0px. No ribbon, instruction, cell, or viewport collision occurs.

## Focused-region comparison

- Ribbon: rendered as a landscape paper strip with an 82.86px logo and balanced copy column at 390px. Exact copy: “A book, a deck of mantras, an art gallery, and a growing universe of playful ways to feel better about being you.”
- Honeycomb: phone cells are 103.34 × 119.33px at 390px and 99.38 × 114.75px at 375px, 21–26% wider than the preceding 82px-capped design.
- Glare: layered linear/radial highlights originate at the upper-left and do not intercept pointer events.
- Long labels: all label boxes remain within their cells at both phone widths. The requested strings are exact and unclipped.
- Shared-link asset: the Tower of Knowledge remains visible as a faded full-bleed background. The centered logo is intentionally larger than the later 67% revision because the user explicitly selected the first rendition.

## Required fidelity surfaces

- Fonts and typography: existing Caprasimo and Shantell Sans remain. Wordmark is unchanged. Ribbon and cell text retain brand typography and readable hierarchy.
- Spacing and layout rhythm: ribbon and comb share a common center. The ribbon clears the instruction by 9px and the grid by about 30.6px at 390px.
- Colors and visual tokens: existing paper, honey, bloom, bark, and ink palette remains. The glare adds light, not a new color family.
- Image quality and asset fidelity: original logo and background sources remain in the live hero. The generated social composite uses the supplied Tower and logo sources and contains no added text or watermark.
- Copy and content: `THE Book`, `Make It Yours Custom Products`, `The Podcast “Nikko & The Kool Kids”`, and `The Community Marketplace` appear exactly as requested.

## Findings

- No P0, P1, or P2 findings remain.

## Comparison history

1. Previous iteration used a vertical identity strip to the left of the comb.
2. User redirected the design to a landscape ribbon above a centered, enlarged comb.
3. A second social rendition reduced the logo, but the user explicitly preferred the first rendition. The original first output was restored exactly as v4.
4. Regression found the initial production-domain Open Graph URL returned 404. Fixed by hosting the selected asset on an immutable public preview and updating OG/Twitter metadata.

## Interaction and regression evidence

- All seven cells pass multi-point hit testing and navigate to `#book`, `#deck`, `#gallery`, `#story`, `#yours`, `#podcast`, and `#market`.
- Mobile center delta: 0px at 375, 390, and 560px.
- Desktop 1440 × 900 geometry matches the previous public build; only requested labels and metadata changed.
- Console/page errors: zero.
- Automated suite: 34/34 passed.
- Public social asset: HTTP 200, `image/png`, 1,203,761 bytes, exactly 1200 × 630.

## Implementation checklist

- [x] Landscape ribbon above honeycomb.
- [x] Logo left, exact copy right.
- [x] Unchanged To Bee Honest wordmark.
- [x] Center and enlarge honeycomb.
- [x] Add subtle top-left glare.
- [x] Apply four corrected labels.
- [x] Generate and host social link image.
- [x] Update Open Graph and Twitter metadata.
- [x] Verify mobile, desktop, navigation, image availability, and automated tests.

final result: passed
