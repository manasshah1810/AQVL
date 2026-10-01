// Procedural textures (deterministic): film grain, paper, chalkboard.
import fs from 'node:fs';
import zlib from 'node:zlib';
const out = new URL('../public/tex/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
function crc32(buf) { let c, crc = ~0; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, ch, px) { // ch: 3 RGB, 4 RGBA
  const raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * ch + 1)] = 0; px.copy(raw, y * (w * ch + 1) + 1, y * w * ch, (y + 1) * w * ch); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = ch === 4 ? 6 : 2; ihdr[10] = ihdr[11] = ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
let s = 1234567;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// value noise
function makeNoise(size, seed) { s = seed; const g = new Float32Array(size * size); for (let i = 0; i < g.length; i++) g[i] = rnd(); return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const at = (a, b) => g[((b % size + size) % size) * size + ((a % size + size) % size)]; const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf); return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy; }; }
const fbm = (n, x, y, oct = 5) => { let a = 0, amp = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { a += amp * n(x * f, y * f); t += amp; amp *= 0.5; f *= 2; } return a / t; };

// grain: RGBA, gray with alpha, 2 variants
for (let v = 0; v < 2; v++) {
  const W = 2240, H = 1360; s = 99 + v * 1000; const px = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { const g = (rnd() + rnd() + rnd()) / 3; const val = g > 0.5 ? 255 : 0; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = val; px[i * 4 + 3] = Math.min(255, Math.abs(g - 0.5) * 2 * 255 * 1.6); }
  fs.writeFileSync(new URL(`grain${v}.png`, out), png(W, H, 4, px));
}
// paper 1600x1000 warm
{
  const W = 1600, H = 1000; const n = makeNoise(256, 7), n2 = makeNoise(256, 8); const px = Buffer.alloc(W * H * 3); s = 42;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = fbm(n, x / 180, y / 180, 5); const fib = fbm(n2, x / 3, y / 40, 2); const sp = rnd();
    let l = 0.92 + (m - 0.5) * 0.08 + (fib - 0.5) * 0.035 + (sp - 0.5) * 0.03;
    const i = (y * W + x) * 3; px[i] = Math.min(255, l * 244); px[i + 1] = Math.min(255, l * 234); px[i + 2] = Math.min(255, l * 214);
  }
  fs.writeFileSync(new URL('paper.png', out), png(W, H, 3, px));
}
// chalkboard 1600x1000
{
  const W = 1600, H = 1000; const n = makeNoise(256, 11), n2 = makeNoise(256, 12); const px = Buffer.alloc(W * H * 3); s = 77;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = fbm(n, x / 260, y / 160, 5); const smear = fbm(n2, x / 90 + y / 300, y / 25, 3); const sp = rnd();
    const l = 0.16 + (m - 0.5) * 0.07 + Math.max(0, smear - 0.55) * 0.12 + (sp - 0.5) * 0.025;
    const i = (y * W + x) * 3; px[i] = l * 150; px[i + 1] = l * 190; px[i + 2] = l * 168;
  }
  fs.writeFileSync(new URL('board.png', out), png(W, H, 3, px));
}
console.log('ok');
