import { z } from "zod";
import { Problem, allowMethods, readJson, sendJson, sendProblem } from "./_lib/http.js";
import { createRecord } from "./_lib/airtable.js";
import { sendOrderAlert } from "./_lib/notify.js";
import { isKnownArtworkTitle } from "./_lib/artwork-allowlist.js";

const GALLERY_TABLE_ID = process.env.AIRTABLE_GALLERY_TABLE_ID || "tblircNYKsWQXFEa3";
const DECK_TABLE_ID = process.env.AIRTABLE_DECK_TABLE_ID || "tblVEa5PvIY9GIhMR";
/* Commissions and the waitlist have no Airtable table yet — that is still on Nicolas.
   Deliberately NOT defaulted to a table id: writing a commission into the deck-orders
   table would be worse than not writing it. When either env var is absent the request
   still succeeds and still emails, so the form works today and starts recording the
   moment a table exists. */
const COMMISSION_TABLE_ID = process.env.AIRTABLE_COMMISSION_TABLE_ID || null;
const HIVE_TABLE_ID = process.env.AIRTABLE_HIVE_TABLE_ID || null;

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
  /* PRINT sizes — the artwork the customer receives, not the glaze/frame size.
     Prodigi's mount adds a fixed 2" border per side, so glaze = print + 4".
     Must stay byte-identical with index.html's TBH_PRICES keys and the Airtable
     Size select — fulfillment joins on these exact strings. */
  size: z.enum(["8x12", "12x18", "16x24"]),
  /* The Gallery hangs the work bare and the viewer is where it gets dressed, so
     unframed and unmounted are real, orderable outcomes — "No frame"/"No mat" are
     products, not missing values. "Brown" is the walnut Classic moulding.
     These strings are written straight into Airtable, so they must stay byte-identical
     with the viewer's FRAMES/MATS values in index.html. */
  frameColor: z.enum(["No frame", "Brown", "Black", "Antique Gold"]),
  mat: z.enum(["No mat", "White", "Black"]),
  ...base
}).strict();

/* "Make It Yours" — a commissioned piece rebuilt from the visitor's own photo. It is an
   enquiry, not a purchase: no price is quoted and no address is taken, because Nicolas
   scopes each one by hand before anything is agreed. */
export const commissionRequest = z.object({
  product: z.literal("commission"),
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  subject: z.string().trim().min(1).max(200),
  photoDescription: z.string().trim().min(1).max(1200),
  size: z.enum(["Not sure yet", "8x12", "12x18", "16x24", "Larger — let's talk"]),
  timeline: z.enum(["No rush", "Within a month", "It's a gift — I have a date"]),
  budget: z.enum(["Not sure yet", "Under $300", "$300–$600", "$600+"]),
  notes: z.string().trim().max(1200).optional().default("")
}).strict();

/* The hive — the mailing list. One field plus where they came from. */
export const hiveSignup = z.object({
  product: z.literal("hive"),
  customerEmail: z.string().trim().email().max(200),
  source: z.string().trim().max(80).optional().default("site")
}).strict();

/* Optional honeypot field, present on every form — not part of the business schema,
   stripped before validation, checked separately. */
const orderIntentSchema = z.union([deckOrder, galleryOrder, commissionRequest, hiveSignup]);

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

const ID_PREFIX = { gallery: "TBH-G", deck: "TBH-D", commission: "TBH-C", hive: "TBH-H" };

export function makeOrderId(product) {
  return `${ID_PREFIX[product] || "TBH-D"}-${dateStamp()}-${rand4()}`;
}

/* The Airtable `Artwork` field is a linked record we don't resolve at launch, so the
   artwork display name rides inside the Order ID instead; a post-launch automation
   resolves the link. */
