import keriJson from '../../content/world/keri.json';
import { isTester, openScenes } from '../core/campaign/sceneBeings';
import { ART_DETAIL } from '../core/layout/frame';
import { keriMapPlan, keriMapView } from '../core/layout/keriMap';
import { rectCentre, type Rect } from '../core/layout/rect';
import type { SceneLook } from '../core/sky/sceneLook';
import { t } from '../core/text/strings';
import { loadWorld, type World } from '../core/world/world';
import { contextOf } from './context';
import { openOverlay, startScene } from './scenes';
import { AFTER_MAP, type MapSpot } from '../core/intro/intro';
import { INTRO } from './intro/introContent';
import type { StringKey } from '../core/text/strings';
import { SCENE_SCREENS } from './visit/islandVisit';
import { blit, createBitmap, type Bitmap } from './ui/pixel/bitmap';
import { LiveImage, PixelImage } from './ui/pixel/PixelObjects';
import { drawBeam, type MapBeam } from './ui/pixel/keri/beam';
import { motionAllowed } from './motion';
import { PixelScene } from './ui/pixel/PixelScene';
import { PAINTED } from './ui/pixel/keri/keriPictures';
import { currentLook } from './ui/pixel/sky/skyLooks';
import { cloudCourses, daySky } from './ui/pixel/windMotion';
import { airOf } from './ui/pixel/windField';
import { glowAt } from './ui/pixel/flicker';
import { Flock, gullLooks } from './ui/pixel/flock';
import { GULL_FLIGHT } from './adventure/sceneAir';

/** The island as shipped (content/world/keri.json, d108), validated once. */
const KERI: World = loadWorld(keriJson);
const PLAN = keriMapPlan(KERI);

/** What the map is opened with: the first-run intro's tour of it (ft_1_31.AC6), from the room. */
export interface MapData {
  intro?: boolean;
}

/** The gulls over the map: how many, their wings' span (fine pixels), and how steeply they may turn up or down the picture (seen from above they wheel freely). */
const MAP_GULLS = { n: 4, span: 3, climb: 0.8 } as const;

/** The palest and the darkest colour of a palette, as their places: a gull's white, and the line under it that keeps it seen over the pale lighthouse. */
function extremes(palette: readonly number[]): { palest: number; darkest: number } {
  const light = (rgb: number): number => ((rgb >> 16) & 0xff) + ((rgb >> 8) & 0xff) + (rgb & 0xff);
  let palest = 1, darkest = 1;
  for (let i = 1; i < palette.length; i++) {
    if (light(palette[i]!) > light(palette[palest]!)) palest = i;
    if (light(palette[i]!) < light(palette[darkest]!)) darkest = i;
  }
  return { palest, darkest };
}
/** How often the lamp's beam is drawn afresh as it turns (`beam.ts`): about 30 times a second, so it sweeps. */
const BEAM_STEP_MS = 33;
/**
 * Where each cloud is painted (a share of the screen's width), its row (fine pixels from the top of the picture's
 * middle) and how near it is (0 far, 1 near: the nearer drift faster). They drift with the day's wind and sky
 * (`windMotion.ts`), east, which on a map with north up is to the right.
 */
const CLOUDS = [{ start: 0.08, row: 12, near: 0.7 }, { start: 0.7, row: 244, near: 0.35 }, { start: 0.55, row: 2, near: 1 }] as const;
const WAY = 1;

/** The part of `source` inside `box` (the source's own pixels), as a picture of the box's size. */
function cut(source: Bitmap, box: Rect): Bitmap {
  const out = createBitmap(box.w, box.h);
  blit(out, source, -box.x, -box.y);
  return out;
}

/**
 * The map of Keri (ft_1_18.AC2, AC4): the island as one painted picture (d111, `virtual:keri-pictures`, made when the game
 * is built) seen at a slant in its sea, with what moves laid over it: the sea's second look, the lamp's turning beam and
 * drifting clouds. The room's door opens it; the warden's house and Back return to the room. Each scene the student's level has opened is a button on its painted place (ft_1_19.AC2). The map is painted for the sky phase of the hour, like the room.
 */
