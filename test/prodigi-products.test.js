import test from "node:test";
import assert from "node:assert/strict";
import { parseCheckoutInput, resolveCheckoutItem } from "../api/_lib/catalog.js";
import { createProdigiOrder } from "../api/_lib/prodigi.js";

/* Prodigi prints four things for To Bee Honest: framed art, bare prints, jigsaw
   puzzles and the coloring book. Each has a different required item shape, and
   every mismatch is only discovered AFTER the customer has paid — so the payload
   for each is asserted here rather than trusted. */

const SESSION = {
  id: "cs_test",
  customer_details: { email: "buyer@example.test" },
  shipping_details: { name: "Buyer", address: { line1: "1 Main St", city: "Austin", state: "TX", postal_code: "78701", country: "US" } }
};

function capturingFetch(store) {
  return async (url, options) => {
    store.url = url;
    store.body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ order: { id: "ord_1" } }) };
  };
}

async function orderItemFor(item) {
  process.env.PRODIGI_API_KEY = "secret-test-key";
  process.env.PRODIGI_ASSET_BASE_URL = "https://assets.example.test";
  const store = {};
  await createProdigiOrder({ session: SESSION, item, fetchImpl: capturingFetch(store) });
  return store.body.items[0];
}

// --- Catalog validation --------------------------------------------------

test("a print needs an artwork and a print size, not a frame size", () => {
  assert.throws(() => parseCheckoutInput({ product: "print", artworkId: "leopard-stare", quantity: 1 }), /invalid/i);
  assert.throws(() => parseCheckoutInput({ product: "print", artworkId: "leopard-stare", size: "12x16", quantity: 1 }), /invalid/i);
  assert.doesNotThrow(() => parseCheckoutInput({ product: "print", artworkId: "leopard-stare", size: "12x18", quantity: 1 }));
});

test("a puzzle needs an artwork and a supported piece count", () => {
  assert.throws(() => parseCheckoutInput({ product: "puzzle", artworkId: "leopard-stare", quantity: 1 }), /invalid/i);
  assert.throws(() => parseCheckoutInput({ product: "puzzle", artworkId: "leopard-stare", pieces: "17", quantity: 1 }), /invalid/i);
  assert.doesNotThrow(() => parseCheckoutInput({ product: "puzzle", artworkId: "leopard-stare", pieces: "30", quantity: 1 }));
  assert.doesNotThrow(() => parseCheckoutInput({ product: "puzzle", artworkId: "leopard-stare", pieces: "500", quantity: 1 }));
});

test("the coloring book takes no options", () => {
  assert.doesNotThrow(() => parseCheckoutInput({ product: "coloring-book", quantity: 1 }));
  assert.throws(() => parseCheckoutInput({ product: "coloring-book", artworkId: "leopard-stare", quantity: 1 }), /invalid/i);
});

test("unapproved artwork is refused for every artwork-bearing product", () => {
  process.env.STRIPE_PRICE_PRINT_12X18 = "price_print";
  process.env.PRODIGI_SKU_PRINT_12X18 = "sku_print";
  for (const input of [
    { product: "print", artworkId: "not-a-real-piece", size: "12x18", quantity: 1 },
    { product: "puzzle", artworkId: "not-a-real-piece", pieces: "500", quantity: 1 }
  ]) {
    assert.throws(() => resolveCheckoutItem(parseCheckoutInput(input)), /not in the approved gallery catalog/i);
  }
});

test("a product with no configured price or SKU refuses to sell", () => {
  delete process.env.STRIPE_PRICE_PUZZLE_1000;
  delete process.env.PRODIGI_SKU_PUZZLE_1000;
  assert.throws(
    () => resolveCheckoutItem(parseCheckoutInput({ product: "puzzle", artworkId: "leopard-stare", pieces: "1000", quantity: 1 })),
    /has not been approved and configured/i
  );
});

test("the coloring book reads as coming soon until it is switched on", () => {
  delete process.env.STRIPE_PRICE_COLORING_BOOK;
  delete process.env.PRODIGI_SKU_COLORING_BOOK;
  assert.throws(
    () => resolveCheckoutItem(parseCheckoutInput({ product: "coloring-book", quantity: 1 })),
    /coming soon/i
  );
});

