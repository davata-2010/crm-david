// Genera los iconos PNG de la PWA sin dependencias externas.
// Dibuja la marca de Aurum: cuadrado dorado + "A" en negro.
// Uso: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const GOLD = [0xfa, 0xc5, 0x1c];
const INK = [0x08, 0x08, 0x08];

/* ---------------------------------------------------------------- PNG ---- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------- dibujo ---- */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (edge, blur, d) => clamp01(0.5 - (d - edge) / blur);

/** Distancia de un punto a un segmento, en coordenadas 0..1. */
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp01((wx * vx + wy * vy) / len2);
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

/** Distancia con signo a un rectángulo redondeado centrado, en 0..1. */
function roundedRect(px, py, half, radius) {
  const dx = Math.abs(px - 0.5) - (half - radius);
  const dy = Math.abs(py - 0.5) - (half - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

// Trazos de la "A": dos diagonales y el travesaño.
const STROKES = [
  [0.285, 0.775, 0.5, 0.225],
  [0.715, 0.775, 0.5, 0.225],
  [0.375, 0.585, 0.625, 0.585],
];

function render(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const px = 1 / size;
  // En modo maskable el fondo llena el lienzo: Android recorta a su antojo.
  const half = maskable ? 0.5 : 0.5 - 0.055;
  const radius = maskable ? 0 : 0.115;
  const inkWidth = (maskable ? 0.072 : 0.085) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) * px;
      const v = (y + 0.5) * px;
      const i = (y * size + x) * 4;

      const bg = maskable ? 1 : smooth(0, px * 2, roundedRect(u, v, half, radius));

      let ink = 0;
      for (const [ax, ay, bx, by] of STROKES) {
        ink = Math.max(ink, smooth(inkWidth, px * 2, distToSegment(u, v, ax, ay, bx, by)));
      }

      const alpha = bg;
      const mix = ink * bg;
      rgba[i] = Math.round(GOLD[0] * (1 - mix) + INK[0] * mix);
      rgba[i + 1] = Math.round(GOLD[1] * (1 - mix) + INK[1] * mix);
      rgba[i + 2] = Math.round(GOLD[2] * (1 - mix) + INK[2] * mix);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, rgba);
}

/* --------------------------------------------------------------- salida --- */

mkdirSync("public/icons", { recursive: true });

const files = [
  ["public/icons/icon-192.png", 192, { maskable: false }],
  ["public/icons/icon-512.png", 512, { maskable: false }],
  ["public/icons/maskable-512.png", 512, { maskable: true }],
  ["public/icons/apple-touch-icon.png", 180, { maskable: true }],
  ["public/icons/favicon-32.png", 32, { maskable: false }],
];

for (const [path, size, opts] of files) {
  const png = render(size, opts);
  writeFileSync(path, png);
  console.log(`${path.padEnd(36)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

/* ------------------------------------------------- icono de Windows ---- */
// Un .ico es una cabecera + un índice + los PNG incrustados tal cual.

function encodeIco(entries) {
  const dir = Buffer.alloc(6 + entries.length * 16);
  dir.writeUInt16LE(0, 0);              // reservado
  dir.writeUInt16LE(1, 2);              // tipo 1 = icono
  dir.writeUInt16LE(entries.length, 4); // número de imágenes

  let offset = dir.length;
  entries.forEach((e, i) => {
    const p = 6 + i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, p);     // ancho (0 = 256)
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, p + 1); // alto
    dir.writeUInt8(0, p + 2);           // paleta
    dir.writeUInt8(0, p + 3);           // reservado
    dir.writeUInt16LE(1, p + 4);        // planos
    dir.writeUInt16LE(32, p + 6);       // bits por píxel
    dir.writeUInt32LE(e.png.length, p + 8);
    dir.writeUInt32LE(offset, p + 12);
    offset += e.png.length;
  });

  return Buffer.concat([dir, ...entries.map((e) => e.png)]);
}

mkdirSync("desktop/build", { recursive: true });
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const ico = encodeIco(icoSizes.map((size) => ({ size, png: render(size, { maskable: false }) })));
writeFileSync("desktop/build/icon.ico", ico);
console.log(`desktop/build/icon.ico`.padEnd(36) + `${icoSizes.join("/")}  ${(ico.length / 1024).toFixed(1)} KB`);

writeFileSync("desktop/build/icon.png", render(512, { maskable: false }));
console.log("desktop/build/icon.png".padEnd(36) + "512×512");
