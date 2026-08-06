import { test } from "node:test";
import assert from "node:assert/strict";
import { deckOrder, galleryOrder, buildAirtableFields } from "../api/order-intent.js";

test("gallery Framed requires frameColor", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard", format:"Framed",
    size:"12x16", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("gallery Print without frameColor passes and maps fields", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard", format:"Print",
    size:"20x28", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, true);
  const f = buildAirtableFields(r.data, "TBH-G-20260806-TEST");
  assert.equal(f["Size"], "20x28");
  assert.equal(f["Status"], "New");
  assert.match(f["Order ID"], /Leopard/);
});
test("deck order maps Variant and Quantity", () => {
  const r = deckOrder.safeParse({ product:"deck", quantity:2, variant:"Standard Deck",
    customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, true);
  const f = buildAirtableFields(r.data, "TBH-D-20260806-TEST");
  assert.equal(f["Quantity"], 2);
});
test("frameColor only accepts launch colours", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard", format:"Framed",
    frameColor:"White", size:"12x16", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
