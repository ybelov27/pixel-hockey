// Generates the pixel-art app icons (PNG) with no dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const N = 32;
const px = new Array(N * N).fill('#141830');
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = c; };
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };

// stripes
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 8 < 2) set(x, y, '#1a1f3d');
// ice oval
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = (x - 15.5) / 13.5, dy = (y - 19) / 9;
  if (dx * dx + dy * dy <= 1) set(x, y, '#eef5fc');
}
rect(15, 10, 2, 18, '#d8343a');
rect(9, 11, 1, 16, '#2f55c8');
rect(22, 11, 1, 16, '#2f55c8');
// crossed sticks
for (let i = 0; i < 18; i++) { set(5 + i, 3 + i, '#d7b377'); set(6 + i, 3 + i, '#b8934f'); }
for (let i = 0; i < 18; i++) { set(26 - i, 3 + i, '#d7b377'); set(25 - i, 3 + i, '#b8934f'); }
rect(22, 21, 5, 2, '#111116');
rect(5, 21, 5, 2, '#111116');
// puck
rect(13, 22, 6, 3, '#111116');
rect(13, 22, 6, 1, '#3a3a48');
// yellow frame
for (let i = 0; i < N; i++) { set(i, 0, '#ffd23f'); set(i, N - 1, '#ffd23f'); }

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pad = 0) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const inner = size - pad * 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let c = '#141830';
      const ix = x - pad, iy = y - pad;
      if (ix >= 0 && iy >= 0 && ix < inner && iy < inner) c = px[Math.floor((iy * N) / inner) * N + Math.floor((ix * N) / inner)];
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = parseInt(c.slice(1, 3), 16); raw[o + 1] = parseInt(c.slice(3, 5), 16); raw[o + 2] = parseInt(c.slice(5, 7), 16);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/apple-touch-icon.png', png(180));
writeFileSync('public/icons/icon-192.png', png(192));
writeFileSync('public/icons/icon-512.png', png(512));
writeFileSync('public/icons/icon-512-maskable.png', png(512, 64));
console.log('icons written');
