import { Problem } from "./http.js";
import { requireEnabled } from "./config.js";
import { createProdigiOrder } from "./prodigi.js";
import { createQpmnOrder } from "./qpmn.js";

export async function fulfillPaidCheckout({ session, item }) {
  requireEnabled("COMMERCE_FULFILLMENT_ENABLED", "Live fulfillment requires explicit approval.");
  if (session.payment_status !== "paid") throw new Problem(409, "Payment Not Complete", "Fulfillment requires a paid Stripe Checkout Session.");
  if (item.vendor === "prodigi") return createProdigiOrder({ session, item });
  if (item.vendor === "qpmn") return createQpmnOrder({ session, item });
  throw new Problem(422, "Unsupported Vendor", "No fulfillment adapter exists for this item.");
}
