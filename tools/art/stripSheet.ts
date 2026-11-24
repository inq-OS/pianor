import { bubbleLayout, cellSpan, pinFlow, PIN_ROWS } from '../../src/core/layout/bubble.ts';
import { blit, createBitmap, type Bitmap } from '../../src/game/ui/pixel/bitmap.ts';
import { BACKPACK, BUBBLE_ALPHA, choicesSausage, openBackpack, openBagPlaces, OPEN_BAG, OPTION_PLATE, closePlate, NEW_ITEM_DOT, optionFocus, optionPlate, pinCell, pressRing, stripBitmap, wornChip, type PlateLook } from '../../src/game/ui/pixel/bubbleArt.ts';
import { tinted } from '../../src/game/ui/pixel/frames.ts';
import { measure, renderText } from '../../src/game/ui/pixel/font.ts';
import { ICONS } from '../../src/game/ui/pixel/iconArt.ts';
import { acorn, goldenLeaf, oakLeaf, seedOfLife, singingBranch } from '../../src/game/ui/pixel/prizeArt.ts';
import { C, PALETTE } from '../../src/game/ui/pixel/palette.ts';
import { TOOL_ICONS } from '../../src/game/ui/pixel/toolArt.ts';
import { itemPicture, signOnly, type ItemSign } from '../../src/game/ui/pixel/itemArt.ts';
import { EDITOR_LENGTHS } from '../../src/core/editor/model.ts';

/**
 * The bubble's, the strip's and the backpack's sheet (`npm run art:render -- ui <practice|note|scene|kit>`): a mock screen of
 * 320 x 180 layout cells, the size of the smallest screen (d110), so a zoom of 6 is 1920 x 1080. The practice mock shows
 * the strip with every cell of ft_1_20's table and the bubble opened with a row of choices; the scene mock the door,
 * the gear and the backpack with its page open; the kit every plate in every look and every picture in a strip cell.
 * The positions come from `src/core/layout/bubble.ts`, as in the game. The look only: what a press does is the builder's.
 */

const W = 320, H = 180;
type Canvas = { width: number; height: number; pixels: Uint8Array };
/** A picture drawn on the fine grid (d110) over the sheet, in fine pixels. */
type FineOverlay = { pic: Bitmap; x: number; y: number };
/** A picture laid over the sheet at `BUBBLE_ALPHA`, in cells, as the game draws the bubble over the staff. */
type Glass = { pic: Bitmap; x: number; y: number };
type Mock = { cells: Canvas; glass?: Glass[]; fine?: FineOverlay[] };

