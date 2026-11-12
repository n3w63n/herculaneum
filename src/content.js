// Content script: shows a download button on the HubScuola reader page.
import { viewerFromLocation } from "./lib/token.js";

let ui = null;
let current = null;
let running = false;

function setStatus(text) {
  if (ui) {
    ui.status.textContent = text;
    ui.status.style.display = text ? "block" : "none";
  }
}

function ensureUi() {
  if (ui) return;
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483647;" +
    "display:flex;flex-direction:column;gap:6px;align-items:flex-end;" +
    "font-family:system-ui,sans-serif;";
  const btn = document.createElement("button");
  btn.textContent = "⬇ Scarica PDF";
  btn.style.cssText =
    "padding:10px 14px;border-radius:8px;border:0;background:#1a73e8;" +
    "color:#fff;font-size:14px;font-weight:600;cursor:pointer;" +
    "box-shadow:0 2px 8px rgba(0,0,0,.3);";
  const status = document.createElement("div");
  status.style.cssText =
    "padding:6px 10px;border-radius:6px;background:rgba(0,0,0,.75);" +
    "color:#fff;font-size:12px;max-width:300px;display:none;";
  btn.addEventListener("click", start);
  wrap.append(btn, status);
  document.documentElement.appendChild(wrap);
  ui = { wrap, btn, status };
}

async function start() {
  if (running || !current) return;
  running = true;
  ui.btn.disabled = true;
  setStatus("Preparazione…");
  try {
    const resp = await chrome.runtime.sendMessage({
      type: "download",
      platform: current.platform,
      volumeId: current.volumeId,
    });
    if (resp?.error) setStatus(`Errore: ${resp.error}`);
    else setStatus(`Fatto: ${resp.filename} (cartella Download)`);
  } catch (err) {
    setStatus(`Errore: ${err?.message || err}`);
  } finally {
    running = false;
    if (ui) ui.btn.disabled = false;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "progress") setStatus(msg.text);
});

// The reader is a SPA: poll the URL so the button follows navigation.
function tick() {
  const info = viewerFromLocation(location.hostname, location.pathname);
  if (info) {
    current = info;
    ensureUi();
  } else if (ui) {
    ui.wrap.remove();
    ui = null;
    current = null;
  }
}

tick();
setInterval(tick, 1500);
