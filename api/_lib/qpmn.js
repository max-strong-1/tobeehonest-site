import { Problem } from "./http.js";

/* Official "Api Integration" store channel (QPMN's Redocly-documented REST API),
 * per the API Setup deck captured 2026-08-11 — NOT the wp-json OAuth partner
 * channel the WooCommerce plugin uses (this adapter's original target).
 *
 * Auth gotcha: the Authorization header is `Basic <store token>` with the token
 * used VERBATIM as displayed in the QPMN dashboard. Do not base64-encode it
 * again — the displayed string is already the finished credential.
 *
 * The deck was added to the store via the design wizard (SKU WITH DESIGN), so
 * the artwork is bound to the store product server-side and orders do not carry
 * a customizeProject payload. `properties` pins the 54-card configuration.
 */
const BASE = "https://partner.qpmarketnetwork.com";
const ORDERS_URL = `${BASE}/cgp-rest/api/store/orders`;

function pendingVerification() {
  return new Problem(
    503,
    "QPMN Integration Pending Verification",
    "QPMN fulfillment is disabled until the store credentials are configured and a real order has been verified.",
    "https://tobeehonest.com/problems/qpmn-pending-verification"
  );
}

function qpmnConfig() {
  const storeToken = process.env.QPMN_STORE_TOKEN?.trim();
  const storeProductId = process.env.QPMN_STORE_PRODUCT_ID_DECK?.trim();
  if (process.env.QPMN_ENABLED !== "true" || !storeToken || !storeProductId) {
    throw pendingVerification();
  }
  return { storeToken, storeProductId };
}

function providerError(message = "QPMN did not accept the request.") {
  return new Problem(
    502,
    "Fulfillment Provider Error",
    message,
    "https://tobeehonest.com/problems/fulfillment-provider-error"
  );
}

async function storeRequest(url, { method, body, fetchImpl, config }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Basic ${config.storeToken}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("qpmn call failed:", method, url, response.status, JSON.stringify(payload).slice(0, 500));
    throw providerError(payload?.message || payload?.msg || "QPMN did not accept the request.");
  }
  return payload;
}

/* QPMN's response envelope is not published for this channel; accept the shapes
 * seen in their ecosystem ({code,data:{order}} like the wp-json channel, a bare
 * order object, or {data:{...}}) and fail loudly on anything else. */
function normalizeOrder(payload, context) {
  const order = payload?.data?.order ?? payload?.order ?? payload?.data ?? payload;
  const id = order?.id ?? order?.orderId ?? order?.orderNo;
  if (!id || (payload?.code !== undefined && Number(payload.code) !== 200)) {
    console.error(`qpmn ${context} failed:`, JSON.stringify(payload).slice(0, 500));
    throw providerError(payload?.message || payload?.msg || `QPMN did not ${context} the order.`);
  }
  return {
    id: String(id),
    number: String(order?.number ?? order?.orderNumber ?? order?.thirdOrderNumber ?? id),
    status: String(order?.status ?? "processing")
  };
}

function wooAddress(recipient) {
  const address = recipient?.address;
  if (!recipient?.name || !address?.line1 || !address?.city || !address?.postalCode || !address?.country) {
    throw new Problem(422, "Shipping Address Missing", "Stripe did not return a complete shipping address.");
  }
  const [firstName, ...lastNameParts] = recipient.name.trim().split(/\s+/);
  return {
    first_name: firstName,
    last_name: lastNameParts.join(" "),
    address_1: address.line1,
    address_2: address.line2 || "",
    city: address.city,
    state: address.state || "",
    postcode: address.postalCode,
    country: address.country,
    email: recipient.email || "",
    phone: recipient.phone || ""
  };
}

const money = (value) => (Math.round(Number(value) * 100) / 100).toFixed(2);

export async function createQpmnOrder({
  checkoutSessionId,
  recipient,
  quantity,
  resalePrice,
  fetchImpl = fetch
} = {}) {
  const config = qpmnConfig();
  const address = wooAddress(recipient);
  const unitPrice = money(Number(resalePrice) / Number(quantity));
  const payload = {
    thirdOrderId: checkoutSessionId,
    thirdOrderNumber: checkoutSessionId,
    items: [{
      thirdOrderItemId: `${checkoutSessionId}-deck`,
      qty: quantity,
      unitPrice,
      storeProductId: config.storeProductId,
      properties: { "Size of Deck mode": "Up to 54 cards" }
    }],
    shippingMethod: "Standard",
    currency: "USD",
    status: "processing",
    deliveryAddress: { ...address },
    billingAddress: { ...address },
    orderTotals: [
      { name: "TAX", value: "0.00" },
      { name: "SHIPPING", value: "0.00" },
      { name: "SUBTOTAL", value: money(resalePrice) },
      { name: "ORDER_TOTAL", value: money(resalePrice) }
    ]
  };
  const response = await storeRequest(ORDERS_URL, {
    method: "POST", body: payload, fetchImpl, config
  });
  return normalizeOrder(response, "create");
}

export const QPMN_ORDER_ID_REGEX = /^[A-Za-z0-9_-]+$/;

export async function getQpmnOrder(qpmnOrderId, { fetchImpl = fetch } = {}) {
  const config = qpmnConfig();
  if (!QPMN_ORDER_ID_REGEX.test(String(qpmnOrderId ?? ""))) {
    throw new Problem(400, "Invalid Order Id", "The QPMN order id is not a recognized shape.");
  }
  const response = await storeRequest(`${ORDERS_URL}/${encodeURIComponent(qpmnOrderId)}`, {
    method: "GET", fetchImpl, config
  });
  return normalizeOrder(response, "read");
}

export function mapQpmnStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "completed") return "Shipped";
  if (normalized === "processing") return "Printing";
  if (normalized === "cancelled" || normalized === "refunded") return "Cancelled";
  if (normalized === "failed") return "Failed / Needs Attention";
  return "Placed";
}
