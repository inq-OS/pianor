import { spotlightLayout } from '../core/layout/spotlight';
import type { Rect } from '../core/layout/rect';
import { fromAscii, flipX, flipY, scale2x, type Bitmap } from './ui/pixel/bitmap';
import { drawnText, measure } from './ui/pixel/font';
import { C, PALETTE } from './ui/pixel/palette';
import { BAR_BUTTON_HEIGHT } from './ui/pixel/playBars';
import { PixelImage } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import { KIUR_DOOR } from './ui/pixel/sprites';
import { spokenLine, spokenPages, talkColour } from './ui/pixel/talkArt';
import { motionAllowed } from './motion';
import { t } from '../core/text/strings';
import { CANCELLED, closeOverlay, settleOverlay, type OverlayOutcome } from './scenes';

/** One thing Kiur shows: the spotlight on `spot` (art pixels of the whole screen, from its top-left corner; null: none), and his line. */
export interface IntroShow {
  readonly spot: Rect | null;
  readonly text: string;
}

/** What the intro's spotlight is opened with: Kiur's steps, shown one after another. */
export interface IntroData {
  readonly steps: readonly IntroShow[];
  /** Whether the skip button shows (the first-run intro); the piece maker's keys tour has none, Esc closes it. */
  readonly skippable?: boolean;
}

/** How dark the screen round the light gets: the room's blue-violet dusk, never grey (art-direction rule 26), as at the door. */
const DIM_ALPHA = 0.8;
/** How far the arrow bobs towards the light, and how long a bob takes. */
const BOB = { rows: 3, ms: 420 } as const;
/** Kiur's flight in at the first step. */
const FLY_MS = 400;
/** Room round the skip button's word. */
const SKIP_PAD = 10;
/** How many times the spotlight has been opened since the game started: each opening's number, for the tests. */
let openings = 0;

/**
 * A plain pointing arrow, own art (`TODO(painter)` in ft_1_31): gold with the kit's ink outline, pointing down.
 * `SPOTLIGHT.arrow` in `core/layout/spotlight.ts` holds its size.
 */
const ARROW_DOWN: Bitmap = scale2x(fromAscii([
  '.kkkkkkk.',
  '.kgyyygk.',
  'kkgyyygkk',
  'kgggyyggk',
  '.kgggggk.',
  '..kgggk..',
  '...kkk...',
], { k: C.ink, g: C.gold, y: C.goldLight }));

/**
 * The first-run intro's spotlight (ft_1_31.AC2, AC3): an overlay (d070) on the paused room or practice screen. All of the
 * screen is darkened but the one thing Kiur shows, which is framed in gold with an arrow pointing at it; Kiur stands on
 * the side away from it, his wing pointing its way, and says his line over the dark as the conversations do. A press, Space
 * or Enter turns the page or goes to the next thing; after the last the overlay closes with `read`. The skip button in a
 * free corner closes it with `skip`, the whole intro skipped; Esc closes it with `cancelled`, which the room and the map
 * take as skipping the intro and the practice screen as skipping Kiur's tour there. Placement is `core/layout/spotlight.ts`.
 */
