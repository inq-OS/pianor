// Covers ft_Y_04.AC16 (the photo behind the piece maker's staff).
import { describe, expect, it } from 'vitest';
import type { StaffLayout } from '../layout/staffTypes';
import { photoBarCount, photoPatches, type PhotoLayout } from './photoOverlay';

/** A piece maker staff of two lines (systems) of two bars each, grand staff, staff space 5: only what the patches read. */
function staff(pages: [number, number] = [0, 0]): StaffLayout {
  const system = (index: number, y: number) => ({
    index, page: pages[index] ?? 0, firstBar: index * 2, barCount: 2, topLineY: y, bottomLineY: y + 60, cursorTipY: 0, left: 0, right: 200,
    staves: [
      { index: 0, trackId: 'rh', clef: 'treble' as const, topLineY: y, bottomLineY: y + 20, arrow: { tipY: 0, direction: 'down' as const } },
      { index: 1, trackId: 'lh', clef: 'bass' as const, topLineY: y + 40, bottomLineY: y + 60, arrow: { tipY: 0, direction: 'up' as const } },
    ],
  });
  const bar = (index: number) => ({ index, system: Math.floor(index / 2), x: 10 + (index % 2) * 100, width: 100, rooms: [], roomTotal: 0 });
  return { systems: [system(0, 20), system(1, 120)], bars: [bar(0), bar(1), bar(2), bar(3)] } as unknown as StaffLayout;
}

/** A photo of one system, two staves (space 10), three bars. */
const photo: PhotoLayout = { width: 900, height: 400, systems: [{ staves: [{ top: 100, bottom: 140 }, { top: 220, bottom: 260 }], bars: [{ x1: 50, x2: 300 }, { x1: 300, x2: 600 }, { x1: 600, x2: 850 }] }] };

describe('the photo behind the staff (ft_Y_04.AC16)', () => {
  it('ft_Y_04.AC16 fits each photo bar to its bar and each photo staff to its staff, up to halfway to the other staff', () => {
    const patches = photoPatches(staff(), photo, { page: 0, shift: 0 });
    // three photo bars for four bars: the fourth has none; two staves each
    expect(patches).toHaveLength(6);
    const [rh, lh] = patches;
    // the right hand: from four spaces above its top line to halfway to the bass staff, half size (space 10 to 5)
    expect(rh).toEqual({ sx: 50, sy: 60, sw: 250, sh: 120, dx: 10, dy: 0, dw: 100, dh: 60 });
    // the left hand: from halfway to the treble staff to four spaces below its bottom line
    expect(lh).toEqual({ sx: 50, sy: 180, sw: 250, sh: 120, dx: 10, dy: 20 + 40 - 20, dw: 100, dh: 60 });
    expect(patches[4]).toMatchObject({ sx: 600, dx: 10, dy: 120 - 20 });
    expect(photoBarCount(photo)).toBe(3);
  });

  it('ft_Y_04.AC16 a shift moves the photo a bar against the piece; only the page shown gets patches', () => {
    expect(photoPatches(staff(), photo, { page: 0, shift: 1 }).map((p) => p.sx)).toEqual([300, 300, 600, 600]);
    expect(photoPatches(staff(), photo, { page: 0, shift: -1 }).map((p) => [p.sx, p.dx])).toEqual([[50, 110], [50, 110], [300, 10], [300, 10], [600, 110], [600, 110]]);
    expect(photoPatches(staff([0, 1]), photo, { page: 1, shift: 0 }).map((p) => p.sx)).toEqual([600, 600]);
  });

  it('ft_Y_04.AC16 a photo of one staff (a piece for one hand) goes on the staff of that hand, clipped to the picture', () => {
    const single: PhotoLayout = { width: 900, height: 150, systems: [{ staves: [{ top: 20, bottom: 60 }], bars: [{ x1: 0, x2: 400 }] }] };
    const lh = photoPatches(staff(), single, { page: 0, shift: 0, hand: 'LH' });
    expect(lh).toEqual([{ sx: 0, sy: 0, sw: 400, sh: 100, dx: 10, dy: 60 - 10, dw: 100, dh: 50 }]);
    expect(photoPatches(staff(), single, { page: 0, shift: 0 })[0]?.dy).toBe(20 - 10);
    // a staff of no height on the photo gives nothing
    const flat: PhotoLayout = { width: 900, height: 150, systems: [{ staves: [{ top: 20, bottom: 20 }], bars: [{ x1: 0, x2: 400 }] }] };
    expect(photoPatches(staff(), flat, { page: 0, shift: 0 })).toEqual([]);
  });
});
