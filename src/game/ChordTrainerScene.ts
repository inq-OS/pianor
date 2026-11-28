import chordsJson from '../../content/trainer/chords.json';
import { CHORD_LIVES, ChordRound, chordLabel, loadChordContent, wrongKeySpelling } from '../core/trainer/chordTrainer';
import { levelReached, roundResultLine } from '../core/trainer/trainerResult';
import { displayText } from '../core/text/language';
import { noteLabel } from '../core/text/noteName';
import { notInMark } from '../core/text/marks';
import { t } from '../core/text/strings';
import { rankBadge } from './ui/pixel/rankArt';
import { contextOf } from './context';
import { C } from './ui/pixel/palette';
import { heartRow } from './ui/pixel/hearts';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { startScene } from './scenes';
import { watchKeyBash } from './practice/bashDoor';

/** The chord's name: big, in the middle of the main area (art pixels: its top, and how many times the font size). */
const NAME_Y = 40;
const NAME_ZOOM = 5;
/** The words under the hearts: the wrong note named, or how many chords were played. */
const WORDS_Y = 26;
/** After the round, its result under the chord's name, and a new level under that (art pixels). */
const RESULT_Y = NAME_Y + 7 * NAME_ZOOM + 8;
const LEVEL_Y = RESULT_Y + 12;
/** After the last life a key starts a new round, but not the key that lost it (ms of wall time). */
const AGAIN_PAUSE_MS = 1000;

const content = loadChordContent(chordsJson);

/**
 * Chord from its name (ft_1_29 slice B): the name stands large, and the student plays the chord, any inversion, any octave,
 * all its notes held together. A key outside the chord costs one of three lives and is named; every right chord's XP is saved
 * at once. The rules are `core/trainer/chordTrainer.ts`, the chords and steps `content/trainer/chords.json`; this scene draws
 * the name and the hearts and hands each key to the round.
 */
export class ChordTrainerScene extends PixelScene {
  protected override keyboardNavigation = false;

  private stepIndex = 0;
  private round!: ChordRound;
  private roundCount = 0;
  /** The last key outside the chord, named under the hearts; null after a right chord. */
  private wrong: number | null = null;
  private overAtMs: number | null = null;
  /** The level this round's XP took the player up to, shown until the next round; null when it stayed. */
  private level: number | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super('chordTrainer');
  }

  override create(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.events.once('shutdown', () => this.stopListening());
    // key bashing brings Kiur to the door here too (ft_1_15.AC8); the door is the way out
    watchKeyBash(this, contextOf(this).keyboard, () => this.leave());
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.againIfOver();
    });
    this.startRound(this.stepIndex);
    super.create();
  }

  protected override back(): void {
    this.leave();
  }

  protected draw(): void {
    const { width } = this.px;
    const naming = contextOf(this).profiles.noteNaming;
    this.sky();
    const state = this.round.state();
    for (const heart of heartRow(this, width, state.lives, CHORD_LIVES)) this.root.add(heart);
    if (this.wrong !== null) {
      // the wrong key spelled on the side of the chord's key: with flats for F or c
      const chord = this.round.target();
      const note = noteLabel(wrongKeySpelling(chord, this.wrong), naming).replace(/(?<=.)b/, '♭');
      // the key played, crossed, in red (d312): the chord's name stays big under it
      this.label(0, WORDS_Y, notInMark(note), C.red).centerAt(width / 2);
    } else if (state.solved > 0) {
      this.markLine(width / 2, WORDS_Y, [TOOL_ICONS.triad, String(state.solved)]);
    }
    const name = this.label(0, NAME_Y, chordLabel(this.round.target(), naming), state.over ? C.lock : C.white, { shadow: false });
    name.setScale(NAME_ZOOM);
    name.x = Math.floor(width / 2 - name.displayWidth / 2);
    if (state.over) this.markLine(width / 2, RESULT_Y, [TOOL_ICONS.triad, roundResultLine({ unit: 'chords', right: state.solved, xp: state.xp })]);
    // a new level: its rank shield and number (d312)
    if (this.level !== null) this.markLine(width / 2, state.over ? LEVEL_Y : RESULT_Y, [{ fine: rankBadge(this.level) }, String(this.level)], C.gold);
  }

  /** A new round on step `index`: three lives, no XP and a fresh seed. */
  private startRound(index: number): void {
    this.stepIndex = index;
    this.roundCount += 1;
    this.wrong = null;
    this.overAtMs = null;
    this.level = null;
    this.stopListening();
    this.round = new ChordRound(content, index, `${Date.now()}-${this.roundCount}`);
    this.unsubscribe = contextOf(this).keyboard.onNote((event) => {
      if (!this.scene.isActive()) return;
      if (this.round.state().over) {
        if (event.kind === 'on' && event.velocity > 0) this.againIfOver();
        return;
      }
      const xpBefore = this.round.state().xp;
      const result = this.round.press(event);
      if (result.verdict === 'wrong') {
        this.wrong = result.midi;
        if (this.round.state().over) this.overAtMs = performance.now();
      } else if (result.verdict === 'correct') {
        this.wrong = null;
        // the XP of a right chord is saved at once, so a lost round cannot take it away
        const { profiles } = contextOf(this);
        const levelBefore = profiles.progress.level.level;
        void profiles.addTrainerXp(this.round.state().xp - xpBefore);
        this.level = levelReached(levelBefore, profiles.progress.level.level) ?? this.level;
      } else {
        return;
      }
      this.redraw();
    });
    this.redraw();
  }

  private againIfOver(): void {
    if (this.overAtMs !== null && performance.now() - this.overAtMs >= AGAIN_PAUSE_MS) this.startRound(this.stepIndex);
  }

  /** The step, named (cycling through the content's steps, each press a new round) and, after the last life, the loop. */
  protected override toolbarItems(): ToolbarItem[] {
    const items: ToolbarItem[] = [
      // the stairs and the step's name, as every trainer's step reads (the note and ear trainers' stairs and number)
      { label: displayText(t(content.steps[this.stepIndex]!.nameKey)), value: displayText(t(content.steps[this.stepIndex]!.nameKey)), icon: TOOL_ICONS.steps, tooltip: t('chords.stepTip'), onClick: () => this.startRound((this.stepIndex + 1) % content.steps.length) },
    ];
    if (this.round.state().over) items.push({ label: displayText(t('theory.again')), icon: TOOL_ICONS.repeat, iconOnly: true, tooltip: t('theory.again'), main: true, onClick: () => this.startRound(this.stepIndex) });
    return items;
  }

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
