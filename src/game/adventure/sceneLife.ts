import type { Rect } from '../../core/layout/rect';
import { crossroadsPlan, crossroadsView } from '../../core/layout/crossroads';
import { docksPlan, docksView } from '../../core/layout/docks';
import { KNOLL_MOON, knollPlan, knollView } from '../../core/layout/knoll';
import { PORT_MOORED, portPlan, portView } from '../../core/layout/port';
import { terracePlan, terraceView, TORCH_SPARKS } from '../../core/layout/terrace';
import type { SceneLook } from '../../core/sky/sceneLook';
import type { SkyPhase } from '../../core/sky/skyPhase';
import type { Bitmap } from '../ui/pixel/bitmap';
import { DOCKS_WAY } from '../ui/pixel/keri/docksPicture';
import { PAINTED } from '../ui/pixel/keri/keriPictures';
import { boatStill } from '../ui/pixel/keri/portBoats';
import { PORT_WAY, portMoorings, portStill, type PortSwimmers } from '../ui/pixel/keri/portPicture';
import { TERRACE_MOON, TERRACE_SMOKE_RISE, TERRACE_WAY } from '../ui/pixel/keri/terracePicture';
import type { LoadedPictures, Overlay } from '../ui/pixel/pack';
import type { LiveWater } from '../ui/pixel/paint/live';
import type { WindWay } from '../ui/pixel/paint/motion';
import { THREAD, smokeThread, type SmokeTones } from '../ui/pixel/paint/smoke';
import { glowAt } from '../ui/pixel/flicker';
import type { LiveLayer } from '../ui/pixel/PixelScene';
import { leapAt, type LeapTones } from '../ui/pixel/leap';
import { firefliesAt, mothsAt, sparksAt, type Mote } from '../ui/pixel/motes';
import { bobAt, type Blown } from '../ui/pixel/sway';
import type { Air } from '../ui/pixel/windField';
import { SCENE_LIVING, type Living } from './sceneLiving';

/** What every painted place has: its palette, the picture in each look with its sky bare, the clouds, and what stands before the sky. */
export interface ScenePicture {
  readonly palette: readonly number[];
  readonly frames: readonly Bitmap[];
  readonly clouds: readonly { readonly x: number; readonly y: number; readonly bitmap: Bitmap }[];
  readonly fore: Overlay;
  /** What moves on its water, lit as the game runs (`paint/live.ts`), where it has some. */
  readonly water?: LiveWater;
  /** The gulls' colour, a place of the palette, where the place has gulls (`SceneLife.gulls`). */
  readonly gull?: number;
}

/** A layer laid over the picture, in order: its frames shown one at a time, `ms` each, in `order`. */
export interface LifeLayer {
  readonly overlay: { readonly x: number; readonly y: number; readonly frames: readonly Bitmap[] };
  readonly ms: number;
  /** True for a light that breathes: its looks dissolve into each other instead of stepping (`PixelScene.cycle`). */
  readonly fade?: boolean;
  readonly order?: readonly number[];
  /**
   * For a light that wanders (a fire's, a lantern's): how strong it is at a time, 0 its first look to its last
   * (`flicker.ts`); its looks are then blended at that strength (`PixelScene.blend`) instead of shown in `order`.
   */
  readonly level?: (time: number) => number;
  /** True for the layer a script's figures from the picture (`SceneLife.figures`) pass behind, such as a quay before the boats. */
  readonly cover?: boolean;
  /**
   * For a thing afloat (a moored boat): how far it rides up or down at a time, in fine pixels (`sway.ts` `bobAt`). The
   * game moves it by parts of a pixel, so it rises and settles smoothly.
   */
  readonly bob?: (time: number) => number;
  /** What the wind moves on it (a pennant, washing; `sway.ts`), in the overlay's own pixels: drawn afresh on the place's wind, riding with it. */
  readonly blown?: readonly Blown[];
}

/**
 * A second view of a place, under its picture (the harbour's underwater world, ft_1_19; clicking
 * on the water pans the view downwards and opens the underwater world): a press on `diveAt` pans the view down to it,
 * and a press on `riseAt` or Back pans up again. Its picture is a tall cut's lower part, `depth` fine pixels down.
 */
