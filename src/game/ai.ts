import { clamp, distToSeg } from '../core/math';
import { rng } from '../core/rng';
import type { Goalie, Match, PadInput, Side, Skater } from './match';
import { BLUE_LINE, CY, GOAL_HW, RINK_L, RINK_W, constrainToRink } from './rink';

// Per difficulty: decision delay, aggressiveness, randomness.
const REACT = [0.42, 0.3, 0.2, 0.13];
const AGGR = [0.9, 1.3, 1.7, 2.2];
const NOISE = [0.35, 0.22, 0.12, 0.06];
const ZONE = RINK_L - BLUE_LINE; // attacking blue line in the attack frame (375)

/** Teammates of the human play at Pro level; the CPU uses the chosen difficulty. */
function level(m: Match, s: Skater) {
  if (m.human < 0) return 2;
  return s.side === m.human ? 1 : m.cfg.difficulty;
}

function steer(s: Skater) {
  const p = { x: s.tx, y: s.ty };
  constrainToRink(p, 8);
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  const d = Math.hypot(dx, dy);
  const it = s.intent;
  if (d < 3) {
    it.mx = it.my = 0;
  } else {
    const f = Math.min(1, d / 18);
    it.mx = (dx / d) * f;
    it.my = (dy / d) * f;
  }
  it.sprint = d > 70 && s.p.stamina > 35;
}

export function aiThink(m: Match, s: Skater, dt: number) {
  const it = s.intent;
  if (s.down > 0) {
    it.mx = it.my = 0;
    it.sprint = false;
    return;
  }
  if (m.state === 'soAttempt') {
    shootoutAI(m, s);
    return;
  }
  if (m.practice) {
    practiceAI(m, s, dt);
    return;
  }
  const pk = m.puck;
  if (pk.owner === s) {
    carrier(m, s, dt);
    return;
  }
  s.charge = -1;
  const teamHas = (pk.owner && pk.owner.side === s.side) || (pk.gOwner && pk.gOwner.side === s.side);
  const oppHas = (pk.owner && pk.owner.side !== s.side) || (pk.gOwner && pk.gOwner.side !== s.side);
  if (!pk.owner && !pk.gOwner && pk.passTarget === s) receive(m, s);
  else if (teamHas) support(m, s);
  else if (oppHas) defend(m, s, dt);
  else loose(m, s);
  steer(s);
}

function receive(m: Match, s: Skater) {
  const pk = m.puck;
  const d = Math.hypot(pk.x - s.x, pk.y - s.y);
  const t = Math.min(0.5, d / (pk.speed + 1));
  s.tx = pk.x + pk.vx * t;
  s.ty = pk.y + pk.vy * t;
  const a = m.ax(s.side, s.x);
  if (!m.practice && a > 470 && Math.abs(s.y - CY) < 45 && s.oneTimer <= 0 && rng.next() < 0.02 + level(m, s) * 0.006) s.oneTimer = 0.5;
}

function support(m: Match, s: Skater) {
  const side = s.side;
  const pk = m.puck;
  if (pk.gOwner) {
    // breakout: D wide low, forwards stretch
    const a = s.isD ? 70 : s.role === 'C' ? 170 : 230;
    const y = s.role === 'LD' ? CY - 75 : s.role === 'RD' ? CY + 75 : s.role === 'LW' ? RINK_W * 0.18 : s.role === 'RW' ? RINK_W * 0.82 : CY;
    s.tx = m.wx(side, a);
    s.ty = y;
    return;
  }
  const pa = m.ax(side, pk.x);
  const py = pk.y;
  const inZone = pa > ZONE;
  let a = pa;
  let y = CY;
  switch (s.role) {
    case 'C':
      a = inZone ? 470 : pa - 35;
      y = CY + (py < CY ? 32 : -32);
      break;
    case 'LW':
      a = inZone ? 520 : pa + 30;
      y = inZone ? CY - 34 : RINK_W * 0.2;
      break;
    case 'RW':
      a = inZone ? 535 : pa + 30;
      y = inZone ? CY + 28 : RINK_W * 0.8;
      break;
    case 'LD':
      a = inZone ? 395 : pa - 80;
      y = inZone ? RINK_W * 0.22 : RINK_W * 0.33;
      break;
    case 'RD':
      a = inZone ? 395 : pa - 80;
      y = inZone ? RINK_W * 0.78 : RINK_W * 0.67;
      break;
  }
  a = clamp(a, 45, 560);
  s.tx = m.wx(side, a);
  s.ty = y;
  const c = pk.owner;
  if (c && Math.hypot(s.tx - c.x, s.ty - c.y) < 26) s.ty += s.ty < c.y ? -26 : 26;
}

