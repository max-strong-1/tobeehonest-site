import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyDeckAssets, CANONICAL, DECK_DIR } from "../scripts/verify-deck-assets.mjs";

// The Mantra Deck art has silently drifted more than once: an export was taken
// from a duplicate QPMN draft, and a layer-order bug buried the mantra text
// under an artwork-only working layer. These tests make either failure loud.

test("every shipped deck card matches the pinned QPMN manifest", async () => {
  const problems = await verifyDeckAssets();
  assert.deepEqual(problems, [], "deck asset drift:\n" + problems.join("\n"));
});

test("deck manifest stays pinned to the canonical QPMN draft", async () => {
  const manifest = JSON.parse(await readFile(join(DECK_DIR, "qpmn-latest-and-greatest.json"), "utf8"));
  assert.equal(manifest.draftId, CANONICAL.draftId);
  assert.equal(manifest.productInstanceId, CANONICAL.productInstanceId);
  assert.equal(manifest.draftName, CANONICAL.draftName);
});

test("index.html references only manifest-backed deck art", async () => {
  const html = await readFile(join(DECK_DIR, "..", "..", "..", "index.html"), "utf8");
  const manifest = JSON.parse(await readFile(join(DECK_DIR, "qpmn-latest-and-greatest.json"), "utf8"));
  const allowed = new Set([...manifest.cards.map((c) => c.websiteFile), "card-back.jpg"]);

  const referenced = [...html.matchAll(/deck-cards\/([A-Za-z0-9._-]+\.jpg)/g)].map((m) => m[1]);
  assert.ok(referenced.length > 0, "expected index.html to reference deck art");

  const orphans = [...new Set(referenced)].filter((f) => !allowed.has(f));
  assert.deepEqual(orphans, [], `index.html references non-manifest deck art: ${orphans.join(", ")}`);
});
