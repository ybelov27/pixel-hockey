import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/data/teams';
import { MAX_PENALTIES, Match, type PadInput } from '../src/game/match';

const btn = () => ({ pressed: false, down: false, released: false });

function game() {
  const m = new Match({
    home: TEAMS[2], away: TEAMS[7], human: 0, periodSec: 180, difficulty: 1,
    icing: false, penalties: true, kind: 'exhibition', assist: true, autoSwitch: true,
  });
  m.state = 'play';
  return m;
}

describe('penalties and fights', () => {
  it('a penalty leads to a fight you control, then play resumes', () => {
    const m = game();
    m.callPenalty(m.skaters[1][1], 'ROUGHING');
    expect(m.state).toBe('stoppage');
    for (let i = 0; i < 120; i++) m.update(1 / 60, null);
    expect(m.state).toBe('fight');
    expect(m.fight!.f[0].human).toBe(true);
    expect(m.fight!.f[1].human).toBe(false);
    const inp: PadInput = { move: { x: 0, y: 0 }, sprint: false, a: btn(), b: btn(), c: btn() };
    let landed = false;
    for (let i = 0; i < 60 * 20 && m.state === 'fight'; i++) {
      inp.b = i % 20 === 0 ? { pressed: true, down: true, released: false } : btn();
      m.update(1 / 60, inp);
      if (m.events.some((e) => e.t === 'punch' && e.side === 0)) landed = true;
      m.events.length = 0;
    }
    expect(landed).toBe(true);
    expect(m.state).toBe('faceoff');
    expect(m.fight).toBeNull();
    expect(m.fights).toBe(1);
    expect(m.skaters[1][1].penalty).toBeGreaterThan(0);
  });

  it(`allows at most ${MAX_PENALTIES} penalties (and fights) per game`, () => {
    const m = game();
    for (let n = 0; n < 4; n++) {
      m.state = 'play';
      m.callPenalty(m.skaters[1][n % 5 === 0 ? 1 : n + 1], 'HOOKING');
      for (let i = 0; i < 60 * 25; i++) {
        const st: string = m.state;
        if (i > 0 && (st === 'faceoff' || st === 'play')) break;
        m.update(1 / 60, null);
        m.events.length = 0;
      }
    }
    expect(m.ppOpp[0]).toBe(MAX_PENALTIES);
    expect(m.fights).toBe(MAX_PENALTIES);
  });

  it('CPU-only games have no fights', () => {
    const m = new Match({
      home: TEAMS[2], away: TEAMS[7], human: -1, periodSec: 180, difficulty: 1, icing: false, penalties: true, kind: 'exhibition',
    });
    m.state = 'play';
    m.callPenalty(m.skaters[1][1], 'ROUGHING');
    for (let i = 0; i < 200; i++) m.update(1 / 60, null);
    expect(m.fights).toBe(0);
  });
});
