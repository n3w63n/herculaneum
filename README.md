# Herculaneum — HubScuola downloader (browser extension)

Standalone Chrome/Chromium extension that adds a **"⬇ Scarica PDF"** button to the
HubScuola reader page (`https://young.hubscuola.it/viewer/<volumeId>` or
`kids.hubscuola.it`) and downloads the whole book as one merged PDF.

A browser port of the HubScuola provider from
[gablilli/ourbooks](https://github.com/gablilli/ourbooks). No local server, no
Node — everything runs in the extension. Only HubScuola is implemented (per
scope); the code is structured so other providers can be added later.

## How it works

1. **Token capture** — the extension watches outgoing requests to
   `*.hubscuola.it` and stores the `Token-Session` header (the same token the
   site itself sends) in `chrome.storage.session`. No password needed: just be
   logged in.
2. **On the reader page** — a fixed button appears in the bottom-right corner.
3. **Download pipeline** (background service worker):
   - `GET ms-api.hubscuola.it/me{young|kids}/publication/<volumeId>` → title
   - `GET ms-mms.hubscuola.it/downloadPackage/<volumeId>/publication.zip` →
     ZIP magic-number validated, `publication/publication.db` (SQLite, read via
     sql.js WASM) parsed for the chapter index
   - for each chapter:
     `GET ms-mms.hubscuola.it/public/<volumeId>/<chapterId>.zip` → validated,
     PDFs extracted in natural numeric order
   - merged with `pdf-lib`, saved to your Downloads folder as
     `<sanitized title>.pdf`

## Install (load unpacked)

1. `npm install && npm run build` (once, in this directory)
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. **Load unpacked** → select the `dist/` folder
5. Log in to HubScuola, open a book's reader page, click **⬇ Scarica PDF**

Progress shows next to the button; the finished file lands in your Downloads.

## Tests

```
npm test
```

Covers ZIP validation/sorting, token/URL parsing, and the SQLite chapter-index
reader.

## Limitations / risks

- **Never tested against the live service** — I have no HubScuola account.
  Expect to iterate: check the service worker console (`chrome://extensions` →
  service worker) if a download fails.
- The final PDF is handed to `chrome.downloads` as a `data:` URL (service
  workers can't create blob URLs) with the target filename embedded in the URL
  and enforced via `downloads.onDeterminingFilename`. Very large books mean a
  large base64 string; source chapters totalling over ~300 MB are rejected
  before merge rather than risking an out-of-memory crash (an offscreen
  document would lift the cap).
- Token expires with your session; if you get "Sessione non trovata", reload
  the reader page, browse a couple of pages, retry.
- Chapter zips are fetched sequentially (polite to the server; slower).
- Annotations (`--annotations` in the original tool) are not ported.
- Only `*.hubscuola.it` is in `host_permissions`; other publishers would need
  their own hosts and provider modules.

## Layout

```
src/manifest.json      MV3 manifest
src/background.js      token capture + download pipeline
src/content.js         reader-page button + progress UI
src/lib/token.js       token/URL parsing (pure)
src/lib/zip.js         ZIP validation + extraction (pure)
src/lib/chapters.js    SQLite chapter index reader (sql.js)
src/lib/util.js        helpers
build.mjs              esbuild bundling → dist/
test/                  node:test suite
```
