# Design QA — Mobile sky-ring hero and marketplace directory hive

## Scope

- Mobile hero only (≤560px): replace the background with the invite-link sky-ring palette, raise and enlarge the landscape ribbon, and evenly space ribbon → instruction → honeycomb.
- Community Marketplace: restore the business-directory honeycomb, use the selected staggered Version B, and extend it to four rows configured `1–2–1–2`.
- Desktop hero must remain unchanged.

## Source and implementation evidence

- Palette reference: `assets/web/social-share-tower-logo-v4.png` (the user-selected invite-link artwork).
- Generated mobile background: `assets/web/cover-hero-sky-rings-v2.png`, 941 × 1672.
- Original desktop background retained: `assets/web/cover-hero.jpg`.
- Marketplace logos: `assets/web/foreman-f-mark.jpg` and `assets/IMG_5190.jpeg`.
- Independent hero regression: 375 × 812, 390 × 844, 560 × 900, 561 × 900, and 1440 × 900.
- Independent marketplace review: 375 × 812, 390 × 844, and 1440 × 900.

## Hero findings

- The `<picture>` source boundary is exact: the new ring artwork loads through 560px; the existing desktop artwork loads from 561px upward.
- The background fills the viewport with `object-fit: cover`, without cream gutters.
- The mobile ribbon moved upward exactly 16px and grew approximately 10% in height. Its logo and copy scale with the larger ribbon.
- Ribbon → instruction and instruction → honeycomb gaps are both exactly 20px.
- Honeycomb center delta is 0px at 375, 390, and 560px.
- All seven cells are fully visible and hit-testable; their routes remain unchanged.
- Desktop 1440 × 900 hero geometry is pixel-identical to the prior committed version.
- The remaining lower ring field is intentional artwork breathing room, not an unfilled foreground gap.

## Marketplace findings

- Version B is the single final layout; prototype switching controls and comparison JavaScript were removed.
- Four staggered rows contain exactly `1–2–1–2` cells.
- Foreman AI uses the real gold F mark and a short business description.
- To Bee Honest uses the real bee-and-flower mark and a short description.
- Unassigned cells are explicitly identified as future, permission-based directory seats rather than fictional businesses.
- The hive exposes correct list/listitem semantics to assistive technology.
- The existing “Submit your creation” form and its submission behavior remain in place below the directory.

## Interaction and regression evidence

- Hero routes verified: `#book`, `#deck`, `#gallery`, `#story`, `#yours`, `#podcast`, and `#market`.
- “To Bee Honest” wordmark copy is unchanged.
- Horizontal overflow: zero at all tested breakpoints.
- Console and page errors: zero.
- Automated suite: 34/34 passed.
- `git diff --check`: clean.

## Implementation checklist

- [x] Use invite-link sky-ring colors on the mobile hero.
- [x] Raise ribbon by two spacing units (16px).
- [x] Enlarge ribbon and its typography by approximately 10%.
- [x] Equalize the two foreground gaps to 20px.
- [x] Keep the mobile honeycomb centered.
- [x] Preserve the desktop hero.
- [x] Select directory Version B.
- [x] Extend the directory to `1–2–1–2` rows.
- [x] Include real logos and descriptions for approved listings.
- [x] Preserve the marketplace submission form.
- [x] Run independent agent evaluation and automated regression tests.

final result: passed
