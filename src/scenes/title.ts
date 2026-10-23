import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { text } from '../render/font';
import { attractDraw, attractStep } from './attract';
import { scenes, type Scene } from './scene';
import { MainMenu } from './menu';

export function drawLogo(ctx: CanvasRenderingContext2D, cx: number, y: number, scale: number) {
  const t = performance.now() / 1000;
  const w = 6 * 6 * scale;
  ctx.fillStyle = 'rgba(8,10,26,0.55)';
  ctx.fillRect(Math.round(cx - w / 2 - 8), y - 6, w + 16, 7 * scale * 2 + scale * 2 + 14);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(Math.round(cx - w / 2 - 8), y - 6, w + 16, 2);
  ctx.fillRect(Math.round(cx - w / 2 - 8), y + 7 * scale * 2 + scale * 2 + 6, w + 16, 2);
  const bob = Math.round(Math.sin(t * 2.4) * 1);
  text(ctx, 'PIXEL', cx, y + bob, { align: 'center', scale, color: '#ffd23f', outline: '#3a1d00', shadow: '#000' });
  text(ctx, 'HOCKEY', cx, y + 7 * scale + scale * 2 - bob, { align: 'center', scale, color: '#ffffff', outline: '#10204a', shadow: '#000' });
}

export class TitleScene implements Scene {
  private t = 0;

  update(dt: number) {
    this.t += dt;
    attractStep(dt);
    if (this.t > 0.4 && (input.confirm.pressed || input.anyTap() || input.a.pressed || input.b.pressed)) {
      audio.unlock();
      audio.sfx('select');
      audio.music(true);
      scenes.go(new MainMenu());
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    attractDraw(ctx, 0.35);
    const scale = W >= 440 ? 5 : 4;
    const logoH = 7 * scale * 2 + scale * 2;
    const y = Math.round(H * 0.42 - logoH / 2);
    // stick-and-puck flair aligned to the logo, centered
    drawLogo(ctx, Math.round(W / 2), y, scale);
    text(ctx, '32 TEAMS - SEASONS - PLAYOFFS - SHOOTOUTS', W / 2, y + logoH + 14, { color: '#bfe3ff', align: 'center' });
    if (Math.floor(this.t * 2) % 2 === 0) {
      text(ctx, input.touchMode ? 'TAP TO START' : 'PRESS ENTER OR TAP TO START', W / 2, H * 0.78, { color: '#ffd23f', align: 'center', outline: '#12121c', shadow: null });
    }
    ctx.fillStyle = 'rgba(8,10,26,0.8)';
    ctx.fillRect(0, H - safe.b - 13, W, 13 + safe.b);
    text(ctx, 'FAN-MADE, NON-COMMERCIAL. NOT AFFILIATED WITH THE NHL.', W / 2, H - safe.b - 9, { color: 'rgba(255,255,255,0.55)', align: 'center', shadow: null });
  }
}
