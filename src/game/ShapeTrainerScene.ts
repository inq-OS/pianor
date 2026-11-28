import { keyName } from '../core/editor/key';
import type { WrongReason } from '../core/judge/types';
import { layoutForSettings } from '../core/layout/staffSettings';
import { staffSpaceLimits } from '../core/layout/canvasSize';
import { SHAPE_LIVES, SHAPE_XP_PER_NOTE, ShapeRound, shapeChart, type ShapeChoice } from '../core/trainer/shapeTrainer';
import { playedMark } from '../core/layout/playedMark';
import { noteLabel } from '../core/text/noteName';
import { rankBadge } from './ui/pixel/rankArt';
import { levelReached, roundResultLine } from '../core/trainer/trainerResult';
import { switcherChart } from '../core/trainer/scaleSwitcher';
import chordsJson from '../../content/trainer/chords.json';
import { nameChord } from '../core/trainer/chordNamer';
import { chordLabel, loadChordContent, type Chord } from '../core/trainer/chordTrainer';
import { displayText } from '../core/text/language';
import { t } from '../core/text/strings';
import { CANCELLED, openOverlay, startScene } from './scenes';
import { contextOf } from './context';
import { C } from './ui/pixel/palette';
import { heartRow } from './ui/pixel/hearts';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { StaffView } from './ui/staff/StaffView';
import { watchKeyBash } from './practice/bashDoor';
import { markTipFor } from './markTip';

/** The line under the hearts: the switcher's key, or the round's result (a wrong key is shown on the staff, d312). */
const WORDS_Y = 26;
/** The staff starts under the hearts and the words, in art pixels, and fills the rest of the main area. */
const STAFF_TOP = 36;
/** A wrong key flashes the awaited notes this long (ms of wall time). */
const WRONG_FLASH_MS = 400;
/** After a round ends a key starts the next one, but not the key that ended it (ms of wall time). */
const AGAIN_PAUSE_MS = 1000;
/** The live chord name of the keys held (slice D): at the left, level with the words; a new level at the right. */
const HELD_X = 8;
const LEVEL_RIGHT = 8;
/** About half the width of the level's shield and number, to centre them. */
const LEVEL_HALF = 10;
const CHORDS = loadChordContent(chordsJson);

/**
 * Play a scale or a chord (ft_1_29 slice A): a key, a shape (the scale up and down, or the triad) and a hand, drawn on the
 * staff and played in Wait mode. Three lives; a wrong key costs one, flashes the awaited note and puts the names on the
 * notes (ft_0_17.AC1); every right note's XP is saved at once, so a lost round keeps it. The rules are `core/trainer/
 * shapeTrainer.ts`; this scene draws the staff and the hearts and hands each key to the round. The key is chosen on the
 * circle of fifths; the shape and the hand are buttons on the toolbar. The shape button's third choice is the scale switcher
 * (slice C, `core/trainer/scaleSwitcher.ts`): a scale a bar, the key changing every bar, its name above the staff. The
 * chord the keys held make is named live at the left (slice D, `core/trainer/chordNamer.ts`).
 */
export class ShapeTrainerScene extends PixelScene {
  protected override keyboardNavigation = false;

