// Generates docs/images/step-*.png — the illustrations for INSTALL.md.
// Run: node tools/make-install-images.mjs  (needs dev dep @napi-rs/canvas)
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";

const W = 880;
const H = 500;
const BAR = 84; // instruction bar height
const RED = "#d1242f";
const BLUE = "#0969da";
const GREEN = "#2da44e";
const INK = "#1f2328";
const FONT = '"DejaVu Sans"';

/* ── primitives ── */

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function txt(ctx, s, x, y, size, opts = {}) {
  const { weight = "bold", color = INK, align = "left", base = "alphabetic" } = opts;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s, x, y);
}

function fitTxt(ctx, s, x, y, maxW, opts = {}) {
  const { size = 30, weight = "bold", color = "#fff", align = "center", base = "middle" } = opts;
  let sz = size;
  ctx.font = `${weight} ${sz}px ${FONT}`;
  while (sz > 15 && ctx.measureText(s).width > maxW) {
    sz -= 2;
    ctx.font = `${weight} ${sz}px ${FONT}`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s, x, y);
}

function circle(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// red hand-drawn-looking annotation ellipse
function mark(ctx, cx, cy, rx, ry = rx) {
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, -0.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function arrow(ctx, x1, y1, x2, y2, color = RED) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = 16;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.7, y2 - Math.sin(a) * head * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5));
  ctx.lineTo(x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function cursor(ctx, x, y, s = 1.3) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 21);
  ctx.lineTo(5, 16);
  ctx.lineTo(8, 24);
  ctx.lineTo(11, 23);
  ctx.lineTo(8, 15);
  ctx.lineTo(14, 15);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function shadowed(ctx, draw) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.2)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  draw();
  ctx.restore();
}

/* ── page scaffolding ── */

function frame(step, instruction) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f6f8fa";
  ctx.fillRect(0, 0, W, H);
  // instruction bar
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - BAR, W, BAR);
  fitTxt(ctx, instruction, W / 2, H - BAR / 2, W - 80, { size: 31, color: "#fff" });
  // step badge (white ring so it reads above any mockup)
  circle(ctx, 64, 64, 34, "#fff");
  circle(ctx, 64, 64, 29, BLUE);
  fitTxt(ctx, String(step), 64, 65, 60, { size: 36, color: "#fff" });
  return { canvas, ctx };
}

// Chrome-like window. Returns y of the content area top.
function browser(ctx, x, y, w, h) {
  ctx.save();
  rr(ctx, x, y, w, h, 14);
  ctx.fillStyle = "#fff";
  shadowed(ctx, () => {
    rr(ctx, x, y, w, h, 14);
    ctx.fill();
  });
  ctx.clip();
  ctx.fillStyle = "#dee1e6";
  ctx.fillRect(x, y, w, 44);
  const dots = ["#ff5f57", "#febc2e", "#28c840"];
  dots.forEach((c, i) => circle(ctx, x + 24 + i * 24, y + 22, 7, c));
  ctx.fillStyle = "#f1f3f4";
  ctx.fillRect(x, y + 44, w, 52);
  rr(ctx, x + 18, y + 54, w - 36, 34, 17);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#d0d7de";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "#d0d7de";
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, 14);
  ctx.stroke();
  return y + 96; // content top
}

function zipIcon(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.15)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  rr(ctx, x, y, w, h, 8);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, 8);
  ctx.strokeStyle = "#8b949e";
  ctx.lineWidth = 3;
  ctx.stroke();
  // folded corner
  ctx.beginPath();
  ctx.moveTo(x + w - 34, y);
  ctx.lineTo(x + w, y + 34);
  ctx.lineTo(x + w - 34, y + 34);
  ctx.closePath();
  ctx.fillStyle = "#eaeef2";
  ctx.fill();
  ctx.strokeStyle = "#8b949e";
  ctx.lineWidth = 2;
  ctx.stroke();
  // zipper
  const cx = x + w / 2;
  ctx.strokeStyle = "#8b949e";
  ctx.lineWidth = 4;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(cx, y + 46);
  ctx.lineTo(cx, y + h - 54);
  ctx.stroke();
  ctx.setLineDash([]);
  rr(ctx, cx - 13, y + h - 56, 26, 34, 5);
  ctx.fillStyle = RED;
  ctx.fill();
  txt(ctx, "ZIP", cx, y + h - 66, 24, { align: "center", color: RED });
}

function folderIcon(ctx, x, y, w, h, label) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.15)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  // back tab
  rr(ctx, x, y - 22, w * 0.45, 34, 8);
  ctx.fillStyle = "#e3b341";
  ctx.fill();
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = "#f0c14b";
  ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, 10);
  ctx.strokeStyle = "#c9992b";
  ctx.lineWidth = 3;
  ctx.stroke();
  if (label) fitTxt(ctx, label, x + w / 2, y + h / 2 + 2, w - 24, { size: 30, color: "#5c4200" });
}

