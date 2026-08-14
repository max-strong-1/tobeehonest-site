import test from "node:test";
import assert from "node:assert/strict";

const checkoutModule = await import("../assets/web/stripe-checkout.js").catch(() => ({}));

test("browser checkout helper exists", () => {
  assert.equal(typeof checkoutModule.startStripeCheckout, "function");
});

test("browser checkout button binder exists", () => {
  assert.equal(typeof checkoutModule.bindStripeCheckoutButton, "function");
});

test("checkout button reports configuration errors and restores its ready state", async () => {
  let clickHandler;
  const attributes = new Map();
  const button = {
    textContent: "Buy the Sun Bird puzzle",
    disabled: false,
    addEventListener: (type, handler) => {
      if (type === "click") clickHandler = handler;
    },
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name)
  };
  const errorBox = { hidden: true, textContent: "" };

  checkoutModule.bindStripeCheckoutButton({
    button,
    errorBox,
    product: "puzzle",
    startCheckout: async () => {
      throw new Error("The product catalog still requires approval.");
    }
  });
  await clickHandler();

  assert.equal(errorBox.hidden, false);
  assert.match(errorBox.textContent, /catalog still requires approval/i);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Buy the Sun Bird puzzle");
  assert.equal(attributes.has("aria-busy"), false);
});

test("puzzle checkout posts the trusted product selection and redirects to Stripe", async () => {
  let request;
  let destination;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      })
    };
  };

  await checkoutModule.startStripeCheckout({
    product: "puzzle",
    quantity: 1,
    idempotencyKey: "puzzle-test-id",
    fetchImpl,
    navigate: (url) => { destination = url; }
  });

  assert.equal(request.url, "/api/checkout");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.equal(request.options.headers["Idempotency-Key"], "puzzle-test-id");
  assert.equal(request.options.body, JSON.stringify({ product: "puzzle", quantity: 1 }));
  assert.equal(destination, "https://checkout.stripe.com/c/pay/cs_test_123");
});

test("checkout surfaces the server's fail-closed configuration message", async () => {
  let navigated = false;

  await assert.rejects(
    checkoutModule.startStripeCheckout({
      product: "puzzle",
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        json: async () => ({ detail: "The product catalog still requires approval." })
      }),
      navigate: () => { navigated = true; }
    }),
    /catalog still requires approval/i
  );

  assert.equal(navigated, false);
});

test("checkout refuses a non-Stripe redirect returned by the API", async () => {
  let navigated = false;

  await assert.rejects(
    checkoutModule.startStripeCheckout({
      product: "puzzle",
      fetchImpl: async () => ({
        ok: true,
        status: 201,
        json: async () => ({ url: "https://example.test/not-stripe" })
      }),
      navigate: () => { navigated = true; }
    }),
    /valid Stripe checkout URL/i
  );

  assert.equal(navigated, false);
});

test("checkout replaces a non-JSON server failure with a customer-safe message", async () => {
  await assert.rejects(
    checkoutModule.startStripeCheckout({
      product: "puzzle",
      fetchImpl: async () => ({
        ok: false,
        status: 502,
        json: async () => { throw new SyntaxError("unexpected HTML"); }
      }),
      navigate: () => {}
    }),
    /checkout is temporarily unavailable/i
  );
});
