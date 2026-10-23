import { display, initDisplay, present } from './core/display';
import { input } from './core/input';
import { audio } from './core/audio';
import { text } from './render/font';
import { scenes } from './scenes/scene';
import { TitleScene } from './scenes/title';

const STEP = 1 / 60;

function rotateOverlay(ctx: CanvasRenderingContext2D) {
  const { W, H } = display;
  ctx.fillStyle = '#141830';
  ctx.fillRect(0, 0, W, H);
  const t = performance.now() / 1000;
  const turn = Math.min(1, (t % 2.4) / 1.2);
  const cx = W / 2;
  const cy = H / 2 - 20;
  const pw = Math.round(14 + (26 - 14) * turn);
  const ph = Math.round(26 + (14 - 26) * turn);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(cx - pw / 2 - 2, cy - ph / 2 - 2, pw + 4, ph + 4);
  ctx.fillStyle = '#1a1f3d';
  ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
  text(ctx, 'ROTATE YOUR', W / 2, cy + 26, { color: '#fff', align: 'center', scale: 2 });
  text(ctx, 'DEVICE', W / 2, cy + 44, { color: '#fff', align: 'center', scale: 2 });
  text(ctx, 'PIXEL HOCKEY PLAYS IN LANDSCAPE', W / 2, cy + 66, { color: '#9aa3d6', align: 'center' });
}

function boot() {
  initDisplay();
  input.init(display.canvas);
  scenes.go(new TitleScene(), true);

  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    const ctx = display.b;
    if (display.portrait) {
      input.update();
      scenes.current?.hidden?.();
      rotateOverlay(ctx);
      present();
      return;
    }
    acc += dt;
    if (acc >= STEP) {
      input.update();
      let first = true;
      let steps = 0;
      while (acc >= STEP && steps < 8) {
        scenes.update(STEP);
        if (first) {
          input.clearEdges();
          first = false;
        }
        acc -= STEP;
        steps++;
      }
      if (steps >= 8) acc = 0;
    }
    scenes.render(ctx, display.W, display.H);
    present();
  };
  requestAnimationFrame(frame);
  if (import.meta.env.DEV) (window as unknown as { __ph: unknown }).__ph = { scenes };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      scenes.current?.hidden?.();
      audio.suspend();
    } else {
      audio.unlock();
      last = performance.now();
    }
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    });
  }
}

boot();
