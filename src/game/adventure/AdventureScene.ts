import { isTester } from '../../core/world/openScenes';
import { ART_DETAIL } from '../../core/layout/frame';
import { rectCentre, type Rect } from '../../core/layout/rect';
import { STRIP_ROWS } from '../../core/layout/room';
import type { ActorDef, ActorState } from '../../core/scene/actor';
import { actorFrame, actorStateOf, placeActor } from '../../core/scene/actorRuntime';
import type { SceneData, StandingPlace } from '../../core/scene/scene';
import type { ItemId, ScriptId } from '../../core/contracts';
import type { SceneLook } from '../../core/sky/sceneLook';
import { t, type StringKey } from '../../core/text/strings';
import { contextOf } from '../context';
import { motionAllowed } from '../motion';
import { startScene } from '../scenes';
import { SCENE_SCREENS, watchVisit, type VisitData } from '../visit/islandVisit';
import { blit, createBitmap, type Bitmap } from '../ui/pixel/bitmap';
import { stripArt } from '../ui/pixel/keri/stripArt';
import { C, PALETTE } from '../ui/pixel/palette';
import { ICONS } from '../ui/pixel/iconArt';
import { PixelImage, PixelText, type RgbaArt } from '../ui/pixel/PixelObjects';
import { SCHOOL, bubblesAt, fishAt, jellyAt, schoolAt, type SwimPlace } from '../ui/pixel/swimMotion';
import { PixelScene } from '../ui/pixel/PixelScene';
import { currentLook } from '../ui/pixel/sky/skyLooks';
import { GUST_MS, cloudCourses, daySky, lookMs } from '../ui/pixel/windMotion';
import { blownAt, blownBox } from '../ui/pixel/sway';
import { STILL_AIR, airOf, type Air } from '../ui/pixel/windField';
import { Flock, gullLooks } from '../ui/pixel/flock';
import { sprayAt } from '../ui/pixel/motes';
import { GULL_FLIGHT, SCHOOL_SWIM, surfPoints } from './sceneAir';
import { actorFrames } from './actorSheets';
import { lineText, SceneScript } from './sceneScript';
import { lineSpot, TALK } from '../../core/layout/talk';
import { readingMs } from '../../core/scene/scriptRunner';
import { scriptInk, spokenLine, spokenPages, talkColour } from '../ui/pixel/talkArt';
import type { ScriptView } from '../../core/scene/scriptRunner';
import { ACTORS, CHARACTERS, CONVERSATIONS, ITEMS, SCRIPTS, TUG_RULES, WANDERER_RULES } from './scenesData';
import type { Curriculum } from '../../core/curriculum/curriculum';
import { castCharacter, castSettingOf, castTeachPiece, teachablePieces, tugRulesFor } from '../../core/island/cast';
import { castToday, wandererPlay, type CastToday } from '../../core/island/castToday';
import { DEFAULT_PRESENCE_RULES } from '../../core/island/presenceRules';
import { giveKeepsake, keptToday, wandererVerdict } from '../../core/island/wanderer';
import { pieceTitle } from '../../core/text/pieceTitle';
import { visitable } from '../visit/islandVisit';
import { WORDED_GAP, standPanel } from '../../core/layout/standPanel';
import { panelBitmap } from '../ui/pixel/frames';
import { learnBook } from '../ui/pixel/standArt';
import type { ToolbarItem } from '../ui/pixel/PixelScene';
import { TalkView } from './talkView';
import { TugView } from './tugView';
import { backpackOf, keptEntries } from './backpack';
import { TeachView } from './teachView';
import { learnedTaught, teachAfter, teachLevelOf } from '../../core/exchange/teach';
import { pieceLearned } from '../../core/learn/route';
import { StaffView } from '../ui/staff/StaffView';
import { layoutForSettings } from '../../core/layout/staffSettings';
import { staffSpaceLimits } from '../../core/layout/canvasSize';
import type { Outcome } from '../../core/dialogue/talk';
import { tugAfter, tugRecord } from '../../core/exchange/tugPlay';
import { characterTug, characterTugGate } from './characterTug';
import type { Chart } from '../../core/chart';
import type { TugState } from '../../core/exchange/tug';
import { characterKnown, prizeFor, type CharacterDef } from '../../core/character/character';
import { applyTalkEffects, talkFactsOf } from '../../core/dialogue/talkWorld';
import { meetCharacter } from '../../core/island/presenceRules';
import type { WorldState } from '../../core/island/worldState';
import { dayString } from '../../io/teacher/teacherDesk';
import { type LifeLayer, type PictureFigure, type SceneDive, type SceneLife, type ScenePicture } from './sceneLife';

/** How long the view takes to pan down into a place's second view, or up out of it (ft_1_19). */
const PAN_MS = 900;

const NAME_ABOVE = 9;
/** Rows under the pictures of the wanderer's board for their words. */
const WANDERER_WORD_ROWS = 11;
/** A second press this soon after a wanderer's ask showed is a double tap, never an answer (d293). */
const DOUBLE_TAP_MS = 600;

/** The demo cast (`?actors=1`, dev only): who stands on the scene's first places, and in which state. AX-3 provisional. */
/** What opens a scene: a visit from the screensaver, and a script to run in it (ft_1_24.AC6, WP-07). */
export interface AdventureData extends VisitData {
  script?: ScriptId;
}

/** The states a scripted actor can show (its own, or idle in their place). */
const SCRIPT_STATES: readonly ActorState[] = ['idle', 'walk', 'talk', 'play'];

const DEMO_CAST: readonly { actor: string; state: ActorState }[] = [
  { actor: 'kiur', state: 'talk' },
  { actor: 'villager', state: 'idle' },
  { actor: 'placeholder', state: 'idle' },
];

/**
 * One painted place on Keri as data (ft_1_24.AC1, AC2, AC3; d137): the scene's `SceneData` (`content/scenes/<id>.json`)
 * and its picture's life (`sceneLife.ts`) make the screen; no place has a class of its own. The picture, its clouds and
 * what moves over it are laid once per drawing and move by the scene's animators, and the actors stand on the scene's
 * places as sprites stepped every frame, never by drawing the scene again. Back returns to the map of Keri; the
 * screensaver (ft_1_17.AC4) shows a scene too, and then any input returns to the room. With `?actors=1` (dev) the demo
 * cast stands.
 */
export class AdventureScene extends PixelScene {
  protected override keyboardNavigation = true;
  protected override cornerPlates = true;
  private look: SceneLook | null = null;
  /** Shown by the screensaver (ft_1_17.AC4): any input goes back to the room, and Back does too. */
  private visiting = false;
  private scriptId: ScriptId | null = null;
  /** The script running in this visit, or the one that ran (it stays done, its actors where it left them). */
  private scripted: SceneScript | null = null;
  /** The conversation open over the scene (ft_1_22.AC1), its layer, and the player's world it reads and writes. */
  private talk: TalkView | null = null;
  /** The tug played over the scene (ft_1_21.AC2), opened from a conversation; it shares the talk's layer. */
  private tug: TugView | null = null;
  /** A character teaching its phrase over the scene (ft_1_22.AC3), opened from a conversation; it shares the talk's layer. */
  private teach: TeachView | null = null;
  private talkLayer: Phaser.GameObjects.Container | null = null;
  private world: WorldState | null = null;
  /** False when the world could not be read: then nothing is written over it this visit. */
  private worldSaves = true;
  /** A talk is opening (its world is being read). */
  private opening = false;
  /** The world being read for this visit: once read, the band shows its items and a talk reads it. */
  private worldRead: Promise<void> | null = null;
  /** Counts the visits, so a world read that finishes after the scene was opened again is dropped. */
  private talkVisit = 0;
  /** The hotspot whose look line shows (ft_1_24.AC4), and the timer that ends it. */
  private looking: string | null = null;
  private lookTimer: Phaser.Time.TimerEvent | null = null;
  private lookImage: PixelImage | null = null;
  /** The figures of the characters in the scene, by id: which of their states shows (they talk while their line shows). */
  private readonly figures = new Map<string, (state: ActorState) => void>();
  /** The head each character's lines are said over, by id, while it stands here (`talkTo`). */
  private readonly characterSpots = new Map<string, { head: { x: number; y: number } }>();
  /** Down in the place's second view (`SceneLife.dive`); every visit starts on top. */
  private deep = false;
  /** The gulls and the school, kept while the scene is open so a redraw (a look, a resize) does not start them again. */
  private flocks: { gulls?: Flock; school?: Flock } = {};
  /** While the view pans between the two, presses do nothing. */
  private panning = false;
  /** The player's curriculum (the teacher's cast, ft_1_37), read with the world; null before, or when it cannot be read. */
  private curriculum: Curriculum | null = null;
  /** Who stands where today (ft_1_37 slice 3); null until the documents are read. */
  private today: CastToday | null = null;
  /** Back from a wanderer's ask: the play it hears once the documents are read (ft_1_37.AC7). */
  private wandererBack: NonNullable<AdventureData['wanderer']> | null = null;
  /** The line a wanderer says now over its head, whether it is its ask (a press then opens the piece), and its timer. */
  private wandererLine: { id: string; text: string; ask: boolean } | null = null;
  private wandererTimer: Phaser.Time.TimerEvent | null = null;
  private wandererLineImage: PixelImage | null = null;
  /** When the ask's board showed (the scene's clock): a press on it this soon after is a double tap, and is ignored. */
  private wandererAskedAt = 0;

