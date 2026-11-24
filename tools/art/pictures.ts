import { readFileSync } from 'node:fs';
import { docksPlan } from '../../src/core/layout/docks.ts';
import { lanternPlan } from '../../src/core/layout/lantern.ts';
import { keriMapPlan } from '../../src/core/layout/keriMap.ts';
import { crossroadsPlan } from '../../src/core/layout/crossroads.ts';
import { knollPlan } from '../../src/core/layout/knoll.ts';
import { PORT_MOORED, portPlan } from '../../src/core/layout/port.ts';
import { roomPlan } from '../../src/core/layout/room.ts';
import { squarePlan } from '../../src/core/layout/square.ts';
import { terracePlan } from '../../src/core/layout/terrace.ts';
import type { SkyPhase } from '../../src/core/sky/skyPhase.ts';
import { loadWorld, type World } from '../../src/core/world/world.ts';
import { privatePortrait } from '../../src/game/room/privatePortrait.ts';
import { blit, createBitmap, type Bitmap } from '../../src/game/ui/pixel/bitmap.ts';
import { docksPalette, docksRuns, paintDocks } from '../../src/game/ui/pixel/keri/docksPicture.ts';
import { lanternPalette, lanternRuns, paintLantern } from '../../src/game/ui/pixel/keri/lanternPicture.ts';
import { APART, scenePalette } from '../../src/game/ui/pixel/keri/keriPalette.ts';
import { crossroadsPalette, crossroadsRuns, paintCrossroads } from '../../src/game/ui/pixel/keri/crossroadsPicture.ts';
import { knollPalette, paintKnoll } from '../../src/game/ui/pixel/keri/knollPicture.ts';
import { smokeFrames } from '../../src/game/ui/pixel/paint/smoke.ts';
import { mapRuns, paintMap } from '../../src/game/ui/pixel/keri/mapPicture.ts';
import { BEAM_HALF_TURN_MS, drawBeam } from '../../src/game/ui/pixel/keri/beam.ts';
import { paintPort, portPalette, portRuns, portStill } from '../../src/game/ui/pixel/keri/portPicture.ts';
import { roomArt } from '../../src/game/ui/pixel/keri/roomLife.ts';
import { paintSquare, squarePalette, squareRuns } from '../../src/game/ui/pixel/keri/squarePicture.ts';
import { paintTerrace, TERRACE_SMOKE_RISE, terracePalette, terraceRuns } from '../../src/game/ui/pixel/keri/terracePicture.ts';
import type { Overlay } from '../../src/game/ui/pixel/pack.ts';
import type { LiveWater } from '../../src/game/ui/pixel/paint/live.ts';
import { liveWaterAt } from '../../src/game/ui/pixel/liveWater.ts';
import { GUST_MS } from '../../src/game/ui/pixel/windMotion.ts';
import { paintRoom, roomPalette, roomRuns, roomViewRuns } from '../../src/game/ui/pixel/keri/roomPicture.ts';
import type { RunKind } from './sceneChecks.ts';

/**
 * Keri's pictures as the art tools see them (`npm run art:render`, `npm run art:check`) and as the rules' test holds
 * them (`pictureRules.test.ts`): each painted at an hour, with what the checks need to know of it. What moves in the
 * game is shown in one of its looks. Every picture the build paints is here (`KERI_PICTURES` in `tools/vite-keri.ts`;
 * the test fails for one that is missing), so a new scene is held to the same rules as the others.
 */

export interface ToolPicture {
  bitmap: Bitmap;
  palette: readonly number[];
  /** Its palette by day: the runs are judged in the day's colours, which an hour only lights. */
  day: readonly number[];
  /** The horizon's row, in fine pixels, where the picture has one. */
  horizon?: number;
  /** The picture's clouds, each its own bitmap, where it has some. */
  clouds?: readonly Bitmap[];
  /** Its runs of colours: the places in its palette of each, dark to light. Every painted picture names them. */
  runs: Readonly<Record<string, readonly number[]>>;
  /** What kind each run is where it is not a material: a sky or a light is held to the steps only. */
  kinds?: Readonly<Record<string, RunKind>>;
  /** Runs that are handfuls of separate colours (a flower's, a rose's): shown, never judged. */
  apart?: ReadonlySet<string>;
  /** True when its runs are Keri's shared palette (`scenePalette()`): another scene may be the one that uses a run. */
  shared?: boolean;
  /**
   * True for a lit set (its light is computed, not laid by hand): it keeps short runs and strong dither, so the light
   * lands in few flat tones. Long runs made the room look 3D (d111).
   */
  banded?: boolean;
  /** Everything else of it the game shows: its other looks and what moves. Counted for which colours are used. */
  moving: readonly Bitmap[];
}