export interface SceneDive<P extends ScenePicture = ScenePicture> {
  /** Where a press dives and where one rises again, layout cells from the picture's corner. */
  readonly diveAt: Rect;
  readonly riseAt: Rect;
  /** How far down the deep view starts in the tall cut (fine pixels). */
  readonly depth: number;
  /** The deep view in its looks: what changes in tone from look to look, which the game blends. */
  deep(picture: P): readonly Bitmap[];
  /** What changes its place from look to look down there, laid over `deep` and stepped whole (a blend would show it twice). */
  things?(picture: P): Overlay;
  /** The view on top as it stands, every layer laid: where a dive's pan starts and a rise's ends. */
  still(picture: P): Bitmap;
  /** Where the beings stand down there (as `SceneLife.spots`). */
  readonly spots: readonly { readonly feet: { x: number; y: number }; readonly button: Rect }[];
  /** What swims down there, each on its own course (`swimMotion.ts`). */
  swimmers?(picture: P): PortSwimmers;
  /** What sways down there in the current (kelp; `sway.ts`), in the deep view's pixels. */
  blown?(picture: P): readonly Blown[];
}

/**
 * How one painted place lives (ft_1_24.AC1, WP-05): what is the picture's and not the scene data's. Where the picture sits
 * on the screen, its wind and clouds, the layers that move over it (embers, smoke, a lamp), and the places its beings stand.
 * `AdventureScene` draws any scene with its life; a new place adds one entry here and a `content/scenes/<id>.json`.
 */
export interface SceneLife<P extends ScenePicture = ScenePicture> {
  readonly pictures: LoadedPictures<SkyPhase, P>;
  /** The picture's box and the strip under it, in layout cells, for the screen and the strip's rows (0 under the band). */
  view(screen: { w: number; h: number }, stripRows: number): { picture: Rect; strip: Rect };
  /** The horizon's row (fine pixels): a cloud higher in the sky is nearer and goes faster. */
  readonly horizon: number;
  /** The way the wind blows in this view. */
  readonly way: WindWay;
  /** However little of the sky the day's cover leaves, at least this many clouds show. */
  readonly leastClouds: number;
  /** Boxes of the sky (fine pixels) the clouds start off at this hour, so something is not hidden the moment the scene opens. */
  clearAt?(phase: SkyPhase): { x: number; y: number; w: number; h: number }[];
  /**
   * What lives here, kind by kind (fire, water, wind, birds, small life), or `none:` and why (`sceneLiving.ts`): asked of
   * every place, so no new one is left a still picture.
   */
  readonly living: Living;
  /** The layers over what stands before the sky, back to front. */
  layers(picture: P, look: SceneLook, seed: number): LifeLayer[];
  /** What the scene draws afresh as it runs, over the layers (a thread of smoke the gusts bend), on the place's wind. */
  live?(picture: P, look: SceneLook, air: Air, seed: number): LiveLayer[];
  /** Motes that glow over the picture (`motes.ts`: sparks, fireflies), each source with the most it shows at once. */
  motes?(picture: P, look: SceneLook, air: Air, seed: number): { source: (time: number) => readonly Mote[]; most: number }[];
  /** The gulls over the sea by day (`flock.ts`): how many, how wide their wings, and the box of sky they keep to (fine pixels). */
  readonly gulls?: { readonly n: number; readonly span: number; readonly box: { x: number; y: number; w: number; h: number } };
  /** Where characters stand: feet in fine pixels and a button in layout cells, both from the picture's corner. */
  readonly spots: readonly { readonly feet: { x: number; y: number }; readonly button: Rect }[];
  /** A second view under this one, where the place has one. */
  readonly dive?: SceneDive<P>;
  /**
   * The figures this picture paints for a script's actors, by the actor's sheet id (ft_1_24.AC6): its looks in the picture's
   * palette and lit for the hour, stepped `ms` each, laid behind the layer marked `cover`. The actor file's size and anchor
   * must match the looks (checked in `pictureFigures.test.ts`).
   */
  figures?(picture: P): Readonly<Record<string, PictureFigure>>;
}

