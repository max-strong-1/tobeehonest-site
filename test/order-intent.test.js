import { test } from "node:test";
import assert from "node:assert/strict";
import { deckOrder, galleryOrder, commissionRequest, hiveSignup, buildAirtableFields } from "../api/order-intent.js";

test("gallery order requires frameColor", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    size:"8x12", mat:"White", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("gallery order requires mat", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    size:"8x12", frameColor:"Black", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("gallery order with mat + frameColor passes and maps fields", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    size:"16x24", frameColor:"Antique Gold", mat:"White",
    customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, true);
  const f = buildAirtableFields(r.data, "TBH-G-20260806-TEST");
  assert.equal(f["Size"], "16x24");
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
    frameColor:"White", mat:"White", size:"8x12", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("mat only accepts No mat, White or Black", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    frameColor:"Black", mat:"Gold", size:"8x12", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
/* The Gallery hangs the work bare, so unframed and unmounted are orderable outcomes,
   and Format has to follow the choice instead of always saying "Framed". */
test("bare print (No frame / No mat) is a valid order and maps Format", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    size:"12x18", frameColor:"No frame", mat:"No mat",
    customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, true);
  const f = buildAirtableFields(r.data, "TBH-G-20260807-TEST");
  assert.equal(f["Format"], "Print only");
  assert.equal(f["Frame Color"], "No frame");
  assert.equal(f["Mat Color"], "No mat");
});
test("walnut Brown is an accepted frame colour and still ships Framed", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard",
    size:"8x12", frameColor:"Brown", mat:"White",
    customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, true);
  assert.equal(buildAirtableFields(r.data, "TBH-G-20260807-TEST")["Format"], "Framed");
});
test("gallery order rejects a format field being sent at all (strict, no print-alone)", () => {
  const r = galleryOrder.safeParse({ product:"gallery", artwork:"Leopard", format:"Framed",
    frameColor:"Black", mat:"White", size:"8x12", customerName:"A", customerEmail:"a@b.co", shipTo:"1 Way" });
  assert.equal(r.success, false);
});

/* Make It Yours and the hive: enquiry-shaped, no price, no address. */
test("commission enquiry validates and maps", () => {
  const r = commissionRequest.safeParse({ product:"commission",
    customerName:"A", customerEmail:"a@b.co", subject:"my dog",
    photoDescription:"asleep in the sun", size:"12x18",
    timeline:"No rush", budget:"Not sure yet" });
  assert.equal(r.success, true);
  const f = buildAirtableFields(r.data, "TBH-C-20260807-TEST");
  assert.equal(f["Subject"], "my dog");
  assert.equal(f["Status"], "New");
});
test("commission rejects a shipping address (enquiry, not an order)", () => {
  const r = commissionRequest.safeParse({ product:"commission",
    customerName:"A", customerEmail:"a@b.co", subject:"x", photoDescription:"y",
    size:"12x18", timeline:"No rush", budget:"Not sure yet", shipTo:"1 Way" });
  assert.equal(r.success, false);
});
test("hive signup takes an email and nothing else it doesn't know", () => {
  assert.equal(hiveSignup.safeParse({ product:"hive", customerEmail:"a@b.co" }).success, true);
  assert.equal(hiveSignup.safeParse({ product:"hive", customerEmail:"nope" }).success, false);
  assert.equal(hiveSignup.safeParse({ product:"hive", customerEmail:"a@b.co", surprise:1 }).success, false);
});