  constructor(private readonly sceneData: SceneData, private readonly life: SceneLife) {
    super(sceneData.id);
  }

  protected override back(): void {
    if (this.talk) return this.talk.leave();
    if (this.tug) return this.tug.leave();
    if (this.teach) return this.teach.leave();
    // Esc while a wanderer asks is Not now, as a press beside its board
    if (this.wandererLine?.ask) return this.closeWanderer();
    // Esc skips a script that may be skipped; once it is done, Back leaves as always
    if (this.scripted?.skip()) return;
    if (this.panning) return;
    // down in the second view, Back rises first
    if (this.deep) {
      this.pan(false);
      return;
    }
    startScene(this, this.visiting ? 'profile' : 'keriMap');
  }

  init(data?: AdventureData): void {
    this.visiting = data?.visiting === true;
    this.scriptId = data?.script ?? null;
    this.wandererBack = data?.wanderer ?? null;
  }

  /** The script of this visit: whether one runs, is done, what it gave and the line said now. For the demo and the tests. */
  get scriptState(): { id: ScriptId; done: boolean; given: readonly string[]; saying: string | null; line: Rect | null; picture: Rect | null } | null {
    const s = this.scripted;
    const line = s?.view().line;
    return s ? { id: s.script.id, done: s.done, given: s.given, saying: line ? lineText(line.line) : null, line: line ? this.scriptLineBox : null, picture: this.scriptPicture } : null;
  }
  /** Where the script's line is drawn and the picture it stays in, art pixels: for the tests. */
  private scriptLineBox: Rect | null = null;
  private scriptPicture: Rect | null = null;