function zone(m: Match, s: Skater) {
  const side = s.side;
  const pk = m.puck;
  const pa = m.ax(side, pk.x);
  const inD = pa < BLUE_LINE;
  let a = pa;
  let y = CY;
  switch (s.role) {
    case 'C':
      a = inD ? 90 : pa - 25;
      y = CY;
      break;
    case 'LW':
      a = inD ? 150 : pa - 15;
      y = RINK_W * 0.25;
      break;
    case 'RW':
      a = inD ? 150 : pa - 15;
      y = RINK_W * 0.75;
      break;
    case 'LD':
      a = inD ? 58 : Math.max(60, pa - 70);
      y = inD ? CY - 24 : RINK_W * 0.36;
      break;
    case 'RD':
      a = inD ? 58 : Math.max(60, pa - 70);
      y = inD ? CY + 24 : RINK_W * 0.64;
      break;
  }
  y += (pk.y - CY) * 0.25;
  s.tx = m.wx(side, clamp(a, 45, 560));
  s.ty = y;
}

function defend(m: Match, s: Skater, dt: number) {
  const pk = m.puck;
  const c = pk.owner;
  if (!c) {
    zone(m, s);
    return;
  }
  const side = s.side;
  const mates = m.onIce(side).filter((k) => k !== m.ctrl && k.down <= 0);
  mates.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
  const rank = mates.indexOf(s);
  const ctrl = m.ctrl;
  const humanPressing = !!ctrl && ctrl.side === side && Math.hypot(ctrl.x - c.x, ctrl.y - c.y) < 40;
  const gx = m.goalX(side);
  // how deep the carrier is in our end (0 = our goal line side, 600 = far end)
  const depth = m.ax(side, c.x);
  const inOurZone = depth < BLUE_LINE + 30;
  const windingUp = c.charge > 0.1;
  if (rank === 0 && !humanPressing) {
    // gap up: stay between the carrier and our net, and close fast
    const dx = gx - c.x;
    const dy = CY - c.y;
    const d = Math.hypot(dx, dy) || 1;
    s.tx = c.x + (dx / d) * 10 + c.vx * 0.25;
    s.ty = c.y + (dy / d) * 10 + c.vy * 0.25;
    const dist = Math.hypot(s.x - c.x, s.y - c.y);
    const aggr = AGGR[level(m, s)] * (windingUp ? 2.5 : 1);
    steer(s);
    s.intent.sprint = s.p.stamina > 15;
    if (dist < 22) {
      s.face = Math.atan2(c.y - s.y, c.x - s.x);
      if (rng.next() < aggr * dt * 2.2) m.doPoke(s);
      else if (dist < 18 && Math.hypot(s.vx, s.vy) > 35 && rng.next() < aggr * dt * 0.8) m.doCheck(s);
    }
    return;
  } else if ((rank === 1 && inOurZone) || (rank === 0 && humanPressing)) {
    // second man collapses into the shooting lane
    s.tx = c.x + (gx - c.x) * 0.35;
    s.ty = c.y + (CY - c.y) * 0.35;
    const dist = Math.hypot(s.x - c.x, s.y - c.y);
    if (windingUp && dist < 22 && rng.next() < AGGR[level(m, s)] * dt * 2) {
      s.face = Math.atan2(c.y - s.y, c.x - s.x);
      m.doPoke(s);
    }
  } else if (rank <= 2) {
    // cover the slot in front of our goalie
    s.tx = gx + (c.x - gx) * 0.3;
    s.ty = CY + (c.y - CY) * 0.3;
  } else zone(m, s);
}

function loose(m: Match, s: Skater) {
  const pk = m.puck;
  const side = s.side;
  const mates = m.onIce(side).filter((k) => k !== m.ctrl && k.down <= 0);
  mates.sort((a, b) => Math.hypot(a.x - pk.x, a.y - pk.y) - Math.hypot(b.x - pk.x, b.y - pk.y));
  const rank = mates.indexOf(s);
  const ctrlChasing = !!m.ctrl && m.ctrl.side === side;
  const d = Math.hypot(s.x - pk.x, s.y - pk.y);
  if (rank === 0 || (rank === 1 && !ctrlChasing && d < 70)) {
    s.tx = pk.x + pk.vx * 0.25;
    s.ty = pk.y + pk.vy * 0.25;
  } else if (pk.lastSide === side) support(m, s);
  else zone(m, s);
}

