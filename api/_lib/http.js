export class Problem extends Error {
  constructor(status, title, detail, type = "about:blank", errors) {
    super(detail);
    this.status = status;
    this.title = title;
    this.type = type;
    this.errors = errors;
  }
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

export function sendProblem(req, res, problem) {
  const known = problem instanceof Problem;
  const status = known ? problem.status : 500;
  const title = known ? problem.title : "Internal Server Error";
  const detail = known ? problem.message : "The request could not be completed.";
  sendJson(res, status, {
    type: known ? problem.type : "https://tobeehonest.com/problems/internal-error",
    title,
    status,
    detail,
    instance: req.url,
    ...(known && problem.errors ? { errors: problem.errors } : {})
  });
}

export function allowMethods(req, methods) {
  if (!methods.includes(req.method)) {
    throw new Problem(405, "Method Not Allowed", `Use ${methods.join(" or ")} for this endpoint.`, "https://tobeehonest.com/problems/method-not-allowed");
  }
}

export async function readRawBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Problem(413, "Payload Too Large", "The request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRawBody(req);
  try {
    return JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    throw new Problem(400, "Invalid JSON", "The request body must be valid JSON.", "https://tobeehonest.com/problems/invalid-json");
  }
}