const fill = (b: Canvas, x0: number, y0: number, w: number, h: number, colour: number) => {
  for (let y = Math.max(0, y0); y < Math.min(b.height, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(b.width, x0 + w); x++) b.pixels[y * b.width + x] = colour;
};
const centred = (b: Canvas, pic: Bitmap, x: number, y: number, w: number, h: number) => blit(b, pic, x + ((w - pic.width) >> 1), y + ((h - pic.height) >> 1));
/** A picture in the letters' colour on the board, as the band draws its action pictures. */
const pale = (pic: Bitmap, colour: number = C.cream) => tinted(pic, colour);
const text = (s: string, colour: number = C.cream) => renderText(s, { color: colour, shadow: C.groove });

/** A staff on paper filling the main area: what lies under the strip and the bubble on practice. */
function paperWithStaff(b: Canvas, rows: number) {
  fill(b, 0, 0, W, rows, C.cream);
  for (const top of [44, 104]) {
    for (let i = 0; i < 5; i++) fill(b, 12, top + i * 6, W - 24, 1, C.ink);
    for (let k = 0; k < 14; k++) {
      const x = 40 + k * 19, y = top + 21 - ((k * 5) % 9) * 3;
      fill(b, x, y, 5, 3, C.ink);
      fill(b, x + 4, y - 14, 1, 15, C.ink);
    }
  }
}

function corners(b: Canvas, faded: boolean) {
  const door = faded ? tinted(ICONS.quit, C.dim, C.groove) : ICONS.quit;
  blit(b, door, 3, 3);
  blit(b, ICONS.settings, W - 3 - ICONS.settings.width, 3);
}

/** The practice screen's strip (ft_1_20's table) and the bubble open at `at` with option `open`'s choices. */
export function practiceMock(): Mock {
  const b = createBitmap(W, H);
  const main = H - PIN_ROWS;
  paperWithStaff(b, main);
  corners(b, true);
  // the strip: Listen, Start again, Wait, slower, the percent, faster, More; then the lit worn options
  type Cell = { pic?: Bitmap; word?: string; look?: PlateLook };
  const cells: Cell[] = [
    { pic: ICONS.ear },
    { pic: TOOL_ICONS.repeat },
    { pic: TOOL_ICONS.wait, look: 'hover' },
    { word: '-' },
    { pic: TOOL_ICONS.speed, word: '80%' },
    { word: '+' },
    { pic: TOOL_ICONS.more, word: 'VEEL' },
  ];
  const width = (c: Cell) => (c.pic ? c.pic.width : 0) + (c.pic && c.word ? 2 : 0) + (c.word ? measure(c.word) : 0);
  const flow = pinFlow({ spans: cells.map((c) => cellSpan(width(c) + 4, 30)) });
  blit(b, stripBitmap(W), 0, main);
  let right = 0;
  for (const { action, rect, span } of flow.placed) {
    const c = cells[action]!;
    blit(b, pinCell(span, c.look ?? 'plain'), rect.x, main + rect.y);
    const pic = c.pic ? pale(c.pic) : undefined, word = c.word ? text(c.word) : undefined;
    const w = (pic?.width ?? 0) + (pic && word ? 2 : 0) + (word?.width ?? 0);
    let x = rect.x + ((rect.w - w) >> 1);
    if (pic) { blit(b, pic, x, main + rect.y + ((rect.h - pic.height) >> 1)); x += pic.width + 2; }
    if (word) blit(b, word, x, main + rect.y + ((rect.h - word.height) >> 1) + 1);
    right = rect.x + rect.w;
  }
  // the worn options that are on: note names and fingers
  for (const pic of [TOOL_ICONS.noteNamesOn, TOOL_ICONS.fingers]) {
    const chip = wornChip(pic);
    blit(b, chip, right + 3, main + 1);
    right += chip.width + 3;
  }
  // the bubble, opened on the staff, with the Click option's choices out (slot 2)
  const options = [TOOL_ICONS.sectionShort, TOOL_ICONS.tempo, TOOL_ICONS.click, TOOL_ICONS.circle, TOOL_ICONS.statsPane, TOOL_ICONS.analyse, TOOL_ICONS.noteNamesOn, TOOL_ICONS.fingers];
  const choices = [TOOL_ICONS.stop, TOOL_ICONS.click, TOOL_ICONS.tick];
  const layout = bubbleLayout({ at: { x: 130, y: 82 }, options: options.length, screen: { w: W, h: main }, open: { option: 2, choices: choices.length } });
  // the bubble is drawn on a layer of its own, laid over the staff at BUBBLE_ALPHA; a plate is OPTION_PLATE across, centred on its box
  const glass = createBitmap(W, H);
  const off = (r: { w: number }) => (OPTION_PLATE - r.w) >> 1;
  layout.options.forEach((r, i) => {
    const look: PlateLook = i === 2 ? 'down' : i === 6 || i === 7 ? 'on' : i === 1 ? 'off' : i === 4 ? 'hover' : 'plain';
    blit(glass, optionPlate(look), r.x - off(r), r.y - off(r));
    centred(glass, pale(options[i]!, look === 'off' ? C.lock : C.cream), r.x, r.y, r.w, r.h);
  });
  // the keyboard's focus on slot 5
  const f = layout.options[5]!;
  blit(glass, optionFocus(), f.x - off(f) - 2, f.y - off(f) - 2);
  blit(glass, closePlate(), layout.close.x - off(layout.close), layout.close.y - off(layout.close));
  // the Click option's choices in one sausage, the one in use lit
  const sausage = choicesSausage(layout.centre, layout.choices, 1);
  blit(glass, sausage.picture, sausage.x, sausage.y);
  layout.choices.forEach((r, i) => centred(glass, pale(choices[i]!), r.x, r.y, r.w, r.h));
  // a finger's long press, two thirds of the way, far right
  blit(b, pressRing(0.66), 262, 60);
  return { cells: b, glass: [{ pic: glass, x: 0, y: 0 }] };
}

/** The piece maker with the bubble opened on a note and its Length option pressed: every length in one sausage, the one in use lit. */
export function noteMock(): Mock {
  const b = createBitmap(W, H);
  const main = H - PIN_ROWS;
  paperWithStaff(b, main);
  corners(b, true);
  blit(b, stripBitmap(W), 0, main);
  const fine: FineOverlay[] = [];
  // a music sign is drawn on the fine grid, in the letters' colour, centred in a box given in cells
  const sign = (name: ItemSign, box: { x: number; y: number; w: number; h: number }, max: number) => {
    const pic = tinted(signOnly(itemPicture(name), max, max), C.cream);
    fine.push({ pic, x: box.x * 2 + ((box.w * 2 - pic.width) >> 1), y: box.y * 2 + ((box.h * 2 - pic.height) >> 1) });
  };
  // the strip: Listen, Try, Undo, Redo, the length item
  const strip: { pic?: Bitmap; sign?: ItemSign }[] = [{ pic: ICONS.ear }, { pic: TOOL_ICONS.play }, { pic: TOOL_ICONS.undo }, { pic: TOOL_ICONS.redo }, { sign: 'note.quarter' }];
  const flow = pinFlow({ spans: strip.map(() => 1) });
  for (const { action, rect } of flow.placed) {
    const c = strip[action]!;
    blit(b, pinCell(1, action === 4 ? 'on' : 'plain'), rect.x, main + rect.y);
    if (c.pic) centred(b, pale(c.pic), rect.x, main + rect.y, rect.w, rect.h);
    else sign(c.sign!, { x: rect.x, y: main + rect.y, w: rect.w, h: rect.h }, 22);
  }
  // the note pressed (the third of the upper staff), lit as selected
  const at = { x: 78, y: 59 };
  fill(b, at.x, at.y, 5, 3, C.gold);
  fill(b, at.x + 4, at.y - 14, 1, 15, C.gold);
  // the bubble on it, slot 0 (length) pressed and its choices out
  const slots: ({ sign: ItemSign } | { pic: Bitmap })[] = [
    { sign: 'note.quarter' }, { sign: 'sharp' }, { pic: TOOL_ICONS.trash }, { sign: 'tie' },
    { sign: 'dynamic.mf' }, { pic: TOOL_ICONS.fingers }, { pic: TOOL_ICONS.grace }, { pic: TOOL_ICONS.copy },
  ];
  const lengths = EDITOR_LENGTHS;
  const layout = bubbleLayout({ at: { x: at.x + 2, y: at.y + 1 }, options: slots.length, screen: { w: W, h: main }, open: { option: 0, choices: lengths.length } });
  const glass = createBitmap(W, H);
  const off = (r: { w: number }) => (OPTION_PLATE - r.w) >> 1;
  layout.options.forEach((r, i) => {
    blit(glass, optionPlate(i === 0 ? 'down' : 'plain'), r.x - off(r), r.y - off(r));
    const slot = slots[i]!;
    if ('pic' in slot) centred(glass, pale(slot.pic), r.x, r.y, r.w, r.h);
    else sign(slot.sign, r, 26);
  });
  blit(glass, closePlate(), layout.close.x - off(layout.close), layout.close.y - off(layout.close));
  const sausage = choicesSausage(layout.centre, layout.choices, lengths.indexOf('quarter'));
  blit(glass, sausage.picture, sausage.x, sausage.y);
  layout.choices.forEach((r, i) => sign(`note.${lengths[i]!}`, r, 28));
  return { cells: b, glass: [{ pic: glass, x: 0, y: 0 }], fine };
}

/** A scene with the backpack in the top right corner and its page open. */
export function sceneMock(): Mock {
  const b = createBitmap(W, H);
  // a plain dusk ground standing in for a painted picture (180 rows: nothing pinned)
  for (let y = 0; y < H; y++) fill(b, 0, y, W, 1, y < 90 ? C.duskLight : y < 120 ? C.dusk : C.duskDark);
  corners(b, false);
  // the corner's backpack itself grows and opens (it is not drawn twice): the open bag keeps the small one's top right
  // corner, beside the gear, and holds nine of its items, more below
  const bag = { x: W - 3 - ICONS.settings.width - 4 - BACKPACK.width, y: 3 };
  const bx = bag.x + BACKPACK.width - OPEN_BAG.w, by = bag.y;
  blit(b, openBackpack({ down: true }), bx, by);
  const kept = [oakLeaf(), acorn(), goldenLeaf(), singingBranch(), seedOfLife(), acorn(), oakLeaf(), goldenLeaf(), seedOfLife()];
  const fine: FineOverlay[] = [];
  openBagPlaces().forEach((place, i) => {
    const pic = kept[i]!;
    fine.push({ pic, x: (bx + place.x) * 2 + ((place.w * 2 - pic.width) >> 1), y: (by + place.y) * 2 + ((place.h * 2 - pic.height) >> 1) });
  });
  return { cells: b, fine };
}


/** Every plate in every look, and every picture the strip may hold. */
export function kitMock(): Mock {
  const b = createBitmap(W, H);
  fill(b, 0, 0, W, H, C.night);
  const looks: PlateLook[] = ['plain', 'hover', 'down', 'on', 'off', 'main'];
  looks.forEach((look, i) => {
    const x = 4 + i * 52;
    blit(b, optionPlate(look), x, 2);
    centred(b, pale(TOOL_ICONS.click, look === 'off' ? C.lock : C.cream), x, 2, OPTION_PLATE, OPTION_PLATE);
    blit(b, pinCell(1, look), x, 26);
    centred(b, pale(TOOL_ICONS.repeat, look === 'off' ? C.lock : C.cream), x, 26, 30, 15);
    blit(b, text(look.toUpperCase(), C.dim), x, 44);
  });
  blit(b, closePlate(), 4, 60);
  blit(b, closePlate('hover'), 32, 60);
  blit(b, optionFocus(), 60, 58);
  [0, 0.25, 0.5, 0.75, 1].forEach((f, i) => blit(b, pressRing(f), 110 + i * 27, 60));
  // an option's choices on the outer ring: the bubble's centre is to the left, only the arc is drawn
  const arc = bubbleLayout({ at: { x: 250, y: 88 }, options: 8, screen: { w: W, h: 125 }, open: { option: 2, choices: 3 } });
  const sausage = choicesSausage(arc.centre, arc.choices, 1);
  blit(b, sausage.picture, sausage.x, sausage.y);
  [TOOL_ICONS.stop, TOOL_ICONS.click, TOOL_ICONS.tick].forEach((pic, i) => centred(b, pale(pic), arc.choices[i]!.x, arc.choices[i]!.y, 18, 18));
  blit(b, BACKPACK, 190, 90);
  blit(b, NEW_ITEM_DOT, 190 + BACKPACK.width - 3, 89);
  // every picture of the strip in a cell
  const pics = (['more', 'analyse', 'speed', 'scale', 'triad', 'handLeft', 'handRight', 'bug', 'learn', 'sectionShort', 'wait', 'tempo', 'click', 'circle', 'statsPane'] as const).map((id) => TOOL_ICONS[id]);
  fill(b, 0, 130, W, PIN_ROWS, C.panel);
  blit(b, stripBitmap(W), 0, 126);
  pics.forEach((pic, i) => {
    const x = 2 + (i % 10) * 31, y = 127 + Math.floor(i / 10) * 17;
    if (i === 10) blit(b, stripBitmap(W), 0, 143);
    blit(b, pinCell(1, 'plain'), x, y + (i >= 10 ? 0 : 0));
    centred(b, pale(pic), x, y, 30, 15);
  });
  blit(b, wornChip(TOOL_ICONS.noteNamesOn), 160, 145);
  blit(b, wornChip(TOOL_ICONS.fingers), 178, 145);
  blit(b, pinCell(2, 'main'), 257, 145);
  centred(b, text('UUESTI'), 257, 146, 61, 15);
  return { cells: b };
}

export const UI_SHEETS = { practice: practiceMock, note: noteMock, scene: sceneMock, kit: kitMock } as const;
export type UiSheet = keyof typeof UI_SHEETS;

/** One sheet on the fine grid (640 x 360, d110) with the game's palette, ready for `pngBytes`. */
export function uiSheet(name: UiSheet): { width: number; height: number; pixels: Uint8Array; palette: readonly number[] } {
  const { cells, glass = [], fine = [] } = UI_SHEETS[name]();
  const palette = [...PALETTE];
  for (const layer of glass) seeThrough(cells, layer, palette);
  const out = createBitmap(cells.width * 2, cells.height * 2);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) out.pixels[y * out.width + x] = cells.pixels[(y >> 1) * cells.width + (x >> 1)]!;
  for (const { pic, x, y } of fine) blit(out, pic, x, y);
  return { ...out, palette };
}

