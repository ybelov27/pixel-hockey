import type { Team } from '../data/teams';
import { RNG } from '../core/rng';
import {
  ARENA_TOP, BLUE_LINE, CIRCLE_R, CORNER_R, CREASE_R, CX, CY, DOT_DY, DOT_END_X, DOT_NEU_X, FT, GOAL_LINE,
  RINK_L, RINK_W, WORLD_PX_H, WORLD_PX_W, YS, projX, projY, rinkXRange, rinkYRange,
} from '../game/rink';
import { bestOn, colorDist, shade } from './colors';
import { text, textWidth, tinyNumber } from './font';

export interface ArenaArt {
  crowd: [HTMLCanvasElement, HTMLCanvasElement];
  rink: HTMLCanvasElement;
  near: HTMLCanvasElement;
}

const ICE = '#eef5fc';
const ICE2 = '#e3edf8';
const RED = '#d8343a';
const BLUE = '#2f55c8';
const CREASE = '#9ccaf5';
const WALL_H = 11;
const GLASS_H = 15;

function mk() {
  const c = document.createElement('canvas');
  c.width = WORLD_PX_W;
  c.height = WORLD_PX_H;
  return c;
}

const ADS: [string, string, string][] = [
  ['PIXEL COLA', '#d62828', '#ffffff'],
  ['8-BIT AUTO', '#1d3557', '#ffd166'],
  ['RETRO BANK', '#2a9d8f', '#ffffff'],
  ['PUCK PIZZA', '#f77f00', '#ffffff'],
  ['CHIPTUNE FM', '#6a4c93', '#ffffff'],
  ['ICE COLD', '#118ab2', '#ffffff'],
];

