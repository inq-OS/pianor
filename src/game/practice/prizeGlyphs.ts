import type Phaser from 'phaser';
import type { PrizeColumn, PrizeGlyph } from '../../core/layout/learnPrizes';
import { PRIZE } from '../../core/layout/learnPrizes';
import { STAFF_INK } from '../../core/layout/scoreColour';
import type { Medal } from '../../core/learn/progress';
import { C, PALETTE } from '../ui/pixel/palette';
import { TREBLE_CLEF_STROKE } from '../ui/staff/glyphs';

/**
 * Draws the prizes of learning a piece on the staff (ft_1_32.AC19, d287) from `prizeColumn`: notes and a clef at the staff's
 * resolution. An earned one is solid in its medal, a dark rim round it and a shine on it, so gold, silver and bronze read
 * apart from the bench; one still to earn is only a faint outline, empty inside; the one the run is for has a soft box
 * behind it.
 */

/** A medal's fill, its rim and the shine on it. */
const MEDAL_INK: Record<Medal, { fill: number; edge: number; shine: number }> = {
  gold: { fill: PALETTE[C.gold]!, edge: PALETTE[C.goldDark]!, shine: PALETTE[C.goldLight]! },
  silver: { fill: PALETTE[C.silver]!, edge: PALETTE[C.silverDark]!, shine: PALETTE[C.white]! },
  bronze: { fill: PALETTE[C.orangeDark]!, edge: PALETTE[C.brownDark]!, shine: PALETTE[C.orange]! },
};
/** A placeholder's outline, and a lit one's (the prize the run is for). */
const PLACEHOLDER_ALPHA = 0.3;
const LIT_ALPHA = 0.55;
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
    const alpha = p.lit ? LIT_ALPHA : PLACEHOLDER_ALPHA;
    if (p.kind === 'clef') {
      // lifted off the column while it grows on its way to the book (ft_1_32.AC22)
      if (!options.withoutClef) clef(g, p, S, ink, alpha);
      continue;
    }
    const whole = p.kind === 'whole';
    const rx = S * (whole ? PRIZE.wholeRx : PRIZE.quarterRx);
    const ry = S * PRIZE.headRy;
    const hollow = p.kind !== 'quarter';
    if (!ink) {
      // still to earn: an outline only, empty inside (a hollow note's own hole stays as its outline shows it)
      g.lineStyle(S * 0.12, STAFF_INK, alpha).strokeEllipse(p.x, p.y, rx * 2 - S * 0.12, ry * 2 - S * 0.12);
    } else if (hollow) {
      // a ring of the medal between a dark rim inside and out
      const w = rx * 2 - S * 0.45, h = ry * 2 - S * 0.4;
      g.lineStyle(S * 0.45, ink.edge, 1).strokeEllipse(p.x, p.y, w, h);
      g.lineStyle(S * 0.25, ink.fill, 1).strokeEllipse(p.x, p.y, w, h);
      g.fillStyle(ink.shine, 1).fillEllipse(p.x - rx * 0.45, p.y - ry * 0.62, S * 0.32, S * 0.18);
    } else {
      g.fillStyle(ink.fill, 1).fillEllipse(p.x, p.y, rx * 2, ry * 2);
      g.lineStyle(S * 0.16, ink.edge, 1).strokeEllipse(p.x, p.y, rx * 2, ry * 2);
      g.fillStyle(ink.shine, 1).fillEllipse(p.x - rx * 0.35, p.y - ry * 0.35, rx * 0.6, ry * 0.45);
    }
    const line = ink?.edge ?? STAFF_INK;
    const lineAlpha = ink ? 1 : alpha;
    // the quarters share one stem (below); a half note of a short chunk has its own
    if (p.kind === 'half' || p.kind === 'dotted-half') g.lineStyle(S * 0.16, line, lineAlpha).lineBetween(p.x + rx - S * 0.08, p.y, p.x + rx - S * 0.08, p.y - 3.2 * S);
    if (p.kind === 'dotted-half') g.fillStyle(line, lineAlpha).fillCircle(p.x + rx + S * 0.45, p.y - S * 0.1, S * 0.18);
  }
  if (stem) g.lineStyle(S * 0.16, STAFF_INK, stem.earned ? 1 : PLACEHOLDER_ALPHA).lineBetween(stem.x, stem.y1, stem.x, stem.y2);
  return g;
}

/**
 * A clef in `medal` (a faint placeholder with none) drawn about its centre at `centre`, for a staff of `staffSpace`, so it
 * can grow or move there: the learned piece's clef on its way to the book (ft_1_32.AC22).
 */
export function drawMedalClef(scene: Phaser.Scene, medal: Medal | null, centre: { x: number; y: number }, staffSpace: number): Phaser.GameObjects.Graphics {
  const S = staffSpace;
  const g = scene.add.graphics().setPosition(centre.x, centre.y);
  const w = PRIZE.clefBox.w * PRIZE.clefScale * S;
  const h = PRIZE.clefBox.h * PRIZE.clefScale * S;
  clef(g, { x: -w / 2, y: -h / 2 }, S, medal ? MEDAL_INK[medal] : null, PLACEHOLDER_ALPHA);
  return g;
}

/** The staff space a clef of `drawMedalClef` takes to be `height` tall. */
export function clefSpaceFor(height: number): number {
  return height / (PRIZE.clefBox.h * PRIZE.clefScale);
}

/** The treble clef at `PRIZE.clefScale`: earned, its rim, its medal along the middle of the stroke and a shine; else a faint thin line. */
function clef(g: Phaser.GameObjects.Graphics, p: Pick<PrizeGlyph, 'x' | 'y'>, S: number, ink: (typeof MEDAL_INK)[Medal] | null, alpha: number): void {
  const k = S * PRIZE.clefScale;
  const path = (width: number, colour: number, a: number, points = TREBLE_CLEF_STROKE) => {
    g.lineStyle(width, colour, a).beginPath();
    points.forEach((pt, i) => (i === 0 ? g.moveTo(p.x + pt.x * k, p.y + pt.y * k) : g.lineTo(p.x + pt.x * k, p.y + pt.y * k)));
    g.strokePath();
  };
  if (!ink) {
    path(S * 0.14, STAFF_INK, alpha);
    return;
  }
  path(S * 0.5, ink.edge, 1);
  path(S * 0.26, ink.fill, 1);
  // the shine along the clef's first stretch, its top curl
  path(S * 0.1, ink.shine, 1, TREBLE_CLEF_STROKE.slice(0, Math.ceil(TREBLE_CLEF_STROKE.length / 4)));
}
