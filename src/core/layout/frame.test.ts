// Covers d088 (the frame of every screen).
import { describe, expect, it } from 'vitest';
import { BAND_ROWS } from './band';
import { ART_CANVAS, ART_DETAIL, BAND_KEEPS_TOOLBAR, FRAME_MIN, FRAME_ROWS, fineToCells, frameCorners, TOOLBAR_ROWS, frameFits, frameView, toolbarLayout, type ToolbarInput, type ToolbarLayout } from './frame';
import { rectRight, type Rect } from './rect';

const PLAYER = { nameWidth: 40, rankWidth: 30, xpTextWidth: 50 };
const base: ToolbarInput = { width: 342, back: true, settings: true, keys: false, player: PLAYER, items: [] };

/** Every box the bar draws, left to right. */
function boxes(l: ToolbarLayout): Rect[] {
  const all: (Rect | null)[] = [l.back, l.name, l.rank, l.xpBar, l.xpText, ...l.items.map((i) => i.rect), l.settings, l.keys];
  return all.filter((r): r is Rect => r !== null).sort((a, b) => a.x - b.x);
}

function expectInsideAndApart(l: ToolbarLayout, width: number): void {
  const all = boxes(l);
  for (const r of all) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(rectRight(r)).toBeLessThanOrEqual(width);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.h).toBeLessThanOrEqual(TOOLBAR_ROWS);
  }
  for (let i = 1; i < all.length; i++) expect(all[i]!.x).toBeGreaterThanOrEqual(rectRight(all[i - 1]!));
}

describe('the frame of every screen (d088)', () => {
  it.each([
    [1920, 1080, 6, 157],
    [1920, 925, 4, 209],
    [2560, 1440, 8, 157],
    [1366, 768, 4, 169],
    [1024, 600, 2, 277],
  ])('at %ix%i the layout cell is %i screen pixels and the main area under the toolbar and the vine is %i rows', (width, height, scale, main) => {
    const view = frameView(width, height);
    expect(view).toMatchObject({ scale, fine: scale / ART_DETAIL, height: main, top: FRAME_ROWS });
    expect(view.top + view.height).toBe(Math.ceil(height / scale));
  });

  it('draws the art canvas of 640 x 360 fine pixels at 3x on the target screen, in cells of 2 x 2 fine pixels (d110)', () => {
    expect(ART_CANVAS).toEqual({ width: 640, height: 360 });
    expect(ART_DETAIL).toBe(2);
    const view = frameView(1920, 1080);
    expect(view.fine).toBe(3);
    expect(view.width * ART_DETAIL).toBe(ART_CANVAS.width);
    expect((view.top + view.height) * ART_DETAIL).toBe(ART_CANVAS.height);
  });

  it('counts a picture drawn on the fine grid in cells, rounded up (d110)', () => {
    expect(fineToCells({ w: 66, h: 76 })).toEqual({ w: 33, h: 38 });
    expect(fineToCells({ w: 17, h: 1 })).toEqual({ w: 9, h: 1 });
  });

  it('gives every window at least the layout area of a 1920x1080 full screen, 320 x 180 cells, by a smaller zoom (d105, d110)', () => {
    expect(FRAME_MIN).toEqual({ width: 320, height: 180 });
    for (const [width, height] of [[1920, 1080], [1920, 925], [1536, 740], [2560, 1440], [1366, 768], [3840, 2160], [800, 450]] as const) {
      const view = frameView(width, height);
      expect(view.width, `${width}x${height}`).toBeGreaterThanOrEqual(FRAME_MIN.width);
      expect(view.top + view.height, `${width}x${height}`).toBeGreaterThanOrEqual(FRAME_MIN.height);
    }
  });

  it('plays in any window that holds the art canvas at 1x (2x per cell) or more; smaller windows show the line asking for a bigger one (d105, d110)', () => {
    expect(frameFits(1920, 1080)).toBe(true);
    expect(frameFits(1920, 925)).toBe(true); // a 1920x1080 screen in a window, with tabs and the taskbar
    expect(frameFits(640, 360)).toBe(true);
    expect(frameFits(639, 1080)).toBe(false);
    expect(frameFits(1920, 359)).toBe(false);
    expect(frameFits(630, 355)).toBe(false);
  });

  it('puts Back, the name, the rank and the XP at the left, the screen\'s items and settings at the right end', () => {
    const l = toolbarLayout({ ...base, items: [{ width: 40, iconWidth: 22 }] });
    expect(l.fits).toBe(true);
    expect(l.xpText).not.toBeNull();
    expect(l.items[0]!.iconOnly).toBe(false);
    expect(l.keys).toBeNull();
    expect(rectRight(l.settings!)).toBe(342 - 4);
    expect(l.items[0]!.rect.x).toBeLessThan(l.settings!.x);
    expect(l.back!.x).toBe(4);
    expect(l.name!.x).toBeGreaterThan(rectRight(l.back!));
    expectInsideAndApart(l, 342);
  });

  it('leaves out what a screen does not have: no player, nowhere to go back, or the settings screen itself', () => {
    const l = toolbarLayout({ ...base, back: false, settings: false, player: null });
    expect([l.back, l.name, l.rank, l.xpBar, l.xpText, l.settings, l.keys]).toEqual([null, null, null, null, null, null, null]);
    expect(l.fits).toBe(true);
  });

  it('puts the on-screen keyboard switch at the right end of the settings screen only, after its own items (d099)', () => {
    const l = toolbarLayout({ ...base, settings: false, keys: true, items: [{ width: 40, iconWidth: 22 }] });
    expect(l.fits).toBe(true);
    expect(l.settings).toBeNull();
    expect(rectRight(l.keys!)).toBe(342 - 4);
    expect(rectRight(l.items[0]!.rect)).toBeLessThan(l.keys!.x);
    expectInsideAndApart(l, 342);
  });

  it('fits the smallest screen with the longest name: the XP numbers go first, then the screen\'s items show as icons', () => {
    const longest = { nameWidth: 72, rankWidth: 34, xpTextWidth: 64 };
    // the fullest bar: settings and the keyboard switch (no screen has both since d099, so this is the worst case)
    const numbersGone = toolbarLayout({ ...base, keys: true, width: 320, player: longest });
    expect(numbersGone.fits).toBe(true);
    expect(numbersGone.xpText).toBeNull();
    expect(numbersGone.xpBar).not.toBeNull();
    expectInsideAndApart(numbersGone, 320);

    const icons = toolbarLayout({ ...base, keys: true, width: 320, player: longest, items: [{ width: 50, iconWidth: 22 }, { width: 50, iconWidth: 22 }] });
    expect(icons.fits).toBe(true);
    expect(icons.items.map((i) => i.iconOnly)).toEqual([true, true]);
    expectInsideAndApart(icons, 320);
  });

  it('narrows a name too long for the bar (an imported save may have 40 letters) to the room left, so the bar still fits', () => {
    const forty = { nameWidth: 40 * 6, rankWidth: 34, xpTextWidth: 64 };
    const l = toolbarLayout({ ...base, width: 320, player: forty, items: [{ width: 50, iconWidth: 22 }] });
    expect(l.fits).toBe(true);
    expect(l.name!.w).toBeLessThan(forty.nameWidth);
    expect(l.name!.w).toBeGreaterThan(0);
    expect(l.items[0]!.iconOnly).toBe(true);
    expectInsideAndApart(l, 320);
  });

  it('says so when even icons do not fit, so a screen with too many items fails its test', () => {
    const l = toolbarLayout({ ...base, width: 320, items: Array.from({ length: 8 }, () => ({ width: 40, iconWidth: 22 })) });
    expect(l.fits).toBe(false);
  });
});

