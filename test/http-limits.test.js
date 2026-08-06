import { test } from "node:test";
import assert from "node:assert/strict";
import { readJson } from "../api/_lib/http.js";
import { Readable } from "node:stream";

function fakeReq(bytes) {
  const r = Readable.from([bytes]);
  r.headers = { "content-type": "application/json" };
  return r;
}

test("readJson accepts a body over 1MB when a higher limit is passed", async () => {
  const big = Buffer.from(JSON.stringify({ pad: "x".repeat(2_000_000) }));
  const parsed = await readJson(fakeReq(big), 4_500_000);
  assert.equal(parsed.pad.length, 2_000_000);
});

test("readJson still rejects over-limit bodies", async () => {
  const big = Buffer.from(JSON.stringify({ pad: "x".repeat(2_000_000) }));
  await assert.rejects(() => readJson(fakeReq(big)), /413|too large/i);
});
