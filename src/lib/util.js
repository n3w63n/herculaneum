// Shared small helpers (pure, testable in node).

export function preview(value, limit = 500) {
  try {
    const text =
      typeof value === "string"
        ? value
        : value instanceof Uint8Array || value instanceof ArrayBuffer
          ? new TextDecoder().decode(
              value instanceof ArrayBuffer ? new Uint8Array(value) : value.subarray(0, limit * 2)
            )
          : JSON.stringify(value);
    if (!text) return "<empty>";
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  } catch {
    return "<unserializable>";
  }
}

// Same sanitizer the Node tool uses for its output filename.
export function sanitizeFilename(title) {
  return String(title).replace(/[^a-z0-9]/gi, "_");
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
