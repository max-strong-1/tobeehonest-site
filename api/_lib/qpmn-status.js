import { Problem } from "./http.js";
import { getQpmnOrder, mapQpmnStatus } from "./qpmn.js";
import { listRecords, updateRecord } from "./airtable.js";
import { TERMINAL_AIRTABLE_STATUSES } from "./prodigi-status.js";

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

export async function reconcileQpmnOrder(qpmnOrderId, { fetchImpl } = {}) {
  const order = await getQpmnOrder(qpmnOrderId, { fetchImpl });
  const status = mapQpmnStatus(order.status);
  const tableId = ordersTableId();
  const records = await listRecords(tableId, {
    filterByFormula: `{QPMN Order Id} = "${qpmnOrderId}"`,
    maxRecords: 5
  });
  await Promise.all(records.map(record => updateRecord(tableId, record.id, { Status: status })));
  return { qpmnOrderId: String(qpmnOrderId), status, updated: records.length };
}

export async function listNonTerminalQpmnOrderRecords() {
  const tableId = ordersTableId();
  const notTerminal = TERMINAL_AIRTABLE_STATUSES.map(status => `{Status} = "${status}"`).join(", ");
  return listRecords(tableId, {
    filterByFormula: `AND({QPMN Order Id} != "", NOT(OR(${notTerminal})))`,
    maxRecords: 100
  });
}
