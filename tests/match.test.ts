import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/data/teams';
import { Match } from '../src/game/match';

function playOut(m: Match, maxSec = 3000) {
  const dt = 1 / 60;
  for (let i = 0; i < maxSec * 60 && m.state !== 'final'; i++) {
    if (m.state === 'intermission') m.continueGame();
    if (m.state === 'replay') m.skip = true;
    m.update(dt, null);
    m.events.length = 0;
  }
}

describe('match simulation (CPU vs CPU)', () => {
  it('plays complete games with goals, shots and a winner', () => {
    let goals = 0;
    let shots = 0;
    for (let g = 0; g < 4; g++) {
      const m = new Match({
        home: TEAMS[g], away: TEAMS[31 - g], human: -1, periodSec: 120, difficulty: 1,
        icing: true, penalties: true, kind: 'exhibition',
      });
      playOut(m);
      expect(m.state).toBe('final');
      expect(m.score[0]).not.toBe(m.score[1]);
      goals += m.score[0] + m.score[1];
      shots += m.shots[0] + m.shots[1];
      for (const s of [...m.skaters[0], ...m.skaters[1]]) {
        expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
      }
    }
    expect(goals).toBeGreaterThan(0);
    expect(shots).toBeGreaterThan(goals);
  });

  it('decides a shootout', () => {
    const m = new Match({
      home: TEAMS[3], away: TEAMS[5], human: -1, periodSec: 120, difficulty: 1,
      icing: true, penalties: false, kind: 'shootout',
    });
    playOut(m, 400);
    expect(m.state).toBe('final');
    expect(m.so!.winner).toBeGreaterThanOrEqual(0);
  });
});
