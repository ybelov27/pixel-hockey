import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { loadRaw, remove, save } from '../core/storage';
import { DIVISIONS, teamByAbbr, type Team } from '../data/teams';
import {
  ROUND_NAMES, advance, createSeason, isAlive, seriesLine, standings, userGame, userSeries,
  type Result, type Season,
} from '../game/league';
import { text } from '../render/font';
import { button, chunky, drawCrest, header, Menu, menuBg, panel, UI, type Rect } from '../render/ui';
import { scenes, type Scene } from './scene';
import { MainMenu, SEASON_KEY, seasonMatchCfg } from './menu';
import { GameScene } from './game';
import { ResultsScene } from './results';
import { PregameScene } from './pregame';

const LENGTHS = [10, 20, 41, 82];
const SERIES = [1, 3, 5, 7];

export class SeasonSetupScene implements Scene {
  private len = 1;
  private ser = 1;
  private menu = new Menu([]);
  constructor(private team: Team) {}

  private rects(): Rect[] {
    const { W, H } = display;
    const w = Math.min(220, W - 40);
    const x = Math.round(W / 2 - w / 2);
    const y = Math.round(H * 0.45);
    return [
      { x, y, w, h: 15 },
      { x, y: y + 19, w, h: 15 },
      { x: Math.round(W / 2 - 60), y: y + 44, w: 120, h: 22 },
    ];
  }

  update() {
    this.menu.items = this.rects().map((r) => ({ r }));
    const i = this.menu.update();
    const d = input.left.pressed ? -1 : input.right.pressed ? 1 : 0;
    const change = (row: number, dd: number) => {
      if (row === 0) this.len = (this.len + dd + LENGTHS.length) % LENGTHS.length;
      if (row === 1) this.ser = (this.ser + dd + SERIES.length) % SERIES.length;
    };
    if (d && this.menu.sel < 2) {
      change(this.menu.sel, d);
      audio.sfx('blip');
    }
    if (i === 0 || i === 1) change(i, 1);
    if (i === 2) {
      const s = createSeason(this.team.abbr, LENGTHS[this.len], SERIES[this.ser]);
      save(SEASON_KEY, s);
      scenes.go(new SeasonHubScene());
    }
    if (input.back.pressed || input.taps.some((t) => t.x < 34 + display.safe.l && t.y < 20 + display.safe.t)) scenes.go(new MainMenu());
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    menuBg(ctx, W, H, this.team.primary);
    header(ctx, W, 'NEW SEASON', this.team, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    drawCrest(ctx, this.team, W / 2, H * 0.24, 2);
    text(ctx, `${this.team.city} ${this.team.name}`, W / 2, H * 0.24 + 30, { color: '#fff', align: 'center' });
    const r = this.rects();
    const rows: [string, string][] = [
      ['GAMES', `${LENGTHS[this.len]}`],
      ['PLAYOFF SERIES', `BEST OF ${SERIES[this.ser]}`],
    ];
    rows.forEach(([k, v], i) => {
      const sel = this.menu.sel === i;
      panel(ctx, r[i].x, r[i].y, r[i].w, r[i].h, sel ? UI.panelHi : UI.panel, sel ? '#fff' : UI.border);
      text(ctx, k, r[i].x + 6, r[i].y + 4, { color: UI.dim, shadow: null });
      text(ctx, `< ${v} >`, r[i].x + r[i].w - 6, r[i].y + 4, { color: '#fff', align: 'right', shadow: null });
    });
    button(ctx, r[2], 'START SEASON', { color: UI.green, selected: this.menu.sel === 2 });
  }
}

export class SeasonHubScene implements Scene {
  private s: Season;
  private menu = new Menu([]);
  private actions: { label: string; color: string; act: () => void }[] = [];

  constructor() {
    this.s = loadRaw<Season>(SEASON_KEY)!;
  }

  enter() {
    audio.music(true);
    this.s = loadRaw<Season>(SEASON_KEY) || this.s;
    this.buildActions();
  }

  private persist() {
    save(SEASON_KEY, this.s);
  }

  private buildActions() {
    const s = this.s;
    const a: typeof this.actions = [];
    if (s.phase === 'done') {
      a.push({ label: 'NEW SEASON', color: UI.green, act: () => { remove(SEASON_KEY); scenes.go(new MainMenu()); } });
    } else if (isAlive(s)) {
      a.push({ label: 'PLAY GAME', color: UI.red, act: () => this.play() });
      a.push({ label: 'SIM GAME', color: '#6a4c93', act: () => { advance(s, null); this.persist(); audio.sfx('select'); this.buildActions(); } });
    } else {
      a.push({ label: 'SIM TO END', color: '#6a4c93', act: () => { let n = 0; while (s.phase !== 'done' && n++ < 500) advance(s, null); this.persist(); this.buildActions(); } });
    }
    a.push({ label: 'STANDINGS', color: '#3a86ff', act: () => scenes.go(new StandingsScene(s)) });
    a.push({ label: 'MAIN MENU', color: '#4a557f', act: () => scenes.go(new MainMenu()) });
    this.actions = a;
  }

