// ZIP handling: magic-number validation (trust boundary) + entry extraction.
import { unzipSync } from "fflate";

const ZIP_SIGNATURES = ["504b0304", "504b0506", "504b0708"];

export function signatureHex(bytes) {
  const head = bytes.subarray(0, 4);
  return Array.from(head)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Never merge bytes we did not verify: an HTML login/error page must not
// silently become a "PDF". Same diagnostics style as the Node tool.
export function assertZip(bytes, label, meta = {}) {
  if (!ZIP_SIGNATURES.includes(signatureHex(bytes))) {
    const details = Object.entries(meta)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    throw new Error(
      `${label} is not a valid ZIP. ${details} Response: ${previewBytes(bytes)}`
    );
  }
}

export function previewBytes(bytes, limit = 500) {
  try {
    const text = new TextDecoder().decode(bytes.subarray(0, limit * 2));
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  } catch {
    return "<binary>";
  }
}

// Find an entry by exact name or suffix (e.g. "publication/publication.db").
export function findEntry(bytes, name) {
  const files = unzipSync(bytes, {
    filter: (file) => file.name === name || file.name.endsWith(`/${name}`),
  });
  const key = Object.keys(files)[0];
  return key ? files[key] : null;
}

// All PDFs in a chapter zip, in natural order (1, 2, 10 — not 1, 10, 2).
// The Node tool missed the sort here; keep the docenti script's numeric sort.
export function pdfsFromZip(bytes) {
  const files = unzipSync(bytes, {
    filter: (file) => file.name.toLowerCase().endsWith(".pdf"),
  });
  return Object.keys(files)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((name) => files[name]);
}
