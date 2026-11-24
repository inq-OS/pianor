import { blit, createBitmap, fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The look of the bubble, the pinned strip and the backpack (ft_1_20, d282), in the band's manner (d118): one warm board,
 * a plate only cut into it, a dark line all round with a lighter line beside it; pictures pale, gold for what is on.
 * Everything here is in layout cells and sized to `src/core/layout/bubble.ts`: an option 20 x 20 on a ring of radius 28, a choice 18 x 18, a strip cell 30 x 15, the strip 17 rows. The builder places them; this file only paints.
 *
 * Original, drawn for this project. The backpack follows the shape of the Kenney 1-Bit Pack's backpack (CC0,
 * kenney.nl/assets/1-bit-pack), redrawn in colour with the kit's ink outline (d084, `docs/assets.md`).
 */

/** How a plate looks: at rest, under the pointer, pressed, switched on (lit), with nothing to do, or the screen's main action. */
export type PlateLook = 'plain' | 'hover' | 'down' | 'on' | 'off' | 'main';

interface PlateColours {
  fill: number;
  light: number;
  shade: number;
  outline: number;
}

// a raised plate has its light line top-left and its shade bottom-right; a pressed one the other way round
const PLATES: Readonly<Record<PlateLook, PlateColours>> = {
  plain: { fill: C.panel, light: C.panelLight, shade: C.panelDark, outline: C.groove },
  hover: { fill: C.panelLit, light: C.honeyDark, shade: C.panel, outline: C.groove },
  down: { fill: C.panelDark, light: C.panelDark, shade: C.panelLight, outline: C.groove },
  // lit: the plate stays wood, its edge turns gold, so the picture keeps its colour and still reads
  on: { fill: C.panelLit, light: C.goldLight, shade: C.gold, outline: C.groove },
  off: { fill: C.panel, light: C.panel, shade: C.panel, outline: C.panelDark },
  // the main action (Play again, Done) at the strip's right end: a lighter wood with a honey edge, the same on every screen
  main: { fill: C.panelLit, light: C.honey, shade: C.honeyDark, outline: C.groove },
};

/** The size of an option (`bubble.ts`): a round plate, opaque, with room round its picture. */
export const OPTION_SIZE = 20;
/** The size of a choice in the row beside the ring (`bubble.ts`). */
export const CHOICE_SIZE = 18;
/** A cell of the strip and the strip's height (`bubble.ts`: `PIN_CELL`, `PIN_ROWS`). */
export const PIN_CELL_SIZE = { w: 30, h: 15 } as const;
export const STRIP_ROWS = 17;

type Inside = (x: number, y: number) => boolean;

/** Paints a shape given by `inside`: outline where a neighbour is outside, light and shade lines just within it. */
function plateOf(width: number, height: number, inside: Inside, colours: PlateColours, sunk = false): Bitmap {
  const b = createBitmap(width, height);
  const isIn = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && inside(x, y);
  const edge = (x: number, y: number) => isIn(x, y) && (!isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y - 1) || !isIn(x, y + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isIn(x, y)) continue;
      let colour = colours.fill;
      if (edge(x, y)) colour = colours.outline;
      else {
        // which side of the edge this pixel lies on: the edge above or left is the light side of a raised plate
        const nearTopLeft = edge(x - 1, y) || edge(x, y - 1) || edge(x - 1, y - 1);
        const nearBottomRight = edge(x + 1, y) || edge(x, y + 1) || edge(x + 1, y + 1);
        if (nearTopLeft && !nearBottomRight) colour = sunk ? colours.shade : colours.light;
        else if (nearBottomRight && !nearTopLeft) colour = sunk ? colours.light : colours.shade;
        else if (nearTopLeft && nearBottomRight) colour = colours.outline;
      }
      b.pixels[y * width + x] = colour;
    }
  }
  return b;
}

