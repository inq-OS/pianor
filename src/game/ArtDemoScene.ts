import { t } from '../core/text/strings';
import { ART_DETAIL } from '../core/layout/frame';
import type { Bitmap } from './ui/pixel/bitmap';
import { KIUR_FLIGHT, KIUR_PERCHED, KIUR_TURN, kiurAsleep } from './ui/pixel/kiur/kiurFrames';
import { KIUR_DOOR, MASCOT, LOCK, SPARKLE, STAR_EMPTY, STAR_FULL } from './ui/pixel/sprites';
import { C } from './ui/pixel/palette';
import { PixelBar, PixelImage, PixelText, Mascot, pixelStars } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';

/** Dev-only scene (`?demo=art`): the pixel font, Kiur in every pose, the icons, buttons and bars at the zoom this screen gets. */
export class ArtDemoScene extends PixelScene {
  constructor() {
    super('art-demo');
  }

  protected draw(): void {
    const { width, height, scale } = this.px;
    this.sky();
    const text = (x: number, y: number, value: string, color: number = C.white, extra: { maxWidth?: number; big?: boolean } = {}) => {
      const label = new PixelText(this, x, y, value, { color, shadow: C.ink, ...(extra.maxWidth ? { maxWidth: extra.maxWidth } : {}) });
      if (extra.big) label.setScale(2);
      this.root.add(label);
      return label;
    };

    text(8, 6, 'Pixel art kit', C.gold, { big: true });
    text(8, 26, `zoom ${scale}x, ${width} x ${height} art pixels`, C.dim);
    text(8, 38, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    text(8, 49, 'abcdefghijklmnopqrstuvwxyz');
    text(8, 62, '0123456789 .,:;!?\'"-+=/()%<>');
    text(8, 75, t('results.newBest'), C.cream, { maxWidth: 190 });
    text(8, 99, 'Right note name, but too high. Try the same note lower down.', C.cream, { maxWidth: 190 });

    // Kiur (d114), all on the fine grid: his moods, the mascot object bobbing, then the same bird from every side, at rest and flying
    const kiur = (x: number, y: number, bitmap: Bitmap, name = ''): void => {
      this.fineImage(x * ART_DETAIL, y * ART_DETAIL, bitmap);
      if (name) text(x + 2, y + bitmap.height / ART_DETAIL, name, C.dim);
    };
    for (const [i, mood] of (['idle', 'cheer', 'hmm'] as const).entries()) kiur(204 + i * 32, 2, MASCOT[mood], mood);
    this.own(new Mascot(this, this.root, 296, 2));
    for (const [i, frame] of KIUR_TURN.entries()) kiur(204 + i * 23, 32, frame, i === 0 ? 'front to back' : '');
    kiur(204, 62, KIUR_PERCHED, 'sits');
    kiur(232, 62, kiurAsleep()[0], 'sleep');
    kiur(264, 62, KIUR_DOOR, 'points');
    for (const [i, wings] of ['up', 'level', 'down'].entries()) kiur(204 + i * 36, 92, KIUR_FLIGHT[i]!, wings);

    pixelStars(this, this.root, 8, 130, 2);
    pixelStars(this, this.root, 50, 130, 3);
    pixelStars(this, this.root, 92, 130, 0);
    this.root.add(new PixelImage(this, 140, 130, LOCK));
    this.root.add(new PixelImage(this, 156, 130, SPARKLE));
    this.root.add(new PixelImage(this, 166, 130, STAR_FULL));
    this.root.add(new PixelImage(this, 180, 130, STAR_EMPTY));
    this.root.add(new PixelBar(this, 8, 146, 120, 9, 0.6));
    this.root.add(new PixelBar(this, 8, 158, 120, 9, 1));
    this.root.add(new PixelBar(this, 8, 170, 120, 9, 0.02));

    this.button({ x: 190, y: 160, width: 70, height: 20, label: 'Play', onClick: () => undefined });
    this.button({ x: 270, y: 160, width: 70, height: 20, label: 'Locked', sublabel: 'Reach level 3', disabled: true, onClick: () => undefined });
    this.button({ x: 190, y: 184, width: 150, height: 22, label: 'Hot Cross Buns', sublabel: 'Right hand', look: 'card', onClick: () => undefined });
    this.button({ x: 270, y: 135, width: 60, height: 18, label: 'Names', onClick: () => undefined }).setActive(true);
  }
}
