import type Phaser from 'phaser';
import { LINE_GAP, LINE_HEIGHT, wrap } from './font';
import { panelBitmap } from './frames';
import { C } from './palette';
import { PixelImage, PixelText } from './PixelObjects';

/** The text sits this far in from the bubble's left and top edge (and as far from its right edge). */
const PAD_X = 5;
const PAD_Y = 2;
/** The bubble's frame adds this to the height of its lines of text. */
const FRAME_EXTRA = 4;
/** Height of the empty bubble before the first message (one line). */
const ONE_LINE_HEIGHT = 15;

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

  constructor(scene: Phaser.Scene, root: Phaser.GameObjects.Container, private readonly spot: BubbleSpot, message: string) {
    this.image = new PixelImage(scene, spot.x, spot.y, panelBitmap(spot.width, ONE_LINE_HEIGHT, 'bubble'));
    this.text = new PixelText(scene, spot.x + PAD_X, spot.y + PAD_Y, message, { color: C.ink, maxWidth: spot.width - 2 * PAD_X });
    root.add([this.image, this.text]);
  }

  /** Show `message` (an empty one hides the bubble) and return how many lines it took. */
  show(message: string): number {
    const { x, y, width } = this.spot;
    const lines = message === '' ? 0 : wrap(message, width - 2 * PAD_X).length;
    this.text.setText(message);
    this.text.setVisible(lines > 0);
    this.image.setVisible(lines > 0);
    if (lines > 0) this.image.setBitmap(panelBitmap(width, lines * LINE_HEIGHT - LINE_GAP + FRAME_EXTRA, 'bubble'));
    this.text.x = x + PAD_X;
    this.text.y = y + PAD_Y;
    return lines;
  }
}
