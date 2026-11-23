import { keyLabel } from '../core/editor/key';
import { layoutForSettings } from '../core/layout/staffSettings';
import { staffSpaceLimits } from '../core/layout/canvasSize';
import { SHAPE_LIVES, SHAPE_XP_PER_NOTE, ShapeRound, shapeChart, type ShapeChoice } from '../core/trainer/shapeTrainer';
import { displayText } from '../core/text/language';
import { t } from '../core/text/strings';
import { CANCELLED, openOverlay, startScene } from './scenes';
import { contextOf } from './context';
import { C } from './ui/pixel/palette';
import { heartRow } from './ui/pixel/hearts';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { StaffView } from './ui/staff/StaffView';

/** The words under the hearts: a wrong octave, or the round played through. */
const WORDS_Y = 26;
/** The staff starts under the hearts and the words, in art pixels, and fills the rest of the main area. */
const STAFF_TOP = 36;
/** A wrong key flashes the awaited notes this long (ms of wall time). */
const WRONG_FLASH_MS = 400;
/** After a round ends a key starts the next one, but not the key that ended it (ms of wall time). */
const AGAIN_PAUSE_MS = 1000;

/**
 * Play a scale or a chord (ft_1_29 slice A): a key, a shape (the scale up and down, or the triad) and a hand, drawn on the
 * staff and played in Wait mode. Three lives; a wrong key costs one, flashes the awaited note and puts the names on the
 * notes (ft_0_17.AC1); every right note's XP is saved at once, so a lost round keeps it. The rules are `core/trainer/
 * shapeTrainer.ts`; this scene draws the staff and the hearts and hands each key to the round. The key is chosen on the
 * circle of fifths; the shape and the hand are buttons on the toolbar.
 */
export class ShapeTrainerScene extends PixelScene {
  protected override keyboardNavigation = false;

  private choice: ShapeChoice = { fifths: 0, mode: 'major', shape: 'scale', hand: 'RH' };
  private round!: ShapeRound;
  private staff: StaffView | null = null;
  /** The last key was wrong: its reason, and the names stand on the notes; null until then. */
  private wrong: { reason: string } | null = null;
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
    if (state.outcome === 'won') this.label(0, WORDS_Y, t('shapes.won', { n: this.round.chart.notes.length }), C.white).centerAt(width / 2);
    else if (this.wrong?.reason === 'wrong-octave') this.label(0, WORDS_Y, t('theory.wrongOctave'), C.white).centerAt(width / 2);

    const top = this.mainTop + STAFF_TOP * scale;
    const height = Math.max(1, (this.mainRows - STAFF_TOP - 4) * scale);
    const options = { viewport: { width: this.scale.width, height }, ...staffSpaceLimits(this.scale.zoom), staffGap: profiles.staffGap, noteNaming: profiles.noteNaming };
    const layout = layoutForSettings(this.round.chart, options, profiles.staffSettings);
    this.staff = new StaffView(this, layout, undefined, { noteNames: this.wrong !== null, fingers: false }, { x: 0, y: top }, []);
    const play = this.round.play();
    this.staff.applyProgress(play.noteProgress, play.awaiting);
  }

  /** A new round of the current choice: three lives, no XP, the cursor on the first note. */
  private startRound(): void {
    this.wrong = null;
    this.overAtMs = null;
    this.stopListening();
    this.round = new ShapeRound(shapeChart(this.choice));
    this.unsubscribe = contextOf(this).keyboard.onNote((event) => {
      // nothing is judged while the circle of fifths is open over the trainer
      if (!this.scene.isActive()) return;
      if (this.round.state().outcome !== 'playing') {
        if (event.kind === 'on' && event.velocity > 0) this.againIfOver();
        return;
      }
      const result = this.round.press(event);
      if (result.verdict === 'ignored') return;
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
  private choose(change: Partial<ShapeChoice>): void {
    this.choice = { ...this.choice, ...change };
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
    const items: ToolbarItem[] = [
      { label: displayText(keyLabel(choice.fifths, choice.mode, contextOf(this).profiles.noteNaming)), tooltip: t('shapes.keyTip'), onClick: () => this.chooseKey() },
      { label: displayText(t(choice.shape === 'scale' ? 'shapes.scale' : 'shapes.triad')), tooltip: t('shapes.shapeTip'), onClick: () => this.choose({ shape: choice.shape === 'scale' ? 'triad' : 'scale' }) },
      { label: displayText(t(choice.hand === 'RH' ? 'shapes.rh' : 'shapes.lh')), tooltip: t('shapes.handTip'), onClick: () => this.choose({ hand: choice.hand === 'RH' ? 'LH' : 'RH' }) },
    ];
    if (this.round.state().outcome !== 'playing') items.push({ label: displayText(t('theory.again')), icon: TOOL_ICONS.repeat, iconOnly: true, tooltip: t('theory.again'), onClick: () => this.startRound() });
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
