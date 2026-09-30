import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('framed-art checkout has a shipping-zone helper in gallery scope', () => {
  const gallery = html.slice(html.indexOf('/* ---------- THE VIEWER ----------'));
  const galleryScope = gallery.slice(gallery.indexOf('(()=>{'), gallery.indexOf('})();'));
  assert.match(galleryScope, /const zoneNear=/);
  assert.match(galleryScope, /shipping:zoneNear\(form\)/);
  assert.ok(galleryScope.indexOf('const zoneNear=') < galleryScope.indexOf('shipping:zoneNear(form)'));
});
