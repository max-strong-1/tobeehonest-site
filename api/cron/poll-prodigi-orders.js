import { allowMethods, sendJson, sendProblem } from "../_lib/http.js";
import { envFlag } from "../_lib/config.js";
import { PRODIGI_ORDER_ID_REGEX } from "../_lib/prodigi.js";
import { listNonTerminalProdigiOrderRecords, reconcileProdigiOrder } from "../_lib/prodigi-status.js";

/* Belt-and-suspenders backstop for the Prodigi webhook (runbook §4, step 6): a
 * dropped/failed callback must never strand an order silently. Scheduled via
 * vercel.json `crons` (daily). Idempotent — re-running just re-syncs status
 * from Prodigi's own API, same as the webhook's reconcile step. No-ops
 * entirely when COMMERCE_FULFILLMENT_ENABLED is off.
 */
export default async function handler(req, res) {
  try {
    allowMethods(req, ["GET", "POST"]);

    if (!envFlag("COMMERCE_FULFILLMENT_ENABLED")) {
      console.log("[poll-prodigi-orders] fulfillment disabled — no-op");
      return sendJson(res, 200, { ok: true, skipped: "fulfillment disabled", checked: 0, updated: 0 });
    }

    const records = await listNonTerminalProdigiOrderRecords();
    let updated = 0;
    for (const record of records) {
      const prodigiOrderId = record.fields?.["Prodigi Order Id"];
      if (typeof prodigiOrderId !== "string" || !PRODIGI_ORDER_ID_REGEX.test(prodigiOrderId)) continue;
      try {
        await reconcileProdigiOrder(prodigiOrderId);
        updated += 1;
      } catch (err) {
        // One bad order must not stop the sweep over the rest.
        console.error("[poll-prodigi-orders] reconcile failed for", prodigiOrderId, err?.message);
      }
    }

    return sendJson(res, 200, { ok: true, checked: records.length, updated });
  } catch (error) {
    return sendProblem(req, res, error);
  }
}
