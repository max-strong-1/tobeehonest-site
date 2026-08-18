import Stripe from "stripe";
import { allowMethods, readJson, sendJson, sendProblem } from "./_lib/http.js";
import { requireEnabled, requireEnv } from "./_lib/config.js";
import { parseCheckoutInput, resolveCheckoutItem } from "./_lib/catalog.js";

export function buildCheckoutSessionParams(item, siteUrl) {
  const successUrl = new URL("/?checkout=success&session_id={CHECKOUT_SESSION_ID}", siteUrl);
  const cancelUrl = new URL("/?checkout=cancelled", siteUrl);

  if (item.product === "puzzle") {
    successUrl.hash = "puzzles";
    cancelUrl.hash = "puzzles";
  }

  return {
    mode: "payment",
    line_items: [{ price: item.stripePriceId, quantity: item.quantity }],
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    shipping_address_collection: { allowed_countries: item.allowedCountries || ["US"] },
    ...(item.stripeShippingRateIds?.length
      ? { shipping_options: item.stripeShippingRateIds.map(id => ({ shipping_rate: id })) }
      : {}),
    ...(item.product === "puzzle"
      ? { phone_number_collection: { enabled: true } }
      : {}),
    customer_creation: "always",
    metadata: Object.fromEntries(
      Object.entries({
        ...item.metadata,
        vendor: item.vendor,
        vendorSku: item.vendorSku,
        quantity: String(item.quantity)
      }).map(([key, value]) => [key, String(value)])
    )
  };
}

export default async function handler(req, res) {
  try {
    allowMethods(req, ["POST"]);
    requireEnabled("COMMERCE_CATALOG_APPROVED", "The product catalog still requires approval.");
    requireEnabled("COMMERCE_CHECKOUT_ENABLED", "Checkout requires explicit approval.");
    const item = resolveCheckoutItem(parseCheckoutInput(await readJson(req)));
    const siteUrl = new URL(requireEnv("SITE_URL"));
    const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams(item, siteUrl),
      { idempotencyKey: req.headers["idempotency-key"] || undefined }
    );
    sendJson(res, 201, { id: session.id, url: session.url });
  } catch (error) {
    sendProblem(req, res, error);
  }
}
