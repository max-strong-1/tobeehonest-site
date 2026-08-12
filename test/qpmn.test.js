import test from "node:test";
import assert from "node:assert/strict";
import { createQpmnOrder, getQpmnOrder, mapQpmnStatus } from "../api/_lib/qpmn.js";
import { listNonTerminalQpmnOrderRecords, reconcileQpmnOrder } from "../api/_lib/qpmn-status.js";
import pollOrdersHandler from "../api/cron/poll-prodigi-orders.js";

const QPMN_ENV = [
  "QPMN_ENABLED",
  "QPMN_CLIENT_ID",
  "QPMN_REFRESH_TOKEN",
  "QPMN_PRODUCT_ID_DECK",
  "QPMN_DESIGN_ID_DECK"
];

function clearQpmnEnv() {
  for (const name of QPMN_ENV) delete process.env[name];
}

function configureQpmn() {
  process.env.QPMN_ENABLED = "true";
  process.env.QPMN_REFRESH_TOKEN = "refresh-test";
  process.env.QPMN_PRODUCT_ID_DECK = "321";
  process.env.QPMN_DESIGN_ID_DECK = "654";
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
  process.env.QPMN_REFRESH_TOKEN = "refresh-test";
  process.env.QPMN_PRODUCT_ID_DECK = "321";
  await assert.rejects(
    getQpmnOrder("7001", { fetchImpl: neverFetch }),
    error => error?.status === 503 && /QPMN integration pending verification/i.test(error?.title)
  );
  clearQpmnEnv();
});

test("QPMN refreshes OAuth once, sends exact plugin keys, and normalizes create/get responses", async () => {
  clearQpmnEnv();
  configureQpmn();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/oauth/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "access-test", expires_in: 3600 }) };
    }
    if (options.method === "POST") {
      return { ok: true, status: 200, json: async () => ({ code: 200, data: { order: { id: 7001, number: "Q-7001", status: "processing", ignored: true } } }) };
    }
    return { ok: true, status: 200, json: async () => ({ code: 200, data: { order: { id: 7001, number: "Q-7001", status: "completed", ignored: true } } }) };
  };

  const created = await createQpmnOrder({
    checkoutSessionId: "cs_qpmn_1", recipient, quantity: 2, resalePrice: "49.00", fetchImpl
  });
  const fetched = await getQpmnOrder("7001", { fetchImpl });

  assert.deepEqual(created, { id: 7001, number: "Q-7001", status: "processing" });
  assert.deepEqual(fetched, { id: 7001, number: "Q-7001", status: "completed" });
  assert.equal(calls.filter(call => call.url.endsWith("/oauth/token")).length, 1);

  const tokenBody = new URLSearchParams(calls[0].options.body);
  assert.deepEqual(Object.fromEntries(tokenBody), {
    grant_type: "refresh_token",
    refresh_token: "refresh-test",
    client_id: "a0PBL4JUSJQgDEoGw6JQDARvLhJ1HxxKBfyQVvgj"
  });

  const orderCall = calls.find(call => call.options.method === "POST" && call.url.includes("/partner/order"));
  assert.equal(orderCall.url, "https://www.qpmarketnetwork.com/wp-json/qpmn-api/v1/partner/order");
  assert.equal(orderCall.options.headers.Authorization, "Bearer access-test");
  assert.deepEqual(JSON.parse(orderCall.options.body), {
    set_paid: false,
    line_items: [{
      product_id: "321",
      qty: 2,
      meta_data: [
        { key: "qpmn_partner_resale_price", value: "49.00" },
        { key: "qpmn_partner_order_item_id", value: "cs_qpmn_1-deck" },
        { key: "qpmn_partner_order_item_qty", value: 2 },
        { key: "qpmn_partner_design_id", value: "654" }
      ]
    }],
    billing: {
      first_name: "Ada", last_name: "Lovelace", address_1: "1 Main St", address_2: "Suite 2",
      city: "Austin", state: "TX", postcode: "78701", country: "US",
      email: "ada@example.test", phone: "+15125550100"
    },
    shipping: {
      first_name: "Ada", last_name: "Lovelace", address_1: "1 Main St", address_2: "Suite 2",
      city: "Austin", state: "TX", postcode: "78701", country: "US",
      email: "ada@example.test", phone: "+15125550100"
    },
    meta_data: [
      { key: "qpmn_partner_store_url", value: "https://tobeehonest.com" },
      { key: "qpmn_partner_order_id", value: "cs_qpmn_1" },
      { key: "qpmn_partner_order_currency", value: "USD" }
    ]
  });

  const getCall = calls.at(-1);
  assert.equal(getCall.url, "https://www.qpmarketnetwork.com/wp-json/qpmn-api/v1/partner/order/7001");
  assert.equal(getCall.options.method, "GET");
  clearQpmnEnv();
});

test("QPMN surfaces the partner API message when its body code is not 200", async () => {
  clearQpmnEnv();
  configureQpmn();
  process.env.QPMN_CLIENT_ID = "client-error-test";
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) return { ok: true, status: 200, json: async () => ({ access_token: "short-lived", expires_in: 30 }) };
    return { ok: true, status: 200, json: async () => ({ code: 422, message: "Design does not belong to product" }) };
  };

  await assert.rejects(
    createQpmnOrder({ checkoutSessionId: "cs_bad", recipient, quantity: 1, resalePrice: "49.00", fetchImpl }),
    /Design does not belong to product/
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
  process.env.QPMN_CLIENT_ID = "client-reconcile-test";
  process.env.AIRTABLE_TOKEN = "airtable-test";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_ORDERS_TABLE_ID = "orders-test";
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/oauth/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "reconcile-access", expires_in: 3600 }) };
    }
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
  process.env.QPMN_CLIENT_ID = "client-cron-test";
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  process.env.AIRTABLE_TOKEN = "airtable-test";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_ORDERS_TABLE_ID = "orders-test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith("/oauth/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "cron-access", expires_in: 3600 }) };
    }
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
