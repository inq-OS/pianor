import type Phaser from 'phaser';
import type { PrizeColumn, PrizeGlyph } from '../../core/layout/learnPrizes';
import { PRIZE } from '../../core/layout/learnPrizes';
import { STAFF_INK } from '../../core/layout/scoreColour';
import type { Medal } from '../../core/learn/progress';
import { C, PALETTE } from '../ui/pixel/palette';
import { TREBLE_CLEF_STROKE } from '../ui/staff/glyphs';

/**
 * Draws the prizes of learning a piece on the staff (ft_1_32.AC19, d287) from `prizeColumn`: notes and a clef at the staff's
 * resolution, an earned one in its medal's colours, one still to earn a faint placeholder in ink, and the one the run is
 * for with a soft box behind it. AX-3 provisional: drawn by the builder (TODO(painter, R2) in ft_1_32).
 */

/** A medal's fill and outline. */
const MEDAL_INK: Record<Medal, { fill: number; edge: number }> = {
  gold: { fill: PALETTE[C.gold]!, edge: PALETTE[C.goldDark]! },
  silver: { fill: PALETTE[C.silver]!, edge: PALETTE[C.silverDark]! },
  bronze: { fill: PALETTE[C.orangeDark]!, edge: PALETTE[C.brownDark]! },
};
/** A placeholder's ink, and a lit one's (the prize the run is for). */
const PLACEHOLDER_ALPHA = 0.2;
const LIT_ALPHA = 0.38;
/** The soft box behind the lit prize: the staff cursor's box colour. */
const LIT_FILL = 0xeceff1;

export function drawPrizes(scene: Phaser.Scene, column: PrizeColumn, origin: { x: number; y: number }, staffSpace: number, options: { withoutClef?: boolean } = {}): Phaser.GameObjects.Graphics {
  const S = staffSpace;
  const { glyphs, stem } = column;
  const g = scene.add.graphics().setPosition(origin.x, origin.y);
  for (const p of glyphs) {
    if (p.lit) g.fillStyle(LIT_FILL, 1).fillRoundedRect(p.box.x, p.box.y, p.box.w, p.box.h, S * 0.4);
  }
  for (const p of glyphs) {
    const ink = p.medal ? MEDAL_INK[p.medal] : null;
    const alpha = ink ? 1 : p.lit ? LIT_ALPHA : PLACEHOLDER_ALPHA;
    const edge = ink?.edge ?? STAFF_INK;
    const fill = ink?.fill ?? STAFF_INK;
    if (p.kind === 'clef') {
      // lifted off the column while it grows on its way to the book (ft_1_32.AC22)
      if (!options.withoutClef) clef(g, p, S, edge, fill, alpha);
      continue;
    }
    const whole = p.kind === 'whole';
    const rx = S * (whole ? 0.78 : 0.62);
    const ry = S * 0.47;
    const hollow = p.kind !== 'quarter';
    if (hollow) {
      g.lineStyle(S * 0.3, edge, alpha).strokeEllipse(p.x, p.y, rx * 2 - S * 0.3, ry * 2 - S * 0.25);
      if (ink) g.lineStyle(S * 0.12, fill, 1).strokeEllipse(p.x, p.y, rx * 2 - S * 0.3, ry * 2 - S * 0.25);
    } else {
      g.fillStyle(fill, alpha).fillEllipse(p.x, p.y, rx * 2, ry * 2);
      if (ink) g.lineStyle(S * 0.1, edge, 1).strokeEllipse(p.x, p.y, rx * 2, ry * 2);
    }
    // the quarters share one stem (below); a half note of a short chunk has its own
    if (p.kind === 'half' || p.kind === 'dotted-half') g.lineStyle(S * 0.14, edge, alpha).lineBetween(p.x + rx - S * 0.07, p.y, p.x + rx - S * 0.07, p.y - 3.2 * S);
    if (p.kind === 'dotted-half') g.fillStyle(edge, alpha).fillCircle(p.x + rx + S * 0.45, p.y - S * 0.1, S * 0.16);
  }
  if (stem) g.lineStyle(S * 0.14, STAFF_INK, stem.earned ? 1 : PLACEHOLDER_ALPHA).lineBetween(stem.x, stem.y1, stem.x, stem.y2);
  return g;
}

/**
 * A clef in `medal` (a faint placeholder with none) drawn about its centre at `centre`, for a staff of `staffSpace`, so it
 * can grow or move there: the learned piece's clef on its way to the book (ft_1_32.AC22).
 */
export function drawMedalClef(scene: Phaser.Scene, medal: Medal | null, centre: { x: number; y: number }, staffSpace: number): Phaser.GameObjects.Graphics {
  const S = staffSpace;
  const ink = medal ? MEDAL_INK[medal] : null;
  const g = scene.add.graphics().setPosition(centre.x, centre.y);
  const w = PRIZE.clefBox.w * PRIZE.clefScale * S;
  const h = PRIZE.clefBox.h * PRIZE.clefScale * S;
  clef(g, { x: -w / 2, y: -h / 2 }, S, ink?.edge ?? STAFF_INK, ink?.fill ?? STAFF_INK, ink ? 1 : PLACEHOLDER_ALPHA);
  return g;
}

/** The staff space a clef of `drawMedalClef` takes to be `height` tall. */
export function clefSpaceFor(height: number): number {
  return height / (PRIZE.clefBox.h * PRIZE.clefScale);
}

/** The treble clef at `PRIZE.clefScale`: its outline, then its medal's colour along the middle of the stroke. */
function clef(g: Phaser.GameObjects.Graphics, p: Pick<PrizeGlyph, 'x' | 'y'>, S: number, edge: number, fill: number, alpha: number): void {
  const k = S * PRIZE.clefScale;
  const path = (width: number, colour: number, a: number) => {
    g.lineStyle(width, colour, a).beginPath();
    TREBLE_CLEF_STROKE.forEach((pt, i) => (i === 0 ? g.moveTo(p.x + pt.x * k, p.y + pt.y * k) : g.lineTo(p.x + pt.x * k, p.y + pt.y * k)));
    g.strokePath();
  };
  if (alpha < 1) {
    path(S * 0.22, edge, alpha);
    return;
  }
  path(S * 0.34, edge, 1);
  path(S * 0.16, fill, 1);
}
