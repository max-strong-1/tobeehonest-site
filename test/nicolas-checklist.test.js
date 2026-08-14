import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const checklistCss = readFileSync(new URL('../assets/web/nicolas-checklist.css', import.meta.url), 'utf8');

test('the latest vivid Sun Bird and cut-map assets are installed', () => {
  assert.equal(existsSync(new URL('../assets/prints/sun-stone-theory.jpg', import.meta.url)), true);
  assert.equal(existsSync(new URL('../assets/web/sun-bird-puzzle-outline.webp', import.meta.url)), true);
  assert.match(html, /assets\/web\/sun-bird-puzzle-outline\.webp/);
  assert.match(html, /The full 1,000-piece cut preview/);
});

test('the Book begins with a problem, a solution handoff, and Nicolas preface', () => {
  assert.match(html, /How are you—really\?/);
  assert.match(html, /This is not a book about pretending to feel better\./);
  assert.match(html, /Read Nicolas’s preface/);
});

test('mantra fronts crop the baked-in white border without changing master files', () => {
  assert.match(checklistCss, /\.card-front\.has-photo \.card-photo\s*\{/);
  assert.match(checklistCss, /inset:-4%/);
  assert.match(checklistCss, /width:108%/);
});

test('the Coloring Book is a working destination with an honest product preview', () => {
  assert.match(html, /id="t-coloring"/);
  assert.match(html, /assets\/web\/coloring-book-mockup\.webp/);
  assert.match(html, /A real preview—not a checkout/);
  assert.doesNotMatch(html, /hc-5 hc-placeholder/);
});

test('puzzle presentation is portrait, explicit, and connected to secure checkout', () => {
  assert.match(checklistCss, /\.puzzle-tin\s*\{[\s\S]*?aspect-ratio:2\/3/);
  assert.match(html, /Made to order and final sale\./);
  assert.match(html, /id="sunBirdCheckout"[^>]*>Buy the Sun Bird puzzle/);
  assert.match(html, /id="sunBirdCheckoutError" role="alert" hidden/);
});

test('the Story is signed, has no bottom photograph, and the Marketplace placeholder is gone', () => {
  const story = html.match(/<!-- STORY -->([\s\S]*?)<!-- MAKE IT YOURS -->/)?.[1] ?? '';
  const market = html.match(/<!-- MARKETPLACE -->([\s\S]*?)<!-- JOIN/)?.[1] ?? '';
  assert.doesNotMatch(story, /<img\b/);
  assert.match(story, /as I am sure most of us have, how hard life can be/);
  assert.match(story, /Nicolas – Nikko/);
  assert.doesNotMatch(market, /<h4>To Bee Honest<\/h4>/);
});

test('only one ambient hero bee remains', () => {
  const heroBees = html.match(/<div class="hero-bees"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.equal((heroBees.match(/class="hero-bee /g) ?? []).length, 1);
});
