import { firstPrintedBar } from '../core/chart';
import { ART_DETAIL } from '../core/layout/frame';
import { FOCUS_LAYOUT, type FocusLayout } from '../core/layout/focus';
import { strings, t, type StringKey as TextKey } from '../core/text/strings';
import { ROOM_OBJECTS, STRIP_ROWS, roomPlan, roomView, type RoomObject } from '../core/layout/room';
import { rectCentre, type Rect } from '../core/layout/rect';
import { PixelButton, PixelImage } from './ui/pixel/PixelObjects';
import { KIUR_ZZZ_FROM, plantStage } from './ui/pixel/keri/roomLife';
import { panelBitmap } from './ui/pixel/frames';
import { ICONS } from './ui/pixel/iconArt';
import { C } from './ui/pixel/palette';
import { drawnText, measure, renderText } from './ui/pixel/font';
import { BAR_BUTTON_HEIGHT } from './ui/pixel/playBars';
import { nameRibbon } from './ui/pixel/rankArt';
import { playerStats } from '../core/progression/playerStats';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { backpackOf } from './adventure/backpack';
import { PAINTED } from './ui/pixel/keri/keriPictures';
import { type Overlay } from './ui/pixel/pack';
import { stripArt } from './ui/pixel/keri/stripArt';
import { createBitmap } from './ui/pixel/bitmap';
import { currentLook } from './ui/pixel/sky/skyLooks';
import { flameAt, glowAt } from './ui/pixel/flicker';
import { dustAt } from './ui/pixel/motes';
import { BREATH_OUT, ZZZ_BOX, breathAt, steamAt, zzzAt } from './ui/pixel/wisps';
import { daySky } from './ui/pixel/windMotion';
import type { SceneLook } from '../core/sky/sceneLook';
import { contextOf } from './context';
import { startScene } from './scenes';
import { standPanel } from '../core/layout/standPanel';
import { pieceLearned } from '../core/learn/route';
import { phoneCall, type PhoneCall } from '../core/curriculum/phoneCall';
import { phoneAtRest, phoneRinging } from './ui/pixel/phoneArt';
import { learnBook, tugRope } from './ui/pixel/standArt';
import { STAND_CHOICES } from './room/standChoices';
import { motionAllowed } from './motion';
import { idleLongEnough } from '../core/visit/islandVisit';
import { visitNext } from './visit/islandVisit';
import type { WorldState } from '../core/island/worldState';
import { trainerLevel, trainerRules } from '../core/exchange/tugPlay';
import { tugGate } from '../core/exchange/tugGate';
import { playResultsFromLog } from '../core/curriculum/fromLog';
import { TUG_RULES } from './adventure/scenesData';
import { TugView } from './adventure/tugView';
import type { Curriculum } from '../core/curriculum/curriculum';
import { DEFAULT_EVALUATION_RULES } from '../core/curriculum/evaluate';
import type { PieceStatus } from '../core/curriculum/play';
import { EMPTY_PRACTICE_LOG, type PracticeLog } from '../core/progression';
import { parseKiurRules } from '../core/island/kiur';
import { parsePresenceRules } from '../core/island/presenceRules';
import { checkupPlay, holdCheckup, remindsIn, roomTalk } from '../core/island/roomTalk';
import type { TeacherLine } from '../core/island/teacher';
import type { KiurLine } from '../core/island/kiur';
import type { DayString } from '../core/contracts';
import { pieceTitle } from '../core/text/pieceTitle';
import { dayString } from '../io/teacher/teacherDesk';
import { teacherStatuses } from './teacher/teacherStatuses';
import { remindedOn, roomVisit } from './room/kiurDay';
import { RoomTalkView, type RoomLine } from './room/roomTalkView';
import kiurRulesJson from '../../content/world/kiur.json';
import { afterRoom, introDue, introFlags, lessonBars, roomSteps, stepRuns, type RoomSpot, type RoomStage, type RoomStep } from '../core/intro/intro';
import { INTRO } from './intro/introContent';
import { sliceChart, type Chart } from '../core/chart';
import { openOverlay } from './scenes';
import presenceRulesJson from '../../content/world/presence.json';

const KIUR_RULES = parseKiurRules(kiurRulesJson);
const PRESENCE_RULES = parsePresenceRules(presenceRulesJson);

/** What the room is opened with: the teacher's check-up just played (ft_1_27.AC2), its piece and when it began. */
export interface RoomData {
  checkup?: { piece: string; since: string };
  /** The piece picked for Kiur the trainer (ft_1_21.AC14): his tug on it opens in the room. */
  kiurTug?: string;
  /** The first-run intro goes on at this stage (ft_1_31): back from one of its plays, or from the map; `skip`: Esc there skipped it. */
  intro?: RoomStage | 'skip';
}

/** The teacher's place while she is in the room (ft_1_27.AC2): in the doorway she came through, a placeholder box until her look is painted. */
const TEACHER_BOX = { w: 14, h: 34 } as const;

/** What each object in the room opens, and its name (ft_1_08.AC6): a scene, or the stand's panel of trainers (ft_1_08.AC11). */
const OBJECTS: Record<RoomObject, { target: 'menu' | 'keriMap' | 'stand'; label: () => string }> = {
  piano: { target: 'menu', label: () => t('room.piano') },
  // the map of Keri (ft_1_18.AC4)
  door: { target: 'keriMap', label: () => t('room.door') },
  easel: { target: 'stand', label: () => t('room.stand') },
};

/** The shaft of daylight from the left sea window down to its patch on the rug, in fine pixels of the room's picture: where dust shows. */
const ROOM_SHAFT = { x: 196, y: 96, w: 124, h: 130 } as const;
/** How long each look of a moving thing shows, in milliseconds. The metronome ticks at 60 beats per minute. */
const TICK_MS = 500;
/**
 * The player's name written into the rank shield (ft_1_20.AC13; the name is part of the shield,
 * not a separate bubble): in fine pixels, on the shield's own grid, in the band above its chevrons. A longer name goes
 * whole on a ribbon over the shield's point (`ribbonUp` fine pixels above its foot; AX-3 provisional).
 */
const SHIELD_NAME = { top: 5, width: 36, ribbonUp: 12 } as const;
/** The player's card: its width, the height of a line, its margin. */
const CARD_WIDTH = 220;
const CARD_LINE = 10;
const CARD_PAD = 6;
const CLOSE = { width: 22, height: 16 } as const;
/** The intro's skip button: room round its word, and its distance from the screen's corner. */
const INTRO_SKIP = { pad: 10, margin: 4 } as const;

/**
 * The player's room (ft_1_07, the profile screen; a real room since ft_1_08, the warden's living room on Keri since
 * ft_1_18): the name, level and XP of the active player, Settings and Quit (Back, to the player list) are on the toolbar
 * above it (d088); under the band alone (ft_1_20.AC13) the name is written into the shield, the shield opens the
 * player's card and the note plant on the piano grows with the level's XP. The room is one painted picture (`virtual:keri-pictures`, made when the game is built) with the things
 * that move laid over it; its objects are the buttons, as clear boxes over their place in the picture: the piano (practice
 * songs, the piece menu), the door (the map of Keri) and the stand, whose panel of pictures opens every other trainer (the
 * note-name trainer ft_0_17, the ear trainer ft_1_10; ft_1_08.AC11, `room/standChoices.ts`). An object's name shows in a bubble on hover and with the keyboard
 * focus, and while the pointer is on it the object wakes into its second look (the piano's lid opens, the door swings in;
 * ft_1_20.AC15); the shield gets a contour instead (ft_1_20.AC14). The picture is a low band; the strip under it is kept free for the verb buttons and the inventory to come.
 * Placement is `core/layout/room.ts`.
 */
