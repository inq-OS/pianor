import stepsJson from '../../content/trainer/steps.json';
import { createRound, NOTE_TRAINER_LIVES, pressKey, type PressVerdict, type TrainerRound } from '../core/trainer/noteTrainer';
import { roundResultLine } from '../core/trainer/roundResult';
import { loadTrainerSteps, rangeOf } from '../core/trainer/steps';
import { noteTrainerLayout } from '../core/trainer/staffFrame';
import { displayText } from '../core/text/language';
import { t } from '../core/text/strings';
import { contextOf } from './context';
import { C } from './ui/pixel/palette';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { heartRow } from './ui/pixel/hearts';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { StaffView } from './ui/staff/StaffView';
import { openOverlay, startScene } from './scenes';
import { circleItem } from './CircleOfFifthsScene';
import { staffSpaceLimits } from '../core/layout/canvasSize';
import { watchKeyBash } from './practice/bashDoor';

/** The one line under the hearts: the round's result once it is over, else "right letter, wrong octave" after that miss, else a new player level. */
const LINE_Y = 26;
/** The staff starts under the hearts and the words, in art pixels, and fills the rest of the main area. */
const STAFF_TOP = 36;
/**
 * After the last life a key press starts a new round, but not at once: the press that lost the last life (or one played with
 * it) must not start the next round before the empty hearts have been seen. Wall time in ms.
 */
const AGAIN_PAUSE_MS = 1000;

const steps = loadTrainerSteps(stepsJson).steps;

/**
 * The note-name trainer (ft_0_17): one note on the staff, and the student presses its key. The name stays hidden until a wrong
 * press, which costs one life and puts the name on the note. The third lost life ends the round; a key, a click on the screen
 * or the toolbar's loop starts a new one. The rules are in `core/trainer`; this scene draws the staff and the hearts and hands
 * each key press to the rule. Almost no text: the hearts are the lives, and
 * the step and the letter naming are cycling buttons on the toolbar.
 * Each right name's XP is saved to the active profile at once (ft_0_17.AC3).
 */
export class NoteTrainerScene extends PixelScene {
  protected override keyboardNavigation = false;

  private stepIndex = 0;
  private round!: TrainerRound;
  private staff: StaffView | null = null;
  /** The last press was wrong: the shown note's name stands on it; null after a right press (AC1). */
  private wrong: { reason: string } | null = null;
  /** When the round ended, on `performance.now()` (ms); null while it runs. */
  private overAtMs: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private roundCount = 0;
  /** The player level the trainer's XP reached in this round, shown under the hearts (ft_0_17.AC12); null when none. */
  private levelUp: number | null = null;
  /** The lives as last drawn, lit of total (read by the end-to-end test). */
  private shownHearts: { lit: number; total: number } | null = null;

  constructor() {
    super('noteTrainer');
  }

