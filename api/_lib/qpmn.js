import { Problem } from "./http.js";

export async function createQpmnOrder() {
  // Fail closed: the official order path, schema, authentication contract, and webhook
  // behavior must be verified before customer data or an order can be transmitted.
  throw new Problem(
    503,
    "QPMN Integration Pending Verification",
    "QPMN fulfillment is disabled until its official order API contract is supplied and approved.",
    "https://tobeehonest.com/problems/qpmn-pending-verification"
  );
}