/** How long the ringing telephone shows each look of its shaken bells (ft_1_34). */
const RING_MS = 120;

export class ProfileDashboardScene extends PixelScene {
  protected override keyboardNavigation = true;
  /** The room's things stand in no rows: Left and Right go through them in their order across the screen (ft_Y_13). */
  protected override focusLayout: FocusLayout = FOCUS_LAYOUT.picture;

  /** The sky's look in the window: the phase when the room opened (ft_1_14 AC8). */
  private look: SceneLook | null = null;
  /** The screensaver (ft_1_17.AC4): when something was last pressed, played or moved, on the scene clock. */
  private lastInput: number | null = null;
  private touched = false;
  /** The player's card is open over the room (ft_1_20.AC13): its buttons are then the only ones the keyboard reaches. */
  private cardOpen = false;
  private cardButtons: PixelButton[] = [];
  /** The stand's panel of trainers is open over the room (ft_1_08.AC11): its pictures are then the only buttons the keyboard reaches. */
  private standOpen = false;
  private standButtons: PixelButton[] = [];
  /** Kiur's question is open over the room (ft_1_32 rule 14): learn a song bar by bar, or tug one; its two buttons are then the only ones the keyboard reaches. */
  private kiurOpen = false;
  private kiurButtons: PixelButton[] = [];
  /** The player's curriculum, for the telephone's call (ft_1_34); null until read, or when there is none. */
  private curriculum: Curriculum | null = null;
  /** The player's world (ft_1_21.AC14: whose tug Kiur practises); null until read. */
  private world: WorldState | null = null;
  /** False when the world could not be read: then a practice tug's cool-down is not written over it. */
  private worldSaves = false;
  /** Counts the visits, so a world read that finishes after the room was opened again is dropped. */
  private worldVisit = 0;
  /** Kiur's practice tug over the room (ft_1_21.AC14), and the layer it draws on. */
  private tug: TugView | null = null;
  private tugLayer: Phaser.GameObjects.Container | null = null;
  /** The piece picked for Kiur the trainer on the way here (`RoomData.kiurTug`), until his tug on it opens. */
  private kiurPiece: string | null = null;
  /** The check-up played just before this visit (`RoomData.checkup`); the teacher gives her verdict on it. */
  private heard: RoomData['checkup'] | null = null;
  /** The start of the last check-up handed to the room, so it is not heard again. */
  private heardSince: string | null = null;
  /** Today, the player's local day (the `now` switch sets it for tests and demos). */
  private day: DayString = '1970-01-01';
  /** The room's clock: the instant it opened (the `now` switch sets it) and when that was, so the time runs on from it. */
  private opened = { at: 0, real: 0 };
  /** Waits for the teacher's time today when she is not here yet (ft_1_26.AC9). */
  private teacherTimer: Phaser.Time.TimerEvent | null = null;
  /** This visit as Kiur counts it (ft_1_27.AC3): the game opening or a later visit, the visits before it, reminded today. */
  private moment: ReturnType<typeof roomVisit> = { occasion: 'open', visit: 0, remindedToday: false };
  /** What Kiur and the teacher say on this visit (ft_1_27.AC2, AC3), and the layer it draws on; null when nothing is said. */
  private talk: RoomTalkView | null = null;
  private talkLayer: Phaser.GameObjects.Container | null = null;
  /** The intro's skip button over the teacher's talk and the tug, as drawn now. */
  private skipLayer: Phaser.GameObjects.Container | null = null;
  /** The skip button was pressed: the stage running now ends the intro instead of going on. */
  private introSkipped = false;
  /** The teacher is in the room for this piece: the talk's end opens the check-up. */
  private checkupPiece: string | null = null;
  /** The teacher stands in the doorway on this visit (from her first line to her verdict). */
  private teacherHere = false;
  /** Her head while she stands there, where her lines and her tug are said. */
  private teacherHead: { x: number; y: number } | null = null;
  /** The intro's stage to go on with on this visit (`RoomData.intro`), until the world is read; then the stage running, or null. */
  private introNext: RoomStage | 'skip' | null = null;
  private introStage: RoomStage | null = null;
  /** What the intro's spotlight can show, as drawn now: in art pixels of the main area. */
  private spots: Partial<Record<RoomSpot, Rect>> = {};

  constructor() {
    super('profile');
  }

  init(data?: RoomData): void {
    // Phaser starts a scene with its last data when none is given: a check-up is heard once
    const checkup = data?.checkup ?? null;
    this.heard = checkup !== null && checkup.since !== this.heardSince ? checkup : null;
    this.kiurPiece = data?.kiurTug ?? null;
    this.introNext = data?.intro ?? null;
  }

  protected override back(): void {
    if (this.tug) return this.tug.leave();
    if (this.talk) return this.talk.leave();
    // between the intro's steps Esc does nothing: its spotlight and talks take it
    if (this.introStage) return;
    // Esc and Back close the player's card first
    if (this.cardOpen) {
      this.showCard(false);
      return;
    }
    if (this.standOpen) {
      this.showStand(false);
      return;
    }
    if (this.kiurOpen) {
      this.showKiur(false);
      return;
    }
    startScene(this, 'profiles');
  }

  protected override focusables(): PixelButton[] {
    if (this.tug || this.talk) return [];
    if (this.cardOpen) return this.cardButtons;
    if (this.kiurOpen) return this.kiurButtons;
    return this.standOpen ? this.standButtons : super.focusables();
  }

  private showCard(open: boolean): void {
    // the card and the backpack's menu never lie one over the other: opening the card closes the backpack
    if (open) this.closeMenu();
    this.cardOpen = open;
    this.redraw();
  }

  /** Opening the backpack closes the player's card. */
  protected override beforeBackpack(): void {
    if (this.cardOpen) this.showCard(false);
  }

  private showStand(open: boolean): void {
    this.standOpen = open;
    this.redraw();
  }

  private showKiur(open: boolean): void {
    this.kiurOpen = open;
    this.redraw();
  }

  /** The student's items, in the backpack in the top right corner (ft_1_21.AC15, ft_1_20, d282). */
  protected override backpackItems(): ToolbarItem[] {
    return backpackOf(this.world);
  }

