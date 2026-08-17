/* QPMN order-shape probe: tries payload variants (closest-to-sample first),
 * stops at the first success. Test orders are free until synced — choose
 * "bank transfer" in the dashboard sync step (Viviane 8/12).
 * Run: node scripts/qpmn-test-order.mjs
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const env = readFileSync(`${homedir()}/.foreman-secrets/env`, "utf8");
const grab = (name) => env.split("\n").find(l => l.includes(name))?.split("=").slice(1).join("=").replace(/["\s]/g, "");
const TOKEN = grab("QPMN_TBH_STORE_TOKEN");
const PRODUCT = grab("QPMN_TBH_STORE_PRODUCT_ID_DECK");

const address = {
  country: "US", state: "FL", city: "Panama City Beach",
  address_1: "2809 Lagoon Knoll Dr", address_2: "", postcode: "32408",
  first_name: "Kel", last_name: "Mewbourne",
  phone: "+15618319310", mobile: "+15618319310",
  email: "kel@4manai.com", company: ""
};

function payload(variant, id) {
  const base = {
    thirdOrderId: id,
    thirdOrderNumber: id,
    items: [{
      thirdOrderItemId: Number(String(Date.now()).slice(-12)),
      qty: 1,
      unitPrice: "49.00",
      storeProductId: PRODUCT,
      properties: {
        "front design mode": "different",
        "back design mode": "same",
        "Size of Deck mode": "Up to 54 cards"
      }
    }],
    shippingMethod: "Standard",
    paymentMethod: "PayPal",
    currency: "USD",
    status: "processing",
    deliveryAddress: { ...address },
    billingAddress: { ...address },
    orderTotals: [
      { name: "TAX", value: "0.00" },
      { name: "SHIPPING", value: "0.00" },
      { name: "SUBTOTAL", value: "49.00" },
      { name: "ORDER_TOTAL", value: "49.00" }
    ]
  };
  if (variant === "no-properties") delete base.items[0].properties;
  if (variant === "same-fronts") base.items[0].properties["front design mode"] = "same";
  if (variant === "string-item-id") base.items[0].thirdOrderItemId = `${id}-1`;
  return base;
}

const variants = ["sample-faithful", "no-properties", "same-fronts", "string-item-id"];
for (const variant of variants) {
  const id = `tbhtest${String(Date.now()).slice(-9)}`;
  const response = await fetch("https://partner.qpmarketnetwork.com/cgp-rest/api/store/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload(variant, id))
  });
  const body = await response.text();
  console.log(variant, "->", response.status, body.slice(0, 300));
  if (response.ok && !body.includes('"success":false')) {
    console.log("SUCCESS with variant:", variant, "order:", id);
    console.log("Check QPMN dashboard -> clients order; sync with BANK TRANSFER (no payment).");
    break;
  }
}
