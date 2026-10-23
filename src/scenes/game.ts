import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { rng } from '../core/rng';
import { Match, events, type MatchConfig, type Side } from '../game/match';
import { GameRenderer } from '../render/gameRender';
import { text } from '../render/font';
import { button, Menu, panel, UI, type Rect } from '../render/ui';
import type { Scene } from './scene';

export class GameScene implements Scene {
  m: Match;
  private r: GameRenderer;
  private paused = false;
  private pauseMenu = new Menu([]);
  private chargeT = 12;

  constructor(
    cfg: MatchConfig,
    private onFinish: (m: Match) => void,
    private onQuit: () => void,
  ) {
    this.m = new Match(cfg);
    this.r = new GameRenderer(this.m);
  }

  enter() {
    audio.music(false);
    audio.crowdLoop(true);
    events.reset();
  }

  leave() {
    audio.crowdLoop(false);
    input.gameTouch = false;
  }

  hidden() {
    if (this.live()) this.paused = true;
  }

  private live() {
    const s = this.m.state;
    return s !== 'final' && s !== 'intermission';
  }

  private layoutTouch() {
    const { W, H, safe } = display;
    input.touchButtons = [
      { id: 'b', x: W - safe.r - 30, y: H - safe.b - 30, r: 19 },
      { id: 'a', x: W - safe.r - 73, y: H - safe.b - 21, r: 15 },
      { id: 'c', x: W - safe.r - 25, y: H - safe.b - 73, r: 12 },
      { id: 'pause', x: W - safe.r - 13, y: safe.t + 10, r: 10 },
    ];
  }

  private pauseRects(): Rect[] {
    const { W, H } = display;
    const w = 130;
    const x = Math.round(W / 2 - w / 2);
    const y = Math.round(H / 2 - 10);
    return [
      { x, y, w, h: 20 },
      { x, y: y + 26, w, h: 18 },
    ];
  }

  private panelButton(): Rect {
    const { W, H, safe } = display;
    return { x: Math.round(W / 2 - 55), y: H - safe.b - 34, w: 110, h: 22 };
  }

  update(dt: number) {
    const m = this.m;
    this.layoutTouch();
    const { W, safe } = display;
    const play = m.state === 'play' || m.state === 'faceoff' || m.state === 'soAttempt';
    input.gameTouch = input.touchMode && play && !this.paused;
    const pauseTap = input.taps.some((t) => t.x > W - safe.r - 30 && t.y < safe.t + 26);
    if ((input.start.pressed || pauseTap) && this.live()) {
      this.paused = !this.paused;
      audio.sfx(this.paused ? 'back' : 'select');
      input.releaseTouches();
      return;
    }
    if (this.paused) {
      this.pauseMenu.items = this.pauseRects().map((r) => ({ r }));
      const i = this.pauseMenu.update();
      if (i === 0) this.paused = false;
      if (i === 1) this.onQuit();
      return;
    }
    if (m.state === 'goal' || m.state === 'replay') {
      if (input.anyTap() || input.confirm.pressed || input.a.pressed || input.b.pressed) m.skip = true;
    }
    if (m.state === 'intermission') {
      const r = this.panelButton();
      if (input.confirm.pressed || input.tapIn(r.x, r.y, r.w, r.h)) {
        audio.sfx('select');
        m.continueGame();
      }
    } else if (m.state === 'final') {
      const r = this.panelButton();
      if (m.stateT > 1 && (input.confirm.pressed || input.tapIn(r.x, r.y, r.w, r.h))) {
        audio.sfx('select');
        this.onFinish(m);
        return;
      }
    }
    const was = m.state;
    m.update(dt, play ? input : null);
    if (m.state === 'final' && was !== 'final') audio.sfx(m.human >= 0 && m.winner() === m.human ? 'win' : 'lose');
    this.sounds();
    for (const e of m.events) {
      this.r.handle(e);
      if (e.t === 'hit') audio.sfx('check');
      if (e.t === 'deke') audio.sfx('deke');
    }
    m.events.length = 0;
    // organ sting when the human team presses in the offensive zone
    this.chargeT -= dt;
    const pk = m.puck;
    if (this.chargeT <= 0 && m.state === 'play' && pk.owner && pk.owner.side === m.human && m.ax(m.human as Side, pk.x) > 400) {
      audio.sfx('charge');
      this.chargeT = 25 + rng.next() * 20;
    }
    const snap = m.state === 'replay' && m.replay.length ? m.replay[Math.floor(m.replayPos)] : m.snapshot();
    this.r.update(dt, snap);
  }

  private sounds() {
    if (events.pass) audio.sfx('pass');
    if (events.shot === 2) audio.sfx('slap');
    else if (events.shot === 1) audio.sfx('shot');
    if (events.stick) audio.sfx('stick', 0.6);
    if (events.board) audio.sfx('board', events.board);
    if (events.post) audio.sfx('post');
    if (events.save) audio.sfx('save');
    if (events.goal) audio.sfx('horn');
    if (events.whistle) audio.sfx('whistle');
    if (events.buzzer) audio.sfx('buzzer');
    events.reset();
  }

