import { Problem } from "./http.js";
import { requireEnabled } from "./config.js";
import { createProdigiOrder } from "./prodigi.js";
import { createQpmnOrder } from "./qpmn.js";
import { createTgcOrder } from "./tgc.js";
import { sendOrderAlert } from "./notify.js";
import { claimFulfillment, recordStage, STAGE_DONE } from "./fulfillment-ledger.js";

/* Vendors differ in whether they protect us from duplicate submission.

   Prodigi takes an `idempotencyKey` on every order, so a replayed Stripe webhook is
   absorbed by Prodigi itself and re-running is harmless. The Game Crafter has no
   equivalent — six sequential cart mutations, no replay protection — so it must be
   gated on our side by the fulfillment ledger. QPMN is retired (2026-08-09, on
   delivered cost) and remains only as a fail-closed stub. */
const ADAPTERS = {
  prodigi: { create: createProdigiOrder, selfIdempotent: true },
  tgc: { create: createTgcOrder, selfIdempotent: false },
  qpmn: { create: createQpmnOrder, selfIdempotent: true }
};

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

  const adapter = ADAPTERS[item.vendor];
  if (!adapter) throw new Problem(422, "Unsupported Vendor", "No fulfillment adapter exists for this item.");

  if (adapter.selfIdempotent) return adapter.create({ session, item });

  const claim = await claimFulfillment({
    sessionId: session.id, vendor: item.vendor, sku: item.vendorSku, quantity: item.quantity
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
        + `Stripe session : ${session.id}\nVendor         : ${item.vendor}\n`
        + `SKU            : ${item.vendorSku}\nReached stage  : ${claim.stage}\n\n`
        + `Nothing has been double-charged. The order needs to be finished by hand.`
    });
    return { duplicate: true, alreadyFulfilled: false, needsAttention: true, stage: claim.stage };
  }

  try {
    const result = await adapter.create({
      session,
      item,
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
    return result;
  } catch (error) {
    await recordStage(claim.recordId, { "Stage": "failed", "Error": String(error?.detail || error?.message || error).slice(0, 500) });
    /* The likeliest cause of a late-stage failure is an empty shop-credit balance, and
       the account holder is the only person who can fix that. */
    await alertFundingOwner({
      subject: `Fulfillment failed — ${session.id}`,
      text: `A paid order failed during fulfillment.\n\n`
        + `Stripe session : ${session.id}\nVendor         : ${item.vendor}\n`
        + `SKU            : ${item.vendorSku}\nError          : ${error?.detail || error?.message}\n\n`
        + `If this vendor is paid from a pre-funded balance, check that the balance has not run out.`
    });
    throw error;
  }
}