  private play() {
    const s = this.s;
    const g = userGame(s);
    if (!g) return;
    const cfg = seasonMatchCfg(s, g.home, g.away);
    const back = () => scenes.go(new SeasonHubScene());
    const ser = userSeries(s);
    const sub = s.phase === 'playoffs' && ser ? `${ROUND_NAMES[s.round]} - ${seriesLine(s, ser)}` : `GAME ${s.day + 1} OF ${s.length}`;
    scenes.go(
      new PregameScene({ home: cfg.home, away: cfg.away, human: cfg.human as 0 | 1, swap: false, title: s.phase === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON', sub }, () => {
        const full = seasonMatchCfg(s, g.home, g.away);
        scenes.go(
          new GameScene(full, (m) => {
            const res: Result = { hs: m.score[0], as: m.score[1], type: m.endType };
            advance(s, res);
            save(SEASON_KEY, s);
            scenes.go(new ResultsScene(m, back));
          }, back),
        );
      }, back),
    );
  }

  private rects(): Rect[] {
    const { W, H, safe } = display;
    const w = Math.min(130, Math.floor(W * 0.32));
    const x = W - safe.r - w - 10;
    const n = this.actions.length;
    const h = 18;
    const gap = 5;
    const y0 = H - safe.b - 8 - n * (h + gap) + gap;
    return this.actions.map((_, i) => ({ x, y: y0 + i * (h + gap), w, h }));
  }

  update() {
    this.menu.items = this.rects().map((r) => ({ r }));
    const i = this.menu.update();
    if (i >= 0) this.actions[i].act();
    if (input.back.pressed) scenes.go(new MainMenu());
  }

  render(ctx: CanvasRenderingContext2D) {
    const s = this.s;
    const { W, H, safe } = display;
    const me = teamByAbbr(s.team);
    menuBg(ctx, W, H, me.primary);
    const phase = s.phase === 'regular' ? `REGULAR SEASON - GAME ${Math.min(s.day + 1, s.length)}/${s.length}` : s.phase === 'playoffs' ? `PLAYOFFS - ${ROUND_NAMES[s.round]}` : 'SEASON COMPLETE';
    header(ctx, W, phase, me, safe.t);
    const r = s.records[s.team];
    const left = safe.l + 10;
    const top = 26 + safe.t;
    const rects = this.rects();
    const colW = rects[0].x - left - 10;
    // team card
    panel(ctx, left, top, colW, 44, UI.panel, me.primary);
    drawCrest(ctx, me, left + 18, top + 22, 1);
    text(ctx, `${me.city} ${me.name}`, left + 36, top + 6, { color: '#fff' });
    text(ctx, `${r.w}-${r.l}-${r.otl}  ${r.pts} PTS`, left + 36, top + 17, { color: UI.yellow });
    const div = standings(s, (t) => t.division === me.division);
    const pos = div.findIndex((x) => x.team.abbr === s.team) + 1;
    text(ctx, `${pos}${['ST', 'ND', 'RD'][pos - 1] || 'TH'} IN ${me.division.toUpperCase()}  GF ${r.gf} GA ${r.ga}`, left + 36, top + 28, { color: UI.dim, shadow: null });

    // next game / champion
    const ny = top + 50;
    panel(ctx, left, ny, colW, 40);
    if (s.phase === 'done' && s.champion) {
      const c = teamByAbbr(s.champion);
      drawCrest(ctx, c, left + 18, ny + 20, 1);
      text(ctx, 'PIXEL CUP CHAMPIONS', left + 36, ny + 8, { color: UI.yellow });
      text(ctx, `${c.city} ${c.name}`, left + 36, ny + 20, { color: '#fff' });
      if (c.abbr === s.team) this.trophy(ctx, left + colW - 22, ny + 6);
    } else {
      const g = userGame(s);
      if (g) {
        const opp = teamByAbbr(g.home === s.team ? g.away : g.home);
        text(ctx, 'NEXT GAME', left + 8, ny + 6, { color: UI.dim, shadow: null });
        drawCrest(ctx, opp, left + colW - 20, ny + 20, 1);
        text(ctx, `${g.home === s.team ? 'VS' : 'AT'} ${opp.city} ${opp.name}`.slice(0, Math.floor((colW - 46) / 6)), left + 8, ny + 17, { color: '#fff' });
        const ser = userSeries(s);
        const orec = s.records[opp.abbr];
        text(ctx, ser ? seriesLine(s, ser) : `${orec.w}-${orec.l}-${orec.otl}`, left + 8, ny + 28, { color: UI.yellow, shadow: null });
      } else {
        text(ctx, 'YOUR SEASON IS OVER', left + 8, ny + 10, { color: UI.red });
        text(ctx, 'SIM TO SEE WHO WINS THE CUP', left + 8, ny + 22, { color: UI.dim, shadow: null });
      }
    }
    // news / playoff series
    const py = ny + 46;
    const ph = H - safe.b - 8 - py;
    if (ph > 24) {
      panel(ctx, left, py, colW, ph);
      text(ctx, s.phase === 'playoffs' ? 'SERIES' : 'LATEST NEWS', left + 8, py + 5, { color: UI.yellow });
      const lines = s.phase === 'playoffs' ? s.series.map((x) => `${x.hi} V ${x.lo}: ${seriesLine(s, x)}`) : s.news;
      const max = Math.floor((ph - 16) / 9);
      const cols = s.phase === 'playoffs' && lines.length > max ? 2 : 1;
      lines.slice(0, max * cols).forEach((l, i) => {
        const cx = left + 8 + Math.floor(i / max) * Math.floor(colW / 2);
        text(ctx, l.slice(0, Math.floor((colW / cols - 12) / 6)), cx, py + 16 + (i % max) * 9, { color: i === 0 && s.phase !== 'playoffs' ? '#fff' : UI.dim, shadow: null });
      });
      if (!lines.length) text(ctx, 'THE SEASON STARTS NOW. GOOD LUCK!', left + 8, py + 16, { color: UI.dim, shadow: null });
    }
    rects.forEach((rc, i) => button(ctx, rc, this.actions[i].label, { color: this.actions[i].color, selected: this.menu.sel === i }));
  }

