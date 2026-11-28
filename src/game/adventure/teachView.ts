import type Phaser from 'phaser';
import { playbackLengthMs, playbackNotes, type Chart } from '../../core/chart';
import { advanceTeach, startTeach, type TeachState } from '../../core/exchange/teach';
import type { TugRules } from '../../core/exchange/tug';
import { studentShare, tugFact, tugFactLine } from '../../core/exchange/tugPlay';
import type { NoteJudged, PieceResult, PlayState } from '../../core/judge';
import { lineSpot, studentHead } from '../../core/layout/talk';
import type { Rect } from '../../core/layout/rect';
import { strings, t, type StringKey } from '../../core/text/strings';
import { PracticeController } from '../practice/PracticeController';
import { ChartPlayer } from '../preview/ChartPlayer';
import { PixelImage } from '../ui/pixel/PixelObjects';
import type { StaffView } from '../ui/staff/StaffView';
import { markChipBitmap } from '../ui/pixel/markChip';
import { choiceNote, spokenLine, spokenPages, talkColour } from '../ui/pixel/talkArt';
import type { TalkPlace } from './talkView';
import type { TugDevices } from './tugView';
import { NUDGE_MS, overlayCatcher } from './overlayExit';
import { motionAllowed } from '../motion';

/** How long the fact after a try stays before the next, and the pause after the character's playing. */
const FACT_MS = 2500;
const AFTER_PLAYING_MS = 400;
/** How high and how fast the note over the student's head hops after a wait with no key (art pixels, ms). */
const HOP = 4;
const HOP_MS = 300;

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
  private played: Pick<PlayState, 'noteProgress' | 'awaiting' | 'retried'> | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private saying: string | null = null;
  /** The saying is a try's count (marks on a chip), not the character's closing line. */
  private sayingFact = false;
  private closing = false;
  /** The page of a long line shown now: a press on the closing line turns to the next before it ends the view. */
  private page = 0;
  private playingNow: 'character' | 'student' | null = null;
  private done = false;
  /** The student's try waits with no note played: the character says once whose turn it is. */
  private nudge: Phaser.Time.TimerEvent | null = null;
  private nudged = false;
  /** The student's try waited a while with no key: the note over their head hops higher until a key (d312: no line). */
  private hopping = false;
  private hop: Phaser.Tweens.Tween | null = null;

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
    /** The screen's corner Back, left pressable over the teaching: it leaves as Esc does. */
    private readonly door: Rect | undefined,
  ) {
    this.state = startTeach(chart.id, level);
    this.player = new ChartPlayer(devices.piano, devices.clock);
  }

  /** Starts teaching `chart` (its piece) at `level`: the character plays it at once. */
  static open(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Container,
    input: { chart: Chart; character: { readonly id: string }; level: 1 | 2 | 3; rules: TugRules; place: TalkPlace; devices: Pick<TugDevices, 'piano' | 'clock' | 'keyboard'>; staff: (chart: Chart) => StaffView; door?: Rect },
    handlers: TeachHandlers,
  ): TeachView {
    const view = new TeachView(scene, layer, input.chart, input.character, input.rules, input.place, input.devices, input.staff, handlers, input.level, input.door);
    view.play();
    return view;
  }

  /** What the teaching shows now, for the tests and the self-playing demo. */
  get view(): { who: 'character' | 'student' | null; piece: string; level: 1 | 2 | 3; tries: readonly boolean[]; outcome: TeachState['outcome']; saying: string | null; page: number; closing: boolean; staff: boolean; notFirst: number[]; nudging: boolean } {
    const { piece, level, tries, outcome } = this.state;
    return { who: this.playingNow, piece, level, tries, outcome, saying: this.saying, page: this.page, closing: this.closing, staff: this.staff !== null, notFirst: (this.played?.retried ?? []).flatMap((retried, i) => (retried ? [i] : [])), nudging: this.hopping };
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
    this.hop?.remove();
    this.hop = null;
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
    this.stopNudge();
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
        this.showPlayed(state.awaiting);
      },
      onJudged: (event: NoteJudged) => {
        this.notePlayed();
        if (event.verdict === 'wrong') reasons.push(event.reason);
      },
      onCompleted: (result: PieceResult) => this.afterStudent(result, reasons),
    });
    this.draw();
    if (this.nudged) return;
    this.nudge = this.scene.time.delayedCall(NUDGE_MS, () => {
      this.nudge = null;
      if (this.done || this.playingNow !== 'student') return;
      this.nudged = true;
      // no line (d312): the note over the student's head hops higher until a key
      this.hopping = true;
      this.draw();
    });
  }

  /** The try's notes on the staff: right the first time in the right colour, found only after a wrong key apart (`retried`). */
  private showPlayed(awaiting: PlayState['awaiting']): void {
    if (!this.staff || !this.played) return;
    this.staff.applyProgress(this.played.noteProgress, awaiting, this.played.retried);
  }

  /** A note was played: the nudge is not needed, and the note stops hopping. */
  private notePlayed(): void {
    this.stopNudge();
    if (this.hopping) {
      this.hopping = false;
      this.draw();
    }
  }

  private stopNudge(): void {
    this.nudge?.remove();
    this.nudge = null;
  }

  private afterStudent(result: PieceResult, reasons: readonly string[]): void {
    this.controller?.dispose();
    this.controller = null;
    this.stopNudge();
    this.playingNow = null;
    this.state = advanceTeach(this.state, studentShare(result, 'wait'), this.rules);
    const fact = tugFact(result, reasons, 'wait');
    // the count only: the staff shows where the wrong keys were (d312)
    this.saying = tugFactLine(fact, 'wait');
    this.sayingFact = true;
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
    this.sayingFact = false;
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
    // a press anywhere is the teaching's, the corner Back's aside: the scene and the band under it take none while it is open
    overlayCatcher(this.scene, (o) => this.add(o), area, this.door, () => this.press());
    // the staff while the phrase is played and tried, not under the closing line
    if (!this.closing) {
      this.staff = this.makeStaff(this.chart);
      this.showPlayed(this.playingNow === 'student' && this.played ? this.played.awaiting : []);
    }
    if (this.playingNow === 'student') {
      const note = choiceNote(true);
      const head = studentHead(area);
      const image = this.add(new PixelImage(this.scene, Math.round(head.x - note.width / 2), head.y - note.height - 4, note).setName('teachYourTurn'));
      if (this.hopping && motionAllowed()) this.hop = this.scene.tweens.add({ targets: image, y: image.y - HOP, duration: HOP_MS, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
    }
    if (this.saying !== null && this.sayingFact) {
      // the count is marks, on a chip just over the staff (which takes the lower half), above the student (d312)
      const chip = markChipBitmap(this.saying);
      const head = studentHead(area);
      this.add(new PixelImage(this.scene, Math.max(2, Math.round(head.x - chip.width / 2)), Math.floor(area.h / 2) - chip.height - 3, chip).setName('teachFact'));
    } else if (this.saying !== null) {
      const pages = spokenPages(this.saying);
      // a page with more after it ends in a small arrow: a press turns to the next
      const words = spokenLine(pages[this.page] ?? [], talkColour('character', this.character.id), this.page + 1 < pages.length);
      const spot = lineSpot({ head: this.place.head, size: { w: words.width, h: words.height }, area });
      this.add(new PixelImage(this.scene, spot.x, spot.y, words).setName('teachLine'));
    }
  }
}
