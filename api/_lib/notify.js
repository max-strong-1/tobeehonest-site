/* Resend, no SDK. Email failure must NEVER fail an order — the Airtable record
   is the source of truth; this is best-effort notification on top of it. */
export async function sendOrderAlert({ subject, text }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = (process.env.ORDER_ALERT_TO || "kel@4manai.com").split(",").map(s => s.trim());
  if (!key) {
    console.warn("order-alert skipped: RESEND_API_KEY unset");
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "To Bee Honest <kel@4manai.com>", to, subject, text })
  });
  if (!res.ok) console.error("order-alert failed:", res.status, (await res.text()).slice(0, 200));
  return { skipped: false, ok: res.ok };
}