  /** A scene object is reused on every visit: each visit decides its sky again. */
  override create(): void {
    this.look = null;
    this.deep = false;
    this.flocks = {};
    this.panning = false;
    this.talk = null;
    this.tug = null;
    this.teach = null;
    this.world = null;
    this.worldSaves = true;
    this.opening = false;
    this.looking = null;
    this.lookTimer = null;
    this.lookImage = null;
    this.curriculum = null;
    this.today = null;
    this.wandererLine = null;
    this.wandererTimer = null;
    this.wandererLineImage = null;
    this.talkVisit += 1;
    this.worldRead = this.readWorld(this.talkVisit);
    // while a conversation is open its keys are its own, ahead of the screen's keyboard navigation
    this.onWindowKey((e) => {
      if (!(this.talk?.key(e) ?? this.tug?.key(e) ?? this.teach?.key(e))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    });
    if (this.visiting) watchVisit(this, this.sceneData.id);
    // a tug still playing when the scene closes is silenced and not kept
    this.events.once('shutdown', () => { this.tug?.stop(); this.tug = null; this.teach?.stop(); this.teach = null; });
    this.scripted = null;
    if (this.scriptId !== null) {
      const script = SCRIPTS.get(this.scriptId);
      if (!script) throw new Error(`no script ${this.scriptId} in content/scripts`);
      const context = contextOf(this);
      // the visit the script runs in: an item it gives counts only while the scene is still on that visit
      const visit = this.talkVisit;
      const running = new SceneScript(script, this.sceneData, context.pieces, context.audio, (item) => void this.keepGiven(item, visit));
      this.scripted = running;
      this.events.once('shutdown', () => running.stop());
      // a press anywhere, or Space or Enter, ends the line being said (MI2)
      this.input.on('pointerdown', () => running.press());
      // while it runs Space and Enter are the script's own: they never press a focused door behind it
      this.onWindowKey((e) => {
        if (running.done || (e.key !== ' ' && e.key !== 'Enter')) return;
        running.press();
        e.preventDefault();
        e.stopImmediatePropagation();
      });
    }
    super.create();
  }

  /** Today on Keri: the real day, or the one `?now=` sets in a dev build, as the room reads it, so who stands here follows the switch too. */
  private todayString(): string {
    return dayString(new Date(contextOf(this).flags.sky.now ?? Date.now()));
  }

  /** Every frame: the scene's motion, and the tug's judge on the song clock (Tempo mode, ft_1_21.AC6). */
  override update(time: number): void {
    super.update(time);
    this.tug?.update(contextOf(this).audio.clock.nowMs());
  }

  protected override clear(): void {
    this.figures.clear();
    this.characterSpots.clear();
    this.talk?.clear();
    this.tug?.clear();
    this.teach?.clear();
    this.talkLayer?.destroy();
    this.talkLayer = null;
  }

  protected draw(): void {
    const screen = { w: this.px.width, h: this.px.height };
    this.sky();
    // under the band the band itself is the strip kept free (ft_1_20)
    const { picture: at, strip } = this.life.view(screen, this.bandShown ? 0 : STRIP_ROWS);
    const context = contextOf(this);
    const sky = context.flags.sky;
    const now = sky.now ?? Date.now();
    this.look ??= currentLook(now, sky.phase, sky.wind);
    const picture = this.loaded(this.life.pictures, this.look.phase);
    if (!picture) return;
    const { palette } = picture;
    const origin = { x: at.x * ART_DETAIL, y: at.y * ART_DETAIL };
    const { wind } = this.look;
    const laid = (o: { x: number; y: number; frames: readonly Bitmap[] }) => o.frames.map((frame) => this.fineImage(origin.x + o.x, origin.y + o.y, frame, palette));
    const dive = this.life.dive;

    if (this.deep && dive) {
      // the second view: its own looks, no sky; a press over the water above, or Back, rises again
      const deep = dive.deep(picture);
      this.cycle(laid({ x: 0, y: 0, frames: deep }), lookMs(wind, deep.length), undefined, { fade: true });
      this.swim(dive, picture, origin, palette, daySky(now, wind).seed);
      if (strip.h > 0) this.root.add(new PixelImage(this, strip.x, strip.y, stripArt(strip.w, strip.h)));
      this.hotspot(at, dive.riseAt, t('scene.rise'), () => this.pan(false));
      return;
    }

    // back to front: the picture with its sky bare, the day's clouds, what stands before the sky, then what moves over it;
    // all on one wind whose gusts cross the place (`windField.ts`)
    const seed = daySky(now, wind).seed;
    const width = picture.frames[0]!.width;
    const air = airOf(wind, this.life.way, seed);
    const sway = lookMs(wind, picture.frames.length), gusting = { fade: true, clock: (time: number) => air.time(time, width / 2) };
    this.cycle(laid({ x: 0, y: 0, frames: picture.frames }), sway, undefined, gusting);
    // the water's strokes, glints, bands and surf, each on its own course (`paint/live.ts`)
    this.liveWater(picture.water, origin, palette, GUST_MS[wind]!, seed, air);
    // each cloud on its own course; one higher in the sky is nearer and goes faster
    const painted = picture.clouds.map((c) => ({ x: c.x, y: c.y, width: c.bitmap.width, height: c.bitmap.height, near: Math.max(0, 1 - c.y / this.life.horizon) }));
    const courses = cloudCourses(painted, width, wind, daySky(now, wind), this.life.leastClouds, this.life.clearAt?.(this.look.phase) ?? []);
    this.drift(picture.clouds.map((c, i) => ({ bitmap: c.bitmap, course: courses[i]! })), { ...origin, w: width }, this.life.way, palette, air);
    this.flight(picture, origin, air, seed);
    this.cycle(laid(picture.fore), sway, undefined, gusting);
    const behind = this.layers(this.life.layers(picture, this.look, seed), laid, origin, palette, air);
    this.living(picture, origin, air, seed);
    // the strip under the picture, kept free for the verb buttons and the inventory, as under the room
    if (strip.h > 0) this.root.add(new PixelImage(this, strip.x, strip.y, stripArt(strip.w, strip.h)));

    if (!this.scripted) this.spots(origin);
    if (this.scripted) this.stage(this.scripted, origin, at, { figures: this.life.figures?.(picture) ?? {}, palette, behind });
    else if (context.flags.actors) this.cast(origin);
    if (!this.scripted) this.standing(origin, at);
    // the look line is said over the figures standing in front of the spot
    if (!this.scripted) this.lookLine(origin, at);
    if (this.talk || this.tug || this.teach) {
      this.talkLayer = this.overlayLayer();
      this.talk?.redrawIn(this.talkLayer);
      this.tug?.redrawIn(this.talkLayer);
      this.teach?.redrawIn(this.talkLayer);
    }
    // a script is watched where it plays: the view does not dive away from it
    if (dive && !this.scripted) this.hotspot(at, dive.diveAt, t('scene.dive'), () => this.pan(true));
  }

  /**
   * What sways and swims in the deep view: the kelp in the current (`sway.ts`), and each swimmer's sprite on its own course (`swimMotion.ts`; they should behave
   * like the clouds do): the jellyfish, the school, the bright fish, the bubbles. With reduced motion they stand where
   * they are at the first moment.
   */
  private swim(dive: SceneDive, picture: ScenePicture, origin: { x: number; y: number }, palette: readonly number[], seed: number): void {
    // what changes its place steps whole, in the looks' own time: blended, it would stand twice, half see-through
    const things = dive.things?.(picture);
    if (things) this.cycle(things.frames.map((frame) => this.fineImage(origin.x + things.x, origin.y + things.y, frame, palette)), lookMs(this.look?.wind ?? 0, things.frames.length));
    // the kelp sways as the game runs, in the water's own slow time (no wind down here)
    for (const weed of dive.blown?.(picture) ?? []) this.liveLayer({ ...blownBox(weed), draw: (time, out) => blownAt(weed, time, STILL_AIR, weed.x, out) }, origin, palette);
    const s = dive.swimmers?.(picture);
    if (!s) return;
    const width = picture.frames[0]!.width;
    const place = (image: PixelImage, at: SwimPlace | { x: number; y: number } | null, facesRight = true): void => {
      image.setVisible(at !== null);
      if (!at) return;
      image.setPosition((origin.x + at.x) / ART_DETAIL, (origin.y + at.y) / ART_DETAIL);
      if ('right' in at) image.setFlipX(at.right !== facesRight);
    };
    const movers: ((time: number) => void)[] = [];
    s.jellies.forEach((j, k) => {
      const looks = j.frames.map((frame) => this.fineImage(0, 0, frame, palette));
      movers.push((time) => {
        const at = jellyAt(k, j.x, j.y, looks.length, time, seed);
        looks.forEach((image, i) => place(image, i === at.look ? at : null));
      });
    });
    // the school: each small fish pulled to its place in it (`schoolAt`) and keeping clear of the next, so it darts,
    // lags and bunches as a school does (`flock.ts`); it faces the way it swims
    const school = SCHOOL.map(() => this.fineImage(0, 0, s.school, palette));
    const slot = (k: number, t: number) => schoolAt(k, s.schoolY, width, t, seed);
    const fish = (this.flocks.school ??= new Flock(SCHOOL.length, { ...SCHOOL_SWIM, box: { x: -1000, y: -1000, w: width + 2000, h: 3000 }, follow: slot }, seed, this.time.now));
    movers.push((time) => {
      fish.advance(time);
      school.forEach((image, k) => {
        const f = fish.boids[k]!, at = fish.away[k] ? null : slot(k, fish.time);
        place(image, at && { x: Math.round(f.x), y: Math.round(f.y), right: Math.abs(f.vx) > 4 ? f.vx > 0 : at.right }, false);
      });
    });
    s.fish.forEach((f, k) => {
      const image = this.fineImage(0, 0, f.bitmap, palette);
      movers.push((time) => place(image, fishAt(k, f.y, f.bitmap.width, width, time, seed)));
    });
    const bubbles = Array.from({ length: 4 }, () => this.fineImage(0, 0, s.bubble, palette));
    movers.push((time) => bubblesAt(s.bubbleFrom, time).forEach((at, k) => place(bubbles[k]!, at)));
    for (const move of movers) move(0);
    if (motionAllowed()) this.animators.push(...movers);
  }

  /**
   * The gulls over the sea by day (`flock.ts`), flying as a flock on the
   * place's wind. Started once when the scene opens and kept through a redraw.
   */
  private flight(picture: ScenePicture, origin: { x: number; y: number }, air: Air, seed: number): void {
    const gulls = this.life.gulls;
    if (!gulls || picture.gull === undefined || this.look?.phase === 'night') return;
    this.flocks.gulls ??= new Flock(gulls.n, { ...GULL_FLIGHT, box: gulls.box }, seed, this.time.now);
    const { looks, body } = gullLooks(gulls.span, picture.gull);
    this.gulls(this.flocks.gulls, looks, body, origin, picture.palette, air);
  }

  /**
   * What lives over the layers on the place's wind: what the scene draws afresh (smoke), the motes that glow (sparks,
   * fireflies), and the spray off the rocks where the surf breaks when a gust comes.
   */
  private living(picture: ScenePicture, origin: { x: number; y: number }, air: Air, seed: number): void {
    const look = this.look;
    if (!look) return;
    for (const layer of this.life.live?.(picture, look, air, seed) ?? []) this.liveLayer(layer, origin, picture.palette);
    for (const { source, most } of this.life.motes?.(picture, look, air, seed) ?? []) this.motes(source, origin, most);
    const rocks = picture.water ? surfPoints(picture.water) : [];
    if (rocks.length > 0 && air.wind > 0) this.motes((time) => sprayAt(time, rocks, air, seed), origin, 16);
  }

  /** Lays the life's layers, back to front; returns where a script's figures from the picture go (under the layer marked `cover`), or null. */
  private layers(layers: readonly LifeLayer[], laid: (o: LifeLayer['overlay']) => PixelImage[], origin: { x: number; y: number }, palette: readonly number[], air: Air): number | null {
    let behind: number | null = null;
    for (const layer of layers) {
      if (layer.cover === true) behind ??= this.root.list.length;
      const images = laid(layer.overlay);
      if (layer.level) this.blend(images, layer.level);
      else this.cycle(images, layer.ms, layer.order, { fade: layer.fade === true });
      // what the wind moves on it (a pennant, washing), drawn afresh on the place's wind where the thing stands in the picture
      const parts = (layer.blown ?? []).map((part) => {
        const box = blownBox(part), at = layer.overlay.x + part.x;
        return this.liveLayer({ ...box, x: layer.overlay.x + box.x, y: layer.overlay.y + box.y, draw: (time, out) => blownAt(part, time, air, at, out) }, origin, palette);
      });
      // a thing afloat rides the swell by parts of a pixel, what the wind moves on it riding with it
      const bob = layer.bob;
      if (bob && motionAllowed()) {
        const riders = [...images, ...parts], rest = riders.map((rider) => rider.y);
        this.animators.push((time) => {
          const dy = bob(time) / ART_DETAIL;
          riders.forEach((rider, i) => rider.setY(rest[i]! + dy));
        });
      }
    }
    return behind;
  }

  /** A clear button over part of the picture (`box` in layout cells from its corner), named in a bubble under the pointer. */
  private hotspot(at: Rect, box: Rect, label: string, onClick: () => void): void {
    const area: Rect = { x: at.x + box.x, y: at.y + box.y, w: box.w, h: box.h };
    this.button({ ...rectCentre(area), label, picture: createBitmap(area.w, area.h), onClick: () => { if (!this.panning) onClick(); } });
  }

  /**
   * Pans the view down into the place's second view (`down`) or up out of it (ft_1_19): the view on top as it stands and
   * the deep view's first look, one under the other as the tall cut lies, slide past the picture's box; then the scene is
   * drawn in the other view. With reduced motion it is drawn there at once.
   */
  private pan(down: boolean): void {
    const dive = this.life.dive;
    const picture = this.look ? this.life.pictures.ready(this.look.phase) : null;
    // a conversation, a tug or a teaching open over the scene holds the view where it is
    if (!dive || !picture || this.panning || this.talk || this.tug || this.teach || this.scripted) return;
    const arrive = (): void => {
      this.panning = false;
      this.deep = down;
      this.redraw();
    };
    if (!motionAllowed()) {
      arrive();
      return;
    }
    const top = dive.still(picture), deep = dive.deep(picture)[0]!;
    const tall = createBitmap(top.width, dive.depth + deep.height);
    tall.pixels.set(top.pixels);
    tall.pixels.set(deep.pixels, dive.depth * top.width);
    // what steps and what sways down there stand in the pan as in the first look and in still water
    const things = dive.things?.(picture);
    if (things?.frames[0]) blit(tall, things.frames[0], things.x, dive.depth + things.y);
    for (const weed of dive.blown?.(picture) ?? []) blit(tall, weed.bitmap, weed.x, dive.depth + weed.y);
    const { picture: at } = this.life.view({ w: this.px.width, h: this.px.height }, this.bandShown ? 0 : STRIP_ROWS);
    const image = this.fineImage(at.x * ART_DETAIL, at.y * ART_DETAIL, tall, picture.palette);
    this.panning = true;
    let start: number | null = null, landed = false;
    this.animators.push((time) => {
      if (landed) return;
      start ??= time;
      const u = Math.min(1, (time - start) / PAN_MS);
      // eased in and out, on whole fine pixels
      const eased = u * u * (3 - 2 * u);
      const offset = Math.round(dive.depth * (down ? eased : 1 - eased));
      image.setCrop(0, offset, top.width, top.height).setPosition(image.x, at.y - offset / ART_DETAIL);
      if (u < 1) return;
      landed = true;
      // drawn again after this frame's animators, not in the middle of them
      this.time.delayedCall(0, arrive);
    });
  }

  /**
   * The scene's hotspots and exits (ft_1_24.AC1, AC4), each a press area over the picture (fine pixels in the scene file).
   * A hotspot's look line is said by the student over it, in the student's colour, for its reading time or until the next
   * press; an exit leaves to its scene, the map or the room. Drawn before the characters, so a character over a hotspot
   * takes the press. AX-3 provisional: every hotspot is looked at (the band's verbs come with ft_1_20's items).
   */
  private spots(origin: { x: number; y: number }): void {
    const boxOf = (area: Rect): Rect => areaBox(origin, area);
    const pressArea = (box: Rect, label: string, onClick: () => void) =>
      this.button({ ...rectCentre(box), label, picture: createBitmap(Math.max(1, Math.round(box.w)), Math.max(1, Math.round(box.h))), onClick });
    for (const spot of this.sceneData.hotspots) {
      const box = boxOf(spot.area);
      pressArea(box, lineText(spot.name), () => this.lookAt(spot.id));
    }
    for (const exit of this.sceneData.exits) pressArea(boxOf(exit.area), lineText(exit.name), () => this.leaveBy(exit.id));
  }

  /** The line of the hotspot looked at, over its spot. */
  private lookLine(origin: { x: number; y: number }, at: Rect): void {
    const spot = this.looking === null ? undefined : this.sceneData.hotspots.find((h) => h.id === this.looking);
    if (spot) {
      const box = areaBox(origin, spot.area);
      const words = spokenLine(spokenPages(lineText(spot.look))[0] ?? [], talkColour('student'));
      const head = { x: Math.round(box.x + box.w / 2) - at.x, y: Math.round(box.y) - at.y };
      const place = lineSpot({ head, size: { w: words.width, h: words.height }, area: { w: at.w, h: at.h } });
      this.lookImage = new PixelImage(this, at.x + place.x, at.y + place.y, words).setName('lookLine');
      this.root.add(this.lookImage);
    }
  }

  /** The hotspot whose look line shows now, for the tests. */
  get lookingAt(): string | null {
    return this.looking;
  }

  /** Look at hotspot `id` (ft_1_24.AC4): its line shows for its reading time; a second look ends the first. */
  lookAt(id: string): boolean {
    const spot = this.sceneData.hotspots.find((h) => h.id === id);
    if (!spot || this.talk || this.tug || this.teach || this.scripted) return false;
    this.lookTimer?.remove();
    this.looking = this.looking === id ? null : id;
    // the line runs out without drawing the scene again, so an open backpack or bubble stays open
    this.lookTimer = this.looking === null ? null : this.time.delayedCall(readingMs(lineText(spot.look)), () => {
      this.lookTimer = null;
      this.looking = null;
      this.lookImage?.destroy();
      this.lookImage = null;
    });
    this.redraw();
    return true;
  }

  /** Leave by exit `id` (ft_1_24.AC1): to its scene, or `map` and `room`, the two places every scene leads to. */
  leaveBy(id: string): boolean {
    const exit = this.sceneData.exits.find((e) => e.id === id);
    if (!exit || this.talk || this.tug || this.teach || this.scripted) return false;
    if (exit.to === 'map') startScene(this, 'keriMap');
    else if (exit.to === 'room') startScene(this, 'profile');
    else if (isAdventureScene(exit.to)) startScene(this, exit.to);
    else return false; // a scene the game does not have (the scene files' test names it)
    return true;
  }

  /** The demo cast on the scene's places, front ones last (z-order by the feet). */
  private cast(origin: { x: number; y: number }): void {
    const standing = DEMO_CAST.flatMap(({ actor, state }, i) => {
      const def = ACTORS.get(actor), place = this.sceneData.places[i];
      return def && place ? [{ def, place, state }] : [];
    });
    standing.sort((a, b) => a.place.y - b.place.y);
    for (const { def, place, state } of standing) this.actor(def, place, state, origin);
  }

  /** One actor on its place: its frames, stepped at its state's rate, or its labelled box when the game has no art for it. */
  private actor(def: ActorDef, place: StandingPlace, state: ActorState, origin: { x: number; y: number }): void {
    const shown = actorStateOf(def, state);
    const at = placeActor(def, place);
    const art = actorFrames(def, shown, this.look?.phase ?? 'day');
    const frames = art ?? [boxOf(def)];
    const images = frames.map((frame) => {
      const image = this.fineImage(origin.x + at.x, origin.y + at.y, frame).setName(`actor:${def.id}`);
      image.setScale(at.scale / ART_DETAIL).setFlipX(at.mirrored);
      return image;
    });
    images.forEach((image, i) => image.setVisible(i === 0));
    if (frames.length > 1 && motionAllowed()) {
      this.animators.push((time) => {
        const frame = actorFrame(def, shown, time) % images.length;
        images.forEach((image, i) => image.setVisible(i === frame));
      });
    }
    // a figure the painter has not drawn yet says who it is
    if (art === null) {
      const x = (origin.x + place.x) / ART_DETAIL, top = (origin.y + at.y) / ART_DETAIL;
      this.root.add(new PixelText(this, 0, Math.round(top) - NAME_ABOVE, def.id, { color: C.white, shadow: C.ink }).centerAt(Math.round(x)));
    }
  }

  /**
   * The script's stage (ft_1_24.AC6): every actor it brings on, each state's frames laid once and moved, shown and stepped
   * every frame from the interpreter's view; the line said over its speaker's head; the dark of a fade over the picture.
   */
  private stage(script: SceneScript, origin: { x: number; y: number }, at: Rect, picture: { figures: Readonly<Record<string, PictureFigure>>; palette: readonly number[]; behind: number | null }): void {
    const phase = this.look?.phase ?? 'day';
    let under = picture.behind;
    const figures = script.actors().flatMap((id) => {
      const def = ACTORS.get(id);
      if (!def) return [];
      // a figure the picture paints (a boat behind the quay) is laid under the layer it passes behind, and stays there
      const painted = def.sheet !== undefined ? picture.figures[def.sheet] : undefined;
      const states = new Map(SCRIPT_STATES.map((state) => {
        const shown = actorStateOf(def, state);
        if (painted) {
          const images = painted.frames.map((frame) => {
            const image = this.fineImage(0, 0, frame, picture.palette).setName(`actor:${def.id}`).setVisible(false);
            if (under !== null) this.root.moveTo(image, under++);
            return image;
          });
          return [state, { shown, images }] as const;
        }
        const art = actorFrames(def, shown, phase);
        const frames: readonly (Bitmap | RgbaArt)[] = art ?? [boxOf(def)];
        const images = frames.map((frame) => this.fineImage(0, 0, frame).setName(`actor:${def.id}`).setVisible(false));
        return [state, { shown, images }] as const;
      }));
      // a figure the painter has not drawn yet says who it is
      let label: PixelText | null = null;
      if (!painted && actorFrames(def, 'idle', phase) === null) {
        label = new PixelText(this, 0, 0, def.id, { color: C.white, shadow: C.ink });
        this.root.add(label);
      }
      return [{ def, states, label, painted }];
    });
    const veil = this.add.rectangle(at.x, at.y, at.w, at.h, PALETTE[C.night]).setOrigin(0).setAlpha(0);
    this.root.add(veil);
    // the line being said: its pages, turned evenly over its reading time, the page shown made again only when it turns
    let said: { key: string; since: number; pages: string[][]; page: number; image: PixelImage | null } | null = null;
    this.scriptPicture = at;

    const show = (time: number): void => {
      script.tick(time);
      const view = script.view();
      // back to front: the view lists the actors by their feet; the line and the dark go over them all
      const front = [...figures].sort((a, b) => order(view, a.def.id) - order(view, b.def.id));
      for (const { def, states, label, painted } of front) {
        const actor = view.actors.find((a) => a.id === def.id);
        for (const [state, { shown, images }] of states) {
          const on = actor !== undefined && actor.state === state;
          const placed = actor ? placeActor(def, { id: def.id, x: actor.x, y: actor.y, facing: actor.facing, scale: actor.scale }) : null;
          const step = painted ? Math.floor(time / painted.ms) : actorFrame(def, shown, time);
          const frame = on && images.length > 1 && motionAllowed() ? step % images.length : 0;
          images.forEach((image, i) => {
            image.setVisible(on && i === frame);
            if (placed && on) {
              image.setPosition((origin.x + placed.x) / ART_DETAIL, (origin.y + placed.y) / ART_DETAIL)
                .setScale(placed.scale / ART_DETAIL).setFlipX(placed.mirrored);
              if (!painted || picture.behind === null) this.root.bringToTop(image);
            }
          });
        }
        if (label) {
          label.setVisible(actor !== undefined);
          if (actor) {
            const top = (origin.y + actor.y - def.size.h * actor.scale) / ART_DETAIL;
            label.setPosition(0, Math.round(top) - NAME_ABOVE).centerAt(Math.round((origin.x + actor.x) / ART_DETAIL));
            this.root.bringToTop(label);
          }
        }
      }
      // the line (ft_1_24): WP-09's spoken line in the speaker's colour, placed over its head and kept inside the picture
      const key = view.line ? `${view.line.actor}:${view.line.line}` : '';
      if ((said?.key ?? '') !== key) {
        said?.image?.destroy();
        this.scriptLineBox = null;
        said = view.line ? { key, since: time, pages: spokenPages(lineText(view.line.line)), page: -1, image: null } : null;
      }
      const line = view.line;
      if (said && line) {
        const each = readingMs(lineText(line.line)) / Math.max(1, said.pages.length);
        const page = Math.min(said.pages.length - 1, Math.floor((time - said.since) / each));
        if (page !== said.page) {
          said.image?.destroy();
          said.page = page;
          const speaker = view.actors.find((a) => a.id === line.actor);
          const def = ACTORS.get(line.actor);
          const words = spokenLine(said.pages[page] ?? [], scriptInk(line.actor, CHARACTERS.values()));
          const head = speaker && def
            ? { x: Math.round((origin.x + speaker.x) / ART_DETAIL) - at.x, y: Math.round((origin.y + speaker.y - def.size.h * speaker.scale) / ART_DETAIL) - at.y }
            : { x: Math.round(at.w / 2), y: TALK.margin + words.height + TALK.aboveHead }; // no one to stand over: the top of the picture
          const spot = lineSpot({ head, size: { w: words.width, h: words.height }, area: { w: at.w, h: at.h } });
          said.image = new PixelImage(this, at.x + spot.x, at.y + spot.y, words).setName('scriptLine');
          this.scriptLineBox = { x: at.x + spot.x, y: at.y + spot.y, w: words.width, h: words.height };
          this.root.add(said.image);
        }
      }
      if (said?.image) this.root.bringToTop(said.image);
      veil.setAlpha(view.dark);
      this.root.bringToTop(veil);
    };
    show(this.time.now);
    this.animators.push(show);
  }

  /** Who stands here: the tester and the dev switches see every character, every other player who presence puts here today, and the wanderers sent (ft_1_37). */
  private standing(origin: { x: number; y: number }, at: Rect): void {
    const { flags, profiles } = contextOf(this);
    const everyone = flags.actors || flags.autoplay || isTester(profiles.profile.name);
    const here = Object.entries(this.today?.characters ?? {}).filter(([, scene]) => scene === this.sceneData.id).map(([id]) => id);
    if (everyone || here.length > 0) this.characters(origin, everyone ? null : new Set(here));
    this.wanderers(origin, at);
  }

  /**
   * The characters of this scene (ft_1_22.AC1), each on its place and pressable: pressing one opens its conversation. Until
   * presence decides who is here today (WP-11 on WP-08's `presence`) they stand for the tester profile and with `?actors=1`.
   * AX-3 provisional: a character stands on the scene's last place (the knoll's is in the tree, Puuvaim's), see the TODO
   * in ft_1_22.
   */
  private characters(origin: { x: number; y: number }, only: ReadonlySet<string> | null): void {
    const place = this.sceneData.places[this.sceneData.places.length - 1];
    if (!place) return;
    for (const own of CHARACTERS.values()) {
      if (only !== null && !only.has(own.id)) continue;
      // the teacher's piece in place of its own (ft_1_37.AC4)
      const def = this.curriculum ? castCharacter(own, this.curriculum) : own;
      const actor = ACTORS.get(def.actor);
      if (!def.scenes.includes(this.sceneData.id) || !actor || !CONVERSATIONS.has(def.conversation)) continue;
      const at = placeActor(actor, place);
      const phase = this.look?.phase ?? 'day';
      const byState = new Map((['idle', 'talk'] as const).map((state) => {
        const frames: readonly (Bitmap | RgbaArt)[] = actorFrames(actor, actorStateOf(actor, state), phase) ?? [boxOf(actor)];
        const images = frames.map((frame) => this.fineImage(origin.x + at.x, origin.y + at.y, frame).setName(`actor:${actor.id}`).setScale(at.scale / ART_DETAIL).setFlipX(at.mirrored).setVisible(false));
        return [state, images] as const;
      }));
      let shown: ActorState = 'idle';
      const step = (time: number): void => {
        const frame = motionAllowed() ? actorFrame(actor, actorStateOf(actor, shown), time) : 0;
        for (const [state, images] of byState) images.forEach((image, i) => image.setVisible(state === shown && i === frame % images.length));
      };
      step(this.time.now);
      this.animators.push(step);
      this.figures.set(def.id, (state) => { shown = state === 'talk' ? 'talk' : 'idle'; step(this.time.now); });
      const box: Rect = { x: (origin.x + at.x) / ART_DETAIL, y: (origin.y + at.y) / ART_DETAIL, w: (actor.size.w * at.scale) / ART_DETAIL, h: (actor.size.h * at.scale) / ART_DETAIL };
      const head = { x: Math.round((origin.x + place.x) / ART_DETAIL), y: Math.round(box.y) };
      // "???" until the student has asked who it is (ft_1_22.AC10); the world is read on the first talk of a visit
      const known = characterKnown(this.world?.flags ?? [], def.id);
      const name = !known ? t('character.unknown') : def.name.kind === 'generated' ? def.id : lineText(def.name.name);
      this.button({ ...rectCentre(box), label: name, picture: createBitmap(Math.max(1, Math.round(box.w)), Math.max(1, Math.round(box.h))), onClick: () => void this.openTalk(def, head) });
      this.characterSpots.set(def.id, { head });
    }
  }

  /** Opens `def`'s conversation over the scene (ft_1_22.AC1): the student has met it; its world is read once a visit. */
  async openTalk(def: CharacterDef, head: { x: number; y: number }): Promise<boolean> {
    // one talk at a time: a second press while the world is read opens nothing; nor does one while the view pans or is
    // down in the second view, where the talk's layer is not drawn
    if (this.talk || this.tug || this.teach || this.opening || this.panning || this.deep) return false;
    const conversation = CONVERSATIONS.get(def.conversation);
    if (!conversation) return false;
    const { profiles } = contextOf(this);
    const id = profiles.profile.id;
    this.opening = true;
    // a look line ends when a talk opens: the talk's lines are the ones read now
    this.lookTimer?.remove();
    this.lookTimer = null;
    this.looking = null;
    this.lookImage?.destroy();
    this.lookImage = null;
    const visit = this.talkVisit;
    await (this.worldRead ??= this.readWorld(visit));
    if (visit !== this.talkVisit) return false;
    this.opening = false;
    // the scene may have closed, another talk opened or the view begun to pan while the world was read
    if (!this.sys.isActive() || this.talk || this.tug || this.teach || !this.world || this.panning || this.deep) return false;
    const before = this.world;
    const facts = { ...talkFactsOf(meetCharacter(before, def.id, this.todayString()), false), teachable: this.teachable(def) };
    const save = () => { if (this.world && this.worldSaves) void profiles.saveWorld(id, this.world); };
    this.talkLayer ??= this.overlayLayer();
    this.talk = TalkView.open(this, this.talkLayer, conversation, def, facts, { area: { w: this.px.width, h: this.mainRows }, head }, {
      effects: (effects) => {
        if (!this.world) return;
        const next = applyTalkEffects(this.world, effects);
        if (next === this.world) return;
        const named = !characterKnown(this.world.flags, def.id) && characterKnown(next.flags, def.id);
        this.world = next;
        save();
        // asked who it is: its name shows from now on (ft_1_22.AC10)
        if (named && this.sys.isActive()) this.redraw();
      },
      speaking: (on) => this.figures.get(def.id)?.(on ? 'talk' : 'idle'),
      // TODO(builder, R3) in ft_1_22: `checkup` starts playing here
      ended: (outcome) => {
        this.talk = null;
        if (outcome && 'tug' in outcome && this.openTug(def, head, outcome)) return;
        if (outcome && 'teach' in outcome && this.openTeach(def, head, outcome.teach)) return;
        this.talkLayer?.destroy();
        this.talkLayer = null;
      },
    });
    if (!this.talk) {
      this.talkLayer?.destroy();
      this.talkLayer = null;
      return false;
    }
    // the student met the character: only once its talk has opened (A.8 `firstDay`, `lastDay`)
    this.world = meetCharacter(this.world ?? before, def.id, this.todayString());
    save();
    return true;
  }

  /**
   * The pieces `def`'s talk may offer to teach: approved ones, the player's own, and the teacher's pick; a draft only on
   * the plain dev server or for a tester (the drafts switch alone does not make a character teach one).
   */
  private teachable(def: CharacterDef): string[] {
    const context = contextOf(this);
    const drafts = context.flags.draftsShown || isTester(context.profiles.profile.name);
    const offer = (piece: string): 'approved' | 'draft' | undefined => {
      const found = context.pieces.find(piece);
      if (!found) return undefined;
      return found.status === 'approved' || found.own === true || drafts ? 'approved' : 'draft';
    };
    return teachablePieces(CHARACTERS.get(def.id) ?? def, this.curriculum ?? undefined, offer);
  }

  /**
   * A script's `give` (ft_1_24): the item goes to the active player's world once it is read, and is saved; the band shows
   * it at once. Dropped when the scene was opened again meanwhile, or when the world could not be read.
   */
  private async keepGiven(item: ItemId, visit: number): Promise<void> {
    await this.worldRead;
    if (visit !== this.talkVisit || !this.world || !this.worldSaves) return;
    const before = this.world.items.length;
    this.world = applyTalkEffects(this.world, [{ give: item }]);
    if (this.world.items.length === before) return;
    const { profiles } = contextOf(this);
    if (this.sys.isActive()) this.redraw();
    await profiles.saveWorld(profiles.profile.id, this.world);
  }

  /**
   * The active player's world, read once a visit (`visit`, so a read that finishes after the scene was opened again is
   * dropped); the band shows its items once it is here.
   */
  private async readWorld(visit: number): Promise<void> {
    const { profiles } = contextOf(this);
    const read = await profiles.worldOf(profiles.profile.id).catch(() => null);
    if (visit !== this.talkVisit) return;
    // a save that cannot be read is never written over with an empty world: this visit talks, but saves nothing
    this.worldSaves = read !== null;
    this.world = read ?? { flags: [], items: [], met: {}, teacherVisits: [] };
    this.keepLearnedTaught();
    await this.readCast(visit);
    if (visit !== this.talkVisit) return;
    const anyKnown = [...CHARACTERS.keys()].some((id) => characterKnown(this.world!.flags, id));
    if ((this.world.items.length > 0 || anyKnown) && this.sys.isActive()) this.redraw();
  }

  /**
   * The teacher's cast for this player and who stands where today (ft_1_37): the curriculum and the practice log read, the
   * characters presence picks and the wanderers sent; then a wanderer's play is heard when the student comes back from it.
   */
  private async readCast(visit: number): Promise<void> {
    const { profiles, pieces } = contextOf(this);
    const player = profiles.profile.id;
    const [curriculum, log] = await Promise.all([profiles.curriculumOf(player).catch(() => null), profiles.practiceLogOf(player).catch(() => null)]);
    if (visit !== this.talkVisit || !this.world) return;
    this.curriculum = curriculum;
    if (curriculum === null || log === null) return;
    const barCount = (piece: string) => pieces.find(piece)?.chart.bars.length;
    const learned = pieces.list().map((p) => p.chart).filter((chart) => pieceLearned(chart, profiles.learnProgressOf(chart.id), profiles.learnSettings)).map((c) => c.id);
    this.today = castToday({
      day: this.todayString(), log, dayOf: (iso) => dayString(new Date(iso)), barCount, characters: [...CHARACTERS.values()], world: this.world,
      curriculum, openScenes: visitable(this), learned,
    }, { presence: DEFAULT_PRESENCE_RULES, wanderers: WANDERER_RULES });
    const back = this.wandererBack;
    this.wandererBack = null;
    const bars = back ? barCount(back.piece) : undefined;
    const play = back && bars !== undefined ? wandererPlay(log, back.piece, bars, back.since) : null;
    if (back && play) {
      const day = this.todayString();
      const verdict = wandererVerdict(curriculum, back.id, play.share, WANDERER_RULES);
      let text = t('wanderer.notYet', { right: play.right, notes: play.notes });
      if (verdict.kept && !keptToday(this.world, back.id, day)) {
        this.world = giveKeepsake(this.world, back.id, day, WANDERER_RULES);
        const item = ITEMS.get(this.world.items[this.world.items.length - 1] ?? '');
        text = t('wanderer.kept', { right: play.right, notes: play.notes, item: item ? t(item.name as StringKey) : '' });
        if (this.worldSaves) await profiles.saveWorld(player, this.world);
      } else if (verdict.kept) text = t('wanderer.again', { right: play.right, notes: play.notes });
      this.sayWanderer(back.id, text, false);
    }
    if (this.sys.isActive()) this.redraw();
  }

  /** The wanderers standing here today (ft_1_37.AC6), each on the scene's first place, pressable; the line one says over its head. */
  private wanderers(origin: { x: number; y: number }, at: Rect): void {
    // the first place near enough to stand and talk at: a far one (drawn smaller) is out on the sea
    const place = this.sceneData.places.find((p) => (p.scale ?? 1) === 1) ?? this.sceneData.places[0];
    if (!place) return;
    for (const [id, ask] of Object.entries(this.today?.wanderers ?? {})) {
      const def = WANDERER_RULES.wanderers.find((w) => w.id === id);
      const actor = def ? ACTORS.get(def.actor) : undefined;
      if (!def || !actor || ask.scene !== this.sceneData.id) continue;
      const spot = placeActor(actor, place);
      const phase = this.look?.phase ?? 'day';
      const frames: readonly (Bitmap | RgbaArt)[] = actorFrames(actor, actorStateOf(actor, 'idle'), phase) ?? [boxOf(actor)];
      const images = frames.map((frame) => this.fineImage(origin.x + spot.x, origin.y + spot.y, frame).setName(`actor:${actor.id}`).setScale(spot.scale / ART_DETAIL).setFlipX(spot.mirrored).setVisible(false));
      const step = (time: number): void => {
        const frame = motionAllowed() ? actorFrame(actor, actorStateOf(actor, 'idle'), time) : 0;
        images.forEach((image, i) => image.setVisible(i === frame % images.length));
      };
      step(this.time.now);
      this.animators.push(step);
      const box: Rect = { x: (origin.x + spot.x) / ART_DETAIL, y: (origin.y + spot.y) / ART_DETAIL, w: (actor.size.w * spot.scale) / ART_DETAIL, h: (actor.size.h * spot.scale) / ART_DETAIL };
      this.button({ ...rectCentre(box), label: lineText(def.name), picture: createBitmap(Math.max(1, Math.round(box.w)), Math.max(1, Math.round(box.h))), onClick: () => this.pressWanderer(id) });
      const line = this.wandererLine;
      if (line?.id === id) {
        const words = spokenLine(spokenPages(line.text)[0] ?? [], talkColour('character', id));
        const head = { x: Math.round((origin.x + place.x) / ART_DETAIL) - at.x, y: Math.round(box.y) - at.y };
        const placed = lineSpot({ head, size: { w: words.width, h: words.height }, area: { w: at.w, h: at.h } });
        this.wandererLineImage = new PixelImage(this, at.x + placed.x, at.y + placed.y, words).setName('wandererLine');
        this.root.add(this.wandererLineImage);
        if (line.ask) this.wandererBoard(at, id, ask.piece);
      }
    }
  }

  /**
   * The wanderer's ask as a choice (d286, every selection a picture): a board over the scene with two pictures, each with its
   * word under it: the open music book, Play it, which opens the piano on the piece; the door, Not now, which closes the ask
   * (as a press beside the board does). A press on either within `DOUBLE_TAP_MS` of the board showing is a double tap on the
   * wanderer, and is ignored. AX-3 provisional: the words under the pictures.
   */
  private wandererBoard(at: Rect, id: string, piece: string): void {
    const { panel, cells } = standPanel(at, 2, WORDED_GAP);
    const answered = () => this.time.now - this.wandererAskedAt >= DOUBLE_TAP_MS;
    const outside = this.add.rectangle(0, 0, this.px.width, this.px.height, 0x000000, 0).setOrigin(0, 0).setInteractive();
    outside.on('pointerup', () => { if (answered()) this.closeWanderer(); });
    this.root.add(outside);
    this.root.add(new PixelImage(this, panel.x, panel.y, panelBitmap(panel.w, panel.h + WANDERER_WORD_ROWS, 'panel')).setInteractive().setName('wandererPanel'));
    const choices = [
      { cell: cells[0]!, word: t('wanderer.play'), name: 'wanderer:play', fine: learnBook(), coarse: null, pick: () => this.playForWanderer(id, piece) },
      { cell: cells[1]!, word: t('wanderer.notNow'), name: 'wanderer:notNow', fine: null, coarse: ICONS.quit, pick: () => this.closeWanderer() },
    ];
    for (const choice of choices) {
      const { cell } = choice;
      const [rest, lit] = (['card', 'cardHover'] as const).map((kind) => {
        const frame = new PixelImage(this, cell.x, cell.y, panelBitmap(cell.w, cell.h, kind));
        this.root.add(frame);
        return frame;
      }) as [PixelImage, PixelImage];
      lit.setVisible(false);
      if (choice.fine) this.fineImage(cell.x * ART_DETAIL + Math.floor((cell.w * ART_DETAIL - choice.fine.width) / 2), cell.y * ART_DETAIL + Math.floor((cell.h * ART_DETAIL - choice.fine.height) / 2), choice.fine).setName(choice.name);
      if (choice.coarse) this.root.add(new PixelImage(this, cell.x + Math.floor((cell.w - choice.coarse.width) / 2), cell.y + Math.floor((cell.h - choice.coarse.height) / 2), choice.coarse).setName(choice.name));
      // the word under the picture, so the choice is read without the pointer over it
      this.label(0, cell.y + cell.h + 2, choice.word, C.white).setName(`${choice.name}:word`).centerAt(cell.x + cell.w / 2);
      const light = (over: boolean) => { rest.setVisible(!over); lit.setVisible(over); };
      this.button({ ...rectCentre({ ...cell, h: cell.h + WANDERER_WORD_ROWS }), label: choice.word, picture: createBitmap(cell.w, cell.h + WANDERER_WORD_ROWS), onHover: light, onClick: () => { if (answered()) choice.pick(); } });
    }
  }

  /** Not now: the ask closes, and the wanderer stays for another press. */
  private closeWanderer(): void {
    this.wandererTimer?.remove();
    this.wandererTimer = null;
    this.wandererLine = null;
    if (this.sys.isActive()) this.redraw();
  }

  /** Play it (ft_1_37.AC7): the piano on the wanderer's piece, one pass in Wait mode with the staff, heard back in this scene. */
  playForWanderer(id: string, piece: string): boolean {
    const screen = SCENE_SCREENS[this.sceneData.id]?.scene;
    if (!screen || this.wandererLine?.id !== id || !this.wandererLine.ask) return false;
    startScene(this, 'practice', { chartId: piece, checkup: { since: new Date().toISOString(), wanderer: { id, scene: screen } } });
    return true;
  }

  /** A wanderer says `text` over its head: an ask until it is answered, any other line for its reading time or until the next press. */
  private sayWanderer(id: string, text: string, ask: boolean): void {
    this.wandererTimer?.remove();
    this.wandererTimer = null;
    this.wandererLine = { id, text, ask };
    if (ask) { this.wandererAskedAt = this.time.now; return; }
    // the line runs out without drawing the scene again, so an open backpack (the keepsake just given) stays open
    this.wandererTimer = this.time.delayedCall(readingMs(text), () => {
      this.wandererTimer = null;
      this.wandererLine = null;
      this.wandererLineImage?.destroy();
      this.wandererLineImage = null;
    });
  }

  /**
   * A press on a wanderer (ft_1_37.AC6, AC7): it asks for its piece over its head, with the board to answer it
   * (`wandererBoard`). One that gave its keepsake today says so and asks nothing more.
   */
  pressWanderer(id: string): boolean {
    const ask = this.today?.wanderers[id];
    if (!ask || !this.world || this.talk || this.tug || this.teach || this.scripted) return false;
    const { pieces } = contextOf(this);
    if (this.wandererLine?.ask) return false;
    if (keptToday(this.world, id, this.todayString())) this.sayWanderer(id, t('wanderer.thanks'), false);
    else {
      const chart = pieces.find(ask.piece)?.chart;
      this.sayWanderer(id, t('wanderer.ask', { piece: chart ? pieceTitle(chart) : ask.piece }), true);
    }
    this.redraw();
    return true;
  }

  /** The wanderers here today, the line one says and whether it waits for an answer, for the tests and the demo. */
  get wanderersHere(): { ids: string[]; saying: string | null; asking: boolean } {
    return {
      asking: this.wandererLine?.ask ?? false,
      ids: Object.entries(this.today?.wanderers ?? {}).filter(([, w]) => w.scene === this.sceneData.id).map(([id]) => id),
      saying: this.wandererLine?.text ?? null,
    };
  }

  /**
   * A met character's piece the student has learned bar by bar is taught (ft_1_32.AC15): kept with the character and saved,
   * so its talk goes on as after a teaching. Nothing with learning off.
   */
  private keepLearnedTaught(): void {
    const { flags, pieces, profiles } = contextOf(this);
    if (!flags.learn || !this.world) return;
    const learned = (piece: string): boolean => {
      const chart = pieces.find(piece)?.chart;
      return chart !== undefined && pieceLearned(chart, profiles.learnProgressOf(piece), profiles.learnSettings);
    };
    const next = learnedTaught(this.world, CHARACTERS.values(), learned, this.todayString());
    if (next === this.world) return;
    this.world = next;
    if (this.worldSaves) void profiles.saveWorld(profiles.profile.id, next);
  }

  /** The student's items, in the backpack in the top right corner (ft_1_21.AC15, ft_1_20, d282). */
  protected override backpackItems(): ToolbarItem[] {
    return backpackOf(this.world);
  }

  /** The items in the band now, by id: for the tests and the self-playing demo. */
  get bandInventory(): string[] {
    return keptEntries(this.world).map(({ item }) => item.id);
  }

  /**
   * The conversation's `tug` outcome starts the tug over the scene (ft_1_21.AC2, AC16) on the character's phrase of that
   * level (its `phrases`, d135: the piece it taught); false when that piece is not in the game (a draft in a build). Only
   * once the piece was practised for it (ft_1_21.AC19) and, after a lost tug, played clean again (ft_1_21.AC13): until
   * then the character says what practice it waits for.
   */
  private openTug(def: CharacterDef, head: { x: number; y: number }, outcome: Extract<Outcome, { tug: 1 | 2 | 3 }>): boolean {
    const context = contextOf(this);
    // a won level opens the next one (AC6)
    const tug = characterTug(def, outcome.tug, this.world, context.pieces);
    if (!tug || !this.talkLayer) return false;
    const { chart, level } = tug;
    // the player who played it keeps it, even if another is chosen while it is saved
    const player = context.profiles.profile.id;
    const { profiles } = context;
    // a tug needs the piece learned bar by bar; with learning off (`?learn=0`) any piece may be tugged (ft_1_32.AC15)
    const learned = !context.flags.learn || pieceLearned(chart, profiles.learnProgressOf(chart.id), profiles.learnSettings);
    const gate = characterTugGate(def, chart, level, this.world, profiles.profile.practice, learned);
    // the rung of its prize ladder this level gives (AC18), named in its closing line
    const prize = ITEMS.get(prizeFor(def, level) ?? '');
    this.tug = TugView.open(this, this.talkLayer, {
      ...(gate.open ? {} : { notYet: t(`tug.wait.${gate.wait.kind}`, { ...gate.wait }) }),
      ...(prize ? { prize: t(prize.name as StringKey) } : {}),
      chart,
      character: def,
      level,
      // as needy as the teacher set it (ft_1_37.AC8): every level's share moved
      rules: this.curriculum ? tugRulesFor(TUG_RULES, castSettingOf(this.curriculum, def.id, DEFAULT_PRESENCE_RULES).neediness) : TUG_RULES,
      place: { area: { w: this.px.width, h: this.mainRows }, head },
      devices: { piano: context.audio.piano, clock: context.audio.clock, keyboard: context.keyboard, metronome: context.audio.metronome },
      ...(this.cornerDoor ? { door: this.cornerDoor } : {}),
    }, {
      playing: (on) => this.figures.get(def.id)?.(on ? 'talk' : 'idle'),
      ended: (state) => {
        this.tug = null;
        this.talkLayer?.destroy();
        this.talkLayer = null;
        void this.keepTug(def, state, player);
      },
    });
    return true;
  }

  /**
   * The conversation's `teach` outcome (ft_1_22.AC3, WP-12): the character teaches its piece over the scene, on the staff,
   * three tries; a heard phrase is kept with the character in the world (`teachAfter`). False when the piece is not in
   * the game (a draft in a build).
   */
  private openTeach(def: CharacterDef, head: { x: number; y: number }, asked: string): boolean {
    const context = contextOf(this);
    // its own piece is the one its next tug needs while that is not learned yet (a won level 1 asks for level 2's piece),
    // else the conversation's; the teacher's pick in place of either (ft_1_37.AC4)
    const { profiles } = context;
    const next = characterTug(def, 1, this.world, context.pieces)?.chart;
    const own = next && !pieceLearned(next, profiles.learnProgressOf(next.id), profiles.learnSettings) ? next.id : asked;
    const piece = castTeachPiece(this.curriculum ?? undefined, def.id, own);
    const chart = context.pieces.find(piece)?.chart;
    if (!chart || !this.talkLayer) return false;
    // the character teaches its piece bar by bar (ft_1_32.AC15): learning opens, and leaving it comes back here, where a
    // learned piece is kept as taught. With learning off (`?learn=0`, the self-playing demo) the three tries stay
    const screen = SCENE_SCREENS[this.sceneData.id]?.scene;
    if (context.flags.learn && screen) {
      startScene(this, 'practice', { chartId: piece, learn: true, teacher: { scene: screen } });
      return true;
    }
    const player = context.profiles.profile.id;
    this.teach = TeachView.open(this, this.talkLayer, {
      chart,
      character: def,
      level: teachLevelOf(def, piece),
      rules: TUG_RULES,
      place: { area: { w: this.px.width, h: this.mainRows }, head },
      devices: { piano: context.audio.piano, clock: context.audio.clock, keyboard: context.keyboard },
      staff: (c) => this.teachStaff(c),
      ...(this.cornerDoor ? { door: this.cornerDoor } : {}),
    }, {
      playing: (on) => this.figures.get(def.id)?.(on ? 'talk' : 'idle'),
      ended: (state) => {
        this.teach = null;
        this.talkLayer?.destroy();
        this.talkLayer = null;
        if (state.outcome === undefined || !this.world || !this.worldSaves || context.profiles.profile.id !== player) return;
        const next = teachAfter(this.world, def.id, state, this.todayString());
        if (next === this.world) return;
        this.world = next;
        void context.profiles.saveWorld(player, next);
      },
    });
    return true;
  }

  /**
   * The staff of a taught phrase (ft_1_22.AC3), over the lower half of the picture with the player's staff settings, so
   * the character above it is seen playing and its line is read over its head. AX-3 provisional: the lower half, the
   * staff's own parchment over it.
   */
  private teachStaff(chart: Chart): StaffView {
    const { profiles } = contextOf(this);
    const rows = Math.floor(this.mainRows / 2);
    const height = Math.max(1, Math.round((this.mainRows - rows) * this.px.scale));
    const options = { viewport: { width: this.scale.width, height }, ...staffSpaceLimits(this.scale.zoom), staffGap: profiles.staffGap, noteNaming: profiles.noteNaming };
    const layout = layoutForSettings(chart, options, profiles.staffSettings);
    return new StaffView(this, layout, undefined, { noteNames: false, fingers: false }, { x: 0, y: this.mainTop + rows * this.px.scale });
  }

  /** A finished tug is kept: the character's record and its item in the world (AC8, AC15), the XP in the profile (AC9). */
  private async keepTug(def: CharacterDef, state: TugState, player: string): Promise<void> {
    if (state.outcome === undefined || state.outcome === 'left') return;
    const { profiles } = contextOf(this);
    if (profiles.profile.id !== player) return;
    const at = new Date().toISOString();
    // the tug record first: it is the active player's, and the world is saved by id after it
    await profiles.completeTug(tugRecord(state, def.id, TUG_RULES));
    if (this.world && this.worldSaves) {
      const before = this.world.items.length;
      this.world = tugAfter(this.world, def.id, state, prizeFor(def, state.setup.level), at);
      // the prize shows in the band at once
      if (this.world.items.length !== before && this.sys.isActive()) this.redraw();
      await profiles.saveWorld(player, this.world);
    }
  }

  /** The teaching open now, for the tests and the self-playing demo. */
  get teachState(): TeachView['view'] | null {
    return this.teach?.view ?? null;
  }

  /** The tug open now, for the tests and the self-playing demo. */
  get tugState(): TugView['view'] | null {
    return this.tug?.view ?? null;
  }

  /** Tempo mode: the song time of the student's phrase's ticks, for the tests and the self-playing demo. */
  get tugTransport(): { timeOfTick(tick: number): number | null } | null {
    return this.tug?.studentTransport ?? null;
  }

  /** The tests and the demo: the character's phrase ends now. */
  endTugPhrase(): void {
    this.tug?.endPhrase();
    this.teach?.endPhrase();
  }

  /** The conversation open now, for the tests and the self-playing demo. */
  get talkState(): TalkView['state'] {
    return this.talk?.state ?? null;
  }

  /** The self-playing demo: a press in the talk, or the closing line of a tug. */
  pressTalk(): void {
    if (this.talk) this.talk.press();
    else if (this.tug) this.tug.press();
    else this.teach?.press();
  }

  /** The self-playing demo: picks the choice that leads to the tug (or to the teaching); false when none is shown. */
  chooseTug(outcome: 'tug' | 'teach' = 'tug'): boolean {
    const index = this.talk?.choiceTo(outcome) ?? -1;
    if (index < 0) return false;
    this.talk!.choose(index);
    return true;
  }

  /** The phrase the student plays now in the teaching, for the self-playing demo; null in the character's turn. */
  get teachPhrase(): Chart | null {
    return this.teach?.studentPhrase ?? null;
  }

  /** The phrase the student plays now in the tug, for the self-playing demo; null in the character's turn. */
  get tugPhrase(): Chart | null {
    return this.tug?.studentPhrase ?? null;
  }

  /** Meets character `id` here as if it was pressed (the tests and the demo). */
  talkTo(id: string): Promise<boolean> {
    const def = CHARACTERS.get(id);
    const spot = this.characterSpots.get(id);
    if (!def || !spot) return Promise.resolve(false);
    return this.openTalk(def, spot.head);
  }
}

/** A scene an exit can lead to: one of the adventure scenes the game registers. */
function isAdventureScene(id: string): id is 'knoll' | 'crossroads' | 'docks' | 'terrace' {
  return id === 'knoll' || id === 'crossroads' || id === 'docks' || id === 'terrace';
}

/** Where actor `id` stands in the view's back-to-front order; one off the stage sorts first (it is hidden). */
function order(view: ScriptView, id: string): number {
  return view.actors.findIndex((a) => a.id === id);
}

/** An actor with no art yet (d137): a box of its size, outlined, on the fine grid. */
function boxOf(def: ActorDef): Bitmap {
  const { w, h } = def.size;
  const box = createBitmap(w, h);
  for (let x = 0; x < w; x++) { box.pixels[x] = C.gold; box.pixels[(h - 1) * w + x] = C.gold; }
  for (let y = 0; y < h; y++) { box.pixels[y * w] = C.gold; box.pixels[y * w + w - 1] = C.gold; }
  return box;
}

/** A scene file's area (fine pixels) as a box on the screen's art pixels, the picture drawn at `origin`. */
function areaBox(origin: { x: number; y: number }, area: Rect): Rect {
  return { x: (origin.x + area.x) / ART_DETAIL, y: (origin.y + area.y) / ART_DETAIL, w: area.w / ART_DETAIL, h: area.h / ART_DETAIL };
}
