import { display, toLogical } from './display';
import { audio } from './audio';

/** A virtual button fed by keyboard, touch and gamepad. Quick taps between frames are never lost. */
export class VBtn {
  down = false;
  pressed = false;
  released = false;
  private src = 0;
  private pendPress = false;
  private pendRelease = false;

  hold(on: boolean) {
    if (on) {
      if (this.src === 0) this.pendPress = true;
      this.src++;
    } else if (this.src > 0) {
      this.src--;
      if (this.src === 0) this.pendRelease = true;
    }
  }

  reset() {
    this.src = 0;
  }

  update(pad: boolean) {
    const d = this.src > 0 || pad;
    this.pressed = this.pendPress || (d && !this.down);
    this.released = this.pendRelease || (!d && this.down);
    this.down = d;
    this.pendPress = false;
    this.pendRelease = false;
  }

  clearEdges() {
    this.pressed = false;
    this.released = false;
  }
}

export type TouchBtnId = 'a' | 'b' | 'c' | 'pause';

export interface TouchButton {
  id: TouchBtnId;
  x: number;
  y: number;
  r: number;
}

interface PointerInfo {
  x: number;
  y: number;
  sx: number;
  sy: number;
  role: 'joy' | 'tap' | TouchBtnId;
  moved: boolean;
}

const KEYMAP: Record<string, string[]> = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['KeyJ', 'KeyZ'],
  b: ['KeyK', 'KeyX', 'Space'],
  c: ['KeyL', 'KeyC'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  start: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space', 'KeyZ', 'KeyJ'],
  back: ['Escape', 'Backspace'],
};

class Input {
  up = new VBtn();
  down = new VBtn();
  left = new VBtn();
  right = new VBtn();
  a = new VBtn();
  b = new VBtn();
  c = new VBtn();
  sprintBtn = new VBtn();
  start = new VBtn();
  confirm = new VBtn();
  back = new VBtn();

  move = { x: 0, y: 0 };
  sprint = false;
  taps: { x: number; y: number }[] = [];
  private pendingTaps: { x: number; y: number }[] = [];

  /** True once any touch happened: show on-screen controls. */
  touchMode = false;
  /** Set by the game scene when on-screen controls should capture touches. */
  gameTouch = false;
  touchButtons: TouchButton[] = [];
  joy = { active: false, id: -1, bx: 0, by: 0, x: 0, y: 0 };
  readonly joyR = 22;

  private keys = new Set<string>();
  private pointers = new Map<number, PointerInfo>();