/** A script's figure the picture paints (`SceneLife.figures`). */
export interface PictureFigure {
  readonly frames: readonly Bitmap[];
  readonly ms: number;
}

const knoll = knollPlan();
/** Where the fireflies of the knoll fly: over the long grass before the fire (fine pixels of the picture). */
const KNOLL_FIREFLIES = { x: 170, y: 125, w: 420, h: 105 } as const;

/**
 * A fire's thread of smoke drawn as the game runs (`paint/smoke.ts`), on the place's wind (`windField.ts`): a gust bends
 * its top further over and hurries its waves, a lull lets it stand up again.
 */
function smokeLayer(air: Air, foot: { x: number; y: number }, tones: SmokeTones, rise: number = THREAD.rise): LiveLayer {
  // a gust bends it a little further than the day's wind alone, never so far that its top lies flat (art review 1)
  const bend = (t: number): number => Math.max(0, air.wind * (0.75 + 0.4 * air.gust(t, foot.x)) + 0.3 * (air.gust(t, foot.x) - 0.5));
  const most = Math.ceil((air.wind * 1.15 + 0.15) * THREAD.drift) + 16;
  const left = air.way < 0 ? most : 16, right = air.way < 0 ? 16 : most, top = rise + 4;
  const w = left + right, h = top + 1;
  return {
    x: foot.x - left, y: foot.y - top, w, h,
    draw: (time, out) => smokeThread(air.time(time, foot.x), bend(time), air.way, { x: left, y: top }, tones, (x, y, tone) => {
      if (x >= 0 && y >= 0 && x < w && y < h) out[y * w + x] = tone;
    }, rise),
  };
}

/** A lamp of a place is lit from dusk through the night. */
const lampLitAt = (phase: SkyPhase): boolean => phase === 'dusk' || phase === 'night';

/** A stretch of open water where a fish jumps now and then (`leap.ts`), as a layer the game draws afresh. */
function leapLayer(box: { x: number; y: number; w: number; h: number }, tones: LeapTones, seed: number): LiveLayer {
  return { ...box, draw: (time, out) => leapAt(time, box, tones, seed, (x, y, tone) => { out[y * box.w + x] = tone; }) };
}

/** The grassy knoll with the bonfire place (ft_1_19.AC9, d113): the embers' glow and the thread of smoke over the grass. */
const KNOLL_LIFE: SceneLife<NonNullable<ReturnType<typeof PAINTED.knoll.ready>>> = {
  pictures: PAINTED.knoll,
  living: SCENE_LIVING.knoll!,
  view: knollView,
  horizon: knoll.horizon,
  // the wind of this view blows east, to the viewer's left
  way: -1,
  leastClouds: 5,
  // at night the clouds start off the moon
  clearAt: (phase) => (phase === 'night' ? [{ x: KNOLL_MOON.x - KNOLL_MOON.r - 3, y: KNOLL_MOON.y - KNOLL_MOON.r - 3, w: 2 * KNOLL_MOON.r + 6, h: 2 * KNOLL_MOON.r + 6 }] : []),
  layers: (picture) => [
    // the embers glow up and down in no set rhythm (`flicker.ts`)
    { overlay: picture.embers, ms: 0, level: (time) => glowAt(time, picture.embers.frames.length, 3) },
  ],
  // the smoke shows by day and in the half light, not at night (no smoke at night)
  live: (picture, look, air) => (look.phase === 'night' ? [] : [smokeLayer(air, knoll.fire, picture.smoke)]),
  motes: (picture, look, air, seed) => [
    // sparks off the embers, more when they flare
    { source: (time) => sparksAt(time, knoll.fire, air, (t) => glowAt(t, picture.embers.frames.length, 3) / (picture.embers.frames.length - 1), seed), most: 36 },
    // fireflies over the grass from dusk to dawn
    ...(look.phase === 'day' ? [] : [{ source: (time: number) => firefliesAt(time, KNOLL_FIREFLIES, 7, seed), most: 7 }]),
  ],
  gulls: { n: 3, span: 4, box: { x: 150, y: 28, w: 470, h: 46 } },
  spots: knoll.spots,
};