const disc = (size: number): Inside => {
  const r = size / 2;
  return (x, y) => (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r - 0.5;
};
const roundedRect = (width: number, height: number): Inside => (x, y) => !((x === 0 || x === width - 1) && (y === 0 || y === height - 1));

/** An option of the bubble: a round plate 20 across, opaque, with nothing behind the ring (the staff shows between the plates). Its picture is drawn on it by the scene, centred. */
export function optionPlate(look: PlateLook = 'plain'): Bitmap {
  return plateOf(OPTION_SIZE, OPTION_SIZE, disc(OPTION_SIZE), PLATES[look]);
}

/** The keyboard's focus on an option: a gold ring two cells wide just outside the plate, 24 across. */
export function optionFocus(): Bitmap {
  const size = OPTION_SIZE + 4;
  const outer = disc(size);
  const inner = (x: number, y: number) => (x + 0.5 - size / 2) ** 2 + (y + 0.5 - size / 2) ** 2 <= (OPTION_SIZE / 2) ** 2;
  const b = createBitmap(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (outer(x, y) && !inner(x, y)) b.pixels[y * size + x] = C.goldLight;
  return b;
}

/** A small cross for the Close target in the ring's centre (original; the 1-Bit Pack's cross is too heavy at 7 cells). */
const CROSS = fromAscii(['kk...kk', 'kwk.kwk', '.kwkwk.', '..kwk..', '.kwkwk.', 'kwk.kwk', 'kk...kk'], { k: C.groove, w: C.dim });

/** The Close target in the ring's centre: a sunk round plate with a cross, so it reads as the way out and not as an option. */
export function closePlate(look: 'plain' | 'hover' = 'plain'): Bitmap {
  const b = plateOf(OPTION_SIZE, OPTION_SIZE, disc(OPTION_SIZE), look === 'hover' ? PLATES.hover : PLATES.plain, true);
  blit(b, CROSS, (OPTION_SIZE - CROSS.width) >> 1, (OPTION_SIZE - CROSS.height) >> 1);
  return b;
}

/** A choice in the row beside the ring: a square plate 18 x 18 with its corners cut. */
export function choicePlate(look: PlateLook = 'plain'): Bitmap {
  return plateOf(CHOICE_SIZE, CHOICE_SIZE, roundedRect(CHOICE_SIZE, CHOICE_SIZE), PLATES[look], look === 'down');
}

/** The board under the row of `n` choices, 2 cells round them: drawn at the first choice's x - 2, y - 2. */
export function choicesBack(n: number): Bitmap {
  const w = n * CHOICE_SIZE + (n - 1) * 2 + 4, h = CHOICE_SIZE + 4;
  return plateOf(w, h, roundedRect(w, h), { fill: C.panelDark, light: C.panel, shade: C.groove, outline: C.groove });
}

/**
 * The ring that fills round a finger during a long press (ft_1_20: from 150 ms to 450 ms): a dark track 24 across, filled
 * in gold clockwise from the top as `fraction` goes from 0 to 1.
 */
export function pressRing(fraction: number): Bitmap {
  const size = 24, c = size / 2;
  const f = Math.min(1, Math.max(0, fraction));
  const b = createBitmap(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      if (r > c - 0.2 || r < c - 3.2) continue;
      const edge = r > c - 1.2 || r < c - 2.2;
      // the angle from the top, clockwise, 0 to 1
      const turn = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
      b.pixels[y * size + x] = edge ? C.groove : turn < f ? C.goldLight : C.panelDark;
    }
  }
  return b;
}

/** The pinned strip's ground, `width` cells wide and `STRIP_ROWS` high: a groove above it, then the board. */
export function stripBitmap(width: number): Bitmap {
  const b = createBitmap(width, STRIP_ROWS);
  for (let y = 0; y < STRIP_ROWS; y++) {
    const colour = y === 0 ? C.groove : y === STRIP_ROWS - 1 ? C.panelDark : C.panel;
    for (let x = 0; x < width; x++) b.pixels[y * width + x] = colour;
  }
  return b;
}

/** A cell of the strip: `span` cells of 30 x 15 joined (a word wider than one cell takes more, `cellSpan`), raised. */
export function pinCell(span = 1, look: PlateLook = 'plain'): Bitmap {
  const w = span * PIN_CELL_SIZE.w + (span - 1), h = PIN_CELL_SIZE.h;
  return plateOf(w, h, roundedRect(w, h), PLATES[look], look === 'down');
}

/**
 * A worn option that is on, shown right of More (a press turns it off): a small gold plate with the option's picture
 * in the groove's ink, at least 15 square and as wide as the picture needs.
 */
export function wornChip(picture: Bitmap): Bitmap {
  const w = Math.max(PIN_CELL_SIZE.h, picture.width + 4), h = PIN_CELL_SIZE.h;
  const b = plateOf(w, h, roundedRect(w, h), { fill: C.gold, light: C.goldLight, shade: C.goldDark, outline: C.groove });
  const ink = createBitmap(picture.width, picture.height);
  picture.pixels.forEach((p, i) => {
    if (p !== 0 && p !== C.ink) ink.pixels[i] = C.groove;
  });
  blit(b, ink, (w - picture.width) >> 1, (h - picture.height) >> 1);
  return b;
}

const BAG = { k: C.ink, d: C.brownDark, n: C.brown, l: C.brownLight, g: C.gold, y: C.goldLight } as const;

/**
 * The backpack in the top right corner (two cells left of the gear) on the room, the map and the scenes: 14 x 14 like the
 * gear (14 x 15), a leather bag with a handle and a rounded top, a flap with a gold buckle, straps down its sides and a pocket.
 */
export const BACKPACK: Bitmap = fromAscii([
  '....kkkkkk....',
  '...kk....kk...',
  '...kkkkkkkk...',
  '..kllllllllk..',
  '.klnnnnnnnnlk.',
  '.knnnnnnnnnnk.',
  'kdnnnnnnnnnndk',
  'kdkkkkyykkkkdk',
  'kdnnnkggknnndk',
  'kdnnnnkknnnndk',
  'kdkkkkkkkkkkdk',
  'kdkllllllllkdk',
  'kdknnnnnnnnkdk',
  'kddkkkkkkkkddk',
  '.kkkkkkkkkkkk.',
], BAG);

/** The dot a new item puts on the backpack's top right corner until the backpack is opened. */
export const NEW_ITEM_DOT: Bitmap = fromAscii(['.kk.', 'kyrk', 'krrk', '.kk.'], { k: C.ink, r: C.red, y: C.redLight });

/** The open bag: its size in cells, and the 3 x 3 places its items lie in (each holds a 56 x 40 fine picture). */
export const OPEN_BAG = { w: 112, h: 106 } as const;
const BAG_CELL = { w: 30, h: 22 } as const;
const BAG_INSIDE = { x: 11, y: 30, cols: 3, rows: 3 } as const;

/** Where the open bag's items lie, row by row, in cells from the bag's top left: 3 x 3, the first of the rows shown. */
export function openBagPlaces(): { x: number; y: number; w: number; h: number }[] {
  const places: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < BAG_INSIDE.rows; r++) for (let c = 0; c < BAG_INSIDE.cols; c++) places.push({ x: BAG_INSIDE.x + c * BAG_CELL.w, y: BAG_INSIDE.y + r * BAG_CELL.h, ...BAG_CELL });
  return places;
}