  init(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      audio.unlock();
      this.setKey(e.code, true);
    });
    window.addEventListener('keyup', (e) => this.setKey(e.code, false));
    window.addEventListener('blur', () => {
      for (const k of [...this.keys]) this.setKey(k, false);
    });

    const opts = { passive: false } as AddEventListenerOptions;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e), opts);
    canvas.addEventListener('pointermove', (e) => this.onMove(e), opts);
    canvas.addEventListener('pointerup', (e) => this.onUp(e), opts);
    canvas.addEventListener('pointercancel', (e) => this.onUp(e, true), opts);
    // iOS: stop pinch/double-tap zoom and long-press menus.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchend', () => audio.unlock(), opts);
  }

  private setKey(code: string, on: boolean) {
    if (on === this.keys.has(code)) return;
    if (on) this.keys.add(code);
    else this.keys.delete(code);
    for (const [btn, codes] of Object.entries(KEYMAP)) {
      if (codes.includes(code)) {
        const vb = this.btnByName(btn);
        vb.hold(on);
      }
    }
  }

  private btnByName(n: string): VBtn {
    switch (n) {
      case 'up': return this.up;
      case 'down': return this.down;
      case 'left': return this.left;
      case 'right': return this.right;
      case 'a': return this.a;
      case 'b': return this.b;
      case 'c': return this.c;
      case 'sprint': return this.sprintBtn;
      case 'start': return this.start;
      case 'confirm': return this.confirm;
      default: return this.back;
    }
  }

  private touchBtn(id: TouchBtnId): VBtn {
    return id === 'a' ? this.a : id === 'b' ? this.b : id === 'c' ? this.c : this.start;
  }

  private onDown(e: PointerEvent) {
    e.preventDefault();
    audio.unlock();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') this.touchMode = true;
    try {
      display.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const p = toLogical(e.clientX, e.clientY);
    const info: PointerInfo = { x: p.x, y: p.y, sx: p.x, sy: p.y, role: 'tap', moved: false };
    if (this.gameTouch) {
      for (const b of this.touchButtons) {
        if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r * 1.35) {
          info.role = b.id;
          this.touchBtn(b.id).hold(true);
          break;
        }
      }
      if (info.role === 'tap' && p.x < display.W * 0.5 && !this.joy.active) {
        info.role = 'joy';
        this.joy = { active: true, id: e.pointerId, bx: p.x, by: p.y, x: p.x, y: p.y };
      }
    }
    this.pointers.set(e.pointerId, info);
  }

  private onMove(e: PointerEvent) {
    const info = this.pointers.get(e.pointerId);
    if (!info) return;
    e.preventDefault();
    const p = toLogical(e.clientX, e.clientY);
    info.x = p.x;
    info.y = p.y;
    if (Math.hypot(p.x - info.sx, p.y - info.sy) > 8) info.moved = true;
    if (info.role === 'joy') {
      const j = this.joy;
      j.x = p.x;
      j.y = p.y;
      const dx = j.x - j.bx;
      const dy = j.y - j.by;
      const d = Math.hypot(dx, dy);
      if (d > this.joyR) {
        // floating stick: base follows the thumb
        j.bx = j.x - (dx / d) * this.joyR;
        j.by = j.y - (dy / d) * this.joyR;
      }
    }
  }

  private onUp(e: PointerEvent, cancel = false) {
    const info = this.pointers.get(e.pointerId);
    if (!info) return;
    this.pointers.delete(e.pointerId);
    if (info.role === 'joy') {
      this.joy.active = false;
    } else if (info.role !== 'tap') {
      this.touchBtn(info.role).hold(false);
    }
    if (!cancel && !info.moved && info.role === 'tap') this.pendingTaps.push({ x: info.sx, y: info.sy });
  }

  /** Called once per rendered frame before the scene updates. */
  update() {
    let pad: Gamepad | null = null;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of pads) if (g && g.connected) { pad = g; break; }
    } catch {
      pad = null;
    }
    const pb = (i: number) => !!pad && !!pad.buttons[i] && pad.buttons[i].pressed;
    const ax = pad ? pad.axes[0] || 0 : 0;
    const ay = pad ? pad.axes[1] || 0 : 0;

    this.up.update(pb(12) || ay < -0.6);
    this.down.update(pb(13) || ay > 0.6);
    this.left.update(pb(14) || ax < -0.6);
    this.right.update(pb(15) || ax > 0.6);
    this.a.update(pb(0));
    this.b.update(pb(2) || pb(1));
    this.c.update(pb(3));
    this.sprintBtn.update(pb(7) || pb(5));
    this.start.update(pb(9));
    this.confirm.update(pb(0) || pb(9));
    this.back.update(pb(1) || pb(8));
    if (pad && pad.buttons.some((b) => b.pressed)) this.touchMode = false;

    let mx = (this.right.down ? 1 : 0) - (this.left.down ? 1 : 0);
    let my = (this.down.down ? 1 : 0) - (this.up.down ? 1 : 0);
    let sprint = this.sprintBtn.down;
    if (pad && Math.hypot(ax, ay) > 0.2) {
      mx = ax;
      my = ay;
    }
    if (this.joy.active) {
      const dx = (this.joy.x - this.joy.bx) / this.joyR;
      const dy = (this.joy.y - this.joy.by) / this.joyR;
      const d = Math.hypot(dx, dy);
      if (d > 0.18) {
        mx = dx / Math.max(1, d);
        my = dy / Math.max(1, d);
        if (d > 0.92) sprint = true;
      }
    }
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    this.move.x = mx;
    this.move.y = my;
    this.sprint = sprint;
    this.taps = this.pendingTaps;
    this.pendingTaps = [];
  }

  /** After the first fixed-step update in a frame, edges must not repeat. */
  clearEdges() {
    for (const b of [this.up, this.down, this.left, this.right, this.a, this.b, this.c, this.sprintBtn, this.start, this.confirm, this.back]) b.clearEdges();
    this.taps = [];
  }

  /** Drop any held touch roles (e.g. when switching scenes). */
  releaseTouches() {
    for (const [, info] of this.pointers) {
      if (info.role !== 'tap' && info.role !== 'joy') this.touchBtn(info.role).hold(false);
      info.role = 'tap';
      info.moved = true;
    }
    this.joy.active = false;
  }

  tapIn(x: number, y: number, w: number, h: number) {
    return this.taps.some((t) => t.x >= x && t.x < x + w && t.y >= y && t.y < y + h);
  }

  anyTap() {
    return this.taps.length > 0;
  }
}

export const input = new Input();
