import { display } from '../core/display';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { text } from '../render/font';
import { header, menuBg, panel, UI } from '../render/ui';
import type { Scene } from './scene';

const PAGES: { title: string; lines: string[] }[] = [
  {
    title: 'TOUCH (IPHONE / IPAD)',
    lines: [
      'LEFT SIDE: DRAG ANYWHERE TO SKATE.',
      'PUSH THE STICK ALL THE WAY TO SPRINT.',
      'WITH THE PUCK:',
      '  PASS - PASS TOWARD WHERE YOU AIM',
      '  SHOOT - TAP = WRIST, HOLD = SLAP SHOT',
      '  DEKE - SPIN MOVE PAST DEFENDERS',
      'ON DEFENSE:',
      '  SWITCH - CONTROL THE PLAYER NEAREST THE PUCK',
      '  CHECK - BODY CHECK, POKE - STEAL THE PUCK',
    ],
  },
  {
    title: 'KEYBOARD / GAMEPAD',
    lines: [
      'MOVE: ARROWS OR WASD   SPRINT: SHIFT',
      'PASS / SWITCH: J OR Z  (PAD A)',
      'SHOOT / CHECK: K, X OR SPACE  (PAD X/B)',
      'DEKE / POKE: L OR C  (PAD Y)',
      'PAUSE: ESC OR P  (PAD START)',
      '',
      'AIM SHOTS: HOLD UP OR DOWN WHILE SHOOTING',
      'TO PICK THE TOP OR BOTTOM CORNER.',
    ],
  },
  {
    title: 'TIPS',
    lines: [
      'ONE-TIMER: PRESS SHOOT WHILE A PASS IS ON',
      'ITS WAY TO YOU. GOALIES HATE THEM!',
      'REBOUNDS AND CROSS-CREASE PASSES BEAT GOALIES.',
      'FACEOFFS: PRESS PASS OR SHOOT RIGHT ON THE DROP.',
      'NO OFFSIDE. ICING IS OFF BY DEFAULT (SETTINGS).',
      'EASY CONTROLS: AIM AT THE YELLOW TARGET.',
      'HIT THE CROSSBAR AND IN FOR A BAR DOWN!',
      'ADD TO HOME SCREEN (SHARE > ADD TO HOME SCREEN)',
      'TO PLAY FULL-SCREEN LIKE AN APP, EVEN OFFLINE.',
    ],
  },
];

export class HelpScene implements Scene {
  private page = 0;
  constructor(private onBack: () => void) {}

  update() {
    const { W, safe } = display;
    if (input.back.pressed || input.taps.some((t) => t.x < 34 + safe.l && t.y < 20 + safe.t)) {
      audio.sfx('back');
      this.onBack();
      return;
    }
    let d = input.right.pressed || input.confirm.pressed ? 1 : input.left.pressed ? -1 : 0;
    for (const t of input.taps) d = t.x < W / 3 ? -1 : 1;
    if (d) {
      const n = this.page + d;
      if (n >= PAGES.length) {
        this.onBack();
        return;
      }
      this.page = Math.max(0, n);
      audio.sfx('blip');
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const { W, H, safe } = display;
    menuBg(ctx, W, H);
    header(ctx, W, 'HOW TO PLAY', undefined, safe.t);
    text(ctx, '<', safe.l + 8, safe.t + 6, { color: '#fff' });
    const p = PAGES[this.page];
    const pw = Math.min(W - 24, 330);
    const px = Math.round(W / 2 - pw / 2);
    const py = 26 + safe.t;
    const ph = H - py - safe.b - 18;
    panel(ctx, px, py, pw, ph);
    text(ctx, p.title, W / 2, py + 6, { color: UI.yellow, align: 'center' });
    const lh = Math.min(12, Math.floor((ph - 22) / p.lines.length));
    p.lines.forEach((l, i) => text(ctx, l, px + 8, py + 20 + i * lh, { color: '#fff', shadow: null }));
    text(ctx, `${this.page + 1}/${PAGES.length}  TAP OR PRESS RIGHT FOR MORE`, W / 2, H - safe.b - 12, { color: UI.dim, align: 'center', shadow: null });
  }
}
