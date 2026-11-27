import type Phaser from 'phaser';
import { playbackLengthMs, playbackNotes, type Chart } from '../../core/chart';
import { advanceTeach, startTeach, type TeachState } from '../../core/exchange/teach';
import type { TugRules } from '../../core/exchange/tug';
import { studentShare, tugFact } from '../../core/exchange/tugPlay';
import type { NoteJudged, PieceResult, PlayState } from '../../core/judge';
import { lineSpot, studentHead } from '../../core/layout/talk';
import { strings, t, type StringKey } from '../../core/text/strings';
import { PracticeController } from '../practice/PracticeController';
import { ChartPlayer } from '../preview/ChartPlayer';
import { PixelImage } from '../ui/pixel/PixelObjects';
import type { StaffView } from '../ui/staff/StaffView';
import { choiceNote, spokenLine, spokenPages, talkColour } from '../ui/pixel/talkArt';
import type { TalkPlace } from './talkView';
import type { TugDevices } from './tugView';

/** How long the fact after a try stays before the next, and the pause after the character's playing. */
const FACT_MS = 2500;
const AFTER_PLAYING_MS = 400;

export interface TeachHandlers {
  /** The character plays (true) or listens (false): its figure shows its state. */
  playing(on: boolean): void;
  /** The view is over: heard or not yet (the scene keeps it), or left with Esc (no outcome, nothing kept). */
  ended(state: TeachState): void;
}

/** A key from content, when the catalog has it. */
const knownKey = (key: string): StringKey | null => (key in strings ? (key as StringKey) : null);

/**
 * A character teaching a phrase over the scene (ft_1_22.AC3, WP-12, on `core/exchange/teach.ts`): the phrase is shown on
 * the staff; the character plays it (its sound, the figure playing), then the student plays it from the staff in Wait mode
 * (the cursor waits for the right key), each try judged by the core and its fact said over the character's head. Before
 * every try the character plays it again; one passed try ends it, heard, and three missed end it, not yet. Esc leaves with
 * nothing kept. The staff is made by the scene (`staff`), which knows the screen and the player's staff settings.
 * AX-3 provisional: the staff over the upper part of the scene, the character's line under it, no try counter (the fact
 * says what happened).
 */
export class TeachView {
  private state: TeachState;
  private readonly player: ChartPlayer;
  private controller: PracticeController | null = null;
  private staff: StaffView | null = null;
  /** The notes of the try as last played: the staff keeps them while the fact is said, and is fresh for the next try. */
  private played: Pick<PlayState, 'noteProgress' | 'awaiting'> | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private saying: string | null = null;
  private closing = false;
  /** The page of a long line shown now: a press on the closing line turns to the next before it ends the view. */
  private page = 0;
  private playingNow: 'character' | 'student' | null = null;
  private done = false;

  private constructor(
    private readonly scene: Phaser.Scene,
    private layer: Phaser.GameObjects.Container,
    private readonly chart: Chart,
    private readonly character: { readonly id: string },
    private readonly rules: TugRules,
    private readonly place: TalkPlace,
    private readonly devices: Pick<TugDevices, 'piano' | 'clock' | 'keyboard'>,
    private readonly makeStaff: (chart: Chart) => StaffView,
    private readonly handlers: TeachHandlers,
    level: 1 | 2 | 3,
  ) {
    this.state = startTeach(chart.id, level);
    this.player = new ChartPlayer(devices.piano, devices.clock);
  }

  /** Starts teaching `chart` (its piece) at `level`: the character plays it at once. */
  static open(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Container,
    input: { chart: Chart; character: { readonly id: string }; level: 1 | 2 | 3; rules: TugRules; place: TalkPlace; devices: Pick<TugDevices, 'piano' | 'clock' | 'keyboard'>; staff: (chart: Chart) => StaffView },
    handlers: TeachHandlers,
  ): TeachView {
    const view = new TeachView(scene, layer, input.chart, input.character, input.rules, input.place, input.devices, input.staff, handlers, input.level);
    view.play();
    return view;
  }

  /** What the teaching shows now, for the tests and the self-playing demo. */
  get view(): { who: 'character' | 'student' | null; piece: string; level: 1 | 2 | 3; tries: readonly boolean[]; outcome: TeachState['outcome']; saying: string | null; page: number; closing: boolean; staff: boolean } {
    const { piece, level, tries, outcome } = this.state;
    return { who: this.playingNow, piece, level, tries, outcome, saying: this.saying, page: this.page, closing: this.closing, staff: this.staff !== null };
  }

  /** The phrase the student plays now; null in the character's turn and between tries. */
  get studentPhrase(): Chart | null {
    return this.playingNow === 'student' ? this.chart : null;
  }

