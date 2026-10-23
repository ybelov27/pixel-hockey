export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** f < 1 darkens, f > 1 lightens toward white. */
export function shade(hex: string, f: number) {
  const [r, g, b] = rgb(hex);
  if (f <= 1) return toHex(r * f, g * f, b * f);
  const t = f - 1;
  return toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

export function mix(a: string, b: string, t: number) {
  const A = rgb(a);
  const B = rgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export function lum(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function bestOn(bg: string, candidates: string[]) {
  let best = candidates[0];
  let bc = 0;
  for (const c of candidates) {
    const k = contrast(bg, c);
    if (k > bc) {
      bc = k;
      best = c;
    }
  }
  return best;
}

export function colorDist(a: string, b: string) {
  const A = rgb(a);
  const B = rgb(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

export function rgba(hex: string, a: number) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