/** Lays `layer` over `b` at `BUBBLE_ALPHA`, adding each mixed colour to `palette` once. */
function seeThrough(b: Canvas, layer: Glass, palette: number[]) {
  const mixed = new Map<number, number>();
  const mix = (top: number, under: number) => {
    const key = top * 256 + under;
    let index = mixed.get(key);
    if (index === undefined) {
      const a = palette[top]!, u = palette[under]!;
      const channel = (s: number) => Math.round(((a >> s) & 255) * BUBBLE_ALPHA + ((u >> s) & 255) * (1 - BUBBLE_ALPHA));
      palette.push((channel(16) << 16) | (channel(8) << 8) | channel(0));
      index = palette.length - 1;
      if (index > 255) throw new Error('the sheet has more colours than an indexed picture holds');
      mixed.set(key, index);
    }
    return index;
  };
  for (let y = 0; y < layer.pic.height; y++) {
    for (let x = 0; x < layer.pic.width; x++) {
      const top = layer.pic.pixels[y * layer.pic.width + x]!;
      const bx = layer.x + x, by = layer.y + y;
      if (top === 0 || bx < 0 || by < 0 || bx >= b.width || by >= b.height) continue;
      b.pixels[by * b.width + bx] = mix(top, b.pixels[by * b.width + bx]!);
    }
  }
}
