/* Prodigi order status reconciliation — shared by the webhook trigger
 * (api/webhooks/prodigi.js) and the poll backstop (api/cron/poll-prodigi-orders.js).
 *
 * The authenticated GET /v4.0/orders/{id} response (via getProdigiOrder) is the
 * ONLY source of truth for status. Nothing here ever reads status/stage out of
 * an inbound webhook body — see runbook §4.
 *
 * Airtable order-tracking table: configured via AIRTABLE_ORDERS_TABLE_ID. This
 * is a separate table from the gallery/deck intent-capture tables in
 * order-intent.js (those are pre-payment "request a quote" records with no
 * Prodigi order yet). Expected fields on the orders table:
 *   - "Prodigi Order Id" (text) — set when createProdigiOrder succeeds
 *   - "Status" (single select) — one of the Airtable-stage values below
 */

import { Problem } from "./http.js";
import { getProdigiOrder } from "./prodigi.js";
import { listRecords, updateRecord } from "./airtable.js";

function ordersTableId() {
  const tableId = process.env.AIRTABLE_ORDERS_TABLE_ID?.trim();
  if (!tableId) {
    throw new Problem(
      503,
      "Fulfillment Tracking Not Configured",
      "AIRTABLE_ORDERS_TABLE_ID is not configured.",
      "https://tobeehonest.com/problems/integration-not-configured"
    );
  }
  return tableId;
}

/* Mirrors the "Suggested Airtable mapping" table in the runbook (§5). */
export const TERMINAL_AIRTABLE_STATUSES = ["Shipped", "Cancelled", "Failed / Needs Attention"];

export function mapProdigiOrderToAirtableStatus(prodigiOrderResponse) {
  const order = prodigiOrderResponse?.order || prodigiOrderResponse || {};
  const stage = order?.status?.stage;
  const hasIssues = Array.isArray(order?.status?.issues) && order.status.issues.length > 0;
  const hasInvalidItem = Array.isArray(order?.items) && order.items.some(item => item?.status === "Invalid");

  if (stage === "Cancelled") return "Cancelled";
  if (hasIssues || hasInvalidItem) return "Failed / Needs Attention";
  if (stage === "Complete") return "Shipped";
  if (stage === "InProgress") return "Printing";
  return "Placed";
}

/**
 * Re-checks one Prodigi order against Prodigi's own API and writes the result
 * into every Airtable order-tracking record whose "Prodigi Order Id" matches.
 * Safe to call repeatedly (idempotent — it's just a status overwrite).
 */
export async function reconcileProdigiOrder(prodigiOrderId, { fetchImpl } = {}) {
  const prodigiOrderResponse = await getProdigiOrder(prodigiOrderId, { fetchImpl });
  const status = mapProdigiOrderToAirtableStatus(prodigiOrderResponse);
  const tableId = ordersTableId();
  const records = await listRecords(tableId, {
    filterByFormula: `{Prodigi Order Id} = "${prodigiOrderId}"`,
    maxRecords: 5
  });
  await Promise.all(records.map(record => updateRecord(tableId, record.id, { Status: status })));
  return { prodigiOrderId, status, updated: records.length };
}

/**
 * Lists Airtable order-tracking records that have a Prodigi order id and are
 * not yet in a terminal status — the poll backstop's work queue.
 */
export async function listNonTerminalProdigiOrderRecords() {
  const tableId = ordersTableId();
  const notTerminal = TERMINAL_AIRTABLE_STATUSES.map(status => `{Status} = "${status}"`).join(", ");
  return listRecords(tableId, {
    filterByFormula: `AND({Prodigi Order Id} != "", NOT(OR(${notTerminal})))`,
    maxRecords: 100
  });
}