export class IntroScene extends PixelScene {
  protected override framed = false;
  private steps: readonly IntroShow[] = [];
  private skippable = true;
  private step = 0;
  private page = 0;
  private flown = false;
  private opening = 0;
  private moving: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('intro');
  }

  init(data: IntroData): void {
    this.steps = data.steps ?? [];
    this.skippable = data.skippable ?? true;
    this.step = 0;
    this.page = 0;
    this.flown = false;
    this.opening = ++openings;
  }

  override create(): void {
    this.scene.bringToTop();
    this.events.once('shutdown', () => settleOverlay('intro', CANCELLED, this));
    this.onWindowKey((e) => {
      if (e.key === 'Escape') this.close(CANCELLED);
      else if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) this.press(); }
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    });
    super.create();
    // nothing to show: closed at once, as read
    if (this.steps.length === 0) this.time.delayedCall(0, () => this.close('read'));
  }

  /**
   * What shows now, for the tests: which opening of the spotlight it is (so a test tells one run of Kiur's steps from the
   * next, opened at once after it), the step, its page and its words; null once over.
   */
  get showing(): { opening: number; step: number; page: number; text: string; spot: Rect | null } | null {
    const s = this.steps[this.step];
    return s ? { opening: this.opening, step: this.step, page: this.page, text: s.text, spot: s.spot } : null;
  }

  /** The next page of the line, or the next thing; after the last, the overlay closes. */
  press(): void {
    const s = this.steps[this.step];
    if (!s) return;
    if (this.page + 1 < spokenPages(s.text).length) this.page += 1;
    else {
      this.step += 1;
      this.page = 0;
    }
    if (this.step >= this.steps.length) return this.close('read');
    this.redraw();
  }

  private close(result: OverlayOutcome<'intro'>): void {
    closeOverlay(this, 'intro', result);
  }

  protected draw(): void {
    const s = this.steps[this.step];
    if (!s) return;
    const { width, scale } = this.px;
    const top = this.mainTopRows;
    const screen = { w: width, h: Math.floor(this.scale.height / scale) };
    const words = spokenLine(spokenPages(s.text)[this.page] ?? [], talkColour('kiur'));
    const skipLabel = t('intro.skip');
    const skip = { w: measure(drawnText(skipLabel)) + SKIP_PAD, h: BAR_BUTTON_HEIGHT };
    const plan = spotlightLayout({ screen, spot: s.spot, kiur: { w: KIUR_DOOR.width, h: KIUR_DOOR.height }, line: { w: words.width, h: words.height }, ...(this.skippable ? { skip } : {}) });
    // everything is placed on the whole screen; the root starts under the toolbar's rows
    const at = (y: number) => y - top;
    // a press anywhere turns the page: the screen under it takes none while the overlay is up
    const catcher = this.add.zone(0, at(0), screen.w, screen.h).setOrigin(0).setInteractive();
    catcher.on('pointerup', () => this.press());
    this.root.add(catcher);
    for (const shade of plan.shades) this.root.add(this.add.rectangle(shade.x, at(shade.y), shade.w, shade.h, PALETTE[C.duskDeep], DIM_ALPHA).setOrigin(0, 0));
    if (plan.light) {
      const l = plan.light;
      const frame = this.add.rectangle(l.x, at(l.y), l.w, l.h).setOrigin(0, 0).setStrokeStyle(1, PALETTE[C.gold]).setName('introLight');
      this.root.add(frame);
    }
    if (plan.arrow) {
      const art = plan.arrow.points === 'down' ? ARROW_DOWN : flipY(ARROW_DOWN);
      const arrow = new PixelImage(this, plan.arrow.x, at(plan.arrow.y), art).setName('introArrow');
      this.root.add(arrow);
      if (motionAllowed()) {
        this.moving.push(arrow);
        this.tweens.add({ targets: arrow, y: arrow.y + (plan.arrow.points === 'down' ? BOB.rows : -BOB.rows), duration: BOB.ms, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    }
    const kiur = new PixelImage(this, plan.kiur.x, at(plan.kiur.y), plan.kiur.facing === 'right' ? KIUR_DOOR : flipX(KIUR_DOOR)).setName('introKiur');
    this.root.add(kiur);
    if (!this.flown) {
      this.flown = true;
      if (motionAllowed()) {
        this.moving.push(kiur);
        const y = kiur.y;
        kiur.y = -KIUR_DOOR.height - top;
        this.tweens.add({ targets: kiur, y, duration: FLY_MS, ease: 'Back.Out' });
      }
    }
    this.root.add(new PixelImage(this, plan.line.x, at(plan.line.y), words).setName('introLine'));
    // a way out at every step: the rest of the intro is skipped, kept as done
    if (plan.skip) this.button({ x: plan.skip.x + skip.w / 2, y: at(plan.skip.y) + skip.h / 2, width: skip.w, height: skip.h, label: skipLabel, onClick: () => this.close('skip') });
  }

  protected override clear(): void {
    this.moving.forEach((o) => this.tweens.killTweensOf(o));
    this.moving = [];
  }
}

