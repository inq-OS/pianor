// Covers ft_1_28.AC3 (the piece's key is marked by a shape as well as a colour).
import { describe, expect, it } from 'vitest';
import { circleLayout } from '../../../core/layout/circleOfFifths';
import { paintWheel } from './circleArt';
import { C } from './palette';

const layout = circleLayout({ cx: 80, cy: 80, radius: 66 }, 'B');
const none = { selected: null, marked: null };
const at = (b: ReturnType<typeof paintWheel>, x: number, y: number) => b.pixels[y * b.width + x]!;
const count = (b: ReturnType<typeof paintWheel>, colour: number) => b.pixels.filter((p) => p === colour).length;

describe('the circle of fifths as a ship\'s helm (ft_1_28, the painter)', () => {
  it('is square with the circle\'s middle at its middle, brass in the hub and the handles past the rim', () => {
    const wheel = paintWheel(layout, none);
    expect(wheel.width).toBe(wheel.height);
    const mid = (wheel.width - 1) / 2;
    expect([C.gold, C.goldLight, C.goldDark, C.white]).toContain(at(wheel, mid, mid));
    // C is at the top; the spoke between C and G stands 15 degrees clockwise from straight up, with a handle past the rim
    const handleTip = Math.round(mid - (layout.radii.edge + 3) * Math.cos(Math.PI / 12));
    const handleX = Math.round(mid + (layout.radii.edge + 3) * Math.sin(Math.PI / 12));
    expect(at(wheel, handleX, handleTip)).not.toBe(C.clear);
    // nothing in the corners
    expect(at(wheel, 0, 0)).toBe(C.clear);
  });

  it('paints the names\' rings on paper: cream for the majors, a pale buff for the minors', () => {
    const wheel = paintWheel(layout, none);
    const mid = (wheel.width - 1) / 2;
    const { minor, major, hub } = layout.radii;
    expect(at(wheel, mid, Math.round(mid - (minor + major) / 2))).toBe(C.cream);
    expect(at(wheel, mid, Math.round(mid - (hub + minor) / 2))).toBe(C.buffLight);
  });

  it('gilds the chosen cell, and only it', () => {
    const plain = paintWheel(layout, none);
    const chosen = paintWheel(layout, { selected: { step: 2, ring: 'minor' }, marked: null });
    expect(count(chosen, C.gold)).toBeGreaterThan(count(plain, C.gold) + 40);
  });

  it('ties a red rag on the rim at the piece\'s key (a shape past the rim, not a colour alone), and none without a key', () => {
    const plain = paintWheel(layout, none);
    expect(count(plain, C.red) + count(plain, C.redDark)).toBe(0);
    const marked = paintWheel(layout, { selected: null, marked: 3 });
    expect(count(marked, C.red) + count(marked, C.redDark)).toBeGreaterThan(20);
    // the rag stands at three o'clock for step 3 (A major): right of the rim, level with the middle
    const mid = (marked.width - 1) / 2;
    const tail = Math.round(mid + layout.radii.edge + 6);
    const column = Array.from({ length: 9 }, (_, k) => at(marked, tail, mid - 4 + k));
    expect(column.some((p) => p === C.red || p === C.redDark || p === C.redLight)).toBe(true);
  });
});
