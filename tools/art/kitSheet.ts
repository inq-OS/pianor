import type { SkyPhase } from '../../src/core/sky/skyPhase.ts';
import { blit, createBitmap, type Bitmap } from '../../src/game/ui/pixel/bitmap.ts';
import { renderText } from '../../src/game/ui/pixel/font.ts';
import { scenePalette } from '../../src/game/ui/pixel/keri/keriPalette.ts';
import { KIT, KIT_FILLS } from '../../src/game/ui/pixel/keri/kit/index.ts';
import { KIT_WOOD } from '../../src/game/ui/pixel/keri/kit/wood.ts';
import { brushOn, KIT_FAMILIES, type KitBrush, type KitEntry, type KitFamily, type KitFillEntry, type KitStand } from '../../src/game/ui/pixel/keri/kit/kit.ts';
import { C } from '../../src/game/ui/pixel/palette.ts';

/**
 * The kit's sheet (`npm run art:render -- kit [family] [hour]`): every type of the painter's kit in every variant,
 * each painted a few times from different seeds, with its name under it. What the maintainer picks from, and what a
 * painter looks at before placing a thing (d124). Painted from the shared palette with every material, lit as the
 * docks are (the scene the stones were judged in).
 */

/** The side the light comes from on the sheet at each hour: the docks' (`LIGHT` in docksPicture.ts). */
const SIDE: Record<SkyPhase, number> = { day: -0.35, dawn: 1, dusk: -1, night: -0.5 };
const SEEDS = [11, 23, 37, 53, 71, 89];
const WIDTH = 640;
const GAP = 6;
const LINE = 11;
/** A fill is painted on a patch of its own ground this big. */
const PATCH = { w: 196, h: 84 } as const;

interface Cell {
  item: KitEntry;
  variant: string;
  seeds: readonly number[];
  w: number;
  up: number;
  down: number;
}

function cellOf(item: KitEntry, variant: string): Cell {
  const box = item.box(variant);
  const one = box.left + box.right + 1;
  // a small thing is shown more often: a pebble is one of hundreds
  const seeds = SEEDS.slice(0, one < 24 ? 6 : one < 120 ? 3 : 2);
  const label = renderText(variant, { color: C.cream }).width;
  return { item, variant, seeds, w: Math.max(label, seeds.length * (one + GAP) - GAP), up: box.up, down: box.down };
}

