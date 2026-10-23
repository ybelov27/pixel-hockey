import type { Team } from '../data/teams';
import { rosterFor, type PlayerInfo, type Roster } from '../data/roster';
import { clamp, distToSeg, rotateTowards } from '../core/math';
import { rng } from '../core/rng';
import type { GPose } from '../render/sprites';
import {
  BLUE_LINE, CENTER_DOT, CX, CY, GOAL_DEPTH, GOAL_H, GOAL_HW, GOAL_LINE, RINK_L, RINK_W,
  constrainToRink, endDot, neutralDot, type Dot,
} from './rink';
import { aiThink, goalieThink } from './ai';

export type Side = 0 | 1;
export type Role = 'C' | 'LW' | 'RW' | 'LD' | 'RD';
export const ROLES: Role[] = ['C', 'LW', 'RW', 'LD', 'RD'];
export type MatchKind = 'exhibition' | 'season' | 'playoff' | 'attract' | 'shootout';

export interface MatchConfig {
  home: Team;
  away: Team;
  human: -1 | 0 | 1;
  periodSec: number;
  difficulty: number;
  offside: boolean;
  icing: boolean;
  penalties: boolean;
  kind: MatchKind;
  /** Easy Controls: aim/pass assist and puck protection for the human. */
  assist?: boolean;
  autoSwitch?: boolean;
}

export interface PadInput {
  move: { x: number; y: number };
  sprint: boolean;
  a: { pressed: boolean; down: boolean; released: boolean };
  b: { pressed: boolean; down: boolean; released: boolean };
  c: { pressed: boolean; down: boolean; released: boolean };
}

export interface Intent {
  mx: number;
  my: number;
  sprint: boolean;
}

export class Skater {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  face = 0;
  benched = false;
  penalty = 0;
  down = 0;
  lunge = 0;
  hitDone = false;
  checkCD = 0;
  pokeCD = 0;
  deke = 0;
  dekeCD = 0;
  slow = 0;
  pickupCD = 0;
  charge = -1;
  oneTimer = 0;
  follow = 0;
  anim = 0;
  celebrate = false;
  lastPuck = -99;
  tx = 0;
  ty = 0;
  think = 0;
  wait = 0;
  aimOffset = 0;
  intent: Intent = { mx: 0, my: 0, sprint: false };
  constructor(public side: Side, public role: Role, public p: PlayerInfo) {}
  get onIce() {
    return this.penalty <= 0 && !this.benched;
  }
  get isD() {
    return this.role === 'LD' || this.role === 'RD';
  }
}

export class Goalie {
  x = 0;
  y = CY;
  vx = 0;
  vy = 0;
  pose: GPose = 'stance';
  poseT = 0;
  hold = 0;
  react = 0;
  active = true;
  constructor(public side: Side, public p: PlayerInfo) {}
}

export interface Shot {
  side: Side;
  shooter: Skater;
  sx: number;
  sy: number;
  speed: number;
  onTarget: boolean;
  oneTimer: boolean;
  rebound: boolean;
  deke: boolean;
  slap: boolean;
  breakaway: boolean;
  t: number;
  resolved: boolean;
}

export class Puck {
  x = CX;
  y = CY;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  owner: Skater | null = null;
  gOwner: Goalie | null = null;
  lastSide: -1 | Side = -1;
  passTarget: Skater | null = null;
  shot: Shot | null = null;
  ice: { side: Side; ax: number } | null = null;
  get speed() {
    return Math.hypot(this.vx, this.vy);
  }
}

export interface SkSnap {
  side: Side;
  x: number;
  y: number;
  face: number;
  speed: number;
  anim: number;
  down: boolean;
  celebrate: boolean;
  charge: number;
  follow: number;
  number: number;
  ctrl: boolean;
  hasPuck: boolean;
  deke: number;
}

export interface GoSnap {
  side: Side;
  x: number;
  y: number;
  pose: GPose;
  rs: number;
  hold: boolean;
}

export interface Snap {
  sk: SkSnap[];
  go: GoSnap[];
  px: number;
  py: number;
  pz: number;
  pvx: number;
  pvy: number;
  ref: { x: number; y: number } | null;
}

export interface MatchEvent {
  t: 'hit' | 'save' | 'goal' | 'post' | 'spray' | 'shot' | 'board' | 'deke' | 'charge' | 'crossbar' | 'robbed' | 'mph' | 'hattrick';
  x: number;
  y: number;
  side?: Side;
  value?: number;
}

export interface GoalLog {
  period: number;
  clock: number;
  side: Side;
  scorer: PlayerInfo | null;
  assists: PlayerInfo[];
  pp: boolean;
  tag: string;
}

export type MatchState =
  | 'intro' | 'faceoff' | 'play' | 'stoppage' | 'goal' | 'replay' | 'periodEnd' | 'intermission' | 'final'
  | 'soIntro' | 'soAttempt' | 'soResult';

export interface Banner {
  text: string;
  sub: string;
  color: string;
  t: number;
  dur: number;
  big: boolean;
}

export interface Shootout {
  round: number;
  next: Side;
  att: [number, number];
  goals: [number, number];
  marks: [boolean[], boolean[]];
  shooterIdx: [number, number];
  shotTaken: boolean;
  settle: number;
  winner: Side | -1;
}

/** Share of goals that go in off the crossbar, and of crossbar clips that drop in. */
export const BAR_DOWN_CHANCE = 0.8;
const PUCK_FRICTION = 0.55;
const GRAV = 420;

export class Match {
  cfg: MatchConfig;
  teams: [Team, Team];
  rosters: [Roster, Roster];
  skaters: [Skater[], Skater[]];
  goalies: [Goalie, Goalie];
  puck = new Puck();
  dir: [number, number] = [1, -1];
  score: [number, number] = [0, 0];
  shots: [number, number] = [0, 0];
  hits: [number, number] = [0, 0];
  foWon: [number, number] = [0, 0];
  ppGoals: [number, number] = [0, 0];
  ppOpp: [number, number] = [0, 0];
  period = 1;
  clock: number;
  state: MatchState = 'intro';
  stateT = 0;
  time = 0;
  banner: Banner | null = null;
  ctrl: Skater | null = null;
  events: MatchEvent[] = [];
  goals: GoalLog[] = [];
  endType: 'REG' | 'OT' | 'SO' = 'REG';
  so: Shootout | null = null;

  private lineF: [number, number] = [0, 0];
  private lineD: [number, number] = [0, 0];
  private foDot: Dot = CENTER_DOT;
  private foDrop = 1;
  private foDropped = false;
  private foEarly = false;
  private foAi = 0.3;
  private pendingDot: Dot = CENTER_DOT;
  private touches: Skater[] = [];
  private delayed: { sk: Skater; name: string } | null = null;
  private lastSave = -99;
  private finalPending = false;
  private shootoutPending = false;
  private prevPx = CX;
  private switchT = 0;
  private lastPost = -99;
  private pendingTag = '';
  private goalCount = new Map<PlayerInfo, number>();
  refPos: { x: number; y: number } | null = null;
  private refT = 0;

