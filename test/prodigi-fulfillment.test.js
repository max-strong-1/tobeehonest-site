import test from "node:test";
import assert from "node:assert/strict";
import { PRODIGI_ORDER_ID_REGEX, getProdigiOrder } from "../api/_lib/prodigi.js";
import { mapProdigiOrderToAirtableStatus } from "../api/_lib/prodigi-status.js";
import { extractProdigiOrderIdCandidate } from "../api/webhooks/prodigi.js";
import poolProdigiOrdersHandler from "../api/cron/poll-prodigi-orders.js";
import { resolveCheckoutItem, parseCheckoutInput } from "../api/_lib/catalog.js";
import { assertKnownArtwork } from "../api/order-intent.js";
import { isKnownArtworkSlug, isKnownArtworkTitle } from "../api/_lib/artwork-allowlist.js";

function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (payload) => { res.body = payload ? JSON.parse(payload) : undefined; };
  return res;
}

// --- Untrusted webhook body ---------------------------------------------

test("webhook order-id extraction ignores everything but subject / data.order.id", () => {
  // A forged body claiming a status/shipment — none of it should ever surface.
  const forged = {
    subject: "ord_555",
    data: { order: { id: "ord_555", status: { stage: "Complete" } } },
    type: "com.prodigi.order.status.stage.changed#Complete"
  };
  assert.equal(extractProdigiOrderIdCandidate(forged), "ord_555");

  // Body with no subject falls back to data.order.id.
  assert.equal(extractProdigiOrderIdCandidate({ data: { order: { id: "ord_777" } } }), "ord_777");

  // Body with neither yields an empty candidate (caller must still validate shape).
  assert.equal(extractProdigiOrderIdCandidate({ status: "Shipped", stage: "Complete" }), "");
  assert.equal(extractProdigiOrderIdCandidate({}), "");
  assert.equal(extractProdigiOrderIdCandidate(null), "");
});

// --- Malformed order id rejection ---------------------------------------

test("PRODIGI_ORDER_ID_REGEX only accepts ord_<digits>", () => {
  assert.ok(PRODIGI_ORDER_ID_REGEX.test("ord_1469466"));
  assert.ok(!PRODIGI_ORDER_ID_REGEX.test("ord_abc"));
  assert.ok(!PRODIGI_ORDER_ID_REGEX.test("'; DROP TABLE orders;--"));
  assert.ok(!PRODIGI_ORDER_ID_REGEX.test("../../etc/passwd"));
  assert.ok(!PRODIGI_ORDER_ID_REGEX.test(""));
});

test("getProdigiOrder rejects a malformed id before ever making a network call", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  await assert.rejects(() => getProdigiOrder("not-a-real-id", { fetchImpl }), /not a recognized shape/i);
  assert.equal(called, false);
});

// --- The authenticated GET is what determines status --------------------

test("getProdigiOrder makes an authenticated GET to /v4.0/orders/{id}", async () => {
  process.env.PRODIGI_API_KEY = "secret-test-key";
  delete process.env.COMMERCE_VENDOR_MODE;
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ order: { id: "ord_1469466", status: { stage: "InProgress" } } }) };
  };
  const result = await getProdigiOrder("ord_1469466", { fetchImpl });
  assert.equal(captured.url, "https://api.sandbox.prodigi.com/v4.0/orders/ord_1469466");
  assert.equal(captured.options.method, "GET");
  assert.equal(captured.options.headers["X-API-Key"], "secret-test-key");
  assert.equal(result.order.status.stage, "InProgress");
});

