import test from "node:test";
import assert from "node:assert/strict";
import {
  tokenFromHeaders,
  tokenFromUrl,
  platformFromHost,
  viewerFromLocation,
  validVolumeId,
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
  assert.equal(tokenFromUrl("https://x/?tokenId=%zz"), null, "malformed % must not throw");
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

test("viewerFromLocation rejects crafted or malformed volumeIds", () => {
  // %2F reintroduces a slash after decoding — must not reach URL construction
  assert.equal(viewerFromLocation("young.hubscuola.it", "/viewer/bad%2F..%2Fadmin"), null);
  assert.equal(viewerFromLocation("young.hubscuola.it", "/viewer/100%zz"), null, "malformed %");
  assert.equal(viewerFromLocation("young.hubscuola.it", "/viewer/"), null);
  assert.ok(validVolumeId("5f78d2a1-4b3c_4d5e.9"));
  assert.ok(!validVolumeId("../etc"));
  assert.ok(!validVolumeId(""));
});
