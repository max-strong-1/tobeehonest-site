import { z } from "zod";
import { Problem } from "./http.js";
import { isKnownArtworkSlug } from "./artwork-allowlist.js";

export const checkoutSchema = z.object({
  product: z.enum(["deck", "framed-art", "puzzle"]),
  artworkId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(),
  size: z.enum(["12x16", "12x18", "20x28"]).optional(),
  frameColor: z.enum(["gold", "second"]).optional(),
  mat: z.enum(["White", "Black"]).optional(),
  shipping: z.enum(["us", "international"]).default("us"),
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
  "12x16:gold": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X16_GOLD", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X16_GOLD", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_12X16" },
  "12x16:second": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X16_SECOND", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X16_SECOND", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_12X16" },
  /* 12x18 print rides in the 16x24 mounted frame (no 16x22 in Prodigi's range);
   * fitPrintArea letterboxes the 2:3 art in the 12x20 print area — the extra
   * white blends into the snow-white mat. */
  "12x18:gold": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X18_GOLD", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X18_GOLD", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_16X24", sizing: "fitPrintArea" },
  "12x18:second": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X18_SECOND", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X18_SECOND", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_16X24", sizing: "fitPrintArea" },
  "20x28:gold": { stripePriceEnv: "STRIPE_PRICE_FRAME_20X28_GOLD", prodigiSkuEnv: "PRODIGI_SKU_FRAME_20X28_GOLD", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_20X28" },
  "20x28:second": { stripePriceEnv: "STRIPE_PRICE_FRAME_20X28_SECOND", prodigiSkuEnv: "PRODIGI_SKU_FRAME_20X28_SECOND", shippingRateEnv: "STRIPE_SHIPPING_RATE_FRAME_20X28" }
};

/* Shipping zones. US has Standard + Express; UK/EU/AU/APAC is cheap because
 * Prodigi prints in-region. Canada is deliberately NOT served (Kel 2026-08-18):
 * no Prodigi facility there and frames ship at ~$95 — allowed_countries keeps
 * CA addresses out entirely. */
export const ZONE_COUNTRIES = {
  us: ["US"],
  international: ["GB", "IE", "FR", "DE", "ES", "IT", "NL", "BE", "AT", "PT", "DK", "SE", "NO", "FI", "CH", "PL", "CZ", "AU", "NZ", "JP", "SG"]
};

/* Per-zone shipping-rate env suffixes; the base name comes from the variant.
 * US gets two options (customer picks Standard or Express at Stripe checkout). */
function zoneRates(baseEnv, zone) {
  if (zone === "international") return [configured(`${baseEnv}_INTL`)];
  return [configured(`${baseEnv}_US`), configured(`${baseEnv}_US_EXPRESS`)];
}

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
      stripeShippingRateIds: zoneRates("STRIPE_SHIPPING_RATE_PUZZLE", input.shipping),
      allowedCountries: ZONE_COUNTRIES[input.shipping],
      vendorSku: configured("PRODIGI_SKU_PUZZLE_SUN_BIRD"),
      quantity: input.quantity,
      metadata: { product: "puzzle", artworkId: "sun-bird", pieceCount: "1000", shippingZone: input.shipping }
    };
  }

  if (input.product === "deck") {
    return {
      vendor: "qpmn",
      product: "deck",
      stripePriceId: configured("STRIPE_PRICE_DECK"),
      stripeShippingRateIds: zoneRates("STRIPE_SHIPPING_RATE_DECK", input.shipping),
      allowedCountries: ZONE_COUNTRIES[input.shipping],
      vendorSku: configured("QPMN_DECK_SKU"),
      quantity: input.quantity,
      metadata: { product: "deck", shippingZone: input.shipping }
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
    stripeShippingRateIds: zoneRates(variant.shippingRateEnv, input.shipping),
    allowedCountries: ZONE_COUNTRIES[input.shipping],
    vendorSku: configured(variant.prodigiSkuEnv),
    ...(variant.sizing ? { sizing: variant.sizing } : {}),
    quantity: input.quantity,
    metadata: {
      product: "framed-art",
      artworkId: input.artworkId,
      size: input.size,
      frameColor: input.frameColor,
      shippingZone: input.shipping,
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
