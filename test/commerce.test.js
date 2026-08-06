import test from "node:test";
import assert from "node:assert/strict";
import { parseCheckoutInput, resolveCheckoutItem } from "../api/_lib/catalog.js";
import { prodigiBaseUrl, createProdigiOrder } from "../api/_lib/prodigi.js";
import { createQpmnOrder } from "../api/_lib/qpmn.js";

test("framed art requires artwork, size, and frame color", () => {
  assert.throws(() => parseCheckoutInput({ product: "framed-art", quantity: 1 }), /invalid/i);
});

test("deck rejects unexpected client-controlled fields", () => {
  assert.throws(() => parseCheckoutInput({ product: "deck", price: 1 }), /invalid/i);
});

test("catalog resolves approved server-side identifiers", () => {
  process.env.STRIPE_PRICE_FRAME_12X16_GOLD = "price_test";
  process.env.PRODIGI_SKU_FRAME_12X16_GOLD = "sku_test";
  const item = resolveCheckoutItem(parseCheckoutInput({ product: "framed-art", artworkId: "leopard", size: "12x16", frameColor: "gold", quantity: 2 }));
  assert.equal(item.stripePriceId, "price_test");
  assert.equal(item.vendorSku, "sku_test");
  assert.equal(item.quantity, 2);
});

test("Prodigi uses sandbox unless live mode is explicit", () => {
  delete process.env.COMMERCE_VENDOR_MODE;
  assert.equal(prodigiBaseUrl(), "https://api.sandbox.prodigi.com");
  process.env.COMMERCE_VENDOR_MODE = "live";
  assert.equal(prodigiBaseUrl(), "https://api.prodigi.com");
  delete process.env.COMMERCE_VENDOR_MODE;
});

test("Prodigi sends API key, idempotency, and server-owned asset URL", async () => {
  process.env.PRODIGI_API_KEY = "secret-test-key";
  process.env.PRODIGI_ASSET_BASE_URL = "https://assets.example.test";
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ order: { id: "ord_test" } }) };
  };
  await createProdigiOrder({
    session: { id: "cs_test", customer_details: { email: "buyer@example.test" }, shipping_details: { name: "Buyer", address: { line1: "1 Main St", city: "Austin", state: "TX", postal_code: "78701", country: "US" } } },
    item: { vendorSku: "sku_test", quantity: 1, metadata: { artworkId: "leopard" } },
    fetchImpl
  });
  assert.equal(captured.url, "https://api.sandbox.prodigi.com/v4.0/Orders");
  assert.equal(captured.options.headers["X-API-Key"], "secret-test-key");
  assert.equal(captured.body.idempotencyKey, "stripe-cs_test");
  assert.equal(captured.body.items[0].assets[0].url, "https://assets.example.test/leopard.jpg");
});

test("QPMN fails closed until its official contract is verified", async () => {
  await assert.rejects(createQpmnOrder(), /disabled until its official order API contract/i);
});
