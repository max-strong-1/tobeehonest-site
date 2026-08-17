import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../assets/web/book-checkin.css', import.meta.url), 'utf8');

test('the check-in dissolves into the book stage instead of ending at a hard page break', () => {
  const transition = [...css.matchAll(/\.book-checkin::after\s*\{[^}]*\}/g)].at(-1)?.[0] ?? '';
  assert.match(transition, /height:\s*clamp\(/);
  assert.match(transition, /linear-gradient\(/);
  assert.match(transition, /clip-path:\s*none/);
});
