import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeFilename, toDataUrl } from "../src/lib/util.js";

test("sanitizeFilename keeps letters/digits, replaces the rest", () => {
  assert.equal(sanitizeFilename("Il Gioco: Diritti?"), "Il_Gioco__Diritti_");
  assert.equal(sanitizeFilename(""), "");
});

test("toDataUrl matches Buffer base64 at chunk-aligned and unaligned sizes", () => {
  for (const n of [1, 100, 0xc000 * 2, 0xc000 * 2 + 7, 100_000]) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => i % 256);
    const url = toDataUrl(bytes, "My Book.pdf");
    assert.equal(
      url,
      `data:application/pdf;herculaneum-name=My%20Book.pdf;base64,${Buffer.from(bytes).toString("base64")}`,
      `size ${n}`
    );
  }
});

test("toDataUrl encodes filenames that would break the parameter", () => {
  const url = toDataUrl(new Uint8Array([1]), "a;b,c.pdf");
  assert.ok(url.includes("herculaneum-name=a%3Bb%2Cc.pdf;"));
});