function carrier(m: Match, s: Skater, dt: number) {
  const side = s.side;
  const lvl = level(m, s);
  const gx = m.oppGoalX(side);
  const a = m.ax(side, s.x);
  const opp = m.onIce((1 - side) as Side);
  let pressure = Infinity;
  let nearest: Skater | null = null;
  for (const o of opp) {
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < pressure) {
      pressure = d;
      nearest = o;
    }
  }
  s.think -= dt;
  if (s.think > 0) {
    carryTarget(m, s, a, opp);
    steer(s);
    return;
  }
  s.think = REACT[lvl] + rng.next() * 0.1;
  const noise = NOISE[lvl];
  const dG = Math.hypot(gx - s.x, CY - s.y);
  const yOff = Math.abs(s.y - CY);

  let shoot = -1;
  if (a > 390 && a < 562 && yOff < 25 + (562 - a) * 0.6) {
    shoot = 1.25 - dG / 170;
    for (const o of opp) if (distToSeg(o.x, o.y, s.x, s.y, gx, CY) < 7) shoot -= 0.35;
    if (pressure < 14) shoot += 0.15;
  }

  let best: Skater | null = null;
  let bestSc = -Infinity;
  for (const t of m.onIce(side)) {
    if (t === s || t.down > 0) continue;
    const ta = m.ax(side, t.x);
    let lane = Infinity;
    for (const o of opp) lane = Math.min(lane, distToSeg(o.x, o.y, s.x, s.y, t.x, t.y));
    if (lane < 9) continue;
    const d = Math.hypot(t.x - s.x, t.y - s.y);
    if (d < 30) continue;
    const tdG = Math.hypot(gx - t.x, CY - t.y);
    const sc = 0.2 + (ta - a) / 260 + (tdG < 95 && ta > 420 ? 0.45 : 0) + Math.min(lane, 40) / 120 - (d > 230 ? 0.5 : 0);
    if (sc > bestSc) {
      bestSc = sc;
      best = t;
    }
  }
  const pass = best ? bestSc + (pressure < 16 ? 0.3 : 0) : -1;
  const carry = 0.55 - (pressure < 14 ? 0.35 : 0) - (a > 540 ? 0.3 : 0);
  const clear = a < 190 && pressure < 22 ? 0.75 : -1;
  let blockedAhead = 0;
  for (const o of opp) if (m.ax(side, o.x) > a && m.ax(side, o.x) - a < 40 && Math.abs(o.y - s.y) < 30) blockedAhead++;
  const dump = a > 305 && a < ZONE - 5 && blockedAhead >= 2 ? 0.6 : -1;

  const opts: [string, number][] = [
    ['shoot', shoot + rng.next() * noise],
    ['pass', pass + rng.next() * noise],
    ['carry', carry + rng.next() * noise],
    ['clear', clear + rng.next() * noise],
    ['dump', dump + rng.next() * noise],
  ];
  opts.sort((x, y) => y[1] - x[1]);
  switch (opts[0][0]) {
    case 'shoot': {
      const slap = a < 470 && pressure > 30 && rng.next() < 0.5;
      m.doShoot(s, slap ? 0.5 + rng.next() * 0.4 : 0, null, false);
      return;
    }
    case 'pass':
      if (best) {
        m.doPass(s, best);
        return;
      }
      break;
    case 'clear':
      m.shootAt(s, m.wx(side, 330 + rng.next() * 40), s.y < CY ? 12 : RINK_W - 12, 250, 30);
      return;
    case 'dump':
      m.shootAt(s, m.wx(side, 560), s.y < CY ? 30 : RINK_W - 30, 270, 20);
      return;
  }
  if (nearest && s.dekeCD <= 0) {
    const fx = Math.cos(s.face);
    const fy = Math.sin(s.face);
    const dx = nearest.x - s.x;
    const dy = nearest.y - s.y;
    if (pressure < 17 && (dx * fx + dy * fy) / pressure > 0.3 && rng.next() < 0.3 + lvl * 0.1) m.doDeke(s);
  }
  carryTarget(m, s, a, opp);
  steer(s);
}

