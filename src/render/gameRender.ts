import { HALF_POWER, type Match, type MatchEvent, type Side, type SkSnap, type Snap } from '../game/match';
import {
  CX, CY, GOAL_DEPTH, GOAL_H, GOAL_HW, GOAL_LINE, RINK_L, RINK_W, WORLD_PX_H, WORLD_PX_W, YS, projX, projY,
} from '../game/rink';
import { buildArena, type ArenaArt } from './arena';
import { G_AX, G_AY, REF_KIT, SK_AX, SK_AY, goalieSprite, kitFor, skaterSprite, type Kit, type View } from './sprites';
import { text, textWidth } from './font';
import { bar, chunky, ellipseRing, fillCircle, UI } from './ui';
import { bestOn, rgba, shade } from './colors';
import { display } from '../core/display';
import { input } from '../core/input';
import { settings } from '../core/storage';
import { rng } from '../core/rng';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  g: number;
}

type ThrowKind = 'hat' | 'octopus' | 'rat';

interface Thrown {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  kind: ThrowKind;
  color: string;
}

interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export class GameRenderer {
  arena: ArenaArt;
  kits: [Kit, Kit];
  camX = 0;
  camY = 0;
  private shake = 0;
  private parts: Particle[] = [];
  private pops: Pop[] = [];
  private crowdT = 0;
  private crowdFrame = 0;
  private hype = 0;
  private netRipple: [number, number] = [0, 0];
  private first = true;
  private thrown: Thrown[] = [];
  private lamp: [number, number] = [0, 0];
  private jumbo: { text: string; color: string; t: number } | null = null;
  private flashes: { x: number; y: number; t: number }[] = [];
  private flashRate = 1;
  private lastState = '';
  private zam = { x: -60, lane: 0, trail: 0 };

  constructor(private m: Match) {
    this.arena = buildArena(m.teams[0], m.teams[1]);
    this.kits = [kitFor(m.teams[0], true), kitFor(m.teams[1], false)];
  }

  handle(e: MatchEvent) {
    const x = projX(e.x);
    const y = projY(e.y);
    const shake = settings.shake;
    switch (e.t) {
      case 'spray':
        for (let i = 0; i < 4; i++) this.part(x, y, rng.gauss() * 30, -rng.next() * 25, 0.35, '#ffffff', 1, 60);
        break;
      case 'hit':
        for (let i = 0; i < 10; i++) this.part(x, y - 8, rng.gauss() * 60, rng.gauss() * 40 - 20, 0.4, i % 2 ? '#ffffff' : '#cfe8ff', 1, 80);
        this.pops.push({ x, y: y - 22, text: rng.pick(['WHAM!', 'BOOM!', 'SMASH!']), color: UI.yellow, life: 0.8 });
        if (shake) this.shake = Math.max(this.shake, 3);
        break;
      case 'post':
        for (let i = 0; i < 10; i++) this.part(x, y - 6, rng.gauss() * 70, rng.gauss() * 50 - 30, 0.3, i % 2 ? '#ffd23f' : '#ffffff', 1, 120);
        this.pops.push({ x, y: y - 20, text: 'PING!', color: '#ffffff', life: 0.6 });
        if (shake) this.shake = Math.max(this.shake, 2);
        break;
      case 'save':
        for (let i = 0; i < 6; i++) this.part(x, y - 8, rng.gauss() * 40, -rng.next() * 40, 0.35, '#ffffff', 1, 90);
        if (this.m.state === 'play') this.pops.push({ x, y: y - 26, text: 'SAVE!', color: '#9be7ff', life: 0.7 });
        break;
      case 'board':
        for (let i = 0; i < 3; i++) this.part(x, y, rng.gauss() * 30, -rng.next() * 20, 0.25, '#ffffff', 1, 60);
        break;
      case 'goal': {
        const t = this.m.teams[e.side ?? 0];
        const cols = [t.primary, t.secondary, '#ffffff', t.accent];
        for (let i = 0; i < 70; i++) this.part(x, y - 6, rng.gauss() * 90, -40 - rng.next() * 110, 1.6 + rng.next(), cols[i % 4], rng.chance(0.3) ? 2 : 1, 140);
        this.hype = 3.2;
        const gi = e.x < RINK_L / 2 ? 0 : 1;
        this.netRipple[gi] = 0.6;
        this.lamp[gi] = 3;
        this.flashRate = 10;
        if (!this.jumbo || this.jumbo.t < 1) this.showJumbo('GOAL!', t.primary, 3);
        // fan traditions: octopus in Detroit, plastic rats in Florida
        if (e.side === 0 && t.abbr === 'DET') this.throwItem('octopus');
        if (e.side === 0 && t.abbr === 'FLA') for (let i = 0; i < 5; i++) this.throwItem('rat');
        if (shake) this.shake = 5;
        break;
      }
      case 'deke':
        this.pops.push({ x, y: y - 24, text: 'DEKE!', color: '#ffffff', life: 0.5 });
        break;
      case 'shot':
        this.flashRate = Math.max(this.flashRate, 4);
        break;
      case 'crossbar':
        for (let i = 0; i < 12; i++) this.part(x, y - 14, rng.gauss() * 60, rng.gauss() * 40 - 30, 0.35, i % 2 ? '#ffd23f' : '#ffffff', 1, 120);
        if (e.value) this.showJumbo('BAR DOWN!', '#ffd23f', 3);
        else this.pops.push({ x, y: y - 26, text: 'CROSSBAR!', color: '#ffffff', life: 0.9 });
        if (settings.shake) this.shake = Math.max(this.shake, 2);
        break;
      case 'robbed':
        this.pops.push({ x, y: y - 30, text: 'ROBBED!', color: '#9be7ff', life: 1 });
        this.flashRate = 6;
        break;
      case 'mph':
        this.pops.push({ x, y: y - 28, text: `${e.value} MPH`, color: '#ffd23f', life: 0.9 });
        break;
      case 'hattrick': {
        this.showJumbo('HAT TRICK!', '#ffd23f', 4);
        for (let i = 0; i < 16; i++) this.throwItem('hat');
        break;
      }
      default:
        break;
    }
  }

  showJumbo(text: string, color: string, t: number) {
    this.jumbo = { text, color, t };
  }

  private throwItem(kind: ThrowKind) {
    const fromTop = rng.chance(0.5);
    const tx = rng.range(120, RINK_L - 120);
    const ty = rng.range(40, RINK_W - 40);
    const sx = tx + rng.gauss() * 40;
    const sy = fromTop ? 2 : RINK_W - 2;
    const t = 0.8 + rng.next() * 0.5;
    const hatCols = ['#1d1d26', '#c8102e', '#f4f4f4', '#003087', '#6b4f2a', '#2f6b2f'];
    this.thrown.push({ x: sx, y: sy, z: 30, vx: (tx - sx) / t, vy: (ty - sy) / t, vz: 60, kind, color: kind === 'hat' ? rng.pick(hatCols) : '' });
  }

  private part(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number, g: number) {
    if (this.parts.length > 400) return;
    this.parts.push({ x, y, vx, vy, life, max: life, color, size, g });
  }

  update(dt: number, snap: Snap) {
    const { W, H } = display;
    // camera follows the puck carrier / puck with a little lead
    let tx = projX(snap.px) + snap.pvx * 0.22;
    let ty = projY(snap.py) + snap.pvy * 0.22 * YS;
    if (this.m.state === 'faceoff' || this.m.state === 'intro') {
      tx = projX(snap.px);
      ty = projY(snap.py);
    }
    const hud = 14;
    let cx = tx - W / 2;
    let cy = ty - (H + hud) / 2;
    cx = WORLD_PX_W <= W ? (WORLD_PX_W - W) / 2 : Math.max(0, Math.min(WORLD_PX_W - W, cx));
    cy = WORLD_PX_H <= H ? (WORLD_PX_H - H) / 2 : Math.max(0, Math.min(WORLD_PX_H - H, cy));
    if (this.first) {
      this.camX = cx;
      this.camY = cy;
      this.first = false;
    } else {
      const k = 1 - Math.pow(0.002, dt);
      this.camX += (cx - this.camX) * k;
      this.camY += (cy - this.camY) * k;
    }
    this.shake = Math.max(0, this.shake - dt * 12);
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.vx *= 0.98;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) {
      p.life -= dt;
      p.y -= 18 * dt;
    }
    this.pops = this.pops.filter((p) => p.life > 0);
    this.hype = Math.max(0, this.hype - dt);
    this.crowdT += dt;
    const rate = this.hype > 0 ? 0.11 : 0.55;
    if (this.crowdT > rate) {
      this.crowdT = 0;
      this.crowdFrame ^= 1;
    }
    this.netRipple[0] = Math.max(0, this.netRipple[0] - dt);
    this.netRipple[1] = Math.max(0, this.netRipple[1] - dt);
    this.lamp[0] = Math.max(0, this.lamp[0] - dt);
    this.lamp[1] = Math.max(0, this.lamp[1] - dt);
    if (this.jumbo) {
      this.jumbo.t -= dt;
      if (this.jumbo.t <= 0) this.jumbo = null;
    }
    const st = this.m.state;
    if (st === 'faceoff' && this.lastState !== 'faceoff') this.thrown = [];
    if (st === 'periodEnd' && this.lastState !== 'periodEnd') this.zam = { x: Math.max(-40, this.camX - projX(0) - 30), lane: 0, trail: Math.max(-40, this.camX - projX(0) - 30) };
    this.lastState = st;
    for (const o of this.thrown) {
      if (o.z > 0 || o.vz > 0) {
        o.vz -= 160 * dt;
        o.z = Math.max(0, o.z + o.vz * dt);
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.z === 0) {
          o.vx *= 0.25;
          o.vy *= 0.25;
          o.vz = 0;
        }
      } else {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.vx *= 0.96;
        o.vy *= 0.96;
      }
    }
    // camera flashes in the stands
    this.flashRate = Math.max(1, this.flashRate - dt * 3);
    this.flashes = this.flashes.filter((f) => (f.t -= dt) > 0);
    if (rng.next() < dt * this.flashRate * 2.5) {
      const fx = this.camX + rng.next() * display.W;
      const fy = this.camY + rng.next() * display.H;
      const wx = fx - projX(0);
      const top = projY(0) - 30;
      const bot = projY(RINK_W) + 8;
      if (wx < -8 || wx > RINK_L + 8 || fy < top || fy > bot) this.flashes.push({ x: fx, y: fy, t: 0.12 });
    }
    if (st === 'intermission' || st === 'periodEnd') {
      this.zam.x += 45 * dt;
      if (this.zam.x > RINK_L + 40) this.zam = { x: -40, lane: 0, trail: -40 };
    }
  }

  draw(ctx: CanvasRenderingContext2D, snap: Snap) {
    const { W, H } = display;
    const sx = this.shake ? Math.round(rng.gauss() * this.shake * 0.5) : 0;
    const sy = this.shake ? Math.round(rng.gauss() * this.shake * 0.5) : 0;
    const ox = Math.round(this.camX) + sx;
    const oy = Math.round(this.camY) + sy;
    ctx.fillStyle = '#0c0e1c';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.arena.crowd[this.crowdFrame], -ox, -oy);
    if (this.hype > 0 && Math.floor(this.hype * 8) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 0, W, H);
    }
    for (const f of this.flashes) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(f.x - ox), Math.round(f.y - oy), 1, 1);
      if (f.t > 0.07) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(Math.round(f.x - ox) - 1, Math.round(f.y - oy), 3, 1);
        ctx.fillRect(Math.round(f.x - ox), Math.round(f.y - oy) - 1, 1, 3);
      }
    }
    this.drawJumbotron(ctx, ox, oy);
    ctx.drawImage(this.arena.rink, -ox, -oy);
    this.drawResurfacer(ctx, ox, oy);

    // depth-sorted drawables
    const items: { y: number; draw: () => void }[] = [];
    for (const s of snap.sk) items.push({ y: s.y, draw: () => this.drawSkater(ctx, s, ox, oy) });
    for (const g of snap.go)
      items.push({
        y: g.y,
        draw: () => {
          const kit = this.kits[g.side];
          const px = Math.round(projX(g.x) - ox);
          const py = Math.round(projY(g.y) - oy);
          ctx.fillStyle = 'rgba(10,20,40,0.25)';
          ctx.fillRect(px - 6, py - 1, 13, 3);
          const gs = goalieSprite(kit, g.pose, g.rs < 0);
          const gax = g.rs < 0 ? G_AX + 1 : G_AX;
          this.reflect(ctx, gs, px, py, gax, G_AY);
          ctx.drawImage(gs, px - gax, py - G_AY);
          // paddle stick
          this.line(ctx, px + g.rs * 3, py - 7, px + g.rs * 6, py - 1, '#d7b377');
          ctx.fillStyle = '#1b1b22';
          ctx.fillRect(g.rs > 0 ? px + 5 : px - 9, py - 1, 5, 1);
        },
      });
    for (const gi of [0, 1]) items.push({ y: CY, draw: () => this.drawNet(ctx, gi, ox, oy) });
    items.push({ y: snap.py, draw: () => this.drawPuck(ctx, snap, ox, oy) });
    if (snap.ref) {
      const r = snap.ref;
      items.push({
        y: r.y,
        draw: () => {
          const px = Math.round(projX(r.x) - ox);
          const py = Math.round(projY(r.y) - oy);
          ctx.fillStyle = 'rgba(10,20,40,0.25)';
          ctx.fillRect(px - 4, py - 1, 9, 3);
          ctx.drawImage(skaterSprite(REF_KIT, 'front', false, Math.floor(performance.now() / 120), 'skate', 0), px - SK_AX, py - SK_AY);
        },
      });
    }
    for (const o of this.thrown) items.push({ y: o.y, draw: () => this.drawThrown(ctx, o, ox, oy) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    ctx.drawImage(this.arena.near, -ox, -oy);
    this.drawGoalLights(ctx, ox, oy);
    this.drawReticle(ctx, ox, oy);

    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const p of this.pops) text(ctx, p.text, p.x - ox, p.y - oy, { color: p.color, align: 'center', outline: '#12121c', shadow: null });

    // off-screen arrow for the controlled player
    const me = snap.sk.find((s) => s.ctrl);
    if (me) {
      const px = projX(me.x) - ox;
      const py = projY(me.y) - oy;
      if (px < 0 || px > W || py < 10 || py > H) {
        const ax = Math.max(6, Math.min(W - 6, px));
        const ay = Math.max(20, Math.min(H - 6, py - 10));
        fillCircle(ctx, ax, ay, 3, UI.yellow);
      }
    }
  }

  private drawSkater(ctx: CanvasRenderingContext2D, s: SkSnap, ox: number, oy: number) {
    const kit = this.kits[s.side];
    const px = Math.round(projX(s.x) - ox);
    const py = Math.round(projY(s.y) - oy);
    const fx = Math.cos(s.face);
    const fy = Math.sin(s.face) * YS;
    let view: View = Math.abs(fx) >= Math.abs(fy) * 1.1 ? 'side' : fy > 0 ? 'front' : 'back';
    let flip = fx < 0;
    if (s.deke > 0) {
      const k = Math.floor(s.deke * 22) % 4;
      view = k === 0 ? 'side' : k === 1 ? 'front' : k === 2 ? 'side' : 'back';
      flip = k === 2;
    }
    const pose = s.down ? 'down' : s.celebrate ? 'celebrate' : 'skate';
    if (s.celebrate) view = 'front';
    const frame = s.speed < 8 ? 1 : Math.floor(s.anim / 7) % 4;
    ctx.fillStyle = 'rgba(10,20,40,0.25)';
    ctx.fillRect(px - 4, py - 1, 9, 3);
    if (s.ctrl) {
      ellipseRing(ctx, px, py, 7, 3, UI.yellow);
      ellipseRing(ctx, px, py + 1, 7, 3, shade(UI.yellow, 0.6));
    }
    const sprite = skaterSprite(kit, view, flip, frame, pose, s.number);
    const handX = view === 'side' ? px + (flip ? -3 : 3) : view === 'front' ? px + 5 : px - 5;
    const handY = py - 9;
    if (!s.down && !s.celebrate && view === 'back') this.drawStick(ctx, s, handX, handY, ox, oy);
    this.reflect(ctx, sprite, px, py, SK_AX, SK_AY);
    ctx.drawImage(sprite, px - SK_AX, py - SK_AY);
    if (!s.down && !s.celebrate && view !== 'back') this.drawStick(ctx, s, handX, handY, ox, oy);
    if (s.ctrl) {
      const bob = Math.round(Math.sin(performance.now() / 150));
      ctx.fillStyle = UI.yellow;
      ctx.fillRect(px - 2, py - 26 + bob, 5, 1);
      ctx.fillRect(px - 1, py - 25 + bob, 3, 1);
      ctx.fillRect(px, py - 24 + bob, 1, 1);
      if (s.charge > 0.05) {
        // same power curve as the engine; past the halfway tick it is a guaranteed bar down
        const full = this.m.chargeFull;
        const v = Math.max(0, Math.min(1, (s.charge - 0.18) / (full - 0.18)));
        const bd = v > HALF_POWER;
        const blink = Math.floor(performance.now() / 90) % 2 === 0;
        bar(ctx, px - 10, py - 32, 21, 4, v, bd ? (blink ? '#ffd23f' : '#fff6c8') : v > 0 ? UI.orange : '#9aa3d6');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 10 + Math.round(21 * HALF_POWER), py - 33, 1, 6);
        if (bd) text(ctx, 'BAR DOWN!', px, py - 42, { color: '#ffd23f', align: 'center', outline: '#12121c', shadow: null });
      }
    }
  }

  private drawStick(ctx: CanvasRenderingContext2D, s: SkSnap, hx: number, hy: number, ox: number, oy: number) {
    const fx = Math.cos(s.face);
    const fy = Math.sin(s.face);
    const dirX = Math.abs(fx) > 0.25 ? Math.sign(fx) : 0;
    let bx: number;
    let by: number;
    if (s.charge > 0.12) {
      const c = Math.min(1, s.charge);
      bx = hx - (dirX || 1) * 7;
      by = hy - 5 - c * 4;
    } else if (s.follow > 0) {
      bx = hx + (dirX || 1) * 8;
      by = hy - 4;
    } else {
      const wx = s.hasPuck ? 7 : 7;
      bx = Math.round(projX(s.x + fx * wx) - ox);
      by = Math.round(projY(s.y + fy * wx) - oy) - 1;
    }
    this.line(ctx, hx, hy, bx, by, '#d7b377');
    ctx.fillStyle = '#1b1b22';
    const bd = dirX || (fx >= 0 ? 1 : -1);
    ctx.fillRect(bd > 0 ? bx : bx - 2, by, 3, 1);
  }

  private line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    ctx.fillStyle = color;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 64; i++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  private drawNet(ctx: CanvasRenderingContext2D, gi: number, ox: number, oy: number) {
    const gl = gi === 0 ? GOAL_LINE : RINK_L - GOAL_LINE;
    const rs = gi === 0 ? 1 : -1;
    const fx = Math.round(projX(gl) - ox);
    const bx = Math.round(projX(gl - rs * GOAL_DEPTH) - ox);
    const top = Math.round(projY(CY - GOAL_HW) - oy);
    const bot = Math.round(projY(CY + GOAL_HW) - oy);
    const rip = this.netRipple[gi] > 0 ? Math.round(Math.sin(this.netRipple[gi] * 30) * 2) : 0;
    const x0 = Math.min(fx, bx);
    const w = Math.abs(fx - bx);
    // mesh: side panel + back
    for (let x = 0; x <= w; x++) {
      const colX = rs > 0 ? bx + x : bx - x;
      const t = rs > 0 ? x / w : x / w;
      const back = 1 - t;
      const hTop = Math.round(GOAL_H * (0.55 + 0.45 * t));
      const yTop = top - hTop + (back > 0.6 ? rip : 0);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(colX, yTop, 1, bot - yTop);
      if (x % 2 === 0) {
        ctx.fillStyle = 'rgba(160,170,190,0.6)';
        ctx.fillRect(colX, yTop, 1, bot - yTop);
      }
    }
    ctx.fillStyle = 'rgba(160,170,190,0.55)';
    for (let y = top - GOAL_H; y < bot; y += 2) ctx.fillRect(x0, y, w, 1);
    // red frame: posts + crossbar seen from the side, base bar
    ctx.fillStyle = '#d8343a';
    ctx.fillRect(fx - (rs > 0 ? 0 : 1), top - GOAL_H, 2, bot - (top - GOAL_H));
    ctx.fillStyle = '#b02a30';
    ctx.fillRect(x0, bot - 1, w + 1, 1);
    ctx.fillRect(x0, top - 1, w + 1, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fx - (rs > 0 ? 0 : 1), top - GOAL_H, 1, 1);
  }

  private drawPuck(ctx: CanvasRenderingContext2D, snap: Snap, ox: number, oy: number) {
    const px = Math.round(projX(snap.px) - ox);
    const py = Math.round(projY(snap.py) - oy);
    const z = Math.round(snap.pz);
    const sp = Math.hypot(snap.pvx, snap.pvy);
    ctx.fillStyle = 'rgba(10,20,40,0.35)';
    ctx.fillRect(px - 1, py, 3, 1);
    if (sp > 230) {
      for (let i = 1; i <= 3; i++) {
        ctx.fillStyle = `rgba(20,20,30,${0.35 - i * 0.09})`;
        ctx.fillRect(Math.round(px - snap.pvx * 0.012 * i) - 1, Math.round(py - z - snap.pvy * YS * 0.012 * i) - 1, 3, 2);
      }
    }
    ctx.fillStyle = '#111116';
    ctx.fillRect(px - 1, py - 1 - z, 3, 2);
    ctx.fillStyle = '#4a4a58';
    ctx.fillRect(px - 1, py - 1 - z, 1, 1);
  }

  /** Faint mirror image of a sprite on the glossy ice. */
  private reflect(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, px: number, py: number, ax: number, ay: number) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.translate(px - ax, py + 1);
    ctx.scale(1, -0.55);
    ctx.drawImage(sprite, 0, -ay);
    ctx.restore();
  }

  private drawJumbotron(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const m = this.m;
    const w = 84;
    const h = 30;
    const x = Math.round(projX(CX) - w / 2 - ox);
    const y = Math.round(projY(0) - 26 - h - 1 - oy);
    if (x > display.W || x + w < 0 || y > display.H || y + h + 8 < 0) return;
    ctx.fillStyle = '#3a3f5a';
    ctx.fillRect(x + 10, y - 12, 1, 12);
    ctx.fillRect(x + w - 11, y - 12, 1, 12);
    chunky(ctx, x, y, w, h + 4, '#1b1e30');
    ctx.fillStyle = '#05060c';
    ctx.fillRect(x + 3, y + 3, w - 6, h - 4);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = (Math.floor(performance.now() / 200) + i) % 3 === 0 ? '#ffd23f' : '#5a5030';
      ctx.fillRect(x + 4 + i * 8, y + h + 1, 2, 1);
    }
    const j = this.jumbo;
    if (j) {
      if (Math.floor(performance.now() / 180) % 2 === 0) {
        ctx.fillStyle = j.color;
        ctx.fillRect(x + 3, y + 3, w - 6, h - 4);
      }
      text(ctx, j.text, x + w / 2, y + 10, { color: '#ffffff', align: 'center', outline: '#05060c', shadow: null });
      return;
    }
    if (m.practice) {
      text(ctx, 'PRACTICE', x + w / 2, y + 6, { color: '#2ec4b6', align: 'center', shadow: null });
      text(ctx, `GOALS ${m.score[0]}`, x + w / 2, y + 17, { color: '#ffd23f', align: 'center', shadow: null });
      return;
    }
    const box = (side: Side, bx: number) => {
      const t = m.teams[side];
      ctx.fillStyle = t.primary;
      ctx.fillRect(bx, y + 5, 19, 9);
      text(ctx, t.abbr, bx + 10, y + 6, { color: bestOn(t.primary, [t.accent, t.secondary, '#ffffff', '#111111']), align: 'center', shadow: null });
      text(ctx, String(m.score[side]), bx + 24, y + 6, { color: '#ffd23f', align: 'center', shadow: null });
    };
    box(1, x + 6);
    box(0, x + 46);
    const c = Math.ceil(Math.max(0, m.clock));
    const per = m.so ? 'SO' : m.period <= 3 ? ['1ST', '2ND', '3RD'][m.period - 1] : 'OT';
    text(ctx, `${per} ${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`, x + w / 2, y + 17, { color: '#9be7ff', align: 'center', shadow: null });
  }

  private drawGoalLights(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    for (const gi of [0, 1]) {
      const sx = Math.round(projX(gi === 0 ? -5 : RINK_L + 5) - ox);
      const sy = Math.round(projY(CY) - 32 - oy);
      if (sx < -10 || sx > display.W + 10) continue;
      ctx.fillStyle = '#3a3f5a';
      ctx.fillRect(sx, sy + 4, 1, 10);
      chunky(ctx, sx - 3, sy - 2, 7, 7, '#1b1e30');
      const lit = this.lamp[gi] > 0 && Math.floor(this.lamp[gi] * 6) % 2 === 0;
      if (lit) {
        fillCircle(ctx, sx, sy + 1, 7, 'rgba(255,40,40,0.28)');
        fillCircle(ctx, sx, sy + 1, 4, 'rgba(255,90,90,0.5)');
      }
      ctx.fillStyle = lit ? '#ff3030' : this.lamp[gi] > 0 ? '#c01818' : '#5a1414';
      ctx.fillRect(sx - 2, sy - 1, 5, 4);
      ctx.fillStyle = lit ? '#ffd0d0' : '#7a2a2a';
      ctx.fillRect(sx - 1, sy - 1, 2, 1);
    }
  }

  private drawReticle(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const m = this.m;
    const h = m.human;
    if (h < 0 || !m.cfg.assist || m.state !== 'play' || !m.ctrl || m.puck.owner !== m.ctrl) return;
    if (m.ax(h as Side, m.puck.x) < CX - 40) return;
    const gx = m.oppGoalX(h as Side);
    const g = m.goalies[1 - h];
    const open = g.y < CY ? 1 : -1;
    const ty = CY + open * (GOAL_HW - 4);
    const sx = Math.round(projX(gx) - ox);
    const sy = Math.round(projY(ty) - 7 - oy);
    const r = 5 + Math.round((Math.sin(performance.now() / 120) + 1) * 1);
    ellipseRing(ctx, sx, sy + 1, r, r, 'rgba(0,0,0,0.5)');
    ellipseRing(ctx, sx, sy, r, r, UI.yellow);
    ellipseRing(ctx, sx, sy, r - 1, r - 1, UI.yellow);
    ctx.fillStyle = UI.yellow;
    ctx.fillRect(sx - 1, sy - 1, 3, 3);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillRect(sx + dx * (r + 2) - (dy ? 0 : dx < 0 ? 2 : 0), sy + dy * (r + 2) - (dx ? 0 : dy < 0 ? 2 : 0), dy ? 1 : 3, dy ? 3 : 1);
    text(ctx, 'SHOOT!', sx, sy - r - 11, { color: UI.yellow, align: 'center', outline: '#12121c', shadow: null });
  }

  private drawThrown(ctx: CanvasRenderingContext2D, o: Thrown, ox: number, oy: number) {
    const px = Math.round(projX(o.x) - ox);
    const py = Math.round(projY(o.y) - oy);
    const z = Math.round(o.z);
    ctx.fillStyle = 'rgba(10,20,40,0.25)';
    ctx.fillRect(px - 2, py, 5, 1);
    const y = py - z;
    if (o.kind === 'hat') {
      ctx.fillStyle = '#111116';
      ctx.fillRect(px - 3, y - 1, 7, 1);
      ctx.fillStyle = o.color;
      ctx.fillRect(px - 2, y - 4, 5, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(px - 2, y - 4, 1, 1);
    } else if (o.kind === 'octopus') {
      ctx.fillStyle = '#7b3fa0';
      ctx.fillRect(px - 2, y - 5, 5, 3);
      ctx.fillRect(px - 3, y - 2, 7, 1);
      for (let i = -3; i <= 3; i += 2) ctx.fillRect(px + i, y - 1, 1, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, y - 4, 1, 1);
      ctx.fillRect(px + 1, y - 4, 1, 1);
    } else {
      ctx.fillStyle = '#8a8a96';
      ctx.fillRect(px - 2, y - 3, 4, 2);
      ctx.fillRect(px + 2, y - 3, 1, 1);
      ctx.fillStyle = '#e8a0b0';
      ctx.fillRect(px - 4, y - 2, 2, 1);
      ctx.fillStyle = '#111';
      ctx.fillRect(px + 1, y - 3, 1, 1);
    }
  }

  private drawResurfacer(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const st = this.m.state;
    if (st !== 'intermission' && st !== 'periodEnd') return;
    const wy = RINK_W - 22;
    const x0 = Math.max(10, this.zam.trail);
    const x1 = Math.min(RINK_L - 10, this.zam.x - 10);
    if (x1 > x0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(Math.round(projX(x0) - ox), Math.round(projY(wy - 9) - oy), Math.round(x1 - x0), Math.round(18 * YS));
    }
    const px = Math.round(projX(this.zam.x) - ox);
    const py = Math.round(projY(wy) - oy);
    ctx.fillStyle = 'rgba(10,20,40,0.3)';
    ctx.fillRect(px - 12, py, 24, 3);
    chunky(ctx, px - 13, py - 6, 6, 6, '#8d93a8');
    chunky(ctx, px - 8, py - 11, 20, 10, '#e9eef6');
    ctx.fillStyle = '#2f55c8';
    ctx.fillRect(px - 8, py - 5, 20, 2);
    ctx.fillStyle = '#9fd0ff';
    ctx.fillRect(px + 5, py - 15, 6, 5);
    ctx.fillStyle = '#e9eef6';
    ctx.fillRect(px + 4, py - 16, 8, 1);
    ctx.fillStyle = '#f1c39a';
    ctx.fillRect(px + 7, py - 14, 2, 2);
    ctx.fillStyle = '#111116';
    ctx.fillRect(px - 6, py - 1, 4, 2);
    ctx.fillRect(px + 6, py - 1, 4, 2);
  }

  // ---------- HUD ----------
  hud(ctx: CanvasRenderingContext2D) {
    const m = this.m;
    const { safe } = display;
    const x0 = safe.l + 4;
    const y0 = safe.t + 3;
    if (m.practice) {
      this.practiceHud(ctx, x0, y0);
      this.pauseButton(ctx);
      return;
    }
    let x = x0;
    const box = (team: Side, score: number) => {
      const t = m.teams[team];
      chunky(ctx, x, y0, 23, 11, t.primary);
      text(ctx, t.abbr, x + 12, y0 + 2, { color: bestOn(t.primary, [t.accent, t.secondary, '#ffffff', '#111111']), align: 'center', shadow: null });
      x += 23;
      chunky(ctx, x, y0, 13, 11, '#0d0f1e');
      text(ctx, String(score), x + 7, y0 + 2, { color: '#ffffff', align: 'center', shadow: null });
      x += 15;
    };
    chunky(ctx, x0 - 1, y0 + 2, 2 * 38 + 58, 11, 'rgba(0,0,0,0.35)');
    box(1, m.score[1]);
    box(0, m.score[0]);
    let per: string;
    let clk: string;
    if (m.so) {
      per = 'SO';
      clk = `R${m.so.round}`;
    } else {
      per = m.period <= 3 ? ['1ST', '2ND', '3RD'][m.period - 1] : m.period === 4 ? 'OT' : `${m.period - 3}OT`;
      const c = Math.ceil(Math.max(0, m.clock));
      clk = `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`;
    }
    chunky(ctx, x, y0, 58, 11, '#0d0f1e');
    text(ctx, per, x + 4, y0 + 2, { color: UI.yellow, shadow: null });
    text(ctx, clk, x + 54, y0 + 2, { color: '#ffffff', align: 'right', shadow: null });
    let y = y0 + 14;
    const pp = m.pp;
    if (pp) {
      const t = m.teams[pp.side];
      const s = `PP ${t.abbr} 0:${String(Math.ceil(pp.time)).padStart(2, '0')}`;
      chunky(ctx, x0, y, textWidth(s) + 6, 10, UI.yellow);
      text(ctx, s, x0 + 3, y + 2, { color: '#1a1a2a', shadow: null });
      y += 12;
    }
    if (m.delayedPenalty) {
      chunky(ctx, x0, y, 52, 10, '#e85d04');
      text(ctx, 'DELAYED', x0 + 26, y + 2, { color: '#fff', align: 'center', shadow: null });
    }
    if (m.so) {
      // shootout tally
      for (const s of [1, 0] as Side[]) {
        const row = s === 1 ? 0 : 1;
        const yy = y0 + 14 + row * 9;
        text(ctx, m.teams[s].abbr, x0, yy, { color: '#fff' });
        for (let i = 0; i < Math.max(3, m.so.marks[s].length); i++) {
          const mk = m.so.marks[s][i];
          const col = mk === undefined ? '#3a3f60' : mk ? UI.green : UI.red;
          fillCircle(ctx, x0 + 24 + i * 8, yy + 3, 2, col);
        }
      }
    }
    this.pauseButton(ctx);
  }

  private practiceHud(ctx: CanvasRenderingContext2D, x0: number, y0: number) {
    const m = this.m;
    const goals = m.score[0];
    const shots = m.shots[0];
    const pct = shots ? Math.round((goals / shots) * 100) : 0;
    const items: [string, string][] = [
      ['GOALS', String(goals)],
      ['SOG', String(shots)],
      ['BAR DOWN', String(m.barDowns)],
      ['PCT', `${pct}%`],
    ];
    let x = x0;
    chunky(ctx, x, y0, 58, 11, '#2a9d8f');
    text(ctx, 'PRACTICE', x + 29, y0 + 2, { color: '#fff', align: 'center', shadow: null });
    x += 60;
    for (const [k, v] of items) {
      const w = textWidth(k) + textWidth(v) + 10;
      chunky(ctx, x, y0, w, 11, '#0d0f1e');
      text(ctx, k, x + 3, y0 + 2, { color: UI.dim, shadow: null });
      text(ctx, v, x + w - 3, y0 + 2, { color: k === 'BAR DOWN' ? UI.yellow : '#fff', align: 'right', shadow: null });
      x += w + 2;
    }
    if (!m.practiceGoalie) {
      chunky(ctx, x0, y0 + 13, 70, 10, '#6a4c93');
      text(ctx, 'EMPTY NET', x0 + 35, y0 + 15, { color: '#fff', align: 'center', shadow: null });
    }
  }

  private pauseButton(ctx: CanvasRenderingContext2D) {
    const { W, safe } = display;
    const pbx = W - safe.r - 13;
    const pby = safe.t + 10;
    fillCircle(ctx, pbx, pby, 8, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pbx - 3, pby - 3, 2, 7);
    ctx.fillRect(pbx + 2, pby - 3, 2, 7);
  }

  playerTag(ctx: CanvasRenderingContext2D) {
    const m = this.m;
    const c = m.ctrl;
    if (!c || m.human < 0) return;
    const { W, H, safe } = display;
    const label = `#${c.p.number} ${c.p.name}`;
    const w = Math.max(textWidth(label) + 8, 50);
    const x = Math.round(W / 2 - w / 2);
    const y = H - safe.b - 15;
    chunky(ctx, x, y, w, 13, 'rgba(0,0,0,0.45)');
    text(ctx, label, W / 2, y + 2, { color: '#fff', align: 'center', shadow: null });
    bar(ctx, x + 3, y + 10, w - 6, 2, c.p.stamina / 100, c.p.stamina < 30 ? UI.red : UI.green, '#222640');
  }

  banner(ctx: CanvasRenderingContext2D) {
    const b = this.m.banner;
    if (!b) return;
    const { W, H } = display;
    const t = b.t;
    if (b.big) {
      const bh = 34;
      const y = Math.round(H * 0.36 - bh / 2);
      const slide = Math.min(1, t / 0.18);
      const out = Math.max(0, (t - (b.dur - 0.2)) / 0.2);
      const bw = Math.round(W * slide * (1 - out));
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(W / 2 - bw / 2, y + 3, bw, bh);
      ctx.fillStyle = b.color;
      ctx.fillRect(W / 2 - bw / 2, y, bw, bh);
      ctx.fillStyle = shade(b.color, 1.3);
      ctx.fillRect(W / 2 - bw / 2, y, bw, 2);
      ctx.fillStyle = shade(b.color, 0.6);
      ctx.fillRect(W / 2 - bw / 2, y + bh - 2, bw, 2);
      if (slide >= 1 && out <= 0) {
        // bouncing letters
        const sc = b.text.length > 10 ? 2 : 3;
        const total = textWidth(b.text, sc);
        let lx = W / 2 - total / 2;
        for (let i = 0; i < b.text.length; i++) {
          const ch = b.text[i];
          const bounce = Math.round(Math.max(0, Math.sin((t - 0.18) * 10 - i * 0.5)) * -3);
          text(ctx, ch, lx, y + (b.sub ? 5 : 9) + bounce, { scale: sc, color: '#ffffff', outline: shade(b.color, 0.45), shadow: null });
          lx += 6 * sc;
        }
        if (b.sub) text(ctx, b.sub, W / 2, y + bh - 10, { color: '#ffffff', align: 'center', shadow: 'rgba(0,0,0,0.5)' });
      }
    } else {
      const w = Math.max(textWidth(b.text), textWidth(b.sub)) + 16;
      const h = b.sub ? 22 : 13;
      const x = Math.round(W / 2 - w / 2);
      const y = Math.round(H * 0.22);
      chunky(ctx, x, y + 2, w, h, 'rgba(0,0,0,0.35)');
      chunky(ctx, x, y, w, h, b.color);
      text(ctx, b.text, W / 2, y + 3, { color: '#fff', align: 'center' });
      if (b.sub) text(ctx, b.sub, W / 2, y + 12, { color: '#ffe9b0', align: 'center', shadow: null });
    }
  }

  touchControls(ctx: CanvasRenderingContext2D) {
    const m = this.m;
    const h = m.human;
    if (h < 0) return;
    const pk = m.puck;
    const offense = (pk.owner && pk.owner.side === h) || (!pk.owner && pk.passTarget?.side === h) || m.state === 'faceoff';
    const labels: Record<string, string> =
      m.state === 'faceoff'
        ? { a: 'DRAW', b: 'DRAW', c: '' }
        : offense && !(m.practice && pk.owner !== m.ctrl)
          ? { a: 'PASS', b: 'SHOOT', c: 'DEKE' }
          : m.practice
            ? { a: 'CALL', b: 'SHOOT', c: 'POKE' }
            : { a: 'SWITCH', b: 'CHECK', c: 'POKE' };
    const colors: Record<string, string> = { a: '#3a86ff', b: '#e63946', c: '#f4a236' };
    for (const b of input.touchButtons) {
      if (b.id === 'pause') continue;
      const held = b.id === 'a' ? input.a.down : b.id === 'b' ? input.b.down : input.c.down;
      const col = colors[b.id];
      fillCircle(ctx, b.x, b.y + 2, b.r, 'rgba(0,0,0,0.3)');
      fillCircle(ctx, b.x, b.y + (held ? 1 : 0), b.r, rgba(held ? shade(col, 1.2) : col, held ? 0.85 : 0.6));
      fillCircle(ctx, b.x, b.y - 1 + (held ? 1 : 0), b.r - 3, rgba(shade(col, 1.15), held ? 0.6 : 0.35));
      const lbl = labels[b.id];
      if (lbl) text(ctx, lbl, b.x, b.y - 3 + (held ? 1 : 0), { color: '#fff', align: 'center', shadow: 'rgba(0,0,0,0.5)' });
    }
    const j = input.joy;
    if (j.active) {
      fillCircle(ctx, j.bx, j.by, input.joyR, 'rgba(255,255,255,0.12)');
      ellipseRing(ctx, j.bx, j.by, input.joyR, input.joyR, 'rgba(255,255,255,0.35)');
      const dx = j.x - j.bx;
      const dy = j.y - j.by;
      const d = Math.hypot(dx, dy);
      const k = d > input.joyR ? input.joyR / d : 1;
      fillCircle(ctx, j.bx + dx * k, j.by + dy * k, 9, 'rgba(255,255,255,0.55)');
    } else {
      const { H, safe } = display;
      const hx = safe.l + 40;
      const hy = H - safe.b - 38;
      ellipseRing(ctx, hx, hy, input.joyR, input.joyR, 'rgba(255,255,255,0.18)');
      fillCircle(ctx, hx, hy, 8, 'rgba(255,255,255,0.15)');
      text(ctx, 'MOVE', hx, hy + input.joyR + 4, { color: 'rgba(255,255,255,0.4)', align: 'center', shadow: null });
    }
  }
}
