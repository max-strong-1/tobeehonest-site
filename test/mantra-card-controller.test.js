import test from "node:test";
import assert from "node:assert/strict";

import { bindMantraCard } from "../assets/web/mantra-card-controller.js";

function fakeCard() {
  const classes = new Set();
  const listeners = new Map();
  const attributes = new Map();
  const frontAttributes = new Map();
  const backAttributes = new Map();
  const photo = { src: "" };

  return {
    photo,
    listeners,
    attributes,
    frontAttributes,
    backAttributes,
    element: {
      classList: {
        contains: (name) => classes.has(name),
        toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
      },
      setAttribute: (name, value) => attributes.set(name, value),
      addEventListener: (name, handler) => listeners.set(name, handler),
      querySelector: (selector) => {
        if (selector === ".card-photo") return photo;
        if (selector === ".card-front") return { setAttribute: (name, value) => frontAttributes.set(name, value) };
        if (selector === ".card-back") return { setAttribute: (name, value) => backAttributes.set(name, value) };
        return null;
      },
    },
  };
}

test("a drawn mantra card preloads its face, flips both ways, and counts only its first reveal", () => {
  const card = fakeCard();
  let reveals = 0;

  bindMantraCard(card.element, {
    mantra: "I have nowhere to be, but where I am.",
    imageSrc: "assets/web/deck-cards/card-51.jpg",
    onFirstReveal: () => { reveals += 1; },
  });

  assert.equal(card.photo.src, "assets/web/deck-cards/card-51.jpg", "the face loads before the first activation");
  assert.equal(card.attributes.get("aria-pressed"), "false");

  card.listeners.get("click")();
  assert.equal(card.attributes.get("aria-pressed"), "true");
  assert.equal(card.frontAttributes.get("aria-hidden"), "false");
  assert.equal(reveals, 1);

  card.listeners.get("click")();
  assert.equal(card.attributes.get("aria-pressed"), "false");
  assert.equal(card.backAttributes.get("aria-hidden"), "false");
  assert.equal(reveals, 1, "turning a known card over again does not consume another reveal");

  card.listeners.get("click")();
  assert.equal(reveals, 1, "re-revealing the same card remains free");
});
