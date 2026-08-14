import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const checklistCss = readFileSync(new URL('../assets/web/nicolas-checklist.css', import.meta.url), 'utf8');

test('the approved Sun Bird lid and complete 1,000-piece cut map are installed', () => {
  const cutMap = readFileSync(new URL('../assets/web/sun-bird-puzzle-cutmap.svg', import.meta.url), 'utf8');
  assert.equal(existsSync(new URL('../assets/web/sun-bird-puzzle-lid-approved.webp', import.meta.url)), true);
  assert.match(html, /assets\/web\/sun-bird-puzzle-lid-approved\.webp/);
  assert.match(html, /assets\/web\/sun-bird-puzzle-cutmap\.svg/);
  assert.doesNotMatch(html, /assets\/web\/sun-bird-puzzle-outline\.webp/);
  assert.match(cutMap, /data-columns="25"/);
  assert.match(cutMap, /data-rows="40"/);
  assert.match(cutMap, /data-piece-count="1000"/);
  assert.match(cutMap, /href="data:image\/webp;base64,/);
  assert.equal((cutMap.match(/class="cut-line cut-line--vertical"/g) ?? []).length, 24);
  assert.equal((cutMap.match(/class="cut-line cut-line--horizontal"/g) ?? []).length, 39);
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

test('the Coloring Book uses Nicolas’s approved cover and stays an honest preview', () => {
  assert.match(html, /id="t-coloring"/);
  assert.match(html, /assets\/web\/coloring-book-cover-approved\.jpeg/);
  assert.doesNotMatch(html, /assets\/web\/coloring-book-mockup\.webp/);
  assert.match(html, /A real preview—not a checkout/);
  assert.doesNotMatch(html, /hc-5 hc-placeholder/);
});

test('puzzle presentation uses the approved lid art inside a white tin and secure checkout', () => {
  assert.match(checklistCss, /\.puzzle-tin\s*\{[\s\S]*?aspect-ratio:2\/3/);
  assert.match(checklistCss, /\.puzzle-tin-lid\s*\{[\s\S]*?background:[^;]*(?:fff|white)/);
  assert.doesNotMatch(html, /class="puzzle-tin-side"/);
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
