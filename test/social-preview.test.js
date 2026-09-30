import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const previewAsset = new URL('../assets/web/social-share-tower-logo-v4.png', import.meta.url);

test('shared links use the approved rainbow bee logo on the live domain', () => {
  const previewUrl = 'https://tobeehonest.com/assets/web/social-share-tower-logo-v4.png';

  assert.match(html, /<meta property="og:url" content="https:\/\/tobeehonest\.com\/">/);
  assert.match(html, new RegExp(`<meta property="og:image" content="${previewUrl}">`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${previewUrl}">`));
  assert.equal(existsSync(previewAsset), true);
});
