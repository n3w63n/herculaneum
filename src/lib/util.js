// Shared small helpers (pure, testable in node).

// Same sanitizer the Node tool uses for its output filename.
export function sanitizeFilename(title) {
  return String(title).replace(/[^a-z0-9]/gi, "_");
}

// Data URL with the target filename in a parameter: service workers have no
// URL.createObjectURL, and downloads.download treats `filename` as a request
// (Chrome derives "Download.pdf" from data: URLs) — the
// onDeterminingFilename listener reads this marker back. Chunks are divisible
// by 3 so only the final btoa() output carries base64 padding, which is the
// only place padding may appear when concatenating.
export function toDataUrl(bytes, filename) {
  let b64 = "";
  const CHUNK = 0xc000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    b64 += btoa(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  return `data:application/pdf;herculaneum-name=${encodeURIComponent(filename)};base64,${b64}`;
}
