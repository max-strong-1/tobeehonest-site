import Stripe from "stripe";
import { allowMethods, Problem, readRawBody, sendJson, sendProblem } from "../_lib/http.js";
import { requireEnv } from "../_lib/config.js";
import { fulfillPaidCheckout } from "../_lib/fulfillment.js";

export const config = { api: { bodyParser: false } };

function itemFromSession(session) {
  const metadata = session.metadata || {};
  const quantity = Number(metadata.quantity);
  if (!metadata.vendor || !metadata.vendorSku || !Number.isInteger(quantity)) {
    throw new Problem(422, "Invalid Checkout Metadata", "The paid session lacks trusted fulfillment metadata.");
  }
  return {
    vendor: metadata.vendor,
    vendorSku: metadata.vendorSku,
    quantity,
    metadata: {
      product: metadata.product,
      artworkId: metadata.artworkId,
      size: metadata.size,
      frameColor: metadata.frameColor
    }
  };
}

export default async function handler(req, res) {
  try {
    allowMethods(req, ["POST"]);
    const signature = req.headers["stripe-signature"];
    if (!signature) throw new Problem(400, "Missing Signature", "The Stripe-Signature header is required.");
    const rawBody = await readRawBody(req);
    const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
    } catch {
      throw new Problem(400, "Invalid Signature", "The Stripe webhook signature could not be verified.");
    }

    if (event.type === "checkout.session.completed") {
      await fulfillPaidCheckout({ session: event.data.object, item: itemFromSession(event.data.object) });
    }
    sendJson(res, 200, { received: true });
  } catch (error) {
    sendProblem(req, res, error);
  }
}
