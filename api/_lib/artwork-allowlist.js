/* Server-side allowlist of valid gallery artwork slugs/titles.
 *
 * MUST STAY IN SYNC with GALLERY_CATALOG in index.html (search that file for
 * "const GALLERY_CATALOG"). That array is the single source of truth for what
 * renders in The Moody Gallery; this module is a deliberate server-side copy of
 * just the identifying fields (slug + title), not an import — index.html is a
 * static deployed asset with no module boundary a serverless function can import
 * across, and the two must never silently drift apart from a shared build step
 * that doesn't exist yet. When GALLERY_CATALOG changes (a piece added, removed,
 * or renamed), update this list in the same commit.
 *
 * Why this exists: nothing server-side previously constrained which artwork slug
 * could be ordered. `createProdigiOrder` interpolates `item.metadata.artworkId`
 * directly into the Prodigi asset URL — a crafted request naming an arbitrary
 * slug would ask Prodigi to fetch (and print) whatever file happens to live at
 * that path on PRODIGI_ASSET_BASE_URL, or simply fail/stall the order. The
 * allowlist below is the enforcement point for both the Stripe checkout path
 * (api/_lib/catalog.js) and the free intent-capture path (api/order-intent.js).
 */

export const ARTWORK_ALLOWLIST = [
  { slug: "blue-dolphins", title: "Blue Dolphins" },
  { slug: "yellow-retro-car", title: "Yellow Retro Car" },
  { slug: "whimsical-sofa", title: "Whimsical Sofa" },
  { slug: "vespa-selfie", title: "Vespa Selfie" },
  { slug: "crete-beach", title: "Crete Beach" },
  { slug: "crete-archway", title: "Crete Archway" },
  { slug: "art-deco-deity", title: "Art Deco Deity" },
  { slug: "nayarit-view", title: "Nayarit View" },
  { slug: "daydreaming-red-bird", title: "Daydreaming Red Bird" },
  { slug: "stargazing-red-bird", title: "Stargazing Red Bird" },
  { slug: "iron-lady", title: "Iron Lady" },
  { slug: "leopard-stare", title: "Leopard Stare" },
  { slug: "animals-ark", title: "Animals' Ark" },
  { slug: "bali-people", title: "Bali Rice Terraces" },
  { slug: "cashew-medley", title: "Cashew Medley" },
  { slug: "guatemala-fruits", title: "Guatemala Fruits" },
  { slug: "milan-spa", title: "Milan Spa" }
];

/* Strict slug shape — same regex used elsewhere in this codebase (catalog.js's
   checkoutSchema) for a lowercase-kebab identifier, max 80 chars. */
export const ARTWORK_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,79}$/;

const SLUG_SET = new Set(ARTWORK_ALLOWLIST.map(entry => entry.slug));
const TITLE_SET = new Set(ARTWORK_ALLOWLIST.map(entry => entry.title));

export function isKnownArtworkSlug(slug) {
  return typeof slug === "string" && ARTWORK_SLUG_REGEX.test(slug) && SLUG_SET.has(slug);
}

export function isKnownArtworkTitle(title) {
  return typeof title === "string" && TITLE_SET.has(title);
}