  private trophy(ctx: CanvasRenderingContext2D, x: number, y: number) {
    chunky(ctx, x, y, 14, 9, '#e8c547');
    ctx.fillStyle = '#b8932a';
    ctx.fillRect(x + 5, y + 9, 4, 6);
    chunky(ctx, x + 2, y + 15, 10, 4, '#e8c547');
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(x + 2, y + 1, 2, 5);
  }
}

export class StandingsScene implements Scene {
  private tab = 0;
  constructor(private s: Season) {
    const me = teamByAbbr(s.team);
    this.tab = DIVISIONS.indexOf(me.division);
  }

  private tabRects(): Rect[] {
    const { W, safe } = display;
    const w = Math.floor((W - safe.l - safe.r - 20) / 4);
    return DIVISIONS.map((_, i) => ({ x: safe.l + 10 + i * w, y: 24 + safe.t, w: w - 4, h: 14 }));
  }

  update() {
    if (input.left.pressed) this.tab = (this.tab + 3) % 4;
    if (input.right.pressed) this.tab = (this.tab + 1) % 4;
    for (const t of input.taps) {
      this.tabRects().forEach((r, i) => {
        if (t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h) this.tab = i;
      });
    }
    if (input.back.pressed || input.confirm.pressed || input.taps.some((t) => t.x < 34 + display.safe.l && t.y < 20 + display.safe.t)) {
      audio.sfx('back');
      scenes.go(new SeasonHubScene());
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const s = this.s;
    const { W, H, safe } = display;
    const me = teamByAbbr(s.team);
    menuBg(ctx, W, H, me.primary);
    header(ctx, W, 'STANDINGS', me, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    this.tabRects().forEach((r, i) => {
      button(ctx, r, DIVISIONS[i].slice(0, 5).toUpperCase(), { color: i === this.tab ? UI.orange : '#3a4170', selected: i === this.tab });
    });
    const rows = standings(s, (t) => t.division === DIVISIONS[this.tab]);
    const px = safe.l + 10;
    const pw = W - safe.l - safe.r - 20;
    const py = 44 + safe.t;
    const ph = H - py - safe.b - 6;
    panel(ctx, px, py, pw, ph);
    const lh = Math.max(9, Math.min(13, Math.floor((ph - 16) / 8)));
    const cols = [['GP', 0.5], ['W', 0.6], ['L', 0.68], ['OTL', 0.78], ['PTS', 0.9]] as [string, number][];
    text(ctx, 'TEAM', px + 8, py + 5, { color: UI.dim, shadow: null });
    for (const [k, f] of cols) text(ctx, k, px + pw * f, py + 5, { color: UI.dim, align: 'center', shadow: null });
    rows.forEach((row, i) => {
      const y = py + 16 + i * lh;
      const mine = row.team.abbr === s.team;
      if (mine) {
        ctx.fillStyle = 'rgba(255,210,63,0.18)';
        ctx.fillRect(px + 2, y - 2, pw - 4, lh);
      }
      if (i === 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(px + 4, y + lh - 2, pw - 8, 1);
      }
      ctx.fillStyle = row.team.primary;
      ctx.fillRect(px + 8, y, 5, 6);
      text(ctx, `${row.team.abbr} ${row.team.name}`.slice(0, Math.floor((pw * 0.45 - 20) / 6)), px + 17, y, { color: mine ? UI.yellow : '#fff', shadow: null });
      const r = row.rec;
      [r.gp, r.w, r.l, r.otl, r.pts].forEach((v, j) => text(ctx, String(v), px + pw * cols[j][1], y, { color: '#fff', align: 'center', shadow: null }));
    });
  }
}
