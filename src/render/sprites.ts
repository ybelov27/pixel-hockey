import type { Team } from '../data/teams';
import { bestOn, colorDist, lum, shade } from './colors';
import { text, tinyNumber, tinyWidth } from './font';

export interface Kit {
  key: string;
  jersey: string;
  trim: string;
  number: string;
  pants: string;
  helmet: string;
  sock: string;
  glove: string;
  pad: string;
  striped?: boolean;
}

const OUTLINE = '#12121c';
const SKIN = '#f1c39a';
const SKATE = '#26262e';
const BLADE = '#c9ced8';

export function kitFor(team: Team, home: boolean): Kit {
  const darker = lum(team.primary) < lum(team.secondary) ? team.primary : team.secondary;
  const pants = lum(darker) < 0.2 ? darker : '#1d1d26';
  if (home) {
    const trim = colorDist(team.primary, team.secondary) < 60 ? team.accent : team.secondary;
    return {
      key: team.abbr + 'H',
      jersey: team.primary,
      trim,
      number: bestOn(team.primary, [team.accent, team.secondary, '#ffffff', '#111111']),
      pants,
      helmet: pants,
      sock: team.primary,
      glove: pants,
      pad: '#f4f4f4',
    };
  }
  return {
    key: team.abbr + 'A',
    jersey: '#f4f4f6',
    trim: team.primary,
    number: team.primary,
    pants,
    helmet: pants,
    sock: '#f4f4f6',
    glove: pants,
    pad: '#f4f4f4',
  };
}

export const REF_KIT: Kit = {
  key: 'REF',
  jersey: '#f4f4f4',
  trim: '#111111',
  number: '#111111',
  pants: '#111111',
  helmet: '#111111',
  sock: '#111111',
  glove: '#111111',
  pad: '#111111',
  striped: true,
};

export type View = 'side' | 'front' | 'back';
export type Pose = 'skate' | 'down' | 'celebrate';
export type GPose = 'stance' | 'butterfly' | 'glove' | 'blocker';

function mk(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function addOutline(c: HTMLCanvasElement, color = OUTLINE) {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const w = c.width;
  const h = c.height;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const marks: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push(x, y);
    }
  ctx.fillStyle = color;
  for (let i = 0; i < marks.length; i += 2) ctx.fillRect(marks[i], marks[i + 1], 1, 1);
}