export class KeriMapScene extends PixelScene {
  protected override keyboardNavigation = true;
  private look: SceneLook | null = null;
  /** The intro's tour of the map is still to run on this visit (`MapData.intro`). */
  private introDue = false;
  /** What the intro's spotlight can show, as drawn now: in art pixels of the main area. */
  private spots: Partial<Record<MapSpot, Rect>> = {};

  constructor() {
    super('keriMap');
  }

  init(data?: MapData): void {
    this.introDue = data?.intro === true;
  }

  protected override back(): void {
    startScene(this, 'profile');
  }

  /**
   * The intro's tour of the map (ft_1_31.AC6): Kiur under the spotlight shows the island, the first place the student's
   * level has opened and the house; then back to the room for the teacher's knock. Esc skips the rest of the intro there.
   */
  private showIntro(): void {
    if (!this.introDue || !this.sys.isActive()) return;
    this.introDue = false;
    const top = this.mainTopRows;
    const steps = INTRO.map.map((step) => {
      const spot = step.spot ? this.spots[step.spot] ?? null : null;
      return { spot: spot ? { ...spot, y: spot.y + top } : null, text: t(step.line as StringKey) };
    });
    void openOverlay(this, 'intro', { steps }).then((outcome) => startScene(this, 'profile', { intro: outcome === 'read' ? AFTER_MAP : 'skip' }));
  }

  /** Whether the intro's tour of the map is still to run, for the tests. */
  get introPending(): boolean {
    return this.introDue;
  }

  /** A scene object is reused on every visit: each visit decides its sky again. */
  override create(): void {
    this.look = null;
    super.create();
  }

  /**
   * The lamp's beam over the map, drawn as the game runs (`beam.ts`; the lighthouse's cycle should
   * be smooth): only the part the screen shows of its box. With reduced motion it stands as at its first moment.
   */
  private beam(beam: MapBeam, crop: Rect, at: { x: number; y: number }, palette: readonly number[]): void {
    const x0 = Math.max(beam.x, crop.x), y0 = Math.max(beam.y, crop.y);
    const x1 = Math.min(beam.x + beam.w, crop.x + crop.w), y1 = Math.min(beam.y + beam.h, crop.y + crop.h);
    if (x1 <= x0 || y1 <= y0) return;
    // only the part the screen shows is laid: drawn whole, then that part copied out
    const w = x1 - x0, h = y1 - y0;
    const image = new LiveImage(this, (at.x + x0 - crop.x) / ART_DETAIL, (at.y + y0 - crop.y) / ART_DETAIL, w, h, palette).setScale(1 / ART_DETAIL);
    this.root.add(image);
    const whole = new Uint8Array(beam.w * beam.h), part = new Uint8Array(w * h);
    let shown = -1;
    const turn = (time: number): void => {
      const step = Math.floor(time / BEAM_STEP_MS);
      if (step === shown) return;
      shown = step;
      drawBeam(beam, step * BEAM_STEP_MS, whole);
      for (let y = 0; y < h; y++) part.set(whole.subarray((y + y0 - beam.y) * beam.w + x0 - beam.x, (y + y0 - beam.y) * beam.w + x0 - beam.x + w), y * w);
      image.show(part);
    };
    turn(0);
    if (motionAllowed()) this.animators.push(turn);
  }