test("configured products resolve to Prodigi with their own identifiers", () => {
  process.env.STRIPE_PRICE_PRINT_16X24 = "price_print_16x24";
  process.env.PRODIGI_SKU_PRINT_16X24 = "sku_print_16x24";
  process.env.STRIPE_PRICE_PUZZLE_500 = "price_puzzle_500";
  process.env.PRODIGI_SKU_PUZZLE_500 = "sku_puzzle_500";
  process.env.STRIPE_PRICE_COLORING_BOOK = "price_book";
  process.env.PRODIGI_SKU_COLORING_BOOK = "sku_book";

  const print = resolveCheckoutItem(parseCheckoutInput({ product: "print", artworkId: "milan-spa", size: "16x24", quantity: 1 }));
  assert.equal(print.vendor, "prodigi");
  assert.equal(print.vendorSku, "sku_print_16x24");

  const puzzle = resolveCheckoutItem(parseCheckoutInput({ product: "puzzle", artworkId: "milan-spa", pieces: "500", quantity: 1 }));
  assert.equal(puzzle.vendorSku, "sku_puzzle_500");
  assert.equal(puzzle.metadata.pieces, "500");

  const book = resolveCheckoutItem(parseCheckoutInput({ product: "coloring-book", quantity: 1 }));
  assert.equal(book.vendorSku, "sku_book");
});

// --- Order payload per product ------------------------------------------

test("a bare print sends no frame attribute", async () => {
  const built = await orderItemFor({ vendorSku: "sku_print", quantity: 1, metadata: { product: "print", artworkId: "milan-spa", size: "16x24" } });
  assert.equal(built.assets[0].url, "https://assets.example.test/milan-spa.jpg");
  assert.equal(built.attributes, undefined, "a print SKU rejects the frame colour attribute");
});

test("a puzzle fills both required print areas and names its size", async () => {
  /* JIGSAW-PUZZLE-500 has no `default` area: `jigsaw` and `lid` are both
     required:true, so a lid must always be sent or Prodigi rejects the order. */
  delete process.env.PRODIGI_PUZZLE_LID_ASSET_URL;
  const built = await orderItemFor({ vendorSku: "sku_puzzle", quantity: 1, metadata: { product: "puzzle", artworkId: "milan-spa", pieces: "500" } });
  assert.deepEqual(built.assets.map(a => a.printArea), ["jigsaw", "lid"]);
  assert.equal(built.assets[1].url, "https://assets.example.test/milan-spa.jpg", "lid falls back to the artwork");
  assert.equal(built.attributes.size, "500 pieces");

  process.env.PRODIGI_PUZZLE_LID_ASSET_URL = "https://assets.example.test/lid.jpg";
  const branded = await orderItemFor({ vendorSku: "sku_puzzle", quantity: 1, metadata: { product: "puzzle", artworkId: "milan-spa", pieces: "1000" } });
  assert.equal(branded.assets[1].url, "https://assets.example.test/lid.jpg");
  assert.equal(branded.attributes.size, "1000 pieces");
  delete process.env.PRODIGI_PUZZLE_LID_ASSET_URL;
});

test("the coloring book sends its page count and is never cropped", async () => {
  process.env.PRODIGI_COLORING_BOOK_ASSET_URL = "https://assets.example.test/coloring-book.pdf";
  process.env.PRODIGI_COLORING_BOOK_PAGE_COUNT = "32";
  const built = await orderItemFor({ vendorSku: "sku_book", quantity: 1, metadata: { product: "coloring-book" } });
  assert.equal(built.sizing, "fitPrintArea");
  assert.equal(built.assets[0].pageCount, 32);
  assert.equal(built.assets[0].url, "https://assets.example.test/coloring-book.pdf");
});

test("a non-numeric book page count fails before the order is sent", async () => {
  process.env.PRODIGI_COLORING_BOOK_ASSET_URL = "https://assets.example.test/coloring-book.pdf";
  process.env.PRODIGI_COLORING_BOOK_PAGE_COUNT = "lots";
  await assert.rejects(
    () => orderItemFor({ vendorSku: "sku_book", quantity: 1, metadata: { product: "coloring-book" } }),
    /PAGE_COUNT is not a positive whole number/i
  );
  process.env.PRODIGI_COLORING_BOOK_PAGE_COUNT = "32";
});

test("framed art still sends its frame colour", async () => {
  const built = await orderItemFor({ vendorSku: "sku_frame", quantity: 1, metadata: { product: "framed-art", artworkId: "milan-spa", size: "12x16", frameColor: "gold" } });
  assert.equal(built.attributes.color, "gold");
  assert.equal(built.sizing, "fillPrintArea");
});
