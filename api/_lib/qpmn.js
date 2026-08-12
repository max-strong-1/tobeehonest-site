import { Problem } from "./http.js";

const BASE = "https://www.qpmarketnetwork.com";
const PARTNER_ORDER_URL = `${BASE}/wp-json/qpmn-api/v1/partner/order`;
const PUBLIC_PLUGIN_CLIENT_ID = "a0PBL4JUSJQgDEoGw6JQDARvLhJ1HxxKBfyQVvgj";

let cachedAccessToken;
let cachedAccessTokenExpiresAt = 0;
let cachedCredentialKey;

function pendingVerification() {
  return new Problem(
    503,
    "QPMN Integration Pending Verification",
    "QPMN fulfillment is disabled until its official order API contract is supplied and approved.",
    "https://tobeehonest.com/problems/qpmn-pending-verification"
  );
}

function qpmnConfig() {
  const refreshToken = process.env.QPMN_REFRESH_TOKEN?.trim();
  const productId = process.env.QPMN_PRODUCT_ID_DECK?.trim();
  const designId = process.env.QPMN_DESIGN_ID_DECK?.trim();
  if (process.env.QPMN_ENABLED !== "true" || !refreshToken || !productId || !designId) {
    throw pendingVerification();
  }
  return {
    refreshToken,
    productId,
    designId,
    clientId: process.env.QPMN_CLIENT_ID?.trim() || PUBLIC_PLUGIN_CLIENT_ID
  };
}

function providerError(message = "QPMN did not accept the request.") {
  return new Problem(
    502,
    "Fulfillment Provider Error",
    message,
    "https://tobeehonest.com/problems/fulfillment-provider-error"
  );
}

async function accessToken(config, fetchImpl) {
  const credentialKey = `${config.clientId}\u0000${config.refreshToken}`;
  if (cachedCredentialKey === credentialKey && cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
    client_id: config.clientId
  });
  const response = await fetchImpl(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    console.error("qpmn token refresh failed:", response.status, JSON.stringify(payload).slice(0, 500));
    throw providerError(payload?.message || "QPMN authentication failed.");
  }

  const expiresInSeconds = Number(payload.expires_in);
  cachedAccessToken = payload.access_token;
  cachedCredentialKey = credentialKey;
  cachedAccessTokenExpiresAt = Date.now()
    + (Number.isFinite(expiresInSeconds) ? expiresInSeconds * 1000 : 3600 * 1000)
    - 60 * 1000;
  return cachedAccessToken;
}

function normalizeOrder(payload, context) {
  if (Number(payload?.code) !== 200 || !payload?.data?.order) {
    console.error(`qpmn ${context} failed:`, JSON.stringify(payload).slice(0, 500));
    throw providerError(payload?.message || `QPMN did not ${context} the order.`);
  }
  const { id, number, status } = payload.data.order;
  return { id, number, status };
}

async function partnerRequest(url, { method, body, fetchImpl, config }) {
  const token = await accessToken(config, fetchImpl);
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("qpmn call failed:", method, url, response.status, JSON.stringify(payload).slice(0, 500));
    throw providerError(payload?.message || "QPMN did not accept the request.");
  }
  return payload;
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
    ...(address.line2 ? { address_2: address.line2 } : {}),
    city: address.city,
    ...(address.state ? { state: address.state } : {}),
    postcode: address.postalCode,
    country: address.country,
    ...(recipient.email ? { email: recipient.email } : {}),
    ...(recipient.phone ? { phone: recipient.phone } : {})
  };
}

export async function createQpmnOrder({
  checkoutSessionId,
  recipient,
  quantity,
  resalePrice,
  fetchImpl = fetch
} = {}) {
  const config = qpmnConfig();
  const address = wooAddress(recipient);
  const payload = {
    set_paid: false,
    line_items: [{
      product_id: config.productId,
      qty: quantity,
      meta_data: [
        { key: "qpmn_partner_resale_price", value: String(resalePrice) },
        { key: "qpmn_partner_order_item_id", value: `${checkoutSessionId}-deck` },
        { key: "qpmn_partner_order_item_qty", value: quantity },
        { key: "qpmn_partner_design_id", value: config.designId }
      ]
    }],
    billing: { ...address },
    shipping: { ...address },
    meta_data: [
      { key: "qpmn_partner_store_url", value: "https://tobeehonest.com" },
      { key: "qpmn_partner_order_id", value: checkoutSessionId },
      { key: "qpmn_partner_order_currency", value: "USD" }
    ]
  };
  const response = await partnerRequest(PARTNER_ORDER_URL, {
    method: "POST", body: payload, fetchImpl, config
  });
  return normalizeOrder(response, "create");
}

export const QPMN_ORDER_ID_REGEX = /^[0-9]+$/;

export async function getQpmnOrder(qpmnOrderId, { fetchImpl = fetch } = {}) {
  const config = qpmnConfig();
  if (!QPMN_ORDER_ID_REGEX.test(String(qpmnOrderId ?? ""))) {
    throw new Problem(400, "Invalid Order Id", "The QPMN order id is not a recognized shape.");
  }
  const response = await partnerRequest(`${PARTNER_ORDER_URL}/${encodeURIComponent(qpmnOrderId)}`, {
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
