export async function startStripeCheckout({
  product,
  quantity = 1,
  idempotencyKey = globalThis.crypto?.randomUUID?.() || `${product}-${Date.now()}`,
  fetchImpl = globalThis.fetch,
  navigate = (url) => globalThis.location.assign(url)
}) {
  const response = await fetchImpl("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({ product, quantity })
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    // Vercel or an upstream proxy may return HTML for a transient failure.
  }
  if (!response.ok) {
    throw new Error(body?.detail || "Checkout is temporarily unavailable.");
  }
  let destination;
  try {
    destination = new URL(body?.url);
  } catch {
    throw new Error("Stripe did not return a valid Stripe checkout URL.");
  }
  if (
    destination.protocol !== "https:" ||
    (destination.hostname !== "checkout.stripe.com" && !destination.hostname.endsWith(".stripe.com"))
  ) {
    throw new Error("Stripe did not return a valid Stripe checkout URL.");
  }
  navigate(destination.toString());
  return body;
}

export function bindStripeCheckoutButton({
  button,
  errorBox,
  product,
  startCheckout = startStripeCheckout
}) {
  const readyLabel = button.textContent;

  button.addEventListener("click", async () => {
    errorBox.hidden = true;
    errorBox.textContent = "";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Opening secure checkout…";

    try {
      await startCheckout({ product, quantity: 1 });
    } catch (error) {
      errorBox.textContent = error instanceof Error
        ? error.message
        : "Checkout is temporarily unavailable.";
      errorBox.hidden = false;
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = readyLabel;
    }
  });
}
