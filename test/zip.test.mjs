import test from "node:test";
import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { signatureHex, assertZip, findEntry, pdfsFromZip } from "../src/lib/zip.js";

test("signatureHex reads the ZIP magic", () => {
  assert.equal(signatureHex(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), "504b0304");
});

test("assertZip rejects an HTML error page", () => {
  const html = new TextEncoder().encode("<html><body>Login</body></html>");
  assert.throws(() => assertZip(html, "publication.zip", { status: 200 }), /not a valid ZIP/);
});

test("assertZip accepts a real zip", () => {
  const z = zipSync({ "a.txt": new Uint8Array([1]) });
  assert.doesNotThrow(() => assertZip(z, "x"));
});

test("findEntry matches by full path or basename", () => {
  const z = zipSync({
    "publication/publication.db": new Uint8Array([7]),
    "other.txt": new Uint8Array([8]),
  });
  assert.ok(findEntry(z, "publication/publication.db"));
  assert.ok(findEntry(z, "publication.db"), "basename match");
  assert.equal(findEntry(z, "missing.bin"), null);
});

test("pdfsFromZip sorts pages numerically, not lexically", () => {
  const z = zipSync({
    "c/1.pdf": new Uint8Array([1]),
    "c/10.pdf": new Uint8Array([10]),
    "c/2.pdf": new Uint8Array([2]),
    "c/notes.txt": new Uint8Array([99]),
  });
  const pdfs = pdfsFromZip(z);
  assert.equal(pdfs.length, 3);
  assert.deepEqual(Array.from(pdfs[0]), [1]);
  assert.deepEqual(Array.from(pdfs[1]), [2]);
  assert.deepEqual(Array.from(pdfs[2]), [10]);
});
