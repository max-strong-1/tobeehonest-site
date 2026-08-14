import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../assets/web/book-checkin.js', import.meta.url), 'utf8');

test('the Book opens with an accessible five-choice emotional check-in', () => {
  assert.match(html, /<section class="book-checkin"[^>]*aria-labelledby="bookCheckinTitle"/);
  assert.match(html, /id="bookCheckinTitle">How are you—really\?<\/h2>/);
  assert.equal((html.match(/data-book-mood=/g) ?? []).length, 5);
  assert.equal((html.match(/data-book-mood="[^"]+" aria-pressed="false"/g) ?? []).length, 5);
  assert.match(html, /id="bookMoodResponse" aria-live="polite"/);
  assert.match(html, /id="bookScrollCue"[^>]*aria-controls="bookDetails"/);
});

test('the check-in stays private and explains rather than diagnoses', () => {
  assert.doesNotMatch(script, /fetch\(|localStorage|sessionStorage|XMLHttpRequest/);
  assert.match(script, /where this book begins/);
  assert.match(script, /prefers-reduced-motion: reduce/);
});

test('the rejected toilet artwork is not used by the Book experience', () => {
  const book = html.match(/<!-- BOOK -->([\s\S]*?)<!-- DECK -->/)?.[1] ?? '';
  assert.doesNotMatch(book, /book-sneak-1\.jpg/);
  assert.match(book, /assets\/IMG_5791\.jpeg/);
});
