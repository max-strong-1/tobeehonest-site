import { Problem } from "./http.js";
import { requireEnv, requireEnabled } from "./config.js";

/* The Game Crafter — Wing API client (https://www.thegamecrafter.com/developer/).
   Fulfils the mantra deck. Chosen over QPMN on 2026-08-09: same 2.75"x4.75" tarot
   deck, printed in Madison WI and shipped domestically, ~$25 delivered against
   QPMN's invoiced $96.39.

   ⚠️ THERE IS NO SANDBOX. Prodigi gives us api.sandbox.prodigi.com where nothing is
   charged or fulfilled; TGC documents no test host at all, so every call here hits
   production. That is why every entry point is behind COMMERCE_FULFILLMENT_ENABLED
   and why the order sequence below is written to be resumable rather than retried
   from the top — a blind retry would place a second real order. */

const BASE = "https://www.thegamecrafter.com";

/* Wing returns { result: {...} } on success and { error: { code, message } } on
   failure, both under HTTP 200 in some cases — so status alone is not a verdict.
   Every response goes through here. */
async function wing(path, { method = "GET", params = {}, fetchImpl = fetch } = {}) {
  const url = new URL(BASE + path);
  let body;
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  } else {
    /* Wing expects form encoding, not JSON — the reference documents every method as
       named parameters, and its examples post forms. UNVERIFIED against a live key:
       if TGC rejects these, switch to JSON before assuming a credential problem. */
    body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));
  }
  const response = await fetchImpl(url.toString(), {
    method,
    ...(body ? { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    /* Log TGC's own message before discarding it. Learned the hard way on Prodigi:
       a bare 502 with the vendor's reason thrown away is undebuggable. */
    console.error("tgc call failed:", method, path, response.status, JSON.stringify(payload).slice(0, 500));
    throw new Problem(502, "Fulfillment Provider Error", "The Game Crafter did not accept the request.",
      "https://tobeehonest.com/problems/fulfillment-provider-error");
  }
  return payload.result ?? payload;
}

/* Only accounts with the developer flag set can authenticate this way at all —
   TGC's Session docs are explicit that regular users must go through SSO. */
export async function tgcLogin({ fetchImpl = fetch } = {}) {
  const result = await wing("/api/session", {
    method: "POST",
    fetchImpl,
    params: {
      username: requireEnv("TGC_USERNAME"),
      password: requireEnv("TGC_PASSWORD"),
      api_key_id: requireEnv("TGC_API_KEY_ID")
    }
  });
  if (!result?.id) throw new Problem(502, "Fulfillment Provider Error", "The Game Crafter returned no session id.");
  return result.id;
}

/* Shipping addresses are their own service; a cart references one by id rather than
   carrying the address inline the way a Prodigi order does. */
export async function tgcCreateAddress({ sessionId, shipping, fetchImpl = fetch }) {
  const address = shipping?.address;
  if (!address || !shipping?.name) {
    throw new Problem(422, "Shipping Address Missing", "Stripe did not return a complete shipping address.");
  }
  const result = await wing("/api/address", {
    method: "POST",
    fetchImpl,
    params: {
      session_id: sessionId,
      name: shipping.name,
      address1: address.line1,
      address2: address.line2,
      city: address.city,
      region: address.state,
      postal_code: address.postal_code,
      country: address.country
    }
  });
  return result.id;
}

export async function tgcCreateCart({ sessionId, shippingAddressId, name, fetchImpl = fetch }) {
  const result = await wing("/api/cart", {
    method: "POST",
    fetchImpl,
    params: {
      session_id: sessionId,
      api_key_id: requireEnv("TGC_API_KEY_ID"),
      name,
      shipping_address_id: shippingAddressId
    }
  });
  return result.id;
}

export async function tgcAddSku({ sessionId, cartId, sku, quantity, fetchImpl = fetch }) {
  return wing(`/api/cart/${encodeURIComponent(cartId)}/sku/${encodeURIComponent(sku)}`, {
    method: "POST",
    fetchImpl,
    params: { session_id: sessionId, quantity }
  });
}

/* Options vary per cart by destination, size and weight, so they cannot be cached or
   hardcoded — they must be read back for the specific cart before one is chosen. */
export async function tgcShippingOptions({ sessionId, cartId, fetchImpl = fetch }) {
  return wing(`/api/cart/${encodeURIComponent(cartId)}/shipping-method-options`, {
    method: "GET", fetchImpl, params: { session_id: sessionId }
  });
}

/* Picks the cheapest option that is genuinely delivered. "Will Call" costs $0.00 and
   would always win a naive min() — but it means the customer collects in person in
   Madison, Wisconsin, which for a mail-order deck is a silently broken order. */
export function chooseShippingMethod(options, { exclude = [/will\s*call/i] } = {}) {
  const entries = Object.entries(options || {})
    .filter(([name]) => !exclude.some(rx => rx.test(name)))
    .map(([name, o]) => ({
      name,
      total: Number(o.cost || 0) + Number(o.handling_fee || 0)
    }))
    .sort((a, b) => a.total - b.total);
  if (!entries.length) {
    throw new Problem(502, "No Shipping Method", "The Game Crafter returned no deliverable shipping option for this address.");
  }
  return entries[0];
}

export async function tgcSetShippingMethod({ sessionId, cartId, methodName, fetchImpl = fetch }) {
  return wing(`/api/cart/${encodeURIComponent(cartId)}`, {
    method: "PUT", fetchImpl,
    params: { session_id: sessionId, shipping_method_name: methodName }
  });
}

export async function tgcAttachUser({ sessionId, cartId, email, fetchImpl = fetch }) {
  /* Returns a session_id that must be used for every subsequent call on this cart —
     TGC's docs state this explicitly. Ignoring it and reusing the original session is
     the obvious mistake here, so the caller is handed the new one. */
  const result = await wing(`/api/cart/${encodeURIComponent(cartId)}/user`, {
    method: "POST", fetchImpl, params: { session_id: sessionId, email }
  });
  return result.session_id || sessionId;
}

/* Shop credit, never a card. Two reasons: TGC gates card payment behind manual
   pre-approval, and routing customer-facing card numbers through this server is not
   something we will do. The account is pre-funded and orders draw it down. */
export async function tgcPayWithShopCredit({ sessionId, cartId, fetchImpl = fetch }) {
  return wing(`/api/cart/${encodeURIComponent(cartId)}/payment/shopcredit`, {
    method: "POST", fetchImpl, params: { session_id: sessionId }
  });
}

/* A receipt id is TGC's equivalent of a Prodigi order id — the durable handle for
   status. Same doctrine applies: read status from an authenticated fetch, never from
   whatever a callback claims. */
export const TGC_ID_REGEX = /^[0-9A-Za-z_-]{6,64}$/;

export async function getTgcReceipt(receiptId, { sessionId, fetchImpl = fetch } = {}) {
  if (!TGC_ID_REGEX.test(String(receiptId ?? ""))) {
    throw new Problem(400, "Invalid Receipt Id", "The Game Crafter receipt id is not a recognized shape.");
  }
  return wing(`/api/receipt/${encodeURIComponent(receiptId)}`, {
    method: "GET", fetchImpl, params: { session_id: sessionId }
  });
}

/**
 * Place one order.
 *
 * Prodigi is a single idempotent POST; this is six sequential mutations with no
 * idempotency key anywhere in TGC's API. That asymmetry is the whole reason for the
 * `checkpoint` callback: it is invoked after each step that creates durable state, so
 * the caller can persist the cart id and resume rather than restart. Restarting after
 * a mid-sequence failure would build a second cart and — past the payment step —
 * charge twice.
 */
export async function createTgcOrder({ session, item, checkpoint = async () => {}, fetchImpl = fetch }) {
  requireEnabled("COMMERCE_FULFILLMENT_ENABLED",
    "The Game Crafter fulfilment is not enabled in this environment.");

  const sku = item?.vendorSku;
  if (!sku) throw new Problem(500, "Missing SKU", "No Game Crafter sku was resolved for this item.");

  const shipping = session.shipping_details || session.collected_information?.shipping_details;
  const email = session.customer_details?.email;

  let sid = await tgcLogin({ fetchImpl });

  const addressId = await tgcCreateAddress({ sessionId: sid, shipping, fetchImpl });
  await checkpoint({ stage: "address", addressId });

  const cartId = await tgcCreateCart({
    sessionId: sid, shippingAddressId: addressId, name: session.id, fetchImpl
  });
  await checkpoint({ stage: "cart", cartId });

  await tgcAddSku({ sessionId: sid, cartId, sku, quantity: item.quantity, fetchImpl });
  await checkpoint({ stage: "items", cartId });

  const options = await tgcShippingOptions({ sessionId: sid, cartId, fetchImpl });
  const method = chooseShippingMethod(options);
  await tgcSetShippingMethod({ sessionId: sid, cartId, methodName: method.name, fetchImpl });
  await checkpoint({ stage: "shipping", cartId, method: method.name, cost: method.total });

  sid = await tgcAttachUser({ sessionId: sid, cartId, email, fetchImpl });
  await checkpoint({ stage: "user", cartId });

  const receipt = await tgcPayWithShopCredit({ sessionId: sid, cartId, fetchImpl });
  await checkpoint({ stage: "paid", cartId, receiptId: receipt?.id });

  return { receipt, cartId, shippingMethod: method };
}
