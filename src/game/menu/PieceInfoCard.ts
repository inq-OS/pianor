import type Phaser from 'phaser';
import { pieceTitle } from '../../core/text/pieceTitle';
import { tempoLabel } from '../../core/chart/tempoLabel';
import { COMPLEXITY_STARS } from '../../core/properties/complexity';
import { pieceInfo } from '../../core/properties/info';
import { t } from '../../core/text/strings';
import type { Piece } from '../content';
import { createBitmap } from '../ui/pixel/bitmap';
import { LINE_HEIGHT } from '../ui/pixel/font';
import { panelBitmap } from '../ui/pixel/frames';
import { C } from '../ui/pixel/palette';
import { PixelButton, PixelImage, PixelText, pixelStars } from '../ui/pixel/PixelObjects';
import { pieceStyles } from './pieceStyles';

/** What the card needs from the scene it is drawn in. */
export interface InfoCardHost {
  scene: Phaser.Scene;
  /** The scene's root container, in art pixels. */
  root: Phaser.GameObjects.Container;
  /** The screen in art pixels. */
  width: number;
  height: number;
  /** Close the card (the scene draws again without it). */
  close(): void;
}

const PAD = 8;
const MARGIN = 6;
const CLOSE = { width: 56, height: 16 };

/** A dither of ink (one pixel in four) over the screen: the menu behind looks dimmed, and a tap on it closes the card. */
function dither(width: number, height: number) {
  const bitmap = createBitmap(width, height);
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) bitmap.pixels[y * width + x] = C.ink;
  return bitmap;
}

/**
 * The info card of one piece, over the whole menu: its title, how hard it is (stars), its styles and what the chart
 * says about it (`pieceInfo`). A tap anywhere outside the card, or on Close, closes it. Drawn in art pixels like the rest.
 * Returns the Close button, which the scene must destroy when it draws again (`own`).
 */
export function drawPieceInfo(host: InfoCardHost, piece: Piece): PixelButton {
  const { scene, root, width, height } = host;
  const info = pieceInfo(piece, pieceStyles);
  const panelWidth = Math.min(width - 2 * MARGIN, 280);
  const left = Math.floor((width - panelWidth) / 2);
  const x = left + PAD;
  const inner = panelWidth - 2 * PAD;

  const backdrop = new PixelImage(scene, 0, 0, dither(width, height));
  backdrop.setInteractive();
  backdrop.on('pointerup', () => host.close());
  const panel = new PixelImage(scene, left, 0, panelBitmap(panelWidth, 20, 'bubble'));
  panel.setInteractive(); // a tap on the card itself must not reach the backdrop
  root.add([backdrop, panel]);

  // Everything is laid out from y = 0 and moved down once the card's height is known.
  const placed: { y: number }[] = [];
  const text = (px: number, y: number, value: string, color: number, maxWidth: number) => {
    const object = new PixelText(scene, px, y, value, { color, maxWidth });
    root.add(object);
    placed.push(object);
    return object;
  };

  let y = PAD;
  y += text(x, y, pieceTitle(piece.chart), C.ink, inner).height + 5;
  if (info.complexity !== null) {
    // "How hard: Beginner" and the grade's five stars, filled in part (d157)
    const label = text(x, y, t('info.difficulty', { grade: t(`grade.${info.complexity.grade}`) }), C.panelDark, inner);
    const stars = pixelStars(scene, root, x + label.width + 6, y - 1, info.complexity.stars, { total: COMPLEXITY_STARS });
    placed.push(...stars);
    y += 12;
  }
  y += text(x, y, t('info.tempo', { tempo: tempoLabel(info.bpm) }), C.panelDark, inner).height + 5;
  if (info.styles.length > 0) {
    const styles = info.styles.map((key) => t(key)).join(', ');
    y += text(x, y, t('info.styles', { styles }), C.panelDark, inner).height + 5;
  }
  if (info.features.length > 0) {
    y += text(x, y, t('info.features'), C.brownDark, inner).height + 3;
    // one column; two when one would not leave room for the Close button on a small screen
    const room = height - 2 * MARGIN - y - CLOSE.height - PAD - 4;
    const columns = info.features.length * LINE_HEIGHT > room ? 2 : 1;
    const columnWidth = Math.floor(inner / columns);
    const rows = Math.ceil(info.features.length / columns);
    for (let row = 0; row < rows; row++) {
      let rowHeight = 0;
      for (let column = 0; column < columns; column++) {
        const feature = info.features[row * columns + column];
        if (feature === undefined) continue;
        rowHeight = Math.max(rowHeight, text(x + column * columnWidth, y, `- ${t(`feature.${feature}`)}`, C.ink, columnWidth - 4).height + 2);
      }
      y += rowHeight;
    }
  }
  y += 4;

  const panelHeight = y + CLOSE.height + PAD;
  const top = Math.max(MARGIN, Math.floor((height - panelHeight) / 2));
  panel.setBitmap(panelBitmap(panelWidth, panelHeight, 'bubble'));
  panel.y = top;
  panel.removeInteractive().setInteractive(); // the hit area follows the new size
  for (const object of placed) object.y += top;
  return new PixelButton(scene, root, {
    x: left + panelWidth / 2, y: top + y + CLOSE.height / 2, width: CLOSE.width, height: CLOSE.height, label: t('info.close'), onClick: () => host.close(),
  });
}
