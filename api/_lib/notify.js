/* Resend, no SDK. Email failure must NEVER fail an order — the Airtable record
   is the source of truth; this is best-effort notification on top of it. */
/* It is Nicolas's business, so his orders and enquiries go to Nicolas. Kel stays on the
   list through launch as the operator who fixes things when they break — set
   ORDER_ALERT_TO to just Nicolas to drop him.

   The FROM address deliberately stays kel@4manai.com: that is the domain verified in
   Resend. tobeehonest.com is NOT verified there, and sending from an unverified domain
   fails outright. replyTo is what puts the customer's address on Reply. */
/* ⚠️ This default carries the CLIENT's address. On 2026-08-08 a wiring test run
   without ORDER_ALERT_TO set fired five "WIRING TEST / DELETE ME" alerts at this
   list. Kel confirmed 2026-08-09 that they arrived at kel@4manai.com only and
   Nicolas never saw them — but that was luck, not design. ORDER_ALERT_TO is now set
   per Vercel environment: preview and development go to kel@4manai.com only,
   production carries Nicolas. Before firing synthetic submissions at ANY
   environment, pass an explicit `to` to sendOrderAlert rather than trusting the
   ambient config.

   UNVERIFIED: mail to nicolas@tobeehonest.com has never been observed arriving. If
   that mailbox does not deliver, production alerts reach nobody but Kel. Confirm the
   address before launch. */
const DEFAULT_ALERT_TO = "nicolas@tobeehonest.com,kel@4manai.com";

/* Shared raw-Resend sender. `to` may be a string or an array; both sendOrderAlert
   and sendCustomerConfirmation funnel through this so there is exactly one place
   that talks to Resend and exactly one failure-handling policy: never throw, log
   and report ok:false instead. */
async function sendEmail({ to, subject, text, replyTo }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const recipients = Array.isArray(to) ? to : String(to).split(",").map(s => s.trim()).filter(Boolean);
  if (!key) {
    console.warn("email skipped: RESEND_API_KEY unset");
    return { skipped: true, reason: "no-api-key" };
  }
  const payload = { from: "To Bee Honest <kel@4manai.com>", to: recipients, subject, text };
  if (replyTo) payload.reply_to = replyTo;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) console.error("email failed:", res.status, (await res.text()).slice(0, 200));
    return { skipped: false, ok: res.ok };
  } catch (error) {
    console.error("email failed to send:", error?.message);
    return { skipped: false, ok: false };
  }
}

export async function sendOrderAlert({ subject, text, to, replyTo }) {
  return sendEmail({
    to: to || process.env.ORDER_ALERT_TO || DEFAULT_ALERT_TO,
    subject,
    text,
    replyTo
  });
}

function formatMoney(amountTotal, currency) {
  const cents = Number(amountTotal);
  if (!Number.isFinite(cents)) return "";
  const code = String(currency || "usd").toUpperCase();
  try {
    return `${new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(cents / 100)} ${code}`;
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

/* Customer-facing order confirmation. Buyers got nothing after paying before this —
   internal alerts (sendOrderAlert) went to Nicolas/Kel only. This is deliberately
   plain text: no HTML template, no marketing copy, no ship-date promises. */
export async function sendCustomerConfirmation({ session, item }) {
  try {
    const to = session.customer_details?.email;
    if (!to) {
      console.warn("customer confirmation skipped: no customer email on session", session?.id);
      return { skipped: true, reason: "no-email" };
    }

    const shipping = session.shipping_details || session.collected_information?.shipping_details;
    const name = shipping?.name || session.customer_details?.name || "there";
    const address = shipping?.address;
    const quantity = item?.quantity;
    const productName = item?.productName || item?.metadata?.product || "your order";
    const total = formatMoney(session.amount_total, session.currency);

    const addressLines = address
      ? [
          shipping?.name,
          address.line1,
          address.line2,
          [address.city, address.state, address.postal_code].filter(Boolean).join(", "),
          address.country
        ].filter(Boolean)
      : [];

    const bodyLines = [
      `Hi ${name},`,
      "",
      "Your To Bee Honest order is confirmed. Here are the details:",
      "",
      `Item: ${productName}`,
      `Quantity: ${quantity}`,
      `Total paid: ${total}`,
      "",
      "Shipping to:",
      ...(addressLines.length ? addressLines : ["(no shipping address on file)"]),
      "",
      `Order reference: ${session.id}`,
      "",
      "Your piece is made to order.",
      "Questions or changes? Just reply to this email.",
      "",
      "— Nicolas, To Bee Honest"
    ];

    return await sendEmail({
      to,
      subject: "Your To Bee Honest order is confirmed",
      text: bodyLines.join("\n"),
      replyTo: "nicolas@tobeehonest.com"
    });
  } catch (error) {
    console.error("customer confirmation failed:", error?.message);
    return { skipped: false, ok: false };
  }
}
