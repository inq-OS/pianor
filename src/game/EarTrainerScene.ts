import earLevelsJson from '../../content/trainer/ear-levels.json';
import { earAnswerChart } from '../core/trainer/earChart';
import {
  EAR_NEXT_PAUSE_MS, EAR_ROUND_STARS, chooseEarStep, earKeyAction, earLevelOf, earRowFor, earStepOf, isRepeatDue, pickQuestion, pointsForMisses, pressEar, roundStars,
  startQuestion, starsNeeded, EAR_STAR_POINTS, type EarQuestion,
} from '../core/trainer/earTrainer';
import { loadEarLevels } from '../core/trainer/earLevels';
import { earAnswerLayout } from '../core/trainer/staffFrame';
import { displayText } from '../core/text/language';
import { t } from '../core/text/strings';
import { MS_PER_SECOND } from '../core/chart';
import { staffSpaceLimits } from '../core/layout/canvasSize';
import { contextOf } from './context';
import { ICONS } from './ui/pixel/iconArt';
import { fromAscii, recolor } from './ui/pixel/bitmap';
import { PixelBar, PixelImage, pixelStars } from './ui/pixel/PixelObjects';
import { STAR_FULL } from './ui/pixel/sprites';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { C } from './ui/pixel/palette';
import { PixelScene, type MenuItem, type ToolbarItem } from './ui/pixel/PixelScene';
import { StaffView } from './ui/staff/StaffView';
import { startScene } from './scenes';
import { watchKeyBash } from './practice/bashDoor';

const MARGIN = 8;
/** The ear level line at the top of the main area: the ear, "Ear level N" and a bar of the points towards the next level.
 * Low enough that an accent over a capital (the Estonian Õ) stays on the light card, under its torn top edge. */
const LEVEL_Y = 8;
const LEVEL_BAR_WIDTH = 48;
const LEVEL_BAR_HEIGHT = 5;
/** The round's stars, twice the sprite size, centred above the staff. */
const STARS_Y = 14;
/** A two-note question's progress under the stars: one slot per note, filled once that note is found (no name). */
const SLOTS_Y = 33;
const SLOT_GAP = 4;
/** A slot, in the round stars' manner: an ink outline, empty while the note is to find, filled gold once it is found. */
const SLOT_ROWS = ['.kkkkkk.', 'kffffffk', 'kffffffk', 'kffffffk', 'kffffffk', 'kffffffk', 'kffffffk', '.kkkkkk.'];
const SLOT_EMPTY = fromAscii(SLOT_ROWS.map((r) => r.replace(/f/g, '.')), { k: C.ink });
const SLOT_FOUND = fromAscii(SLOT_ROWS.map((r, y) => (y === 1 ? r.replace('ff', 'hh') : r)), { k: C.ink, f: C.gold, h: C.goldLight });
/**
 * A new ear level (AC5's one bigger moment): "Ear level N" between two gold stars on the top card, beside the
 * round's stars and clear of the staff, for this long, ms (the next question takes it away sooner). AX-3 provisional: two seconds, long enough to read, short enough to leave the answer to be read.
 */
const LEVEL_UP_MS = 2000;
const LEVEL_UP_DEPTH = 20;
/** A cell of the step menu, layout cells: a row number. */
const STEP_CELL = { w: 16, h: 16 };
const STARS_ZOOM = 2;
const STAR_GAP = 2;
/** The answer's staff, under the stars. */
const STAFF_TOP = 48;
/** The one miss with words, "right letter, wrong octave", under the stars while the question is open (no staff there yet). */
const WRONG_OCTAVE_Y = 50;
/** MIDI velocity of the question's notes, a comfortable mezzo-forte. */
const VELOCITY = 90;
/** How often the repeat check runs, ms. The rule itself is exact; this only decides how soon a repeat is noticed. */
const REPEAT_CHECK_MS = 250;
/**
 * The clock for key timing (ft_1_10.AC11), wall time in ms. Not the scene clock: that one only moves once per frame and falls
 * behind real time when frames are slow, while key presses arrive in real time.
 */
const keyClock = () => performance.now();
/** Keys that are never pressed alone on purpose: they do not continue (ft_1_10.AC11). */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Escape', 'Tab']);

