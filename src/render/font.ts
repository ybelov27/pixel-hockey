/** Hand-made 5x7 bitmap font, drawn with fillRect runs so it stays razor sharp. */

const GLYPHS: Record<string, string> = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 10001 01010 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  '0': '01110 10001 10011 10101 11001 10001 01110',
  '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11111 00010 00100 00010 00001 10001 01110',
  '4': '00010 00110 01010 10010 11111 00010 00010',
  '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110',
  '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 01100 01100',
  ',': '00000 00000 00000 00000 01100 00100 01000',
  ':': '00000 01100 01100 00000 01100 01100 00000',
  '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000',
  '/': '00001 00010 00010 00100 01000 01000 10000',
  "'": '00100 00100 01000 00000 00000 00000 00000',
  '#': '01010 01010 11111 01010 11111 01010 01010',
  '%': '11000 11001 00010 00100 01000 10011 00011',
  '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000',
  '&': '01100 10010 10100 01000 10101 10010 01101',
  '>': '01000 00100 00010 00001 00010 00100 01000',
  '<': '00010 00100 01000 10000 01000 00100 00010',
  '=': '00000 00000 11111 00000 11111 00000 00000',
  '*': '00000 00100 10101 01110 10101 00100 00000',
  '"': '01010 01010 00000 00000 00000 00000 00000',
  _: '00000 00000 00000 00000 00000 00000 11111',
};

// 3x5 digits for jersey numbers and tiny labels.
const TINY: Record<string, string> = {
  '0': '111 101 101 101 111',
  '1': '010 110 010 010 111',
  '2': '111 001 111 100 111',
  '3': '111 001 011 001 111',
  '4': '101 101 111 001 001',
  '5': '111 100 111 001 111',
  '6': '111 100 111 101 111',
  '7': '111 001 010 010 010',
  '8': '111 101 111 101 111',
  '9': '111 101 111 001 111',
};

type Run = [number, number, number]; // x, y, w

function toRuns(src: string, w: number): Run[] {
  const runs: Run[] = [];
  src.split(' ').forEach((row, y) => {
    let x = 0;
    while (x < w) {
      if (row[x] === '1') {
        let e = x;
        while (e < w && row[e] === '1') e++;
        runs.push([x, y, e - x]);
        x = e;
      } else x++;
    }
  });
  return runs;
}

const RUNS = new Map<string, Run[]>();
for (const [k, v] of Object.entries(GLYPHS)) RUNS.set(k, toRuns(v, 5));
const TINY_RUNS = new Map<string, Run[]>();
for (const [k, v] of Object.entries(TINY)) TINY_RUNS.set(k, toRuns(v, 3));

export function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

export function textWidth(s: string, scale = 1) {
  const n = normalize(s).length;
  return n === 0 ? 0 : (n * 6 - 1) * scale;
}

export interface TextOpts {
  color?: string;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  shadow?: string | null;
  /** Thick 1px outline in this color, around every glyph. */
  outline?: string;
}

function drawRaw(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, scale: number, color: string) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of s) {
    const runs = RUNS.get(ch) || RUNS.get('?')!;
    for (const [rx, ry, rw] of runs) ctx.fillRect(cx + rx * scale, y + ry * scale, rw * scale, scale);
    cx += 6 * scale;
  }
}

export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, o: TextOpts = {}) {
  const s = normalize(str);
  const scale = o.scale || 1;
  const w = textWidth(s, scale);
  let sx = Math.round(x);
  if (o.align === 'center') sx = Math.round(x - w / 2);
  else if (o.align === 'right') sx = Math.round(x - w);
  const sy = Math.round(y);
  if (o.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]])
      drawRaw(ctx, s, sx + dx, sy + dy, scale, o.outline);
  }
  if (o.shadow !== null) drawRaw(ctx, s, sx + Math.max(1, scale >> 1), sy + Math.max(1, scale >> 1), scale, o.shadow || 'rgba(0,0,0,0.55)');
  drawRaw(ctx, s, sx, sy, scale, o.color || '#fff');
  return w;
}

export function tinyNumber(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, color: string) {
  const s = String(n);
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of s) {
    for (const [rx, ry, rw] of TINY_RUNS.get(ch)!) ctx.fillRect(cx + rx, y + ry, rw, 1);
    cx += 4;
  }
}

export function tinyWidth(n: number) {
  return String(n).length * 4 - 1;
}
