import { z } from "zod";
import { Problem } from "./http.js";
import { isKnownArtworkSlug } from "./artwork-allowlist.js";

export const checkoutSchema = z.object({
  product: z.enum(["deck", "framed-art"]),
  artworkId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(),
  size: z.enum(["12x16", "20x28"]).optional(),
  frameColor: z.enum(["gold", "second"]).optional(),
  quantity: z.number().int().min(1).max(10).default(1)
}).strict().superRefine((value, ctx) => {
  if (value.product === "framed-art") {
    for (const field of ["artworkId", "size", "frameColor"]) {
      if (!value[field]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${field} is required for framed art` });
    }
  }
});

const variants = {
  "12x16:gold": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X16_GOLD", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X16_GOLD" },
  "12x16:second": { stripePriceEnv: "STRIPE_PRICE_FRAME_12X16_SECOND", prodigiSkuEnv: "PRODIGI_SKU_FRAME_12X16_SECOND" },
  "20x28:gold": { stripePriceEnv: "STRIPE_PRICE_FRAME_20X28_GOLD", prodigiSkuEnv: "PRODIGI_SKU_FRAME_20X28_GOLD" },
  "20x28:second": { stripePriceEnv: "STRIPE_PRICE_FRAME_20X28_SECOND", prodigiSkuEnv: "PRODIGI_SKU_FRAME_20X28_SECOND" }
};

function configured(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Problem(503, "Catalog Pending Approval", `${name} has not been approved and configured.`, "https://tobeehonest.com/problems/catalog-pending-approval");
  return value;
}

export function resolveCheckoutItem(input) {
  if (input.product === "deck") {
    return {
      vendor: "qpmn",
      product: "deck",
      stripePriceId: configured("STRIPE_PRICE_DECK"),
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
    vendorSku: configured(variant.prodigiSkuEnv),
    quantity: input.quantity,
    metadata: {
      product: "framed-art",
      artworkId: input.artworkId,
      size: input.size,
      frameColor: input.frameColor
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
