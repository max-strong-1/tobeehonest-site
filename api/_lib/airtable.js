import { Problem } from "./http.js";

const API_BASE = "https://api.airtable.com/v0";
const CONTENT_BASE = "https://content.airtable.com/v0";

/* Airtable caps a single inline attachment upload at 5MB. We stay under it on
   purpose so a borderline file fails here rather than halfway through Airtable. */
export const MAX_ATTACHMENT_BYTES = 4_500_000;

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
    throw new Problem(
      502,
      "Upstream Error",
      "The submission could not be saved. Please try again shortly.",
      "https://tobeehonest.com/problems/airtable-error"
    );
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