  protected draw(): void {
    const { width, height } = this.px;
    const sky = contextOf(this).flags.sky;
    this.look ??= currentLook(sky.now ?? Date.now(), sky.phase, sky.wind);
    const picture = this.loaded(PAINTED.map, this.look.phase);
    if (!picture) return;
    const { palette } = picture;
    const { crop, at } = keriMapView({ w: width, h: height });
    // a window larger than the picture shows more of the deep sea its rim ends in
    const deep = palette[picture.frames[0]!.pixels[0]!]!;
    this.root.add(this.add.graphics().fillStyle(deep, 1).fillRect(0, 0, width, height));
    /** A part of the picture (a box in the picture's fine pixels) on the screen: only what the screen shows of it. */
    const laid = (bitmap: Bitmap, x: number, y: number): PixelImage | null => {
      const x0 = Math.max(x, crop.x), y0 = Math.max(y, crop.y);
      const x1 = Math.min(x + bitmap.width, crop.x + crop.w), y1 = Math.min(y + bitmap.height, crop.y + crop.h);
      if (x1 <= x0 || y1 <= y0) return null;
      return this.fineImage(at.x + x0 - crop.x, at.y + y0 - crop.y, cut(bitmap, { x: x0 - x, y: y0 - y, w: x1 - x0, h: y1 - y0 }), palette);
    };
    const all = (images: (PixelImage | null)[]): PixelImage[] => images.filter((image): image is PixelImage => image !== null);
    // one wind over the map, as over every place (`windField.ts`): the clouds, the sea and the gulls read it
    const now = sky.now ?? Date.now(), seed = daySky(now, this.look.wind).seed % 1000;
    const air = airOf(this.look.wind, WAY, seed);
    // the sea's two looks melt into each other in no set rhythm, quicker as a gust crosses (`flicker.ts`), not on a beat
    const sea = all(picture.frames.map((frame) => laid(frame, 0, 0)));
    this.blend(sea, (time) => glowAt(air.time(time, crop.x + crop.w / 2) * 0.45, sea.length, seed + 3));
    this.beam(picture.beam, crop, at, palette);
    // gulls wheel over the island as a flock (`flock.ts`), by day and in the half light
    if (this.look.phase !== 'night') {
      const room = { x: crop.x + 30, y: crop.y + 24, w: crop.w - 60, h: crop.h - 70 };
      const flock = new Flock(MAP_GULLS.n, { ...GULL_FLIGHT, climb: MAP_GULLS.climb, box: room }, seed, this.time.now);
      const { palest, darkest } = extremes(palette);
      const { looks, body } = gullLooks(MAP_GULLS.span, palest, darkest);
      this.gulls(flock, looks, body, { x: at.x - crop.x, y: at.y - crop.y }, palette, air);
    }

    /** A box of the picture (fine pixels) in the screen's layout cells. */
    const cells = (r: Rect): Rect => ({ x: (at.x + r.x - crop.x) / ART_DETAIL, y: (at.y + r.y - crop.y) / ART_DETAIL, w: r.w / ART_DETAIL, h: r.h / ART_DETAIL });
    const fromCells = (r: Rect): Rect => cells({ x: r.x * ART_DETAIL, y: r.y * ART_DETAIL, w: r.w * ART_DETAIL, h: r.h * ART_DETAIL });
    // the warden's house (ft_1_18.AC4): a clear button over its place in the picture
    const house = fromCells(PLAN.house);
    this.button({ ...rectCentre(house), label: t('map.house'), picture: createBitmap(house.w, house.h), onClick: () => this.back() });
    this.spots = { house };
    // the scenes that the student's level has opened (ft_1_19.AC2, d113): a clear button over each one's painted place
    const open = openScenes(KERI.scenes ?? [], contextOf(this).profiles.progress.level.level, isTester(contextOf(this).profiles.profile.name));
    for (const scene of PLAN.scenes) {
      const target = SCENE_SCREENS[scene.id];
      if (!target || !open.includes(scene.id)) continue;
      const box = fromCells(scene.at);
      this.spots.place ??= box;
      this.button({ ...rectCentre(box), label: target.label(), picture: createBitmap(box.w, box.h), onClick: () => startScene(this, target.scene) });
    }

    // the map's few clouds all show, whatever the day's cover
    const screenWidth = width * ART_DETAIL, look = this.look;
    const painted = picture.clouds.map((cloud, i) => {
      const { start, row, near } = CLOUDS[i % CLOUDS.length]!;
      return { x: Math.floor(start * (screenWidth + cloud.width)) - cloud.width, y: row, width: cloud.width, height: cloud.height, near };
    });
    const courses = cloudCourses(painted, screenWidth, look.wind, daySky(now, look.wind), painted.length);
    if (this.introDue) this.time.delayedCall(0, () => this.showIntro());
    this.drift(picture.clouds.map((bitmap, i) => ({ bitmap, course: courses[i]! })), { x: 0, y: at.y + PLAN.middle.y - crop.y, w: screenWidth }, WAY, palette, air);
  }
}
