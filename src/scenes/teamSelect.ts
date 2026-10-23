import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { DIVISIONS, TEAMS, overall, type Team } from '../data/teams';
import { text } from '../render/font';
import { bar, button, chunky, drawCrest, header, menuBg, panel, UI } from '../render/ui';
import type { Scene } from './scene';

const BY_DIV: Team[][] = DIVISIONS.map((d) => TEAMS.filter((t) => t.division === d));
const DIV_SHORT = ['ATLANTIC', 'METROPOLITAN', 'CENTRAL', 'PACIFIC'];

let lastPick = 'BOS';

export class TeamSelectScene implements Scene {
  private row = 0;
  private col = 0;

  constructor(
    private title: string,
    private exclude: string | null,
    private onPick: (t: Team) => void,
    private onBack: () => void,
  ) {
    const start = exclude === lastPick ? TEAMS.find((t) => t.abbr !== exclude)!.abbr : lastPick;
    BY_DIV.forEach((r, ri) =>
      r.forEach((t, ci) => {
        if (t.abbr === start) {
          this.row = ri;
          this.col = ci;
        }
      }),
    );
  }

  private get team() {
    return BY_DIV[this.row][this.col];
  }

  private geo() {
    const { W, H, safe } = display;
    const top = 20 + safe.t + 3;
    const infoH = 44;
    const labelH = 8;
    const cellW = Math.floor((W - safe.l - safe.r - 12) / 8);
    const cellH = Math.max(26, Math.min(32, Math.floor((H - top - infoH - safe.b - 4 * labelH - 6) / 4)));
    const gx = Math.round((W - cellW * 8) / 2);
    return { top, infoH, labelH, cellW, cellH, gx };
  }

  private pick() {
    const t = this.team;
    if (t.abbr === this.exclude) return;
    audio.sfx('select');
    if (!this.exclude) lastPick = t.abbr;
    this.onPick(t);
  }

  private moveTo(r: number, c: number) {
    this.row = (r + 4) % 4;
    this.col = (c + 8) % 8;
    if (this.team.abbr === this.exclude) this.col = (this.col + 1) % 8;
    audio.sfx('blip');
  }

  update() {
    if (input.left.pressed) this.moveTo(this.row, this.col - 1);
    if (input.right.pressed) this.moveTo(this.row, this.col + 1);
    if (input.up.pressed) this.moveTo(this.row - 1, this.col);
    if (input.down.pressed) this.moveTo(this.row + 1, this.col);
    if (input.confirm.pressed) {
      this.pick();
      return;
    }
    if (input.back.pressed) {
      audio.sfx('back');
      this.onBack();
      return;
    }
    const { W, H, safe } = display;
    const g = this.geo();
    for (const t of input.taps) {
      if (t.x < 34 + safe.l && t.y < 20 + safe.t) {
        audio.sfx('back');
        this.onBack();
        return;
      }
      const sel = this.selectRect(W, H, safe.r, safe.b);
      if (t.x >= sel.x && t.x < sel.x + sel.w && t.y >= sel.y && t.y < sel.y + sel.h) {
        this.pick();
        return;
      }
      for (let r = 0; r < 4; r++) {
        const y0 = g.top + r * (g.cellH + g.labelH) + g.labelH;
        if (t.y < y0 || t.y >= y0 + g.cellH) continue;
        const c = Math.floor((t.x - g.gx) / g.cellW);
        if (c < 0 || c > 7) continue;
        const team = BY_DIV[r][c];
        if (team.abbr === this.exclude) continue;
        if (r === this.row && c === this.col) {
          this.pick();
          return;
        }
        this.row = r;
        this.col = c;
        audio.sfx('blip');
      }
    }
  }

  private selectRect(W: number, H: number, sr: number, sb: number) {
    return { x: W - sr - 78, y: H - sb - 34, w: 70, h: 24 };
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    const sel = this.team;
    menuBg(ctx, W, H, sel.primary);
    header(ctx, W, this.title, sel, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    const g = this.geo();
    const t = performance.now() / 1000;
    for (let r = 0; r < 4; r++) {
      const y0 = g.top + r * (g.cellH + g.labelH);
      text(ctx, DIV_SHORT[r], g.gx + 2, y0, { color: UI.dim, shadow: null });
      for (let c = 0; c < 8; c++) {
        const team = BY_DIV[r][c];
        const x = g.gx + c * g.cellW;
        const y = y0 + g.labelH;
        const isSel = r === this.row && c === this.col;
        const ex = team.abbr === this.exclude;
        if (isSel) {
          chunky(ctx, x + 1, y, g.cellW - 2, g.cellH, '#ffffff');
          chunky(ctx, x + 2, y + 1, g.cellW - 4, g.cellH - 2, UI.panelHi);
        }
        const bob = isSel ? Math.round(Math.sin(t * 6) * 1) : 0;
        ctx.globalAlpha = ex ? 0.25 : 1;
        drawCrest(ctx, team, x + g.cellW / 2, y + g.cellH / 2 + bob, 1);
        ctx.globalAlpha = 1;
      }
    }
    // info panel
    const py = H - safe.b - g.infoH + 2;
    panel(ctx, safe.l + 6, py, W - safe.l - safe.r - 12, g.infoH - 6, UI.panel, sel.primary);
    drawCrest(ctx, sel, safe.l + 26, py + 19, 1);
    text(ctx, `${sel.city} ${sel.name}`, safe.l + 44, py + 5, { color: '#fff' });
    text(ctx, `${sel.division.toUpperCase()} - OVR ${overall(sel)}`, safe.l + 44, py + 15, { color: UI.dim, shadow: null });
    const stats: [string, number][] = [['OFF', sel.off], ['DEF', sel.def], ['GOA', sel.goa]];
    const bw = Math.max(30, Math.min(60, Math.floor((W - safe.l - safe.r - 180) / 3) - 22));
    stats.forEach(([k, v], i) => {
      const x = safe.l + 44 + i * (bw + 24);
      text(ctx, k, x, py + 26, { color: '#fff', shadow: null });
      bar(ctx, x + 20, py + 27, bw, 4, (v - 60) / 40, v >= 86 ? UI.green : v >= 80 ? UI.yellow : UI.orange);
    });
    const sr = this.selectRect(W, H, safe.r, safe.b);
    button(ctx, sr, 'SELECT', { color: UI.green, selected: true });
  }
}
