import type { Team } from '../data/teams';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { shade, bestOn, lum } from './colors';
import { text, textWidth } from './font';
import { crest, CREST_H, CREST_W } from './sprites';

export const UI = {
  bg: '#141830',
  bg2: '#1a1f3d',
  panel: '#232a52',
  panelHi: '#2f3870',
  border: '#47529a',
  yellow: '#ffd23f',
  orange: '#f4a236',
  red: '#e63946',
  green: '#3bb273',
  text: '#ffffff',
  dim: '#9aa3d6',
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

export function ringCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  const steps = Math.ceil(r * 7);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}

export function ellipseRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  const steps = Math.ceil(rx * 6);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}

/** Rectangle with 1px clipped corners, the classic chunky pixel button shape. */
export function chunky(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = UI.panel, border = UI.border) {
  chunky(ctx, x, y + 2, w, h, 'rgba(0,0,0,0.35)');
  chunky(ctx, x, y, w, h, border);
  chunky(ctx, x + 1, y + 1, w - 2, h - 2, fill);
}

export interface ButtonOpts {
  color?: string;
  selected?: boolean;
  scale?: number;
  disabled?: boolean;
  sub?: string;
}

export function button(ctx: CanvasRenderingContext2D, r: Rect, label: string, o: ButtonOpts = {}) {
  const base = o.disabled ? '#4a4f6a' : o.color || UI.orange;
  const t = performance.now() / 1000;
  const lift = o.selected ? Math.round(Math.sin(t * 6) * 0.6 - 0.4) : 0;
  const y = r.y + lift;
  chunky(ctx, r.x, r.y + 2, r.w, r.h, 'rgba(0,0,0,0.4)');
  chunky(ctx, r.x, y, r.w, r.h, shade(base, 0.6));
  chunky(ctx, r.x, y, r.w, r.h - 2, base);
  ctx.fillStyle = shade(base, 1.25);
  ctx.fillRect(r.x + 2, y + 1, r.w - 4, 1);
  if (o.selected) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x + 1, y - 1, r.w - 2, 1);
    ctx.fillRect(r.x + 1, y + r.h, r.w - 2, 1);
    ctx.fillRect(r.x - 1, y + 1, 1, r.h - 2);
    ctx.fillRect(r.x + r.w, y + 1, 1, r.h - 2);
  }
  const sc = o.scale || 1;
  const fg = lum(base) > 0.55 ? '#1a1a2a' : '#ffffff';
  const th = 7 * sc + (o.sub ? 9 : 0);
  const ty = y + Math.round((r.h - 2 - th) / 2);
  text(ctx, label, r.x + r.w / 2, ty, { color: fg, align: 'center', scale: sc, shadow: fg === '#ffffff' ? 'rgba(0,0,0,0.45)' : null });
  if (o.sub) text(ctx, o.sub, r.x + r.w / 2, ty + 7 * sc + 2, { color: fg === '#ffffff' ? '#ffe9b0' : '#3a3a50', align: 'center', shadow: null });
}

export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, color: string, back = '#0d1024') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, v))), h);
}

/** Scrolling diagonal-stripe background like a classic sports-game menu. */
export function menuBg(ctx: CanvasRenderingContext2D, W: number, H: number, accent = '#1d3557') {
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, W, H);
  const t = Math.floor(performance.now() / 60) % 16;
  ctx.fillStyle = UI.bg2;
  for (let x = -H - 16; x < W + 16; x += 16) {
    for (let y = 0; y < H; y++) ctx.fillRect(x + y + t, y, 6, 1);
  }
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

export function header(ctx: CanvasRenderingContext2D, W: number, title: string, team?: Team, safeT = 0) {
  const color = team ? team.primary : '#1d3557';
  const h = 20 + safeT;
  ctx.fillStyle = shade(color, 0.6);
  ctx.fillRect(0, h - 2, W, 2);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, h - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, safeT + 1, W, 1);
  const fg = team ? bestOn(color, [team.accent, team.secondary, '#ffffff']) : '#ffffff';
  text(ctx, title, W / 2, safeT + 6, { color: fg, align: 'center', shadow: 'rgba(0,0,0,0.5)' });
  return h;
}

export function drawCrest(ctx: CanvasRenderingContext2D, team: Team, cx: number, cy: number, scale = 1) {
  const c = crest(team);
  ctx.drawImage(c, Math.round(cx - (CREST_W * scale) / 2), Math.round(cy - (CREST_H * scale) / 2), CREST_W * scale, CREST_H * scale);
}

/** Simple vertical/grid menu helper with keyboard, gamepad and touch support. */
export class Menu {
  sel = 0;
  constructor(public items: { r: Rect; disabled?: boolean }[]) {}

  /** Returns the index activated this frame, or -1. */
  update(): number {
    const n = this.items.length;
    if (!n) return -1;
    if (this.sel >= n) this.sel = n - 1;
    const cur = this.items[this.sel].r;
    const move = (dx: number, dy: number) => {
      let best = -1;
      let bd = Infinity;
      this.items.forEach((it, i) => {
        if (i === this.sel || it.disabled) return;
        const ox = it.r.x + it.r.w / 2 - (cur.x + cur.w / 2);
        const oy = it.r.y + it.r.h / 2 - (cur.y + cur.h / 2);
        const along = ox * dx + oy * dy;
        if (along <= 2) return;
        const perp = Math.abs(ox * dy - oy * dx);
        const d = along + perp * 2.5;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best >= 0) {
        this.sel = best;
        audio.sfx('blip');
      }
    };
    if (input.up.pressed) move(0, -1);
    if (input.down.pressed) move(0, 1);
    if (input.left.pressed) move(-1, 0);
    if (input.right.pressed) move(1, 0);
    for (const t of input.taps) {
      const i = this.items.findIndex((it) => !it.disabled && t.x >= it.r.x && t.x < it.r.x + it.r.w && t.y >= it.r.y - 1 && t.y < it.r.y + it.r.h + 2);
      if (i >= 0) {
        this.sel = i;
        audio.sfx('select');
        return i;
      }
    }
    if (input.confirm.pressed && !this.items[this.sel].disabled) {
      audio.sfx('select');
      return this.sel;
    }
    return -1;
  }
}

export function centerText(ctx: CanvasRenderingContext2D, s: string, W: number, y: number, color = '#fff', scale = 1) {
  text(ctx, s, W / 2, y, { color, align: 'center', scale });
}

export function wrapText(s: string, maxW: number) {
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (textWidth(t) > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
