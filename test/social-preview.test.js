import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const previewAsset = new URL('../assets/web/social-share-logo.png', import.meta.url);

test('shared links use the To Bee Honest logo instead of the tower artwork', () => {
  const previewUrl = 'https://tobeehonest.com/assets/web/social-share-logo.png';

  assert.match(html, new RegExp(`<meta property="og:image" content="${previewUrl}">`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${previewUrl}">`));
  assert.doesNotMatch(html, /social-share-tower-logo/i);
  assert.equal(existsSync(previewAsset), true);
});