const table = loadEarLevels(earLevelsJson).levels;
const LENGTHS = [1, 2, 3] as const;

/**
 * The pitch trainer by ear (ft_1_10). The game sounds one note or two; the student finds them on the keys. The staff shows only
 * after the question is found, with the note names on it (ft_1_10.AC1, AC7). The rules are in `core/trainer`; this scene plays
 * the notes, shows the stars and hands each key press to the rule. Almost no text: the stars say how the
 * round went, the buttons are pictures on the toolbar.
 * The ear points and the two settings are the active player's, saved at once (version 16, ft_1_10 AC5, AC6, AC9).
 */
export class EarTrainerScene extends PixelScene {
  protected override keyboardNavigation = false;

  private questionNumber = 0;
  private seed = `${Date.now()}`;
  private notes: number[] = [];
  private question!: EarQuestion;
  /** The time the last sound ended or the student last pressed a key, on the scene clock (ms). */
  private lastActivityMs = 0;
  /** The question's notes still to start or stop, and the ones sounding now: a new sounding stops them first. */
  private soundTimers: Phaser.Time.TimerEvent[] = [];
  private sounding = new Set<number>();
  /** The finished question raised the ear level: the level line is gold until the next question (AC5's one bigger moment). */
  private levelUp = false;
  /** Until when the new level's card shows, on the scene clock (ms); 0 when it does not. */
  private levelUpUntil = 0;
  private levelUpCard: Phaser.GameObjects.Container | null = null;
  /**
   * The step the student chose (a row of the table, from 1), or null to follow the ear level (ft_1_10.AC13). Kept for the visit
   * only: each visit starts on the row the level earned (AX-1).
   */
  private chosenStep: number | null = null;
  /** The last press was the right letter in the wrong octave: the one fact said in words (AC3); cleared by the next press. */
  private wrongOctave = false;
  private unsubscribe: (() => void) | null = null;
  private repeatTimer: Phaser.Time.TimerEvent | null = null;
  /** When the question was found, on `keyClock` (ms); null while it is open (ft_1_10.AC11). */
  private doneAtMs: number | null = null;
  /** When the open question starts to sound, on `keyClock` (ms); keys before it are not answers (ft_1_10.AC11). */
  private soundsAtMs = 0;
  /** A two-note question's slots as last drawn, found or not (read by the end-to-end test). */
  private shownSlots: boolean[] = [];
  /** The round's stars as last drawn, lit of total (read by the end-to-end test). */
  private shownStars: { lit: number; total: number } | null = null;
  private staff: StaffView | null = null;

  constructor() {
    super('earTrainer');
  }

