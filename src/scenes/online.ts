import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { settings } from '../core/storage';
import { teamByAbbr, type Team } from '../data/teams';
import type { MatchConfig } from '../game/match';
import { CODE_ALPHABET, CODE_LEN, NET_VERSION, NetLink, type NetMessage } from '../net/net';
import { text } from '../render/font';
import { button, chunky, drawCrest, header, Menu, menuBg, panel, UI, wrapText, type Rect } from '../render/ui';
import { scenes, type Scene } from './scene';
import { MainMenu } from './menu';
import { TeamSelectScene } from './teamSelect';
import { GameScene } from './game';
import { ResultsScene } from './results';

const toMenu = () => scenes.go(new MainMenu());

function backTapped() {
  return input.back.pressed || input.taps.some((t) => t.x < 34 + display.safe.l && t.y < 20 + display.safe.t);
}

interface StartMsg {
  t: 'start';
  v: number;
  home: string;
  away: string;
  periodSec: number;
  assist: boolean;
  penalties: boolean;
  icing: boolean;
}

function onlineCfg(s: StartMsg): MatchConfig {
  return {
    home: teamByAbbr(s.home), away: teamByAbbr(s.away), human: 0, human2: true, kind: 'online',
    periodSec: s.periodSec, difficulty: 1, icing: s.icing, penalties: s.penalties, assist: s.assist, autoSwitch: true,
  };
}

export class OnlineMenuScene implements Scene {
  private menu = new Menu([]);

  private rects(): Rect[] {
    const { W, H } = display;
    const w = Math.min(200, W - 40);
    const x = Math.round(W / 2 - w / 2);
    const y = Math.round(H * 0.55);
    return [
      { x, y, w, h: 22 },
      { x, y: y + 28, w, h: 22 },
    ];
  }

  update() {
    this.menu.items = this.rects().map((r) => ({ r }));
    const i = this.menu.update();
    if (i === 0) scenes.go(new TeamSelectScene('ONLINE: YOUR TEAM', null, (t) => scenes.go(new HostLobbyScene(t)), () => scenes.go(new OnlineMenuScene())));
    if (i === 1) scenes.go(new TeamSelectScene('ONLINE: YOUR TEAM', null, (t) => scenes.go(new JoinScene(t)), () => scenes.go(new OnlineMenuScene())));
    if (backTapped()) toMenu();
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    menuBg(ctx, W, H, '#3a0ca3');
    header(ctx, W, 'ONLINE 1V1', undefined, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    const pw = Math.min(W - 40, 320);
    const px = Math.round(W / 2 - pw / 2);
    const py = 28 + safe.t;
    const ph = Math.round(H * 0.55) - py - 8;
    panel(ctx, px, py, pw, ph);
    const lines = [
      'PLAY A FRIEND OVER THE INTERNET.',
      'ONE PLAYER CREATES A ROOM AND SHARES THE',
      '5-LETTER CODE. THE OTHER JOINS WITH IT.',
      'YOU EACH CONTROL YOUR OWN TEAM.',
    ];
    lines.forEach((l, i) => text(ctx, l, W / 2, py + 8 + i * 11, { color: i === 0 ? UI.yellow : '#fff', align: 'center', shadow: null }));
    const r = this.rects();
    button(ctx, r[0], 'CREATE ROOM', { color: '#7209b7', selected: this.menu.sel === 0 });
    button(ctx, r[1], 'JOIN ROOM', { color: '#3a86ff', selected: this.menu.sel === 1 });
  }
}

export class HostLobbyScene implements Scene {
  private link: NetLink;
  private started = false;

  constructor(private team: Team) {
    this.link = NetLink.host();
    this.link.onMessage = (m) => this.onMsg(m);
  }

  private onMsg(m: NetMessage) {
    if (m.t !== 'hello' || this.started) return;
    if (m.v !== NET_VERSION) {
      this.link.send({ t: 'reject', why: 'GAME VERSIONS DIFFER - REFRESH BOTH GAMES' });
      return;
    }
    this.started = true;
    const start: StartMsg = {
      t: 'start', v: NET_VERSION, home: this.team.abbr, away: String(m.team),
      periodSec: settings.periodMin * 60, assist: settings.assist, penalties: settings.penalties, icing: settings.icing,
    };
    this.link.send(start as unknown as NetMessage);
    audio.sfx('select');
    const back = () => toMenu();
    scenes.go(new GameScene(onlineCfg(start), (mm) => scenes.go(new ResultsScene(mm, back, 0)), back, { link: this.link, role: 'host' }));
  }

