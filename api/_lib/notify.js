/* Resend, no SDK. Email failure must NEVER fail an order — the Airtable record
   is the source of truth; this is best-effort notification on top of it. */
/* It is Nicolas's business, so his orders and enquiries go to Nicolas. Kel stays on the
   list through launch as the operator who fixes things when they break — set
   ORDER_ALERT_TO to just Nicolas to drop him.

   The FROM address deliberately stays kel@4manai.com: that is the domain verified in
   Resend. tobeehonest.com is NOT verified there, and sending from an unverified domain
   fails outright. replyTo is what puts the customer's address on Reply. */
const DEFAULT_ALERT_TO = "nicolas@tobeehonest.com,kel@4manai.com";

export async function sendOrderAlert({ subject, text, to, replyTo }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const recipients = (to || process.env.ORDER_ALERT_TO || DEFAULT_ALERT_TO)
    .split(",").map(s => s.trim()).filter(Boolean);
  if (!key) {
    console.warn("order-alert skipped: RESEND_API_KEY unset");
    return { skipped: true };
  }
  const payload = { from: "To Bee Honest <kel@4manai.com>", to: recipients, subject, text };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) console.error("order-alert failed:", res.status, (await res.text()).slice(0, 200));
  return { skipped: false, ok: res.ok };
}
