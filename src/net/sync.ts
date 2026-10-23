import type { PlayerInfo } from '../data/roster';
import { events, type GoalLog, type Match, type MatchEvent, type MatchState, type Side } from '../game/match';
import type { GPose } from '../render/sprites';

/**
 * Host -> guest state packets. The host runs the real match; the guest keeps
 * a mirror Match whose fields are overwritten from these packets, so the
 * normal renderer and HUD work unchanged.
 */

const POSES: GPose[] = ['stance', 'butterfly', 'glove', 'blocker'];
const r1 = (v: number) => Math.round(v * 10) / 10;

export type SoundFlags = Omit<typeof events, 'reset'>;

export interface StatePacket {
  t: 's';
  st: MatchState;
  stT: number;
  per: number;
  clk: number;
  dir: [number, number];
  sc: [number, number];
  sh: [number, number];
  hit: [number, number];
  fo: [number, number];
  ppg: [number, number];
  ppo: [number, number];
  end: Match['endType'];
  ban: Match['banner'];
  ref: { x: number; y: number } | null;
  so: Match['so'];
  del: boolean;
  fi: Match['fight'];
  sk: number[][];
  go: number[][];
  pk: number[];
  ng: number;
  goals?: unknown[];
  ev: MatchEvent[];
  snd: SoundFlags;
}

function allSkaters(m: Match) {
  return [...m.skaters[0], ...m.skaters[1]];
}

export function emptySounds(): SoundFlags {
  return { pass: false, shot: 0, stick: false, board: 0, post: false, save: false, goal: false, whistle: false, buzzer: false };
}

export function mergeSounds(into: SoundFlags) {
  into.pass ||= events.pass;
  into.shot = Math.max(into.shot, events.shot);
  into.stick ||= events.stick;
  into.board = Math.max(into.board, events.board);
  into.post ||= events.post;
  into.save ||= events.save;
  into.goal ||= events.goal;
  into.whistle ||= events.whistle;
  into.buzzer ||= events.buzzer;
}

export function encodeState(m: Match, ev: MatchEvent[], snd: SoundFlags, sentGoals: number): StatePacket {
  const sks = allSkaters(m);
  const pk = m.puck;
  const idx = (k: unknown) => (k ? sks.indexOf(k as never) : -1);
  const p: StatePacket = {
    t: 's',
    st: m.state,
    stT: r1(m.stateT),
    per: m.period,
    clk: r1(m.clock),
    dir: m.dir,
    sc: m.score,
    sh: m.shots,
    hit: m.hits,
    fo: m.foWon,
    ppg: m.ppGoals,
    ppo: m.ppOpp,
    end: m.endType,
    ban: m.banner ? { ...m.banner, t: r1(m.banner.t) } : null,
    ref: m.refPos ? { x: r1(m.refPos.x), y: r1(m.refPos.y) } : null,
    so: m.so,
    del: !!m.delayedPenalty,
    fi: m.fight,
    sk: sks.map((k) => [
      r1(k.x), r1(k.y), Math.round(k.face * 100) / 100, r1(k.vx), r1(k.vy), r1(k.anim),
      (k.down > 0 ? 1 : 0) | (k.celebrate ? 2 : 0) | (k.benched ? 4 : 0) | (m.isCtrl(k) ? 8 : 0),
      Math.round(k.charge * 100) / 100, r1(k.follow), r1(k.deke), r1(k.penalty), k.p.number, Math.round(k.p.stamina),
    ]),
    go: m.goalies.map((g) => [r1(g.x), r1(g.y), POSES.indexOf(g.pose), g.active ? 1 : 0, r1(g.hold)]),
    pk: [r1(pk.x), r1(pk.y), r1(pk.z), r1(pk.vx), r1(pk.vy), idx(pk.owner), pk.gOwner ? pk.gOwner.side : -1, idx(pk.passTarget)],
    ng: m.goals.length,
    ev,
    snd,
  };
  if (m.goals.length !== sentGoals) {
    p.goals = m.goals.map((g) => ({
      period: g.period, clock: g.clock, side: g.side, tag: g.tag, pp: g.pp,
      scorer: g.scorer ? g.scorer.number : null, assists: g.assists.map((a) => a.number),
    }));
  }
  return p;
}

function findPlayer(m: Match, side: Side, num: number): PlayerInfo | null {
  const r = m.rosters[side];
  return [...r.forwards, ...r.defense, ...r.goalies].find((p) => p.number === num) || null;
}

