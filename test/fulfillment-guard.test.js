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
