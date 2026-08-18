import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('desktop cover keeps the complete scrapbook visible and uses the lower-right space', () => {
  assert.match(html, /@media\(min-width:1051px\)\{[\s\S]*?\.cover-panel\{max-width:360px;justify-self:start\}/);
  assert.match(html, /\.cover-panel \.panel\{padding:1\.65rem 1\.7rem 1\.75rem\}/);
  assert.match(html, /\.cover-logo\{width:176px;height:176px;margin-bottom:\.9rem\}/);
  assert.match(html, /\.cover-panel h1\{font-size:clamp\(2\.15rem,3\.35vw,2\.85rem\);margin-bottom:\.7rem\}/);
  assert.match(html, /\.cover-panel \.lede\{font-size:1rem;line-height:1\.45;margin-bottom:1rem\}/);
  assert.match(html, /\.cover-honeycomb\{position:absolute;left:calc\(50% \+ 132px\);top:54svh;transform:translate\(-50%,-50%\)\}/);
});
