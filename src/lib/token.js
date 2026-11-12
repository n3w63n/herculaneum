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
  return match ? decodeURIComponent(match[1]) : null;
}

// kids.hubscuola.it -> "kids", everything else (young.hubscuola.it, www) -> "young".
// Mirrors normalizePlatform() in the Node provider.
export function platformFromHost(hostname) {
  return String(hostname || "").startsWith("kids") ? "kids" : "young";
}

// https://young.hubscuola.it/viewer/<volumeId>?page=1 -> { platform, volumeId }
export function viewerFromLocation(hostname, pathname) {
  const match = /\/viewer\/([^/?#]+)/.exec(String(pathname || ""));
  if (!match) return null;
  return { platform: platformFromHost(hostname), volumeId: decodeURIComponent(match[1]) };
}
