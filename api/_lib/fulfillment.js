import { Problem } from "./http.js";
import { envFlag, requireEnabled } from "./config.js";
import { createProdigiOrder } from "./prodigi.js";
import { createQpmnOrder } from "./qpmn.js";
import { createTgcOrder } from "./tgc.js";
import { sendOrderAlert } from "./notify.js";
import { claimFulfillment, recordStage, STAGE_DONE } from "./fulfillment-ledger.js";

/* Vendors differ in whether they protect us from duplicate submission.

   Prodigi takes an `idempotencyKey` on every order, so a replayed Stripe webhook is
   absorbed by Prodigi itself and re-running is harmless. The Game Crafter has no
   equivalent — six sequential cart mutations, no replay protection — so it must be
   gated on our side by the fulfillment ledger. QPMN order creation is likewise not
   idempotent, so an explicitly enabled QPMN deck uses the same local lock. */
const ADAPTERS = {
  prodigi: { create: createProdigiOrder, selfIdempotent: true },
  tgc: { create: createTgcOrder, selfIdempotent: false },
  qpmn: { create: createQpmnOrder, selfIdempotent: false }
};

function deckVendor(item) {
  if (item.vendor !== "qpmn") return item.vendor;
  return envFlag("QPMN_ENABLED") ? "qpmn" : "tgc";
}

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

export async function fulfillPaidCheckout({ session, item }) {
  requireEnabled("COMMERCE_FULFILLMENT_ENABLED", "Live fulfillment requires explicit approval.");
  if (session.payment_status !== "paid") {
    throw new Problem(409, "Payment Not Complete", "Fulfillment requires a paid Stripe Checkout Session.");
  }

  const vendor = deckVendor(item);
  const adapter = ADAPTERS[vendor];
  if (!adapter) throw new Problem(422, "Unsupported Vendor", "No fulfillment adapter exists for this item.");

  if (adapter.selfIdempotent) return adapter.create({ session, item });

  const vendorItem = vendor === "tgc" && item.vendor === "qpmn"
    ? { ...item, vendor: "tgc", vendorSku: process.env.TGC_DECK_SKU?.trim() || item.vendorSku }
    : { ...item, vendor };
  const vendorSku = vendor === "qpmn" ? process.env.QPMN_PRODUCT_ID_DECK?.trim() : vendorItem.vendorSku;

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

  try {
    const result = vendor === "qpmn"
      ? await adapter.create({
        checkoutSessionId: session.id,
        recipient: qpmnRecipient(session),
        quantity: item.quantity,
        resalePrice: qpmnResalePrice(session, item.quantity)
      })
      : await adapter.create({
        session,
        item: vendorItem,
        /* Each durable step is written down as it happens, so a failure halfway leaves a
           trail showing exactly how far it got rather than an opaque "claimed". */
        checkpoint: async ({ stage, cartId, receiptId, method, cost }) =>
          recordStage(claim.recordId, {
            "Stage": stage,
            ...(cartId ? { "Cart ID": cartId } : {}),
            ...(receiptId ? { "Receipt ID": receiptId } : {}),
            ...(method ? { "Shipping Method": method } : {}),
            ...(cost !== undefined ? { "Shipping Cost": cost } : {})
          })
      });
    if (vendor === "qpmn") {
      await recordStage(claim.recordId, { "Stage": STAGE_DONE, "Receipt ID": String(result.id) });
    }
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
