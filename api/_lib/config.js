import { Problem } from "./http.js";

export function envFlag(name) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Problem(503, "Integration Not Configured", `${name} is not configured.`, "https://tobeehonest.com/problems/integration-not-configured");
  return value;
}

export function requireEnabled(name, message) {
  if (!envFlag(name)) throw new Problem(503, "Feature Not Enabled", message, "https://tobeehonest.com/problems/feature-not-enabled");
}

export function vendorMode() {
  const mode = process.env.COMMERCE_VENDOR_MODE || "sandbox";
  if (!["sandbox", "live"].includes(mode)) throw new Problem(500, "Invalid Configuration", "COMMERCE_VENDOR_MODE must be sandbox or live.");
  return mode;
}
