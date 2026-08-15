import { Problem } from "./http.js";
import { upsertRecord, updateRecord } from "./airtable.js";

/* One durable row per paid Stripe Checkout Session, written BEFORE we ask a vendor
   to make anything.

   Why this exists: Stripe retries `checkout.session.completed` by design — if our
   handler fulfils successfully but then times out before returning 200, the same
   event arrives again. Prodigi absorbs that harmlessly because every order carries
   `idempotencyKey: stripe-<session.id>`. QPMN has no equivalent idempotency contract,
   so the Airtable claim prevents a replay from creating a second Deck order. */

const TABLE = () => process.env.AIRTABLE_FULFILLMENT_TABLE_ID?.trim();

export const STAGE_DONE = "paid";

/**
 * Try to become the one caller allowed to fulfil this session.
 *
 * Returns `{ claimed: true, recordId }` to exactly one caller. Everyone else gets
 * `{ claimed: false, stage }` describing what the first caller got to.
 */
export async function claimFulfillment({ sessionId, vendor, sku, quantity }) {
  const table = TABLE();
  if (!table) {
    /* Fail closed. Running without a ledger means running without duplicate
       protection, and for a vendor that charges real money per call that is worse
       than not fulfilling at all — an unfulfilled order can be fixed by hand; a
       double-charged customer cannot be un-charged silently. */
    throw new Problem(503, "Fulfillment Ledger Not Configured",
      "AIRTABLE_FULFILLMENT_TABLE_ID must be set before live fulfillment can run.",
      "https://tobeehonest.com/problems/ledger-not-configured");
  }

  /* The upsert carries ONLY the merge key. Airtable applies a performUpsert's fields
     to MATCHED records as well as created ones, so sending Stage here would overwrite
     the stage of an order that had already reached "paid" — resetting it to "claimed"
     and making a harmless duplicate look like a stalled order. Verified against the
     live table on 2026-08-09: the third claim on a paid row read back "claimed" until
     this was split apart. Everything descriptive is written in the create branch. */
  const { record, created } = await upsertRecord(
    table,
    { "Stripe Session": sessionId },
    { fieldsToMergeOn: ["Stripe Session"], typecast: true }
  );

  if (created) {
    await recordStage(record.id, {
      "Vendor": vendor,
      "SKU": sku,
      "Quantity": quantity,
      "Stage": "claimed",
      "Claimed At": new Date().toISOString()
    });
    return { claimed: true, recordId: record.id };
  }
  return { claimed: false, recordId: record?.id, stage: record?.fields?.["Stage"] || "unknown" };
}

/** Record progress through a multi-step vendor sequence so a stall is resumable. */
export async function recordStage(recordId, patch) {
  const table = TABLE();
  if (!table || !recordId) return;
  try {
    await updateRecord(table, recordId, patch, { typecast: true });
  } catch (error) {
    /* A ledger write failing must never fail an order that the vendor has already
       accepted — losing the audit trail is bad, cancelling a made product is worse. */
    console.error("fulfillment ledger update failed:", recordId, error?.message);
  }
}
