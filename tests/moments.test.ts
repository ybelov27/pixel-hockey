import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/data/teams';
import { Match } from '../src/game/match';
import { CY, GOAL_H, GOAL_LINE } from '../src/game/rink';
import { DEFAULT_SETTINGS, migrateSettings } from '../src/core/storage';
import { rng } from '../src/core/rng';

function shotAtLeftNet(z: number) {
  const m = new Match({
    home: TEAMS[0], away: TEAMS[1], human: -1, periodSec: 120, difficulty: 1,
    offside: false, icing: false, penalties: false, kind: 'exhibition',
  });
  m.state = 'play';
  m.goalies[0].active = false; // home defends the left net in period 1
  const pk = m.puck;
  pk.x = GOAL_LINE + 4;
  pk.y = CY;
  pk.z = z;
  pk.vx = -420;
  pk.vy = 0;
  pk.vz = 0;
  pk.lastSide = 1;
  for (let i = 0; i < 3; i++) m.update(1 / 60, null);
  return m;
}

describe('crossbar moments', () => {
  it('scores a BAR DOWN goal off the underside of the crossbar', () => {
    const m = shotAtLeftNet(GOAL_H - 1);
    expect(m.score[1]).toBe(1);
    expect(m.goals[0].tag).toContain('BAR DOWN');
  });

  it('rings it off the crossbar and out when the puck is just high and the roll misses', () => {
    const orig = rng.next.bind(rng);
    rng.next = () => 0.99;
    try {
      const m = shotAtLeftNet(GOAL_H + 1);
      expect(m.score[1]).toBe(0);
      expect(m.puck.vx).toBeGreaterThan(0);
    } finally {
      rng.next = orig;
    }
  });

  it('scores an ordinary low goal without the bar-down tag when the roll misses', () => {
    const orig = rng.next.bind(rng);
    rng.next = () => 0.99;
    try {
      const m = shotAtLeftNet(2);
      expect(m.score[1]).toBe(1);
      expect(m.goals[0].tag).not.toContain('BAR DOWN');
    } finally {
      rng.next = orig;
    }
  });

  it('turns about 80% of goals into bar downs', () => {
    let bar = 0;
    const n = 200;
    for (let i = 0; i < n; i++) if (shotAtLeftNet(2).goals[0]?.tag.includes('BAR DOWN')) bar++;
    expect(bar / n).toBeGreaterThan(0.7);
    expect(bar / n).toBeLessThan(0.9);
  });
});

describe('settings migration', () => {
  it('new players get arcade defaults with Easy Controls', () => {
    const s = migrateSettings(null);
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.offside).toBe(false);
    expect(s.assist).toBe(true);
    expect(s.difficulty).toBe(0);
  });

  it('existing players keep their rules but get the new assists once', () => {
    const s = migrateSettings({ offside: true, icing: true, difficulty: 2 });
    expect(s.offside).toBe(true);
    expect(s.difficulty).toBe(2);
    expect(s.assist).toBe(true);
    expect(s.v).toBe(DEFAULT_SETTINGS.v);
    expect(migrateSettings({ ...s, assist: false }).assist).toBe(false);
  });
});
