import { describe, expect, it } from 'vitest';
import { CORNER_R, RINK_L, RINK_W, constrainToRink, rinkXRange } from '../src/game/rink';

describe('rink geometry', () => {
  it('uses NHL proportions (200 x 85 ft, 28 ft corners)', () => {
    expect(RINK_L / RINK_W).toBeCloseTo(200 / 85, 5);
    expect(CORNER_R / RINK_L).toBeCloseTo(28 / 200, 5);
  });

  it('keeps a puck inside the straight boards', () => {
    const p = { x: RINK_L / 2, y: -10 };
    const hit = constrainToRink(p, 2);
    expect(hit.hit).toBe(true);
    expect(p.y).toBe(2);
    expect(hit.ny).toBe(1);
  });

  it('rims pucks around the rounded corners', () => {
    const p = { x: 1, y: 1 };
    const hit = constrainToRink(p, 2);
    expect(hit.hit).toBe(true);
    const d = Math.hypot(p.x - CORNER_R, p.y - CORNER_R);
    expect(d).toBeCloseTo(CORNER_R - 2, 5);
    expect(hit.nx).toBeGreaterThan(0);
    expect(hit.ny).toBeGreaterThan(0);
  });

  it('narrows the ice in the corners', () => {
    const [a] = rinkXRange(RINK_W / 2);
    const [b] = rinkXRange(2);
    expect(a).toBe(0);
    expect(b).toBeGreaterThan(30);
  });
});
