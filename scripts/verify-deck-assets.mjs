// Deck asset integrity check — no external dependencies.
//
// The Mantra Deck art is the one part of this site that must never drift as a
// side effect of unrelated edits. This module pins the deck to a specific QPMN
// draft and asserts, byte for byte, that every shipped card still matches.
//
// Run directly:  node scripts/verify-deck-assets.mjs
// Run in CI:     npm test  (see test/deck-assets.test.js)

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DECK_DIR = join(ROOT, "assets", "web", "deck-cards");
export const MANIFEST_PATH = join(DECK_DIR, "qpmn-latest-and-greatest.json");

// The canonical QPMN source of truth. Changing these is a deliberate act:
// it means a genuinely newer deck revision was exported and re-verified.
export const CANONICAL = {
  draftId: 642581364,
  productInstanceId: 646548898,
  draftName: "Latest And Greatest",
  cardCount: 54
};

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export async function verifyDeckAssets() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const problems = [];

  if (manifest.draftId !== CANONICAL.draftId) {
    problems.push(`manifest draftId ${manifest.draftId} != canonical ${CANONICAL.draftId}`);
  }
  if (manifest.productInstanceId !== CANONICAL.productInstanceId) {
    problems.push(
      `manifest productInstanceId ${manifest.productInstanceId} != canonical ${CANONICAL.productInstanceId}`
    );
  }
  if (!Array.isArray(manifest.cards) || manifest.cards.length !== CANONICAL.cardCount) {
    problems.push(`expected ${CANONICAL.cardCount} cards, found ${manifest.cards?.length}`);
  }

  // Card numbers must be exactly 1..54 with no gaps or duplicates.
  const numbers = (manifest.cards ?? []).map((c) => c.card).sort((a, b) => a - b);
  const expected = Array.from({ length: CANONICAL.cardCount }, (_, i) => i + 1);
  if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
    problems.push("card numbering is not a complete 1..54 sequence");
  }

  for (const card of manifest.cards ?? []) {
    if (!card.websiteSha256) {
      problems.push(`card ${card.card}: manifest has no websiteSha256`);
      continue;
    }
    try {
      const bytes = await readFile(join(DECK_DIR, card.websiteFile));
      const actual = sha256(bytes);
      if (actual !== card.websiteSha256) {
        problems.push(
          `card ${card.card} (${card.websiteFile}): sha256 ${actual.slice(0, 12)} != manifest ${card.websiteSha256.slice(0, 12)}`
        );
      }
    } catch {
      problems.push(`card ${card.card}: missing file ${card.websiteFile}`);
    }
  }

  // The card back ships alongside the fronts and is referenced by index.html.
  try {
    await readFile(join(DECK_DIR, "card-back.jpg"));
  } catch {
    problems.push("missing card-back.jpg");
  }

  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = await verifyDeckAssets();
  if (problems.length) {
    console.error(`Deck asset verification FAILED (${problems.length}):`);
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  console.log(`Deck assets OK — ${CANONICAL.cardCount} fronts + back, pinned to draft ${CANONICAL.draftId}.`);
}