  /** Keys while it is open: Esc leaves; Space or Enter ends the closing line; Tab never reaches the buttons under it. */
  key(e: KeyboardEvent): boolean {
    if (this.done) return false;
    if (e.key === 'Escape') this.leave();
    else if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat && this.closing) this.onwards(); }
    else if (e.key !== 'Tab') return false;
    return true;
  }

  /** A press on the screen: only the closing line takes it (the phrase is never skipped, AX-0). */
  press(): void {
    if (this.closing) this.onwards();
  }

  /** Esc: the teaching ends here, with nothing kept. */
  leave(): void {
    this.finish();
  }

  /** The tests and the demo: the character's playing ends now, as if it had been played. */
  endPhrase(): void {
    if (!this.player.isPlaying) return;
    this.player.stop();
    this.afterCharacter();
  }

  /** Remove what it drew, the staff too. */
  clear(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
    this.staff?.destroy();
    this.staff = null;
  }

  /** Draw again where the screen now is (after the scene was drawn again on a resize). */
  redrawIn(layer: Phaser.GameObjects.Container): void {
    this.layer = layer;
    this.draw();
  }

  /** The scene closes under it: silence it and stop listening, with nothing kept. */
  stop(): void {
    this.done = true;
    this.halt();
    this.clear();
  }

  private halt(): void {
    this.playingNow = null;
    this.timer?.remove();
    this.timer = null;
    this.player.stop();
    this.controller?.dispose();
    this.controller = null;
  }

  /** The character plays the phrase, the staff showing it fresh. */
  private play(): void {
    this.saying = null;
    this.page = 0;
    this.played = null;
    this.playingNow = 'character';
    this.draw();
    this.handlers.playing(true);
    this.player.start(playbackNotes(this.chart), playbackLengthMs(this.chart), () => this.afterCharacter());
  }

  private afterCharacter(): void {
    this.handlers.playing(false);
    this.playingNow = null;
    this.timer = this.scene.time.delayedCall(AFTER_PLAYING_MS, () => {
      this.timer = null;
      if (!this.done) this.listen();
    });
  }

  /** The student's try: Wait mode on the staff, the notes marked as they are played. */
  private listen(): void {
    this.playingNow = 'student';
    const reasons: string[] = [];
    this.controller = new PracticeController(this.chart, this.devices.keyboard, {
      onChange: (state: PlayState) => {
        this.played = state;
        this.staff?.applyProgress(state.noteProgress, state.awaiting);
      },
      onJudged: (event: NoteJudged) => { if (event.verdict === 'wrong') reasons.push(event.reason); },
      onCompleted: (result: PieceResult) => this.afterStudent(result, reasons),
    });
    this.draw();
  }

  private afterStudent(result: PieceResult, reasons: readonly string[]): void {
    this.controller?.dispose();
    this.controller = null;
    this.playingNow = null;
    this.state = advanceTeach(this.state, studentShare(result, 'wait'), this.rules);
    const fact = tugFact(result, reasons, 'wait');
    const words = t('tug.fact', { right: fact.right, total: fact.total });
    this.saying = fact.reason === 'wrong-octave' ? `${words}. ${t('tug.wrongOctave')}` : words;
    this.page = 0;
    this.draw();
    this.timer = this.scene.time.delayedCall(FACT_MS, () => {
      this.timer = null;
      if (this.done) return;
      if (this.state.outcome === undefined) return this.play();
      this.close(fact);
    });
  }

  /** The character's line on the result (its content's `talk.<id>.teachHeard` or `teachNotYet`); a press ends it. */
  private close(fact: { right: number; total: number }): void {
    const key = knownKey(`talk.${this.character.id}.${this.state.outcome === 'heard' ? 'teachHeard' : 'teachNotYet'}`);
    if (key === null) return this.finish();
    this.closing = true;
    this.saying = t(key, { right: fact.right, total: fact.total });
    this.page = 0;
    this.handlers.playing(true);
    this.draw();
  }

  /** A press on the closing line: its next page, or the end of the view after its last. */
  private onwards(): void {
    if (this.saying !== null && this.page + 1 < spokenPages(this.saying).length) {
      this.page += 1;
      this.draw();
      return;
    }
    this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.closing = false;
    this.halt();
    this.clear();
    this.handlers.playing(false);
    this.handlers.ended(this.state);
  }

  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.layer.add(object);
    this.objects.push(object);
    return object;
  }

  private draw(): void {
    this.clear();
    if (this.done) return;
    const { area } = this.place;
    // a press anywhere is the teaching's: the scene and the band under it take none while it is open
    const catcher = this.add(this.scene.add.zone(0, -area.h, area.w, area.h * 3).setOrigin(0).setInteractive());
    catcher.on('pointerup', () => this.press());
    // the staff while the phrase is played and tried, not under the closing line
    if (!this.closing) {
      this.staff = this.makeStaff(this.chart);
      if (this.played) this.staff.applyProgress(this.played.noteProgress, this.playingNow === 'student' ? this.played.awaiting : []);
    }
    if (this.playingNow === 'student') {
      const note = choiceNote(true);
      const head = studentHead(area);
      this.add(new PixelImage(this.scene, Math.round(head.x - note.width / 2), head.y - note.height - 4, note).setName('teachYourTurn'));
    }
    if (this.saying !== null) {
      const words = spokenLine(spokenPages(this.saying)[this.page] ?? [], talkColour('character', this.character.id));
      const spot = lineSpot({ head: this.place.head, size: { w: words.width, h: words.height }, area });
      this.add(new PixelImage(this.scene, spot.x, spot.y, words).setName('teachLine'));
    }
  }
}
