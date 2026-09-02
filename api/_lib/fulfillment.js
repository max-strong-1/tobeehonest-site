import { Problem } from "./http.js";
import { requireEnabled } from "./config.js";
import { createProdigiOrder } from "./prodigi.js";
import { createQpmnOrder } from "./qpmn.js";
import { sendOrderAlert, sendCustomerConfirmation } from "./notify.js";
import { claimFulfillment, recordStage, STAGE_DONE } from "./fulfillment-ledger.js";
import { ARTWORK_ALLOWLIST } from "./artwork-allowlist.js";

/* Turn item.metadata.product / artworkId into a human-readable name for the
   customer confirmation email. Falls back to the raw product string when there
   is no clean lookup (no catalog module maps product/vendorSku -> display name). */
const PRODUCT_LABELS = { deck: "Mantra Deck", puzzle: "Sun Bird Puzzle" };
function productNameFromItem(item) {
  const metadata = item?.metadata || {};
  if (metadata.product === "framed-art" && metadata.artworkId) {
    const known = ARTWORK_ALLOWLIST.find(entry => entry.slug === metadata.artworkId);
    const title = known?.title || metadata.artworkId;
    return metadata.size ? `${title} (Framed Art, ${metadata.size})` : `${title} (Framed Art)`;
  }
  return PRODUCT_LABELS[metadata.product] || metadata.product || "your order";
}

/* Vendors differ in whether they protect us from duplicate submission.

   Prodigi takes an `idempotencyKey` on every order, so a replayed Stripe webhook is
   absorbed by Prodigi itself and re-running is harmless. QPMN order creation is not
   idempotent, so every enabled QPMN deck order uses the Airtable fulfillment lock. */
const ADAPTERS = {
  prodigi: { create: createProdigiOrder, selfIdempotent: true },
  qpmn: { create: createQpmnOrder, selfIdempotent: false }
};

function qpmnRecipient(session) {
  const shipping = session.shipping_details || session.collected_information?.shipping_details;
  const address = shipping?.address;
  return {
    name: shipping?.name,
    email: session.customer_details?.email,
    phone: session.customer_details?.phone || shipping?.phone,
    address: address ? {
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
      country: address.country
    } : undefined
  };
}

function qpmnResalePrice(session, quantity) {
  const cents = Number(session.amount_subtotal ?? session.amount_total);
  if (!Number.isFinite(cents) || cents < 0 || !Number.isInteger(quantity) || quantity < 1) {
    throw new Problem(422, "Invalid Checkout Total", "Stripe did not return a valid deck resale price.");
  }
  return (cents / 100 / quantity).toFixed(2);
}

/* Funding alerts are Nicolas's, not Kel's — it is his vendor account and his money
   that keeps it topped up. Deliberately has NO default: an unset value logs and skips
   rather than falling back to a hardcoded address, because a hardcoded client address
   in a preview deploy is exactly how five test emails escaped on 2026-08-08. */
async function alertFundingOwner({ subject, text }) {
  const to = process.env.FUNDING_ALERT_TO?.trim();
  if (!to) {
    console.error("FUNDING ALERT NOT SENT — FUNDING_ALERT_TO is unset:", subject, text);
    return;
  }
  await sendOrderAlert({ subject, text, to }).catch(error =>
    console.error("funding alert failed to send:", error?.message));
}

/* Which vendor shipping tier did the customer buy? Stripe records the chosen
 * shipping rate id on the session; if it is one of our Express rates, the
 * vendor order must be Express too — otherwise the customer paid for speed
 * they would not get. Fail-soft to Standard when the id is absent/unknown. */
const EXPRESS_RATE_ENVS = ["DECK", "PUZZLE", "FRAME_12X16", "FRAME_16X24", "FRAME_20X28"]
  .map(k => `STRIPE_SHIPPING_RATE_${k}_US_EXPRESS`);
export function shippingMethodFromSession(session) {
  const chosen = session?.shipping_cost?.shipping_rate;
  if (!chosen) return "Standard";
  const id = typeof chosen === "string" ? chosen : chosen.id;
  return EXPRESS_RATE_ENVS.some(name => process.env[name]?.trim() === id) ? "Express" : "Standard";
}

