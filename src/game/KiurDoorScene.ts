import { t } from '../core/text/strings';
import { createBitmap, type Bitmap } from './ui/pixel/bitmap';
import { ART_DETAIL } from '../core/layout/frame';
import { DOOR_PALETTE, paintDoor, paintPageCorner } from './ui/pixel/paint/door';
import { paintedOnce } from './ui/pixel/paintedOnce';
import { C, PALETTE } from './ui/pixel/palette';
import { PixelImage } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import { KIUR_DOOR } from './ui/pixel/sprites';
import { CANCELLED, closeOverlay, settleOverlay, type OverlayOutcome } from './scenes';

/** Kiur's size on the overlay (art pixels for each fine pixel of his picture: twice his size beside the staff), and how long the flight in takes. */
const KIUR_ZOOM = 1;
const FLY_MS = 450;
/** The door he points at and the turned-up page corner that leads back to the piece, in cells. */
const DOOR = { width: 30, height: 48 } as const;
const PAGE = { width: 28, height: 25 } as const;
/** How dark the paused screen under the overlay gets; its shade is the room's blue-violet dusk, never grey (art-direction rule 26). */
const DIM_ALPHA = 0.7;

/**
 * Kiur at the door (ft_1_15): an overlay on the paused practice screen after key bashing (d070). Kiur flies in, stands
 * firm and points a wing at the door. Two pictures and no words: the corner of a page of music turned up, back to the
 * piece (left), or the door ajar, out (right, where the wing points; a real door, not a button). Esc is back to the piece too. The overlay only returns the choice; the practice screen acts on it.
 */
export class KiurDoorScene extends PixelScene {
  protected override framed = false;
  protected override keyboardNavigation = true;
  private kiur: PixelImage | null = null;
  /** The flight in runs once per opening, not again when the window changes size. */
  private flown = false;

  constructor() {
    super('kiurDoor');
  }

  init(): void {
    this.flown = false;
  }

  override create(): void {
    this.scene.bringToTop();
    this.events.once('shutdown', () => settleOverlay('kiurDoor', CANCELLED, this));
    super.create();
  }

  protected override back(): void {
    this.close(CANCELLED);
  }

  private close(result: OverlayOutcome<'kiurDoor'>): void {
    closeOverlay(this, 'kiurDoor', result);
  }

  protected draw(): void {
    const { width, height, scale } = this.px;
    // the paused screen stays visible, in shade, toolbar included
    const dim = this.add.rectangle(0, -this.mainTop / scale, width, height + this.mainTop / scale, PALETTE[C.duskDeep], DIM_ALPHA).setOrigin(0, 0);
    this.root.add(dim);

    const kiurW = KIUR_DOOR.width * KIUR_ZOOM;
    const kiurH = KIUR_DOOR.height * KIUR_ZOOM;
    const gap = 6;
    const rowW = PAGE.width + gap + kiurW + gap + DOOR.width;
    const left = Math.floor((width - rowW) / 2);
    const top = Math.floor((height - kiurH) / 2) + 4;
    const kiurX = left + PAGE.width + gap;
    // the page and the door stand on the line his feet are on; the door's middle is about where his wing points
    this.picture(left, top + kiurH - PAGE.height, PAGE, (open) => paintPageCorner(PAGE.width * ART_DETAIL, PAGE.height * ART_DETAIL, open), t('door.back'), () => this.close('back'));
    this.picture(kiurX + kiurW + gap, top + kiurH - DOOR.height, DOOR, (open) => paintDoor(DOOR.width * ART_DETAIL, DOOR.height * ART_DETAIL, open), t('door.leave'), () => this.close('door'));

    const kiur = new PixelImage(this, kiurX, top, KIUR_DOOR);
    kiur.setScale(KIUR_ZOOM);
    this.root.add(kiur);
    this.kiur = kiur;
    if (!this.flown) {
      this.flown = true;
      kiur.y = -kiurH - this.mainTop / scale;
      this.tweens.add({ targets: kiur, y: top, duration: FLY_MS, ease: 'Back.Out' });
    }
  }

  /** A painted picture that is a button: shown at rest, `open` under the pointer; the button over it is see-through. */
  private picture(x: number, y: number, size: { width: number; height: number }, paint: (open: boolean) => Bitmap, label: string, onClick: () => void): void {
    const key = (open: boolean) => `kiurDoor:${label}:${size.width}x${size.height}:${open}`;
    const rest = paintedOnce(key(false), () => paint(false));
    const image = this.fineImage(x * ART_DETAIL, y * ART_DETAIL, rest, DOOR_PALETTE);
    this.button({
      x: x + size.width / 2, y: y + size.height / 2, ...size, label, picture: createBitmap(size.width, size.height), onClick,
      onHover: (over) => image.setBitmap(over ? paintedOnce(key(true), () => paint(true)) : rest, DOOR_PALETTE),
    });
  }

  protected override clear(): void {
    if (this.kiur) this.tweens.killTweensOf(this.kiur);
    this.kiur = null;
  }
}