export function kitSheet(phase: SkyPhase, family?: string): { bitmap: Bitmap; palette: readonly number[] } {
  if (family !== undefined && !KIT_FAMILIES.includes(family as KitFamily)) throw new Error(`the kit has no family "${family}" (it has ${KIT_FAMILIES.join(', ')})`);
  const items = KIT.filter((item) => family === undefined || item.family === family);
  const fills = KIT_FILLS.filter((fill) => family === undefined || fill.family === family);
  // every material, and the kit's own wood
  const palette = scenePalette({ wood: KIT_WOOD });
  const ground: Record<KitStand, number> = { shingle: palette.run.shingle[0]!, sea: palette.run.sea[2]!, grass: palette.run.grass[2]! };
  const sky = palette.fine.sky[palette.fine.sky.length - 2]!;

  // lay the rows out first: a heading for each type, then its variants, wrapped at the sheet's width
  const rows: ({ head: Pick<KitEntry, 'id' | 'state' | 'about'> } | { cells: Cell[] } | { fill: KitFillEntry; variants: string[] })[] = [];
  for (const item of items) {
    rows.push({ head: item });
    let line: Cell[] = [], used = GAP;
    for (const variant of item.variants) {
      const cell = cellOf(item, variant);
      if (line.length > 0 && used + cell.w + GAP > WIDTH) { rows.push({ cells: line }); line = []; used = GAP; }
      line.push(cell);
      used += cell.w + GAP * 2;
    }
    if (line.length > 0) rows.push({ cells: line });
  }
  // the fills, each variant on a patch of its own plain ground, as many to a row as fit
  const perRow = Math.max(1, Math.floor((WIDTH - GAP) / (PATCH.w + GAP)));
  for (const fill of fills) {
    rows.push({ head: fill });
    for (let k = 0; k < fill.variants.length; k += perRow) rows.push({ fill, variants: fill.variants.slice(k, k + perRow) });
  }
  const heightOf = (row: (typeof rows)[number]): number => ('head' in row ? LINE * 2 + GAP : 'fill' in row ? PATCH.h + LINE + GAP * 2 : Math.max(...row.cells.map((c) => c.up + c.down)) + GAP * 2 + LINE + GAP);
  const sheet = createBitmap(WIDTH, GAP + rows.reduce((sum, row) => sum + heightOf(row), 0) + (items.length + fills.length === 0 ? LINE + GAP : 0));
  sheet.pixels.fill(C.night);
  const brush = brushOn(sheet, palette, phase, SIDE[phase]);

  let y = GAP;
  if (items.length + fills.length === 0) blit(sheet, renderText(`no type of ${family ?? 'the kit'} yet`, { color: C.dim }), GAP, y);
  for (const row of rows) {
    if ('fill' in row) {
      row.variants.forEach((variant, i) => {
        const x = GAP + i * (PATCH.w + GAP);
        paintFill(brush, row.fill, variant, x, y, sky);
        blit(sheet, renderText(variant, { color: C.cream }), x, y + PATCH.h + 2);
      });
    } else if ('head' in row) {
      const { head } = row;
      blit(sheet, renderText(`${head.id}  (${head.state})`, { color: C.goldLight }), GAP, y);
      blit(sheet, renderText(head.about, { color: C.dim }), GAP, y + LINE);
    } else {
      const up = Math.max(...row.cells.map((c) => c.up)), down = Math.max(...row.cells.map((c) => c.down));
      const foot = y + GAP + up;
      let x = GAP;
      for (const cell of row.cells) {
        // a patch of sky and of ground behind the thing, so its outline and its lit top are judged against both
        const stands = ground[cell.item.ground(cell.variant)];
        // a thing that hangs in the air (a lantern) has its sky reach under it, as far as it says
        const hangs = cell.item.skyline(cell.variant);
        const line = hangs === undefined ? foot - Math.round(Math.min(cell.up, up) * 0.3) : foot + hangs;
        for (let py = y; py < foot + down + GAP; py++) for (let px = x - GAP / 2; px < x + cell.w + GAP / 2; px++) brush.put(px, py, py < line ? sky : stands);
        const one = (cell.w - (cell.seeds.length - 1) * GAP) / cell.seeds.length;
        const box = cell.item.box(cell.variant);
        cell.seeds.forEach((seed, i) => cell.item.paint(brush, Math.round(x + i * (one + GAP) + (one - box.left - box.right) / 2 + box.left), foot, cell.variant, seed));
        blit(sheet, renderText(cell.variant, { color: C.cream }), x, foot + down + GAP + 2);
        x += cell.w + GAP * 2;
      }
    }
    y += heightOf(row);
  }
  return { bitmap: sheet, palette: palette.at(phase) };
}

/**
 * A fill on a patch of its own plain ground at (`x`, `y`): the sky above the slope, then the turf (`grass/swells`)
 * under any other grass fill and under a path, the open sea under the bands on it, so a blade, a cushion, a path or a
 * band is judged on the ground it lies in, then the fill itself.
 */
function paintFill(brush: KitBrush, fill: KitFillEntry, variant: string, x: number, y: number, sky: number): void {
  const at: KitBrush = { ...brush, put: (px, py, c) => { if (px >= 0 && py >= 0 && px < PATCH.w && py < PATCH.h) brush.put(px + x, py + y, c); } };
  for (let py = 0; py < PATCH.h; py++) for (let px = 0; px < PATCH.w; px++) at.put(px, py, sky);
  const turf = KIT_FILLS.find((f) => f.id === 'grass/swells');
  if ((fill.family === 'grass' || fill.family === 'paths') && turf && fill !== turf) turf.paint(at, PATCH.w, PATCH.h, turf.variants[0]!, 1);
  // the bands on the water lie on the open sea
  const water = KIT_FILLS.find((f) => f.id === 'water/sea');
  if (fill.id === 'water/rings' && water) water.paint(at, PATCH.w, PATCH.h, water.variants[0]!, 1);
  fill.paint(at, PATCH.w, PATCH.h, variant, 1);
}
