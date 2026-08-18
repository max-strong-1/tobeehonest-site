import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../assets/web/sun-bird-puzzle.css', import.meta.url), 'utf8')
  .replace(/\s+/g, '');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const has = (rule) => assert.ok(css.includes(rule), `Missing honeycomb geometry: ${rule}`);

test('desktop honeycomb is a true edge-sharing 3-4-3 lattice', () => {
  has('--hc-cell:clamp(115px,11.875vw,170px)');
  has('width:calc(var(--hc-cell)*4);height:calc((var(--hc-cell)/.866)*2.5)');
  has('.cover-honeycomb.hc-1{top:0;left:calc(var(--hc-cell)*.5)}');
  has('.cover-honeycomb.hc-3{top:0;left:calc(var(--hc-cell)*2.5)}');
  has('.cover-honeycomb.hc-4{top:calc((var(--hc-cell)/.866)*.75);left:0}');
  has('.cover-honeycomb.hc-7{top:calc((var(--hc-cell)/.866)*.75);left:calc(var(--hc-cell)*3)}');
  has('.cover-honeycomb.hc-8{top:calc((var(--hc-cell)/.866)*1.5);left:calc(var(--hc-cell)*.5)');
  has('.cover-honeycomb.hc-10{top:calc((var(--hc-cell)/.866)*1.5);left:calc(var(--hc-cell)*2.5)');
});

test('mobile honeycomb is five interlocking rows of two', () => {
  has('--hc-cell:clamp(78px,24vw,105px)');
  has('width:calc(var(--hc-cell)*2.5);height:calc((var(--hc-cell)/.866)*4)');
  has('.cover-honeycomb.hc-1,.cover-honeycomb.hc-2{top:0}');
  has('.cover-honeycomb.hc-3,.cover-honeycomb.hc-4{top:calc((var(--hc-cell)/.866)*.75)}');
  has('.cover-honeycomb.hc-5,.cover-honeycomb.hc-6{top:calc((var(--hc-cell)/.866)*1.5)}');
  has('.cover-honeycomb.hc-7,.cover-honeycomb.hc-8{top:calc((var(--hc-cell)/.866)*2.25)}');
  has('.cover-honeycomb.hc-9,.cover-honeycomb.hc-10{top:calc((var(--hc-cell)/.866)*3)}');
});

test('the phone art-direction override keeps the pre-enlargement mobile scale', () => {
  assert.match(html.replace(/\s+/g, ''), /--hc-cell:min\(30\.42vw,121\.68px\)/);
});

test('all ten comb labels use the approved upright handwritten face at a readable scale', () => {
  has(".cover-honeycomb.hc-cell{font-family:'ShantellSans',cursive;font-style:normal}");
  has(".cover-honeycomb.hc-cell.hc-label{font-family:inherit;font-weight:500;font-size:clamp(.8rem,1.6vw,1rem);line-height:1.08");
  has("font-family:inherit;font-size:clamp(.94rem,4.5vw,1.125rem);line-height:1.04;max-width:90%;transform:none");
  has(".cover-honeycomb.hc-8.hc-label{font-family:'ShantellSans',cursive;font-style:normal;font-weight:500;font-size:clamp(.66rem,3vw,.78rem);line-height:1.03;max-width:98%}");
});

test('the ten hero combs stay in the approved order', () => {
  const hero = html.match(/<div class="hc-grid">([\s\S]*?)<\/div>\s*<\/nav>/)?.[1] ?? '';
  const labels = [...hero.matchAll(/<span class="hc-label">([\s\S]*?)<\/span>/g)]
    .map((match) => match[1].replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

  assert.deepEqual(labels, [
    'THE Book',
    'The Mantra Deck',
    'The Moody Gallery',
    'The Jigsaw Puzzles',
    'The Coloring Book',
    'The Podcast “Nikko &amp; The Kool Kids”',
    'Make It Yours! Customs Products',
    'The Community Marketplace',
    'The Story',
    'Under Construction…',
  ]);
  assert.match(hero, /hc-5"[^>]*data-jump="t-coloring"/);
  assert.match(hero, /hc-10 hc-placeholder/);
  assert.match(hero, /hc-7"[^>]*data-jump="t-yours"/);
  assert.match(hero, /hc-9"[^>]*data-jump="t-story"/);
  assert.match(hero, /aria-label="Open The Community Marketplace"/);
  assert.doesNotMatch(hero, /aria-label="Open The Community Market"|The Community<br>Market<\/span>/);
});
