import type { SkyPhase } from '../../../../../core/sky/skyPhase';
import type { Bitmap } from '../../bitmap';
import type { LiveRecorder } from '../../paint/live';
import { KERI_HOURS, type Hour, type Material } from '../keriPalette';

/**
 * The painter's kit: the things that turn up in more than one picture of Keri (a boulder, a pebble, a tuft of grass,
 * a bush), each painted by one function that every scene calls, from the shared palette: one set of
 * templates, notes and sprites for the common things (stones, foliage), in types and options that grow and are refined
 * over time, and a scene that needs its own element still paints it (d124).
 *
 * Three levels: a **family** (stones), its **types** (boulder, pebble: one `KitItem` each) and a type's **variants**
 * (small, in the water, in the foreground: named sets of its options). `npm run art:render -- kit` paints every
 * variant on one sheet to pick from. The words (the recipe, the model, the atlas) are the family's artist's note in
 * `projects/painter/artists-notes/`. A thing only one scene has stays in that scene's file.
 */

/**
 * A name of a run of colours an item may paint with: a material of the shared palette, or the sea, the sky, a cloud,
 * an ember; or `wood`, the kit's own warm wood (`KIT_WOOD` in `wood.ts`), which a scene that places a wood type names
 * as its own run (`scenePalette({ wood: KIT_WOOD }, ...)`).
 */
export type KitRun = Exclude<Material, 'ink'> | 'sky' | 'cloud' | 'sea' | 'ember' | 'wood';

/**
 * What an item paints through: the scene's pixels and the scene's palette at its hour. A scene makes one (`brushOn`,
 * or its own with its own clipping) and hands it to every item it places.
 */
export interface KitBrush {
  /** Sets one fine pixel to a place of the palette; outside the picture nothing happens. */
  put(x: number, y: number, colour: number): void;
  /** The named tones of the scene's runs (`scenePalette().run`); a material the scene left out of `use` is missing. */
  run: Readonly<Partial<Record<KitRun, readonly number[]>>> & { readonly foam: number; readonly ink: number };
  /** The whole runs, with the colours between the named tones (`scenePalette().fine`). */
  fine: Readonly<Partial<Record<KitRun, readonly number[]>>>;
  hour: Hour;
  /** The side the light comes from in this view at this hour: -1 the left, 1 the right, between for a light nearly behind the viewer. */
  side: number;
  /**
   * For what moves (foam round a rock, a blade in the wind): where the loop stands for a thing whose own `phase` is
   * 0 to 1, as -1 to 1. Left out, the thing stands still (a sheet, a still picture).
   */
  sway?: (phase: number) => number;
  /**
   * Where the loop stands, 0 at its start to just under 1, for what slides along once in a loop (the sea's bands) or
   * comes and goes (a whitecap). Left out, 0: the thing stands as at the loop's start.
   */
  beat?: number;
  /**
   * The wind at a place in the scene's look: how far a blade, a stalk or a branch standing at (`x`, `y`) leans, as a
   * share of its height, the wind's way (`lean` of the motion kit). A gust travels across the picture, so the bend
   * depends on where a thing stands. Left out, things stand straight.
   */
  lean?: (x: number, y: number) => number;
  /**
   * What is painted at a fine pixel before the item, for a thing that lights or wets what lies under it (a lamp's
   * glow): its palette place, and whether a thing of the scene stands there (`thing`) or only the bare sky or sea.
   * Outside the picture, nothing. Left out, the item paints as over bare sky.
   */
  under?: (x: number, y: number) => { colour: number; thing: boolean } | undefined;
  /**
   * Live water (`paint/live.ts`): what moves on the water (its strokes, the bands round a post) is recorded here and
   * not painted, and the game lights it as it runs. Left out, it is painted in the loop's look.
   */
  live?: LiveRecorder;
}

/** The runs of a scene's palette as a brush takes them: any `scenePalette()`, whatever materials it names. */
export type KitRuns = Pick<KitBrush, 'run' | 'fine'>;

/** How far an item reaches from the point it is placed at (`x`, `foot`), in fine pixels: for the sheet and for a scene that must make room. */
export interface KitBox {
  left: number;
  right: number;
  up: number;
  down: number;
}

/** The families of the kit; each has an artist's note of the same name. */
export const KIT_FAMILIES = ['stones', 'grass', 'bushes', 'trees', 'paths', 'lights', 'water', 'wood'] as const;
export type KitFamily = (typeof KIT_FAMILIES)[number];

