import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/data/teams';
import { Match, type PadInput } from '../src/game/match';
import { CY } from '../src/game/rink';

const btn = () => ({ pressed: false, down: false, released: false });

function practice() {
  return new Match({
    home: TEAMS[0], away: TEAMS[5], human: 0, periodSec: 180, difficulty: 0,
    offside: false, icing: false, penalties: false, kind: 'practice', assist: true, autoSwitch: true,
  });
}

describe('practice mode', () => {
  it('has only you, a passer and a goalie, with no clock', () => {
    const m = practice();
    expect(m.all()).toHaveLength(2);
    expect(m.puck.owner).toBe(m.ctrl);
    const clock = m.clock;
    for (let i = 0; i < 600; i++) m.update(1 / 60, null);
    expect(m.clock).toBe(clock);
  });

  it('lets you skate in and score, then hands you a fresh puck', () => {
    const m = practice();
    const inp: PadInput = { move: { x: 0, y: 0 }, sprint: false, a: btn(), b: btn(), c: btn() };
    let shootFrames = 0;
    for (let i = 0; i < 60 * 90 && m.score[0] < 3; i++) {
      inp.b = btn();
      const c = m.ctrl!;
      if (m.puck.owner === c) {
        const dx = 500 - c.x;
        const dy = CY - c.y;
        const d = Math.hypot(dx, dy) || 1;
        inp.move = { x: dx / d, y: dy / d };
        if (c.x > 450) {
          inp.b = { pressed: shootFrames === 0, down: false, released: true };
          shootFrames++;
        }
      } else {
        shootFrames = 0;
        inp.move = { x: 0, y: 0 };
      }
      m.update(1 / 60, inp);
      m.events.length = 0;
    }
    expect(m.shots[0]).toBeGreaterThan(0);
    expect(m.score[0]).toBeGreaterThan(0);
  });

  it('returns your pass so you can one-time it', () => {
    const m = practice();
    const me = m.ctrl!;
    const inp: PadInput = { move: { x: 0, y: 0 }, sprint: false, a: btn(), b: btn(), c: btn() };
    inp.a = { pressed: true, down: true, released: false };
    m.update(1 / 60, inp);
    inp.a = btn();
    expect(m.puck.owner).toBeNull();
    let back = false;
    for (let i = 0; i < 60 * 4; i++) {
      m.update(1 / 60, inp);
      if (m.puck.passTarget === me || m.puck.owner === me) back = true;
    }
    expect(back).toBe(true);
    expect(m.ctrl).toBe(me);
  });
});