/**
 * The backpack opened (a press on it), `OPEN_BAG` large: the flap thrown back over the top with its buckle hanging, the
 * dark inside where the items lie in 3 x 3 places with no box round them (`openBagPlaces`), the front wall's lip and
 * pocket across the foot, straps down both sides. `more` adds the side strap's arrows: up when rows lie above the ones
 * shown, down when rows lie below (the wheel, a drag or the arrows scroll them).
 */
export function openBackpack(more: { up?: boolean; down?: boolean } = {}): Bitmap {
  const b = createBitmap(OPEN_BAG.w, OPEN_BAG.h);
  const bag = bagBrush(b);
  const inBottom = BAG_INSIDE.y + BAG_INSIDE.rows * BAG_CELL.h + 2;
  bagBody(bag);
  bagInside(bag, inBottom);
  bagLip(bag, inBottom);
  bagFlap(bag);
  // the side strap's arrows when rows lie above or below the ones shown
  if (more.up) bagArrow(bag, OPEN_BAG.w - 10, BAG_TOP + 6, true);
  if (more.down) bagArrow(bag, OPEN_BAG.w - 10, inBottom - 8, false);
  return b;
}

const BAG_TOP = 22;

interface BagBrush {
  put: (x: number, y: number, c: number) => void;
  rect: (x0: number, y0: number, w: number, h: number, c: number) => void;
}

function bagBrush(b: { width: number; height: number; pixels: Uint8Array }): BagBrush {
  const put = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < b.width && y < b.height) b.pixels[y * b.width + x] = c;
  };
  return { put, rect: (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c); } };
}

/** Half the body's width at row `y`: a leather sack, its sides bulging a cell, rounded at the foot. */
function bagHalf(y: number): number {
  const t = (y - BAG_TOP) / (OPEN_BAG.h - 1 - BAG_TOP);
  const bulge = Math.round(2 * Math.sin(Math.PI * Math.min(1, t * 1.2)));
  const foot = t > 0.94 ? Math.round(((t - 0.94) / 0.06) ** 2 * 4) : 0;
  return 52 + bulge - foot;
}