const docks = docksPlan();

/** The docks (ft_1_19, d113): the jetty on the north shore, the lamp at its end flickering at dusk and night. No beings here yet. */
const DOCKS_LIFE: SceneLife<NonNullable<ReturnType<typeof PAINTED.docks.ready>>> = {
  pictures: PAINTED.docks,
  living: SCENE_LIVING.docks!,
  view: docksView,
  horizon: docks.horizon,
  way: DOCKS_WAY,
  leastClouds: 4,
  layers: (picture) => [{ overlay: picture.lamp, ms: 0, level: (time) => glowAt(time, picture.lamp.frames.length, 5) }],
  // moths round the lantern while it is lit
  motes: (_picture, look, _air, seed) => (lampLitAt(look.phase) ? [{ source: (time) => mothsAt(time, docks.lamp, 4, seed), most: 4 }] : []),
  gulls: { n: 3, span: 3, box: { x: 40, y: 14, w: 540, h: 48 } },
  spots: [],
};

const crossroads = crossroadsPlan();

/** The crossroads (d113): the concrete path's fork by the green hut; only the picture's own gust, sea and clouds move. */
const CROSSROADS_LIFE: SceneLife<NonNullable<ReturnType<typeof PAINTED.crossroads.ready>>> = {
  pictures: PAINTED.crossroads,
  living: SCENE_LIVING.crossroads!,
  view: crossroadsView,
  horizon: crossroads.horizon,
  // the wind of this view blows from the south-west, to the viewer's left
  way: -1,
  leastClouds: 4,
  layers: () => [],
  motes: (_picture, look, _air, seed) => (look.phase === 'day' ? [] : [{ source: (time) => firefliesAt(time, { x: 20, y: 140, w: 560, h: 80 }, 8, seed), most: 8 }]),
  gulls: { n: 2, span: 3, box: { x: 20, y: 20, w: 600, h: 56 } },
  spots: crossroads.spots,
};

const port = portPlan();
/** The harbour's open water past the moored boats, between the horizon and the quay's wall (fine pixels): where a fish may jump. */
const PORT_LEAPS = { x: 290, y: port.horizon + 6, w: 340, h: 36 } as const;

/**
 * The southern harbour (ft_1_19): the visitors' boats at their berths behind the quay, rocking, the quay laid again over
 * them, the beacon flickering at dusk and night; and under the water, the reef (`dive`).
 */
const PORT_LIFE: SceneLife<NonNullable<ReturnType<typeof PAINTED.port.ready>>> = {
  pictures: PAINTED.port,
  living: SCENE_LIVING.port!,
  view: portView,
  horizon: port.horizon,
  way: PORT_WAY,
  leastClouds: 4,
  layers: (picture, look, seed) => [
    // each boat rides the swell in its own time, its pennant and washing on the wind
    ...portMoorings(port, PORT_MOORED).map(({ kind, x, y }, k) => {
      const boat = picture.boats[kind];
      return { overlay: { x: boat.x + x, y: boat.y + y, frames: boat.frames }, ms: 0, bob: (time: number) => bobAt(time, k, look.wind, seed), blown: boat.blown };
    }),
    { overlay: picture.front, ms: 0, cover: true },
    { overlay: picture.lamp, ms: 0, level: (time) => glowAt(time, picture.lamp.frames.length, 7) },
  ],
  // a fish jumps now and then in the open water past the boats, and leaves a ring
  live: (picture, _look, _air, seed) => [leapLayer(PORT_LEAPS, picture.leap, seed)],
  // moths round the beacon while it is lit
  motes: (_picture, look, _air, seed) => (lampLitAt(look.phase) ? [{ source: (time) => mothsAt(time, port.lamp, 3, seed), most: 3 }] : []),
  gulls: { n: 3, span: 3, box: { x: 20, y: 12, w: 600, h: 44 } },
  spots: port.spots,
  // the teacher's galleon (ft_1_27.AC2; for now the galley is the teacher's ship) sails in behind the quay
  figures: (picture) => ({ galleon: { frames: [boatStill(picture.boats.galleon)], ms: 0 } }),
  dive: {
    diveAt: port.diveAt,
    riseAt: port.riseAt,
    depth: port.dive,
    deep: (picture) => picture.deep,
    things: (picture) => picture.deepThings,
    still: (picture) => portStill(picture, port, PORT_MOORED),
    spots: port.deepSpots,
    swimmers: (picture) => picture.swimmers,
    blown: (picture) => picture.kelp,
  },
};

