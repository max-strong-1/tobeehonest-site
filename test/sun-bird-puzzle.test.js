import test from "node:test";
import assert from "node:assert/strict";

import {
  completePuzzle,
  createPuzzleState,
  movePiece,
  resetPuzzle,
  shouldSnap,
} from "../assets/web/sun-bird-puzzle-state.js";

test("puzzle starts staged and incomplete", () => {
  assert.deepEqual(createPuzzleState(), {
    start: { x: 0, y: 0 },
    piece: { x: 0, y: 0 },
    complete: false,
  });
});

test("moving the final piece preserves the original reset point", () => {
  const moved = movePiece(createPuzzleState({ x: 18, y: 24 }), { x: 82, y: 95 });
  assert.deepEqual(moved.start, { x: 18, y: 24 });
  assert.deepEqual(moved.piece, { x: 82, y: 95 });
});

test("target overlap of at least 35 percent snaps", () => {
  const piece = { left: 0, top: 0, right: 100, bottom: 100 };
  assert.equal(shouldSnap(piece, { left: 65, top: 0, right: 165, bottom: 100 }), true);
  assert.equal(shouldSnap(piece, { left: 66, top: 0, right: 166, bottom: 100 }), false);
});

test("completion and reset produce explicit states", () => {
  const initial = createPuzzleState({ x: 14, y: 28 });
  assert.equal(completePuzzle(initial).complete, true);
  assert.deepEqual(resetPuzzle(movePiece(completePuzzle(initial), { x: 100, y: 100 })), initial);
});