/** Overwrite the mirror match with a host packet. blend < 1 eases positions for smoothness. */
export function applyState(m: Match, p: StatePacket, blend = 1) {
  const ease = (cur: number, target: number) => (Math.abs(target - cur) > 40 ? target : cur + (target - cur) * blend);
  m.state = p.st;
  m.stateT = p.stT;
  m.period = p.per;
  m.clock = p.clk;
  m.dir = p.dir;
  m.score = p.sc;
  m.shots = p.sh;
  m.hits = p.hit;
  m.foWon = p.fo;
  m.ppGoals = p.ppg;
  m.ppOpp = p.ppo;
  m.endType = p.end;
  m.banner = p.ban;
  m.refPos = p.ref;
  m.so = p.so;
  m.setMirrorDelayed(p.del);
  m.fight = p.fi;
  const sks = allSkaters(m);
  m.ctrl = null;
  m.ctrl2 = null;
  p.sk.forEach((a, i) => {
    const k = sks[i];
    if (!k) return;
    k.x = ease(k.x, a[0]);
    k.y = ease(k.y, a[1]);
    k.face = a[2];
    k.vx = a[3];
    k.vy = a[4];
    k.anim = a[5];
    k.down = a[6] & 1 ? 1 : 0;
    k.celebrate = !!(a[6] & 2);
    k.benched = !!(a[6] & 4);
    if (a[6] & 8) {
      if (k.side === 0) m.ctrl = k;
      else m.ctrl2 = k;
    }
    k.charge = a[7];
    k.follow = a[8];
    k.deke = a[9];
    k.penalty = a[10];
    if (k.p.number !== a[11]) k.p = findPlayer(m, k.side, a[11]) || k.p;
    k.p.stamina = a[12];
  });
  p.go.forEach((a, i) => {
    const g = m.goalies[i];
    g.x = ease(g.x, a[0]);
    g.y = ease(g.y, a[1]);
    g.pose = POSES[a[2]] || 'stance';
    g.active = a[3] === 1;
    g.hold = a[4];
  });
  const pk = m.puck;
  pk.x = ease(pk.x, p.pk[0]);
  pk.y = ease(pk.y, p.pk[1]);
  pk.z = p.pk[2];
  pk.vx = p.pk[3];
  pk.vy = p.pk[4];
  pk.owner = p.pk[5] >= 0 ? sks[p.pk[5]] : null;
  pk.gOwner = p.pk[6] >= 0 ? m.goalies[p.pk[6]] : null;
  pk.passTarget = p.pk[7] >= 0 ? sks[p.pk[7]] : null;
  if (p.goals) {
    m.goals = (p.goals as { period: number; clock: number; side: Side; tag: string; pp: boolean; scorer: number | null; assists: number[] }[]).map(
      (g): GoalLog => ({
        period: g.period, clock: g.clock, side: g.side, tag: g.tag, pp: g.pp,
        scorer: g.scorer === null ? null : findPlayer(m, g.side, g.scorer),
        assists: g.assists.map((n) => findPlayer(m, g.side, n)).filter((x): x is PlayerInfo => !!x),
      }),
    );
  }
}

/** Guest -> host controls. Edges are "happened since the last packet". */
export interface InputPacket {
  t: 'i';
  mx: number;
  my: number;
  sp: boolean;
  b: [boolean, boolean, boolean][]; // a, b, c: [down, pressed, released]
}

export class RemotePad {
  move = { x: 0, y: 0 };
  sprint = false;
  a = { down: false, pressed: false, released: false };
  b = { down: false, pressed: false, released: false };
  c = { down: false, pressed: false, released: false };
  private pend = [
    [false, false],
    [false, false],
    [false, false],
  ];
  private down = [false, false, false];

  receive(p: InputPacket) {
    this.move = { x: p.mx, y: p.my };
    this.sprint = p.sp;
    p.b.forEach(([d, pr, rl], i) => {
      this.down[i] = d;
      if (pr) this.pend[i][0] = true;
      if (rl) this.pend[i][1] = true;
    });
  }

  /** Called once per host tick: exposes edges for exactly one tick. */
  tick() {
    [this.a, this.b, this.c].forEach((btn, i) => {
      btn.pressed = this.pend[i][0];
      btn.released = this.pend[i][1];
      btn.down = this.down[i] || btn.pressed;
      this.pend[i] = [false, false];
    });
  }
}
