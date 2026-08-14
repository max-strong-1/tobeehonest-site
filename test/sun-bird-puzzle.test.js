import test from "node:test";
import assert from "node:assert/strict";

import { shouldSnap } from "../assets/web/sun-bird-puzzle-state.js";
import * as puzzleState from "../assets/web/sun-bird-puzzle-state.js";

test("multi-piece jigsaw state builder exists", () => {
  assert.equal(typeof puzzleState.createJigsawState, "function");
});

test("multi-piece jigsaw begins with ten distinct loose pieces", () => {
  const state = puzzleState.createJigsawState();

  assert.equal(state.pieces.length, 10);
  assert.deepEqual(state.pieces.map((piece) => piece.id), ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  assert.equal(state.pieces.every((piece) => piece.placed === false && piece.x === 0 && piece.y === 0), true);
  assert.equal(state.placedCount, 0);
  assert.equal(state.complete, false);
});

test("multi-piece jigsaw transition helpers exist", () => {
  assert.equal(typeof puzzleState.moveJigsawPiece, "function");
  assert.equal(typeof puzzleState.placeJigsawPiece, "function");
  assert.equal(typeof puzzleState.resetJigsaw, "function");
});

test("moving one loose piece leaves every other piece untouched", () => {
  const initial = puzzleState.createJigsawState(["a", "b"]);
  const moved = puzzleState.moveJigsawPiece(initial, "b", { x: 42, y: -18 });

  assert.deepEqual(moved.pieces, [
    { id: "a", x: 0, y: 0, placed: false },
    { id: "b", x: 42, y: -18, placed: false }
  ]);
  assert.deepEqual(initial.pieces[1], { id: "b", x: 0, y: 0, placed: false });
});

test("a placed jigsaw piece cannot be moved out of its home", () => {
  const placed = puzzleState.placeJigsawPiece(puzzleState.createJigsawState(["a"]), "a");

  assert.deepEqual(puzzleState.moveJigsawPiece(placed, "a", { x: 80, y: 40 }), placed);
});

test("the jigsaw completes only when every distinct piece is placed", () => {
  let state = puzzleState.createJigsawState(["a", "b"]);
  state = puzzleState.placeJigsawPiece(state, "a");
  state = puzzleState.placeJigsawPiece(state, "a");

  assert.equal(state.placedCount, 1);
  assert.equal(state.complete, false);
  assert.equal(state.pieces[0].placed, true);

  state = puzzleState.placeJigsawPiece(state, "b");
  assert.equal(state.placedCount, 2);
  assert.equal(state.complete, true);
});

test("reset returns every jigsaw piece to its loose starting state", () => {
  const placed = puzzleState.placeJigsawPiece(
    puzzleState.moveJigsawPiece(puzzleState.createJigsawState(["a", "b"]), "b", { x: 99, y: 32 }),
    "a"
  );

  assert.deepEqual(puzzleState.resetJigsaw(placed), puzzleState.createJigsawState(["a", "b"]));
});

test("target overlap of at least 35 percent snaps", () => {
  const piece = { left: 0, top: 0, right: 100, bottom: 100 };
  assert.equal(shouldSnap(piece, { left: 65, top: 0, right: 165, bottom: 100 }), true);
  assert.equal(shouldSnap(piece, { left: 66, top: 0, right: 166, bottom: 100 }), false);
});