test("mapProdigiOrderToAirtableStatus derives status only from the Prodigi order object", () => {
  assert.equal(mapProdigiOrderToAirtableStatus({ order: { status: { stage: "Draft" } } }), "Placed");
  assert.equal(mapProdigiOrderToAirtableStatus({ order: { status: { stage: "InProgress" } } }), "Printing");
  assert.equal(mapProdigiOrderToAirtableStatus({ order: { status: { stage: "Complete" } } }), "Shipped");
  assert.equal(mapProdigiOrderToAirtableStatus({ order: { status: { stage: "Cancelled" } } }), "Cancelled");
  assert.equal(
    mapProdigiOrderToAirtableStatus({ order: { status: { stage: "InProgress", issues: [{ code: "order.items.assets.NotDownloaded" }] } } }),
    "Failed / Needs Attention"
  );
  assert.equal(
    mapProdigiOrderToAirtableStatus({ order: { status: { stage: "InProgress" }, items: [{ status: "Invalid" }] } }),
    "Failed / Needs Attention"
  );
});

// --- Unknown artwork slug rejection --------------------------------------

test("checkout resolve rejects an artworkId that is not in the approved gallery catalog", () => {
  process.env.STRIPE_PRICE_FRAME_12X16_GOLD = "price_test";
  process.env.PRODIGI_SKU_FRAME_12X16_GOLD = "sku_test";
  process.env.STRIPE_SHIPPING_RATE_FRAME_12X16_US = "shr_frame_test";
  process.env.STRIPE_SHIPPING_RATE_FRAME_12X16_US_EXPRESS = "shr_frame_test-express";
  assert.throws(
    () => resolveCheckoutItem(parseCheckoutInput({ product: "framed-art", artworkId: "some-made-up-slug", size: "12x16", frameColor: "gold", quantity: 1 })),
/approved gallery catalog/i
  );
});

test("checkout resolve accepts a real gallery slug", () => {
  process.env.STRIPE_PRICE_FRAME_12X16_GOLD = "price_test";
  process.env.PRODIGI_SKU_FRAME_12X16_GOLD = "sku_test";
  process.env.STRIPE_SHIPPING_RATE_FRAME_12X16_US = "shr_frame_test";
  process.env.STRIPE_SHIPPING_RATE_FRAME_12X16_US_EXPRESS = "shr_frame_test-express";
  const item = resolveCheckoutItem(parseCheckoutInput({ product: "framed-art", artworkId: "leopard-stare", size: "12x16", frameColor: "gold", quantity: 1 }));
  assert.equal(item.metadata.artworkId, "leopard-stare");
});

test("artwork allowlist slug/title checks", () => {
  assert.equal(isKnownArtworkSlug("sun-stone-theory"), true);
  assert.equal(isKnownArtworkTitle("The Sun Stone Theory"), true);
  assert.equal(isKnownArtworkSlug("leopard-stare"), true);
  assert.equal(isKnownArtworkSlug("not-a-real-piece"), false);
  assert.equal(isKnownArtworkTitle("Leopard Stare"), true);
  assert.equal(isKnownArtworkTitle("Some Fake Painting"), false);
});

test("order-intent gallery path rejects an unapproved artwork title", () => {
  assert.throws(
    () => assertKnownArtwork({ product: "gallery", artwork: "Some Fake Painting" }),
/approved gallery catalog/i
  );
  // Known title passes silently.
  assert.doesNotThrow(() => assertKnownArtwork({ product: "gallery", artwork: "Leopard Stare" }));
  // Deck orders have no artwork field and are unaffected.
  assert.doesNotThrow(() => assertKnownArtwork({ product: "deck" }));
});

// --- Poll backstop no-ops when the flag is off ---------------------------

test("poll-prodigi-orders no-ops (no Airtable/Prodigi calls) when COMMERCE_FULFILLMENT_ENABLED is off", async () => {
  delete process.env.COMMERCE_FULFILLMENT_ENABLED;
  delete process.env.AIRTABLE_TOKEN;
  delete process.env.AIRTABLE_BASE_ID;
  delete process.env.AIRTABLE_ORDERS_TABLE_ID;
  const req = { method: "GET", url: "/api/cron/poll-prodigi-orders" };
  const res = fakeRes();
  await poolProdigiOrdersHandler(req, res);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.skipped, "fulfillment disabled");
  assert.equal(res.body.checked, 0);
});
