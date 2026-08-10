import { Problem } from "./http.js";

const API_BASE = "https://api.airtable.com/v0";
const CONTENT_BASE = "https://content.airtable.com/v0";

/* Airtable caps a single inline attachment upload at 5MB, and Vercel's serverless
   function body limit is ~4.5MB for the whole request (base64 inflates ~33%), so the
   per-file cap actually enforced (marketplace-submit.js) stays well under both. This
   is the single source of truth — do not redeclare a separate per-file constant. */
export const MAX_ATTACHMENT_BYTES = 3_000_000;

export function airtableConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    throw new Problem(
      503,
      "Submissions Unavailable",
      "The submission system is not configured yet.",
      "https://tobeehonest.com/problems/airtable-not-configured"
    );
  }
  return { token, baseId };
}

async function airtableFetch(url, token, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    /* Airtable's own error text can quote submitted values back. Keep it in the
       server log, never in the response body the visitor sees. */
    console.error("[airtable]", res.status, url, detail.slice(0, 500));
    const problem = new Problem(
      502,
      "Upstream Error",
      "The submission could not be saved. Please try again shortly.",
      "https://tobeehonest.com/problems/airtable-error"
    );
    /* Surface Airtable's own error type/status (not shown to the caller — sendProblem
       never reads these fields) so a caller can distinguish "this select value doesn't
       exist yet" from a real outage without re-parsing response text itself. */
    problem.airtableStatus = res.status;
    try {
      problem.airtableErrorType = JSON.parse(detail)?.error?.type;
    } catch {
      problem.airtableErrorType = undefined;
    }
    throw problem;
  }
  return res.json();
}

export async function createRecord(tableId, fields, { typecast = false } = {}) {
  const { token, baseId } = airtableConfig();
  const data = await airtableFetch(`${API_BASE}/${baseId}/${encodeURIComponent(tableId)}`, token, {
    method: "POST",
    body: JSON.stringify({ records: [{ fields }], typecast })
  });
  return data.records?.[0];
}

/**
 * Lists records for a table, optionally filtered by an Airtable formula.
 * Returns the plain records array (never the raw envelope) — callers don't
 * need pagination offsets for the bounded fulfillment-tracking queries this
 * is used for today.
 */
export async function listRecords(tableId, { filterByFormula, maxRecords = 100 } = {}) {
  const { token, baseId } = airtableConfig();
  const params = new URLSearchParams();
  if (filterByFormula) params.set("filterByFormula", filterByFormula);
  if (maxRecords) params.set("maxRecords", String(maxRecords));
  const query = params.toString();
  const data = await airtableFetch(
    `${API_BASE}/${baseId}/${encodeURIComponent(tableId)}${query ? `?${query}` : ""}`,
    token,
    { method: "GET" }
  );
  return data.records || [];
}

/**
 * Upsert a record, matching on `fieldsToMergeOn`, and report whether THIS call
 * created it.
 *
 * The `created` flag is the whole point. A read-then-write claim ("does a row
 * exist? no? then insert one") has a race: two Stripe webhook retries arriving
 * seconds apart can both read empty and both insert. Airtable resolves the merge
 * server-side in one request and names the ids it created, so exactly one caller
 * is told `created: true`. That makes it usable as a lock.
 */
export async function upsertRecord(tableId, fields, { fieldsToMergeOn, typecast = false }) {
  const { token, baseId } = airtableConfig();
  const data = await airtableFetch(`${API_BASE}/${baseId}/${encodeURIComponent(tableId)}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      performUpsert: { fieldsToMergeOn },
      records: [{ fields }],
      typecast
    })
  });
  const record = data.records?.[0];
  return { record, created: Boolean(record && (data.createdRecords || []).includes(record.id)) };
}

export async function updateRecord(tableId, recordId, fields, { typecast = false } = {}) {
  const { token, baseId } = airtableConfig();
  const data = await airtableFetch(`${API_BASE}/${baseId}/${encodeURIComponent(tableId)}`, token, {
    method: "PATCH",
    body: JSON.stringify({ records: [{ id: recordId, fields }], typecast })
  });
  return data.records?.[0];
}

export async function deleteRecord(tableId, recordId) {
  const { token, baseId } = airtableConfig();
  return airtableFetch(
    `${API_BASE}/${baseId}/${encodeURIComponent(tableId)}/${recordId}`,
    token,
    { method: "DELETE" }
  );
}

/**
 * Uploads one base64 file into an attachment field on an existing record.
 * `file` is raw base64 (no data: prefix).
 */
export async function uploadAttachment(recordId, fieldId, { filename, contentType, file }) {
  const { token, baseId } = airtableConfig();
  return airtableFetch(
    `${CONTENT_BASE}/${baseId}/${recordId}/${encodeURIComponent(fieldId)}/uploadAttachment`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ contentType, file, filename })
    }
  );
}
