import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../assets/web/sun-bird-puzzle.css', import.meta.url), 'utf8')
  .replace(/\s+/g, '');

const has = (rule) => assert.ok(css.includes(rule), `Missing honeycomb geometry: ${rule}`);

test('desktop honeycomb is a true edge-sharing 3-4-3 lattice', () => {
  has('width:calc(var(--hc-cell)*4);height:calc((var(--hc-cell)/.866)*2.5)');
  has('.cover-honeycomb.hc-1{top:0;left:calc(var(--hc-cell)*.5)}');
  has('.cover-honeycomb.hc-3{top:0;left:calc(var(--hc-cell)*2.5)}');
  has('.cover-honeycomb.hc-4{top:calc((var(--hc-cell)/.866)*.75);left:0}');
  has('.cover-honeycomb.hc-7{top:calc((var(--hc-cell)/.866)*.75);left:calc(var(--hc-cell)*3)}');
  has('.cover-honeycomb.hc-8{top:calc((var(--hc-cell)/.866)*1.5);left:calc(var(--hc-cell)*.5)');
  has('.cover-honeycomb.hc-10{top:calc((var(--hc-cell)/.866)*1.5);left:calc(var(--hc-cell)*2.5)');
});

test('mobile honeycomb is five interlocking rows of two', () => {
  has('width:calc(var(--hc-cell)*2.5);height:calc((var(--hc-cell)/.866)*4)');
  has('.cover-honeycomb.hc-1,.cover-honeycomb.hc-2{top:0}');
  has('.cover-honeycomb.hc-3,.cover-honeycomb.hc-4{top:calc((var(--hc-cell)/.866)*.75)}');
  has('.cover-honeycomb.hc-5,.cover-honeycomb.hc-6{top:calc((var(--hc-cell)/.866)*1.5)}');
  has('.cover-honeycomb.hc-7,.cover-honeycomb.hc-8{top:calc((var(--hc-cell)/.866)*2.25)}');
  has('.cover-honeycomb.hc-9,.cover-honeycomb.hc-10{top:calc((var(--hc-cell)/.866)*3)}');
});
