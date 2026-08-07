import { Problem } from "./http.js";
import { requireEnv, vendorMode } from "./config.js";

export function prodigiBaseUrl(mode = vendorMode()) {
  return mode === "live" ? "https://api.prodigi.com" : "https://api.sandbox.prodigi.com";
}

export async function createProdigiOrder({ session, item, fetchImpl = fetch }) {
  const apiKey = requireEnv("PRODIGI_API_KEY");
  const assetBase = requireEnv("PRODIGI_ASSET_BASE_URL").replace(/\/$/, "");
  const shipping = session.shipping_details || session.collected_information?.shipping_details;
  if (!shipping?.address || !shipping?.name) throw new Problem(422, "Shipping Address Missing", "Stripe did not return a complete shipping address.");
  const address = shipping.address;
  const payload = {
    idempotencyKey: `stripe-${session.id}`,
    merchantReference: session.id,
    shippingMethod: "Standard",
    recipient: {
      name: shipping.name,
      email: session.customer_details?.email,
      address: {
        line1: address.line1,
        ...(address.line2 ? { line2: address.line2 } : {}),
        postalOrZipCode: address.postal_code,
        countryCode: address.country,
        townOrCity: address.city,
        ...(address.state ? { stateOrCounty: address.state } : {})
      }
    },
    items: [{
      sku: item.vendorSku,
      copies: item.quantity,
      sizing: "fillPrintArea",
      assets: [{ printArea: "default", url: `${assetBase}/${encodeURIComponent(item.metadata.artworkId)}.jpg` }]
    }]
  };
  const response = await fetchImpl(`${prodigiBaseUrl()}/v4.0/Orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Problem(502, "Fulfillment Provider Error", "Prodigi did not accept the order.");
  return result;
}

/* Strict Prodigi order id shape: "ord_" followed by digits (matches every id in
   the reference docs and callback samples, e.g. "ord_1469466"). Anything else is
   rejected before we ever build a URL or make a request with it. */
export const PRODIGI_ORDER_ID_REGEX = /^ord_[0-9]+$/;

/**
 * Authenticated GET of a single order's current state, straight from Prodigi.
 * This is the only source of truth for order status in this codebase — never
 * trust a status/stage field read out of an inbound webhook body instead.
 */
export async function getProdigiOrder(orderId, { fetchImpl = fetch } = {}) {
  if (!PRODIGI_ORDER_ID_REGEX.test(orderId)) {
    throw new Problem(400, "Invalid Order Id", "The Prodigi order id is not a recognized shape.");
  }
  const apiKey = requireEnv("PRODIGI_API_KEY");
  const response = await fetchImpl(`${prodigiBaseUrl()}/v4.0/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: { "X-API-Key": apiKey }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Problem(502, "Fulfillment Provider Error", "Prodigi did not return order status.");
  return result;
}
