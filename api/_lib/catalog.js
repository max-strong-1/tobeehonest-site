import { z } from "zod";
import { Problem } from "./http.js";
import { isKnownArtworkSlug } from "./artwork-allowlist.js";

export const checkoutSchema = z.object({
  product: z.enum(["deck", "framed-art", "puzzle"]),
  artworkId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(),
  size: z.enum(["12x16", "12x18", "20x28"]).optional(),
  frameColor: z.enum(["gold", "second"]).optional(),
  mat: z.enum(["White", "Black"]).optional(),
  quantity: z.number().int().min(1).max(10).default(1)
}).strict().superRefine((value, ctx) => {
  if (value.product === "framed-art") {
    for (const field of ["artworkId", "size", "frameColor"]) {
      if (!value[field]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${field} is required for framed art` });
    }
  }
});

/* Shipping rates are per frame SIZE — color is a Prodigi attribute and does not
 * change the shipment, so both colors of a size share one Stripe rate. */
const variants = {
  "12x16:gold": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X16_GOLD", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X16_GOLD", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_12X16_US" },
  "12x16:second": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X16_SECOND", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X16_SECOND", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_12X16_US" },
  /* 12x18 print rides in the 16x24 mounted frame (no 16x22 in Prodigi's range);
   * fitPrintArea letterboxes the 2:3 art in the 12x20 print area — the extra
   * white blends into the snow-white mat. */
  "12x18:gold": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X18_GOLD", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X18_GOLD", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_16X24_US", sizing: "fitPrintArea" },
  "12x18:second": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X18_SECOND", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X18_SECOND", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_16X24_US", sizing: "fitPrintArea" },
  "20x28:gold": { stripePriceEnv: "STRIPE_PRICE_FRAME_20X28_GOLD", prodigiSkuEnv: "PRODIGI_SKU_FRAME_20X28_GOLD", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_20X28_US" },
  "20x28:second": { stripePriceEnv: "STRIPE_PRICE_FRAME_20X28_SECOND", prodigiSkuEnv: "PRODIGI_SKU_FRAME_20X28_SECOND", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_20X28_US" }
};

function configured(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Problem(503, "Catalog Pending Approval", `${name} has not been approved and configured.`, "https://tobeehonest.com/problems/catalog-pending-approval");
  return value;
}

export function resolveCheckoutItem(input) {
  if (input.product === "puzzle") {
    return {
      vendor: "prodigi",
      product: "puzzle",
      stripePriceId: configured("STRIPE_PRICE_PUZZLE_SUN_BIRD"),
      stripeShippingRateId: configured("STRIPE_SHIPPING_RATE_PUZZLE_US"),
      vendorSku: configured("PRODIGI_SKU_PUZZLE_SUN_BIRD"),
      quantity: input.quantity,
      metadata: { product: "puzzle", artworkId: "sun-bird", pieceCount: "1000" }
    };
  }

  if (input.product === "deck") {
    return {
      vendor: "qpmn",
      product: "deck",
      stripePriceId: configured("STRIPE_PRICE_DECK"),
      stripeShippingRateId: configured("STRIPE_SHIPPING_RATE_DECK_US"),
      vendorSku: configured("QPMN_DECK_SKU"),
      quantity: input.quantity,
      metadata: { product: "deck" }
    };
  }

  if (!isKnownArtworkSlug(input.artworkId)) {
    throw new Problem(422, "Unknown Artwork", "That artwork is not in the approved gallery catalog.", "https://tobeehonest.com/problems/unknown-artwork");
  }

  const key = `${input.size}:${input.frameColor}`;
  const variant = variants[key];
  if (!variant) throw new Problem(422, "Unsupported Variant", "That framed-art combination is not supported.");
  return {
    vendor: "prodigi",
    product: "framed-art",
    stripePriceId: configured(variant.stripePriceEnv),
    stripeShippingRateId: configured(variant.shippingRateEnv),
    vendorSku: configured(variant.prodigiSkuEnv),
    ...(variant.sizing ? { sizing: variant.sizing } : {}),
    quantity: input.quantity,
    metadata: {
      product: "framed-art",
      artworkId: input.artworkId,
      size: input.size,
      frameColor: input.frameColor,
      ...(input.mat ? { mat: input.mat } : {})
    }
  };
}

export function parseCheckoutInput(body) {
  const result = checkoutSchema.safeParse(body);
  if (!result.success) {
    throw new Problem(400, "Validation Error", "One or more checkout fields are invalid.", "https://tobeehonest.com/problems/validation-error", result.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message })));
  }
  return result.data;
}