  private rec: Snap[] = [];
  private recCount = 0;
  private goalFrame = -1;
  replay: Snap[] = [];
  replayPos = 0;
  /** Set by the scene: the human wants to skip the replay / continue. */
  skip = false;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.teams = [cfg.home, cfg.away];
    this.rosters = [rosterFor(cfg.home), rosterFor(cfg.away)];
    for (const r of this.rosters) for (const p of [...r.forwards, ...r.defense]) p.stamina = 100;
    this.skaters = [0, 1].map((s) => ROLES.map((role) => new Skater(s as Side, role, this.playerFor(s as Side, role)))) as [Skater[], Skater[]];
    this.goalies = [new Goalie(0, this.rosters[0].goalies[0]), new Goalie(1, this.rosters[1].goalies[0])];
    this.clock = cfg.periodSec;
    if (cfg.kind === 'shootout') {
      this.state = 'soIntro';
      this.startShootout();
    } else {
      this.setBanner('PERIOD 1', `${cfg.away.abbr} AT ${cfg.home.abbr}`, '#1d3557', 1.6, true);
      this.placeForFaceoff(CENTER_DOT);
    }
  }

  // ---------- helpers ----------
  get human() {
    return this.cfg.human;
  }
  goalX(s: Side) {
    return this.dir[s] > 0 ? GOAL_LINE : RINK_L - GOAL_LINE;
  }
  oppGoalX(s: Side) {
    return this.goalX((1 - s) as Side);
  }
  ax(s: Side, x: number) {
    return this.dir[s] > 0 ? x : RINK_L - x;
  }
  wx(s: Side, a: number) {
    return this.dir[s] > 0 ? a : RINK_L - a;
  }
  onIce(s: Side) {
    return this.skaters[s].filter((k) => k.onIce);
  }
  all() {
    return [...this.skaters[0], ...this.skaters[1]].filter((k) => k.onIce);
  }
  shorthanded(s: Side) {
    return this.onIce(s).length < this.onIce((1 - s) as Side).length;
  }
  get penaltyLen() {
    return Math.max(15, Math.round((this.cfg.periodSec * 120) / 1200));
  }
  difficulty() {
    return this.cfg.difficulty;
  }
  emit(t: MatchEvent['t'], x: number, y: number, side?: Side, value?: number) {
    this.events.push({ t, x, y, side, value });
  }

  private playerFor(s: Side, role: Role): PlayerInfo {
    const r = this.rosters[s];
    const f = this.lineF[s] * 3;
    const d = this.lineD[s] * 2;
    switch (role) {
      case 'C': return r.forwards[f];
      case 'LW': return r.forwards[f + 1];
      case 'RW': return r.forwards[f + 2];
      case 'LD': return r.defense[d];
      default: return r.defense[d + 1];
    }
  }

  setBanner(text: string, sub: string, color: string, dur = 1.4, big = false) {
    if (this.cfg.kind === 'attract') return;
    this.banner = { text, sub, color, t: 0, dur, big };
  }

  // ---------- main update ----------
  update(dt: number, inp: PadInput | null) {
    this.stateT += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    switch (this.state) {
      case 'intro':
        if (this.stateT > 1.6) this.beginFaceoff(CENTER_DOT);
        break;
      case 'faceoff':
        this.updateFaceoff(inp);
        break;
      case 'play':
        this.updatePlay(dt, inp);
        break;
      case 'stoppage':
        this.glide(dt);
        if (this.stateT > 1.5) {
          this.assessDelayed();
          this.beginFaceoff(this.pendingDot);
        }
        break;
      case 'goal':
        this.celebrate(dt);
        if (this.stateT < 1) this.record();
        if (this.stateT > 2.8 || (this.skip && this.stateT > 0.8)) {
          this.skip = false;
          this.buildReplay();
          if (this.replay.length && this.cfg.kind !== 'attract') {
            this.state = 'replay';
            this.stateT = 0;
            this.replayPos = 0;
          } else this.afterGoal();
        }
        break;
      case 'replay':
        this.replayPos += dt * 60 * 0.5;
        if (this.replayPos >= this.replay.length - 1 || this.skip) {
          this.skip = false;
          this.afterGoal();
        }
        break;
      case 'periodEnd':
        this.glide(dt);
        if (this.stateT > 1.8) {
          this.state = 'intermission';
          this.stateT = 0;
          if (this.cfg.kind === 'attract') this.continueGame();
        }
        break;
      case 'soIntro':
        if (this.stateT > 1.6) this.soSetup();
        break;
      case 'soAttempt':
        this.updatePlay(dt, inp);
        break;
      case 'soResult':
        this.glide(dt);
        if (this.stateT > 1.8) this.soNext();
        break;
      default:
        break;
    }
  }

  // ---------- faceoffs ----------
  private doLineChanges() {
    for (const s of [0, 1] as Side[]) {
      const sk = this.skaters[s];
      const fAvg = (sk[0].p.stamina + sk[1].p.stamina + sk[2].p.stamina) / 3;
      const dAvg = (sk[3].p.stamina + sk[4].p.stamina) / 2;
      if (fAvg < 60) this.lineF[s] = (this.lineF[s] + 1) % 3;
      if (dAvg < 60) this.lineD[s] = (this.lineD[s] + 1) % 3;
      for (const k of sk) k.p = this.playerFor(s, k.role);
    }
  }

  private placeForFaceoff(dot: Dot) {
    for (const s of [0, 1] as Side[]) {
      const own = -this.dir[s];
      for (const k of this.skaters[s]) {
        k.vx = k.vy = 0;
        k.down = 0;
        k.charge = -1;
        k.celebrate = false;
        k.lunge = 0;
        k.deke = 0;
        let x = dot.x;
        let y = dot.y;
        switch (k.role) {
          case 'C': x += own * 7; break;
          case 'LW': x += own * 14; y -= 30; break;
          case 'RW': x += own * 14; y += 30; break;
          case 'LD': x += own * 48; y -= 26; break;
          case 'RD': x += own * 48; y += 26; break;
        }
        const p = { x, y };
        constrainToRink(p, 10);
        k.x = p.x;
        k.y = p.y;
        k.face = own > 0 ? Math.PI : 0;
        if (k.penalty > 0) {
          k.x = CX + (s ? 30 : -30);
          k.y = RINK_W + 30;
        }
      }
      const g = this.goalies[s];
      g.x = this.goalX(s) + this.dir[s] * 6;
      g.y = CY;
      g.vx = g.vy = 0;
      g.hold = 0;
      g.pose = 'stance';
    }
    const pk = this.puck;
    pk.x = dot.x;
    pk.y = dot.y;
    pk.z = 0;
    pk.vx = pk.vy = pk.vz = 0;
    pk.owner = null;
    pk.gOwner = null;
    pk.shot = null;
    pk.passTarget = null;
    pk.ice = null;
    this.prevPx = pk.x;
    this.touches = [];
  }

  beginFaceoff(dot: Dot) {
    this.state = 'faceoff';
    this.stateT = 0;
    this.doLineChanges();
    this.foDot = dot;
    this.placeForFaceoff(dot);
    this.foDrop = 0.8 + rng.next() * 0.9;
    this.foDropped = false;
    this.foEarly = false;
    this.refPos = { x: dot.x, y: dot.y - 6 };
    this.refT = 0;
    const cpu = this.human === 0 ? 1 : 0;
    const aiC = this.skaters[cpu][0];
    const diffMod = [0.14, 0.06, 0.0, -0.04][this.cfg.difficulty] ?? 0;
    this.foAi = 0.2 + (75 - aiC.p.fo) * 0.004 + diffMod + rng.next() * 0.12 + (this.cfg.assist ? 0.12 : 0);
    if (this.human >= 0) this.ctrl = this.skaters[this.human as Side].find((k) => k.role === 'C' && k.onIce) || this.onIce(this.human as Side)[0] || null;
  }

  private updateFaceoff(inp: PadInput | null) {
    const t = this.stateT;
    const pressed = !!inp && (inp.a.pressed || inp.b.pressed);
    const humanIn = this.human >= 0 && !!inp;
    if (!this.foDropped) {
      if (humanIn && pressed && t > 0.25) {
        this.foEarly = true;
        this.setBanner('TOO EARLY!', 'WAIT FOR THE DROP', '#9d0208', 0.9);
      }
      if (t >= this.foDrop) {
        this.foDropped = true;
        this.emit('shot', this.foDot.x, this.foDot.y);
      }
      return;
    }
    const rt = t - this.foDrop;
    let winner: Side | -1 = -1;
    if (humanIn) {
      const h = this.human as Side;
      if (this.foEarly) winner = (1 - h) as Side;
      else if (pressed) winner = rt < this.foAi ? h : ((1 - h) as Side);
      else if (rt >= this.foAi) winner = (1 - h) as Side;
    } else if (rt > 0.15) {
      const a = this.skaters[0][0].p.fo;
      const b = this.skaters[1][0].p.fo;
      winner = rng.next() < a / (a + b) ? 0 : 1;
    }
    if (winner < 0) return;
    const w = winner as Side;
    this.foWon[w]++;
    const ds = this.onIce(w).filter((k) => k.isD);
    const target = ds.length ? ds[rng.int(0, ds.length - 1)] : this.onIce(w)[0];
    const pk = this.puck;
    const dx = target.x - pk.x;
    const dy = target.y - pk.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = clamp(d * 2.2, 90, 170);
    pk.vx = (dx / d) * sp;
    pk.vy = (dy / d) * sp;
    pk.lastSide = w;
    pk.passTarget = target;
    for (const s of [0, 1] as Side[]) this.skaters[s][0].pickupCD = 0.3;
    if (this.human === w) this.ctrl = target;
    this.state = this.state === 'faceoff' ? 'play' : this.state;
    this.stateT = 0;
    this.emit('shot', pk.x, pk.y);
  }

  // ---------- play ----------
  private updatePlay(dt: number, inp: PadInput | null) {
    this.time += dt;
    const so = this.state === 'soAttempt';
    if (!so) {
      this.clock -= dt;
      if (this.refPos) {
        this.refT += dt;
        this.refPos.y -= 60 * dt;
        if (this.refT > 1.5) this.refPos = null;
      }
      this.tickPenalties(dt);
      this.stamina(dt);
    }
    // control + AI
    if (this.human >= 0 && inp) this.humanControl(dt, inp);
    for (const k of this.all()) if (k !== this.ctrl || this.human < 0) aiThink(this, k, dt);
    for (const g of this.goalies) if (g.active) goalieThink(this, g, dt, so && this.human === g.side ? inp : null);
    // physics
    for (const k of this.all()) this.moveSkater(k, dt);
    this.collide();
    this.updatePuck(dt);
    if (this.state !== 'play' && this.state !== 'soAttempt') return;
    if (!so) {
      this.rules();
      this.record();
      if (this.clock <= 0 && this.state === 'play') {
        this.clock = 0;
        this.endPeriod();
      }
    } else this.soCheck(dt);
  }

  private tickPenalties(dt: number) {
    for (const s of [0, 1] as Side[])
      for (const k of this.skaters[s]) {
        if (k.penalty > 0) {
          k.penalty -= dt;
          if (k.penalty <= 0) {
            k.penalty = 0;
            k.x = CX + (s ? 20 : -20);
            k.y = 4;
            k.vx = 0;
            k.vy = 40;
          }
        }
      }
  }

  private stamina(dt: number) {
    for (const s of [0, 1] as Side[]) {
      const r = this.rosters[s];
      const onIce = new Set(this.skaters[s].map((k) => k.p));
      for (const p of [...r.forwards, ...r.defense]) if (!onIce.has(p)) p.stamina = Math.min(100, p.stamina + 9 * dt);
      for (const k of this.skaters[s]) {
        if (!k.onIce) continue;
        const sp = Math.hypot(k.vx, k.vy);
        let drain = 0.9;
        if (k.intent.sprint && sp > 60) drain += 10;
        if (sp < 25) drain -= 3;
        k.p.stamina = clamp(k.p.stamina - drain * dt, 0, 100);
      }
    }
  }

  private humanControl(dt: number, inp: PadInput) {
    const h = this.human as Side;
    let c = this.ctrl;
    if (!c || !c.onIce || c.side !== h) {
      c = this.closestTo(h, this.puck.x, this.puck.y);
      this.ctrl = c;
    }
    if (!c) return;
    const pk = this.puck;
    const oppHas = (pk.owner && pk.owner.side !== h) || (pk.gOwner && pk.gOwner.side !== h);
    if (oppHas && Math.hypot(c.x - pk.x, c.y - pk.y) > 150) {
      const n = this.closestTo(h, pk.x, pk.y);
      if (n) c = this.ctrl = n;
    }
    // auto-switch on defense, with hysteresis so control never flickers
    this.switchT -= dt;
    const teamHas = (pk.owner && pk.owner.side === h) || (pk.gOwner && pk.gOwner.side === h);
    if (this.cfg.autoSwitch && !teamHas && pk.passTarget !== c && this.switchT <= 0) {
      const n = this.closestTo(h, pk.x, pk.y);
      if (n && n !== c) {
        const dc = Math.hypot(c.x - pk.x, c.y - pk.y);
        const dn = Math.hypot(n.x - pk.x, n.y - pk.y);
        if (dn < dc * 0.75 && dc - dn > 20) {
          c = this.ctrl = n;
          this.switchT = 0.35;
        }
      }
    }
    c.intent.mx = inp.move.x;
    c.intent.my = inp.move.y;
    c.intent.sprint = inp.sprint;
    if (c.down > 0) return;
    const has = pk.owner === c;
    if (has) {
      if (inp.a.pressed && c.charge < 0) {
        const t = this.choosePassTarget(c, inp.move.x, inp.move.y);
        if (t) this.doPass(c, t);
        return;
      }
      if (inp.b.pressed) c.charge = 0;
      if (c.charge >= 0 && inp.b.down) c.charge = Math.min(this.chargeFull + 0.3, c.charge + dt);
      if (inp.b.released && c.charge >= 0) {
        const full = this.chargeFull;
        const power = c.charge < 0.18 ? 0 : clamp((c.charge - 0.18) / (full - 0.18), 0.25, 1);
        const aim = Math.abs(inp.move.y) > 0.3 ? CY + Math.sign(inp.move.y) * (GOAL_HW - 3) : null;
        this.doShoot(c, power, aim, false);
        return;
      }
      if (inp.c.pressed) this.doDeke(c);
    } else {
      c.charge = -1;
      const incoming = !pk.owner && pk.passTarget === c;
      if (incoming && inp.b.pressed) {
        c.oneTimer = 0.6;
      } else if (inp.a.pressed) {
        const n = this.closestTo(h, pk.x, pk.y, c);
        if (n) this.ctrl = n;
      } else if (inp.b.pressed) {
        this.doCheck(c);
      }
      if (inp.c.pressed) this.doPoke(c);
    }
  }

  /** Seconds of wind-up for a full-power slap shot. */
  get chargeFull() {
    return this.cfg.assist ? 0.5 : 0.9;
  }

  /** True when assists apply to this skater (the human's team). */
  assisted(k: { side: Side }) {
    return !!this.cfg.assist && this.human >= 0 && k.side === this.human;
  }

  closestTo(s: Side, x: number, y: number, exclude: Skater | null = null) {
    let best: Skater | null = null;
    let bd = Infinity;
    for (const k of this.onIce(s)) {
      if (k === exclude || k.down > 0) continue;
      const d = Math.hypot(k.x - x, k.y - y);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    if (!best && exclude && exclude.onIce) return exclude;
    return best;
  }

  choosePassTarget(c: Skater, dx: number, dy: number) {
    let l = Math.hypot(dx, dy);
    if (l < 0.2) {
      dx = Math.cos(c.face);
      dy = Math.sin(c.face);
      l = 1;
    }
    dx /= l;
    dy /= l;
    let best: Skater | null = null;
    let bs = -Infinity;
    const opp = this.onIce((1 - c.side) as Side);
    for (const t of this.onIce(c.side)) {
      if (t === c) continue;
      const vx = t.x - c.x;
      const vy = t.y - c.y;
      const d = Math.hypot(vx, vy) || 1;
      const cos = (vx * dx + vy * dy) / d;
      let lane = Infinity;
      for (const o of opp) lane = Math.min(lane, distToSeg(o.x, o.y, c.x, c.y, t.x, t.y));
      const score = cos * 2 - d / 300 - (lane < 8 ? 0.6 : 0) - (t.down > 0 ? 2 : 0);
      if (score > bs) {
        bs = score;
        best = t;
      }
    }
    return best;
  }

  private release(c: Skater) {
    const pk = this.puck;
    pk.owner = null;
    c.pickupCD = 0.3;
    pk.lastSide = c.side;
    pk.ice = { side: c.side, ax: this.ax(c.side, pk.x) };
  }

  doPass(c: Skater, t: Skater) {
    const pk = this.puck;
    const d0 = Math.hypot(t.x - c.x, t.y - c.y);
    const speed = clamp(170 + d0 * 1.3, 200, 340) * (0.9 + c.p.pas / 1000);
    const lead = (d0 / speed) * 0.85;
    const tx = t.x + t.vx * lead;
    const ty = t.y + t.vy * lead;
    const err = this.assisted(c) ? 0 : (100 - c.p.pas) * 0.0016;
    const ang = Math.atan2(ty - pk.y, tx - pk.x) + rng.gauss() * err;
    this.release(c);
    pk.vx = Math.cos(ang) * speed;
    pk.vy = Math.sin(ang) * speed;
    pk.vz = d0 > 160 ? 45 : 0;
    pk.passTarget = t;
    pk.shot = null;
    if (this.human === c.side) this.ctrl = t;
    this.emit('shot', pk.x, pk.y);
    events.pass = true;
  }

  /** Generic shot/clear toward a point. */
  shootAt(c: Skater, tx: number, ty: number, speed: number, vz = 20) {
    const pk = this.puck;
    const ang = Math.atan2(ty - pk.y, tx - pk.x);
    this.release(c);
    pk.vx = Math.cos(ang) * speed;
    pk.vy = Math.sin(ang) * speed;
    pk.vz = vz;
    pk.passTarget = null;
    pk.shot = null;
    events.pass = true;
  }

  doShoot(c: Skater, power: number, aimY: number | null, oneTimer: boolean) {
    const pk = this.puck;
    const side = c.side;
    const gx = this.oppGoalX(side);
    const g = this.goalies[1 - side];
    const assist = this.assisted(c);
    if (aimY === null) aimY = this.openCorner(side);
    let speed = power > 0 ? 400 + power * 150 + c.p.sht * 0.6 : 330 + c.p.sht * 0.9;
    if (oneTimer) speed += 40;
    let sd = (100 - c.p.sht) * 0.0022 + power * 0.025 + (c.p.stamina < 30 ? 0.03 : 0) + (oneTimer ? 0.02 : 0);
    if (assist) sd *= 0.4;
    const ang = Math.atan2(aimY - pk.y, gx - pk.x) + rng.gauss() * sd * 0.6;
    const breakaway = this.onIce((1 - side) as Side).every((o) => this.ax(side, o.x) < this.ax(side, c.x) - 4) && this.ax(side, c.x) > CX;
    this.release(c);
    pk.vx = Math.cos(ang) * speed;
    pk.vy = Math.sin(ang) * speed;
    // pick a target height (low / mid / top shelf) and launch to reach it at the goal line
    const r = rng.next();
    const zAim = r < 0.42 ? 1 + rng.next() * 3 : r < 0.78 ? 4 + rng.next() * 5 : GOAL_H - 5 + rng.next() * 6.5;
    const tFly = Math.max(0.05, Math.abs(gx - pk.x) / Math.max(1, Math.abs(pk.vx)));
    pk.vz = Math.max(0, (zAim + 0.5 * GRAV * tFly * tFly) / tFly + rng.gauss() * sd * (assist ? 25 : 60));
    pk.vz = Math.min(pk.vz, 260);
    pk.passTarget = null;
    // will it be on net?
    const t = Math.abs(gx - pk.x) / Math.max(1, Math.abs(pk.vx));
    const yAt = pk.y + pk.vy * t;
    const zAt = Math.max(0, pk.vz * t - 0.5 * GRAV * t * t);
    const onTarget = Math.abs(yAt - CY) < GOAL_HW - 0.5 && zAt < GOAL_H && Math.sign(pk.vx) === Math.sign(gx - pk.x);
    pk.shot = {
      side, shooter: c, sx: pk.x, sy: pk.y, speed, onTarget, oneTimer,
      rebound: this.time - this.lastSave < 1.3, deke: c.deke > 0 || c.dekeCD > 0.8, slap: power > 0, breakaway, t: this.time, resolved: false,
    };
    if (power > 0 && speed > 470) this.emit('mph', pk.x, pk.y, side, Math.round(speed * 0.18));
    c.follow = 0.25;
    c.charge = -1;
    c.oneTimer = 0;
    g.react = this.time + Math.max(0.02, 0.11 - (g.p.goa - 80) * 0.004 + this.goalieReactMod(g));
    this.emit('shot', pk.x, pk.y);
    events.shot = power > 0 ? 2 : 1;
  }

  /** Where an auto-aimed shot goes: the corner the goalie is leaving open. */
  openCorner(side: Side) {
    const g = this.goalies[1 - side];
    const open = g.y < CY ? 1 : -1;
    return CY + open * (GOAL_HW - 3 - rng.next() * 2);
  }

  private goalieReactMod(g: Goalie) {
    const d = this.cfg.difficulty;
    if (this.human < 0) return 0;
    return g.side === this.human ? [-0.03, 0, 0.01, 0.02][d] : [0.07, 0.02, 0, -0.02][d];
  }

  doDeke(c: Skater) {
    if (c.dekeCD > 0) return;
    c.deke = 0.4;
    c.dekeCD = 1.4;
    this.emit('deke', c.x, c.y);
  }

  doCheck(c: Skater) {
    if (c.checkCD > 0 || c.down > 0) return;
    c.lunge = 0.3;
    c.hitDone = false;
    c.checkCD = 0.9;
    c.vx += Math.cos(c.face) * 70;
    c.vy += Math.sin(c.face) * 70;
  }

  doPoke(c: Skater) {
    if (c.pokeCD > 0 || c.down > 0) return;
    c.pokeCD = 0.55;
    const pk = this.puck;
    const fx = Math.cos(c.face);
    const fy = Math.sin(c.face);
    const carrier = pk.owner;
    if (carrier && carrier.side !== c.side) {
      const dx = carrier.x - c.x;
      const dy = carrier.y - c.y;
      const d = Math.hypot(dx, dy);
      const facing = (dx * fx + dy * fy) / (d || 1);
      if (d < 19 && facing > 0.1) {
        let chance = carrier.deke > 0 ? 0 : 0.5 + (c.p.def - carrier.p.hnd) * 0.012;
        if (this.assisted(carrier)) chance *= 0.6;
        if (rng.next() < chance) {
          pk.owner = null;
          carrier.pickupCD = 0.45;
          const a = Math.atan2(fy, fx) + rng.gauss() * 0.8;
          pk.vx = Math.cos(a) * 90 + carrier.vx * 0.3;
          pk.vy = Math.sin(a) * 90 + carrier.vy * 0.3;
          pk.lastSide = c.side;
          pk.ice = null;
          this.emit('shot', pk.x, pk.y);
          return;
        }
        const fromBehind = Math.cos(carrier.face) * dx + Math.sin(carrier.face) * dy > d * 0.5;
        if (fromBehind && rng.next() < 0.06) this.callPenalty(c, 'HOOKING');
      }
      c.slow = 0.25;
    } else if (!carrier && !pk.gOwner) {
      const bx = c.x + fx * 10;
      const by = c.y + fy * 10;
      if (Math.hypot(pk.x - bx, pk.y - by) < 12 && pk.z < 6) {
        pk.vx = fx * 140 + pk.vx * 0.2;
        pk.vy = fy * 140 + pk.vy * 0.2;
        pk.lastSide = c.side;
        pk.ice = null;
        pk.passTarget = null;
        if (pk.shot) pk.shot.resolved = true;
      }
    }
  }

  private moveSkater(k: Skater, dt: number) {
    k.checkCD = Math.max(0, k.checkCD - dt);
    k.pokeCD = Math.max(0, k.pokeCD - dt);
    k.dekeCD = Math.max(0, k.dekeCD - dt);
    k.deke = Math.max(0, k.deke - dt);
    k.slow = Math.max(0, k.slow - dt);
    k.pickupCD = Math.max(0, k.pickupCD - dt);
    k.follow = Math.max(0, k.follow - dt);
    k.oneTimer = Math.max(0, k.oneTimer - dt);
    k.lunge = Math.max(0, k.lunge - dt);
    const it = k.intent;
    if (k.down > 0) {
      k.down -= dt;
      k.vx *= Math.pow(0.15, dt);
      k.vy *= Math.pow(0.15, dt);
      it.mx = it.my = 0;
    }
    const has = this.puck.owner === k;
    const st = k.p.stamina;
    let maxS = 72 + k.p.spd * 0.32;
    if (it.sprint && st > 8) maxS *= 1.28;
    if (st < 25) maxS *= 0.85;
    if (has) maxS *= 0.94;
    if (k.slow > 0) maxS *= 0.6;
    if (k.charge > 0.15) maxS *= 0.45;
    if (k.deke > 0) maxS *= 1.25;
    const mag = Math.hypot(it.mx, it.my);
    let acc = mag > 0.05 ? 230 + k.p.spd * 1.2 : 110;
    const sp = Math.hypot(k.vx, k.vy);
    if (mag > 0.05 && k.vx * it.mx + k.vy * it.my < 0) {
      acc *= 1.7;
      if (sp > 70 && rng.next() < 0.5) this.emit('spray', k.x, k.y);
    }
    if (k.down <= 0 && k.lunge <= 0) {
      const tvx = it.mx * maxS;
      const tvy = it.my * maxS;
      let dvx = tvx - k.vx;
      let dvy = tvy - k.vy;
      const dl = Math.hypot(dvx, dvy);
      const mx = acc * dt;
      if (dl > mx) {
        dvx = (dvx / dl) * mx;
        dvy = (dvy / dl) * mx;
      }
      k.vx += dvx;
      k.vy += dvy;
    }
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    const hit = constrainToRink(k, 5);
    if (hit.hit) {
      const vn = k.vx * hit.nx + k.vy * hit.ny;
      if (vn < 0) {
        k.vx -= vn * hit.nx * 1.2;
        k.vy -= vn * hit.ny * 1.2;
      }
    }
    // keep out of the nets
    for (const gl of [GOAL_LINE, RINK_L - GOAL_LINE]) {
      const rs = gl < CX ? 1 : -1;
      const backX = gl - rs * GOAL_DEPTH;
      const minX = Math.min(gl, backX) - 4;
      const maxX = Math.max(gl, backX) + 4;
      if (k.x > minX && k.x < maxX && Math.abs(k.y - CY) < GOAL_HW + 4) {
        const pushY = (GOAL_HW + 4 - Math.abs(k.y - CY)) * Math.sign(k.y - CY || 1);
        const pushX = rs > 0 ? (k.x > (minX + maxX) / 2 ? maxX - k.x : minX - k.x) : k.x < (minX + maxX) / 2 ? minX - k.x : maxX - k.x;
        if (Math.abs(pushX) < Math.abs(pushY)) {
          k.x += pushX;
          k.vx *= 0.3;
        } else {
          k.y += pushY;
          k.vy *= 0.3;
        }
      }
    }
    // facing
    const nsp = Math.hypot(k.vx, k.vy);
    let want = k.face;
    if (has || k.lunge > 0) {
      if (nsp > 15) want = Math.atan2(k.vy, k.vx);
      else if (mag > 0.1) want = Math.atan2(it.my, it.mx);
    } else if (mag > 0.1) want = Math.atan2(it.my, it.mx);
    else if (nsp > 15) want = Math.atan2(k.vy, k.vx);
    if (k.down <= 0) k.face = rotateTowards(k.face, want, 9 * dt);
    k.anim += nsp * dt;
  }

  private collide() {
    const list = this.all();
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= 9 || d === 0) continue;
        if (a.side !== b.side) {
          if (a.lunge > 0 && !a.hitDone) this.resolveCheck(a, b);
          else if (b.lunge > 0 && !b.hitDone) this.resolveCheck(b, a);
        }
        const nx = dx / d;
        const ny = dy / d;
        const push = (9 - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          a.vx += rv * nx * 0.5;
          a.vy += rv * ny * 0.5;
          b.vx -= rv * nx * 0.5;
          b.vy -= rv * ny * 0.5;
        }
      }
      for (const g of this.goalies) {
        if (!g.active) continue;
        const dx = a.x - g.x;
        const dy = a.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d < 10 && d > 0) {
          a.x = g.x + (dx / d) * 10;
          a.y = g.y + (dy / d) * 10;
        }
      }
    }
  }

  private resolveCheck(a: Skater, b: Skater) {
    a.hitDone = true;
    if (b.deke > 0 || b.down > 0) {
      a.slow = 0.3;
      return;
    }
    const power = (Math.hypot(a.vx, a.vy) / 120) * (a.p.chk / 80);
    const resist = (b.p.hnd * 0.4 + b.p.chk * 0.3 + 30) / 100;
    let chance = clamp(0.6 + (power - resist) * 0.8, 0.15, 0.95);
    if (this.assisted(b) && this.puck.owner === b) chance *= 0.6;
    if (rng.next() < chance) {
      b.down = 0.9 + rng.next() * 0.6;
      b.vx += a.vx * 0.6;
      b.vy += a.vy * 0.6;
      b.charge = -1;
      this.hits[a.side]++;
      this.emit('hit', b.x, b.y, a.side);
      const pk = this.puck;
      if (pk.owner === b) {
        pk.owner = null;
        pk.vx = b.vx * 0.9 + rng.gauss() * 40;
        pk.vy = b.vy * 0.9 + rng.gauss() * 40;
        pk.lastSide = b.side;
        b.pickupCD = 0.6;
      }
      if (this.time - b.lastPuck > 0.8 && rng.next() < 0.3) this.callPenalty(a, 'INTERFERENCE');
      else if (rng.next() < 0.015) this.callPenalty(a, 'ROUGHING');
    } else {
      a.slow = 0.35;
      a.vx *= 0.4;
      a.vy *= 0.4;
    }
  }

  private possess(k: Skater) {
    const pk = this.puck;
    pk.owner = k;
    pk.gOwner = null;
    pk.shot = null;
    pk.passTarget = null;
    pk.ice = null;
    pk.vx = pk.vy = pk.vz = 0;
    pk.z = 0;
    pk.lastSide = k.side;
    k.lastPuck = this.time;
    this.touch(k);
    if (this.human === k.side && this.state === 'play') this.ctrl = k;
    if (this.delayed && this.delayed.sk.side === k.side) this.whistle('PENALTY', this.penaltyDot(this.delayed.sk.side));
  }

  private touch(k: Skater) {
    if (this.touches[this.touches.length - 1] !== k) this.touches.push(k);
    if (this.touches.length > 6) this.touches.shift();
  }

  private updatePuck(dt: number) {
    const pk = this.puck;
    this.prevPx = pk.x;
    if (pk.owner) {
      const k = pk.owner;
      const wob = Math.sin(this.time * 14) * 1.2;
      const fx = Math.cos(k.face);
      const fy = Math.sin(k.face);
      pk.x = k.x + fx * 7 - fy * wob;
      pk.y = k.y + fy * 7 + fx * wob;
      pk.z = 0;
      constrainToRink(pk, 2);
      pk.vx = k.vx;
      pk.vy = k.vy;
      return;
    }
    if (pk.gOwner) {
      const g = pk.gOwner;
      pk.x = g.x + this.dir[g.side] * 4;
      pk.y = g.y + 2;
      pk.z = 0;
      pk.vx = pk.vy = 0;
      g.hold += dt;
      return;
    }
    const steps = 3;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const px = pk.x;
      const py = pk.y;
      pk.x += pk.vx * h;
      pk.y += pk.vy * h;
      if (pk.z > 0 || pk.vz > 0) {
        pk.vz -= GRAV * h;
        pk.z += pk.vz * h;
        if (pk.z <= 0) {
          pk.z = 0;
          pk.vz = -pk.vz * 0.3;
          if (pk.vz < 25) pk.vz = 0;
        }
      }
      for (const gl of [GOAL_LINE, RINK_L - GOAL_LINE]) {
        if (this.goalFrame >= 0 && this.state !== 'play' && this.state !== 'soAttempt') {
          this.netHold(gl);
          continue;
        }
        if (this.netPhysics(gl, px, py)) return;
      }
      if (this.state === 'play' || this.state === 'soAttempt') {
        for (const g of this.goalies) if (g.active && this.goalieCheck(g, px, py)) break;
      }
      const hit = constrainToRink(pk, 1.5);
      if (hit.hit) {
        const vn = pk.vx * hit.nx + pk.vy * hit.ny;
        if (vn < 0) {
          pk.vx -= 1.6 * vn * hit.nx;
          pk.vy -= 1.6 * vn * hit.ny;
          pk.vx *= 0.92;
          pk.vy *= 0.92;
          if (-vn > 70) {
            events.board = Math.max(events.board, Math.min(1, -vn / 300));
            this.emit('board', pk.x, pk.y);
          }
          if (pk.shot) pk.shot.resolved = true;
        }
      }
    }
    if (pk.z <= 0) {
      const f = 1 - PUCK_FRICTION * dt;
      pk.vx *= f;
      pk.vy *= f;
      if (pk.speed < 4) pk.vx = pk.vy = 0;
    }
    if (this.state === 'play' || this.state === 'soAttempt') this.pickups();
  }

  /** Returns true if a goal was scored. */
  private netPhysics(gl: number, px: number, py: number) {
    const pk = this.puck;
    const rs = gl < CX ? 1 : -1;
    // posts
    for (const sy of [-1, 1]) {
      const postY = CY + sy * GOAL_HW;
      const dx = pk.x - gl;
      const dy = pk.y - postY;
      const d = Math.hypot(dx, dy);
      if (d < 3 && pk.z < GOAL_H) {
        const nx = dx / (d || 1);
        const ny = dy / (d || 1);
        const vn = pk.vx * nx + pk.vy * ny;
        if (vn < 0) {
          pk.vx -= 1.8 * vn * nx;
          pk.vy -= 1.8 * vn * ny;
          pk.x = gl + nx * 3;
          pk.y = postY + ny * 3;
          if (-vn > 60) {
            this.emit('post', pk.x, pk.y);
            events.post = true;
          }
          this.lastPost = this.time;
          if (pk.shot) pk.shot.resolved = true;
        }
      }
    }
    const crossed = (px - gl) * rs > 0 && (pk.x - gl) * rs <= 0;
    if (crossed) {
      const t = (px - gl) / (px - pk.x || 1);
      const yC = py + (pk.y - py) * t;
      const inside = Math.abs(yC - CY) < GOAL_HW - 0.5;
      const clipsBar = inside && pk.z >= GOAL_H && pk.z < GOAL_H + 2;
      if (inside && (pk.z < GOAL_H || (clipsBar && rng.next() < BAR_DOWN_CHANCE))) {
        const scorer: Side = this.goalX(0) === gl ? 1 : 0;
        // most goals ring in off the crossbar: the signature "bar down" finish
        const barDown = pk.z >= GOAL_H - 2 || rng.next() < BAR_DOWN_CHANCE;
        this.pendingTag = barDown ? 'BAR DOWN' : this.time - this.lastPost < 0.25 ? 'POST AND IN' : '';
        if (barDown) {
          pk.z = GOAL_H - 1.5;
          pk.vz = -80;
          this.emit('crossbar', gl, CY, scorer, 1);
        }
        this.onGoal(scorer);
        return true;
      }
      if (clipsBar) {
        // off the crossbar and out ("bar out")
        pk.x = gl + rs * 1.5;
        pk.vx = -pk.vx * 0.45;
        pk.vz = Math.abs(pk.vz) * 0.4 + 30;
        this.emit('crossbar', gl, CY, undefined, 0);
        this.lastPost = this.time;
        if (pk.shot) pk.shot.resolved = true;
      }
    }
    // net body from sides/back
    const backX = gl - rs * GOAL_DEPTH;
    const minX = Math.min(gl, backX);
    const maxX = Math.max(gl, backX);
    if (!crossed && pk.z < GOAL_H && pk.x > minX && pk.x < maxX && Math.abs(pk.y - CY) < GOAL_HW + 1.5) {
      const dBack = Math.abs(pk.x - backX);
      const dSide = GOAL_HW + 1.5 - Math.abs(pk.y - CY);
      if (dBack < dSide) {
        pk.x = backX - rs * 1.5;
        pk.vx = -pk.vx * 0.4;
      } else {
        pk.y = CY + Math.sign(pk.y - CY || 1) * (GOAL_HW + 1.5);
        pk.vy = -pk.vy * 0.4;
      }
      pk.vx *= 0.7;
      pk.vy *= 0.7;
      if (pk.shot) pk.shot.resolved = true;
    }
    return false;
  }

  private netHold(gl: number) {
    const pk = this.puck;
    const rs = gl < CX ? 1 : -1;
    const backX = gl - rs * GOAL_DEPTH;
    if (Math.abs(pk.x - (gl + backX) / 2) < GOAL_DEPTH && Math.abs(pk.y - CY) < GOAL_HW + 2) {
      pk.x = clamp(pk.x, Math.min(gl, backX) + 1.5, Math.max(gl, backX) - 1.5);
      pk.y = clamp(pk.y, CY - GOAL_HW + 1.5, CY + GOAL_HW - 1.5);
      pk.vx *= 0.8;
      pk.vy *= 0.8;
      pk.z = Math.min(pk.z, GOAL_H - 2);
    }
  }

  private goalieCheck(g: Goalie, px: number, py: number) {
    const pk = this.puck;
    const rs = this.dir[g.side];
    const plane = g.x;
    const crossing = (px - plane) * rs > 0 && (pk.x - plane) * rs <= 0;
    if (crossing && pk.z < GOAL_H + 5) {
      const t = (px - plane) / (px - pk.x || 1);
      const yC = py + (pk.y - py) * t;
      const d = Math.abs(yC - g.y);
      const shot = pk.shot && !pk.shot.resolved && pk.shot.side !== g.side ? pk.shot : null;
      if (shot) {
        shot.resolved = true;
        if (shot.onTarget || d < 9) {
          const chance = shot.onTarget ? this.saveChance(g, shot, d) : 1;
          if (rng.next() < chance) {
            if (chance < 0.65) this.emit('robbed', g.x, g.y, g.side);
            this.save(g, yC, true);
            this.shots[shot.side]++;
            return true;
          }
          g.pose = pk.z > 7 ? 'glove' : 'butterfly';
          g.poseT = 0.5;
        }
      } else if (d < 8 && pk.lastSide !== g.side) {
        this.save(g, yC, false);
        return true;
      }
      return false;
    }
    // cover slow loose pucks nearby
    if (pk.speed < 120 && pk.z < 6 && Math.hypot(pk.x - g.x, pk.y - g.y) < 8 && g.hold <= 0) {
      const attackers = this.onIce((1 - g.side) as Side).some((k) => Math.hypot(k.x - pk.x, k.y - pk.y) < 9);
      if (!attackers || rng.next() < 0.03) {
        this.goalieTake(g);
        return true;
      }
    }
    return false;
  }

  saveChance(g: Goalie, shot: Shot, d: number) {
    let base = 0.915 + (g.p.goa - 80) * 0.007;
    const diff = this.cfg.difficulty;
    if (this.human >= 0) {
      if (shot.side === this.human) base += [-0.1, -0.03, 0.02, 0.05][diff];
      else base += [0.08, 0.03, 0, -0.02][diff];
    }
    const gx = this.goalX(g.side);
    const dist = Math.hypot(shot.sx - gx, shot.sy - CY);
    let q = 0;
    if (dist < 70) q += 0.14 * (1 - dist / 70);
    q += (shot.speed - 420) * 0.0004;
    if (shot.oneTimer) q += 0.1;
    if (shot.rebound) q += 0.12;
    if (shot.deke) q += 0.06;
    q += Math.max(0, d - 5) * 0.03;
    return clamp(base - q, 0.25, 0.96);
  }

  private save(g: Goalie, yC: number, isShot: boolean) {
    const pk = this.puck;
    const sp = pk.speed;
    const high = pk.z > 7;
    g.pose = high ? 'glove' : sp > 350 ? 'butterfly' : 'blocker';
    g.poseT = 0.45;
    let catchP = sp < 300 ? 0.4 : 0.22 + (g.p.goa - 75) * 0.01;
    if (high) catchP += 0.25;
    if (!isShot) catchP = sp < 200 ? 0.85 : 0.5;
    pk.shot = null;
    pk.ice = null;
    pk.passTarget = null;
    this.touches = [];
    this.emit('save', g.x, g.y, g.side);
    events.save = true;
    if (rng.next() < catchP) {
      this.goalieTake(g);
      return;
    }
    const rs = this.dir[g.side];
    pk.x = g.x + rs * 3;
    pk.y = yC;
    pk.vx = rs * (Math.abs(pk.vx) * (0.15 + rng.next() * 0.2) + 30);
    pk.vy = rng.gauss() * 110;
    pk.vz = rng.next() * 40;
    pk.lastSide = g.side;
    this.lastSave = this.time;
  }

  private goalieTake(g: Goalie) {
    const pk = this.puck;
    pk.gOwner = g;
    pk.owner = null;
    pk.vx = pk.vy = pk.vz = 0;
    pk.z = 0;
    pk.shot = null;
    pk.ice = null;
    pk.passTarget = null;
    pk.lastSide = g.side;
    g.hold = 0.001;
    if (this.delayed && this.delayed.sk.side === g.side) this.whistle('PENALTY', this.penaltyDot(g.side));
  }

  goaliePlay(g: Goalie) {
    const pk = this.puck;
    if (this.state === 'soAttempt') return;
    const opp = this.onIce((1 - g.side) as Side);
    const near = opp.some((k) => Math.hypot(k.x - g.x, k.y - g.y) < 32);
    const mates = this.onIce(g.side).filter((k) => k.down <= 0);
    if (!near && mates.length) {
      let best = mates[0];
      let bd = Infinity;
      for (const m of mates) {
        const d = Math.hypot(m.x - g.x, m.y - g.y);
        let lane = Infinity;
        for (const o of opp) lane = Math.min(lane, distToSeg(o.x, o.y, g.x, g.y, m.x, m.y));
        const score = d - (lane > 12 ? 200 : 0);
        if (score < bd) {
          bd = score;
          best = m;
        }
      }
      const dx = best.x - pk.x;
      const dy = best.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = clamp(170 + d * 1.1, 200, 320);
      pk.gOwner = null;
      g.hold = 0;
      pk.vx = (dx / d) * sp;
      pk.vy = (dy / d) * sp;
      pk.passTarget = best;
      pk.lastSide = g.side;
      if (this.human === g.side) this.ctrl = best;
      events.pass = true;
    } else {
      this.whistle('FROZEN', endDot(this.goalX(g.side) < CX, pk.y < CY));
    }
  }

  private pickups() {
    const pk = this.puck;
    if (pk.owner || pk.gOwner || pk.z > 10) return;
    let best: Skater | null = null;
    let bd = Infinity;
    for (const k of this.all()) {
      if (k.down > 0 || k.pickupCD > 0) continue;
      const bx = k.x + Math.cos(k.face) * 6;
      const by = k.y + Math.sin(k.face) * 6;
      const d = Math.min(Math.hypot(pk.x - bx, pk.y - by), Math.hypot(pk.x - k.x, pk.y - k.y) + 1);
      const r = 6 + k.p.hnd * 0.03 + (pk.passTarget === k ? 4 : 0);
      if (d < r && d < bd) {
        bd = d;
        best = k;
      }
    }
    if (!best) return;
    const k = best;
    const sp = pk.speed;
    const catchSp = 300 + k.p.hnd * 1.6 + (pk.passTarget === k ? 80 : 0);
    if (k.oneTimer > 0 && pk.passTarget === k && this.state === 'play') {
      this.possess(k);
      this.doShoot(k, 0.6, null, true);
      return;
    }
    if (sp > catchSp) {
      const a = Math.atan2(pk.vy, pk.vx) + rng.gauss() * 0.8;
      const ns = sp * 0.45;
      pk.vx = Math.cos(a) * ns;
      pk.vy = Math.sin(a) * ns;
      k.pickupCD = 0.12;
      pk.lastSide = k.side;
      pk.ice = null;
      pk.passTarget = null;
      if (pk.shot) pk.shot.resolved = true;
      this.touch(k);
      return;
    }
    this.possess(k);
    events.stick = true;
  }

  // ---------- rules ----------
  private rules() {
    const pk = this.puck;
    for (const s of [0, 1] as Side[]) {
      const prevA = this.ax(s, this.prevPx);
      const curA = this.ax(s, pk.x);
      const blue = RINK_L - BLUE_LINE;
      if (this.cfg.offside && prevA < blue && curA >= blue) {
        const controlling = pk.owner ? pk.owner.side === s : pk.lastSide === s;
        if (controlling) {
          const off = this.onIce(s).find((k) => k !== pk.owner && this.ax(s, k.x) > blue + 3);
          if (off) {
            this.whistle('OFFSIDE', neutralDot(this.wx(s, RINK_L - (BLUE_LINE + 15)) < CX, pk.y < CY));
            return;
          }
        }
      }
    }
    if (this.cfg.icing && pk.ice && !pk.owner && !pk.gOwner) {
      const s = pk.ice.side;
      if (this.ax(s, pk.x) > RINK_L - GOAL_LINE + 1 && pk.ice.ax < CX && !this.shorthanded(s)) {
        this.whistle('ICING', endDot(this.goalX(s) < CX, pk.y < CY));
      }
    }
  }

  private penaltyDot(offSide: Side) {
    return endDot(this.goalX(offSide) < CX, this.puck.y < CY);
  }

  callPenalty(off: Skater, name: string) {
    if (!this.cfg.penalties || this.state !== 'play' || off.penalty > 0 || this.cfg.kind === 'attract') return;
    if (this.delayed) return;
    if (this.skaters[off.side].filter((k) => k.penalty > 0).length >= 2) return;
    const victim = (1 - off.side) as Side;
    const pk = this.puck;
    const victimHas = (pk.owner && pk.owner.side === victim) || (!pk.owner && !pk.gOwner && pk.lastSide === victim);
    this.delayed = { sk: off, name };
    if (victimHas) {
      this.setBanner('DELAYED PENALTY', `${this.teams[off.side].abbr} - ${name}`, '#e85d04', 1.6);
    } else {
      this.whistle('PENALTY', this.penaltyDot(off.side));
    }
  }

  private assessDelayed() {
    const d = this.delayed;
    if (!d) return;
    this.delayed = null;
    const k = d.sk;
    k.penalty = this.penaltyLen;
    k.charge = -1;
    const victim = (1 - k.side) as Side;
    this.ppOpp[victim]++;
    if (this.ctrl === k) this.ctrl = null;
    this.pendingDot = this.penaltyDot(k.side);
    this.setBanner('POWER PLAY', `${this.teams[victim].abbr} - ${this.penaltyLen} SECONDS`, this.teams[victim].primary, 1.6);
  }

  whistle(reason: string, dot: Dot) {
    if (this.state !== 'play') return;
    this.state = 'stoppage';
    this.stateT = 0;
    this.pendingDot = this.delayed ? this.penaltyDot(this.delayed.sk.side) : dot;
    const pk = this.puck;
    pk.passTarget = null;
    pk.shot = null;
    for (const k of this.all()) k.charge = -1;
    events.whistle = true;
    if (this.delayed) {
      const k = this.delayed.sk;
      this.setBanner(this.delayed.name, `${this.teams[k.side].abbr} #${k.p.number} ${k.p.name}`, '#e85d04', 1.5);
    } else this.setBanner(reason, '', reason === 'FROZEN' ? '#2a6f97' : '#6a040f', 1.3);
  }

  private glide(dt: number) {
    for (const k of this.all()) {
      k.intent.mx = k.intent.my = 0;
      k.intent.sprint = false;
      this.moveSkater(k, dt);
    }
    this.collide();
    this.updatePuck(dt);
  }

  private onGoal(side: Side) {
    if (this.state === 'soAttempt') {
      this.soEnd(true);
      return;
    }
    this.score[side]++;
    this.shots[side]++;
    const pp = this.shorthanded((1 - side) as Side);
    // scorer + assists: most recent touches by the scoring side
    let scorer: Skater | null = null;
    const assists: PlayerInfo[] = [];
    for (let i = this.touches.length - 1; i >= 0; i--) {
      const k = this.touches[i];
      if (k.side !== side) {
        if (scorer) break;
        continue;
      }
      if (!scorer) scorer = k;
      else if (k !== scorer && !assists.includes(k.p) && assists.length < 2) assists.push(k.p);
    }
    const tag = this.goalTag(side, pp);
    this.goals.push({ period: this.period, clock: Math.max(0, this.clock), side, scorer: scorer?.p || null, assists, pp, tag });
    let hatTrick = false;
    if (scorer) {
      const n = (this.goalCount.get(scorer.p) || 0) + 1;
      this.goalCount.set(scorer.p, n);
      hatTrick = n === 3;
    }
    if (scorer) scorer.celebrate = true;
    if (pp) {
      this.ppGoals[side]++;
      const boxed = this.skaters[1 - side].filter((k) => k.penalty > 0).sort((a, b) => a.penalty - b.penalty);
      if (boxed.length) boxed[0].penalty = 0.01;
    }
    if (this.delayed && this.delayed.sk.side !== side) this.delayed = null;
    this.state = 'goal';
    this.stateT = 0;
    this.goalFrame = this.recCount;
    const t = this.teams[side];
    const who = scorer ? `#${scorer.p.number} ${scorer.p.name}` : t.name.toUpperCase();
    const head = hatTrick ? 'HAT TRICK!' : tag.startsWith('BAR DOWN') ? 'BAR DOWN!' : 'GOAL!';
    this.setBanner(head, tag ? `${tag} - ${who}` : who, t.primary, 2.6, true);
    this.emit('goal', this.puck.x, this.puck.y, side);
    if (hatTrick) this.emit('hattrick', this.puck.x, this.puck.y, side);
    events.goal = true;
    for (const k of this.all()) k.charge = -1;
  }

  /** Describes how a goal was scored, e.g. BAR DOWN, TOP SHELF, SHORTY. */
  private goalTag(side: Side, pp: boolean) {
    const tags: string[] = [];
    if (this.pendingTag) tags.push(this.pendingTag);
    this.pendingTag = '';
    const pk = this.puck;
    const sh = pk.shot && pk.shot.side === side ? pk.shot : null;
    if (sh && !tags.length) {
      const g = this.goalies[1 - side];
      if (pk.z >= 8) tags.push('TOP SHELF');
      else if (pk.z < 3 && Math.abs(pk.y - g.y) < 4) tags.push('FIVE HOLE');
      else if (sh.oneTimer) tags.push('ONE-TIMER');
      else if (sh.rebound) tags.push('REBOUND');
      else if (sh.breakaway) tags.push('BREAKAWAY');
      else if (sh.slap) tags.push('SLAPSHOT');
    }
    if (this.shorthanded(side)) tags.push('SHORTY');
    else if (pp) tags.push('PP GOAL');
    return tags.slice(0, 2).join(' + ');
  }

  private celebrate(dt: number) {
    const side = this.goals.length ? this.goals[this.goals.length - 1].side : 0;
    const scorer = this.all().find((k) => k.celebrate);
    for (const k of this.all()) {
      if (k.side === side && scorer && k !== scorer) {
        const dx = scorer.x - k.x;
        const dy = scorer.y - k.y;
        const d = Math.hypot(dx, dy);
        k.intent.mx = d > 14 ? dx / d : 0;
        k.intent.my = d > 14 ? dy / d : 0;
      } else if (k === scorer) {
        k.intent.mx = Math.sign(CX - k.x) * 0.4;
        k.intent.my = 0;
      } else {
        k.intent.mx = k.intent.my = 0;
      }
      k.intent.sprint = false;
      this.moveSkater(k, dt);
    }
    this.collide();
    this.updatePuck(dt);
  }

  private afterGoal() {
    this.replay = [];
    this.goalFrame = -1;
    for (const k of this.all()) k.celebrate = false;
    if (this.period > 3) {
      this.endType = 'OT';
      this.state = 'periodEnd';
      this.stateT = 0;
      this.finalPending = true;
      events.buzzer = true;
      return;
    }
    this.beginFaceoff(CENTER_DOT);
  }

  // ---------- periods ----------
  private endPeriod() {
    events.buzzer = true;
    this.state = 'periodEnd';
    this.stateT = 0;
    const tied = this.score[0] === this.score[1];
    const kind = this.cfg.kind;
    this.finalPending = false;
    this.shootoutPending = false;
    if (this.period >= 3 && !tied) this.finalPending = true;
    else if (this.period >= 3 && tied) {
      if (kind === 'playoff') {
        /* another full sudden-death OT period */
      } else if (this.period >= 4) this.shootoutPending = true;
    }
    const label = this.period <= 3 ? ['1ST', '2ND', '3RD'][this.period - 1] : 'OT';
    this.setBanner(`END OF ${label}`, `${this.teams[0].abbr} ${this.score[0]} - ${this.score[1]} ${this.teams[1].abbr}`, '#14213d', 1.8, true);
  }

  /** Called by the scene when the player taps continue on the intermission panel. */
  continueGame() {
    if (this.state !== 'intermission') return;
    if (this.finalPending) {
      this.state = 'final';
      if (this.period > 3 && this.endType === 'REG') this.endType = 'OT';
      return;
    }
    if (this.shootoutPending) {
      this.startShootout();
      return;
    }
    this.period++;
    const home = this.period % 2 === 1 ? 1 : -1;
    this.dir = [home, -home];
    const ot = this.period > 3;
    const threeOnThree = ot && this.cfg.kind !== 'playoff';
    this.clock = ot ? (threeOnThree ? Math.max(60, Math.round(this.cfg.periodSec * 0.35)) : this.cfg.periodSec) : this.cfg.periodSec;
    for (const s of [0, 1] as Side[]) for (const k of this.skaters[s]) k.benched = threeOnThree && (k.role === 'LW' || k.role === 'RD');
    for (const r of this.rosters) for (const p of [...r.forwards, ...r.defense]) p.stamina = Math.min(100, p.stamina + 50);
    const name = ot ? (threeOnThree ? 'OVERTIME 3-ON-3' : `OVERTIME ${this.period - 3}`) : `PERIOD ${this.period}`;
    this.setBanner(name, ot ? 'NEXT GOAL WINS' : '', '#1d3557', 1.8, true);
    this.state = 'intro';
    this.stateT = 0;
    this.placeForFaceoff(CENTER_DOT);
  }

  // ---------- shootout ----------
  private startShootout() {
    this.so = { round: 1, next: 1, att: [0, 0], goals: [0, 0], marks: [[], []], shooterIdx: [0, 0], shotTaken: false, settle: 0, winner: -1 };
    this.state = 'soIntro';
    this.stateT = 0;
    this.endType = 'SO';
    for (const s of [0, 1] as Side[]) for (const k of this.skaters[s]) k.benched = true;
    this.setBanner('SHOOTOUT', 'BEST OF 3', '#3c096c', 1.6, true);
  }

  private soSetup() {
    const so = this.so!;
    const s = so.next;
    const d = (1 - s) as Side;
    this.dir[s] = 1;
    this.dir[d] = -1;
    const shooters = [...this.rosters[s].forwards].sort((a, b) => b.sht - a.sht);
    const shooter = this.skaters[s][0];
    shooter.p = shooters[so.shooterIdx[s] % shooters.length];
    so.shooterIdx[s]++;
    for (const side of [0, 1] as Side[]) for (const k of this.skaters[side]) k.benched = k !== shooter;
    shooter.x = CX - 20;
    shooter.y = CY;
    shooter.vx = shooter.vy = 0;
    shooter.face = 0;
    shooter.down = 0;
    shooter.deke = 0;
    shooter.think = 0;
    shooter.aimOffset = rng.range(-30, 30);
    shooter.wait = rng.range(440, 510);
    this.goalies[s].active = false;
    const g = this.goalies[d];
    g.active = true;
    g.x = this.goalX(d) + this.dir[d] * 6;
    g.y = CY;
    g.hold = 0;
    g.pose = 'stance';
    const pk = this.puck;
    pk.owner = null;
    pk.gOwner = null;
    pk.shot = null;
    pk.x = shooter.x + 7;
    pk.y = shooter.y;
    pk.vx = pk.vy = pk.vz = pk.z = 0;
    this.possess(shooter);
    so.shotTaken = false;
    so.settle = 0;
    this.ctrl = this.human === s ? shooter : null;
    this.state = 'soAttempt';
    this.stateT = 0;
    this.setBanner(`${this.teams[s].abbr} #${shooter.p.number}`, shooter.p.name, this.teams[s].primary, 1.2);
  }

  private soCheck(dt: number) {
    const so = this.so!;
    const pk = this.puck;
    const s = so.next;
    if (!pk.owner) so.shotTaken = true;
    if (this.stateT > 9) {
      this.soEnd(false);
      return;
    }
    if (!so.shotTaken) return;
    const behind = this.ax(s, pk.x) > RINK_L - GOAL_LINE + 2;
    const done = pk.gOwner || pk.speed < 25 || behind || (pk.vx < 0 && !pk.shot) || (pk.owner && pk.owner.side !== s);
    if (done) {
      so.settle += dt;
      if (so.settle > 0.35) this.soEnd(false);
    }
  }

  private soEnd(goal: boolean) {
    const so = this.so!;
    const s = so.next;
    so.att[s]++;
    so.marks[s].push(goal);
    if (goal) {
      so.goals[s]++;
      events.goal = true;
      this.emit('goal', this.puck.x, this.puck.y, s);
      this.setBanner('GOAL!', '', this.teams[s].primary, 1.6, true);
      this.goalFrame = this.recCount;
    } else {
      events.save = true;
      this.setBanner('NO GOAL', '', '#333', 1.4, true);
    }
    const [g0, g1] = so.goals;
    const [a0, a1] = so.att;
    if (a0 <= 3 && a1 <= 3) {
      if (g0 > g1 + (3 - a1)) so.winner = 0;
      else if (g1 > g0 + (3 - a0)) so.winner = 1;
    }
    if (so.winner < 0 && a0 === a1 && a0 >= 3 && g0 !== g1) so.winner = g0 > g1 ? 0 : 1;
    this.state = 'soResult';
    this.stateT = 0;
  }

  private soNext() {
    const so = this.so!;
    this.goalFrame = -1;
    if (so.winner >= 0) {
      if (this.cfg.kind !== 'shootout') this.score[so.winner as Side]++;
      this.state = 'final';
      this.stateT = 0;
      events.buzzer = true;
      return;
    }
    so.next = (1 - so.next) as Side;
    if (so.att[0] === so.att[1]) so.round++;
    this.soSetup();
  }

  // ---------- replay ----------
  snapshot(): Snap {
    const pk = this.puck;
    const sk: SkSnap[] = this.all().map((k) => ({
      side: k.side, x: k.x, y: k.y, face: k.face, speed: Math.hypot(k.vx, k.vy), anim: k.anim, down: k.down > 0,
      celebrate: k.celebrate, charge: k.charge, follow: k.follow, number: k.p.number, ctrl: k === this.ctrl,
      hasPuck: pk.owner === k, deke: k.deke,
    }));
    const go: GoSnap[] = this.goalies.filter((g) => g.active).map((g) => ({
      side: g.side, x: g.x, y: g.y, pose: g.pose, rs: this.dir[g.side], hold: pk.gOwner === g,
    }));
    return { sk, go, px: pk.x, py: pk.y, pz: pk.z, pvx: pk.vx, pvy: pk.vy, ref: this.refPos ? { ...this.refPos } : null };
  }

  private record() {
    if (this.cfg.kind === 'attract') return;
    const s = this.snapshot();
    for (const k of s.sk) k.ctrl = false;
    this.rec.push(s);
    this.recCount++;
    if (this.rec.length > 300) this.rec.shift();
  }

  private buildReplay() {
    if (this.goalFrame < 0) {
      this.replay = [];
      return;
    }
    const startAbs = this.recCount - this.rec.length;
    const from = Math.max(0, this.goalFrame - 170 - startAbs);
    const to = Math.min(this.rec.length, this.goalFrame + 45 - startAbs);
    this.replay = this.rec.slice(from, to);
    if (this.replay.length < 30) this.replay = [];
  }

  // ---------- results ----------
  winner(): Side {
    return this.score[0] > this.score[1] ? 0 : 1;
  }

  get pp(): { side: Side; time: number } | null {
    const b0 = this.skaters[0].filter((k) => k.penalty > 0);
    const b1 = this.skaters[1].filter((k) => k.penalty > 0);
    if (b0.length === b1.length) return null;
    const boxed = b0.length > b1.length ? b0 : b1;
    const side: Side = b0.length > b1.length ? 1 : 0;
    return { side, time: Math.min(...boxed.map((k) => k.penalty)) };
  }

  get delayedPenalty() {
    return this.delayed;
  }
}

/** Sound cues raised during a tick; the scene plays and clears them. */
export const events = {
  pass: false,
  shot: 0,
  stick: false,
  board: 0,
  post: false,
  save: false,
  goal: false,
  whistle: false,
  buzzer: false,
  reset() {
    this.pass = false;
    this.shot = 0;
    this.stick = false;
    this.board = 0;
    this.post = false;
    this.save = false;
    this.goal = false;
    this.whistle = false;
    this.buzzer = false;
  },
};
