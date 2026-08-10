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
  const item = resolveCheckoutItem(parseCheckoutInput({ product: "framed-art", artworkId: "leopard-stare", size: "12x16", frameColor: "gold", quantity: 2 }));
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
    item: { vendorSku: "sku_test", quantity: 1, metadata: { artworkId: "leopard", frameColor: "gold" } },
    fetchImpl
  });
  assert.equal(captured.url, "https://api.sandbox.prodigi.com/v4.0/Orders");
  assert.equal(captured.options.headers["X-API-Key"], "secret-test-key");
  assert.equal(captured.body.idempotencyKey, "stripe-cs_test");
  assert.equal(captured.body.items[0].assets[0].url, "https://assets.example.test/leopard.jpg");
  /* Regression guard. Prodigi sells all eight Classic Frame finishes under one sku
     and rejects the order outright (400 MissingRequiredAttributes) when `color` is
     absent — a real sandbox order failed exactly this way on 2026-08-09. */
  assert.deepEqual(captured.body.items[0].attributes, { color: "gold" });
});

test("Prodigi refuses to send an order with a missing or bogus frame colour", async () => {
  process.env.PRODIGI_API_KEY = "secret-test-key";
  process.env.PRODIGI_ASSET_BASE_URL = "https://assets.example.test";
  const session = { id: "cs_x", customer_details: { email: "b@example.test" }, shipping_details: { name: "B", address: { line1: "1 Main St", city: "Austin", state: "TX", postal_code: "78701", country: "US" } } };
  /* fetchImpl throws so the assertions below prove the order is stopped BEFORE any
     request goes out — failing late means failing after the customer has paid. */
  const boom = async () => { throw new Error("fetch must never be reached"); };
  for (const frameColor of [undefined, "", "chartreuse"]) {
    await assert.rejects(
      createProdigiOrder({ session, item: { vendorSku: "sku_test", quantity: 1, metadata: { artworkId: "leopard", frameColor } }, fetchImpl: boom }),
      /not one of Prodigi's frame finishes/
    );
  }
  /* Casing and stray padding are normalised rather than rejected — "  Gold " comes
     from config, and that is not a typo worth failing a paid order over. */
  let captured;
  await createProdigiOrder({
    session,
    item: { vendorSku: "sku_test", quantity: 1, metadata: { artworkId: "leopard", frameColor: "  Gold " } },
    fetchImpl: async (url, options) => { captured = JSON.parse(options.body); return { ok: true, json: async () => ({ order: { id: "ord_test" } }) }; }
  });
  assert.deepEqual(captured.items[0].attributes, { color: "gold" });
});

test("QPMN fails closed until its official contract is verified", async () => {
  await assert.rejects(createQpmnOrder(), /disabled until its official order API contract/i);
});
