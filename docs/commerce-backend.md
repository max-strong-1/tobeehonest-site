# Commerce backend scaffold

This server-side scaffold separates payment from fulfillment and defaults to disabled/sandbox behavior.

## Flow

1. `POST /api/checkout` accepts only a product identifier, approved variant identifiers, an artwork slug, and quantity.
2. The server maps those identifiers to Stripe Price IDs and vendor SKUs. The browser cannot set price, SKU, or asset URL.
3. Stripe collects payment, the US shipping address, and (for the Sun Bird puzzle) the configured shipping charge and phone number.
4. `POST /api/webhooks/stripe` verifies the raw-body Stripe signature.
5. Only a verified, paid Checkout Session can reach fulfillment, and only when `COMMERCE_FULFILLMENT_ENABLED=true`.
6. Prodigi defaults to its v4 sandbox. The Stripe Checkout Session ID becomes the Prodigi idempotency key.
7. QPMN intentionally fails closed until its official order schema, authentication, webhook behavior, and test endpoint are supplied.
8. The Sun Bird puzzle intentionally resolves to the unsupported `puzzle-custom` vendor until its custom fulfillment API contract is implemented. This lets Checkout be tested without pretending fulfillment is ready.

## Approval gates

All of these require explicit approval before configuration or enablement:

- final deck SKU and Stripe Price ID;
- Sun Bird puzzle fulfillment SKU, Stripe Price ID, US Shipping Rate ID, price, shipping charge, and custom fulfillment API contract;
- both framed-art sizes, both frame colors, all four Prodigi SKUs, and prices;
- public production artwork URL contract;
- QPMN official integration contract and credentials;
- `COMMERCE_CATALOG_APPROVED=true`;
- `COMMERCE_CHECKOUT_ENABLED=true`;
- `COMMERCE_VENDOR_MODE=live`;
- `COMMERCE_FULFILLMENT_ENABLED=true`;
- Vercel environment variables and deployment;
- creation of live Stripe products, charges, or vendor orders.

Do not enable live fulfillment merely because checkout is enabled. Test Stripe and Prodigi sandbox end to end first.

## Local verification

```sh
npm install
npm test
```

Copy `.env.example` to `.env.local` for local configuration. Never commit `.env.local` or real credentials.

## Open contract work

- Confirm QPMN's current official order API documentation with vendor access.
- Implement the Sun Bird puzzle `puzzle-custom` adapter only after its custom API endpoint, authentication, idempotency, request schema, response schema, and error/retry behavior are supplied.
- Confirm Prodigi's precise framed-product SKUs and the second frame color.
- Confirm the Stripe account, currency, prices, tax behavior, shipping charges, refund policy, and customer support copy.
- Select an order/status datastore before persisting fulfillment events.
- Confirm Prodigi's current webhook signature header/algorithm before enabling that callback. The receiver is present but must remain unregistered until verified.
