import { Problem } from "./http.js";
import { requireEnv, vendorMode } from "./config.js";

export function prodigiBaseUrl(mode = vendorMode()) {
  return mode === "live" ? "https://api.prodigi.com" : "https://api.sandbox.prodigi.com";
}

/* Prodigi sells all eight Classic Frame finishes under ONE sku — the finish is an
   order ATTRIBUTE, not a separate product. Omitting it is not a cosmetic default:
   the order is rejected outright with 400 ValidationFailed /
   MissingRequiredAttributes. Verified against the sandbox on 2026-08-09, which
   returned exactly this list as `validValues`. */
const PRODIGI_FRAME_COLORS = new Set([
  "white", "silver", "natural", "light grey", "gold", "dark grey", "brown", "black"
]);

/* The catalog speaks in business terms ("gold" / "second"); Prodigi speaks in
   finishes. "second" is the still-unapproved second frame colour, held in an env
   var so it can be chosen without a deploy. Both paths are checked against
   Prodigi's own list here rather than at the API boundary, because an invalid
   colour fails at order-creation time — which is AFTER the customer has paid. */
function frameColorAttribute(metadata) {
  const raw = metadata?.frameColor === "second"
    ? requireEnv("PRODIGI_SECOND_FRAME_COLOR")
    : metadata?.frameColor;
  const color = String(raw ?? "").trim().toLowerCase();
  if (!PRODIGI_FRAME_COLORS.has(color)) {
    throw new Problem(500, "Invalid Frame Color",
      `"${color}" is not one of Prodigi's frame finishes.`,
      "https://tobeehonest.com/problems/invalid-frame-color");
  }
  return color;
}

export async function createProdigiOrder({ session, item, shippingMethod = "Standard", fetchImpl = fetch }) {
  const apiKey = requireEnv("PRODIGI_API_KEY");
  const assetBase = requireEnv("PRODIGI_ASSET_BASE_URL").replace(/\/$/, "");
  const shipping = session.shipping_details || session.collected_information?.shipping_details;
  if (!shipping?.address || !shipping?.name) throw new Problem(422, "Shipping Address Missing", "Stripe did not return a complete shipping address.");
  const address = shipping.address;
  const orderItem = item.metadata?.product === "puzzle"
    ? {
        sku: item.vendorSku,
        copies: item.quantity,
        sizing: "fillPrintArea",
        attributes: { size: "1000 pieces" },
        assets: [
          {
            printArea: "jigsaw",
            url: `${assetBase}/sun-bird-jigsaw-prodigi-1000-v1.png`
          },
          {
            printArea: "lid",
            url: `${assetBase}/sun-bird-lid-prodigi-1000-v1.png`
          }
        ]
      }
    : {
        sku: item.vendorSku,
        copies: item.quantity,
        /* 12x18 prints ship in the 16x24 mounted frame (Prodigi has no 16x22):
         * its print area is 12x20, so fitPrintArea letterboxes the art with 1"
         * of white top/bottom that reads as part of the snow-white mat. */
        sizing: item.sizing || "fillPrintArea",
        attributes: { color: frameColorAttribute(item.metadata) },
        assets: [{ printArea: "default", url: `${assetBase}/${encodeURIComponent(item.metadata.artworkId)}.jpg` }]
      };
  const payload = {
    idempotencyKey: `stripe-${session.id}`,
    merchantReference: session.id,
    shippingMethod,
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
    items: [orderItem]
  };
  const response = await fetchImpl(`${prodigiBaseUrl()}/v4.0/Orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  /* Log Prodigi's own failure body before discarding it. The customer-facing detail
     stays generic on purpose — vendor internals are not theirs to read — but without
     this line a rejected order is undebuggable: a 2026-08-09 sandbox run failed with
     a precise "MissingRequiredAttributes: color" and all the operator saw was 502. */
  if (!response.ok) {
    console.error("prodigi order rejected:", response.status, JSON.stringify(result).slice(0, 600));
    throw new Problem(502, "Fulfillment Provider Error", "Prodigi did not accept the order.");
  }
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
  if (!response.ok) {
    console.error("prodigi status read failed:", orderId, response.status, JSON.stringify(result).slice(0, 400));
    throw new Problem(502, "Fulfillment Provider Error", "Prodigi did not return order status.");
  }
  return result;
}
