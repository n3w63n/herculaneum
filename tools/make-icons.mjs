// One-off icon generator: pixel-art "Herculaneum library" PNGs (16/48/128) —
// carbonized papyrus scrolls before Vesuvius. Run: node tools/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

/* ── minimal PNG encoder (8-bit RGBA) ── */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(
      raw,
      y * (size * 4 + 1) + 1
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── drawing ── */

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function px(c, x, y, color) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  c.data[i] = color[0];
  c.data[i + 1] = color[1];
  c.data[i + 2] = color[2];
  c.data[i + 3] = 255;
}

function rect(c, x, y, w, h, color) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) px(c, xx, yy, color);
}

function circle(c, cxf, cyf, rf, color) {
  const s = c.size;
  const cx = cxf * s;
  const cy = cyf * s;
  const r = Math.max(1, rf * s);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(c, x, y, color);
}

// Rounded background with a vertical colorAt(t) gradient.
function background(c, colorAt) {
  const s = c.size;
  const r = Math.max(2, Math.round(s * 0.18));
  for (let y = 0; y < s; y++) {
    const col = colorAt(y / (s - 1));
    for (let x = 0; x < s; x++) {
      const cx = Math.min(Math.max(x, r), s - 1 - r);
      const cy = Math.min(Math.max(y, r), s - 1 - r);
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(c, x, y, col);
    }
  }
}

// Volcano cone: flat crater plateau at the top, widening to the base.
function cone(c, cxf, peakY, plateauHalf, baseHalf, color) {
  const s = c.size;
  const cx = cxf * s;
  const top = peakY * s;
  for (let y = Math.round(top); y < s; y++) {
    const t = (y - top) / (s - top);
    const half = plateauHalf + (baseHalf - plateauHalf) * t;
    rect(c, cx - half * s, y, 2 * half * s, 1, color);
  }
}

function makeIcon(size) {
  const f = (v) => v * size;
  const c = { size, data: new Uint8Array(size * size * 4) };

  // dusk ash-ember sky
  background(c, (t) => lerp(hex("#6b3a2a"), hex("#2a1a14"), t));

  // eruption plume drifting right
  const ash = hex("#5f564f");
  circle(c, 0.44, 0.33, 0.075, ash);
  circle(c, 0.49, 0.24, 0.095, ash);
  circle(c, 0.54, 0.15, 0.085, ash);
  circle(c, 0.59, 0.08, 0.06, hex("#6f665e"));

  // Vesuvius silhouette (somma ridge right, main cone with glowing crater)
  cone(c, 0.7, 0.5, 0.03, 0.2, hex("#241a14"));
  cone(c, 0.42, 0.4, 0.05, 0.38, hex("#15100c"));
  rect(c, f(0.36), f(0.4), f(0.12), f(0.028), hex("#ff8c42"));
  rect(c, f(0.39), f(0.4), f(0.06), f(0.014), hex("#ffd166"));

  // two papyrus scrolls in front — the second one carbonized on one end
  const drawScroll = (x0, x1, y, h, body, ring, center) => {
    rect(c, f(x0), f(y), f(x1 - x0), f(h), body);
    const cy = y + h / 2;
    const r = h / 2;
    circle(c, x0, cy, r, ring);
    circle(c, x0, cy, r * 0.55, center);
    circle(c, x1, cy, r, ring);
    circle(c, x1, cy, r * 0.55, center);
  };
  drawScroll(0.18, 0.82, 0.63, 0.15, hex("#dcb87f"), hex("#b08c56"), hex("#7d5f3a"));
  drawScroll(0.12, 0.88, 0.79, 0.15, hex("#cfa96f"), hex("#b08c56"), hex("#7d5f3a"));
  // charred end: Vesuvius got this one
  circle(c, 0.88, 0.865, 0.075, hex("#241812"));
  circle(c, 0.88, 0.865, 0.042, hex("#0f0a08"));

  return c;
}

mkdirSync("src/icons", { recursive: true });
for (const size of [16, 48, 128]) {
  const c = makeIcon(size);
  writeFileSync(`src/icons/icon-${size}.png`, encodePng(size, c.data));
  console.log(`src/icons/icon-${size}.png`);
}
