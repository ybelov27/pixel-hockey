import { display } from '../core/display';
import { input } from '../core/input';
import type { Match, Side } from '../game/match';
import { text } from '../render/font';
import { button, drawCrest, header, menuBg, panel, UI } from '../render/ui';
import type { Scene } from './scene';

export class ResultsScene implements Scene {
  constructor(
    private m: Match,
    private onContinue: () => void,
    /** Whose result this is (online guests are side 1). */
    private viewer?: Side,
  ) {}

  private btn() {
    const { W, H, safe } = display;
    return { x: Math.round(W / 2 - 55), y: H - safe.b - 30, w: 110, h: 22 };
  }

  update() {
    const b = this.btn();
    if (input.confirm.pressed || input.tapIn(b.x, b.y, b.w, b.h)) this.onContinue();
  }

  render(ctx: CanvasRenderingContext2D) {
    const m = this.m;
    const { W, H, safe } = display;
    const hs = (this.viewer ?? (m.human >= 0 ? m.human : m.winner())) as Side;
    const you = m.teams[hs];
    menuBg(ctx, W, H, you.primary);
    const won = m.human >= 0 && m.winner() === hs;
    const title = m.human < 0 ? 'FINAL' : won ? 'VICTORY!' : 'DEFEAT';
    header(ctx, W, title, you, safe.t);
    const top = 24 + safe.t;
    const cx1 = W / 2 - 70;
    const cx2 = W / 2 + 70;
    const scoreA = m.so && m.cfg.kind === 'shootout' ? m.so.goals[1] : m.score[1];
    const scoreH = m.so && m.cfg.kind === 'shootout' ? m.so.goals[0] : m.score[0];
    drawCrest(ctx, m.teams[1], cx1 - 34, top + 18, 1);
    drawCrest(ctx, m.teams[0], cx2 + 34, top + 18, 1);
    text(ctx, String(scoreA), cx1, top + 8, { scale: 3, color: '#fff', align: 'center' });
    text(ctx, String(scoreH), cx2, top + 8, { scale: 3, color: '#fff', align: 'center' });
    text(ctx, m.endType === 'REG' ? 'FINAL' : `FINAL / ${m.endType}`, W / 2, top + 14, { color: UI.yellow, align: 'center' });
    // goal log
    const py = top + 40;
    const ph = H - safe.b - 38 - py;
    panel(ctx, 16 + safe.l, py, W - 32 - safe.l - safe.r, ph);
    text(ctx, 'SCORING', 24 + safe.l, py + 5, { color: UI.yellow });
    const shots = `SHOTS ${m.teams[1].abbr} ${m.shots[1]} - ${m.shots[0]} ${m.teams[0].abbr}`;
    text(ctx, shots, W - safe.r - 24, py + 5, { color: UI.dim, align: 'right', shadow: null });
    const maxRows = Math.max(0, Math.floor((ph - 18) / 10));
    const goals = m.goals.slice(-maxRows);
    if (!goals.length) text(ctx, 'NO GOALS', W / 2, py + 20, { color: UI.dim, align: 'center', shadow: null });
    goals.forEach((g, i) => {
      const y = py + 17 + i * 10;
      const per = g.period <= 3 ? ['1ST', '2ND', '3RD'][g.period - 1] : 'OT';
      const c = Math.ceil(g.clock);
      const name = g.scorer ? `#${g.scorer.number} ${g.scorer.name}` : 'UNASSIGNED';
      const ast = g.assists.length ? ` (${g.assists.map((a) => a.name).join(', ')})` : '';
      text(ctx, `${per} ${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`, 24 + safe.l, y, { color: UI.dim, shadow: null });
      text(ctx, m.teams[g.side].abbr, 80 + safe.l, y, { color: m.teams[g.side].primary === '#000000' ? '#ccc' : '#fff', shadow: null });
      text(ctx, `${name}${ast}${g.pp ? ' PP' : ''}`.slice(0, Math.floor((W - 140) / 6)), 104 + safe.l, y, { color: '#fff', shadow: null });
    });
    button(ctx, this.btn(), 'CONTINUE', { color: UI.green, selected: true });
  }
}