export async function fulfillPaidCheckout({ session, item }) {
  requireEnabled("COMMERCE_FULFILLMENT_ENABLED", "Live fulfillment requires explicit approval.");
  if (session.payment_status !== "paid") {
    throw new Problem(409, "Payment Not Complete", "Fulfillment requires a paid Stripe Checkout Session.");
  }

  const vendor = item.vendor;
  const adapter = ADAPTERS[vendor];
  if (!adapter) throw new Problem(422, "Unsupported Vendor", "No fulfillment adapter exists for this item.");

  const confirmationItem = { ...item, productName: productNameFromItem(item) };

  if (adapter.selfIdempotent) {
    /* Prodigi absorbs a replayed webhook itself (idempotencyKey), but nothing here
       dedupes the CUSTOMER EMAIL on that path — there is no ledger claim for
       self-idempotent vendors (see the comment on ADAPTERS above). A Stripe retry
       could in theory send a second confirmation. Payment is captured either way
       and a duplicate "your order is confirmed" email is a minor annoyance, not a
       financial risk, so this is accepted rather than adding a ledger claim to a
       vendor path that deliberately has none. */
    // Awaited on purpose: a serverless function may freeze once the handler returns,
    // killing an un-awaited fetch. sendCustomerConfirmation never throws.
    await sendCustomerConfirmation({ session, item: confirmationItem });
    return adapter.create({ session, item, shippingMethod: shippingMethodFromSession(session) });
  }

  requireEnabled("QPMN_ENABLED", "QPMN fulfillment requires explicit approval.");

  const vendorSku = process.env.QPMN_STORE_PRODUCT_ID_DECK?.trim();

  const claim = await claimFulfillment({
    sessionId: session.id,
    vendor,
    sku: vendorSku,
    quantity: item.quantity
  });

  if (!claim.claimed) {
    /* Somebody already holds this session. Never re-run — that is the whole point.
       Return normally either way so Stripe stops redelivering: retrying cannot help,
       because every future attempt will be refused here too. */
    if (claim.stage === STAGE_DONE) {
      return { duplicate: true, alreadyFulfilled: true, stage: claim.stage };
    }
    /* Stalled part-way. Safe (no double charge) but NOT fine — a customer has paid
       and nothing is being made. This needs a human, so say so loudly. */
    console.error("fulfillment stalled and a retry was refused:", session.id, claim.stage);
    await alertFundingOwner({
      subject: `Order needs attention — ${session.id}`,
      text: `A paid order stopped part-way through fulfillment and cannot safely retry itself.\n\n`
        + `Stripe session : ${session.id}\nVendor         : ${vendor}\n`
        + `SKU            : ${vendorSku}\nReached stage  : ${claim.stage}\n\n`
        + `Nothing has been double-charged. The order needs to be finished by hand.`
    });
    return { duplicate: true, alreadyFulfilled: false, needsAttention: true, stage: claim.stage };
  }

  /* claim.claimed is only ever true for the ONE caller that just created the ledger
     row — every redelivered webhook for this session hits the branch above instead
     and returns early. That makes this the natural "first processed, send once"
     gate for the customer email on the non-idempotent (QPMN) path. */
  await sendCustomerConfirmation({ session, item: confirmationItem }); // never throws; awaited so the function stays alive

  try {
    const result = await adapter.create({
      checkoutSessionId: session.id,
      recipient: qpmnRecipient(session),
      quantity: item.quantity,
      resalePrice: qpmnResalePrice(session, item.quantity),
      shippingMethod: shippingMethodFromSession(session)
    });
    await recordStage(claim.recordId, { "Stage": STAGE_DONE, "Receipt ID": String(result.id) });
    return result;
  } catch (error) {
    await recordStage(claim.recordId, { "Stage": "failed", "Error": String(error?.detail || error?.message || error).slice(0, 500) });
    /* The likeliest cause of a late-stage failure is an empty shop-credit balance, and
       the account holder is the only person who can fix that. */
    await alertFundingOwner({
      subject: `Fulfillment failed — ${session.id}`,
      text: `A paid order failed during fulfillment.\n\n`
        + `Stripe session : ${session.id}\nVendor         : ${vendor}\n`
        + `SKU            : ${vendorSku}\nError          : ${error?.detail || error?.message}\n\n`
        + `If this vendor is paid from a pre-funded balance, check that the balance has not run out.`
    });
    throw error;
  }
}
