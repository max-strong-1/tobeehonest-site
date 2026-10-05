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

test('gallery offers one honest Stripe purchase path for every selectable frame', () => {
  const viewer = html.slice(html.indexOf('<dialog class="order-dialog" id="galleryOrderDialog"'));
  const galleryScript = viewer.slice(viewer.indexOf('/* ---------- THE VIEWER ----------'));
  assert.match(viewer, /id="gallerySubmitBtn">Secure checkout<\/button>/);
  assert.match(viewer, /Pay securely on Stripe, where you'll enter your contact and shipping details/);
  assert.doesNotMatch(viewer, /No payment today|Nothing is charged today|confirmed by email before any payment/);
  assert.match(galleryScript, /value:'Black',[^\n]*unavailable:true/);
  assert.match(galleryScript, /o\.unavailable\?' disabled'/);
  assert.match(galleryScript, /'Antique Gold':'gold','Brown':'second'/);
  assert.match(galleryScript, /product:'framed-art'/);
  assert.doesNotMatch(galleryScript, /fetch\('\/api\/order-intent'/);
});
