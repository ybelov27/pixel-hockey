import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { DIFFICULTY_NAMES, saveSettings, settings } from '../core/storage';
import { overall, type Team } from '../data/teams';
import { text } from '../render/font';
import { button, drawCrest, header, Menu, menuBg, panel, UI, type Rect } from '../render/ui';
import type { Scene } from './scene';

export interface PregameOpts {
  home: Team;
  away: Team;
  human: 0 | 1;
  swap: boolean;
  title: string;
  sub?: string;
}

export const PERIODS = [1, 2, 3, 5, 10, 20];

export class PregameScene implements Scene {
  private menu = new Menu([]);

  constructor(
    private o: PregameOpts,
    private onStart: (home: Team, away: Team, human: 0 | 1) => void,
    private onBack: () => void,
  ) {}

  private rects(): Rect[] {
    const { W, H, safe } = display;
    const w = Math.min(200, W - 60);
    const x = Math.round(W / 2 - w / 2);
    const y0 = Math.round(H * 0.5);
    const rows: Rect[] = [];
    const n = this.o.swap ? 3 : 2;
    for (let i = 0; i < n; i++) rows.push({ x, y: y0 + i * 17, w, h: 14 });
    rows.push({ x: Math.round(W / 2 - 60), y: Math.min(H - safe.b - 28, y0 + n * 17 + 6), w: 120, h: 22 });
    return rows;
  }

  update() {
    const rects = this.rects();
    this.menu.items = rects.map((r) => ({ r }));
    const i = this.menu.update();
    const sel = this.menu.sel;
    const n = rects.length - 1;
    const dir = input.left.pressed ? -1 : input.right.pressed ? 1 : 0;
    const act = (idx: number, d: number) => {
      const kind = this.kinds()[idx];
      if (kind === 'side') {
        const { home, away } = this.o;
        this.o.home = away;
        this.o.away = home;
        this.o.human = this.o.human === 0 ? 1 : 0;
      } else if (kind === 'diff') {
        settings.difficulty = (settings.difficulty + d + 4) % 4;
      } else if (kind === 'period') {
        const j = PERIODS.indexOf(settings.periodMin);
        settings.periodMin = PERIODS[(j + d + PERIODS.length) % PERIODS.length];
      }
      saveSettings();
      audio.sfx('blip');
    };
    if (dir && sel < n) act(sel, dir);
    if (i >= 0) {
      if (i === n) {
        this.onStart(this.o.home, this.o.away, this.o.human);
        return;
      }
      act(i, 1);
    }
    if (input.back.pressed || input.taps.some((t) => t.x < 34 + display.safe.l && t.y < 20 + display.safe.t)) {
      audio.sfx('back');
      this.onBack();
    }
  }

  private kinds() {
    return this.o.swap ? ['side', 'diff', 'period'] : ['diff', 'period'];
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    const you = this.o.human === 0 ? this.o.home : this.o.away;
    menuBg(ctx, W, H, you.primary);
    header(ctx, W, this.o.title, you, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    const cy = Math.round(20 + safe.t + (H * 0.5 - 20 - safe.t) / 2);
    const away = this.o.away;
    const home = this.o.home;
    const dx = Math.min(110, W * 0.26);
    for (const [t, x, label] of [[away, W / 2 - dx, 'AWAY'], [home, W / 2 + dx, 'HOME']] as [Team, number, string][]) {
      drawCrest(ctx, t, x, cy - 6, 2);
      text(ctx, t.name, x, cy + 24, { color: '#fff', align: 'center' });
      const youTag = t === you ? 'YOU - ' : 'CPU - ';
      text(ctx, youTag + label, x, cy + 34, { color: t === you ? UI.yellow : UI.dim, align: 'center', shadow: null });
      text(ctx, `OVR ${overall(t)}`, x, cy - 42, { color: UI.dim, align: 'center', shadow: null });
    }
    text(ctx, 'AT', W / 2, cy - 10, { color: '#fff', scale: 2, align: 'center' });
    if (this.o.sub) text(ctx, this.o.sub, W / 2, cy + 12, { color: UI.yellow, align: 'center' });
    const rects = this.rects();
    const kinds = this.kinds();
    kinds.forEach((k, i) => {
      const r = rects[i];
      const sel = this.menu.sel === i;
      panel(ctx, r.x, r.y, r.w, r.h, sel ? UI.panelHi : UI.panel, sel ? '#ffffff' : UI.border);
      const label = k === 'side' ? 'PLAY AS' : k === 'diff' ? 'DIFFICULTY' : 'PERIOD';
      const val = k === 'side' ? (this.o.human === 0 ? 'HOME' : 'AWAY') : k === 'diff' ? DIFFICULTY_NAMES[settings.difficulty] : `${settings.periodMin} MIN`;
      text(ctx, label, r.x + 6, r.y + 4, { color: UI.dim, shadow: null });
      text(ctx, `< ${val} >`, r.x + r.w - 6, r.y + 4, { color: '#fff', align: 'right', shadow: null });
    });
    button(ctx, rects[rects.length - 1], 'FACE OFF!', { color: UI.red, selected: this.menu.sel === rects.length - 1 });
  }
}