  override create(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.events.once('shutdown', () => this.stopListening());
    // key bashing brings Kiur to the door here too (ft_1_15.AC8); the door is the way out
    watchKeyBash(this, contextOf(this).keyboard, () => this.leave());
    // every piano key (the EZ-220, the on-screen keys, the computer keyboard's note keys) comes here
    this.unsubscribe = contextOf(this).keyboard.onNote((event) => {
      // nothing is judged while an overlay is open over the trainer (Kiur at the door)
      if (event.kind === 'on' && event.velocity > 0 && this.scene.isActive()) this.onKey(event.midi);
    });
    // any other computer key (Space, Enter, ...) can only continue; a note key also arrives above, and is ignored there
    this.onWindowKey((e) => {
      // a key on an overlay over the trainer (Kiur at the door) is the overlay's
      if (!e.repeat && !MODIFIER_KEYS.has(e.key) && this.scene.isActive()) this.onKey(null);
    });
    // a click or touch on the screen (not on a button) goes on too, for a mouse or a tablet without the on-screen keys
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.onKey(null);
    });
    this.repeatTimer = this.time.addEvent({ delay: REPEAT_CHECK_MS, loop: true, callback: () => this.checkRepeat() });
    this.nextQuestion();
    super.create();
  }

  protected override back(): void {
    this.leave();
  }

  protected override clear(): void {
    this.staff?.destroy();
    this.staff = null;
    this.levelUpCard?.destroy(true);
    this.levelUpCard = null;
  }

  /** The active player's ear points, saved (version 16). */
  private get points(): number {
    return contextOf(this).profiles.earPoints;
  }

  private get seconds(): (typeof LENGTHS)[number] {
    return contextOf(this).profiles.earTrainerSettings.seconds;
  }

  private get repeatOn(): boolean {
    return contextOf(this).profiles.earTrainerSettings.repeat;
  }

  private get level(): number {
    return earLevelOf(this.points).level;
  }

  /** The row the questions come from: the chosen one, or the one the level earned (ft_1_10.AC13). */
  private get step(): number {
    return earStepOf(this.level, this.chosenStep, table.length);
  }

  private get row() {
    return earRowFor(table, this.step);
  }

  /**
   * The screen's buttons are pictures on the toolbar (d088): play again, repeat, the note length (an hourglass and 1, 2 or 3 s,
   * cycling) and the step (stairs and its number, opening the rows to choose from, ft_1_10.AC13).
   */
  protected override toolbarItems(): ToolbarItem[] {
    const repeat = t(this.repeatOn ? 'ear.repeatOn' : 'ear.repeatOff');
    return [
      { label: displayText(t('ear.playAgain')), icon: ICONS.ear, iconOnly: true, tooltip: t('ear.playAgain'), main: true, onClick: () => this.play() },
      { label: displayText(repeat), icon: TOOL_ICONS.listenRepeat, iconOnly: true, active: this.repeatOn, tooltip: repeat, onClick: () => this.toggleRepeat() },
      { label: displayText(t('ear.lengthTip')), value: displayText(t('ear.length', { n: this.seconds })), icon: TOOL_ICONS.orderDeadline, tooltip: t('ear.lengthTip'), onClick: () => this.cycleLength() },
      {
        label: displayText(t('theory.step', { n: this.step })), value: String(this.step), icon: TOOL_ICONS.steps, tooltip: t('ear.stepTip'), onClick: () => undefined,
        menu: { items: () => this.stepItems(), cell: STEP_CELL, columns: table.length },
      },
    ];
  }

  /** Every row of the table, up or down: levels never lock one (ft_1_10.AC13). The row in use is lit; the one the ear level earned has a pip. */
  private stepItems(): MenuItem[] {
    const earned = earStepOf(this.level, null, table.length);
    return table.map((row, i) => ({
      label: `${i + 1}`, active: i + 1 === this.step, marked: i + 1 === earned, tooltip: t(row.mode === 'two' ? 'ear.stepTwo' : 'ear.stepOne', { n: i + 1 }),
      onPick: () => this.chooseStep(i + 1),
    }));
  }

  /** A new step starts a new question from its row; the earned row follows the level again. */
  private chooseStep(step: number): void {
    this.chosenStep = chooseEarStep(step, this.level, table.length);
    this.nextQuestion();
  }

  /** With the band (ft_1_20): play again and the length are actions; repeat is a worn item, lit while on. */
  protected override bandActions(): ToolbarItem[] {
    return this.toolbarItems().filter((_, i) => i !== 1);
  }

  protected override bandItems(): ToolbarItem[] {
    return [this.toolbarItems()[1]!];
  }

  protected draw(): void {
    const { width } = this.px;
    const rows = this.mainRows;
    const { stars, starPoints } = earLevelOf(this.points);
    this.sky();
    // the level and the round's stars on a card on the desk, written in ink; the staff lies under it
    this.parchmentCard({ x: 3, y: 2, w: width - 8, h: STAFF_TOP - 4 }, 3);
    this.inkWriting = true;

    // the ear level: the ear, "Ear level N" and the points towards the next level as a bar (AC1, AC5)
    const ear = new PixelImage(this, this.titleX(MARGIN), LEVEL_Y - 2, recolor(ICONS.ear, { [C.white]: C.featherStreak }));
    this.root.add(ear);
    const level = this.label(ear.x + ear.width + 4, LEVEL_Y, t('ear.level', { n: this.level }), this.levelUp ? C.gold : C.white);
    const fraction = (stars * EAR_STAR_POINTS + starPoints) / (starsNeeded(this.level) * EAR_STAR_POINTS);
    this.root.add(new PixelBar(this, level.x + level.width + 6, LEVEL_Y + 1, LEVEL_BAR_WIDTH, LEVEL_BAR_HEIGHT, fraction, 'ink'));

    // the round's stars in the middle above the staff: 5 at the start, one dimmed per miss (AC3, AC10)
    this.shownStars = { lit: roundStars(this.question.misses), total: EAR_ROUND_STARS };
    const starsWidth = (EAR_ROUND_STARS * (STAR_FULL.width + STAR_GAP) - STAR_GAP) * STARS_ZOOM;
    pixelStars(this, this.root, Math.round((width - starsWidth) / 2), STARS_Y, this.shownStars.lit, { total: EAR_ROUND_STARS, gap: STAR_GAP, zoom: STARS_ZOOM, ink: true });
    // a two-note question: one slot per note under the stars, filled as each is found, with no name (the answer comes after)
    this.shownSlots = this.notes.length > 1 ? this.notes.map((_, i) => i < this.question.index) : [];
    const slotsWidth = this.shownSlots.length * (SLOT_EMPTY.width + SLOT_GAP) - SLOT_GAP;
    this.shownSlots.forEach((found, i) => {
      this.root.add(new PixelImage(this, Math.round((width - slotsWidth) / 2) + i * (SLOT_EMPTY.width + SLOT_GAP), SLOTS_Y, found ? SLOT_FOUND : SLOT_EMPTY));
    });

    this.inkWriting = false;
    if (this.wrongOctave) this.label(0, WRONG_OCTAVE_Y, t('ear.wrongOctave'), C.white).centerAt(width / 2);

    if (this.question.done) this.drawAnswer(rows);
    if (this.time.now < this.levelUpUntil) this.drawLevelUp(Math.round((width + starsWidth) / 2));
  }

  /**
   * The new level's moment (AC5's one bigger moment, not by colour alone): "Ear level N" between two gold stars, written on
   * the top card to the right of the round's stars, so the answer on the staff stays in view, for LEVEL_UP_MS.
   */
  private drawLevelUp(starsRight: number): void {
    const { width } = this.px;
    this.inkWriting = true;
    const text = this.label(0, 0, t('ear.level', { n: this.level }), C.white);
    this.inkWriting = false;
    const gap = 5;
    const w = STAR_FULL.width * 2 + text.displayWidth + gap * 2;
    // centred in the room between the round's stars and the card's right end, level with the stars' middle
    const x = Math.max(starsRight + gap, Math.round((starsRight + width - 8 - w) / 2));
    const middle = STARS_Y + Math.round((STAR_FULL.height * STARS_ZOOM) / 2);
    text.setPosition(x + STAR_FULL.width + gap, middle - Math.round(text.displayHeight / 2));
    const stars = [x, x + w - STAR_FULL.width].map((sx) => new PixelImage(this, sx, middle - Math.ceil(STAR_FULL.height / 2), STAR_FULL));
    this.levelUpCard = this.add.container(this.root.x, this.root.y).setScale(this.px.scale).setDepth(LEVEL_UP_DEPTH);
    this.levelUpCard.add([text, ...stars]);
  }

  /** The answer on the staff, the note names on the notes, after the question is found (ft_1_10.AC7). */
  private drawAnswer(rows: number): void {
    const { scale } = this.px;
    const top = this.mainTop + STAFF_TOP * scale;
    const height = Math.max(1, (rows - STAFF_TOP - 4) * scale);
    const { profiles } = contextOf(this);
    const chart = earAnswerChart(this.notes);
    const options = { viewport: { width: this.scale.width, height }, ...staffSpaceLimits(this.scale.zoom), staffGap: profiles.staffGap, noteNaming: profiles.noteNaming };
    // room for every answer of the row, so the staff stands in the same place from one question to the next
    const layout = earAnswerLayout(chart, this.row.keys, options, profiles.staffSettings);
    this.staff = new StaffView(this, layout, undefined, { noteNames: true, fingers: false }, { x: 0, y: top }, []);
  }

  /** A new question from the level's row, seeded; the notes sound after `pauseMs` (0 for the button, a pause after a key). */
  private nextQuestion(pauseMs = 0): void {
    this.questionNumber += 1;
    const previous = this.notes.length > 0 ? this.notes : null;
    this.notes = pickQuestion(this.seed, this.questionNumber, this.row, previous);
    this.question = startQuestion(this.notes);
    this.levelUp = false;
    this.levelUpUntil = 0;
    this.wrongOctave = false;
    this.doneAtMs = null;
    this.soundsAtMs = keyClock() + pauseMs;
    this.play(pauseMs);
    this.redraw();
  }

  /** Sound the notes one after another, each for the duration setting, starting `delayMs` from now (ft_1_10.AC2, AC6). */
  private play(delayMs = 0): void {
    const { piano } = contextOf(this).audio;
    const step = this.seconds * MS_PER_SECOND;
    // a question sounds alone: what is left of the last sounding (Play again, or the question before) stops first
    this.stopSounding();
    this.notes.forEach((midi, i) => {
      this.soundTimers.push(
        this.time.delayedCall(delayMs + i * step, () => {
          this.sounding.add(midi);
          piano.noteOn(midi, VELOCITY);
        }),
        this.time.delayedCall(delayMs + (i + 1) * step, () => {
          this.sounding.delete(midi);
          piano.noteOff(midi);
        }),
      );
    });
    this.lastActivityMs = this.time.now + delayMs + this.notes.length * step;
  }

  /**
   * One key, a piano key (`midi`) or another computer key (null). The rule decides: it answers an open question, continues
   * after a found one, or is ignored; the key that continued is never an answer in the next round (ft_1_10.AC11).
   */
  private onKey(midi: number | null): void {
    const action = earKeyAction({ done: this.question.done, doneAtMs: this.doneAtMs, soundsAtMs: this.soundsAtMs }, keyClock());
    if (action === 'continue') this.nextQuestion(EAR_NEXT_PAUSE_MS);
    else if (action === 'answer' && midi !== null) this.press(midi);
  }

  /** Repeat the question when nothing happened for twice its sounding time (the rule decides). */
  private checkRepeat(): void {
    if (this.question.done) return;
    const due = isRepeatDue({ now: this.time.now, lastActivityMs: this.lastActivityMs, seconds: this.seconds, notes: this.notes.length, repeatOn: this.repeatOn });
    if (due) this.play();
  }

  private toggleRepeat(): void {
    void contextOf(this).profiles.updateEarTrainer({ repeat: !this.repeatOn }).then(() => this.redraw());
  }

  /** One button for the note length: 1, 2, 3 s, then 1 again. */
  private cycleLength(): void {
    const seconds = LENGTHS[(LENGTHS.indexOf(this.seconds) + 1) % LENGTHS.length]!;
    void contextOf(this).profiles.updateEarTrainer({ seconds }).then(() => this.redraw());
  }

  /** One key press goes to the rule. A wrong press dims a star; the last right one finishes the question and scores it. */
  private press(midi: number): void {
    if (this.question.done) return;
    const result = pressEar(this.question, midi);
    this.question = result.question;
    this.lastActivityMs = this.time.now;
    // a miss dims a star; only the wrong octave is also said, with no direction and no praise (AC3)
    this.wrongOctave = result.verdict === 'miss' && result.reason === 'wrong-octave';
    if (result.verdict === 'done') {
      this.doneAtMs = keyClock();
      const before = this.level;
      void contextOf(this).profiles.addEarPoints(pointsForMisses(result.question.misses));
      this.levelUp = this.level > before;
      if (this.levelUp) {
        this.levelUpUntil = this.time.now + LEVEL_UP_MS;
        this.time.delayedCall(LEVEL_UP_MS, () => this.redraw());
      }
    }
    this.redraw();
  }

  /** Cancels the notes of a sounding not yet started or stopped, and stops the ones sounding; the student's own keys keep sounding. */
  private stopSounding(): void {
    for (const timer of this.soundTimers) timer.remove();
    this.soundTimers = [];
    const { piano } = contextOf(this).audio;
    for (const midi of this.sounding) piano.noteOff(midi);
    this.sounding.clear();
  }

  private stopListening(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.repeatTimer?.remove();
    this.repeatTimer = null;
    this.stopSounding();
  }

  private leave(): void {
    this.stopListening();
    contextOf(this).audio.piano.allNotesOff();
    startScene(this, 'profile');
  }
}
