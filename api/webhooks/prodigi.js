import { allowMethods, Problem, readJson, sendJson, sendProblem } from "../_lib/http.js";
import { envFlag } from "../_lib/config.js";
import { PRODIGI_ORDER_ID_REGEX } from "../_lib/prodigi.js";
import { reconcileProdigiOrder } from "../_lib/prodigi-status.js";

export const config = { api: { bodyParser: false } };

/* Pulls only an order id candidate out of an untrusted callback body — every
 * other field (status, stage, shipments, anything else CloudEvents might
 * carry) is deliberately never read here. Exported so tests can exercise the
 * "never trust the body" boundary without a real HTTP round trip. Does NOT
 * validate the shape — callers must check against PRODIGI_ORDER_ID_REGEX.
 */
export function extractProdigiOrderIdCandidate(body) {
  return (
    (typeof body?.subject === "string" && body.subject) ||
    (typeof body?.data?.order?.id === "string" && body.data.order.id) ||
    ""
  );
}

/* Prodigi does not sign its callbacks — no header, HMAC, or shared secret is
 * documented anywhere in the v4 reference (see the runbook, §4). This handler
 * therefore treats the POST body as a trigger only, never a source of truth:
 *
 *   1. Extract nothing but an order id, validated against a strict shape.
 *   2. Make our own authenticated GET /v4.0/orders/{id} to Prodigi — THAT
 *      response, not the inbound body, is what updates our datastore.
 *   3. Always return 200 quickly for a well-formed request so Prodigi doesn't
 *      retry-storm us; internal errors are logged, never leaked to the caller.
 */
export default async function handler(req, res) {
  try {
    allowMethods(req, ["POST"]);

    let body;
    try {
      body = await readJson(req);
    } catch {
      body = {};
    }

    // CloudEvents shape (see runbook §4 sample payload): the order id rides in
    // `subject`, with `data.order.id` as a fallback if the shape ever varies.
    // Every other field in the body is ignored on purpose.
    const candidateId = extractProdigiOrderIdCandidate(body);

    if (!PRODIGI_ORDER_ID_REGEX.test(candidateId)) {
      throw new Problem(
        400,
        "Invalid Order Reference",
        "The callback did not include a recognizable Prodigi order id.",
        "https://tobeehonest.com/problems/invalid-order-reference"
      );
    }

    if (!envFlag("COMMERCE_FULFILLMENT_ENABLED")) {
      console.log("[prodigi-webhook] fulfillment disabled — no-op for", candidateId);
      return sendJson(res, 200, { received: true });
    }

    try {
      await reconcileProdigiOrder(candidateId);
    } catch (err) {
      // Never leak internal/upstream error detail to this unauthenticated
      // caller. The poll backstop (api/cron/poll-prodigi-orders.js) will pick
      // up anything a failed reconcile here misses.
      console.error("[prodigi-webhook] reconcile failed for", candidateId, err?.message);
    }
    return sendJson(res, 200, { received: true });
  } catch (error) {
    // Standard HTTP-shape errors (wrong method, malformed order id) get a real
    // status so callers/monitoring can see them; anything from the reconcile
    // step itself is already caught above and never reaches here.
    return sendProblem(req, res, error);
  }
}