function carryTarget(m: Match, s: Skater, a: number, opp: Skater[]) {
  const side = s.side;
  let ta: number;
  let ty: number;
  if (a < ZONE) {
    ta = Math.min(a + 90, 460);
    ty = s.y < CY ? CY - 45 : CY + 45;
  } else if (a > 530) {
    ta = 480;
    ty = CY + (s.y < CY ? -10 : 10);
  } else {
    ta = 515;
    ty = CY + (s.y < CY ? -18 : 18);
  }
  const tx = m.wx(side, ta);
  for (const o of opp) {
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < 40 && m.ax(side, o.x) > a - 5) ty += (s.y >= o.y ? 1 : -1) * (40 - d) * 1.2;
  }
  s.tx = tx;
  s.ty = clamp(ty, 15, RINK_W - 15);
}

/** Practice teammate: gets open in the slot and returns every pass for one-timers. */
function practiceAI(m: Match, s: Skater, dt: number) {
  const pk = m.puck;
  const me = m.ctrl;
  if (pk.owner === s) {
    s.wait += dt;
    s.tx = s.x;
    s.ty = s.y;
    if (me && (s.wait > 0.45 || m.passCall > 0)) {
      m.doPass(s, me);
      m.passCall = 0;
      s.wait = 0;
    }
  } else {
    s.wait = 0;
    if (!pk.owner && !pk.gOwner && pk.passTarget === s) receive(m, s);
    else {
      const side = me && me.y < CY ? 1 : -1;
      s.tx = m.wx(0, 505);
      s.ty = CY + side * 45;
      if (!pk.owner && !pk.gOwner && pk.speed < 140 && Math.hypot(pk.x - s.x, pk.y - s.y) < 50) {
        s.tx = pk.x;
        s.ty = pk.y;
      }
    }
  }
  steer(s);
}

function shootoutAI(m: Match, s: Skater) {
  const pk = m.puck;
  if (pk.owner !== s) {
    s.intent.mx = s.intent.my = 0;
    return;
  }
  const a = m.ax(s.side, s.x);
  s.tx = m.wx(s.side, Math.min(a + 60, 540));
  s.ty = CY + s.aimOffset * clamp((s.wait - a) / 200, 0, 1);
  if (a > s.wait - 45 && s.dekeCD <= 0 && rng.next() < 0.03) m.doDeke(s);
  if (a > s.wait) m.doShoot(s, 0, null, false);
  steer(s);
}

export function goalieThink(m: Match, g: Goalie, dt: number, inp: PadInput | null) {
  g.poseT -= dt;
  if (g.poseT <= 0) g.pose = 'stance';
  const pk = m.puck;
  const gl = m.goalX(g.side);
  const rs = m.dir[g.side];
  if (pk.gOwner === g) {
    g.vx = g.vy = 0;
    if (g.hold > 0.7) m.goaliePlay(g);
    return;
  }
  let tx: number;
  let ty: number;
  const shot = pk.shot && !pk.shot.resolved && pk.shot.side !== g.side ? pk.shot : null;
  if (shot && m.time >= g.react && pk.vx * rs < 0) {
    const t = (g.x - pk.x) / (pk.vx || 1);
    ty = pk.y + pk.vy * Math.max(0, t);
    tx = gl + rs * 6;
  } else if (shot) {
    tx = g.x;
    ty = g.y;
  } else {
    const px = pk.x;
    const py = pk.y;
    if ((px - gl) * rs < 0) {
      tx = gl + rs * 4;
      ty = CY + Math.sign(py - CY || 1) * (GOAL_HW - 2);
    } else {
      const dx = px - gl;
      const dy = py - CY;
      const d = Math.hypot(dx, dy) || 1;
      const depth = clamp(d * 0.07, 4, 12);
      tx = gl + (dx / d) * depth + rs * 2;
      ty = CY + (dy / d) * depth * 1.8;
    }
  }
  if (inp) ty = CY + inp.move.y * (GOAL_HW + 3);
  ty = clamp(ty, CY - GOAL_HW - 3, CY + GOAL_HW + 3);
  tx = gl + rs * Math.max(3, (tx - gl) * rs);
  const max = 80 + g.p.goa * 0.7;
  g.vx = clamp((tx - g.x) * 10, -max, max);
  g.vy = clamp((ty - g.y) * 12, -max, max);
  g.x += g.vx * dt;
  g.y += g.vy * dt;
}

