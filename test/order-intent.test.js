import { test } from "node:test";
import assert from "node:assert/strict";
import { deckOrder, galleryOrder, buildAirtableFields } from "../api/order-intent.js";

test("gallery order requires frameColor", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    size:"12x16", mat:"White", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("gallery order requires mat", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    size:"12x16", frameColor:"Black", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("gallery order with mat + frameColor passes and maps fields", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    size:"20x28", frameColor:"Antique Gold", mat:"White",
    customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, true);
  const f = buildAirtableFields(r.data, "TBH-G-20260806-TEST");
  assert.equal(f["Size"], "20x28");
  assert.equal(f["Status"], "New");
  assert.equal(f["Format"], "Framed");
  assert.equal(f["Mat Color"], "White");
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
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    frameColor:"White", mat:"White", size:"12x16", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("mat only accepts White or Black", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    frameColor:"Black", mat:"Gold", size:"12x16", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("gallery order rejects a format field being sent at all (strict, no print-alone)", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard", format:"Framed",
    frameColor:"Black", mat:"White", size:"12x16", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