/**
 * How far a type has come. `picked`: it was chosen as the house way (`model` says which scene is the model
 * and why). `candidate`: it is painted and on the sheet for the maintainer to judge; a scene may use it, and says so in its file under `docs/keri/`.
 */
export type KitState = 'picked' | 'candidate';

/** What the sheet stands a variant on, so a rock in the water is seen in water. (A scene's own ground is the scene's: `kit.md` on fills.) */
export type KitStand = 'shingle' | 'sea' | 'grass';

/** One type of a family: what it is, where its recipe is, and the function that paints it. `O` are its options. */
export interface KitItem<O extends object> {
  /** `family/type`, the name painters and the sheet use: `stones/boulder`. */
  id: `${KitFamily}/${string}`;
  family: KitFamily;
  /** One line for the sheet and the notes: what the type is and where it belongs. Not shown in the game. */
  about: string;
  state: KitState;
  /** The scene it was lifted from and the choice that made it the model, or who proposed it. */
  model: string;
  /** The family's artist's note, under `projects/painter/artists-notes/`. */
  note: `${string}.md`;
  /** The words that find its examples in the atlas (`refcat.py find --tags ...`). */
  atlas: string;
  /** The runs of colours its options may ask for; a scene that places it names them in its palette's `use`. */
  uses: readonly KitRun[];
  /** The options as they are when a scene names none. */
  options: O;
  /** Named sets of options to choose from; each is painted on the sheet. The first is the plain one. */
  variants: Readonly<Record<string, Partial<O>>>;
  box(o: O): KitBox;
  ground?(o: O): KitStand;
  /**
   * For a thing that hangs in the air (a lantern): how many rows under its `foot` the sheet's patch of sky reaches
   * before its stand begins. Left out, the stand begins a little over the foot, as under a thing that stands on it.
   */
  skyline?(o: O): number;
  /** Paints it standing at column `x` with its foot on row `foot`. The same `seed` gives the same thing, another seed another: no two alike. */
  paint(brush: KitBrush, x: number, foot: number, o: O, seed: number): void;
}

/** A type as the sheet and the tests see it: its options hidden behind its variants' names. */
export interface KitEntry extends Omit<KitItem<object>, 'options' | 'variants' | 'box' | 'ground' | 'skyline' | 'paint'> {
  variants: readonly string[];
  box(variant: string): KitBox;
  ground(variant: string): KitStand;
  skyline(variant: string): number | undefined;
  paint(brush: KitBrush, x: number, foot: number, variant: string, seed: number): void;
}

/** An item's options for one of its variants, with `over` laid on top: what a scene passes to `paint`. */
export function optionsOf<O extends object>(item: Pick<KitItem<O>, 'id' | 'options' | 'variants'>, variant?: string, over: Partial<O> = {}): O {
  if (variant !== undefined && !(variant in item.variants)) throw new Error(`kit: ${item.id} has no variant "${variant}" (it has ${Object.keys(item.variants).join(', ')})`);
  return { ...item.options, ...(variant === undefined ? {} : item.variants[variant]), ...over };
}

/** An item for the kit's list. */
export function entry<O extends object>(item: KitItem<O>): KitEntry {
  const { variants, box, ground, skyline, paint } = item;
  return {
    id: item.id, family: item.family, about: item.about, state: item.state, model: item.model, note: item.note, atlas: item.atlas, uses: item.uses,
    variants: Object.keys(variants),
    box: (variant) => box(optionsOf(item, variant)),
    ground: (variant) => ground?.(optionsOf(item, variant)) ?? 'shingle',
    skyline: (variant) => skyline?.(optionsOf(item, variant)),
    paint: (brush, x, foot, variant, seed) => paint(brush, x, foot, optionsOf(item, variant), seed),
  };
}

/**
 * The scene's answer about the ground a fill paints (`KitFill`), pixel by pixel: a slope that falls away from its top
 * edge toward the viewer, with its own light, a place trodden bare, grass kept short round it, and places where
 * something already lies. The kit never reads a scene's plan itself; the scene answers from it.
 */
