import { Problem, allowMethods, readJson, sendJson, sendProblem } from "./_lib/http.js";
import { createRecord, uploadAttachment } from "./_lib/airtable.js";

const TABLE_ID = process.env.AIRTABLE_MARKETPLACE_TABLE_ID || "tbl3XaHLIZlkriMNb";

/* Everything addresses Airtable by field ID, not display name: Nicolas owns this base
   and renaming a column in the UI must not silently break the public form. */
const F = {
  itemTitle: "fldVSg18ZHBvz5446",
  submitterName: "fld7IHXUyKeEXYxCb",
  submitterEmail: "fldGDfcCb4vPmSCJB",
  submitterPhone: "fldAe2FSiKgCB2q7R",
  itemDescription: "fldadBUtd38JfqVKE",
  category: "fldzak31kmrQhvi43",
  askingPrice: "fldhxQu1opnCr5uyf",
  businessStatus: "fldKw8MvCvDzs2ys3",
  businessName: "fldsohCbviVz3UfaV",
  businessStructure: "fldkdbnMCXlYr7aYg",
  links: "fld8UHg9I1N2VdwvE",
  availability: "fldSWZdIYFEwe8YDm",
  shipsFrom: "fldNhC4U1XZbGv4ZY",
  whoShips: "fldV6asl9zrZz0mtz",
  ownsRights: "fld4P9SPixoZbyXtA",
  status: "fldVivOGBOWxUa6iy",
  submissionSource: "fldBkO9u0UNrzTcmU",
  submittedDate: "fldETvPVyc7q6ePTN"
};

const ATTACHMENT_FIELDS = {
  photos: "fldLAUlhwTWfFJavw",       // Photos
  proofOfWork: "fld5NgbXKHI7A1SG6",  // Proof of Work
  businessProof: "fldchLvCbSIXnR4Su" // Business Proof
};

const CATEGORIES = ["Art", "Craft", "Apparel", "Other"];
const BUSINESS_STATUS = ["Registered business", "Individual creator / hobbyist", "Registration in progress"];
const BUSINESS_STRUCTURE = ["Sole proprietor", "LLC", "Corporation (S or C)", "Partnership", "Not registered"];
const AVAILABILITY = [
  "One-of-a-kind (single piece)",
  "Made to order",
  "Small batch in stock",
  "Bulk stock available"
];
const WHO_SHIPS = ["Seller ships direct", "Needs To Bee Honest to ship", "Not sure yet"];

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_DOC_TYPES = new Set([...ALLOWED_IMAGE_TYPES, "application/pdf"]);

const MAX_FILES_PER_FIELD = 6;
/* Vercel's serverless function body limit is ~4.5MB — that's the real ceiling for the
   whole JSON payload, so per-file and total caps must fit under it (base64 inflates ~33%). */
const MAX_FILE_BYTES = 3_000_000;
const MAX_TOTAL_UPLOAD_BYTES = 4_000_000;

