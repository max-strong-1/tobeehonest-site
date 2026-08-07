import { z } from "zod";
import { Problem, allowMethods, readJson, sendJson, sendProblem } from "./_lib/http.js";
import { createRecord } from "./_lib/airtable.js";
import { sendOrderAlert } from "./_lib/notify.js";

const GALLERY_TABLE_ID = process.env.AIRTABLE_GALLERY_TABLE_ID || "tblircNYKsWQXFEa3";
const DECK_TABLE_ID = process.env.AIRTABLE_DECK_TABLE_ID || "tblVEa5PvIY9GIhMR";

const base = {
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email().max(200),
  shipTo: z.string().trim().min(1).max(600)
};

export const deckOrder = z.object({
  product: z.literal("deck"),
  quantity: z.number().int().min(1).max(10),
  variant: z.enum(["Standard Deck", "Velvet Pouch + Booklet"]),
  ...base
}).strict();

export const galleryOrder = z.object({
  product: z.literal("gallery"),
  artwork: z.string().trim().min(1).max(120),
  size: z.enum(["12x16", "20x28"]),
  frameColor: z.enum(["Black", "Antique Gold"]),
  mat: z.enum(["White", "Black"]),
  ...base
}).strict();

/* Optional honeypot field, present on both order forms (deck and gallery) — not
   part of the business schema, stripped before validation, checked separately. */
const orderIntentSchema = z.union([deckOrder, galleryOrder]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function rand4() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function makeOrderId(product) {
  const prefix = product === "gallery" ? "TBH-G" : "TBH-D";
  return `${prefix}-${dateStamp()}-${rand4()}`;
}

/* The Airtable `Artwork` field is a linked record we don't resolve at launch, so the
   artwork display name rides inside the Order ID instead; a post-launch automation
   resolves the link. */
export function buildAirtableFields(input, orderId) {
  if (input.product === "gallery") {
    return {
      "Order ID": `${orderId} · ${input.artwork}`,
      "Format": "Framed",
      "Size": input.size,
      "Frame Color": input.frameColor,
      "Mat Color": input.mat,
      "Customer Name": input.customerName,
      "Customer Email": input.customerEmail,
      "Ship-To Address": input.shipTo,
      "Status": "New",
      "Order Date": today()
    };
  }
  return {
    "Order ID": orderId,
    "Quantity": input.quantity,
    "Variant": input.variant,
    "Customer Name": input.customerName,
    "Customer Email": input.customerEmail,
    "Ship-To Address": input.shipTo,
    "Status": "New",
    "Order Date": today()
  };
}

/* Airtable returns 422 with one of these error types when a select field is sent a
   value that isn't an existing option and typecast wasn't set. Anything else (network
   failure, 503 config-missing, 502 generic upstream) is not this case and must rethrow. */
const SELECT_VALUE_REJECTION_TYPES = new Set(["INVALID_MULTIPLE_CHOICE_OPTIONS", "INVALID_VALUE_FOR_COLUMN"]);

function isSelectValueRejection(err) {
  return err?.airtableStatus === 422 && SELECT_VALUE_REJECTION_TYPES.has(err?.airtableErrorType);
}

function alertText(input, orderId) {
  const lines = [
    `Product: ${input.product}`,
    input.product === "gallery"
      ? `Artwork: ${input.artwork}`
      : `Variant: ${input.variant}`,
    input.product === "gallery"
      ? `Size/Frame/Mat: ${input.size} / ${input.frameColor} / ${input.mat} mat`
      : `Quantity: ${input.quantity}`,
    `Customer: ${input.customerName} <${input.customerEmail}>`,
    `Ship to: ${input.shipTo}`,
    `Order ID: ${orderId}`,
    "",
    "PLACEHOLDER PRICING IN EFFECT — confirm price with customer before payment link."
  ];
  return lines.join("\n");
}

export default async function handler(req, res) {
  try {
    allowMethods(req, ["POST"]);
    const body = await readJson(req);

    /* Honeypot: a real person never fills a hidden field. */
    if (typeof body.company_website === "string" && body.company_website.trim()) {
      return sendJson(res, 202, { ok: true, orderId: null });
    }
    const { company_website, ...rest } = body;

    const parsed = orderIntentSchema.safeParse(rest);
    if (!parsed.success) {
      throw new Problem(
        400,
        "Invalid Order",
        "The order could not be validated.",
        "https://tobeehonest.com/problems/invalid-order",
        parsed.error.issues
      );
    }
    const input = parsed.data;

    const baseOrderId = makeOrderId(input.product);
    const fields = buildAirtableFields(input, baseOrderId);
    const orderId = fields["Order ID"];
    const tableId = input.product === "gallery" ? GALLERY_TABLE_ID : DECK_TABLE_ID;

    let record;
    try {
      record = await createRecord(tableId, fields);
    } catch (err) {
      /* Only retry with typecast when Airtable specifically rejected a select value
         (e.g. a not-yet-added option) — any other failure (network, bad token,
         real outage) rethrows immediately instead of firing a duplicate write. */
      if (isSelectValueRejection(err)) {
        record = await createRecord(tableId, fields, { typecast: true });
      } else {
        throw err;
      }
    }
    if (!record?.id) throw new Problem(502, "Upstream Error", "The order could not be saved.");

    try {
      await sendOrderAlert({
        subject: `New ${input.product} order intent — ${orderId}`,
        text: alertText(input, orderId)
      });
    } catch (err) {
      console.error("[order-intent] alert failed", err?.message);
    }

    return sendJson(res, 202, { ok: true, orderId });
  } catch (err) {
    return sendProblem(req, res, err);
  }
}