function toggle(ctx, x, y, on) {
  rr(ctx, x, y, 64, 32, 16);
  ctx.fillStyle = on ? BLUE : "#8b949e";
  ctx.fill();
  circle(ctx, on ? x + 48 : x + 16, y + 16, 12, "#fff");
}

function save(canvas, name) {
  mkdirSync("docs/images", { recursive: true });
  writeFileSync(`docs/images/${name}`, canvas.toBuffer("image/png"));
  console.log(`docs/images/${name}`);
}

/* ── steps ── */

function step1() {
  const { canvas, ctx } = frame(1, "1. Scarica il file ZIP del progetto");
  const x = 120, y = 40, w = 730, h = 340;
  const top = browser(ctx, x, y, w, h);
  txt(ctx, "n3w63n / herculaneum", x + 30, top + 44, 32);
  // green Code button
  rr(ctx, x + w - 230, top + 22, 200, 56, 10);
  ctx.fillStyle = GREEN;
  ctx.fill();
  txt(ctx, "Code ▾", x + w - 130, top + 52, 28, { color: "#fff", align: "center", base: "middle" });
  // dropdown
  const dx = x + w - 305, dy = top + 96, dw = 290, dh = 78;
  shadowed(ctx, () => {
    rr(ctx, dx, dy, dw, dh, 10);
    ctx.fillStyle = "#fff";
    ctx.fill();
  });
  rr(ctx, dx, dy, dw, dh, 10);
  ctx.strokeStyle = "#d0d7de";
  ctx.lineWidth = 2;
  ctx.stroke();
  rr(ctx, dx + 14, dy + 14, dw - 28, dh - 28, 8);
  ctx.fillStyle = "#f6f8fa";
  ctx.fill();
  // small file glyph (zipIcon's labels assume a large icon)
  const gx = dx + 30, gy = dy + 20, gw = 26, gh = 38;
  rr(ctx, gx, gy, gw, gh, 4);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#8b949e";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = RED;
  ctx.lineWidth = 4;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(gx + gw / 2, gy + 6);
  ctx.lineTo(gx + gw / 2, gy + gh - 12);
  ctx.stroke();
  ctx.setLineDash([]);
  rr(ctx, gx + gw / 2 - 5, gy + gh - 14, 10, 12, 3);
  ctx.fillStyle = RED;
  ctx.fill();
  txt(ctx, "Download ZIP", dx + 74, dy + dh / 2 + 1, 25, { base: "middle" });
  mark(ctx, dx + dw / 2, dy + dh / 2, dw / 2 + 6, dh / 2 + 6);
  cursor(ctx, dx + dw - 76, dy + dh - 30);
  save(canvas, "step1-download.png");
}

function step2() {
  const { canvas, ctx } = frame(2, "2. Estrai il file ZIP in una cartella");
  zipIcon(ctx, 170, 120, 170, 210);
  arrow(ctx, 390, 225, 560, 225);
  folderIcon(ctx, 610, 150, 220, 165, "herculaneum");
  cursor(ctx, 700, 300);
  save(canvas, "step2-unzip.png");
}

function step3() {
  const { canvas, ctx } = frame(3, "3. Scrivi chrome://extensions e premi Invio");
  const x = 120, y = 60, w = 730, h = 300;
  browser(ctx, x, y, w, h);
  // centered so the annotation ellipse clears the text on both sides
  txt(ctx, "chrome://extensions", x + w / 2, y + 71, 27, {
    weight: "normal",
    base: "middle",
    align: "center",
  });
  mark(ctx, x + w / 2, y + 71, w / 2 - 30, 34);
  cursor(ctx, x + w - 140, y + 84);
  txt(ctx, "…premi Invio ⏎", x + w / 2, y + 190, 34, { align: "center", color: "#8b949e" });
  save(canvas, "step3-open-extensions.png");
}

function step4() {
  const { canvas, ctx } = frame(4, "4. Attiva “Modalità sviluppatore” in alto a destra");
  const x = 120, y = 50, w = 730, h = 330;
  const top = browser(ctx, x, y, w, h);
  txt(ctx, "Estensioni", x + 30, top + 50, 34);
  txt(ctx, "Modalità sviluppatore", x + w - 330, top + 48, 25, { weight: "normal", base: "middle" });
  toggle(ctx, x + w - 90, top + 32, true);
  mark(ctx, x + w - 172, top + 48, 178, 44);
  txt(ctx, "sposta la levetta a destra →", x + w - 250, top + 124, 26, {
    align: "center",
    color: "#8b949e",
  });
  save(canvas, "step4-developer-mode.png");
}