function text(value, { max, label, required = false }) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw new Problem(400, "Missing Field", `${label} is required.`);
    return "";
  }
  if (trimmed.length > max) {
    throw new Problem(400, "Field Too Long", `${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

function choice(value, allowed, label, { required = false } = {}) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw new Problem(400, "Missing Field", `${label} is required.`);
    return "";
  }
  if (!allowed.includes(trimmed)) {
    throw new Problem(400, "Invalid Value", `${label} is not one of the accepted options.`);
  }
  return trimmed;
}

function email(value) {
  const trimmed = text(value, { max: 200, label: "Email", required: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    throw new Problem(400, "Invalid Email", "Please enter a valid email address.");
  }
  return trimmed;
}

function money(value, label) {
  if (value === "" || value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0 || num > 1_000_000) {
    throw new Problem(400, "Invalid Value", `${label} must be a number between 0 and 1,000,000.`);
  }
  return Math.round(num * 100) / 100;
}

/* Decoded byte length of a base64 string, without allocating the buffer. */
function base64Bytes(b64) {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function normalizeFiles(raw, { label, allowedTypes }) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (raw.length > MAX_FILES_PER_FIELD) {
    throw new Problem(400, "Too Many Files", `${label}: please attach ${MAX_FILES_PER_FIELD} files or fewer.`);
  }

  return raw.map((entry, index) => {
    const filename = text(entry?.filename, { max: 200, label: `${label} filename`, required: true });
    const contentType = text(entry?.contentType, { max: 100, label: `${label} file type`, required: true });
    const file = typeof entry?.file === "string" ? entry.file.replace(/^data:[^;]+;base64,/, "") : "";

    if (!allowedTypes.has(contentType)) {
      throw new Problem(400, "Unsupported File", `${label}: ${contentType} files aren't accepted.`);
    }
    if (!file || !/^[A-Za-z0-9+/=\r\n]+$/.test(file)) {
      throw new Problem(400, "Invalid File", `${label}: file ${index + 1} could not be read.`);
    }

    const bytes = base64Bytes(file.replace(/\s/g, ""));
    if (bytes > MAX_FILE_BYTES) {
      throw new Problem(413, "File Too Large", `${label}: each file must be under 3 MB.`);
    }

    return { filename, contentType, file: file.replace(/\s/g, ""), bytes };
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    allowMethods(req, ["POST"]);
    const body = await readJson(req, 4_500_000);

    /* Honeypot: a real person never fills a hidden field. */
    if (text(body.company_website, { max: 200, label: "Ignore" })) {
      return sendJson(res, 202, { ok: true, recordId: null });
    }

    const businessStatus = choice(body.businessStatus, BUSINESS_STATUS, "Business status", { required: true });
    const isRegistered = businessStatus === "Registered business";

    if (body.ownsRights !== true) {
      throw new Problem(
        400,
        "Confirmation Required",
        "Please confirm you made this work or hold the rights to sell it."
      );
    }

    const photos = normalizeFiles(body.photos, { label: "Photos", allowedTypes: ALLOWED_IMAGE_TYPES });
    const proofOfWork = normalizeFiles(body.proofOfWork, { label: "Proof of work", allowedTypes: ALLOWED_IMAGE_TYPES });
    const businessProof = normalizeFiles(body.businessProof, { label: "Business proof", allowedTypes: ALLOWED_DOC_TYPES });

    if (photos.length === 0) throw new Problem(400, "Missing Photos", "Please attach at least one photo of the item.");
    if (proofOfWork.length === 0) {
      throw new Problem(400, "Missing Proof", "Please attach at least one proof-of-work photo so we can see it's yours.");
    }

    const allFiles = [...photos, ...proofOfWork, ...businessProof];
    const totalBytes = allFiles.reduce((sum, f) => sum + f.bytes, 0);
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      throw new Problem(413, "Upload Too Large", "Please keep total attachments under 18 MB.");
    }

    const fields = {
      [F.itemTitle]: text(body.itemTitle, { max: 200, label: "Item title", required: true }),
      [F.submitterName]: text(body.submitterName, { max: 200, label: "Your name", required: true }),
      [F.submitterEmail]: email(body.submitterEmail),
      [F.submitterPhone]: text(body.submitterPhone, { max: 40, label: "Phone", required: true }),
      [F.itemDescription]: text(body.itemDescription, { max: 5000, label: "Item description", required: true }),
      [F.category]: choice(body.category, CATEGORIES, "Category", { required: true }),
      [F.businessStatus]: businessStatus,
      [F.businessName]: text(body.businessName, { max: 200, label: "Business name", required: isRegistered }),
      [F.links]: text(body.links, { max: 2000, label: "Website or social links" }),
      [F.availability]: choice(body.availability, AVAILABILITY, "Availability", { required: true }),
      [F.shipsFrom]: text(body.shipsFrom, { max: 200, label: "Ships from", required: true }),
      [F.whoShips]: choice(body.whoShips, WHO_SHIPS, "Who ships it", { required: true }),
      [F.ownsRights]: true,
      [F.status]: "Submitted",
      [F.submissionSource]: "Website form",
      [F.submittedDate]: today()
    };

    const structure = choice(body.businessStructure, BUSINESS_STRUCTURE, "Business structure", {
      required: isRegistered
    });
    if (structure) fields[F.businessStructure] = structure;

    const price = money(body.askingPrice, "Asking price");
    if (price !== null) fields[F.askingPrice] = price;

    const record = await createRecord(TABLE_ID, fields);
    if (!record?.id) throw new Problem(502, "Upstream Error", "The submission could not be saved.");

    /* Attachments upload one at a time against the created record. A failure here
       leaves a real submission with missing files — better than losing the lead,
       so we report which groups landed instead of rolling the record back. */
    const uploaded = { photos: 0, proofOfWork: 0, businessProof: 0 };
    for (const [key, files] of Object.entries({ photos, proofOfWork, businessProof })) {
      for (const file of files) {
        try {
          await uploadAttachment(record.id, ATTACHMENT_FIELDS[key], file);
          uploaded[key] += 1;
        } catch (err) {
          console.error("[marketplace-submit] attachment failed", key, file.filename, err?.message);
        }
      }
    }

    return sendJson(res, 201, { ok: true, recordId: record.id, uploaded });
  } catch (err) {
    return sendProblem(req, res, err);
  }
}
