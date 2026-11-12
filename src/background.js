// Background service worker: captures the live session token and runs the
// download pipeline (ported from ourbooks/providers/hubscuola.js, annotations
// and docenti flows dropped).
import { PDFDocument } from "pdf-lib";
import { tokenFromHeaders, tokenFromUrl } from "./lib/token.js";
import { assertZip, findEntry, pdfsFromZip } from "./lib/zip.js";
import { chaptersFromDb } from "./lib/chapters.js";
import { sanitizeFilename } from "./lib/util.js";

const TOKEN_KEY = "token";

/* ── filename: Chrome derives "Download.pdf" from data: URLs and treats
   the download() filename param as a request — force it here instead ── */

let wantedFilename = null;

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (wantedFilename && item.url.startsWith("data:")) {
    const filename = wantedFilename;
    wantedFilename = null;
    suggest({ filename, conflictAction: "uniquify" });
  } else {
    suggest();
  }
});

/* ── token capture ── */

let cachedToken = null;

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const token =
      tokenFromHeaders(details.requestHeaders) || tokenFromUrl(details.url);
    if (token && token !== cachedToken) {
      cachedToken = token;
      chrome.storage.session.set({ [TOKEN_KEY]: token });
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

function toDataUrl(bytes) {
  // chrome.downloads needs a URL; service workers have no URL.createObjectURL.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return "data:application/pdf;base64," + btoa(bin);
}

async function download({ platform, volumeId }, sender) {
  const tabId = sender.tab?.id;
  const progress = (text) => {
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { type: "progress", text }).catch(() => {});
    }
  };

  const token = await getToken();
  if (!token) {
    throw new Error(
      "Sessione non trovata: apri il libro, sfoglia qualche pagina e riprova."
    );
  }

  progress("Recupero informazioni…");
  const infoRes = await fetch(
    `https://ms-api.hubscuola.it/me${platform}/publication/${volumeId}`,
    { headers: { "Token-Session": token, Accept: "application/json" } }
  );
  if (!infoRes.ok) throw new Error(`Info libro fallite (${infoRes.status})`);
  const info = await infoRes.json().catch(() => ({}));
  const title = info.title || volumeId;

  progress(`Scarico ${title}…`);
  const pkgRes = await fetch(
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
    const res = await fetch(
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
  wantedFilename = filename;
  try {
    await chrome.downloads.download({ url: toDataUrl(out), filename });
  } catch (err) {
    wantedFilename = null; // don't rename the next unrelated data: download
    throw err;
  }
  return { filename };
}

/* ── messaging ── */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "download") return;
  download(msg, sender).then(
    (result) => sendResponse(result),
    (err) => sendResponse({ error: err?.message || String(err) })
  );
  return true; // keep the channel open for the long-running job
});
