import test from "node:test";
import assert from "node:assert/strict";

/* These drive the real fulfillPaidCheckout and prove the guard is applied per-vendor
   and fails closed, without needing Airtable or a live vendor. Collaborators are
   controlled through env vars and a swapped global fetch, so production code carries
   no test-only branches. */

test("a self-idempotent vendor is never gated by the ledger", async () => {
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  process.env.PRODIGI_API_KEY = "k";
  process.env.PRODIGI_ASSET_BASE_URL = "https://assets.example.test";
  delete process.env.AIRTABLE_FULFILLMENT_TABLE_ID; // ledger deliberately unconfigured

  const { fulfillPaidCheckout } = await import("../api/_lib/fulfillment.js");
  let called = false;
  const session = {
    id: "cs_a", payment_status: "paid",
    customer_details: { email: "b@example.test" },
    shipping_details: { name: "B", address: { line1: "1 Main St", city: "Austin", state: "TX", postal_code: "78701", country: "US" } }
  };
  /* Prodigi carries its own idempotencyKey, so an unconfigured ledger must NOT block
     it — proving the guard is applied per-vendor rather than globally. */
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({ order: { id: "ord_1" } }) }; };
  try {
    await fulfillPaidCheckout({
      session,
      item: { vendor: "prodigi", vendorSku: "sku", quantity: 1, metadata: { artworkId: "a", frameColor: "gold" } }
    });
    assert.equal(called, true);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.COMMERCE_FULFILLMENT_ENABLED;
  }
});