export interface KitGround {
  /** The region's columns, 0 to `width` - 1, and its rows, 0 to `height` - 1. */
  width: number;
  height: number;
  /** The slope's top row in a column (a hill's crest), also a little outside the region. */
  edge(x: number): number;
  /** How far down the slope a pixel is, in rows that widen toward the viewer: 0 on the top edge. */
  down(x: number, y: number): number;
  /** The row that lies `down` rows down the slope in a column: the inverse of `down`. */
  row(x: number, down: number): number;
  /** The slope's own light at a pixel, before its swells, 0 dark to 1 light. */
  light(x: number, y: number): number;
  /** Below 1 on bare trodden earth, its rim to about 1.12, open grass above. */
  trodden(x: number, y: number): number;
  /** Below 1 where the grass is kept short (a lawn round a fire), wild from about 1.55. */
  short(x: number, y: number): number;
  /** Whether a thing may be laid here: not on the trodden place, not where a being stands. */
  free(x: number, y: number): boolean;
  /** Whether a stone or a cushion already lies here, so no blade grows. Outside the region: false. */
  bare(x: number, y: number): boolean;
  /** Marks a pixel as covered: what is laid after it grows round it. */
  cover(x: number, y: number): void;
}

/**
 * A type that is not placed by its foot but paints a whole region, asking the scene about its ground at every pixel
 * (grass blades over a slope, the slope's swells, gravel, moss). It keeps the rules of a type with "inside its box"
 * read as "inside the region, only where the ground lets it, never on what is covered". `G` is what it asks the
 * ground: a slope (`KitGround`) for the grass; another fill may bring its own (a path: how far along, how far across).
 */
export interface KitFill<O extends object, G = KitGround> extends Omit<KitItem<O>, 'box' | 'ground' | 'paint'> {
  paint(brush: KitBrush, ground: G, o: O, seed: number): void;
  /** A plain ground of its kind, `width` by `height`, for the sheet and the tests to paint it on. */
  sample(o: O, width: number, height: number): G;
}

/** A fill as the sheet and the tests see it: its options hidden behind its variants' names, its ground its own sample. */
export interface KitFillEntry extends Omit<KitFill<object, unknown>, 'options' | 'variants' | 'paint' | 'sample'> {
  variants: readonly string[];
  /** Paints a variant on its own plain ground, `width` by `height`; returns that ground. */
  paint(brush: KitBrush, width: number, height: number, variant: string, seed: number): unknown;
}

/** A fill for the kit's list of fills. */
export function fillEntry<O extends object, G>(fill: KitFill<O, G>): KitFillEntry {
  const { variants, paint, sample } = fill;
  return {
    id: fill.id, family: fill.family, about: fill.about, state: fill.state, model: fill.model, note: fill.note, atlas: fill.atlas, uses: fill.uses,
    variants: Object.keys(variants),
    paint: (brush, width, height, variant, seed) => {
      const o = optionsOf(fill, variant), ground = sample(o, width, height);
      paint(brush, ground, o, seed);
      return ground;
    },
  };
}

/** A run of the brush by name; says which item wanted it when the scene's palette left it out. */
export function runOf(runs: KitBrush['run'] | KitBrush['fine'], name: KitRun, item: string): readonly number[] {
  const run = runs[name];
  if (!run) throw new Error(`kit: ${item} paints with "${name}", which this scene's palette leaves out; add it to the \`use\` of its scenePalette()`);
  return run;
}

/** A brush that paints into `bitmap` from `palette` at an hour, lit from `side`: what a scene with no clipping of its own uses, and the sheet. */
export function brushOn(bitmap: Bitmap, palette: KitRuns, phase: SkyPhase, side: number, moves: Pick<KitBrush, 'sway' | 'lean' | 'beat'> = {}): KitBrush {
  const { width, height, pixels } = bitmap;
  const bare = new Set([...(palette.fine.sky ?? []), ...(palette.fine.sea ?? [])]);
  return {
    put(x, y, colour) {
      const px = Math.round(x), py = Math.round(y);
      if (px >= 0 && py >= 0 && px < width && py < height) pixels[py * width + px] = colour;
    },
    run: palette.run,
    fine: palette.fine,
    hour: KERI_HOURS[phase],
    side,
    ...moves,
    // what is painted under a pixel; the bare sky and sea are no thing (a lamp lays its halo there, its streaks on the sea)
    under(x, y) {
      const px = Math.round(x), py = Math.round(y);
      if (px < 0 || py < 0 || px >= width || py >= height) return undefined;
      const colour = pixels[py * width + px]!;
      return { colour, thing: colour !== 0 && !bare.has(colour) };
    },
  };
}
