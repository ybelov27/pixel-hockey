import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { loadRaw, settings } from '../core/storage';
import { text } from '../render/font';
import { button, Menu, type Rect } from '../render/ui';
import type { Season } from '../game/league';
import { teamByAbbr, type Team } from '../data/teams';
import { attractDraw, attractStep } from './attract';
import { drawLogo, TitleScene } from './title';
import { scenes, type Scene } from './scene';
import { TeamSelectScene } from './teamSelect';
import { PregameScene } from './pregame';
import { GameScene } from './game';
import { ResultsScene } from './results';
import { SeasonHubScene, SeasonSetupScene } from './season';
import { SettingsScene } from './settings';
import { HelpScene } from './help';

export const SEASON_KEY = 'ph.season';

export class MainMenu implements Scene {
  private menu = new Menu([]);
  private labels: { label: string; sub?: string; color: string; act: () => void }[] = [];
  private season: Season | null = null;

  enter() {
    audio.music(true);
    this.season = loadRaw<Season>(SEASON_KEY);
    const s = this.season;
    let seasonSub = 'NEW SEASON';
    if (s) {
      const r = s.records[s.team];
      seasonSub = `CONTINUE - ${s.team} ${r.w}-${r.l}-${r.otl}`;
    }
    this.labels = [
      { label: 'PLAY NOW', sub: 'QUICK GAME', color: '#e63946', act: () => quickGame() },
      { label: 'SEASON', sub: seasonSub, color: '#f4a236', act: () => this.openSeason() },
      { label: 'SHOOTOUT', sub: 'SUDDEN DRAMA', color: '#3a86ff', act: () => shootoutGame() },
      { label: 'SETTINGS', color: '#4a557f', act: () => scenes.go(new SettingsScene(() => scenes.go(new MainMenu()))) },
      { label: 'HOW TO PLAY', color: '#4a557f', act: () => scenes.go(new HelpScene(() => scenes.go(new MainMenu()))) },
    ];
  }

  private openSeason() {
    if (this.season) scenes.go(new SeasonHubScene());
    else
      scenes.go(
        new TeamSelectScene('PICK YOUR SEASON TEAM', null, (t) => scenes.go(new SeasonSetupScene(t)), () => scenes.go(new MainMenu())),
      );
  }

  private layout(): Rect[] {
    const { W, H } = display;
    const logoScale = 2;
    const top = Math.round(H * 0.07) + 7 * logoScale * 2 + logoScale * 2 + 14;
    const bigH = 24;
    const smallH = 15;
    const gap = 5;
    const w = Math.min(190, W - 40);
    const rects: Rect[] = [];
    let y = top;
    const avail = H - top - 18;
    const need = 3 * (bigH + gap) + 2 * (smallH + gap);
    const g = need > avail ? 3 : gap;
    for (let i = 0; i < 5; i++) {
      const h = i < 3 ? bigH : smallH;
      rects.push({ x: Math.round(W / 2 - w / 2), y, w, h });
      y += h + g;
    }
    return rects;
  }

  update(dt: number) {
    attractStep(dt);
    const rects = this.layout();
    this.menu.items = rects.map((r) => ({ r }));
    const i = this.menu.update();
    if (i >= 0) this.labels[i].act();
    if (input.back.pressed) scenes.go(new TitleScene());
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    attractDraw(ctx, 0.6);
    drawLogo(ctx, W / 2, Math.round(H * 0.07), 2);
    const rects = this.layout();
    rects.forEach((r, i) => {
      const it = this.labels[i];
      if (!it) return;
      button(ctx, r, it.label, { color: it.color, selected: this.menu.sel === i, sub: i < 3 ? it.sub : undefined });
    });
    text(ctx, 'V1.0', W - safe.r - 4, H - safe.b - 9, { color: 'rgba(255,255,255,0.4)', align: 'right', shadow: null });
  }
}

function matchCfg(home: Team, away: Team, human: 0 | 1, kind: 'exhibition' | 'season' | 'playoff' | 'shootout') {
  return {
    home, away, human, kind,
    periodSec: settings.periodMin * 60,
    difficulty: settings.difficulty,
    offside: settings.offside,
    icing: settings.icing,
    penalties: settings.penalties,
  };
}

export function quickGame() {
  const back = () => scenes.go(new MainMenu());
  scenes.go(
    new TeamSelectScene('SELECT YOUR TEAM', null, (you) => {
      scenes.go(
        new TeamSelectScene('SELECT OPPONENT', you.abbr, (opp) => {
          scenes.go(
            new PregameScene({ home: you, away: opp, human: 0, swap: true, title: 'EXHIBITION' }, (home, away, human) => {
              const cfg = matchCfg(home, away, human, 'exhibition');
              scenes.go(new GameScene(cfg, (m) => scenes.go(new ResultsScene(m, back)), back));
            }, back),
          );
        }, back),
      );
    }, back),
  );
}

export function shootoutGame() {
  const back = () => scenes.go(new MainMenu());
  scenes.go(
    new TeamSelectScene('SHOOTOUT: YOUR TEAM', null, (you) => {
      scenes.go(
        new TeamSelectScene('SHOOTOUT: OPPONENT', you.abbr, (opp) => {
          const cfg = matchCfg(you, opp, 0, 'shootout');
          scenes.go(new GameScene(cfg, (m) => scenes.go(new ResultsScene(m, back)), back));
        }, back),
      );
    }, back),
  );
}

export function seasonMatchCfg(s: Season, home: string, away: string) {
  const human = home === s.team ? 0 : 1;
  return matchCfg(teamByAbbr(home), teamByAbbr(away), human, s.phase === 'playoffs' ? 'playoff' : 'season');
}