  private choice: ShapeChoice = { fifths: 0, mode: 'major', shape: 'scale', hand: 'RH' };
  /** The scale switcher instead of the chosen shape (slice C). */
  private switcher = false;
  /** The switcher's key of every bar, as fifths; empty for a shape. */
  private barKeys: number[] = [];
  private roundCount = 0;
  /** The chord the keys held make, named live at the left (ft_1_29 slice D); null when they make none. */
  private held: Chord | null = null;
  private round!: ShapeRound;
  private staff: StaffView | null = null;
  /** The last key was wrong: its reason, and the names stand on the notes; null until then. */
  private wrong: { reason: WrongReason; direction: 'higher' | 'lower' } | null = null;
  /** The wrong key on the staff beside the awaited note (d312), until the next right key. */
  private playedWrong: { midi: number; reason: WrongReason } | null = null;
  /** The one-time tip naming the mark just shown, until the next press (d312); null with none. */
  markTip: string | null = null;
  /** The level this round's XP took the player up to, shown until the next round; null when it stayed. */
  private level: number | null = null;
  private overAtMs: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private flashTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('shapeTrainer');
  }

  override create(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.events.once('shutdown', () => this.stopListening());
    // key bashing brings Kiur to the door here too (ft_1_15.AC8); the door is the way out
    watchKeyBash(this, contextOf(this).keyboard, () => this.leave());
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.againIfOver();
    });
    this.startRound();
    super.create();
  }

  protected override back(): void {
    this.leave();
  }

  protected override clear(): void {
    this.staff?.destroy();
    this.staff = null;
  }

  protected draw(): void {
    const { width, scale } = this.px;
    const { profiles } = contextOf(this);
    this.sky();
    const state = this.round.state();
    for (const heart of heartRow(this, width, state.lives, SHAPE_LIVES)) this.root.add(heart);
    const play = this.round.play();
    // after the round, its result in one line: the notes played right of the round's, and the XP (won or lost)
    if (state.outcome !== 'playing') this.label(0, WORDS_Y, roundResultLine({ unit: 'notes', right: state.right, total: this.round.chart.notes.length, xp: state.xp }), C.white).centerAt(width / 2);
    else if (this.switcher) {
      // the key of the bar the cursor is in: the name changes as the bar does (AC3)
      this.label(0, WORDS_Y, keyName(this.keyOnScreen(), 'major', profiles.noteNaming), C.white).centerAt(width / 2);
    }
    if (state.outcome === 'playing' && this.markTip !== null) this.markTipAt(width / 2, WORDS_Y + 10, this.markTip);
    // a new level: its rank shield and number at the right (d312)
    if (this.level !== null) this.markLine(width - LEVEL_RIGHT - LEVEL_HALF, WORDS_Y, [{ fine: rankBadge(this.level) }, String(this.level)], C.gold);

    const top = this.mainTop + STAFF_TOP * scale;
    const height = Math.max(1, (this.mainRows - STAFF_TOP - 4) * scale);
    const options = { viewport: { width: this.scale.width, height }, ...staffSpaceLimits(this.scale.zoom), staffGap: profiles.staffGap, noteNaming: profiles.noteNaming };
    const layout = layoutForSettings(this.round.chart, options, profiles.staffSettings);
    this.staff = new StaffView(this, layout, undefined, { noteNames: this.wrong !== null, fingers: false }, { x: 0, y: top }, []);
    this.staff.applyProgress(play.noteProgress, play.awaiting);
    // the wrong key as practice shows it: its ghost beside the awaited note with its name and sharp or flat, an 8 for an octave off
    if (this.playedWrong) {
      const mark = playedMark(layout, this.round.chart, play.awaiting, this.playedWrong.midi);
      this.staff.setPlayed(mark, mark ? noteLabel(mark.spelling, profiles.noteNaming) : '', this.playedWrong.reason === 'wrong-octave');
    }
    if (this.held) this.label(HELD_X, WORDS_Y, chordLabel(this.held, profiles.noteNaming), C.white);
  }

  /** A new round of the current choice: three lives, no XP, the cursor on the first note. */
  private startRound(): void {
    this.wrong = null;
    this.playedWrong = null;
    this.overAtMs = null;
    this.stopListening();
    this.roundCount += 1;
    this.held = null;
    this.level = null;
    if (this.switcher) {
      const { chart, keys } = switcherChart(`${Date.now()}-${this.roundCount}`, this.choice.hand);
      this.round = new ShapeRound(chart);
      this.barKeys = keys;
    } else {
      this.round = new ShapeRound(shapeChart(this.choice));
      this.barKeys = [];
    }
    this.unsubscribe = contextOf(this).keyboard.onNote((event) => {
      // nothing is judged while the circle of fifths is open over the trainer
      if (!this.scene.isActive()) return;
      if (this.round.state().outcome !== 'playing') {
        // the round no longer follows the keys: the held chord's name goes with the first key after it
        if (this.held) {
          this.held = null;
          this.redraw();
        }
        if (event.kind === 'on' && event.velocity > 0) this.againIfOver();
        return;
      }
      const result = this.round.press(event);
      const held = nameChord(CHORDS, this.round.play().heldKeys, { fifths: this.keyOnScreen() });
      const heldChanged = held?.name !== this.held?.name;
      this.held = held;
      if (result.verdict === 'ignored') {
        if (heldChanged) this.redraw();
        return;
      }
      // the 8 of a wrong octave is named in words the first time this player sees it (d312)
      this.markTip = result.verdict === 'wrong' && result.reason === 'wrong-octave' ? markTipFor(this, 'octave') : null;
      if (result.verdict === 'wrong') {
        this.wrong = { reason: result.reason, direction: result.direction };
        this.playedWrong = { midi: result.midi, reason: result.reason };
      } else if (result.verdict === 'correct') {
        this.playedWrong = null;
        // the XP of a right note is saved at once, so a lost round cannot take it away
        this.addXp(SHAPE_XP_PER_NOTE);
      }
      if (this.round.state().outcome !== 'playing') this.overAtMs = performance.now();
      this.redraw();
      if (result.verdict === 'wrong') this.flash();
    });
    this.redraw();
  }

  /** The key on screen, as fifths: the switcher's bar the cursor is in, else the chosen key. The held chord is spelled in it. */
  private keyOnScreen(): number {
    if (!this.switcher) return this.choice.fifths;
    const bar = this.round.chart.notes[this.round.play().awaiting[0] ?? 0]?.bar ?? 0;
    return this.barKeys[bar] ?? this.choice.fifths;
  }

  /** Save `xp` to the player's trainer XP; a level it reaches is shown until the next round. */
  private addXp(xp: number): void {
    const { profiles } = contextOf(this);
    const before = profiles.progress.level.level;
    void profiles.addTrainerXp(xp);
    this.level = levelReached(before, profiles.progress.level.level) ?? this.level;
  }

  /** The awaited notes flash red for a moment after a wrong key. */
  private flash(): void {
    this.flashTimer?.remove();
    this.staff?.flashWrong(this.round.play().awaiting);
    this.flashTimer = this.time.delayedCall(WRONG_FLASH_MS, () => this.staff?.flashWrong(null));
  }

  /** A key or a click after the round starts a new one, once the pause is over. */
  private againIfOver(): void {
    if (this.overAtMs !== null && performance.now() - this.overAtMs >= AGAIN_PAUSE_MS) this.startRound();
  }

  /** Change the choice and start over with it. */
  private choose(change: Partial<ShapeChoice>, switcher = this.switcher): void {
    this.choice = { ...this.choice, ...change };
    this.switcher = switcher;
    this.startRound();
  }

  /** The circle of fifths, opened to choose: the key taken there is the next round's. */
  private chooseKey(): void {
    void openOverlay(this, 'circle', { key: { fifths: this.choice.fifths, mode: this.choice.mode }, choose: true }).then((key) => {
      if (key !== 'closed' && key !== CANCELLED) this.choose({ fifths: key.fifths, mode: key.mode });
      else this.redraw();
    });
  }

  /** The key (on the circle of fifths), the shape and the hand, each a new round; after a round, the loop starts another. */
  protected override toolbarItems(): ToolbarItem[] {
    const { choice } = this;
    // the shape button goes scale, triad, switcher and round again; the switcher picks its own keys, so it has no key button
    const shapeLabel = this.switcher ? 'shapes.switcher' : choice.shape === 'scale' ? 'shapes.scale' : 'shapes.triad';
    const nextShape = () => (this.switcher ? this.choose({ shape: 'scale' }, false) : choice.shape === 'scale' ? this.choose({ shape: 'triad' }) : this.choose({}, true));
    const items: ToolbarItem[] = [
      ...(this.switcher ? [] : [{ label: displayText(keyName(choice.fifths, choice.mode, contextOf(this).profiles.noteNaming)), tooltip: t('shapes.keyTip'), onClick: () => this.chooseKey() }]),
      { label: displayText(t(shapeLabel)), tooltip: t('shapes.shapeTip'), onClick: nextShape },
      // the hand's picture before its word, so the button reads as a hand
      { label: displayText(t(choice.hand === 'RH' ? 'shapes.rh' : 'shapes.lh')), value: displayText(t(choice.hand === 'RH' ? 'shapes.rh' : 'shapes.lh')), icon: choice.hand === 'RH' ? TOOL_ICONS.handRight : TOOL_ICONS.handLeft, tooltip: t('shapes.handTip'), onClick: () => this.choose({ hand: choice.hand === 'RH' ? 'LH' : 'RH' }) },
    ];
    if (this.round.state().outcome !== 'playing') items.push({ label: displayText(t('theory.again')), icon: TOOL_ICONS.repeat, iconOnly: true, tooltip: t('theory.again'), main: true, onClick: () => this.startRound() });
    return items;
  }

  /** With the band (ft_1_20): every choice and Again are actions, each starts a round. */
  protected override bandActions(): ToolbarItem[] {
    return this.toolbarItems();
  }

  private stopListening(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private leave(): void {
    this.stopListening();
    startScene(this, 'profile');
  }
}
