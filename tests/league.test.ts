import { describe, expect, it } from 'vitest';
import { advance, applyResult, createSeason, playoffSeeds, type Game, type Rec } from '../src/game/league';

const rec = (): Rec => ({ gp: 0, w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0 });

describe('league', () => {
  it('awards NHL points: 2 win, 1 OT/SO loss, 0 regulation loss', () => {
    const r: Record<string, Rec> = { A: rec(), B: rec() };
    const g: Game = { home: 'A', away: 'B', hs: 3, as: 2, type: 'OT', played: true };
    applyResult(r, g);
    expect(r.A.pts).toBe(2);
    expect(r.B.pts).toBe(1);
    expect(r.B.otl).toBe(1);
    applyResult(r, { ...g, hs: 1, as: 4, type: 'REG' });
    expect(r.A.pts).toBe(2);
    expect(r.A.l).toBe(1);
    expect(r.B.pts).toBe(3);
  });

  it('builds a 16-team NHL-format bracket with no duplicates', () => {
    const s = createSeason('BOS', 20, 3, 42);
    for (let i = 0; i < 20; i++) advance(s, null);
    expect(s.phase).toBe('playoffs');
    expect(s.series).toHaveLength(8);
    const teams = s.series.flatMap((x) => [x.hi, x.lo]);
    expect(new Set(teams).size).toBe(16);
    expect(playoffSeeds(s, 'Eastern')).toHaveLength(4);
    for (const r of Object.values(s.records)) expect(r.gp).toBe(20);
  });

  it('plays the playoffs through to a champion', () => {
    const s = createSeason('EDM', 10, 7, 7);
    let n = 0;
    while (s.phase !== 'done' && n++ < 200) advance(s, null);
    expect(s.phase).toBe('done');
    expect(s.champion).toBeTruthy();
  });
});