  /** A scene object is reused on every visit: each visit to the room decides its sky again (ft_1_14 AC8). */
  override create(): void {
    this.look = null;
    this.cardOpen = false;
    this.standOpen = false;
    this.kiurOpen = false;
    this.lastInput = null;
    this.touched = false;
    // anything the player does counts as being there: the pointer, a key, a note on the piano
    const touch = () => {
      this.touched = true;
    };
    this.input.on('pointermove', touch);
    this.input.on('pointerdown', touch);
    this.onWindowKey(touch);
    this.events.once('shutdown', contextOf(this).keyboard.onNote(touch));
    this.world = null;
    this.curriculum = null;
    this.worldSaves = false;
    this.tug = null;
    this.talk = null;
    this.checkupPiece = null;
    this.teacherHere = false;
    this.teacherHead = null;
    this.introStage = null;
    this.introSkipped = false;
    this.spots = {};
    this.worldVisit += 1;
    const context = contextOf(this);
    this.opened = { at: context.flags.sky.now ?? Date.now(), real: Date.now() };
    this.day = dayString(this.now());
    this.teacherTimer = null;
    this.moment = roomVisit(context.profiles.profile.id, this.day);
    void this.readWorld(this.worldVisit);
    // while the practice tug plays, or Kiur or the teacher speaks, the keys are theirs, ahead of the room's keyboard navigation
    this.onWindowKey((e) => {
      if (!this.tug?.key(e) && !this.talk?.key(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    });
    // a practice tug still playing when the room closes is silenced and not kept
    this.events.once('shutdown', () => { this.tug?.stop(); this.tug = null; });
    super.create();
  }

  override update(time: number): void {
    super.update(time);
    // the practice tug's judge follows the song clock (Tempo mode); while it is open the room is not left alone
    if (this.tug) {
      this.tug.update(contextOf(this).audio.clock.nowMs());
      this.touched = true;
    }
    // nor while someone speaks
    if (this.talk) this.touched = true;
    // left alone long enough, the room goes visiting the island's open scenes by itself (ft_1_17.AC4); never in the
    // self-playing demo, never with reduced motion
    if (this.touched || this.lastInput === null) this.lastInput = time;
    this.touched = false;
    if (!idleLongEnough(this.lastInput, time) || !motionAllowed() || contextOf(this).flags.autoplay) return;
    // with no scene open yet the room stays, and waits the whole time again
    this.lastInput = time;
    visitNext(this, null);
  }

  /** An overlay of the picture as images, one per frame, at its place. */
  /**
   * The fire's flames going round their loop (`flameAt`): the drawing it is at shows whole and the next one fades in
   * over it, so the tongues lick up smoothly instead of jumping; with reduced motion the first stands.
   */
  private flames(images: readonly PixelImage[], seed: number): void {
    const n = images.length;
    const show = (time: number): void => {
      const at = flameAt(time, n, seed), low = Math.floor(at) % n, next = (low + 1) % n, part = at - Math.floor(at);
      // the later image lies over the earlier; where the loop wraps, the first lies under the last, so the last fades out
      const over = next > low;
      images.forEach((image, i) => {
        const weight = i === low ? (over ? 1 : 1 - part) : i === next ? (over ? part : 1) : 0;
        image.setVisible(weight > 0).setAlpha(weight);
      });
    };
    images.forEach((image, i) => image.setVisible(i === 0));
    if (motionAllowed() && images.length > 1) this.animators.push(show);
  }

  private laid(overlay: Overlay, origin: Rect, palette: readonly number[]): PixelImage[] {
    return overlay.frames.map((frame) => this.fineImage(origin.x * ART_DETAIL + overlay.x, origin.y * ART_DETAIL + overlay.y, frame, palette));
  }

  protected override clear(): void {
    this.tug?.clear();
    this.tugLayer?.destroy();
    this.tugLayer = null;
    this.talk?.clear();
    this.talkLayer?.destroy();
    this.talkLayer = null;
    this.skipLayer?.destroy();
    this.skipLayer = null;
  }

  protected draw(): void {
    const screen = { w: this.px.width, h: this.px.height };
    this.sky();
    // under the band the band itself is the strip kept free (ft_1_20)
    const { picture: at, strip } = roomView(screen, this.bandShown ? 0 : STRIP_ROWS);
    const plan = roomPlan();
    const sky = contextOf(this).flags.sky;
    this.look ??= currentLook(sky.now ?? Date.now(), sky.phase, sky.wind);
    // the room is painted for the sky phase of the hour (ft_1_14.AC8): the same switches as the map of Keri
    const picture = this.loaded(PAINTED.room, this.look.phase);
    if (!picture) return;
    const palette = picture.palette;

    // the room in the fire's light, which breathes; the flames; the sea's glints in the windows
    // the light dissolves from one strength into the next: stepped, the whole room jumped (the jump looked glitchy)
    // and it wanders up and down in no set rhythm (smoother, with randomness where it makes sense)
    const seed = daySky(sky.now ?? Date.now(), this.look.wind).seed % 1000;
    const glow = (time: number): number => glowAt(time, picture.looks.length, seed);
    this.blend(picture.looks.map((look) => this.fineImage(at.x * ART_DETAIL, at.y * ART_DETAIL, look, palette)), glow);
    // each object's second look, laid on the room while the pointer is on it (ft_1_20.AC15; the piano
    // lid is normally closed and opens on hover): its frames breathe with the fire as the room's do, and all are clear
    // until the object wakes
    const woken = new Set<RoomObject>();
    const second = Object.fromEntries(ROOM_OBJECTS.map((thing) => {
      const frames = this.laid(picture.awake[thing], at, palette);
      frames.forEach((frame, i) => frame.setAlpha(0).setName(`awake:${thing}:${i}`));
      this.blend(frames, glow, () => (woken.has(thing) ? 1 : 0));
      return [thing, frames];
    })) as Record<RoomObject, PixelImage[]>;
    // the fire's light sets each look's opacity while the room moves; with reduced motion the object's one look is shown as it is
    const wake = (thing: RoomObject) => (over: boolean) => {
      if (over) woken.add(thing);
      else woken.delete(thing);
      second[thing].forEach((frame) => frame.setAlpha(over ? 1 : 0));
    };
    // the flames jump from drawing to drawing in no set order (`flicker.ts`)
    this.flames(this.laid(picture.flames, at, palette), seed);
    const glint = this.laid(picture.shimmer, at, palette)[0]!;
    // the sea's glint in the windows comes and goes softly in no set rhythm, as a light's strength wanders (`flicker.ts`)
    this.blend([this.fineImage(0, 0, createBitmap(1, 1)), glint], (time) => glowAt(time * 0.6, 2, seed + 31));
    // the contour round the shield, which has no second look, shown while the pointer is on it (ft_1_20.AC14)
    const contour = this.laid(picture.hover, at, palette)[0]!.setVisible(false).setName('hover:shield');
    // the rank shield of the level earned from XP (ft_1_09), over the piano beside the portrait; it opens the player's card (ft_1_20.AC13)
    const progress = contextOf(this).profiles.progress;
    const shields = this.laid(picture.shield, at, palette);
    const worn = Math.min(shields.length, Math.max(1, Math.floor(progress.level.level))) - 1;
    shields.forEach((shield, i) => shield.setVisible(i === worn));
    // the note plant on the sill grows as the level's XP fills, in place of an XP bar
    const plants = this.laid(picture.plant, at, palette);
    const grown = plantStage(progress.level.progress);
    plants.forEach((plant, i) => plant.setVisible(i === grown));
    // the metronome ticks on the piano, the tea steams, Kiur breathes in its sleep on the bed
    this.cycle(this.laid(picture.metronome, at, palette), TICK_MS);
    const fine = { x: at.x * ART_DETAIL, y: at.y * ART_DETAIL };
    // dust drifts in the window's light while the sun is up (`motes.ts`)
    if (this.look.phase === 'day' || this.look.phase === 'dawn') this.motes((time) => dustAt(time, ROOM_SHAFT, 9, seed), fine, 9);
    // the steam is drawn afresh as the room runs (`wisps.ts`): wisps leave the mug in their own time, in the box over it
    const steam = picture.steam.frames[0]!, mouth = (steam.height - 1) * steam.width + Math.floor(steam.width / 2) - 1;
    const steamTones = { light: steam.pixels[mouth]!, mid: steam.pixels[mouth - 3 * steam.width]! };
    this.liveLayer({ x: picture.steam.x, y: picture.steam.y, w: steam.width, h: steam.height, draw: (time, out) => steamAt(time, { w: steam.width, h: steam.height }, steamTones, seed, (x, y, tone) => { out[y * steam.width + x] = tone; }) }, fine, palette);
    // Kiur breathes in breaths of uneven length, and a letter of his sleep floats up with each breath out
    const asleep = this.laid(picture.kiur, at, palette);
    const breathe = (time: number): void => {
      const inward = breathAt(time, seed).part < BREATH_OUT;
      asleep.forEach((frame, i) => frame.setVisible(i === (inward ? 1 : 0)));
    };
    breathe(0);
    if (motionAllowed()) this.animators.push(breathe);
    const card = picture.zzz.frames[0]!, first = KIUR_ZZZ_FROM.y * card.width + KIUR_ZZZ_FROM.x;
    const zzzTones = { light: card.pixels[first]!, mid: card.pixels[first + 1]! };
    const letters = this.liveLayer({
      x: picture.zzz.x + KIUR_ZZZ_FROM.x - ZZZ_BOX.from.x, y: picture.zzz.y + KIUR_ZZZ_FROM.y - ZZZ_BOX.from.y, w: ZZZ_BOX.w, h: ZZZ_BOX.h,
      draw: (time, out) => zzzAt(time, zzzTones, seed, (x, y, tone) => { out[y * ZZZ_BOX.w + x] = tone; }),
    }, fine, palette);
    // Kiur woken while the pointer is on him: clear (alpha 0) at rest, as the objects' second looks are (ft_1_20.AC15)
    const awake = this.laid(picture.kiurAwake, at, palette)[0]!.setAlpha(0).setName('awake:kiur');
    // the strip under the picture, kept free for the verb buttons and the inventory to come
    if (strip.h > 0) this.root.add(new PixelImage(this, strip.x, strip.y, stripArt(strip.w, strip.h)));

    // the objects, in this order for the keyboard and the tests: piano, door, stand. Each is a clear box over its place in the picture
    const box = (r: Rect): Rect => ({ x: at.x + r.x, y: at.y + r.y, w: r.w, h: r.h });
    for (const thing of ROOM_OBJECTS) {
      const { target, label } = OBJECTS[thing];
      const r = box(plan.objects[thing]);
      this.button({ ...rectCentre(r), label: label(), picture: createBitmap(r.w, r.h), onHover: wake(thing), onClick: () => (target === 'stand' ? this.showStand(true) : startScene(this, target)) });
    }
    // the shield opens the player's card; under the band alone the player's name is written into it (ft_1_20.AC13)
    const shield = { x: at.x + Math.floor(plan.shield.x / ART_DETAIL), y: at.y + Math.floor(plan.shield.y / ART_DETAIL), w: Math.ceil(plan.shield.w / ART_DETAIL), h: Math.ceil(plan.shield.h / ART_DETAIL) };
    this.button({ ...rectCentre(shield), label: t('room.shield'), picture: createBitmap(shield.w, shield.h), onHover: (over) => contour.setVisible(over), onClick: () => this.showCard(true) });
    if (!this.toolbarShown) this.nameOnShield({ x: at.x * ART_DETAIL + plan.shield.x, y: at.y * ART_DETAIL + plan.shield.y, w: plan.shield.w, h: plan.shield.h });
    this.kiur(at, picture.kiur, (over) => {
      awake.setAlpha(over ? 1 : 0);
      asleep.forEach((frame) => frame.setAlpha(over ? 0 : 1));
      letters.setAlpha(over ? 0 : 1);
    });
    this.phone(at, plan.phone);
    const teacher = this.teacherHere ? this.teacher(at, plan.objects.door) : null;
    this.teacherHead = teacher;
    const kiurFrame = picture.kiur.frames[0]!;
    this.spots = {
      piano: box(plan.objects.piano), door: box(plan.objects.door), stand: box(plan.objects.easel), shield,
      kiur: { x: at.x + Math.floor(picture.kiur.x / ART_DETAIL), y: at.y + Math.floor(picture.kiur.y / ART_DETAIL), w: Math.ceil(kiurFrame.width / ART_DETAIL), h: Math.ceil(kiurFrame.height / ART_DETAIL) },
    };
    if (this.talk && !this.tug) {
      this.talkLayer = this.overlayLayer();
      this.talk.drawIn(this.talkLayer, { area: { w: this.px.width, h: this.mainRows }, heads: { kiur: this.kiurHead(at, picture.kiur), teacher: teacher ?? this.kiurHead(at, picture.kiur) } });
    }
    this.standButtons = this.standOpen ? this.stand(at) : [];
    this.kiurButtons = this.kiurOpen ? this.kiurAsks(at) : [];
    this.cardButtons = this.cardOpen ? this.card() : [];
    if (this.tug) {
      this.tugLayer = this.overlayLayer();
      this.tug.redrawIn(this.tugLayer);
    }
    if (this.introStage && (this.talk || this.tug)) this.introSkipButton();
  }

  /**
   * The intro's skip button (the intro needs a skip button) in the top right corner, over
   * the teacher's talk and the tug, which take every press on the screen under it; Kiur's spotlight has its own.
   */
  private introSkipButton(): void {
    const label = t('intro.skip');
    const w = measure(drawnText(label)) + INTRO_SKIP.pad, h = BAR_BUTTON_HEIGHT;
    this.skipLayer = this.overlayLayer().setName('introSkip');
    const button = new PixelButton(this, this.skipLayer, { x: this.px.width - INTRO_SKIP.margin - w / 2, y: INTRO_SKIP.margin + h / 2, width: w, height: h, label, onClick: () => this.skipIntro() });
    this.buttons.push(button);
  }

  /** The skip button: the talk or the tug running now is left, and the intro ends there, kept as done. */
  private skipIntro(): void {
    if (!this.introStage) return;
    this.introSkipped = true;
    if (this.talk) return this.talk.leave();
    if (this.tug) return this.tug.leave();
    this.endIntro(contextOf(this).profiles.profile.id);
  }

  /** Now on the room's clock. */
  private now(): Date {
    return new Date(this.opened.at + Date.now() - this.opened.real);
  }

  /**
   * The active player's world, curriculum and practice log, read once a visit (`visit`, so a read that finishes after the
   * room was opened again is dropped); once here, Kiur can offer a practice tug, and Kiur and the teacher speak.
   */

  private async readWorld(visit: number, late = false): Promise<void> {
    const { profiles } = contextOf(this);
    const player = profiles.profile.id;
    const [read, curriculum, log] = await Promise.all([
      profiles.worldOf(player).catch(() => null),
      profiles.curriculumOf(player).catch(() => null),
      profiles.practiceLogOf(player).catch(() => null),
    ]);
    if (visit !== this.worldVisit) return;
    // a save that cannot be read is never written over
    this.worldSaves = read !== null;
    this.world = read ?? { flags: [], items: [], met: {}, teacherVisits: [] };
    if (!late && this.introDue(log ?? EMPTY_PRACTICE_LOG)) {
      const stage = this.introNext ?? 'tour';
      this.introNext = null;
      if (stage !== 'skip') {
        void this.runIntro(player, stage, visit);
        return;
      }
      this.endIntro(player);
    }
    // the telephone rings once the curriculum is read (ft_1_34)
    const rings = (c: Curriculum | null) => this.call(c)?.ringing === true;
    const changed = rings(curriculum) !== rings(this.curriculum);
    this.curriculum = curriculum;
    if (curriculum !== null) this.speak(player, curriculum, log ?? EMPTY_PRACTICE_LOG, late);
    if (changed && !this.talk && this.sys.isActive()) this.redraw();
    // drawn again only when the read changed the room: someone speaks (a redraw under the pointer drops its hover)
    if (this.talk && this.sys.isActive()) this.redraw();
  }

  /**
   * What is said on this visit (ft_1_27.AC2, AC3): after a check-up, the teacher's verdict on the play she heard, kept in
   * the world; else Kiur's lines (`roomTalk`), then the teacher's first line when she has landed today. Kiur counts a
   * reminder said as reminded today. When she comes later today (her test time, ft_1_26.AC9), the room waits for her; `late`
   * is that moment, when only her arrival is said (Kiur's heads-up that she landed, then her line).
   */
  private speak(player: string, curriculum: Curriculum, log: PracticeLog, late = false): void {
    const { pieces } = contextOf(this);
    const barsOf = (id: string) => pieces.find(id)?.chart.bars.length;
    const statuses = teacherStatuses(curriculum, log, barsOf, this.day, (iso) => dayString(new Date(iso)));
    const heard = this.heard;
    this.heard = null;
    if (heard && this.verdict(player, heard, log, statuses)) return;
    const now = this.now();
    const moment = late ? { occasion: 'room' as const, visit: 0, remindedToday: true } : this.moment;
    const talk = roomTalk({
      ...moment, day: this.day, minutes: now.getHours() * 60 + now.getMinutes(), curriculum, statuses, world: this.world!,
      kiurRules: KIUR_RULES, presenceRules: PRESENCE_RULES, minPlays: DEFAULT_EVALUATION_RULES.minPlays,
    });
    if (remindsIn(talk.kiur)) remindedOn(player, this.day);
    if (late && talk.checkup === null) return this.waitForTeacher(talk.next, now);
    this.waitForTeacher(talk.next, now);
    const lines: RoomLine[] = (late ? talk.kiur.filter((l) => !remindsIn([l])) : talk.kiur).map((l) => ({ who: 'kiur', text: this.lineText(l) }));
    if (talk.checkup) lines.push({ who: 'teacher', text: this.lineText(talk.checkup.arrival) });
    this.checkupPiece = talk.checkup?.piece ?? null;
    this.teacherHere = talk.checkup !== null;
    this.openTalk(lines);
  }

  /**
   * The teacher comes at `next` (minutes after midnight) today: the room reads again then and she arrives, unless the
   * student is busy with a tug or a talk then (she comes on the next visit).
   */
  private waitForTeacher(next: number | null, now: Date): void {
    this.teacherTimer?.remove();
    this.teacherTimer = null;
    if (next === null) return;
    const wait = (next * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())) * 1000 - now.getMilliseconds() + 50;
    const visit = this.worldVisit;
    this.teacherTimer = this.time.delayedCall(Math.max(0, wait), () => {
      this.teacherTimer = null;
      if (visit === this.worldVisit && !this.talk && !this.tug && this.sys.isActive()) void this.readWorld(visit, true);
    });
  }

  /** The teacher's verdict on the check-up just played, kept in the world; false when no whole play was heard. */
  private verdict(player: string, heard: NonNullable<RoomData['checkup']>, log: PracticeLog, statuses: readonly PieceStatus[]): boolean {
    const chart = contextOf(this).pieces.find(heard.piece)?.chart;
    const expected = statuses.find((s) => s.piece === heard.piece)?.expected;
    const play = chart === undefined ? null : checkupPlay(log, heard.piece, chart.bars.length, heard.since, DEFAULT_EVALUATION_RULES, firstPrintedBar(chart));
    if (play === null || expected === undefined) return false;
    // heard once: Phaser starts the room with this data again when it is next started with none
    this.heardSince = heard.since;
    const { world, verdict } = holdCheckup(this.world!, this.day, play, expected);
    this.world = world;
    if (this.worldSaves) void contextOf(this).profiles.saveWorld(player, world);
    this.teacherHere = true;
    this.openTalk(verdict.lines.map((l) => ({ who: 'teacher', text: this.lineText(l) })));
    return true;
  }

  /** A line's words: its piece's title in place of `{piece}`. */
  private lineText(l: KiurLine | TeacherLine): string {
    const chart = l.piece === undefined ? undefined : contextOf(this).pieces.find(l.piece)?.chart;
    // a key the game does not have shows as itself (content is checked in its tests)
    if (!(l.line in strings)) return l.line;
    return t(l.line as TextKey, { ...l.params, ...(l.piece === undefined ? {} : { piece: chart ? pieceTitle(chart) : l.piece }) });
  }

  private openTalk(lines: readonly RoomLine[]): void {
    if (lines.length === 0) {
      this.teacherHere = false;
      return;
    }
    this.talk = new RoomTalkView(this, lines, {
      changed: () => this.redraw(),
      ended: (how) => {
        this.talk = null;
        const piece = this.checkupPiece;
        this.checkupPiece = null;
        this.teacherHere = false;
        // her first line read to the end opens the piano with her piece (one press, ft_1_27.AC2); Back there returns here
        if (how === 'read' && piece !== null && contextOf(this).pieces.find(piece)) {
          startScene(this, 'practice', { chartId: piece, checkup: { since: new Date().toISOString() } });
          return;
        }
        if (this.sys.isActive()) this.redraw();
      },
    });
  }

  /** What Kiur and the teacher say now, for the tests and the self-playing demo; null when nobody speaks. */
  get talkState(): RoomTalkView['state'] {
    return this.talk?.state ?? null;
  }

  /** Turns the page of what is said now (a press), for the tests. */
  pressTalk(): void {
    this.talk?.press();
  }

  /** Kiur's head on the bed, in art pixels of the main area: where his lines are said. */
  private kiurHead(at: Rect, overlay: Overlay): { x: number; y: number } {
    const frame = overlay.frames[0]!;
    return { x: at.x + Math.floor(overlay.x / ART_DETAIL) + Math.round(frame.width / ART_DETAIL / 2), y: at.y + Math.floor(overlay.y / ART_DETAIL) };
  }

  /**
   * The teacher in the doorway (ft_1_27.AC2): a placeholder box standing on the door's foot until her look is painted
   * (`TODO(painter)` in ft_1_27). Returns her head, where her lines are said.
   */
  private teacher(at: Rect, door: Rect): { x: number; y: number } {
    const x = at.x + door.x + Math.floor((door.w - TEACHER_BOX.w) / 2);
    const y = at.y + door.y + door.h - TEACHER_BOX.h;
    const box = createBitmap(TEACHER_BOX.w, TEACHER_BOX.h);
    for (let i = 0; i < TEACHER_BOX.w; i++) { box.pixels[i] = C.teal; box.pixels[(TEACHER_BOX.h - 1) * TEACHER_BOX.w + i] = C.teal; }
    for (let i = 0; i < TEACHER_BOX.h; i++) { box.pixels[i * TEACHER_BOX.w] = C.teal; box.pixels[i * TEACHER_BOX.w + TEACHER_BOX.w - 1] = C.teal; }
    this.root.add(new PixelImage(this, x, y, box).setName('teacher'));
    return { x: x + Math.round(TEACHER_BOX.w / 2), y };
  }

  /**
   * Kiur on the bed is pressed to teach or to train (ft_1_32 rule 14, ft_1_21.AC14): he asks whether to learn a song bar by
   * bar or to tug one (`kiurAsks`); the piece book opens for that, and a piece picked to tug comes back here for his tug. A clear box over the sleeping bird; under the
   * pointer he wakes into his second look (`wake`: head up, eyes open, a gold note over him), as the room's objects do.
   */
  private kiur(at: Rect, overlay: Overlay, wake: (over: boolean) => void): void {
    if (this.tug || this.talk || this.cardOpen || this.standOpen || this.kiurOpen || this.introStage) return;
    const frame = overlay.frames[0]!;
    const x = at.x + Math.floor(overlay.x / ART_DETAIL), y = at.y + Math.floor(overlay.y / ART_DETAIL);
    const r = { x, y, w: Math.ceil(frame.width / ART_DETAIL), h: Math.ceil(frame.height / ART_DETAIL) };
    const head = { x: x + Math.round(r.w / 2), y };
    this.button({ ...rectCentre(r), label: t('room.kiur'), picture: createBitmap(r.w, r.h), onHover: wake, onClick: () => { wake(false); this.showKiur(true); } });
    // back from the piece book with a piece: his tug opens once the room is drawn
    const piece = this.kiurPiece;
    if (piece === null) return;
    this.kiurPiece = null;
    this.time.delayedCall(0, () => { if (this.sys.isActive() && !this.tug && !this.talk) this.kiurTug(head, piece); });
  }

  /**
   * Kiur's question (ft_1_32 rule 14): a board over the room with two pictures, an open music book to learn a song bar by
   * bar and a rope with its rag to tug one, each opening the piece book for it; their names show only in their bubbles. A press beside the board closes it. Placement is the stand's (`standPanel`).
   */
  private kiurAsks(at: Rect): PixelButton[] {
    const choices = [{ id: 'learn', name: 'room.kiur.learn', picture: learnBook }, { id: 'tug', name: 'room.kiur.tug', picture: tugRope }] as const;
    const { panel, cells } = standPanel(at, choices.length);
    const outside = this.add.rectangle(0, 0, this.px.width, this.px.height, 0x000000, 0).setOrigin(0, 0).setInteractive();
    outside.on('pointerup', () => this.showKiur(false));
    this.root.add(outside);
    this.root.add(new PixelImage(this, panel.x, panel.y, panelBitmap(panel.w, panel.h, 'panel')).setInteractive().setName('kiurPanel'));
    return choices.map((choice, i) => {
      const cell = cells[i]!;
      const [rest, lit] = (['card', 'cardHover'] as const).map((kind) => {
        const frame = new PixelImage(this, cell.x, cell.y, panelBitmap(cell.w, cell.h, kind));
        this.root.add(frame);
        return frame;
      }) as [PixelImage, PixelImage];
      lit.setVisible(false);
      // a picture, its name only in its bubble: every selection is a picture
      const art = choice.picture();
      this.fineImage(cell.x * ART_DETAIL + Math.floor((cell.w * ART_DETAIL - art.width) / 2), cell.y * ART_DETAIL + Math.floor((cell.h * ART_DETAIL - art.height) / 2), art).setName(`kiur:${choice.id}`);
      const light = (over: boolean) => {
        rest.setVisible(!over);
        lit.setVisible(over);
      };
      return this.button({ ...rectCentre(cell), label: t(choice.name), picture: createBitmap(cell.w, cell.h), onHover: light, onClick: () => startScene(this, 'menu', { forKiur: choice.id }) });
    });
  }

  /** The telephone's call now (ft_1_34): the teacher's piece it is about and whether it rings; null when it is quiet. */
  private call(curriculum: Curriculum | null = this.curriculum): PhoneCall | null {
    if (curriculum === null) return null;
    const { pieces, profiles } = contextOf(this);
    const chart = (id: string) => pieces.find(id)?.chart;
    return phoneCall(curriculum, {
      known: (id) => chart(id) !== undefined,
      learned: (id) => pieceLearned(chart(id)!, profiles.learnProgressOf(id), profiles.learnSettings),
      begun: (id) => profiles.learnProgressOf(id).lastDay !== null,
    });
  }

  /**
   * The old wall telephone (ft_1_34): it rings (its bells shaken in turn) while the teacher's curriculum holds a piece
   * whose learning has not begun; pressed, it opens the piece of its call to be learned bar by bar. Pressed while there is
   * no piece to learn, Kiur says it is quiet. `place` is its box in the plan, in layout cells of the picture.
   */
  private phone(at: Rect, place: Rect): void {
    const call = this.call();
    const rest = phoneAtRest();
    const x = (at.x + place.x) * ART_DETAIL + Math.floor((place.w * ART_DETAIL - rest.width) / 2);
    const y = (at.y + place.y) * ART_DETAIL + Math.floor((place.h * ART_DETAIL - rest.height) / 2);
    const looks = call?.ringing ? phoneRinging() : [rest];
    const images = looks.map((look, i) => this.fineImage(x, y, look).setName(call?.ringing ? `phone:ringing:${i}` : 'phone'));
    this.cycle(images, RING_MS);
    const r = { x: at.x + place.x, y: at.y + place.y, w: place.w, h: place.h };
    this.button({
      ...rectCentre(r), label: t(call?.ringing ? 'room.phone.ringing' : 'room.phone'), picture: createBitmap(r.w, r.h),
      onClick: () => {
        if (this.tug || this.talk || this.cardOpen || this.standOpen || this.kiurOpen || this.introStage) return;
        const now = this.call();
        if (now) startScene(this, 'practice', { chartId: now.piece, learn: true });
        else {
          this.openTalk([{ who: 'kiur', text: t('room.phone.quiet') }]);
          this.redraw();
        }
      },
    });
  }

  /**
   * A piece picked to tug with Kiur: his tug opens once the piece is learned (ft_1_32 rule 15); before that he says to learn
   * it with him first, and nothing is played. With learning off (`?learn=0`) every piece may be tugged.
   */
  private kiurTug(head: { x: number; y: number }, piece: string): void {
    const { pieces, profiles, flags } = contextOf(this);
    const chart = pieces.find(piece)?.chart;
    if (!chart) return;
    if (flags.learn && !pieceLearned(chart, profiles.learnProgressOf(chart.id), profiles.learnSettings)) {
      this.openTalk([{ who: 'kiur', text: t('room.kiur.learnFirst', { piece: pieceTitle(chart) }) }]);
      this.redraw();
      return;
    }
    this.openPractice(head, piece);
  }

  /**
   * Whether this visit goes on with the first-run intro (ft_1_31.AC1): back from one of its plays, or due for this player
   * (`introDue`, the `?intro=` switch; never while the game plays itself). A world that could not be read never starts it,
   * so it is not offered again and again with nothing kept.
   */
  private introDue(log: PracticeLog): boolean {
    const { flags, profiles } = contextOf(this);
    if (flags.autoplay || flags.intro === 'off') return false;
    if (this.introNext !== null) return true;
    if (!this.worldSaves && flags.intro !== 'force') return false;
    const played = profiles.profile.attempts.length > 0 || log.bars.length > 0;
    return introDue({ flags: this.world!.flags, played, mode: flags.intro });
  }

  /** The intro's lesson: the first bars of its piece as a piece of their own (no XP, `sliceChart`), or null in a build without it. */
  private lesson(): Chart | null {
    const { piece, first, last } = lessonBars(INTRO);
    const chart = contextOf(this).pieces.find(piece)?.chart;
    return chart && last < chart.bars.length ? sliceChart(chart, first, last) : null;
  }

  /** The intro's flags kept in the player's world (`intro.started`, `intro.done`), when the world can be saved. */
  private keepIntro(player: string, event: 'started' | 'done'): void {
    if (!this.world) return;
    this.world = { ...this.world, flags: introFlags(this.world.flags, event) };
    if (this.worldSaves) void contextOf(this).profiles.saveWorld(player, this.world);
  }

  /**
   * One stage of the first-run intro in the room (ft_1_31.AC2, AC4): its steps said in runs, Kiur's under the spotlight
   * overlay (`IntroScene`), the teacher's from the doorway; then what follows (`afterRoom`): the next stage, a play on the
   * practice screen with the lesson, the tug over the room, or the end. Esc in a spotlight or a talk skips the rest of the
   * intro, kept as done (AX-3 provisional).
   */
  private async runIntro(player: string, stage: RoomStage, visit: number): Promise<void> {
    const lesson = this.lesson();
    this.introStage = stage;
    if (stage === 'tour') this.keepIntro(player, 'started');
    // the teacher stands in the doorway from her first line at the knock, and through the stages after it
    this.teacherHere = stage !== 'tour' && stage !== 'knock' && lesson !== null;
    this.redraw();
    const steps = roomSteps(INTRO, stage, lesson !== null);
    for (const run of stepRuns(steps)) {
      if (visit !== this.worldVisit) return;
      const read = run[0]!.who === 'kiur' ? await this.introSpotlight(run) : await this.introTalk(run);
      if (visit !== this.worldVisit) return;
      if (!read) return this.endIntro(player);
    }
    const next = afterRoom(INTRO, stage, lesson !== null);
    if (next.kind === 'room') return this.runIntro(player, next.stage, visit);
    // out to the map of Keri, where Kiur shows a place and the way home; it comes back at `AFTER_MAP`
    if (next.kind === 'map') {
      startScene(this, 'keriMap', { intro: true });
      return;
    }
    if (next.kind === 'done') return this.endIntro(player);
    if (lesson === null) return this.endIntro(player);
    if (next.kind === 'play') {
      // the lesson's bars as a section of the piece: practice, no XP, its bars kept in the log under the piece (core_03)
      const { piece, first, last } = lessonBars(INTRO);
      startScene(this, 'practice', { chartId: piece, section: { first, last }, intro: { stage: next.stage, passes: next.passes } });
      return;
    }
    this.introTug(player, lesson, visit);
  }

  /** The intro's text for a line: every line may name the passes practise asks for. */
  private introText(step: RoomStep): string {
    return t(step.line as TextKey, { n: INTRO.practisePasses });
  }

  /** Kiur's steps under the spotlight, over the paused room; false when skipped (Esc). */
  private async introSpotlight(run: readonly RoomStep[]): Promise<boolean> {
    const top = this.mainTopRows;
    const steps = run.map((step) => {
      const spot = step.who === 'kiur' && step.spot ? this.spots[step.spot] ?? null : null;
      return { spot: spot ? { ...spot, y: spot.y + top } : null, text: this.introText(step) };
    });
    return (await openOverlay(this, 'intro', { steps })) === 'read';
  }

  /** The teacher's steps from the doorway, as the room's talk; false when left (Esc). */
  private introTalk(run: readonly RoomStep[]): Promise<boolean> {
    this.teacherHere = true;
    return new Promise((resolve) => {
      this.talk = new RoomTalkView(this, run.map((step) => ({ who: step.who, text: this.introText(step) })), {
        changed: () => this.redraw(),
        ended: (how) => {
          this.talk = null;
          if (this.sys.isActive()) this.redraw();
          resolve(how === 'read');
        },
      });
      this.redraw();
    });
  }

  /** The intro's tug: the teacher against the student on the lesson, at level 1, keeping nothing (as Kiur's practice tug). */
  private introTug(player: string, lesson: Chart, visit: number): void {
    const context = contextOf(this);
    this.tug = TugView.open(this, this.overlayLayer(), {
      chart: lesson,
      character: { id: 'teacher' },
      kind: 'practiceTug',
      level: 1,
      rules: trainerRules(TUG_RULES),
      place: { area: { w: this.px.width, h: this.mainRows }, head: this.teacherHead ?? { x: Math.round(this.px.width / 2), y: 20 } },
      devices: { piano: context.audio.piano, clock: context.audio.clock, keyboard: context.keyboard, metronome: context.audio.metronome },
    }, {
      playing: () => undefined,
      ended: () => {
        this.tug = null;
        if (visit !== this.worldVisit || !this.sys.isActive()) return;
        if (this.introSkipped) this.endIntro(player);
        else void this.runIntro(player, 'end', visit);
      },
    });
    this.redraw();
  }

  /** The intro is over, played to its end or skipped: kept as done, and the room is the player's again. */
  private endIntro(player: string): void {
    this.keepIntro(player, 'done');
    this.introStage = null;
    this.teacherHere = false;
    // a skip in Kiur's spotlight ends the intro while the overlay still pauses the room: drawn again once it runs, so Kiur
    // on the bed can be pressed on this visit (the way into learning, ft_1_32 rule 14)
    if (this.sys.isActive()) this.redraw();
    else this.time.delayedCall(0, () => { if (this.sys.isActive() && !this.introStage) this.redraw(); });
  }

  /** The intro's stage running now, for the tests; null when none. */
  get introState(): RoomStage | null {
    return this.introStage;
  }

  /**
   * Kiur the trainer's tug over the room on `piece` (AC14): the tug's rules won and lost at `practiceSteps`, at the
   * highest level the piece is practised for (`trainerLevel`), never shut by the practice gate; nothing is kept.
   */
  private openPractice(head: { x: number; y: number }, piece: string): void {
    const context = contextOf(this);
    const chart = context.pieces.find(piece)?.chart;
    if (!chart) return;
    const plays = playResultsFromLog(context.profiles.profile.practice, chart.id, chart.bars.length, (iso) => dayString(new Date(iso)), DEFAULT_EVALUATION_RULES);
    const level = trainerLevel((l) => tugGate({ plays, piece: chart.id, level: l, rules: TUG_RULES, lastPlays: DEFAULT_EVALUATION_RULES.lastPlays, cleanPlaysSinceLost: 0, cooldownCleanPlays: 0 }).open);
    this.tug = TugView.open(this, this.overlayLayer(), {
      chart,
      character: { id: 'kiur' },
      kind: 'practiceTug',
      level,
      rules: trainerRules(TUG_RULES),
      place: { area: { w: this.px.width, h: this.mainRows }, head },
      devices: { piano: context.audio.piano, clock: context.audio.clock, keyboard: context.keyboard, metronome: context.audio.metronome },
    }, {
      playing: () => undefined,
      ended: () => {
        this.tug = null;
        if (this.sys.isActive()) this.redraw();
      },
    });
    this.redraw();
  }

  /** Kiur's practice tug open now, for the tests. */
  get tugState(): TugView['view'] | null {
    return this.tug?.view ?? null;
  }

  /** Ends the phrase playing now in the practice tug, for the tests. */
  endTugPhrase(): void {
    this.tug?.endPhrase();
  }

  /**
   * The stand's panel over the room (ft_1_08.AC11; clicking it gives a choice of all
   * available options there, as pictures, not text): a board with one picture per trainer from `STAND_CHOICES`, each a
   * button that opens its trainer and shows its name only in its bubble. The room is not darkened behind it; a press
   * beside the board closes it. Returns its buttons. Placement is `core/layout/standPanel.ts`.
   */
  private stand(at: Rect): PixelButton[] {
    const { panel, cells } = standPanel(at, STAND_CHOICES.length);
    const outside = this.add.rectangle(0, 0, this.px.width, this.px.height, 0x000000, 0).setOrigin(0, 0).setInteractive();
    outside.on('pointerup', () => this.showStand(false));
    this.root.add(outside);
    // the board itself takes its presses, so only a press beside it closes it
    this.root.add(new PixelImage(this, panel.x, panel.y, panelBitmap(panel.w, panel.h, 'panel')).setInteractive().setName('standPanel'));
    return STAND_CHOICES.map((choice, i) => {
      const cell = cells[i]!;
      // each picture in its own frame, which lights under the pointer
      const [rest, lit] = (['card', 'cardHover'] as const).map((kind) => {
        const frame = new PixelImage(this, cell.x, cell.y, panelBitmap(cell.w, cell.h, kind));
        this.root.add(frame);
        return frame;
      }) as [PixelImage, PixelImage];
      lit.setVisible(false);
      const art = choice.picture();
      this.fineImage(cell.x * ART_DETAIL + Math.floor((cell.w * ART_DETAIL - art.width) / 2), cell.y * ART_DETAIL + Math.floor((cell.h * ART_DETAIL - art.height) / 2), art).setName(`stand:${choice.id}`);
      const light = (over: boolean) => {
        rest.setVisible(!over);
        lit.setVisible(over);
      };
      return this.button({ ...rectCentre(cell), label: t(choice.name), picture: createBitmap(cell.w, cell.h), onHover: light, onClick: () => startScene(this, choice.scene) });
    });
  }

  /**
   * The player's name in gold letters on the shield, drawn on the fine grid of the shield's own pixels (d110), so it reads as
   * painted on it; `shield` is in fine pixels of the main area.
   */
  private nameOnShield(shield: Rect): void {
    const name = drawnText(contextOf(this).profiles.profile.name);
    const letters = renderText(name, { color: C.goldLight, shadow: C.ink });
    // named, so a test can find it among the room's pictures
    if (measure(name) <= SHIELD_NAME.width) {
      this.fineImage(shield.x + Math.floor((shield.w - letters.width) / 2), shield.y + SHIELD_NAME.top, letters).setName('shieldName');
      return;
    }
    // a name too long for the shield's band is never cut: it is written whole on a ribbon hung over the shield's point
    const { ribbon, at } = nameRibbon(letters);
    const x = Math.max(0, Math.min(this.px.width * ART_DETAIL - ribbon.width, shield.x + Math.floor((shield.w - ribbon.width) / 2)));
    const y = shield.y + shield.h - SHIELD_NAME.ribbonUp;
    this.fineImage(x, y, ribbon).setName('shieldRibbon');
    this.fineImage(x + at.x, y + at.y, letters).setName('shieldName');
  }

  /**
   * The player's card over the room (ft_1_20.AC13; the shield opens a window of
   * detailed stats and skills, for now what the game already tracks): the name and level, the XP, then what the save counts.
   * Returns its buttons; a press outside the card closes it.
   */
  private card(): PixelButton[] {
    const context = contextOf(this);
    const stats = playerStats(context.profiles.profile, context.profiles.progress);
    const xp = stats.xpForLevel === null ? t('menu.xpTop', { xp: stats.totalXp }) : t('menu.xp', { xp: stats.xpIntoLevel, next: stats.xpForLevel });
    const lines: [string, string][] = [
      [t('card.xp'), xp],
      [t('card.pieces'), String(stats.piecesPlayed)],
      [t('card.passes'), String(stats.passes)],
      [t('card.fiveStars'), String(stats.fiveStarPieces)],
      [t('card.tugsWon'), String(stats.tugsWon)],
      [t('card.noteTrainer'), String(stats.noteTrainerXp)],
      [t('card.earPoints'), String(stats.earPoints)],
    ];
    const { width, height } = this.px;
    const h = 2 * CARD_PAD + CARD_LINE * (lines.length + 1) + 2;
    const x = Math.floor((width - CARD_WIDTH) / 2);
    const y = Math.max(0, Math.floor((this.mainRows - h) / 2));
    // the room behind it darkens, and a press there closes the card
    const shade = this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0, 0).setInteractive();
    shade.on('pointerup', () => this.showCard(false));
    this.root.add(shade);
    // the card itself takes its presses, so only a press beside it closes it
    this.root.add(new PixelImage(this, x, y, panelBitmap(CARD_WIDTH, h, 'panel')).setInteractive());
    const name = this.label(x + CARD_PAD, y + CARD_PAD, context.profiles.profile.name, C.gold);
    this.label(name.x + name.width + 6, y + CARD_PAD, t('menu.level', { level: stats.level }), C.white);
    lines.forEach(([label, value], i) => {
      const lineY = y + CARD_PAD + CARD_LINE * (i + 1) + 2;
      this.label(x + CARD_PAD, lineY, label, C.dim);
      const shown = this.label(0, lineY, value, C.white);
      shown.x = x + CARD_WIDTH - CARD_PAD - shown.width;
    });
    const close = this.button({ x: x + CARD_WIDTH - CARD_PAD - CLOSE.width / 2 + 2, y: y + CARD_PAD + 2, ...CLOSE, label: t('card.close'), icon: ICONS.quit, iconOnly: true, onClick: () => this.showCard(false) });
    return [close];
  }
}
