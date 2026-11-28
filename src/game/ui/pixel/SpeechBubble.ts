import type Phaser from 'phaser';
import { LINE_GAP, LINE_HEIGHT, wrap } from './font';
import { panelBitmap } from './frames';
import { C } from './palette';
import { PixelImage, PixelText } from './PixelObjects';
import { createBitmap, recolor, type Bitmap } from './bitmap';
import { CAP_HEIGHT } from './font';

/** The text sits this far in from the bubble's left and top edge (and as far from its right edge). */
const PAD_X = 5;
const PAD_Y = 2;
/** The bubble's frame adds this to the height of its lines of text. */
const FRAME_EXTRA = 4;
/** Height of the empty bubble before the first message (one line). */
const ONE_LINE_HEIGHT = 15;
/** Between an icon and the message after it. */
const ICON_GAP = 2;

export interface BubbleSpot {
  x: number;
  y: number;
  width: number;
}

/**
 * Kiur's speech bubble on the play screens: as wide as its spot, as tall as its text, hidden while the
 * message is empty. Art pixels.
 */
export class SpeechBubble {
  readonly image: PixelImage;
  readonly text: PixelText;
  /** An icon before the message (the click's metronome, d312), in ink; hidden with none. */
  readonly icon: PixelImage;

  constructor(scene: Phaser.Scene, root: Phaser.GameObjects.Container, private readonly spot: BubbleSpot, message: string) {
    this.image = new PixelImage(scene, spot.x, spot.y, panelBitmap(spot.width, ONE_LINE_HEIGHT, 'bubble'));
    this.text = new PixelText(scene, spot.x + PAD_X, spot.y + PAD_Y, message, { color: C.ink, maxWidth: spot.width - 2 * PAD_X });
    this.icon = new PixelImage(scene, spot.x + PAD_X, spot.y + PAD_Y, createBitmap(1, 1)).setVisible(false);
    root.add([this.image, this.text, this.icon]);
  }

  /**
   * Show `message` (an empty one, with no icon, hides the bubble) after `icon`, when given, and return how many lines it
   * took. The icon's white is drawn in ink, as the letters are.
   */
  show(message: string, icon?: Bitmap): number {
    const { x, y, width } = this.spot;
    const iconW = icon ? icon.width + ICON_GAP : 0;
    const lines = message === '' ? (icon ? 1 : 0) : wrap(message, width - 2 * PAD_X - iconW).length;
    this.text.setText(message);
    this.text.setVisible(lines > 0);
    this.image.setVisible(lines > 0);
    if (lines > 0) this.image.setBitmap(panelBitmap(width, lines * LINE_HEIGHT - LINE_GAP + FRAME_EXTRA, 'bubble'));
    this.icon.setVisible(icon !== undefined);
    if (icon) {
      this.icon.setBitmap(recolor(icon, { [C.white]: C.ink }));
      this.icon.setPosition(x + PAD_X, y + PAD_Y + Math.round(CAP_HEIGHT / 2 - icon.height / 2));
    }
    this.text.x = x + PAD_X + iconW;
    this.text.y = y + PAD_Y;
    return lines;
  }
}
