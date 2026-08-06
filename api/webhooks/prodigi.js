import { allowMethods, Problem, sendProblem } from "../_lib/http.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  try {
    allowMethods(req, ["POST"]);
    // Do not guess a signature header or verification algorithm. Registering this
    // endpoint is blocked until Prodigi's authoritative callback contract and an
    // order-status datastore are approved.
    throw new Problem(
      503,
      "Prodigi Webhook Pending Verification",
      "The Prodigi callback is disabled until its official signature contract is verified.",
      "https://tobeehonest.com/problems/prodigi-webhook-pending-verification"
    );
  } catch (error) {
    sendProblem(req, res, error);
  }
}
