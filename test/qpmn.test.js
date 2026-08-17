import test from "node:test";
import assert from "node:assert/strict";
import { createQpmnOrder, getQpmnOrder, mapQpmnStatus } from "../api/_lib/qpmn.js";
import { listNonTerminalQpmnOrderRecords, reconcileQpmnOrder } from "../api/_lib/qpmn-status.js";
import pollOrdersHandler from "../api/cron/poll-prodigi-orders.js";

const QPMN_ENV = [
  "QPMN_ENABLED",
  "QPMN_STORE_TOKEN",
  "QPMN_STORE_PRODUCT_ID_DECK"
];

function clearQpmnEnv() {
  for (const name of QPMN_ENV) delete process.env[name];
}

function configureQpmn() {
  process.env.QPMN_ENABLED = "true";
  process.env.QPMN_STORE_TOKEN = "store-token-test";
  process.env.QPMN_STORE_PRODUCT_ID_DECK = "64250001";
}

const recipient = {
  name: "Ada Lovelace",
  email: "ada@example.test",
  phone: "+15125550100",
  address: {
    line1: "1 Main St",
    line2: "Suite 2",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    country: "US"
  }
};

test("QPMN stays fail-closed unless the flag and every required credential are present", async () => {
  clearQpmnEnv();
  const neverFetch = async () => { throw new Error("fetch must never be reached"); };

  await assert.rejects(
    createQpmnOrder({ checkoutSessionId: "cs_gate", recipient, quantity: 1, resalePrice: "49.00", fetchImpl: neverFetch }),
    error => error?.status === 503 && /QPMN integration pending verification/i.test(error?.title)
  );

  process.env.QPMN_ENABLED = "true";
  process.env.QPMN_STORE_TOKEN = "store-token-test";
  await assert.rejects(
    getQpmnOrder("7001", { fetchImpl: neverFetch }),
    error => error?.status === 503 && /QPMN integration pending verification/i.test(error?.title)
  );
  clearQpmnEnv();
});

test("QPMN sends the verbatim Basic store token and the store-channel order shape", async () => {
  clearQpmnEnv();
  configureQpmn();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (options.method === "POST") {
      return { ok: true, status: 200, json: async () => ({ code: 200, data: { order: { id: 7001, number: "Q-7001", status: "processing", ignored: true } } }) };
    }
    return { ok: true, status: 200, json: async () => ({ code: 200, data: { order: { id: 7001, number: "Q-7001", status: "completed", ignored: true } } }) };
  };

  const created = await createQpmnOrder({
    checkoutSessionId: "cs_qpmn_1", recipient, quantity: 2, resalePrice: "98.00", fetchImpl
  });
  const fetched = await getQpmnOrder("7001", { fetchImpl });

  assert.deepEqual(created, { id: "7001", number: "Q-7001", status: "processing" });
  assert.deepEqual(fetched, { id: "7001", number: "Q-7001", status: "completed" });

  const orderCall = calls.find(call => call.options.method === "POST");
  assert.equal(orderCall.url, "https://partner.qpmarketnetwork.com/cgp-rest/api/store/orders");
  // The dashboard token is the finished credential — it must be used verbatim,
  // never base64-encoded a second time.
  assert.equal(orderCall.options.headers.Authorization, "Basic store-token-test");
  const wooAddress = {
    first_name: "Ada", last_name: "Lovelace", address_1: "1 Main St", address_2: "Suite 2",
    city: "Austin", state: "TX", postcode: "78701", country: "US",
    email: "ada@example.test", phone: "+15125550100"
  };
  assert.deepEqual(JSON.parse(orderCall.options.body), {
    thirdOrderId: "cs_qpmn_1",
    thirdOrderNumber: "cs_qpmn_1",
    items: [{
      thirdOrderItemId: "cs_qpmn_1-deck",
      qty: 2,
      unitPrice: "49.00",
      storeProductId: "64250001",
      properties: { "Size of Deck mode": "Up to 54 cards" }
    }],
    shippingMethod: "Standard",
    currency: "USD",
    status: "processing",
    deliveryAddress: wooAddress,
    billingAddress: wooAddress,
    orderTotals: [
      { name: "TAX", value: "0.00" },
      { name: "SHIPPING", value: "0.00" },
      { name: "SUBTOTAL", value: "98.00" },
      { name: "ORDER_TOTAL", value: "98.00" }
    ]
  });

  const getCall = calls.at(-1);
  assert.equal(getCall.url, "https://partner.qpmarketnetwork.com/cgp-rest/api/store/orders/7001");
  assert.equal(getCall.options.method, "GET");
  clearQpmnEnv();
});

