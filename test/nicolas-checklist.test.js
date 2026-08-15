import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const checklistCss = readFileSync(new URL('../assets/web/nicolas-checklist.css', import.meta.url), 'utf8');

test('the approved Sun Bird lid and Prodigi-style 1,000-piece product preview are installed', () => {
  assert.equal(existsSync(new URL('../assets/web/sun-bird-puzzle-lid-approved.webp', import.meta.url)), true);
  assert.equal(existsSync(new URL('../assets/web/sun-bird-puzzle-prodigi-preview.png', import.meta.url)), true);
  assert.match(html, /assets\/web\/sun-bird-puzzle-prodigi-preview\.png/);
  assert.doesNotMatch(html, /assets\/web\/sun-bird-puzzle-cutmap\.svg/);
  assert.doesNotMatch(html, /assets\/web\/sun-bird-puzzle-outline\.webp/);
  assert.match(html, /Prodigi-style 1,000-piece product preview/);
});

test('the Book begins with a problem, a solution handoff, and Nicolas preface', () => {
  assert.match(html, /How are you—really\?/);
  assert.match(html, /This is not a book about pretending to feel better\./);
  assert.match(html, /Read Nicolas’s preface/);
});

test('mantra fronts preserve the complete card so no mantra words are cropped', () => {
  assert.match(checklistCss, /\.card-front\.has-photo \.card-photo\s*\{/);
  assert.match(checklistCss, /inset:0/);
  assert.match(checklistCss, /width:100%/);
  assert.match(checklistCss, /object-fit:contain/);
  assert.doesNotMatch(checklistCss, /inset:-4%|width:108%|height:108%/);
});

test('phone mantra fronts fill the tarot frame without restoring the unsafe all-direction zoom', () => {
  assert.match(checklistCss, /@media\s*\(max-width:560px\)[\s\S]*?\.card-front\.has-photo \.card-photo\s*\{[\s\S]*?object-fit:cover/);
  assert.doesNotMatch(checklistCss, /\.card-front\.has-photo \.card-photo\s*\{[^}]*transform:\s*scale/);
});

test('the Coloring Book keeps the realistic mockup with Nicolas’s approved cover', () => {
  assert.match(html, /id="t-coloring"/);
  assert.match(html, /assets\/web\/coloring-book-mockup-approved\.png/);
  assert.doesNotMatch(html, /src="assets\/web\/coloring-book-cover-approved\.jpeg"/);
  assert.match(html, /A real preview—not a checkout/);
  assert.doesNotMatch(html, /hc-5 hc-placeholder/);
});

test('puzzle presentation uses the approved lid on Prodigi’s real large-tin photography', () => {
  assert.equal(existsSync(new URL('../assets/web/sun-bird-puzzle-tin-approved.png', import.meta.url)), true);
  assert.match(html, /assets\/web\/sun-bird-puzzle-tin-approved\.png/);
  assert.doesNotMatch(html, /class="puzzle-tin-lid"|class="puzzle-tin-side"/);
  assert.match(checklistCss, /\.puzzle-tin\s*\{[\s\S]*?aspect-ratio:1/);
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
