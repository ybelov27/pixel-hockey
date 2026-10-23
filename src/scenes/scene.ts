import { input } from '../core/input';

export interface Scene {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  enter?(): void;
  leave?(): void;
  /** App went to background. */
  hidden?(): void;
}

class SceneManager {
  current: Scene | null = null;
  private next: Scene | null = null;
  private fade = 0; // 0..1 black overlay
  private dir = 0;

  go(s: Scene, instant = false) {
    if (instant || !this.current) {
      this.swap(s);
      return;
    }
    this.next = s;
    this.dir = 1;
  }

  private swap(s: Scene) {
    this.current?.leave?.();
    input.releaseTouches();
    input.gameTouch = false;
    this.current = s;
    s.enter?.();
  }

  update(dt: number) {
    if (this.dir === 1) {
      this.fade += dt / 0.14;
      if (this.fade >= 1) {
        this.fade = 1;
        if (this.next) this.swap(this.next);
        this.next = null;
        this.dir = -1;
      }
      return;
    }
    if (this.dir === -1) {
      this.fade -= dt / 0.14;
      if (this.fade <= 0) {
        this.fade = 0;
        this.dir = 0;
      }
    }
    this.current?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D, W: number, H: number) {
    this.current?.render(ctx);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(8,9,20,${this.fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

export const scenes = new SceneManager();
