import { keyLabel, keyNames } from '../core/editor/key';
import { withFlat } from '../core/layout/circleOfFifths';
import type { WrongReason } from '../core/judge/types';
import { layoutForSettings } from '../core/layout/staffSettings';
import { staffSpaceLimits } from '../core/layout/canvasSize';
import { SHAPE_LIVES, SHAPE_XP_PER_NOTE, ShapeRound, shapeChart, type ShapeChoice } from '../core/trainer/shapeTrainer';
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

/** The words under the hearts: the switcher's key, a wrong octave, or the round played through. */
const WORDS_Y = 26;
/** The staff starts under the hearts and the words, in art pixels, and fills the rest of the main area. */
const STAFF_TOP = 36;
/** A wrong key flashes the awaited notes this long (ms of wall time). */
const WRONG_FLASH_MS = 400;
/** After a round ends a key starts the next one, but not the key that ended it (ms of wall time). */
const AGAIN_PAUSE_MS = 1000;
/** The live chord name of the keys held (slice D): at the left, level with the words. */
const HELD_X = 8;
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
  private wrong: { reason: WrongReason } | null = null;
  private overAtMs: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private flashTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('shapeTrainer');
  }

  override create(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.events.once('shutdown', () => this.stopListening());
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
    // AX-3 provisional: as the note trainer, only the wrong octave gets words; the names on the notes show the rest
    const play = this.round.play();
    if (state.outcome === 'won') this.label(0, WORDS_Y, t('shapes.won', { n: this.round.chart.notes.length }), C.white).centerAt(width / 2);
    else if (this.switcher) {
      // the key of the bar the cursor is in: the name changes as the bar does (AC3)
      const bar = this.round.chart.notes[play.awaiting[0] ?? 0]!.bar;
      const key = withFlat(keyNames(this.barKeys[bar]!, profiles.noteNaming).major);
      this.label(0, WORDS_Y, t('circle.major', { key }), C.white).centerAt(width / 2);
    } else if (this.wrong?.reason === 'wrong-octave') this.label(0, WORDS_Y, t('theory.wrongOctave'), C.white).centerAt(width / 2);

    const top = this.mainTop + STAFF_TOP * scale;
    const height = Math.max(1, (this.mainRows - STAFF_TOP - 4) * scale);
    const options = { viewport: { width: this.scale.width, height }, ...staffSpaceLimits(this.scale.zoom), staffGap: profiles.staffGap, noteNaming: profiles.noteNaming };
    const layout = layoutForSettings(this.round.chart, options, profiles.staffSettings);
    this.staff = new StaffView(this, layout, undefined, { noteNames: this.wrong !== null, fingers: false }, { x: 0, y: top }, []);
    this.staff.applyProgress(play.noteProgress, play.awaiting);
    if (this.held) this.label(HELD_X, WORDS_Y, chordLabel(this.held, profiles.noteNaming), C.white);
  }

  /** A new round of the current choice: three lives, no XP, the cursor on the first note. */
  private startRound(): void {
    this.wrong = null;
    this.overAtMs = null;
    this.stopListening();
    this.roundCount += 1;
    this.held = null;
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
      const held = nameChord(CHORDS, this.round.play().heldKeys);
      const heldChanged = held?.name !== this.held?.name;
      this.held = held;
      if (result.verdict === 'ignored') {
        if (heldChanged) this.redraw();
        return;
      }
      if (result.verdict === 'wrong') this.wrong = { reason: result.reason };
      // the XP of a right note is saved at once, so a lost round cannot take it away
      else if (result.verdict === 'correct') void contextOf(this).profiles.addTrainerXp(SHAPE_XP_PER_NOTE);
      if (this.round.state().outcome !== 'playing') this.overAtMs = performance.now();
      this.redraw();
      if (result.verdict === 'wrong') this.flash();
    });
    this.redraw();
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
      ...(this.switcher ? [] : [{ label: displayText(keyLabel(choice.fifths, choice.mode, contextOf(this).profiles.noteNaming)), tooltip: t('shapes.keyTip'), onClick: () => this.chooseKey() }]),
      { label: displayText(t(shapeLabel)), tooltip: t('shapes.shapeTip'), onClick: nextShape },
      { label: displayText(t(choice.hand === 'RH' ? 'shapes.rh' : 'shapes.lh')), tooltip: t('shapes.handTip'), onClick: () => this.choose({ hand: choice.hand === 'RH' ? 'LH' : 'RH' }) },
    ];
    if (this.round.state().outcome !== 'playing') items.push({ label: displayText(t('theory.again')), icon: TOOL_ICONS.repeat, iconOnly: true, tooltip: t('theory.again'), main: true, onClick: () => this.startRound() });
    return items;
  }

  /** With the band (ft_1_20): every choice and Again are actions, each starts a round. */

  private stopListening(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private leave(): void {
    this.stopListening();
    startScene(this, 'profile');
  }
}
