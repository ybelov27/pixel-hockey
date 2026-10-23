/**
 * Rink geometry in world units, modelled on NHL dimensions (200 x 85 ft, 28 ft corners)
 * at 3 px per foot. World x runs along the length, y across the width.
 * Rendering uses a fake 3/4 projection: screen y = y * YS.
 */
export const FT = 3;
export const RINK_L = 200 * FT; // 600
export const RINK_W = 85 * FT; // 255
export const CORNER_R = 28 * FT; // 84
export const GOAL_LINE = 11 * FT; // 33
export const BLUE_LINE = GOAL_LINE + 64 * FT; // 225
export const CX = RINK_L / 2;
export const CY = RINK_W / 2;
export const GOAL_HW = 11; // half goal width (slightly arcade-sized)
export const GOAL_DEPTH = 10;
export const GOAL_H = 14; // crossbar height
export const CREASE_R = 6 * FT;
export const CIRCLE_R = 15 * FT;
export const DOT_END_X = GOAL_LINE + 20 * FT; // 93
export const DOT_NEU_X = BLUE_LINE + 5 * FT; // 240
export const DOT_DY = 22 * FT; // 66

export const YS = 0.6;
export const ARENA_SIDE = 70;
export const ARENA_TOP = 100;
export const ARENA_BOTTOM = 86;
export const WORLD_PX_W = RINK_L + ARENA_SIDE * 2;
export const WORLD_PX_H = Math.ceil(ARENA_TOP + RINK_W * YS + ARENA_BOTTOM);

export const projX = (x: number) => ARENA_SIDE + x;
export const projY = (y: number) => ARENA_TOP + y * YS;

/** x-extent of the rink at a given world y (rounded corners). */
export function rinkXRange(y: number): [number, number] {
  let dy = 0;
  if (y < CORNER_R) dy = CORNER_R - y;
  else if (y > RINK_W - CORNER_R) dy = y - (RINK_W - CORNER_R);
  if (dy <= 0) return [0, RINK_L];
  if (dy >= CORNER_R) return [CORNER_R, RINK_L - CORNER_R];
  const dx = Math.sqrt(CORNER_R * CORNER_R - dy * dy);
  return [CORNER_R - dx, RINK_L - CORNER_R + dx];
}

/** y-extent of the rink at a given world x. */
export function rinkYRange(x: number): [number, number] {
  let dx = 0;
  if (x < CORNER_R) dx = CORNER_R - x;
  else if (x > RINK_L - CORNER_R) dx = x - (RINK_L - CORNER_R);
  if (dx <= 0) return [0, RINK_W];
  if (dx >= CORNER_R) return [CORNER_R, RINK_W - CORNER_R];
  const dy = Math.sqrt(CORNER_R * CORNER_R - dx * dx);
  return [CORNER_R - dy, RINK_W - CORNER_R + dy];
}

export interface BoardHit {
  hit: boolean;
  nx: number;
  ny: number;
}

/**
 * Keep a circle of radius r inside the rink. Mutates pos, returns the
 * inward-facing normal of the board that was hit.
 */
export function constrainToRink(p: { x: number; y: number }, r: number): BoardHit {
  const res: BoardHit = { hit: false, nx: 0, ny: 0 };
  const inCornerX = p.x < CORNER_R ? CORNER_R : p.x > RINK_L - CORNER_R ? RINK_L - CORNER_R : -1;
  const inCornerY = p.y < CORNER_R ? CORNER_R : p.y > RINK_W - CORNER_R ? RINK_W - CORNER_R : -1;
  if (inCornerX >= 0 && inCornerY >= 0) {
    const dx = p.x - inCornerX;
    const dy = p.y - inCornerY;
    const d = Math.hypot(dx, dy);
    const max = CORNER_R - r;
    if (d > max && d > 0) {
      p.x = inCornerX + (dx / d) * max;
      p.y = inCornerY + (dy / d) * max;
      res.hit = true;
      res.nx = -dx / d;
      res.ny = -dy / d;
    }
    return res;
  }
  if (p.x < r) {
    p.x = r;
    res.hit = true;
    res.nx = 1;
  } else if (p.x > RINK_L - r) {
    p.x = RINK_L - r;
    res.hit = true;
    res.nx = -1;
  }
  if (p.y < r) {
    p.y = r;
    res.hit = true;
    res.ny = 1;
  } else if (p.y > RINK_W - r) {
    p.y = RINK_W - r;
    res.hit = true;
    res.ny = -1;
  }
  if (res.nx && res.ny) {
    const l = Math.SQRT2;
    res.nx /= l;
    res.ny /= l;
  }
  return res;
}

export interface Dot {
  x: number;
  y: number;
}

export const CENTER_DOT: Dot = { x: CX, y: CY };

export function endDot(left: boolean, top: boolean): Dot {
  return { x: left ? DOT_END_X : RINK_L - DOT_END_X, y: top ? CY - DOT_DY : CY + DOT_DY };
}

export function neutralDot(left: boolean, top: boolean): Dot {
  return { x: left ? DOT_NEU_X : RINK_L - DOT_NEU_X, y: top ? CY - DOT_DY : CY + DOT_DY };
}
