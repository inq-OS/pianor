import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS } from '../progression/playerNames';
import { ART_DETAIL } from './frame';
import { LANTERN_PICTURE, lanternPlan } from './lantern';
import { MAIN_MENU, mainMenuLayout } from './mainMenu';
import { rectBottom, rectRight, type Rect } from './rect';

const SCREEN = { width: 320, height: 180 };
const overlap = (a: Rect, b: Rect) => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);
const inside = (r: Rect, box: Rect) => r.x >= box.x && r.y >= box.y && rectRight(r) <= rectRight(box) && rectBottom(r) <= rectBottom(box);

describe('the main menu: the lantern over Keri on the whole screen, the players down a sheet of parchment (ft_1_07)', () => {
  it('the picture is the whole target screen: nothing lies under it (no lower section)', () => {
    const { picture } = mainMenuLayout({ ...SCREEN, players: 3, canAdd: true, piano: true });
    expect(picture).toEqual({ x: 0, y: 0, w: 320, h: 180 });
    expect(picture).toEqual({ x: 0, y: 0, ...LANTERN_PICTURE });
  });

  it('the sheet holds the most players a device may have (ft_1_07.AC10: no free place once it is full)', () => {
    expect(MAIN_MENU.lines).toBe(MAX_PLAYERS);
    const full = mainMenuLayout({ ...SCREEN, players: MAX_PLAYERS, canAdd: false, piano: true });
    expect(full.players).toHaveLength(MAX_PLAYERS);
    expect(full.add).toBeNull();
    expect(rectBottom(full.sheet)).toBeLessThanOrEqual(180 - 3);
    expect(() => mainMenuLayout({ ...SCREEN, players: MAX_PLAYERS, canAdd: true, piano: true })).toThrow(/10 lines/);
  });

  it('the names are listed one under the other ("names listed vertically not horizontally"), the outlined "+" on the next free line', () => {
    const { players, add } = mainMenuLayout({ ...SCREEN, players: 5, canAdd: true, piano: true });
    players.forEach((line, i) => {
      expect(line.x).toBe(players[0]!.x);
      expect(line.y).toBe(players[0]!.y + i * MAIN_MENU.line.h);
    });
    expect(add).toEqual({ ...players[0]!, y: players[4]!.y + MAIN_MENU.line.h });
    // the first player ever: only the "+", on the first line
    const empty = mainMenuLayout({ ...SCREEN, players: 0, canAdd: true, piano: true });
    expect(empty.players).toEqual([]);
    expect(empty.add).toEqual(players[0]);
  });

  it('the sheet is only as long as what is written on it', () => {
    const short = mainMenuLayout({ ...SCREEN, players: 1, canAdd: true, piano: true });
    const long = mainMenuLayout({ ...SCREEN, players: 6, canAdd: true, piano: true });
    expect(long.sheet.h - short.sheet.h).toBe(5 * MAIN_MENU.line.h);
    expect(long.sheet.y).toBe(short.sheet.y);
  });

  it('the bare piano and the gear lie side by side at the sheet\'s head, over the first line, and stay put whatever the number of players (they must not move when profiles are added)', () => {
    const first = mainMenuLayout({ ...SCREEN, players: 0, canAdd: true, piano: true });
    for (const n of [0, 1, 4, 9]) {
      const { piano, gear, players, add } = mainMenuLayout({ ...SCREEN, players: n, canAdd: true, piano: true });
      expect(piano).toEqual(first.piano);
      expect(gear).toEqual(first.gear);
      expect(gear.x).toBeGreaterThanOrEqual(rectRight(piano!) + 2);
      expect(gear.y).toBe(piano!.y);
      for (const other of [...players, add!]) {
        expect(other.y).toBeGreaterThanOrEqual(rectBottom(gear) + 2);
        expect(overlap(other, piano!) || overlap(other, gear)).toBe(false);
      }
    }
    const full = mainMenuLayout({ ...SCREEN, players: MAX_PLAYERS, canAdd: false, piano: true });
    expect(full.gear).toEqual(first.gear);
    const bare = mainMenuLayout({ ...SCREEN, players: 2, canAdd: true, piano: false });
    expect(bare.piano).toBeNull();
    expect(bare.gear).toEqual(first.gear);
  });

  it('ft_1_26.AC1 the academic hat lies between the piano and the gear, on their row, and stays put with or without the piano (WP-14, d145)', () => {
    const { piano, hat, gear, players } = mainMenuLayout({ ...SCREEN, players: 3, canAdd: true, piano: true });
    expect(hat.y).toBe(gear.y);
    expect(hat.x).toBeGreaterThanOrEqual(rectRight(piano!) + 2);
    expect(gear.x).toBeGreaterThanOrEqual(rectRight(hat) + 2);
    for (const line of players) expect(overlap(line, hat)).toBe(false);
    expect(mainMenuLayout({ ...SCREEN, players: 3, canAdd: true, piano: false }).hat).toEqual(hat);
  });

  it('everything written lies on the sheet, under its roll and over its curled foot, and no two overlap', () => {
    const { players, add, piano, hat, gear, sheet } = mainMenuLayout({ ...SCREEN, players: 9, canAdd: true, piano: true });
    const all = [...players, add!, piano!, hat, gear];
    expect(all).toHaveLength(13);
    const page: Rect = { x: sheet.x + 2, y: sheet.y + MAIN_MENU.roll, w: sheet.w - 4, h: sheet.h - MAIN_MENU.roll - MAIN_MENU.foot };
    for (const r of all) expect(inside(r, page)).toBe(true);
    for (let i = 0; i < all.length; i++) for (let k = i + 1; k < all.length; k++) expect(overlap(all[i]!, all[k]!)).toBe(false);
  });

  it('the name hangs in the picture\'s upper left and the sheet under it ("the names are vertically on the left", "below the title"), both clear of the lantern on the right', () => {
    const { name, sheet, picture } = mainMenuLayout({ ...SCREEN, players: MAX_PLAYERS, canAdd: false, piano: true });
    const { lantern } = lanternPlan();
    expect(name.y).toBeGreaterThan(0);
    expect(sheet.y).toBeGreaterThanOrEqual(rectBottom(name));
    expect(sheet.y - rectBottom(name)).toBeLessThanOrEqual(4);
    expect(sheet.x).toBeGreaterThanOrEqual(picture.x + 4);
    // the board hangs over the sheet's middle
    expect(Math.abs(name.x + name.w / 2 - (sheet.x + sheet.w / 2))).toBeLessThanOrEqual(1);
    for (const r of [name, sheet]) expect(rectRight(r)).toBeLessThan((lantern.x - lantern.ring) / ART_DETAIL / 2);
  });

  it('on a wider or higher screen the picture stays in the middle and the name and the sheet stay on it', () => {
    const wide = mainMenuLayout({ width: 400, height: 200, players: 2, canAdd: true, piano: true });
    expect(wide.picture).toEqual({ x: 40, y: 10, w: 320, h: 180 });
    expect(wide.sheet.x).toBe(40 + MAIN_MENU.sheet.left);
    expect(wide.name).toEqual({ x: 40 + MAIN_MENU.name.x, y: 10 + MAIN_MENU.name.y, w: MAIN_MENU.name.w, h: MAIN_MENU.name.h });
    expect(wide.sheet.y).toBe(rectBottom(wide.name) + MAIN_MENU.sheet.gap);
  });

  it('a screen too small, such as one not yet sized, still lays out and never throws', () => {
    const tiny = mainMenuLayout({ width: 1, height: 1, players: 2, canAdd: true, piano: true });
    expect(tiny.players[0]!.w).toBe(MAIN_MENU.line.w);
    expect(tiny.gear.h).toBe(MAIN_MENU.tools.h);
    expect(tiny.picture.y).toBe(0);
  });
});