function flipped(src: HTMLCanvasElement) {
  const c = mk(src.width, src.height);
  const ctx = c.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();

export const SK_W = 16;
export const SK_H = 21;
export const SK_AX = 8; // anchor (feet) inside sprite
export const SK_AY = 19;

function drawSkater(kit: Kit, view: View, frame: number, pose: Pose, number: number) {
  const c = mk(SK_W, SK_H);
  const g = c.getContext('2d')!;
  const R = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const jersey = (x: number, y: number, w: number, h: number) => {
    R(x, y, w, h, kit.jersey);
    if (kit.striped) for (let i = x + 1; i < x + w; i += 2) R(i, y, 1, h, '#151515');
  };

  if (pose === 'down') {
    // lying on the ice, head to the left
    R(1, 14, 4, 4, kit.helmet);
    R(3, 15, 2, 2, SKIN);
    jersey(5, 14, 6, 4);
    R(5, 17, 6, 1, kit.trim);
    R(11, 14, 2, 4, kit.pants);
    R(13, 15, 2, 2, kit.sock);
    R(15, 14, 1, 4, SKATE);
    addOutline(c);
    return c;
  }

  const L = [2, 0, -2, 0][frame & 3];
  if (view === 'side') {
    // back leg (darker for depth)
    const bx = 6 - L;
    const fx = 7 + L;
    const backSock = shade(kit.sock, 0.75);
    R(bx, 14, 2, 3, backSock);
    R(bx, 15, 2, 1, shade(kit.trim, 0.75));
    R(bx, 17, 3, 1, SKATE);
    R(bx - 1, 18, 4, 1, BLADE);
    // pants and torso
    R(5, 11, 6, 3, kit.pants);
    jersey(5, 5, 6, 6);
    R(5, 5, 6, 1, kit.trim);
    R(5, 9, 6, 1, kit.trim);
    // front leg
    R(fx, 14, 2, 3, kit.sock);
    R(fx, 15, 2, 1, kit.trim);
    R(fx, 17, 3, 1, SKATE);
    R(fx - 1, 18, 4, 1, BLADE);
    // head
    R(7, 1, 3, 1, kit.helmet);
    R(6, 2, 5, 3, kit.helmet);
    R(9, 3, 2, 2, SKIN);
    R(8, 5, 2, 1, SKIN);
    R(10, 3, 1, 1, '#1a1a1a');
    // arm reaching forward + glove
    R(9, 6, 2, 3, shade(kit.jersey, 0.88));
    R(9, 7, 2, 1, kit.trim);
    R(10, 9, 2, 2, kit.glove);
  } else {
    const lift = view === 'front' ? [1, 0, 0, 0] : [0, 0, 1, 0];
    const ll = lift[frame & 3];
    const rl = lift[(frame + 2) & 3];
    // legs
    R(5, 14 - ll, 2, 3, kit.sock);
    R(5, 15 - ll, 2, 1, kit.trim);
    R(5, 17 - ll, 2, 1, SKATE);
    R(5, 18 - ll, 2, 1, BLADE);
    R(9, 14 - rl, 2, 3, kit.sock);
    R(9, 15 - rl, 2, 1, kit.trim);
    R(9, 17 - rl, 2, 1, SKATE);
    R(9, 18 - rl, 2, 1, BLADE);
    R(4, 11, 8, 3, kit.pants);
    jersey(4, 5, 8, 6);
    if (pose === 'celebrate') {
      R(3, 1, 1, 5, kit.jersey);
      R(12, 1, 1, 5, kit.jersey);
      R(2, 0, 2, 2, kit.glove);
      R(12, 0, 2, 2, kit.glove);
    } else {
      R(3, 6, 1, 3, shade(kit.jersey, 0.88));
      R(12, 6, 1, 3, shade(kit.jersey, 0.88));
      R(2, 9, 2, 2, kit.glove);
      R(12, 9, 2, 2, kit.glove);
    }
    if (view === 'front') {
      R(4, 5, 8, 1, kit.trim);
      R(4, 9, 8, 1, kit.trim);
      R(6, 1, 4, 1, kit.helmet);
      R(5, 2, 6, 3, kit.helmet);
      R(6, 3, 4, 2, SKIN);
      R(7, 3, 1, 1, '#1a1a1a');
      R(9, 3, 1, 1, '#1a1a1a');
    } else {
      R(4, 10, 8, 1, kit.trim);
      R(6, 1, 4, 1, kit.helmet);
      R(5, 2, 6, 4, kit.helmet);
      if (number > 0 && !kit.striped) {
        const w = tinyWidth(number);
        tinyNumber(g, number, 4 + Math.floor((8 - w) / 2), 5, kit.number);
      }
    }
  }
  addOutline(c);
  return c;
}

export function skaterSprite(kit: Kit, view: View, flip: boolean, frame: number, pose: Pose, number: number): HTMLCanvasElement {
  const f = pose === 'skate' ? frame & 3 : 0;
  const n = view === 'back' ? number : 0;
  const key = `${kit.key}|${view}|${f}|${pose}|${n}|${flip ? 1 : 0}`;
  let c = cache.get(key);
  if (!c) {
    if (flip) {
      c = flipped(skaterSprite(kit, view, false, frame, pose, number));
    } else {
      c = drawSkater(kit, view, f, pose, n);
    }
    cache.set(key, c);
  }
  return c;
}

export const G_W = 20;
export const G_H = 22;
export const G_AX = 9;
export const G_AY = 20;

function drawGoalie(kit: Kit, pose: GPose) {
  const c = mk(G_W, G_H);
  const g = c.getContext('2d')!;
  const R = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const low = pose === 'butterfly' ? 4 : 0;
  const pad = kit.pad;
  const padTrim = kit.trim === '#f4f4f6' ? kit.jersey : kit.trim;
  if (pose === 'butterfly') {
    R(1, 17, 8, 3, pad);
    R(10, 17, 8, 3, pad);
    R(3, 17, 1, 3, padTrim);
    R(15, 17, 1, 3, padTrim);
    R(1, 20, 2, 1, SKATE);
    R(16, 20, 2, 1, SKATE);
  } else {
    R(5, 13, 4, 6, shade(pad, 0.85));
    R(10, 13, 4, 6, pad);
    R(5, 15, 4, 1, padTrim);
    R(10, 15, 4, 1, padTrim);
    R(5, 19, 4, 1, SKATE);
    R(10, 19, 4, 1, SKATE);
    R(4, 20, 6, 1, BLADE);
    R(9, 20, 6, 1, BLADE);
  }
  // pants + torso (wide chest protector)
  R(5, 11 + low, 9, 3, kit.pants);
  R(4, 5 + low, 11, 6, kit.jersey);
  R(4, 5 + low, 11, 1, kit.trim);
  R(4, 9 + low, 11, 1, kit.trim);
  // mask
  R(7, 0 + low, 5, 1, '#e9e9ee');
  R(6, 1 + low, 7, 4, '#e9e9ee');
  R(10, 2 + low, 3, 2, '#3a3a44');
  R(11, 2 + low, 1, 2, '#9aa0aa');
  R(6, 1 + low, 2, 1, kit.trim);
  // blocker (back hand) and catching glove (front)
  if (pose === 'glove') {
    R(13, 1 + low, 4, 4, '#e2e2e8');
    R(14, 2 + low, 2, 2, padTrim);
    R(12, 4 + low, 2, 3, kit.jersey);
  } else {
    R(14, 8 + low, 4, 4, '#e2e2e8');
    R(15, 9 + low, 2, 2, padTrim);
  }
  if (pose === 'blocker') {
    R(1, 4 + low, 3, 5, '#e2e2e8');
    R(2, 5 + low, 1, 3, padTrim);
  } else {
    R(2, 8 + low, 3, 4, '#e2e2e8');
    R(3, 9 + low, 1, 2, padTrim);
  }
  addOutline(c);
  return c;
}

export function goalieSprite(kit: Kit, pose: GPose, flip: boolean): HTMLCanvasElement {
  const key = `G|${kit.key}|${pose}|${flip ? 1 : 0}`;
  let c = cache.get(key);
  if (!c) {
    c = flip ? flipped(goalieSprite(kit, pose, false)) : drawGoalie(kit, pose);
    cache.set(key, c);
  }
  return c;
}

/** Original pixel-art crest made from team colors and abbreviation (not an official logo). */
export const CREST_W = 24;
export const CREST_H = 26;

export function crest(team: Team) {
  const key = 'CREST|' + team.abbr;
  let c = cache.get(key);
  if (c) return c;
  c = mk(CREST_W, CREST_H);
  const g = c.getContext('2d')!;
  const half = (y: number) => {
    if (y === 0) return 10;
    if (y < 15) return 11;
    return Math.max(0, Math.round(11 - (y - 14) * 1.15));
  };
  const border = colorDist(team.primary, team.secondary) < 60 ? team.accent : team.secondary;
  for (let y = 0; y < CREST_H - 1; y++) {
    const hw = half(y);
    if (hw <= 0) continue;
    g.fillStyle = border;
    g.fillRect(12 - hw, y, hw * 2, 1);
  }
  for (let y = 2; y < CREST_H - 3; y++) {
    const hw = half(y) - 2;
    if (hw <= 0) continue;
    g.fillStyle = team.primary;
    g.fillRect(12 - hw, y, hw * 2, 1);
  }
  // diagonal sash for flair
  g.fillStyle = shade(team.primary, 0.82);
  for (let y = 15; y < 21; y++) {
    const hw = half(y) - 2;
    if (hw > 0) g.fillRect(12 - hw, y, hw * 2, 1);
  }
  const tc = bestOn(team.primary, [team.accent, team.secondary, '#ffffff', '#111111']);
  text(g, team.abbr, 12, 6, { color: tc, align: 'center', shadow: lum(tc) > 0.4 ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.3)' });
  addOutline(c);
  cache.set(key, c);
  return c;
}
