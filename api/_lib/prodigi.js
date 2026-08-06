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