describe('the frame with the action and inventory band (ft_1_20, d115)', () => {
  const SIZES = [[1920, 1080], [1920, 925], [2560, 1440], [1366, 768], [1024, 600], [640, 360], [3840, 2160], [1921, 1081]] as const;

  it('ft_1_20.AC12 keeps the toolbar behind one flag of the frame\'s layout, off by default', () => {
    expect(BAND_KEEPS_TOOLBAR).toBe(false);
    expect(frameView(1920, 1080, { band: true })).toEqual(frameView(1920, 1080, { band: true, toolbar: BAND_KEEPS_TOOLBAR }));
  });

  it.each(SIZES)('ft_1_20.AC12 at %ix%i lays out the band with and without the toolbar, the band at the foot and the main area all rows above it', (width, height) => {
    const plain = frameView(width, height);
    const rows = Math.floor(height / plain.scale);
    for (const toolbar of [false, true]) {
      const view = frameView(width, height, { band: true, toolbar });
      expect(view).toMatchObject({ scale: plain.scale, fine: plain.fine, width: plain.width, toolbar });
      expect(view.top).toBe(toolbar ? FRAME_ROWS : 0);
      // the band starts right under the main area and ends on the last whole row
      expect(view.band).toEqual({ top: view.height, rows: BAND_ROWS });
      expect(view.top + view.height + BAND_ROWS).toBe(rows);
    }
  });

  it('gives the main area 124 rows over the band on the target screen, 101 with the toolbar kept (d115)', () => {
    expect(frameView(1920, 1080, { band: true }).height).toBe(124);
    expect(frameView(1920, 1080, { band: true, toolbar: true }).height).toBe(101);
  });

  it.each([320, 342, 427])('ft_1_20.AC2 at %i wide puts Back and Settings in the top corners where the toolbar had them', (width) => {
    const bar = toolbarLayout({ ...base, width, player: PLAYER });
    expect(frameCorners(width)).toEqual({ back: bar.back, settings: bar.settings });
    expect(frameCorners(width).back.x).toBe(4);
    expect(rectRight(frameCorners(width).settings)).toBe(width - 4);
  });

  it('ft_1_20.AC10 leaves today\'s frame as it is without the band: the toolbar, the vine and no band', () => {
    expect(frameView(1920, 1080)).toMatchObject({ top: FRAME_ROWS, height: 157, toolbar: true, band: null });
  });

  it('gives a screen that paints every row itself the whole screen: no toolbar, no vine and no band, with the band switched on too (the main menu, ft_1_07)', () => {
    for (const band of [false, true]) expect(frameView(1920, 1080, { band, whole: true })).toMatchObject({ scale: 6, width: 320, top: 0, height: 180, toolbar: false, band: null });
    // a screen that is not a whole number of rows high keeps only its whole rows
    expect(frameView(1920, 1085, { band: false, whole: true }).height).toBe(180);
  });
});
