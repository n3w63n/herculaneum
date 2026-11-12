// Background service worker: captures the live session token and runs the
// download pipeline (ported from ourbooks/providers/hubscuola.js, annotations
// and docenti flows dropped).
import { PDFDocument } from "pdf-lib";
import { tokenFromHeaders, tokenFromUrl, validVolumeId } from "./lib/token.js";
import { assertZip, findEntry, pdfsFromZip } from "./lib/zip.js";
import { chaptersFromDb } from "./lib/chapters.js";
import { sanitizeFilename, toDataUrl } from "./lib/util.js";

const TOKEN_KEY = "token";

/* ── filename: Chrome derives "Download.pdf" from data: URLs and treats the
   download() filename param as a request — force it here instead. The name
   travels inside the data: URL itself (see toDataUrl), so this listener stays
   stateless: nothing to lose when the service worker restarts, no
   cross-download race, and foreign data: URLs without the marker fall
   through to the default name. ── */

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  let filename = null;
  const match = /herculaneum-name=([^,]+)/.exec(item.url);
  if (match) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      // malformed marker from a page-controlled URL; fall through to default
    }
  }
  if (filename) suggest({ filename, conflictAction: "uniquify" });
  else suggest();
});

/* ── token capture ── */

let cachedToken = null;

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const token =
      tokenFromHeaders(details.requestHeaders) || tokenFromUrl(details.url);
    if (token && token !== cachedToken) {
      cachedToken = token;
      // a set failure surfaces later as the clear "Sessione non trovata" error
      chrome.storage.session.set({ [TOKEN_KEY]: token }).catch(() => {});
    }
  },
  { urls: ["https://*.hubscuola.it/*"] },
  ["requestHeaders", "extraHeaders"]
);

async function getToken() {
  if (cachedToken) return cachedToken;
  const stored = await chrome.storage.session.get(TOKEN_KEY);
  return (cachedToken = stored[TOKEN_KEY] || null);
}

/* ── pipeline ── */

function fetchTimed(url, options, ms = 180_000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(ms) }).catch((err) => {
    if (err?.name === "TimeoutError") {
      throw new Error(
        `Timeout richiesta (${Math.round(ms / 1000)}s): ${new URL(url).pathname}`
      );
    }
    throw err;
  });
}

// shortcut: merge + data URL run fully in memory — cap source bytes here;
// raise via offscreen-document streaming when books outgrow it
const MAX_SOURCE_BYTES = 300_000_000;

async function download({ platform, volumeId }, sender) {
  // page-controlled input reaches URL construction here (trust boundary)
  if (!/^(young|kids)$/.test(platform) || !validVolumeId(volumeId)) {
    throw new Error("Richiesta non valida (platform/volumeId)");
  }

  const tabId = sender.tab?.id;
  const progress = (text) => {
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { type: "progress", text }).catch(() => {});
    }
  };

  let sourceBytes = 0;
  const account = (n) => {
    sourceBytes += n;
    if (sourceBytes > MAX_SOURCE_BYTES) {
      throw new Error(
        `Libro troppo grande (>${Math.round(MAX_SOURCE_BYTES / 1e6)}MB): download interrotto.`
      );
    }
  };

  const token = await getToken();
  if (!token) {
    throw new Error(
      "Sessione non trovata: apri il libro, sfoglia qualche pagina e riprova."
    );
  }

  progress("Recupero informazioni…");
  const infoRes = await fetchTimed(
    `https://ms-api.hubscuola.it/me${platform}/publication/${volumeId}`,
    { headers: { "Token-Session": token, Accept: "application/json" } },
    30_000
  );
  if (!infoRes.ok) throw new Error(`Info libro fallite (${infoRes.status})`);
  const info = await infoRes.json().catch(() => {
    throw new Error("Risposta informazioni libro non valida");
  });
  const title = info.title || volumeId;

  progress(`Scarico ${title}…`);
  const pkgRes = await fetchTimed(
    `https://ms-mms.hubscuola.it/downloadPackage/${volumeId}/publication.zip?tokenId=${encodeURIComponent(token)}`,
    {
      headers: {
        "Token-Session": token,
        Accept: "application/zip, application/octet-stream, */*",
      },
    }
  );
  const pkgBytes = new Uint8Array(await pkgRes.arrayBuffer());
  if (!pkgRes.ok) {
    throw new Error(`Package download fallito: ${pkgRes.status}`);
  }
  assertZip(pkgBytes, "publication.zip", { status: pkgRes.status });
  account(pkgBytes.length);

  progress("Lettura indice capitoli…");
  const dbBytes = findEntry(pkgBytes, "publication/publication.db");
  if (!dbBytes) throw new Error("publication.db non trovato nel package");
  const chapters = await chaptersFromDb(
    dbBytes,
    `me${platform}/publication/${volumeId}`,
    { locateFile: (file) => chrome.runtime.getURL(file) }
  );
  if (!chapters.length) throw new Error("Nessun capitolo trovato");

  const merged = await PDFDocument.create();
  let chapterNo = 0;
  for (const chapter of chapters) {
    chapterNo++;
    progress(`Capitolo ${chapterNo}/${chapters.length} — ${title}`);
    const res = await fetchTimed(
      `https://ms-mms.hubscuola.it/public/${volumeId}/${chapter.chapterId}.zip?tokenId=${encodeURIComponent(token)}&app=v2`,
      {
        headers: {
          "Token-Session": token,
          Accept: "application/zip, application/octet-stream, */*",
        },
      }
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!res.ok) {
      throw new Error(`Capitolo ${chapter.chapterId}: ${res.status}`);
    }
    assertZip(bytes, `chapter ${chapter.chapterId}`, { status: res.status });
    account(bytes.length);
    for (const pdf of pdfsFromZip(bytes)) {
      const src = await PDFDocument.load(pdf);
      const pages = await merged.copyPages(src, src.getPageIndices());
      for (const page of pages) merged.addPage(page);
    }
  }
  if (!merged.getPageCount()) {
    throw new Error("Nessuna pagina trovata nei capitoli");
  }

  progress("Composizione PDF…");
  const out = await merged.save();
  const filename = `${sanitizeFilename(title)}.pdf`;
  progress("Salvataggio…");
  await chrome.downloads.download({ url: toDataUrl(out, filename), filename });
  return { filename };
}

/* ── messaging ── */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "download") return;
  (async () => {
    try {
      sendResponse(await download(msg, sender));
    } catch (err) {
      sendResponse({ error: err?.message || String(err) });
    }
  })();
  return true; // keep the channel open for the long-running job
});
