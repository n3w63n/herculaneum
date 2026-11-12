import test from "node:test";
import assert from "node:assert/strict";
import {
  tokenFromHeaders,
  tokenFromUrl,
  platformFromHost,
  viewerFromLocation,
} from "../src/lib/token.js";

test("tokenFromHeaders finds Token-Session case-insensitively", () => {
  const headers = [
    { name: "accept", value: "*/*" },
    { name: "Token-Session", value: "abc123" },
  ];
  assert.equal(tokenFromHeaders(headers), "abc123");
  assert.equal(tokenFromHeaders([]), null);
  assert.equal(tokenFromHeaders(undefined), null);
});

test("tokenFromUrl reads the tokenId query param", () => {
  assert.equal(
    tokenFromUrl("https://ms-mms.hubscuola.it/public/1/2.zip?tokenId=t%2Fx&app=v2"),
    "t/x"
  );
  assert.equal(tokenFromUrl("https://example.com/"), null);
});

test("platformFromHost maps kids subdomain", () => {
  assert.equal(platformFromHost("kids.hubscuola.it"), "kids");
  assert.equal(platformFromHost("young.hubscuola.it"), "young");
  assert.equal(platformFromHost("www.hubscuola.it"), "young");
});

test("viewerFromLocation extracts volumeId from the reader URL", () => {
  assert.deepEqual(viewerFromLocation("young.hubscuola.it", "/viewer/abc-123?page=1"), {
    platform: "young",
    volumeId: "abc-123",
  });
  assert.equal(viewerFromLocation("kids.hubscuola.it", "/library"), null);
});