test("a non-idempotent vendor refuses to run at all without a ledger", async () => {
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  delete process.env.AIRTABLE_FULFILLMENT_TABLE_ID;
  const { fulfillPaidCheckout } = await import("../api/_lib/fulfillment.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("no vendor call must be made"); };
  try {
    /* Fail closed: without duplicate protection, an unfulfilled order is recoverable
       by hand but a double-charged customer is not. */
    await assert.rejects(
      fulfillPaidCheckout({
        session: { id: "cs_b", payment_status: "paid" },
        item: { vendor: "tgc", vendorSku: "sku", quantity: 1, metadata: {} }
      }),
      /AIRTABLE_FULFILLMENT_TABLE_ID must be set/
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.COMMERCE_FULFILLMENT_ENABLED;
  }
});

test("the deck stays on the guarded TGC path while QPMN is disabled", async () => {
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  delete process.env.QPMN_ENABLED;
  delete process.env.AIRTABLE_FULFILLMENT_TABLE_ID;
  const { fulfillPaidCheckout } = await import("../api/_lib/fulfillment.js");
  await assert.rejects(
    fulfillPaidCheckout({
      session: { id: "cs_deck_tgc", payment_status: "paid" },
      item: { vendor: "qpmn", vendorSku: "deck-sku", quantity: 1, metadata: { product: "deck" } }
    }),
    /AIRTABLE_FULFILLMENT_TABLE_ID must be set/
  );
  delete process.env.COMMERCE_FULFILLMENT_ENABLED;
});

test("an enabled QPMN deck order uses the same non-idempotent ledger guard", async () => {
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  process.env.QPMN_ENABLED = "true";
  process.env.QPMN_REFRESH_TOKEN = "refresh-test";
  process.env.QPMN_PRODUCT_ID_DECK = "321";
  process.env.QPMN_DESIGN_ID_DECK = "654";
  delete process.env.AIRTABLE_FULFILLMENT_TABLE_ID;
  const { fulfillPaidCheckout } = await import("../api/_lib/fulfillment.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("QPMN must not be called before the ledger claim"); };
  try {
    await assert.rejects(
      fulfillPaidCheckout({
        session: { id: "cs_deck_qpmn", payment_status: "paid" },
        item: { vendor: "qpmn", vendorSku: "deck-sku", quantity: 1, metadata: { product: "deck" } }
      }),
      /AIRTABLE_FULFILLMENT_TABLE_ID must be set/
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ["COMMERCE_FULFILLMENT_ENABLED", "QPMN_ENABLED", "QPMN_REFRESH_TOKEN", "QPMN_PRODUCT_ID_DECK", "QPMN_DESIGN_ID_DECK"]) {
      delete process.env[name];
    }
  }
});

test("the deck switches vendor hosts only when QPMN is enabled and QPMN failures use the shared failed stage", async () => {
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  process.env.AIRTABLE_TOKEN = "airtable-test";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_FULFILLMENT_TABLE_ID = "ledger-test";
  process.env.TGC_DECK_SKU = "tgc-deck";
  process.env.TGC_USERNAME = "tgc-user";
  process.env.TGC_PASSWORD = "tgc-password";
  process.env.TGC_API_KEY_ID = "tgc-key";
  process.env.QPMN_REFRESH_TOKEN = "refresh-test";
  process.env.QPMN_PRODUCT_ID_DECK = "321";
  process.env.QPMN_DESIGN_ID_DECK = "654";
  const { fulfillPaidCheckout } = await import("../api/_lib/fulfillment.js");
  const vendorUrls = [];
  const ledgerPatches = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url.includes("api.airtable.com")) {
      const body = JSON.parse(options.body);
      if (body.performUpsert) {
        return { ok: true, json: async () => ({ records: [{ id: "rec-lock", fields: {} }], createdRecords: ["rec-lock"] }) };
      }
      ledgerPatches.push(body.records[0].fields);
      return { ok: true, json: async () => ({ records: [{ id: "rec-lock" }] }) };
    }
    vendorUrls.push(url);
    throw new Error(url.includes("qpmarketnetwork.com") ? "qpmn-route" : "tgc-route");
  };
  const session = {
    id: "cs_route", payment_status: "paid", amount_subtotal: 4900,
    customer_details: { email: "buyer@example.test" },
    shipping_details: {
      name: "Buyer Example",
      address: { line1: "1 Main St", city: "Austin", state: "TX", postal_code: "78701", country: "US" }
    }
  };

  try {
    delete process.env.QPMN_ENABLED;
    await assert.rejects(
      fulfillPaidCheckout({ session, item: { vendor: "qpmn", vendorSku: "legacy", quantity: 1, metadata: { product: "deck" } } }),
      /tgc-route/
    );
    assert.match(vendorUrls.at(-1), /thegamecrafter\.com/);

    process.env.QPMN_ENABLED = "true";
    await assert.rejects(
      fulfillPaidCheckout({ session: { ...session, id: "cs_route_qpmn" }, item: { vendor: "qpmn", vendorSku: "legacy", quantity: 1, metadata: { product: "deck" } } }),
      /qpmn-route/
    );
    assert.match(vendorUrls.at(-1), /qpmarketnetwork\.com/);
    assert.ok(ledgerPatches.some(fields => fields.Stage === "failed" && fields.Error === "qpmn-route"));
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of [
      "COMMERCE_FULFILLMENT_ENABLED", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_FULFILLMENT_TABLE_ID",
      "TGC_DECK_SKU", "TGC_USERNAME", "TGC_PASSWORD", "TGC_API_KEY_ID", "QPMN_ENABLED",
      "QPMN_REFRESH_TOKEN", "QPMN_PRODUCT_ID_DECK", "QPMN_DESIGN_ID_DECK"
    ]) delete process.env[name];
  }
});

test("unpaid sessions are rejected before any vendor or ledger work", async () => {
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  const { fulfillPaidCheckout } = await import("../api/_lib/fulfillment.js");
  await assert.rejects(
    fulfillPaidCheckout({
      session: { id: "cs_c", payment_status: "unpaid" },
      item: { vendor: "tgc", vendorSku: "sku", quantity: 1, metadata: {} }
    }),
    /requires a paid Stripe Checkout Session/
  );
  delete process.env.COMMERCE_FULFILLMENT_ENABLED;
});

test("an unknown vendor is rejected rather than silently skipped", async () => {
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  const { fulfillPaidCheckout } = await import("../api/_lib/fulfillment.js");
  await assert.rejects(
    fulfillPaidCheckout({
      session: { id: "cs_d", payment_status: "paid" },
      item: { vendor: "printful", vendorSku: "sku", quantity: 1, metadata: {} }
    }),
    /No fulfillment adapter exists/
  );
  delete process.env.COMMERCE_FULFILLMENT_ENABLED;
});
