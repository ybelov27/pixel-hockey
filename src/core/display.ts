/**
 * Pixel-perfect display: the game renders into a small low-res buffer that is
 * scaled up by a whole number to fill the screen. The logical size adapts to
 * the device's aspect ratio so phones, tablets and desktops are all filled.
 */
export const display = {
  W: 480,
  H: 270,
  scale: 4,
  dpr: 1,
  safe: { l: 0, r: 0, t: 0, b: 0 },
  canvas: null as unknown as HTMLCanvasElement,
  ctx: null as unknown as CanvasRenderingContext2D,
  buf: null as unknown as HTMLCanvasElement,
  b: null as unknown as CanvasRenderingContext2D,
  portrait: false,
};

let probe: HTMLDivElement;

export function initDisplay() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  display.canvas = canvas;
  display.ctx = canvas.getContext('2d', { alpha: false })!;
  display.buf = document.createElement('canvas');
  display.b = display.buf.getContext('2d')!;
  probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  document.body.appendChild(probe);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  window.visualViewport?.addEventListener('resize', resize);
}

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cw = Math.round(vw * dpr);
  const ch = Math.round(vh * dpr);
  const c = display.canvas;
  c.width = cw;
  c.height = ch;
  c.style.width = vw + 'px';
  c.style.height = vh + 'px';
  const s = Math.max(1, Math.floor(Math.min(cw / 400, ch / 200)));
  display.scale = s;
  display.dpr = dpr;
  display.W = Math.ceil(cw / s);
  display.H = Math.ceil(ch / s);
  display.buf.width = display.W;
  display.buf.height = display.H;
  display.b.imageSmoothingEnabled = false;
  display.portrait = vh > vw && matchMedia('(pointer: coarse)').matches;
  const cs = getComputedStyle(probe);
  const toL = (v: string) => Math.ceil(((parseFloat(v) || 0) * dpr) / s);
  display.safe = {
    t: toL(cs.paddingTop),
    r: toL(cs.paddingRight),
    b: toL(cs.paddingBottom),
    l: toL(cs.paddingLeft),
  };
}

export function present() {
  const { ctx, buf, W, H, scale } = display;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, W, H, 0, 0, W * scale, H * scale);
}

export function toLogical(clientX: number, clientY: number) {
  return {
    x: (clientX * display.dpr) / display.scale,
    y: (clientY * display.dpr) / display.scale,
  };
}
