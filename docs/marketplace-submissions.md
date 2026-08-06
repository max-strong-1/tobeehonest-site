# The Community Marketplace — submission & approval flow

Public intake form on the Marketplace tab → Airtable review queue → Nicolas approves or rejects.

## Pieces

| Piece | Where |
|---|---|
| Form markup + client JS | `index-pre-rev5-backup.html` (section `#t-market`, form `#marketOrderForm`) |
| API endpoint | `api/marketplace-submit.js` |
| Airtable helper | `api/_lib/airtable.js` |
| Airtable table | base `appiWkCMQz8kfJvOl`, table `tbl3XaHLIZlkriMNb` ("Marketplace Submissions") |

## What the form collects

**Contact** — name, email, phone, where they ship from.
**Setup** — registered business / individual / registering; business name + legal structure (LLC, sole prop, corp, partnership) shown only when they say "registered business"; website + social links.
**What they're selling** — title, description, category, optional asking price, how many they can supply, who ships it.
**Proof** — photos of the piece (required), proof-of-work shots (required), business paperwork (optional, registered businesses only).
**Rights** — a required checkbox confirming they made it or hold the rights, and the photos are theirs.

Every submission lands with `Status = Submitted`, `Submission Source = Website form`, `Submitted Date = today`.

## Approval flow

`Submitted` → `Under Review` → `Approved` or `Rejected` → `Listed`

Set **Decision Reason** and **Decision Date** whenever the status moves to Approved or Rejected. **Review Notes** is internal and must never be shown to a submitter.

Rejection reasons are pre-set so the "why" is one glance, and so a reply template can be driven off it later: proof of work insufficient · off-brand / wrong category · quality below standard · resale or mass-produced goods · rights or authenticity unclear · no response to follow-up.

## Setup required before this goes live

1. Create an Airtable **personal access token** with scopes `data.records:write` and `data.recordComments:write`, limited to base `appiWkCMQz8kfJvOl`.
2. Add to Vercel project env (all environments):
   - `AIRTABLE_TOKEN` — the PAT (server-only; never in client code)
   - `AIRTABLE_BASE_ID` — `appiWkCMQz8kfJvOl`
   - `AIRTABLE_MARKETPLACE_TABLE_ID` — `tbl3XaHLIZlkriMNb`
3. Redeploy. Without `AIRTABLE_TOKEN` the endpoint returns a clean 503 ("Submissions Unavailable") rather than erroring — the form stays safe to ship before the token exists.

## Guardrails already in place

- **Field IDs, not names.** Renaming a column in Airtable will not break the form.
- **Honeypot** (`company_website`) — bots that fill it get a fake 202 and no record.
- **Allow-listed file types.** Images only for photos and proof; images + PDF for business paperwork.
- **Size limits.** 4.5 MB per file, 18 MB total, 6 files per field. Images are downscaled in the browser (1600px, JPEG q0.82) before upload, so phone photos comfortably fit under Vercel's request body cap.
- **Select values are validated server-side** against the exact Airtable options — a tampered payload can't invent a category or status.
- **Upstream errors are logged, not echoed.** Airtable's error text can quote submitted values back; the visitor only sees a generic retry message.

## Known gaps

- **No notification yet.** Nothing emails Nicolas when a submission arrives; he has to look at the table. Wiring Resend to fire on `Status = Submitted` is the obvious next step.
- **No reply automation.** Approve/reject emails are manual today.
- **Attachment failures are non-fatal.** If a file upload fails after the record is created, the submission is kept and the failure is logged — losing the lead would be worse than losing a photo. The API response reports how many files landed per group.
- **Untested against live Airtable HTTP.** The field-ID and select-value contract was verified by writing and deleting a real record, and every validation path is unit-exercised, but the endpoint itself has never run with a real `AIRTABLE_TOKEN`. First deploy should be smoke-tested with one real submission.
