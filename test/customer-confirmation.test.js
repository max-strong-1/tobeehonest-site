import test from "node:test";
import assert from "node:assert/strict";
import { sendCustomerConfirmation, sendPaidOrderAlert, sendFulfillmentFailureAlert } from "../api/_lib/notify.js";

function baseSession(overrides = {}) {
  return {
    id: "cs_test_123",
    amount_total: 8400,
    currency: "usd",
    customer_details: { email: "buyer@example.test", name: "Buyer Example" },
    shipping_details: {
      name: "Buyer Example",
      address: {
        line1: "1 Main St",
        line2: "Apt 4",
        city: "Austin",
        state: "TX",
        postal_code: "78701",
        country: "US"
      }
    },
    ...overrides
  };
}

const item = { quantity: 2, productName: "Leopard Stare (Framed Art, 12x16)" };

test("sends the customer a confirmation with correct from/reply_to/subject and body", async () => {
  process.env.RESEND_API_KEY = "key-test";
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ id: "email_1" }) };
  };
  try {
    const session = baseSession();
    const result = await sendCustomerConfirmation({ session, item });
    assert.equal(result.skipped, false);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].options.body);
    assert.equal(payload.from, "To Bee Honest <kel@4manai.com>");
    assert.deepEqual(payload.to, ["buyer@example.test"]);
    assert.equal(payload.reply_to, "nicolas@tobeehonest.com");
    assert.equal(payload.subject, "Your To Bee Honest order is confirmed");
    assert.match(payload.text, /Leopard Stare \(Framed Art, 12x16\)/);
    assert.match(payload.text, /Quantity: 2/);
    assert.match(payload.text, /\$84\.00 USD/);
    assert.match(payload.text, /Austin/);
    assert.match(payload.text, /cs_test_123/);
    assert.match(payload.text, /made to order/i);
    assert.match(payload.text, /— Nicolas, To Bee Honest/);

    // capture rendered body for the report
    globalThis.__RENDERED_CONFIRMATION_BODY__ = payload.text;
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
  }
});

test("missing customer email is skipped and fetch is never called", async () => {
  process.env.RESEND_API_KEY = "key-test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("fetch must not be called"); };
  try {
    const session = baseSession({ customer_details: {} });
    const result = await sendCustomerConfirmation({ session, item });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "no-email");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
  }
});

test("RESEND_API_KEY unset skips and never calls fetch", async () => {
  delete process.env.RESEND_API_KEY;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("fetch must not be called"); };
  try {
    const session = baseSession();
    const result = await sendCustomerConfirmation({ session, item });
    assert.equal(result.skipped, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a Resend 500 resolves without throwing and reports ok:false", async () => {
  process.env.RESEND_API_KEY = "key-test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => "server error" });
  try {
    const session = baseSession();
    const result = await sendCustomerConfirmation({ session, item });
    assert.equal(result.skipped, false);
    assert.equal(result.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
  }
});

test("paid-order and fulfillment-failure alerts go to operators with distinct stable keys", async () => {
  process.env.RESEND_API_KEY = "key-test";
  process.env.ORDER_ALERT_TO = "owner@example.test,operator@example.test";
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    calls.push({ headers: options.headers, body: JSON.parse(options.body) });
    return { ok: true };
  };
  try {
    const session = baseSession();
    const order = { ...item, vendor: "prodigi" };
    await sendPaidOrderAlert({ session, item: order });
    await sendFulfillmentFailureAlert({
      session, item: order, error: { operatorDetail: "PaymentFailed: No card details" }
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].body.to, ["owner@example.test", "operator@example.test"]);
    assert.equal(calls[0].headers["Idempotency-Key"], "paid-order/cs_test_123");
    assert.match(calls[0].body.text, /Fulfillment has not yet been confirmed/);
    assert.equal(calls[1].headers["Idempotency-Key"], "fulfillment-failed/cs_test_123");
    assert.match(calls[1].body.subject, /ACTION REQUIRED/);
    assert.match(calls[1].body.text, /PaymentFailed: No card details/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.ORDER_ALERT_TO;
  }
});

test("operator alert fallback uses Nicolas's known address when production override is absent", async () => {
  process.env.RESEND_API_KEY = "key-test";
  delete process.env.ORDER_ALERT_TO;
  const originalFetch = globalThis.fetch;
  let recipients;
  globalThis.fetch = async (_url, options) => {
    recipients = JSON.parse(options.body).to;
    return { ok: true };
  };
  try {
    await sendPaidOrderAlert({ session: baseSession(), item: { ...item, vendor: "prodigi" } });
    assert.deepEqual(recipients, ["bettinger.nicolas@gmail.com", "kel@4manai.com"]);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
  }
});