  override create(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.events.once('shutdown', () => this.stopListening());
    // key bashing brings Kiur to the door here too (ft_1_15.AC8); the door is the way out
    watchKeyBash(this, contextOf(this).keyboard, () => this.leave());
    // a click or touch on the screen (not on a button) after the round is over starts a new one, for a mouse or a tablet
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.againIfOver();
    });
    this.startRound(this.stepIndex);
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
    const { width } = this.px;
    const { profiles } = contextOf(this);
    this.sky();

    // the lives as hearts in the middle above the staff, a lost one grey (AC3)
    const total = NOTE_TRAINER_LIVES;
    this.shownHearts = { lit: this.round.lives, total };
    for (const heart of heartRow(this, width, this.round.lives, total)) this.root.add(heart);

    // one line under the hearts: the round's result once it is over (AC11), else the words for a wrong octave, else a new level (AC12)
    // AX-3 provisional: which misses get words; chose only the wrong octave (as the ear trainer), because the name on the note already shows a wrong letter or a neighbour key (AX-0.2, AX-2)
    const line = this.round.over ? roundResultLine(this.round.found, this.round.xp)
      : this.wrong?.reason === 'wrong-octave' ? t('theory.wrongOctave')
        : this.levelUp !== null ? t('results.levelUp', { level: this.levelUp }) : null;
    if (line !== null) this.label(0, LINE_Y, line, C.white).centerAt(width / 2);

    this.drawStaff(profiles);
  }

  /** The staff with the current target, laid out for the player's staff settings. The name stands on the note only after a wrong press (ft_0_17.AC1). */
  private drawStaff(profiles: ReturnType<typeof contextOf>['profiles']): void {
    const { scale } = this.px;
    const top = this.mainTop + STAFF_TOP * scale;
    const height = Math.max(1, (this.mainRows - STAFF_TOP - 4) * scale);
    const options = { viewport: { width: this.scale.width, height }, ...staffSpaceLimits(this.scale.zoom), staffGap: profiles.staffGap, noteNaming: profiles.noteNaming };
    // the same staff for every note and for the steps of the same size, so it never moves under the student (ft_0_17.AC7)
    const layout = noteTrainerLayout(this.round.target, steps.map(rangeOf), this.stepIndex, options, profiles.staffSettings);
    this.staff = new StaffView(this, layout, undefined, { noteNames: this.wrong !== null, fingers: false }, { x: 0, y: top }, []);
  }

  /** A new round on step `index`: three lives, no XP and a fresh seed. Choosing the step again starts over too. */
  private startRound(index: number): void {
    this.stepIndex = index;
    this.roundCount += 1;
    this.wrong = null;
    this.levelUp = null;
    this.overAtMs = null;
    this.stopListening();
    this.round = createRound(rangeOf(steps[index]!), `${Date.now()}-${this.roundCount}`);
    this.unsubscribe = contextOf(this).keyboard.onNote((event) => {
      // nothing is judged while the circle of fifths is open over the trainer (ft_1_28)
      if (event.kind !== 'on' || event.velocity === 0 || !this.scene.isActive()) return;
      // a key pressed with the one that lost the last life can still be the right one (AC8), so the rule hears it first
      if (this.press(event.midi, event.timeMs) === 'over') this.againIfOver();
    });
    this.redraw();
  }

  /**
   * The screen's buttons are on the toolbar (d088): the step (stairs and its number, cycling 1 to 4, each press
   * a new round), the letter naming (B or H), and after the last life the loop that starts a new round.
   */
  protected override toolbarItems(): ToolbarItem[] {
    const items: ToolbarItem[] = [
      { label: displayText(t('theory.step', { n: this.stepIndex + 1 })), value: String(this.stepIndex + 1), icon: TOOL_ICONS.steps, tooltip: t('theory.stepTip'), onClick: () => this.startRound((this.stepIndex + 1) % steps.length) },
      { label: displayText(t('theory.naming', { n: contextOf(this).profiles.noteNaming })), tooltip: t('theory.namingTip'), onClick: () => this.toggleNaming() },
      // the circle of fifths, with no key marked (ft_1_28 rule 3)
      circleItem(() => void openOverlay(this, 'circle', { key: null }).then(() => this.redraw())),
    ];
    if (this.round.over) items.push({ label: displayText(t('theory.again')), icon: TOOL_ICONS.repeat, iconOnly: true, tooltip: t('theory.again'), main: true, onClick: () => this.startRound(this.stepIndex) });
    return items;
  }

  /** With the band (ft_1_20): the step and, after the last life, Again are actions; the letter naming and the circle of fifths are items (they stay as set). */
  protected override bandActions(): ToolbarItem[] {
    return this.toolbarItems().filter((_, i) => i !== 1 && i !== 2);
  }

  protected override bandItems(): ToolbarItem[] {
    return this.toolbarItems().slice(1, 3);
  }

  /** A key or a click after the last life starts a new round, once the pause is over (AC3: the student can retry at once). */
  private againIfOver(): void {
    if (this.overAtMs !== null && performance.now() - this.overAtMs >= AGAIN_PAUSE_MS) this.startRound(this.stepIndex);
  }

  /** The letter naming, B or H (ft_0_17.AC4): saved to the active player, and the name on the note after a wrong press follows it. */
  private toggleNaming(): void {
    const { profiles } = contextOf(this);
    void profiles.updateNoteNaming(profiles.noteNaming === 'B' ? 'H' : 'B').then(() => this.redraw());
  }

  /**
   * One key press goes to the rule, with its time so keys pressed together are one press (AC8). A wrong press puts the name
   * on the note (and words for a wrong octave); a right one clears them and the next note comes. Returns the rule's verdict.
   */
  private press(midi: number, atMs: number): PressVerdict {
    const result = pressKey(this.round, midi, atMs);
    if (result.verdict === 'over' || result.verdict === 'joined') return result.verdict;
    if (result.verdict === 'wrong' && result.reason) {
      this.wrong = { reason: result.reason };
    } else if (result.verdict === 'correct') {
      this.wrong = null;
      // the XP of a right name is saved at once, so a new round cannot take it away (ft_0_17.AC3); a name given away earns none (AC9)
      if (result.earned > 0) void contextOf(this).profiles.addTrainerXp(result.earned).then(({ levelUp }) => this.showLevel(levelUp));
    }
    this.round = result.round;
    // a right key pressed with the last life's wrong one takes the end back (AC8)
    this.overAtMs = this.round.over ? (this.overAtMs ?? performance.now()) : null;
    this.redraw();
    return result.verdict;
  }

  /** A new player level reached with the trainer's XP (ft_0_17.AC12): a real milestone, said under the hearts for the rest of the round. */
  private showLevel(level: number | null): void {
    if (level === null || !this.scene.isActive()) return;
    this.levelUp = level;
    this.redraw();
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