function bagBody({ put }: BagBrush): void {
  const bottom = OPEN_BAG.h - 1;
  for (let y = BAG_TOP; y <= bottom; y++) {
    const h = bagHalf(y), l = 56 - h, r = 55 + h;
    for (let x = l; x <= r; x++) put(x, y, x === l || x === r || y === bottom ? C.ink : x <= l + 2 ? C.brownLight : x >= r - 3 ? C.brownDark : C.brown);
    // the straps down both sides, darker, stitched
    for (const sx of [l + 4, r - 7]) for (let k = 0; k < 4; k++) put(sx + k, y, k === 0 || k === 3 || y % 4 !== 0 ? C.brownDark : C.brown);
  }
}

/** The opening: the back wall's rim, then the dark inside, deepest at the back. */
function bagInside({ put }: BagBrush, inBottom: number): void {
  const inTop = BAG_TOP + 4;
  for (let y = BAG_TOP; y < inTop; y++) for (let x = 14; x < OPEN_BAG.w - 14; x++) put(x, y, y === BAG_TOP ? C.ink : y === BAG_TOP + 1 ? C.brownLight : C.brown);
  for (let y = inTop; y < inBottom; y++) {
    const l = 56 - bagHalf(y) + 9, r = 55 + bagHalf(y) - 9;
    for (let x = l; x <= r; x++) put(x, y, x === l || x === r ? C.ink : y < inTop + 6 ? C.night : C.panelDark);
  }
}

/** The front wall's lip, curving up at its ends as soft leather does round a full bag, with a stitched pocket. */
function bagLip({ put, rect }: BagBrush, inBottom: number): void {
  const W = OPEN_BAG.w;
  for (let x = 6; x < W - 6; x++) {
    const top = inBottom - 3 - Math.round(3 * (1 - Math.sin((Math.PI * (x - 6)) / (W - 12))));
    put(x, top, C.ink);
    put(x, top + 1, C.brownLight);
    for (let y = top + 2; y < inBottom + 2; y++) put(x, y, C.brown);
  }
  rect(34, inBottom + 3, 44, 1, C.ink);
  rect(34, inBottom + 4, 44, 9, C.brown);
  for (let x = 35; x < 77; x += 2) put(x, inBottom + 5, C.brownLight);
  rect(34, inBottom + 3, 1, 10, C.ink);
  rect(77, inBottom + 3, 1, 10, C.ink);
}

/** The flap thrown back over the top, a lighter half round with its seam, and the strap and buckle hanging over the rim. */
function bagFlap({ put, rect }: BagBrush): void {
  for (let y = 0; y < BAG_TOP + 2; y++) {
    const t = 1 - y / (BAG_TOP + 2);
    const halfW = Math.round(46 * Math.sqrt(Math.max(0, 1 - t * t * 0.55)));
    const l = 56 - halfW, r = 55 + halfW;
    if (y === 0) rect(l + 6, y, r - l - 11, 1, C.ink);
    else if (y < 3) {
      put(l + 4 - y, y, C.ink);
      put(r - 4 + y, y, C.ink);
      rect(l + 5 - y, y, r - l - 9 + 2 * y, 1, C.brownLight);
    } else {
      for (let x = l; x <= r; x++) put(x, y, x === l || x === r ? C.ink : y === 3 ? C.honey : C.brownLight);
      if (y > 4 && y < BAG_TOP - 1) {
        put(l + 3, y, y % 3 ? C.brown : C.brownLight);
        put(r - 3, y, y % 3 ? C.brown : C.brownLight);
      }
    }
  }
  rect(52, BAG_TOP - 2, 8, 10, C.brownDark);
  rect(51, BAG_TOP - 2, 1, 10, C.ink);
  rect(60, BAG_TOP - 2, 1, 10, C.ink);
  rect(51, BAG_TOP + 8, 10, 1, C.ink);
  rect(53, BAG_TOP + 3, 6, 4, C.gold);
  rect(54, BAG_TOP + 4, 4, 2, C.brownDark);
  put(53, BAG_TOP + 3, C.goldLight);
}

function bagArrow({ put }: BagBrush, x: number, y: number, up: boolean): void {
  for (let k = 0; k < 4; k++) for (let i = -k; i <= k; i++) put(x + i, up ? y + k : y + 3 - k, k === 3 ? C.honeyDark : C.honey);
}
