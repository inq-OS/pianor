// Covers core_09.AC5: each accidental's shape sits inside the box the layout reserves for it.
import { describe, expect, it } from 'vitest';
import { ACCIDENTAL_BOX, type AccidentalKind } from '../../../core/layout/staff';
import { ACCIDENTAL_STROKES } from './glyphs';

describe('accidental shapes (core_09.AC5)', () => {
  for (const kind of Object.keys(ACCIDENTAL_BOX) as AccidentalKind[]) {
    it(`draws the ${kind} inside its layout box, a stroke's half thickness allowed (core_09.AC5)`, () => {
      const box = ACCIDENTAL_BOX[kind];
      const edge = 0.1;
      for (const stroke of ACCIDENTAL_STROKES[kind]) {
        for (const p of stroke.points) {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(box.width / 2 + edge);
          expect(p.y).toBeGreaterThanOrEqual(-box.up - edge);
          expect(p.y).toBeLessThanOrEqual(box.down + edge);
        }
      }
    });
  }
});