test("QPMN surfaces the store API message when its body code is not 200", async () => {
  clearQpmnEnv();
  configureQpmn();
  const fetchImpl = async () => (
    { ok: true, status: 200, json: async () => ({ code: 422, message: "Store product not found" }) }
  );

  await assert.rejects(
    createQpmnOrder({ checkoutSessionId: "cs_bad", recipient, quantity: 1, resalePrice: "49.00", fetchImpl }),
    /Store product not found/
  );
  clearQpmnEnv();
});

test("QPMN statuses map to Airtable vocabulary and unknown values stay Placed", () => {
  assert.equal(mapQpmnStatus("pending"), "Placed");
  assert.equal(mapQpmnStatus("on-hold"), "Placed");
  assert.equal(mapQpmnStatus("processing"), "Printing");
  assert.equal(mapQpmnStatus("completed"), "Shipped");
  assert.equal(mapQpmnStatus("cancelled"), "Cancelled");
  assert.equal(mapQpmnStatus("refunded"), "Cancelled");
  assert.equal(mapQpmnStatus("failed"), "Failed / Needs Attention");
  assert.equal(mapQpmnStatus("future-vendor-status"), "Placed");
  assert.equal(mapQpmnStatus(undefined), "Placed");
});

test("QPMN reconciliation polls authenticated status and updates matching Airtable records", async () => {
  clearQpmnEnv();
  configureQpmn();
  process.env.AIRTABLE_TOKEN = "airtable-test";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_ORDERS_TABLE_ID = "orders-test";
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes("qpmarketnetwork.com")) {
      return { ok: true, status: 200, json: async () => ({ code: 200, data: { order: { id: 8123, number: "Q-8123", status: "completed" } } }) };
    }
    if (options.method === "GET") {
      return { ok: true, status: 200, json: async () => ({ records: [{ id: "rec-1", fields: { "QPMN Order Id": "8123" } }] }) };
    }
    return { ok: true, status: 200, json: async () => ({ records: [{ id: "rec-1", fields: { Status: "Shipped" } }] }) };
  };

  try {
    const result = await reconcileQpmnOrder("8123");
    assert.deepEqual(result, { qpmnOrderId: "8123", status: "Shipped", updated: 1 });
    const patchCall = calls.find(call => call.url.includes("api.airtable.com") && call.options.method === "PATCH");
    assert.deepEqual(JSON.parse(patchCall.options.body), {
      records: [{ id: "rec-1", fields: { Status: "Shipped" } }], typecast: false
    });

    const qpmnCall = calls.find(call => call.url.includes("qpmarketnetwork.com"));
    assert.equal(qpmnCall.options.headers.Authorization, "Basic store-token-test");

    calls.length = 0;
    await listNonTerminalQpmnOrderRecords();
    const listUrl = new URL(calls[0].url);
    assert.match(listUrl.searchParams.get("filterByFormula"), /\{QPMN Order Id\} != ""/);
    assert.match(listUrl.searchParams.get("filterByFormula"), /Failed \/ Needs Attention/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of [...QPMN_ENV, "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_ORDERS_TABLE_ID"]) delete process.env[name];
  }
});

test("the existing daily poll handler also sweeps enabled non-terminal QPMN orders", async () => {
  clearQpmnEnv();
  configureQpmn();
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  process.env.AIRTABLE_TOKEN = "airtable-test";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_ORDERS_TABLE_ID = "orders-test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url.includes("qpmarketnetwork.com")) {
      return { ok: true, status: 200, json: async () => ({ code: 200, data: { order: { id: 9001, number: "Q-9001", status: "processing" } } }) };
    }
    if (options.method === "PATCH") {
      return { ok: true, status: 200, json: async () => ({ records: [{ id: "rec-qpmn" }] }) };
    }
    const formula = new URL(url).searchParams.get("filterByFormula") || "";
    if (formula.includes("Prodigi Order Id")) {
      return { ok: true, status: 200, json: async () => ({ records: [] }) };
    }
    return {
      ok: true, status: 200,
      json: async () => ({ records: [{ id: "rec-qpmn", fields: { "QPMN Order Id": "9001", Status: "Placed" } }] })
    };
  };
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.setHeader = (key, value) => { res.headers[key] = value; };
  res.end = payload => { res.body = payload ? JSON.parse(payload) : undefined; };

  try {
    await pollOrdersHandler({ method: "GET", url: "/api/cron/poll-prodigi-orders" }, res);
    assert.deepEqual(res.body, { ok: true, checked: 1, updated: 1 });
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of [...QPMN_ENV, "COMMERCE_FULFILLMENT_ENABLED", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_ORDERS_TABLE_ID"]) delete process.env[name];
  }
});
