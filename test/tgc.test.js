import test from "node:test";
import assert from "node:assert/strict";
import { chooseShippingMethod, getTgcReceipt, TGC_ID_REGEX, createTgcOrder } from "../api/_lib/tgc.js";

/* The single most dangerous default in this integration: "Will Call" is a real TGC
   shipping option that costs $0.00 and means the customer drives to Madison,
   Wisconsin to collect. Any cheapest-wins selection picks it every time and the
   order looks fulfilled while nothing ever ships. */
test("shipping selection never picks Will Call, even though it is free", () => {
  const options = {
    "Will Call": { cost: "0.00", handling_fee: "0.00" },
    "UPS Ground": { cost: "8.42", handling_fee: "1.00" },
    "USPS Ground Advantage": { cost: "5.90", handling_fee: "1.00" },
    "UPS Next Day Air": { cost: "48.10", handling_fee: "1.00" }
  };
  const chosen = chooseShippingMethod(options);
  assert.equal(chosen.name, "USPS Ground Advantage");
  assert.equal(chosen.total, 6.9);
});

test("shipping selection adds the handling fee, not just the cost", () => {
  /* Cheapest `cost` is not cheapest total — B wins on cost and loses on handling. */
  const chosen = chooseShippingMethod({
    "Carrier A": { cost: "6.00", handling_fee: "1.00" },
    "Carrier B": { cost: "5.50", handling_fee: "3.00" }
  });
  assert.equal(chosen.name, "Carrier A");
});

test("no deliverable option is an error, not a silent Will Call fallback", () => {
  assert.throws(() => chooseShippingMethod({ "Will Call": { cost: "0.00" } }), /no deliverable shipping option/i);
  assert.throws(() => chooseShippingMethod({}), /no deliverable shipping option/i);
});

test("receipt id shape is validated before any network call", async () => {
  const boom = async () => { throw new Error("fetch must never be reached"); };
  for (const bad of ["", "../../etc/passwd", "abc", "id with spaces", "a".repeat(65)]) {
    await assert.rejects(getTgcReceipt(bad, { fetchImpl: boom }), /not a recognized shape/);
  }
  assert.ok(TGC_ID_REGEX.test("563C57FE-47F0-11E2-836F"));
});

/* TGC has no sandbox, so an accidental call in a non-production environment places a
   real, paid order. The enable flag is the only thing standing between a stray test
   run and a printed deck. */
test("order creation is refused outright when fulfilment is not enabled", async () => {
  delete process.env.COMMERCE_FULFILLMENT_ENABLED;
  const boom = async () => { throw new Error("fetch must never be reached"); };
  await assert.rejects(
    createTgcOrder({ session: { id: "cs_x" }, item: { vendorSku: "sku", quantity: 1 }, fetchImpl: boom }),
    /not enabled/i
  );
});

test("a missing sku fails before login, not midway through the cart", async () => {
  process.env.COMMERCE_FULFILLMENT_ENABLED = "true";
  const boom = async () => { throw new Error("fetch must never be reached"); };
  await assert.rejects(
    createTgcOrder({ session: { id: "cs_x" }, item: { quantity: 1 }, fetchImpl: boom }),
    /No Game Crafter sku/
  );
  delete process.env.COMMERCE_FULFILLMENT_ENABLED;
});