export function buildArena(home: Team, away: Team): ArenaArt {
  const rng = new RNG(1234);
  const rink = mk();
  const g = rink.getContext('2d')!;
  const R = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const top = Math.round(projY(0));
  const bot = Math.round(projY(RINK_W));
  const rowY = (sy: number) => (sy + 0.5 - ARENA_TOP) / YS;

  // ice surface, scanline by scanline so the rounded corners stay pixel-crisp
  for (let sy = top; sy < bot; sy++) {
    const [x0, x1] = rinkXRange(rowY(sy));
    R(projX(x0), sy, Math.round(x1 - x0), 1, ICE);
  }
  for (let i = 0; i < 1400; i++) {
    const x = rng.range(0, RINK_L);
    const y = rng.range(0, RINK_W);
    const [x0, x1] = rinkXRange(y);
    if (x > x0 + 2 && x < x1 - 2) R(projX(x), projY(y), rng.chance(0.3) ? 2 : 1, 1, ICE2);
  }

  const vline = (wx: number, w: number, c: string, dashed = false) => {
    for (let sy = top; sy < bot; sy++) {
      const [x0, x1] = rinkXRange(rowY(sy));
      if (wx - w / 2 < x0 || wx + w / 2 > x1) continue;
      R(projX(wx - w / 2), sy, w, 1, c);
      if (dashed && sy % 4 < 2) R(projX(wx) - 0.5, sy, 1, 1, ICE);
    }
  };
  const ellipse = (cx: number, cy: number, r: number, c: string, filled = false) => {
    if (filled) {
      for (let sy = Math.floor(projY(cy - r)); sy <= Math.ceil(projY(cy + r)); sy++) {
        const dy = rowY(sy) - cy;
        if (Math.abs(dy) > r) continue;
        const dx = Math.sqrt(r * r - dy * dy);
        R(projX(cx - dx), sy, Math.max(1, Math.round(dx * 2)), 1, c);
      }
      return;
    }
    const steps = Math.ceil(r * 8);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      R(projX(cx + Math.cos(a) * r), projY(cy + Math.sin(a) * r), 1, 1, c);
    }
  };

  // goal creases (half discs in front of each goal line)
  for (const left of [true, false]) {
    const gl = left ? GOAL_LINE : RINK_L - GOAL_LINE;
    for (let sy = Math.floor(projY(CY - CREASE_R)); sy <= Math.ceil(projY(CY + CREASE_R)); sy++) {
      const dy = rowY(sy) - CY;
      if (Math.abs(dy) > CREASE_R) continue;
      const dx = Math.sqrt(CREASE_R * CREASE_R - dy * dy);
      if (left) R(projX(gl), sy, Math.round(dx), 1, CREASE);
      else R(projX(gl - dx), sy, Math.round(dx), 1, CREASE);
    }
    for (let i = 0; i <= 40; i++) {
      const a = -Math.PI / 2 + (i / 40) * Math.PI;
      const x = left ? gl + Math.cos(a) * CREASE_R : gl - Math.cos(a) * CREASE_R;
      R(projX(x), projY(CY + Math.sin(a) * CREASE_R), 1, 1, RED);
    }
    // trapezoid behind the net
    const endX = left ? 0 : RINK_L;
    for (const s of [-1, 1]) {
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = gl + (endX - gl) * t;
        const y = CY + s * (11 * FT + 3 * FT * t);
        const [x0, x1] = rinkXRange(y);
        if (x > x0 + 1 && x < x1 - 1) R(projX(x), projY(y), 1, 1, RED);
      }
    }
  }

  // lines
  vline(GOAL_LINE, 1, RED);
  vline(RINK_L - GOAL_LINE, 1, RED);
  vline(BLUE_LINE, 3, BLUE);
  vline(RINK_L - BLUE_LINE, 3, BLUE);
  vline(CX, 3, RED, true);

  // faceoff circles, hash marks and dots
  for (const left of [true, false]) {
    for (const topSide of [true, false]) {
      const x = left ? DOT_END_X : RINK_L - DOT_END_X;
      const y = topSide ? CY - DOT_DY : CY + DOT_DY;
      ellipse(x, y, CIRCLE_R, RED);
      for (const hx of [-3 * FT, 3 * FT]) {
        R(projX(x + hx), projY(y - CIRCLE_R) - 2, 1, 2, RED);
        R(projX(x + hx), projY(y + CIRCLE_R) + 1, 1, 2, RED);
      }
      ellipse(x, y, 4, RED, true);
      const nx = left ? DOT_NEU_X : RINK_L - DOT_NEU_X;
      ellipse(nx, y, 4, RED, true);
    }
  }
  // referee crease
  for (let i = 0; i <= 50; i++) {
    const a = (i / 50) * Math.PI;
    R(projX(CX + Math.cos(a) * 10 * FT), projY(Math.sin(a) * 10 * FT), 1, 1, RED);
  }

  // center ice logo of the home team
  const ring = colorDist(home.primary, home.secondary) < 60 ? home.accent : home.secondary;
  ellipse(CX, CY, 30, ring, true);
  ellipse(CX, CY, 26, home.primary, true);
  ellipse(CX, CY, CIRCLE_R, BLUE);
  const tc = bestOn(home.primary, [home.accent, home.secondary, '#ffffff', '#111111']);
  text(g, home.abbr, projX(CX), projY(CY) - 3, { color: tc, align: 'center', shadow: 'rgba(0,0,0,0.35)' });
  ellipse(CX, CY - 15, 2, BLUE, true);

  // painted sponsor logos in the neutral zone (faint, under the ice)
  for (const [label, y] of [['PIXEL COLA', 40], ['RETRO BANK', RINK_W - 34]] as [string, number][]) {
    g.globalAlpha = 0.22;
    text(g, label, projX(CX), projY(y) - 3, { color: '#c0392b', align: 'center', shadow: null });
    g.globalAlpha = 1;
  }
  // glossy sheen streaks and soft shading near the boards
  for (let k = 0; k < 9; k++) {
    const x0 = rng.range(40, RINK_L - 80);
    const y0 = rng.range(20, RINK_W - 40);
    const len = rng.range(30, 90);
    for (let i = 0; i < len; i++) {
      const x = x0 + i;
      const y = y0 + i * 0.35;
      const [a0, a1] = rinkXRange(y);
      if (x < a0 + 3 || x > a1 - 3 || y > RINK_W - 3) continue;
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(Math.round(projX(x)), Math.round(projY(y)), 1, 1);
    }
  }
  for (let sy = top; sy < bot; sy++) {
    const [x0, x1] = rinkXRange(rowY(sy));
    g.fillStyle = 'rgba(70,100,150,0.07)';
    g.fillRect(Math.round(projX(x0)), sy, 7, 1);
    g.fillRect(Math.round(projX(x1)) - 7, sy, 7, 1);
    if (sy - top < 4) {
      g.fillStyle = `rgba(40,60,100,${0.16 - (sy - top) * 0.035})`;
      g.fillRect(Math.round(projX(x0)), sy, Math.round(x1 - x0), 1);
    }
  }

  // far wall: rail, white face with ads, yellow kick plate; glass above
  const wallTop: number[] = [];
  for (let x = 0; x < RINK_L; x++) {
    const [yt] = rinkYRange(x + 0.5);
    const sTop = Math.round(projY(yt));
    wallTop[x] = sTop;
    const px = projX(x);
    R(px, sTop - WALL_H, 1, 1, '#34374a');
    R(px, sTop - WALL_H + 1, 1, WALL_H - 3, '#f6f6f1');
    R(px, sTop - 2, 1, 2, '#f1c12f');
    g.fillStyle = 'rgba(200,232,255,0.28)';
    g.fillRect(px, sTop - WALL_H - GLASS_H, 1, GLASS_H);
    if (x % 48 === 0) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(px, sTop - WALL_H - GLASS_H, 1, GLASS_H);
    }
    R(px, sTop - WALL_H - GLASS_H - 1, 1, 1, 'rgba(255,255,255,0.7)');
  }
  // ads on the straight section of the far boards
  let ax = CORNER_R + 8;
  let ai = 0;
  while (ax < RINK_L - CORNER_R - 40) {
    const [label, bg, fg] = ADS[ai % ADS.length];
    const w = textWidth(label) + 8;
    if (ax + w > RINK_L - CORNER_R - 4) break;
    if (!(ax < CX + 30 && ax + w > CX - 30)) {
      const sTop = wallTop[Math.round(ax)];
      R(projX(ax), sTop - WALL_H + 1, w, WALL_H - 3, bg);
      text(g, label, projX(ax) + 4, sTop - WALL_H + 1, { color: fg, shadow: null });
      ai++;
      ax += w + 18;
    } else ax += 12;
  }
  // board outline around the ice
  for (let sy = top - 1; sy <= bot; sy++) {
    const [x0, x1] = rinkXRange(Math.min(RINK_W, Math.max(0, rowY(sy))));
    R(projX(x0) - 2, sy, 2, 1, '#34374a');
    R(projX(x1), sy, 2, 1, '#34374a');
  }

  // near boards overlay (drawn above players)
  const near = mk();
  const n = near.getContext('2d')!;
  for (let x = -2; x < RINK_L + 2; x++) {
    const [, yb] = rinkYRange(Math.min(RINK_L, Math.max(0, x + 0.5)));
    const sB = Math.round(projY(yb));
    const px = projX(x);
    n.fillStyle = 'rgba(200,232,255,0.13)';
    n.fillRect(px, sB - 13, 1, 10);
    if (x % 48 === 0) {
      n.fillStyle = 'rgba(255,255,255,0.35)';
      n.fillRect(px, sB - 13, 1, 10);
    }
    n.fillStyle = '#3a3d52';
    n.fillRect(px, sB - 3, 1, 2);
    n.fillStyle = '#9da3b8';
    n.fillRect(px, sB - 1, 1, 1);
    n.fillStyle = '#5c6278';
    n.fillRect(px, sB, 1, 5);
  }

  // crowd: two frames for bobbing heads
  const crowdA = mk();
  const crowdB = mk();
  const ca = crowdA.getContext('2d')!;
  const cb = crowdB.getContext('2d')!;
  for (const c of [ca, cb]) {
    c.fillStyle = '#20243c';
    c.fillRect(0, 0, WORLD_PX_W, WORLD_PX_H);
    for (let y = 0; y < WORLD_PX_H; y += 5) {
      c.fillStyle = y % 10 === 0 ? '#262b47' : '#232842';
      c.fillRect(0, y, WORLD_PX_W, 2);
    }
  }
  const skins = ['#f1c39a', '#d9a066', '#8d5524', '#c68642', '#ffdbac', '#e0ac69'];
  const shirts = [home.primary, home.primary, home.secondary, shade(home.primary, 0.7), home.primary, away.primary, '#5a5f7a', '#d8d8e0', shade(home.primary, 0.8), '#3a3f5a'];
  const allowed = (sx: number, sy: number) => {
    const x = sx - projX(0);
    if (x < -6 || x > RINK_L + 6) return true;
    const cx = Math.max(0, Math.min(RINK_L - 1, Math.round(x)));
    const [yt, yb] = rinkYRange(cx + 0.5);
    return sy < projY(yt) - WALL_H - GLASS_H - 3 || sy > projY(yb) + 7;
  };
  for (let y = 2; y < WORLD_PX_H - 4; y += 5) {
    const off = (y / 5) % 2 ? 2 : 0;
    for (let x = off; x < WORLD_PX_W - 3; x += 4) {
      if ((x + 40) % 140 < 6) continue; // aisles
      if (!allowed(x + 1, y) || !allowed(x + 1, y + 4)) continue;
      if (rng.chance(0.07)) continue; // empty seat
      const skin = rng.pick(skins);
      const shirt = rng.pick(shirts);
      const bob = rng.chance(0.45) ? 1 : 0;
      for (const [c, dy] of [[ca, 0], [cb, bob]] as [CanvasRenderingContext2D, number][]) {
        c.fillStyle = shirt;
        c.fillRect(x, y + 2 - dy, 3, 2);
        c.fillStyle = skin;
        c.fillRect(x + 1 - (dy && rng.chance(0.5) ? 0 : 0), y - dy, 2, 2);
      }
    }
  }
  for (const c of [ca, cb]) {
    c.fillStyle = 'rgba(16,18,40,0.42)';
    c.fillRect(0, 0, WORLD_PX_W, WORLD_PX_H);
  }
  // fans holding signs
  const signs = [`GO ${home.abbr}!`, 'GOAL!', '#1 FAN', `${home.abbr} RULES`, 'BAR DOWN!', 'SHOOT!'];
  const placed: [number, number, number][] = [];
  for (let i = 0; i < 40 && placed.length < 14; i++) {
    const label = rng.pick(signs);
    const w = textWidth(label) + 4;
    const x = Math.round(rng.range(4, WORLD_PX_W - w - 4));
    const y = Math.round(rng.range(40, WORLD_PX_H - 12));
    if (!allowed(x, y) || !allowed(x + w, y) || !allowed(x, y + 9) || !allowed(x + w, y + 9)) continue;
    if (placed.some(([px, py, pw]) => x < px + pw + 12 && x + w + 12 > px && Math.abs(y - py) < 16)) continue;
    placed.push([x, y, w]);
    for (const [c, dy] of [[ca, 0], [cb, 1]] as [CanvasRenderingContext2D, number][]) {
      c.fillStyle = '#f4f4ef';
      c.fillRect(x, y - dy, w, 9);
      text(c, label, x + 2, y + 1 - dy, { color: home.primary === '#ffffff' ? '#111' : shade(home.primary, 0.9), shadow: null });
    }
  }
  // catwalk light rig and hanging banners at the top of the bowl
  for (const c of [ca, cb]) {
    c.fillStyle = '#0d0f1e';
    c.fillRect(0, 0, WORLD_PX_W, 26);
    c.fillStyle = '#2b2f48';
    c.fillRect(0, 24, WORLD_PX_W, 2);
    for (let x = 6; x < WORLD_PX_W; x += 14) {
      c.fillStyle = '#fff6c8';
      c.fillRect(x, 22, 2, 2);
      c.fillStyle = 'rgba(255,246,200,0.05)';
      c.beginPath();
      c.moveTo(x - 1, 24);
      c.lineTo(x + 3, 24);
      c.lineTo(x + 9, 60);
      c.lineTo(x - 7, 60);
      c.closePath();
      c.fill();
    }
    const banners = [home.primary, home.secondary, home.primary, home.primary, home.secondary];
    for (let i = 0; i < 8; i++) {
      const bx = 40 + i * 86;
      const col = banners[i % banners.length];
      const trim = col === home.primary ? (colorDist(home.primary, home.secondary) < 60 ? home.accent : home.secondary) : home.primary;
      c.fillStyle = col;
      c.fillRect(bx, 2, 14, 18);
      c.fillStyle = trim;
      c.fillRect(bx, 2, 14, 2);
      c.fillRect(bx, 16, 14, 1);
      c.fillRect(bx + 6, 20, 2, 2);
      tinyNumber(c, [9, 4, 77, 99, 19, 66, 12, 33][i], bx + (i === 0 || i === 1 ? 6 : 4), 8, bestOn(col, [home.accent, '#ffffff', '#111111']));
    }
  }

  // team benches behind the far glass
  for (const [x0, team] of [[CX - 110, home], [CX + 20, away]] as [number, Team][]) {
    const sy = Math.round(projY(0)) - WALL_H - GLASS_H - 12;
    for (const c of [ca, cb]) {
      c.fillStyle = '#15182a';
      c.fillRect(projX(x0), sy, 90, 10);
      c.fillStyle = shade(team.primary, 0.7);
      c.fillRect(projX(x0), sy + 8, 90, 2);
      for (let i = 0; i < 9; i++) {
        c.fillStyle = team.primary;
        c.fillRect(projX(x0) + 4 + i * 10, sy + 4, 4, 4);
        c.fillStyle = '#1d1d26';
        c.fillRect(projX(x0) + 5 + i * 10, sy + 1, 2, 3);
      }
    }
  }
  return { crowd: [crowdA, crowdB], rink, near };
}