const terrace = terracePlan();

/**
 * The terrace before the warden's house (ft_1_19): the walk out over the beach to its watchtower, the pennant on the
 * tower's staff on the wind and the tower's lantern flickering at dusk and night; the grill's smoke by day, its sparks when the coals glow;
 * the plaza's torches burning at dusk and night.
 */
const TERRACE_LIFE: SceneLife<NonNullable<ReturnType<typeof PAINTED.terrace.ready>>> = {
  pictures: PAINTED.terrace,
  living: SCENE_LIVING.terrace!,
  view: terraceView,
  horizon: terrace.horizon,
  way: TERRACE_WAY,
  leastClouds: 4,
  // at night the clouds start off the moon
  clearAt: (phase) => (phase === 'night' ? [{ x: TERRACE_MOON.x - TERRACE_MOON.r - 3, y: TERRACE_MOON.y - TERRACE_MOON.r - 3, w: 2 * TERRACE_MOON.r + 6, h: 2 * TERRACE_MOON.r + 6 }] : []),
  layers: (picture) => [
    { overlay: picture.lamp, ms: 0, level: (time) => glowAt(time, picture.lamp.frames.length, 9) },
    // the grill's coals light the boards round them, on a beat of their own
    { overlay: picture.coals, ms: 0, level: (time) => glowAt(time, picture.coals.frames.length, 11) },
    // the plaza's torches, each on a beat of its own so no two flicker alike
    ...picture.torches.map((torch, k) => ({ overlay: torch, ms: 0, level: (time: number) => glowAt(time, torch.frames.length, 21 + k) })),
    // the pennant flies from the watchtower's staff: a layer of its own with nothing painted on it, only what the wind moves
    { overlay: { x: 0, y: 0, frames: [] }, ms: 0, blown: picture.blown },
  ],
  // the grill's smoke shows by day and in the half light, not at night (as the knoll's: no smoke at night)
  live: (picture, look, air) => (look.phase === 'night' ? [] : [smokeLayer(air, terrace.fire, picture.smoke, TERRACE_SMOKE_RISE)]),
  motes: (_picture, look, air, seed) => (lampLitAt(look.phase) ? [
    // moths round the lantern while it is lit, and a spark off the coals now and then
    { source: (time: number) => mothsAt(time, terrace.lamp, 4, seed), most: 4 },
    { source: (time: number) => sparksAt(time, terrace.fire, air, (t) => 0.25 + 0.2 * glowAt(t, 3, 11) / 2, seed, 6), most: 6 },
    // and off the two torches nearest the eye, on the left by the barrel and left of the walk's mouth
    ...TORCH_SPARKS.map((k) => ({ source: (time: number) => sparksAt(time, { x: terrace.torches[k]!.x, y: terrace.torches[k]!.y - 4 }, air, (t) => 0.2 + 0.25 * glowAt(t, 3, 21 + k) / 2, seed + k, 5), most: 5 })),
  ] : []),
  gulls: { n: 3, span: 3, box: { x: 260, y: 14, w: 360, h: 50 } },
  spots: terrace.spots,
};

/** Each painted place's life by its picture id (`SceneData.picture`). */
export const SCENE_LIVES: Readonly<Record<string, SceneLife>> = {
  knoll: KNOLL_LIFE,
  docks: DOCKS_LIFE,
  crossroads: CROSSROADS_LIFE,
  port: PORT_LIFE,
  terrace: TERRACE_LIFE,
};
