import { describe, expect, it } from 'vitest';
import { createBitmap, type Bitmap } from './bitmap';
import { tinted, trayBitmap, type TrayKind } from './frames';
import { C } from './palette';

const at = (b: Bitmap, x: number, y: number): number => b.pixels[y * b.width + x]!;

describe('trayBitmap: a plate of the action and inventory band (ft_1_20)', () => {
  it('cuts a plate into the board: a dark line all round, the corners and the last row left to the board', () => {
    const tray = trayBitmap(12, 9, 'cell');
    expect([tray.width, tray.height]).toEqual([12, 9]);
    // the last row is the board between two rows of plates that touch
    for (let x = 0; x < 12; x++) expect(at(tray, x, 8)).toBe(0);
    for (let x = 1; x < 11; x++) expect([at(tray, x, 0), at(tray, x, 7)]).toEqual([C.groove, C.groove]);
    for (let y = 1; y < 7; y++) expect([at(tray, 0, y), at(tray, 11, y)]).toEqual([C.groove, C.groove]);
    for (const [x, y] of [[0, 0], [11, 0], [0, 7], [11, 7]] as const) expect(at(tray, x, y)).toBe(C.panel);
    expect(at(tray, 5, 4)).toBe(C.panel);
  });

  it('a plate stands out and a slot is cut in: the lighter line lies top and left, or bottom and right', () => {
    const plate = trayBitmap(12, 9, 'cell');
    const slot = trayBitmap(12, 9, 'slotEmpty');
    expect([at(plate, 5, 1), at(plate, 1, 4)]).toEqual([C.panelLight, C.panelLight]);
    expect([at(plate, 5, 6), at(plate, 10, 4)]).toEqual([C.panel, C.panel]);
    expect([at(slot, 5, 6), at(slot, 10, 4)]).toEqual([C.panelLight, C.panelLight]);
    expect([at(slot, 5, 1), at(slot, 1, 4)]).toEqual([C.panel, C.panel]);
  });

  it('is a tone lighter under the pointer and where a slot holds an item, and pressed in while held down', () => {
    expect(at(trayBitmap(12, 9, 'cellHover'), 5, 4)).toBe(C.panelLit);
    expect(at(trayBitmap(12, 9, 'slot'), 5, 4)).toBe(C.panelLit);
    expect(at(trayBitmap(12, 9, 'slotEmpty'), 5, 4)).toBe(C.panel);
    const down = trayBitmap(12, 9, 'cellDown');
    expect([at(down, 5, 1), at(down, 5, 6)]).toEqual([C.panel, C.panelLight]);
  });

  it('marks a switched-on slot with gold in its four corners, and no other kind', () => {
    const on = trayBitmap(12, 9, 'slotOn');
    for (const [x, y] of [[1, 1], [10, 1], [1, 6], [10, 6]] as const) expect(at(on, x, y)).toBe(C.goldLight);
    const kinds: TrayKind[] = ['cell', 'cellHover', 'cellDown', 'cellOn', 'cellOff', 'slot', 'slotHover', 'slotEmpty', 'slotArmed'];
    for (const kind of kinds) expect([...trayBitmap(12, 9, kind).pixels]).not.toContain(C.goldLight);
  });

  it('fills the armed slot purple: the item a click on the staff writes with', () => {
    expect(at(trayBitmap(12, 9, 'slotArmed'), 5, 4)).toBe(C.purple);
    expect([...trayBitmap(12, 9, 'slot').pixels]).not.toContain(C.purple);
  });

  it('refuses a size too small to hold its lines', () => {
    expect(() => trayBitmap(4, 9, 'cell')).toThrow(/5 x 5/);
  });
});

describe("tinted: an action picture in the letters' colour (ft_1_20)", () => {
  it('turns every colour but the outline into one colour, the outline into the groove, and leaves clear pixels clear', () => {
    const picture = createBitmap(3, 1);
    picture.pixels.set([C.ink, C.white, 0]);
    expect([...tinted(picture, C.honey).pixels]).toEqual([C.groove, C.honey, 0]);
    expect([...tinted(picture, C.cream, C.ink).pixels]).toEqual([C.ink, C.cream, 0]);
    // the picture given is not changed
    expect([...picture.pixels]).toEqual([C.ink, C.white, 0]);
  });
});