function step5() {
  const { canvas, ctx } = frame(5, "5. Premi il pulsante “Carica espansione”");
  const x = 120, y = 50, w = 730, h = 330;
  const top = browser(ctx, x, y, w, h);
  txt(ctx, "Estensioni", x + 30, top + 44, 30);
  toggle(ctx, x + w - 90, top + 28, true);
  txt(ctx, "Modalità sviluppatore", x + w - 330, top + 44, 22, {
    weight: "normal",
    base: "middle",
    color: "#8b949e",
  });
  // load unpacked button
  const bx = x + 30, by = top + 90, bw = 300, bwid = 62;
  rr(ctx, bx, by, bw, bwid, 8);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 3;
  ctx.stroke();
  txt(ctx, "Carica espansione", bx + bw / 2, by + bwid / 2 + 2, 27, {
    color: BLUE,
    align: "center",
    base: "middle",
  });
  mark(ctx, bx + bw / 2, by + bwid / 2, bw / 2 + 14, bwid / 2 + 12);
  cursor(ctx, bx + bw - 80, by + bwid - 18);
  save(canvas, "step5-load-unpacked.png");
}

function step6() {
  const { canvas, ctx } = frame(6, "6. Scegli la cartella “dist” e premi “Seleziona”");
  const x = 150, y = 55, w = 660, h = 330;
  shadowed(ctx, () => {
    rr(ctx, x, y, w, h, 12);
    ctx.fillStyle = "#fff";
    ctx.fill();
  });
  rr(ctx, x, y, w, h, 12);
  ctx.strokeStyle = "#d0d7de";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#f6f8fa";
  ctx.fillRect(x + 2, y + 2, w - 4, 54);
  txt(ctx, "Seleziona la cartella", x + 24, y + 32, 26, { base: "middle" });
  // rows
  const rows = [
    { label: "herculaneum", open: true },
    { label: "dist", indent: true, hot: true },
    { label: "src", indent: true },
    { label: "test", indent: true },
  ];
  rows.forEach((r, i) => {
    const ry = y + 70 + i * 52;
    const rx = x + 24 + (r.indent ? 56 : 0);
    if (r.hot) {
      rr(ctx, x + 12, ry - 6, w - 24, 46, 8);
      ctx.fillStyle = "#ddf4ff";
      ctx.fill();
    }
    // small folder glyph
    rr(ctx, rx, ry, 40, 30, 5);
    ctx.fillStyle = r.hot ? "#54aeff" : "#e3b341";
    ctx.fill();
    rr(ctx, rx, ry - 7, 18, 10, 4);
    ctx.fill();
    txt(ctx, r.label, rx + 54, ry + 16, 26, {
      weight: r.hot ? "bold" : "normal",
      color: r.hot ? "#0969da" : INK,
      base: "middle",
    });
    if (r.open) txt(ctx, "▾", x + w - 50, ry + 16, 24, { base: "middle", color: "#8b949e" });
    // wide enough that the arc passes around the row, not through "dist"
    if (r.hot) mark(ctx, x + w / 2, ry + 17, w / 2 - 34, 30);
  });
  // buttons
  const by = y + h - 62;
  rr(ctx, x + w - 320, by, 140, 44, 8);
  ctx.fillStyle = "#f6f8fa";
  ctx.fill();
  ctx.strokeStyle = "#d0d7de";
  ctx.lineWidth = 2;
  ctx.stroke();
  txt(ctx, "Annulla", x + w - 250, by + 24, 24, { align: "center", base: "middle", weight: "normal" });
  rr(ctx, x + w - 165, by, 145, 44, 8);
  ctx.fillStyle = BLUE;
  ctx.fill();
  txt(ctx, "Seleziona", x + w - 92, by + 24, 24, { align: "center", base: "middle", color: "#fff" });
  cursor(ctx, x + w - 130, by + 34);
  save(canvas, "step6-choose-dist.png");
}

async function step7() {
  const { canvas, ctx } = frame(7, "7. Fatto! Apri un libro e premi “Scarica PDF”");
  // green check
  circle(ctx, 210, 220, 78, GREEN);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(172, 222);
  ctx.lineTo(200, 250);
  ctx.lineTo(252, 190);
  ctx.stroke();
  // extension card
  const x = 350, y = 100, w = 470, h = 130;
  shadowed(ctx, () => {
    rr(ctx, x, y, w, h, 12);
    ctx.fillStyle = "#fff";
    ctx.fill();
  });
  rr(ctx, x, y, w, h, 12);
  ctx.strokeStyle = "#d0d7de";
  ctx.lineWidth = 2;
  ctx.stroke();
  const icon = await loadImage(new URL("../src/icons/icon-48.png", import.meta.url).pathname);
  ctx.drawImage(icon, x + 24, y + 41, 48, 48);
  txt(ctx, "Herculaneum", x + 92, y + 60, 30);
  txt(ctx, "estensione attiva", x + 92, y + 94, 22, { weight: "normal", color: "#8b949e" });
  toggle(ctx, x + w - 88, y + 49, true);
  // button mockup
  rr(ctx, 350, 262, 300, 62, 10);
  ctx.fillStyle = "#1a73e8";
  ctx.fill();
  txt(ctx, "⬇ Scarica PDF", 500, 295, 30, { color: "#fff", align: "center", base: "middle" });
  cursor(ctx, 640, 310);
  save(canvas, "step7-done.png");
}

await step1();
step2();
step3();
step4();
step5();
step6();
await step7();