  render(ctx: CanvasRenderingContext2D) {
    const m = this.m;
    const { W, H, safe } = display;
    const replay = m.state === 'replay' && m.replay.length > 0;
    const snap = replay ? m.replay[Math.min(m.replay.length - 1, Math.floor(m.replayPos))] : m.snapshot();
    this.r.draw(ctx, snap);
    if (replay) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, 14 + safe.t);
      ctx.fillRect(0, H - 14 - safe.b, W, 14 + safe.b);
      if (Math.floor(performance.now() / 400) % 2 === 0) {
        ctx.fillStyle = UI.red;
        ctx.fillRect(safe.l + 6, safe.t + 4, 5, 5);
      }
      text(ctx, 'REPLAY', safe.l + 14, safe.t + 3, { color: '#fff', shadow: null });
      text(ctx, 'TAP TO SKIP', W - safe.r - 6, H - safe.b - 10, { color: UI.dim, align: 'right', shadow: null });
      return;
    }
    this.r.hud(ctx);
    if (m.state === 'play' || m.state === 'faceoff' || m.state === 'soAttempt') this.r.playerTag(ctx);
    if (input.touchMode && (m.state === 'play' || m.state === 'faceoff' || m.state === 'soAttempt') && !this.paused) this.r.touchControls(ctx);
    this.r.banner(ctx);
    if (m.state === 'faceoff' && m.human >= 0 && m.stateT > 0.3) {
      text(ctx, input.touchMode ? 'TAP PASS OR SHOOT WHEN THE PUCK DROPS' : 'PRESS PASS/SHOOT ON THE DROP', W / 2, H * 0.62, {
        color: '#fff', align: 'center', outline: '#12121c', shadow: null,
      });
    }
    if (m.state === 'intermission') this.statsPanel(ctx, 'INTERMISSION', 'CONTINUE');
    if (m.state === 'final' && m.stateT > 0.6) this.statsPanel(ctx, 'FINAL', 'CONTINUE');
    if (this.paused) {
      ctx.fillStyle = 'rgba(8,10,24,0.7)';
      ctx.fillRect(0, 0, W, H);
      text(ctx, 'PAUSED', W / 2, H / 2 - 40, { scale: 3, color: '#fff', align: 'center', outline: '#12121c' });
      const rs = this.pauseRects();
      button(ctx, rs[0], 'RESUME', { color: UI.green, selected: this.pauseMenu.sel === 0 });
      button(ctx, rs[1], 'QUIT GAME', { color: '#6a4c93', selected: this.pauseMenu.sel === 1 });
    }
  }

  private statsPanel(ctx: CanvasRenderingContext2D, title: string, btn: string) {
    const m = this.m;
    const { W, H, safe } = display;
    ctx.fillStyle = 'rgba(8,10,24,0.55)';
    ctx.fillRect(0, 0, W, H);
    const pw = Math.min(300, W - 30);
    const ph = Math.min(H - safe.t - safe.b - 50, 150);
    const px = Math.round(W / 2 - pw / 2);
    const py = Math.round(safe.t + 22);
    panel(ctx, px, py, pw, ph);
    const t0 = m.teams[0];
    const t1 = m.teams[1];
    let head = title;
    if (title === 'FINAL' && m.endType !== 'REG') head = `FINAL / ${m.endType}`;
    text(ctx, head, W / 2, py + 6, { color: UI.yellow, align: 'center' });
    const c1 = px + pw * 0.3;
    const c2 = px + pw * 0.7;
    text(ctx, t1.abbr, c1, py + 18, { color: '#fff', align: 'center', scale: 2 });
    text(ctx, t0.abbr, c2, py + 18, { color: '#fff', align: 'center', scale: 2 });
    text(ctx, `${m.score[1]}`, c1, py + 36, { color: '#fff', align: 'center', scale: 2 });
    text(ctx, `${m.score[0]}`, c2, py + 36, { color: '#fff', align: 'center', scale: 2 });
    const fo = m.foWon[0] + m.foWon[1] || 1;
    const rows: [string, string, string][] = [
      ['SHOTS', `${m.shots[1]}`, `${m.shots[0]}`],
      ['HITS', `${m.hits[1]}`, `${m.hits[0]}`],
      ['FACEOFF %', `${Math.round((m.foWon[1] / fo) * 100)}`, `${Math.round((m.foWon[0] / fo) * 100)}`],
      ['POWER PLAY', `${m.ppGoals[1]}/${m.ppOpp[1]}`, `${m.ppGoals[0]}/${m.ppOpp[0]}`],
    ];
    if (m.so) rows.push(['SHOOTOUT', `${m.so.goals[1]}`, `${m.so.goals[0]}`]);
    let y = py + 56;
    for (const [k, a, b] of rows) {
      if (y > py + ph - 10) break;
      text(ctx, a, c1, y, { color: '#fff', align: 'center', shadow: null });
      text(ctx, k, W / 2, y, { color: UI.dim, align: 'center', shadow: null });
      text(ctx, b, c2, y, { color: '#fff', align: 'center', shadow: null });
      y += 11;
    }
    button(ctx, this.panelButton(), btn, { color: UI.green, selected: true });
  }
}
