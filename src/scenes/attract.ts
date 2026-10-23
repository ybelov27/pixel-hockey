import { TEAMS } from '../data/teams';
import { Match, events } from '../game/match';
import { GameRenderer } from '../render/gameRender';
import { rng } from '../core/rng';

/** A CPU-vs-CPU game running behind the title and menus. */
let cur: { m: Match; r: GameRenderer } | null = null;

function fresh() {
  const a = rng.int(0, TEAMS.length - 1);
  let b = rng.int(0, TEAMS.length - 2);
  if (b >= a) b++;
  const m = new Match({
    home: TEAMS[a], away: TEAMS[b], human: -1, periodSec: 600, difficulty: 2,
    icing: true, penalties: false, kind: 'attract',
  });
  cur = { m, r: new GameRenderer(m) };
}

export function attractStep(dt: number) {
  if (!cur || cur.m.state === 'final' || cur.m.state === 'intermission') fresh();
  const { m, r } = cur!;
  m.update(dt, null);
  for (const e of m.events) r.handle(e);
  m.events.length = 0;
  events.reset();
  r.update(dt, m.snapshot());
}

export function attractDraw(ctx: CanvasRenderingContext2D, dim = 0.45) {
  if (!cur) fresh();
  cur!.r.draw(ctx, cur!.m.snapshot());
  ctx.fillStyle = `rgba(12,14,32,${dim})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