  update() {
    if (backTapped()) {
      this.link.close();
      scenes.go(new OnlineMenuScene());
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    menuBg(ctx, W, H, this.team.primary);
    header(ctx, W, 'CREATE ROOM', this.team, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    const cy = Math.round(H * 0.45);
    if (this.link.error) {
      text(ctx, this.link.error, W / 2, cy - 10, { color: UI.red, align: 'center' });
      text(ctx, 'TAP < TO GO BACK AND TRY AGAIN', W / 2, cy + 6, { color: UI.dim, align: 'center', shadow: null });
      return;
    }
    text(ctx, 'ROOM CODE', W / 2, cy - 42, { color: UI.dim, align: 'center', shadow: null });
    const code = this.link.code || '-----';
    const bw = 30;
    const total = CODE_LEN * bw + (CODE_LEN - 1) * 6;
    for (let i = 0; i < CODE_LEN; i++) {
      const x = Math.round(W / 2 - total / 2 + i * (bw + 6));
      panel(ctx, x, cy - 28, bw, 34, UI.panelHi, UI.yellow);
      text(ctx, code[i] || '', x + bw / 2, cy - 20, { scale: 3, color: '#fff', align: 'center' });
    }
    const dots = '.'.repeat(1 + (Math.floor(performance.now() / 400) % 3));
    text(ctx, this.link.status.replace('...', '') + dots, W / 2, cy + 18, { color: UI.yellow, align: 'center' });
    text(ctx, 'SEND THIS CODE TO YOUR FRIEND. YOU ARE THE HOME TEAM.', W / 2, cy + 32, { color: UI.dim, align: 'center', shadow: null });
    drawCrest(ctx, this.team, W / 2, H - safe.b - 26, 1);
  }
}

const KEYS = CODE_ALPHABET.split('');

export class JoinScene implements Scene {
  private code = '';
  private link: NetLink | null = null;
  private error = '';
  private sel = 0;

  constructor(private team: Team) {}

  private keyRects() {
    const { W, H } = display;
    const cols = 11;
    const kw = Math.min(26, Math.floor((W - 40) / cols) - 3);
    const kh = 16;
    const total = cols * (kw + 3) - 3;
    const x0 = Math.round(W / 2 - total / 2);
    const y0 = Math.round(H * 0.5);
    const rects: Rect[] = KEYS.map((_, i) => ({ x: x0 + (i % cols) * (kw + 3), y: y0 + Math.floor(i / cols) * (kh + 3), w: kw, h: kh }));
    const yb = y0 + 3 * (kh + 3) + 4;
    rects.push({ x: x0, y: yb, w: Math.round(total * 0.3), h: 20 }); // DEL
    rects.push({ x: x0 + total - Math.round(total * 0.6), y: yb, w: Math.round(total * 0.6), h: 20 }); // JOIN
    return rects;
  }

  private type(ch: string) {
    if (this.link) return;
    this.error = '';
    if (ch === '\b') this.code = this.code.slice(0, -1);
    else if (KEYS.includes(ch) && this.code.length < CODE_LEN) this.code += ch;
    if (this.code.length === CODE_LEN) this.sel = KEYS.length + 1;
    audio.sfx('blip');
  }

  private join() {
    if (this.code.length !== CODE_LEN || this.link) return;
    audio.sfx('select');
    const link = NetLink.join(this.code);
    this.link = link;
    link.onOpen = () => link.send({ t: 'hello', v: NET_VERSION, team: this.team.abbr });
    link.onMessage = (m) => {
      if (m.t === 'reject') {
        this.error = String(m.why);
        link.close();
        this.link = null;
      }
      if (m.t === 'start') {
        const back = () => toMenu();
        scenes.go(new GameScene(onlineCfg(m as unknown as StartMsg), (mm) => scenes.go(new ResultsScene(mm, back, 1)), back, { link, role: 'guest' }));
      }
    };
    link.onClose = () => {
      this.error = link.error || 'CONNECTION CLOSED';
      this.link = null;
    };
  }

  update() {
    for (const ch of input.typed) {
      if (ch === '\r' || ch === '\n') this.join();
      else this.type(ch);
    }
    const rects = this.keyRects();
    const n = rects.length;
    if (input.right.pressed) this.sel = (this.sel + 1) % n;
    if (input.left.pressed) this.sel = (this.sel + n - 1) % n;
    if (input.down.pressed) this.sel = Math.min(n - 1, this.sel + 11);
    if (input.up.pressed) this.sel = Math.max(0, this.sel - 11);
    const act = (i: number) => {
      if (i < KEYS.length) this.type(KEYS[i]);
      else if (i === KEYS.length) this.type('\b');
      else this.join();
    };
    for (const t of input.taps) {
      const i = rects.findIndex((r) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h);
      if (i >= 0) {
        this.sel = i;
        act(i);
      }
    }
    if (input.confirm.pressed && !input.typed.length) act(this.sel);
    if (backTapped()) {
      this.link?.close();
      scenes.go(new OnlineMenuScene());
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    menuBg(ctx, W, H, this.team.primary);
    header(ctx, W, 'JOIN ROOM', this.team, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    const cy = Math.round(H * 0.3);
    text(ctx, 'ENTER YOUR FRIEND\'S ROOM CODE', W / 2, cy - 30, { color: UI.dim, align: 'center', shadow: null });
    const bw = 26;
    const total = CODE_LEN * bw + (CODE_LEN - 1) * 5;
    for (let i = 0; i < CODE_LEN; i++) {
      const x = Math.round(W / 2 - total / 2 + i * (bw + 5));
      const active = i === this.code.length && !this.link;
      panel(ctx, x, cy - 18, bw, 28, UI.panelHi, active ? '#ffffff' : UI.border);
      text(ctx, this.code[i] || (active && Math.floor(performance.now() / 400) % 2 ? '_' : ''), x + bw / 2, cy - 11, { scale: 2, color: '#fff', align: 'center' });
    }
    const status = this.error || (this.link ? this.link.status : '');
    if (status) {
      for (const [i, l] of wrapText(status, W - 40).entries()) text(ctx, l, W / 2, cy + 16 + i * 9, { color: this.error ? UI.red : UI.yellow, align: 'center' });
    }
    const rects = this.keyRects();
    rects.forEach((r, i) => {
      const sel = i === this.sel;
      if (i < KEYS.length) {
        chunky(ctx, r.x, r.y, r.w, r.h, sel ? '#ffffff' : UI.border);
        chunky(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, sel ? UI.panelHi : UI.panel);
        text(ctx, KEYS[i], r.x + r.w / 2, r.y + 5, { color: '#fff', align: 'center', shadow: null });
      } else if (i === KEYS.length) button(ctx, r, 'DEL', { color: '#6a4c93', selected: sel });
      else button(ctx, r, this.link ? 'JOINING...' : 'JOIN', { color: UI.green, selected: sel, disabled: this.code.length !== CODE_LEN });
    });
  }
}
