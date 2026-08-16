import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

test('mantra fronts match QPMN’s edge-to-edge 2.75 by 4.75 tarot crop', () => {
  const cardPhotoRule = checklistCss.match(/\.card-front\.has-photo \.card-photo\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(html, /\.card\{aspect-ratio:11\/19/);
  assert.match(cardPhotoRule, /inset:0/);
  assert.match(cardPhotoRule, /width:100%/);
  assert.match(cardPhotoRule, /object-fit:cover/);
  assert.doesNotMatch(cardPhotoRule, /object-fit:contain/);
  assert.doesNotMatch(cardPhotoRule, /inset:-4%|width:108%|height:108%/);
});

test('phone mantra fronts fill the tarot frame without restoring the unsafe all-direction zoom', () => {
  assert.match(checklistCss, /@media\s*\(max-width:560px\)[\s\S]*?\.card-front\.has-photo \.card-photo\s*\{[\s\S]*?object-fit:cover/);
  assert.doesNotMatch(checklistCss, /\.card-front\.has-photo \.card-photo\s*\{[^}]*transform:\s*scale/);
});

test('the Deck presents all 54 cards and keeps the two-card draw centered side by side', () => {
  assert.match(html, /id="drawCounter"[^>]*>0 of 54 revealed/);
  assert.match(html, /counter\.textContent=`\$\{revealed\} of \$\{DECK_DATA\.length\} revealed`/);
  assert.match(html, /\.draw-table\{display:flex;flex-wrap:nowrap;justify-content:center/);
  assert.match(html, /\.draw-table \.card\{flex:0 0 min\(42vw,150px\);max-width:min\(42vw,150px\)\}/);
});

test('the Deck uses Nicolas’s approved August 15 QPMN artwork export', () => {
  assert.match(html, /Draft-WUVGQXWWMG \(draft 642581364, saved 2026-08-15\)/);

  for (let card = 1; card <= 54; card += 1) {
    const number = String(card).padStart(2, '0');
    assert.equal(
      existsSync(new URL(`../assets/web/deck-cards/card-${number}.jpg`, import.meta.url)),
      true,
      `card-${number}.jpg should exist`,
    );
  }

  const revisedCard = readFileSync(new URL('../assets/web/deck-cards/card-16.jpg', import.meta.url));
  assert.equal(
    createHash('sha256').update(revisedCard).digest('hex'),
    '70a5e2375e27aedc90b9aa2b68b941b74b44436d1c5cec6a9a02aa694f0b88fe',
  );
  assert.match(html, /Being kind is the right thing to do\. I can always feel it\./);
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

test('the Community Market directory is an edge-sharing 2-1-2-1-2 hive', () => {
  const directory = html.match(/<div class="directory-hive"[\s\S]*?<\/div>\s*<p class="directory-layout-note">/)?.[0] ?? '';
  const rowCounts = [...directory.matchAll(/<div class="directory-row">([\s\S]*?)(?=<div class="directory-row">|<\/div>\s*<p class="directory-layout-note">)/g)]
    .map((match) => (match[1].match(/class="directory-cell /g) ?? []).length);
  assert.deepEqual(rowCounts, [2, 1, 2, 1, 2]);
  assert.match(html, /\.directory-row\{display:flex;justify-content:center;gap:0\}/);
  assert.match(html, /\.directory-row\+\.directory-row\{margin-top:calc\(var\(--dir-cell\) \* -\.2887\)\}/);
});

test('the hero has the existing bee plus two new bottom-origin ambient bees', () => {
  const heroBees = html.match(/<div class="hero-bees"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.equal((heroBees.match(/class="hero-bee /g) ?? []).length, 3);
  assert.match(html, /\.hero-bee-2\{right:9%;bottom:5%/);
  assert.match(html, /\.hero-bee-3\{left:47%;bottom:8%/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.hero-bee\{animation:none!important/);
});

test('every product comb explains the applicable supplier return conditions before payment', () => {
  const section = (start, end) => html.match(new RegExp(`<!-- ${start} -->([\\s\\S]*?)<!-- ${end} -->`))?.[1] ?? '';
  const puzzles = section('JIGSAW PUZZLES', 'COLORING BOOK');
  const coloring = section('COLORING BOOK', 'BOOK');
  const book = section('BOOK', 'DECK');
  const deck = section('DECK', 'GALLERY');
  const gallery = section('GALLERY', 'STORY');
  const market = html.match(/<!-- MARKETPLACE -->([\s\S]*?)<!-- THE VIEWER/)?.[1] ?? '';

  assert.match(deck, /Returns &amp; order problems/);
  assert.match(deck, /QPMN/);
  assert.match(deck, /within 7 calendar days/);
  assert.match(deck, /qpmarketnetwork\.com\/refund-policy/);

  for (const prodigiSection of [puzzles, gallery]) {
    assert.match(prodigiSection, /Returns &amp; order problems/);
    assert.match(prodigiSection, /Prodigi/);
    assert.match(prodigiSection, /to order/i);
    assert.match(prodigiSection, /prodigi\.com\/faq\/returns-and-cancellations/);
  }

  assert.match(book, /return terms before I pay/);
  assert.match(coloring, /return conditions before checkout/);
  assert.match(market, /supplier’s rules and conditions/);
  assert.match(market, /before payment/);
});