/** The kinds of the runs of Keri's shared palette that are no material. */
const SHARED_KINDS: Readonly<Record<string, RunKind>> = { sky: 'sky', cloud: 'sky', sea: 'sky', ember: 'light' };

let keri: World | undefined;
/** The island as shipped, read once. */
const world = (): World => (keri ??= loadWorld(JSON.parse(readFileSync('content/world/keri.json', 'utf8')) as unknown));

/** Live water (`paint/live.ts`) as it stands at its first moment, in a middling wind: laid like any other layer. */
const water = (w: LiveWater) => liveWaterAt(w, 0, GUST_MS[1]!);

/** A copy of `base` with `over` laid on it. */
function laid(base: Bitmap, ...over: { bitmap: Bitmap; x: number; y: number }[]): Bitmap {
  const out = createBitmap(base.width, base.height);
  out.pixels.set(base.pixels);
  for (const o of over) blit(out, o.bitmap, o.x, o.y);
  return out;
}

export const PICTURES: Record<string, (phase: SkyPhase) => ToolPicture> = {
  room(phase) {
    const art = roomArt(privatePortrait(null));
    const plan = roomPlan({ w: art.portrait.width, h: art.portrait.height });
    const picture = paintRoom(plan.fine, plan.camera, phase, plan, art);
    // each object's second look is counted too (ft_1_20.AC15)
    const moving = [...picture.looks.slice(1), ...[picture.flames, picture.shimmer, picture.kiur, picture.kiurAwake, picture.zzz, picture.steam, picture.metronome, picture.shield, ...Object.values(picture.awake)].flatMap((o) => o.frames)];
    // the island in its windows is painted from the shared runs, which lie after the room's own in its palette (d128)
    return { bitmap: picture.looks[0]!, palette: picture.palette, day: roomPalette('day'), runs: { ...roomRuns(), ...roomViewRuns() }, kinds: { ...SHARED_KINDS, fire: 'light' }, banded: true, moving };
  },
  map(phase) {
    const picture = paintMap(keriMapPlan(world()), phase);
    // the clouds drift in the game; here they stand in a row over the map's top
    let x = 20;
    const clouds = picture.clouds.map((bitmap) => {
      const at = { bitmap, x, y: 8 };
      x += bitmap.width + 40;
      return at;
    });
    // the beam the game draws as it turns (`beam.ts`), at four moments of a half turn and the day's glint
    const beam = [0, 1, 2, 3].map((k) => {
      const pixels = new Uint8Array(picture.beam.w * picture.beam.h);
      drawBeam(picture.beam, (k * BEAM_HALF_TURN_MS) / 4 + 520, pixels);
      return { width: picture.beam.w, height: picture.beam.h, pixels };
    });
    const moving = [...picture.frames.slice(1), ...beam];
    // the map's palette is the same at every hour: the hour picks other places of it
    return { bitmap: laid(picture.frames[0]!, ...clouds), palette: picture.palette, day: picture.palette, clouds: picture.clouds, runs: mapRuns(), kinds: { seaDay: 'sky', seaNight: 'sky', seaTwilight: 'sky', moon: 'light' }, moving };
  },
  knoll(phase) {
    const plan = knollPlan();
    const picture = paintKnoll(world(), plan, phase);
    // the clouds drift in the game; here they stand where they are painted, behind the stems, as with reduced motion
    const at = (o: Overlay, frame: number) => ({ bitmap: o.frames[frame]!, x: o.x, y: o.y });
    const smoke = smokeFrames(1, -1, plan.fire, picture.smoke);
    return {
      bitmap: laid(picture.frames[0]!, water(picture.water), ...picture.clouds, at(picture.fore, 0), at(picture.embers, 1), at(smoke, 0)),
      palette: picture.palette,
      day: knollPalette('day'),
      horizon: plan.horizon,
      clouds: picture.clouds.map((c) => c.bitmap),
      runs: scenePalette().fine,
      kinds: SHARED_KINDS,
      apart: APART,
      shared: true,
      moving: [...picture.frames.slice(1), ...picture.fore.frames, ...picture.embers.frames, ...smoke.frames],
    };
  },
  crossroads(phase) {
    const plan = crossroadsPlan();
    const picture = paintCrossroads(world(), plan, phase);
    // the clouds drift in the game; here they stand where they are painted, behind what stands before the sky
    return {
      bitmap: laid(picture.frames[0]!, water(picture.water), ...picture.clouds, { bitmap: picture.fore.frames[0]!, x: picture.fore.x, y: picture.fore.y }),
      palette: picture.palette,
      day: crossroadsPalette('day'),
      horizon: plan.horizon,
      clouds: picture.clouds.map((c) => c.bitmap),
      runs: crossroadsRuns(),
      kinds: SHARED_KINDS,
      apart: APART,
      shared: true,
      moving: [...picture.frames.slice(1), ...picture.fore.frames],
    };
  },
  docks(phase) {
    const plan = docksPlan();
    const picture = paintDocks(world(), plan, phase);
    // the clouds drift in the game; here they stand where they are painted, as with reduced motion
    const at = (o: Overlay, frame: number) => ({ bitmap: o.frames[frame]!, x: o.x, y: o.y });
    return {
      bitmap: laid(picture.frames[0]!, water(picture.water), ...picture.clouds, at(picture.fore, 0), at(picture.lamp, 1)),
      palette: picture.palette,
      day: docksPalette('day'),
      horizon: plan.horizon,
      clouds: picture.clouds.map((c) => c.bitmap),
      runs: docksRuns(),
      kinds: SHARED_KINDS,
      apart: APART,
      shared: true,
      moving: [...picture.frames.slice(1), ...picture.fore.frames, ...picture.lamp.frames],
    };
  },
  lantern(phase) {
    const plan = lanternPlan();
    const picture = paintLantern(world(), plan, phase);
    // the clouds drift in the game; here they stand where they are painted, and the light shows its middle look
    const at = (o: Overlay, frame: number) => ({ bitmap: o.frames[frame]!, x: o.x, y: o.y });
    return {
      bitmap: laid(picture.frames[0]!, water(picture.water), ...picture.clouds, at(picture.fore, 0), at(picture.light, 1)),
      palette: picture.palette,
      day: lanternPalette('day'),
      horizon: plan.horizon,
      clouds: picture.clouds.map((c) => c.bitmap),
      runs: lanternRuns(),
      kinds: SHARED_KINDS,
      apart: APART,
      shared: true,
      moving: [...picture.frames.slice(1), ...picture.fore.frames, ...picture.light.frames],
    };
  },
  terrace(phase) {
    const plan = terracePlan();
    const picture = paintTerrace(world(), plan, phase);
    // the clouds drift in the game; here they stand where they are painted, the lamp shows its middle look, and the
    // pennant stands out straight (the game flaps it); the grill's smoke stands in its first look, none at night
    const at = (o: Overlay, frame: number) => ({ bitmap: o.frames[frame]!, x: o.x, y: o.y });
    const smoke = smokeFrames(1, -1, plan.fire, picture.smoke, TERRACE_SMOKE_RISE);
    return {
      bitmap: laid(picture.frames[0]!, water(picture.water), ...picture.clouds, at(picture.fore, 0), at(picture.lamp, 1), at(picture.coals, 1), ...picture.torches.map((torch) => at(torch, 1)), ...picture.blown, ...(phase === 'night' ? [] : [at(smoke, 0)])),
      palette: picture.palette,
      day: terracePalette('day'),
      horizon: plan.horizon,
      clouds: picture.clouds.map((c) => c.bitmap),
      runs: terraceRuns(),
      kinds: SHARED_KINDS,
      apart: APART,
      shared: true,
      moving: [...picture.lamp.frames, ...picture.coals.frames, ...picture.torches.flatMap((torch) => torch.frames), ...picture.blown.map((b) => b.bitmap), ...smoke.frames],
    };
  },
  port(phase) {
    const plan = portPlan();
    const picture = paintPort(plan, phase);
    // the surface as it stands, the boats of today at their berths; the underwater stage and every boat are counted too
    return {
      bitmap: portStill(picture, plan, PORT_MOORED),
      palette: picture.palette,
      day: portPalette('day'),
      horizon: plan.horizon,
      clouds: picture.clouds.map((c) => c.bitmap),
      runs: portRuns(),
      kinds: SHARED_KINDS,
      apart: APART,
      shared: true,
      moving: [...picture.frames.slice(1), ...picture.fore.frames, ...picture.lamp.frames, ...picture.front.frames, ...picture.deep, ...picture.deepThings.frames, ...Object.values(picture.boats).flatMap((b) => b.frames)],
    };
  },
  square(phase) {
    const plan = squarePlan();
    const picture = paintSquare(plan, phase);
    // the clouds drift in the game; here they stand where they are painted, and the lamps show their middle look
    const at = (o: Overlay, frame: number) => ({ bitmap: o.frames[frame]!, x: o.x, y: o.y });
    return {
      bitmap: laid(picture.frames[0]!, ...picture.clouds, at(picture.fore, 0), at(picture.lamp, 1)),
      palette: picture.palette,
      day: squarePalette('day'),
      horizon: plan.horizon,
      clouds: picture.clouds.map((c) => c.bitmap),
      runs: squareRuns(),
      kinds: SHARED_KINDS,
      apart: APART,
      shared: true,
      moving: [...picture.fore.frames, ...picture.lamp.frames],
    };
  },
};
