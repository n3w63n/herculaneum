// Session token capture + page URL detection (pure, testable).

// The web app sends its session as the `Token-Session` request header on
// every ms-api/ms-mms call; we mirror that from live traffic.
export function tokenFromHeaders(requestHeaders) {
  if (!Array.isArray(requestHeaders)) return null;
  const hit = requestHeaders.find(
    (h) => h && typeof h.name === "string" && h.name.toLowerCase() === "token-session" && h.value
  );
  return hit ? hit.value : null;
}

// Backup source: some download URLs carry ?tokenId=...
export function tokenFromUrl(url) {
  const match = /[?&]tokenId=([^&]+)/.exec(String(url || ""));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null; // malformed percent-encoding must not crash the webRequest listener
  }
}

// kids.hubscuola.it -> "kids", everything else (young.hubscuola.it, www) -> "young".
// Mirrors normalizePlatform() in the Node provider.
export function platformFromHost(hostname) {
  return String(hostname || "").startsWith("kids") ? "kids" : "young";
}

// HubScuola volumeIds are opaque URL-safe tokens; anything else arrived via a
// crafted page URL and must not reach request-URL construction.
export function validVolumeId(volumeId) {
  return /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(String(volumeId || ""));
}

// https://young.hubscuola.it/viewer/<volumeId>?page=1 -> { platform, volumeId }
export function viewerFromLocation(hostname, pathname) {
  const match = /\/viewer\/([^/?#]+)/.exec(String(pathname || ""));
  if (!match) return null;
  let volumeId;
  try {
    // decode BEFORE validating: %2F/%23 reintroduce the chars the regex excluded
    volumeId = decodeURIComponent(match[1]);
  } catch {
    return null; // malformed percent-encoding
  }
  if (!validVolumeId(volumeId)) return null;
  return { platform: platformFromHost(hostname), volumeId };
}