export function buildAirtableFields(input, orderId) {
  if (input.product === "commission") {
    return {
      "Order ID": orderId,
      "Customer Name": input.customerName,
      "Customer Email": input.customerEmail,
      "Phone": input.phone,
      "Subject": input.subject,
      "Photo Description": input.photoDescription,
      "Size": input.size,
      "Timeline": input.timeline,
      "Budget": input.budget,
      "Notes": input.notes,
      "Status": "New",
      "Order Date": today()
    };
  }
  if (input.product === "hive") {
    return {
      "Order ID": orderId,
      "Customer Email": input.customerEmail,
      "Source": input.source,
      "Status": "New",
      "Order Date": today()
    };
  }
  if (input.product === "gallery") {
    return {
      "Order ID": `${orderId} · ${input.artwork}`,
      /* Was hardcoded "Framed" back when framed was the only outcome. An unframed print
         is now orderable, and fulfillment picks a different Prodigi SKU for it, so this
         has to follow what the customer actually chose. */
      "Format": input.frameColor === "No frame" ? "Print only" : "Framed",
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
  if (input.product === "commission") {
    return [
      "Product: Make It Yours (commission enquiry)",
      `From: ${input.customerName} <${input.customerEmail}>`,
      `Phone: ${input.phone || "—"}`,
      `Subject: ${input.subject}`,
      `Size: ${input.size}   Timeline: ${input.timeline}   Budget: ${input.budget}`,
      "",
      "The photo, in their words:",
      input.photoDescription,
      input.notes ? `\nNotes:\n${input.notes}` : "",
      `\nRef: ${orderId}`,
      "",
      "No price quoted, no address taken — reply to scope it."
    ].join("\n");
  }
  if (input.product === "hive") {
    return [
      "New hive signup",
      `Email: ${input.customerEmail}`,
      `From: ${input.source}`,
      `Ref: ${orderId}`
    ].join("\n");
  }
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

/* Gallery orders name artwork by display title (no slug field in this
   contract — see api/_lib/artwork-allowlist.js). Reject anything that isn't
   one of the approved gallery pieces before it reaches Airtable. No-op for
   deck orders, which have no artwork field. */
export function assertKnownArtwork(input) {
  if (input.product === "gallery" && !isKnownArtworkTitle(input.artwork)) {
    throw new Problem(
      422,
      "Unknown Artwork",
      "That artwork is not in the approved gallery catalog.",
      "https://tobeehonest.com/problems/unknown-artwork"
    );
  }
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
    assertKnownArtwork(input);

    const baseOrderId = makeOrderId(input.product);
    const fields = buildAirtableFields(input, baseOrderId);
    const orderId = fields["Order ID"];
    const TABLES = {
      gallery: GALLERY_TABLE_ID,
      deck: DECK_TABLE_ID,
      commission: COMMISSION_TABLE_ID,
      hive: HIVE_TABLE_ID
    };
    const tableId = TABLES[input.product];

    /* Commissions and hive signups have no table yet. Rather than fail the visitor's
       submission over Nicolas's pending Airtable work, they go out by email alone and
       start recording automatically the day the env var is set. Purchases are NOT given
       this treatment — an order that isn't written down is a lost order. */
    if (tableId) {
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
    } else if (input.product === "gallery" || input.product === "deck") {
      throw new Problem(503, "Not Configured", "Orders cannot be taken right now.");
    }

    try {
      await sendOrderAlert({
        subject: `New ${input.product} order intent — ${orderId}`,
        text: alertText(input, orderId)
      });
    } catch (err) {
      console.error("[order-intent] alert failed", err?.message);
      /* When there is no table, the email IS the record. Swallowing a failed send here
         would tell the visitor their commission was received and leave no trace of it
         anywhere. For the products that do write to Airtable, a failed alert is still
         only a missed notification, so it stays non-fatal. */
      if (!tableId) {
        throw new Problem(
          502,
          "Not Delivered",
          "We couldn't get that to Nicolas. Please try again, or email kel@4manai.com."
        );
      }
    }

    return sendJson(res, 202, { ok: true, orderId });
  } catch (err) {
    return sendProblem(req, res, err);
  }
}
