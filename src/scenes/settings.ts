import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { DIFFICULTY_NAMES, remove, saveSettings, settings } from '../core/storage';
import { text } from '../render/font';
import { header, Menu, menuBg, panel, UI, type Rect } from '../render/ui';
import { PERIODS } from './pregame';
import type { Scene } from './scene';

type Row = { label: string; value: () => string; change: (d: number) => void };

export class SettingsScene implements Scene {
  private menu = new Menu([]);
  private confirmReset = false;
  private rows: Row[] = [
    { label: 'PERIOD LENGTH', value: () => `${settings.periodMin} MIN`, change: (d) => { const i = PERIODS.indexOf(settings.periodMin); settings.periodMin = PERIODS[(i + d + PERIODS.length) % PERIODS.length]; } },
    { label: 'DIFFICULTY', value: () => DIFFICULTY_NAMES[settings.difficulty], change: (d) => { settings.difficulty = (settings.difficulty + d + 4) % 4; } },
    { label: 'EASY CONTROLS', value: () => (settings.assist ? 'ON' : 'OFF'), change: () => { settings.assist = !settings.assist; } },
    { label: 'AUTO SWITCH', value: () => (settings.autoSwitch ? 'ON' : 'OFF'), change: () => { settings.autoSwitch = !settings.autoSwitch; } },
    { label: 'OFFSIDE', value: () => (settings.offside ? 'ON' : 'OFF'), change: () => { settings.offside = !settings.offside; } },
    { label: 'ICING', value: () => (settings.icing ? 'ON' : 'OFF'), change: () => { settings.icing = !settings.icing; } },
    { label: 'PENALTIES', value: () => (settings.penalties ? 'ON' : 'OFF'), change: () => { settings.penalties = !settings.penalties; } },
    { label: 'SOUND', value: () => (settings.sound ? 'ON' : 'OFF'), change: () => { settings.sound = !settings.sound; if (!settings.sound) audio.music(false); } },
    { label: 'MUSIC', value: () => (settings.music ? 'ON' : 'OFF'), change: () => { settings.music = !settings.music; audio.music(settings.music); } },
    { label: 'SCREEN SHAKE', value: () => (settings.shake ? 'ON' : 'OFF'), change: () => { settings.shake = !settings.shake; } },
    { label: 'RESET SEASON', value: () => (this.confirmReset ? 'TAP AGAIN' : ''), change: () => { if (this.confirmReset) { remove('ph.season'); this.confirmReset = false; audio.sfx('back'); } else this.confirmReset = true; } },
  ];

  constructor(private onBack: () => void) {}

  private rects(): Rect[] {
    const { W, H, safe } = display;
    const w = Math.min(260, W - 40);
    const top = 26 + safe.t;
    const h = Math.max(12, Math.min(16, Math.floor((H - top - safe.b - 6) / this.rows.length) - 2));
    return this.rows.map((_, i) => ({ x: Math.round(W / 2 - w / 2), y: top + i * (h + 2), w, h }));
  }

  update() {
    this.menu.items = this.rects().map((r) => ({ r }));
    const prev = this.menu.sel;
    const i = this.menu.update();
    if (this.menu.sel !== prev && prev === this.rows.length - 1) this.confirmReset = false;
    const d = input.left.pressed ? -1 : input.right.pressed ? 1 : 0;
    if (d) {
      this.rows[this.menu.sel].change(d);
      audio.sfx('blip');
      saveSettings();
    }
    if (i >= 0) {
      this.rows[i].change(1);
      saveSettings();
    }
    if (input.back.pressed || input.taps.some((t) => t.x < 34 + display.safe.l && t.y < 20 + display.safe.t)) {
      audio.sfx('back');
      this.onBack();
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    menuBg(ctx, W, H);
    header(ctx, W, 'SETTINGS', undefined, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    this.rects().forEach((r, i) => {
      const sel = this.menu.sel === i;
      panel(ctx, r.x, r.y, r.w, r.h, sel ? UI.panelHi : UI.panel, sel ? '#fff' : UI.border);
      const ty = r.y + Math.floor((r.h - 7) / 2);
      text(ctx, this.rows[i].label, r.x + 6, ty, { color: i === this.rows.length - 1 ? UI.red : '#fff', shadow: null });
      const v = this.rows[i].value();
      if (v) text(ctx, i === this.rows.length - 1 ? v : `< ${v} >`, r.x + r.w - 6, ty, { color: UI.yellow, align: 'right', shadow: null });
    });
  }
}
