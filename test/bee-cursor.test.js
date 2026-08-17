import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../bee-cursor.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../bee-cursor.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the bee is the only rendered pointer on fine-pointer web and responsive previews', () => {
  assert.match(css, /html\.bee-cursor-enabled,\s*html\.bee-cursor-enabled \*/);
  assert.match(css, /cursor:\s*none\s*!important/);
  assert.doesNotMatch(css, /cursor:\s*(?:pointer|hand|grab|text)\s*!important/);
});

test('reduced motion keeps a static bee instead of restoring the native cursor', () => {
  assert.doesNotMatch(js, /if\s*\([^)]*finePointer[^)]*reducedMotion[^)]*\)\s*return/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*animation:\s*none\s*!important/);
});

test('the gallery top-layer viewer mounts the bee inside the dialog', () => {
  assert.match(js, /window\.TBH_BEE_CURSOR/);
  assert.match(html, /TBH_BEE_CURSOR\?\.mount\(dialog\)/);
  assert.match(html, /TBH_BEE_CURSOR\?\.mount\(document\.body\)/);
  assert.doesNotMatch(html, /classList\.remove\('bee-cursor-enabled'\)/);
});
