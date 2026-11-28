import levelsJson from '../../../content/curriculum/levels.json';
import { levelsFileSchema } from '../../core/chart';
import { handShiftMap } from '../../core/fingering/shifts';
import type Phaser from 'phaser';
import { firstPrintedBar, fullBarTicks, unrollRepeats, writtenTick, writtenView, type Chart, type PlayChart } from '../../core/chart';
import { DEFAULT_FOLLOW_RULES, TempoMode, WaitMode, replayKeys, type WrongReason, type Hints, type NoteEvent, type TempoStart, type JudgeEvent, type NoteJudged, type PieceResult, type PlaySettings, type PlayState } from '../../core/judge';
import { barNumbersToShow, type BarNumberSettings } from '../../core/layout/barNumbers';
import type { PaceMark } from '../../core/layout/beat';
import { clickWaveTick, laneDots, waveTick, type LaneLook } from '../../core/layout/beatLane';
import { PRIZE, prizeColumn, type PrizeColumn, type PrizeGlyph } from '../../core/layout/learnPrizes';
import { CLEF_FLIGHT, grownBox } from '../../core/layout/clefFlight';
import type { LearnRewards } from '../../core/learn/progress';
import type { PrizeFocus } from '../../core/learn/view';
import { passScorePlace } from '../../core/layout/passScore';
import { GRADE_STARS } from '../../core/scoring/stars';
import { durationMarks, type DurationHelp } from '../../core/layout/durationHelp';
import { playheadAt } from '../../core/layout/playhead';
import type { StaffLayout, StaffLayoutOptions } from '../../core/layout/staff';
import { layoutForSettings, layoutSection, type StaffSettings } from '../../core/layout/staffSettings';
import { playedMark } from '../../core/layout/playedMark';
import { STAFF_INK } from '../../core/layout/scoreColour';
import { noteLabel, type NoteNaming } from '../../core/text/noteName';
import { Transport } from '../../core/transport';
import type { KeyboardInput } from '../../io/keyboard';
import type { Mascot } from '../ui/pixel/PixelObjects';
import { SpeechBubble, type BubbleSpot } from '../ui/pixel/SpeechBubble';
import { StaffView, type PartMarks } from '../ui/staff/StaffView';
import { STAFF_FONT } from '../ui/staff/staffFont';
import type { Bitmap } from '../ui/pixel/bitmap';
import type { PassNumbers } from '../../core/text/rundown';
import { PracticeController } from './PracticeController';
import { drawMedalClef, drawPrizes } from './prizeGlyphs';
import { motionAllowed } from '../motion';
import { staffSpaceLimits } from '../../core/layout/canvasSize';
import chordsJson from '../../../content/trainer/chords.json';
import { loadChordContent } from '../../core/trainer/chordTrainer';
import { nameChord, staffChordName } from '../../core/trainer/chordNamer';
import { markTipFor } from '../markTip';


/** The levels' hand positions, which the hand-shift arrows prefer (ft_1_30.AC10). */
const LEVELS = levelsFileSchema.parse(levelsJson).levels;
/** A wrong key and the notes it was played for (indices of the written notes). */
export interface WrongKey {
  midi: number;
  awaiting: readonly number[];
  /** Why it was wrong: an octave off shows an 8 beside the played key (d312). */
  reason?: WrongReason;
}

/** How long a wrong note flashes, how long its feedback stays in the bubble, and how long Kiur looks puzzled. */
const WRONG_FLASH_MS = 700;
export const MESSAGE_MS = 3500;
export const HMM_MS = 2500;
/** The pass's stars, in staff spaces across (as big as a notehead's two spaces); its numbers' ink, the ghost head's red. */
const PASS_STAR = 1.6;
const PASS_INK = '#14142a';
const WRONG_HEAD = 0xd7263d;
const WRONG_HEAD_ALPHA = 0.55;

/** What the scene hears from the session; the session itself decides nothing. */
export interface PlaySessionCallbacks {
  /** After the staff has been brought up to date with `state`. */
  onChange?(state: PlayState): void;
  onJudged(event: NoteJudged, state: PlayState): void;
  onCompleted(result: PieceResult): void;
  /** Every judge event of a key press, before the callbacks above (a listener may need the finished bars too). */
  onEvents?(events: readonly JudgeEvent[], state: PlayState): void;
}

/** The player's staff settings the staff is laid out with (`ProfileService` has them). */
export interface StaffPrefs {
  readonly staffSettings: StaffSettings;
  readonly staffGap: NonNullable<StaffLayoutOptions['staffGap']>;
  readonly noteNaming: NonNullable<StaffLayoutOptions['noteNaming']>;
  readonly barNumberSettings: BarNumberSettings;
  /** Which hands get the note duration helper (ft_1_11). */
  readonly durationHelp: DurationHelp;
  /** What the hint label under a chord says: its notes, its name or both (core_09.AC59); absent reads as the notes. */
  readonly chordLabels?: 'notes' | 'name' | 'both';
}

export interface PlaySessionOptions {
  /** The chart that is played: the piece, or a section of it (`sliceChart`). */
  chart: Chart;
  /** While a section is played: the whole piece (it sets the size of the staff) and the section's first bar (its bar numbers). */
  section?: { whole: Chart; first: number };
  /** Tracks drawn grey on their own staves and not played: the resting hand of a hand step in learning (ft_1_32.AC18). */
  restingTracks?: readonly string[];
  /**
   * What the staff draws instead of `chart` (learning, ft_1_32.AC20): the whole piece, the bars of `faint` (inclusive ranges)
   * very faint; its first notes are `chart`'s, in the same order, so the judge's note indexes are its own; `offset` is the
   * tick of `chart`'s start in it (0 when absent).
   */
  shown?: { chart: Chart; faint: readonly { from: number; to: number }[]; offset?: number };
  /** A song's part names and folds over the staff (ft_1_36 rule 7), by the bars of `chart`. */
  partMarks?: PartMarks;
  /** Staff spaces left free right of the staff (the column of the prizes of learning, ft_1_32.AC19). */
  roomRight?: number;
  /** A wrong key on the staff from the start, as the run before ended on it (ft_1_32.AC6); gone at the first right key. */
  wrongKey?: WrongKey;
  keyboard: KeyboardInput;
  callbacks: PlaySessionCallbacks;
  hints?: Hints;
  /** Every head of a chord shows its finger, not only the top one (the player's setting). */
  chordFingers?: boolean;
  /**
   * Tempo mode at this percent of the piece's tempo, with the player's score view; Wait mode when left out. `gradeHold`:
   * grade how long each note is held (d093); on unless false (the admin switch, core_01.AC9). `start`: any key starts a
   * count-in (default), or the first note itself starts the piece with no count-in (core_01.AC10). `follow`: the clock
   * follows the player instead of running on (core_01.AC12).
   */
  tempo?: { percent: number; scoreView: PlaySettings['scoreView']; startAtMs?: number; loop?: boolean; gradeHold?: boolean; start?: TempoStart; follow?: boolean };
  /** Wait mode only: a wrong key moves on instead of waiting (level 1 of the tug of ft_1_21.AC6, `WaitMode` `moveOnWrong`; no caller until it is built). */
  moveOnWrong?: boolean;
  /**
   * Wait mode only: the keys of a pass left for the settings (`passKeys`), handed to the fresh judge so the pass goes on at
   * the note it stood on; `nowMs` is the clock now. Keys that would finish the piece are not picked up (`resumed` false).
   */
  resume?: { keys: readonly NoteEvent[]; nowMs: number };
}

/**
 * The parts every screen where a piece is played puts together: the staff for the player's staff settings, the judge
 * (`PracticeController`, Wait or Tempo mode, with the hints), the Tempo-mode clock link, and Kiur's feedback bubble with
 * its timers. A scene makes one, gives it the chart and its callbacks, and draws its own extras around it. The session
 * only connects and draws: the rules stay in `core/`.
 *
 * Drawing follows the scene's redraws: `drawStaff` and `drawBubble` inside `draw()`, `clearView()` inside `clear()`.
 * `destroy()` on shutdown releases everything.
 */
export class PlaySession {
  /** The chart as played (repeats unrolled, core_09.AC18): the judge, the transport and the audio use it. */
  readonly chart: Chart;
  /** The chart as written: the staff draws it. */
  readonly written: Chart;
  readonly play: PlayChart;
  /** Tempo mode: the clock of the piece; null in Wait mode. */
  readonly transport: Transport | null;
  private controllerNow!: PracticeController;
  private hints: Hints;
  /** How note names are written (B or H), for the name of a wrong key on the staff. */
  private naming: NoteNaming = 'B';
  private readonly scoreView: PlaySettings['scoreView'];
  private view: StaffView | null = null;
  private layoutNow: StaffLayout | null = null;
  /** The beat lanes as the player tuned them (core_13 rules 2 and 10), and the latest right key: its tick on the staff and its time. */
  private laneLooks: readonly LaneLook[] = [];
  private laneAnchor: { tick: number; atMs: number } | null = null;
  /** The staff tick of the next note awaited, for the bar a lane that follows the click runs in (core_13.AC9); null: the first bar. */
  private cursorTick: number | null = null;
  /** The score of the pass just finished, drawn past the last bar (ft_1_12); empty when none is shown. */
  private passScore: Phaser.GameObjects.GameObject[] = [];
  /** The pass score shown now, drawn again over a redraw; null when none. */
  private passScoreNow: { stars: number; numbers?: PassNumbers } | null = null;
  /** The cursor box breathes until the first key (`breatheCursor`). */
  private breathing = false;
  /** The width of the area the staff was last drawn in: the sheet's, which the prizes' column keeps inside. */
  private areaWidth = 0;
  /** The prizes of learning drawn at the sheet's top right (ft_1_32.AC19), and what they show (read by the tests). */
  private prizes: Phaser.GameObjects.Graphics | null = null;
  /** The learned piece's clef lifted off the column on its way to the book (ft_1_32.AC22). */
  private clef: Phaser.GameObjects.Graphics | null = null;
  private columnShown: PrizeColumn | null = null;
  prizesShown: readonly PrizeGlyph[] = [];
  private bubble: SpeechBubble | null = null;
  private onBubbleLines: ((lines: number) => void) | undefined;
  private mascot: Mascot | null = null;
  private messageNow = '';
  /** The icon before the message (a chip: the click's metronome and its BPM, d312). */
  private iconNow: Bitmap | undefined = undefined;
  /** Until when (scene time) a message said with `hold` stays, even when right notes are played. */
  private holdUntil = 0;
  private lastWrong: WrongKey | null = null;
  private wrongTimer: Phaser.Time.TimerEvent | null = null;
  private messageTimer: Phaser.Time.TimerEvent | null = null;
  /** Wait mode: every key the judge heard in this pass, in order (`passKeys`). */
  private keysOfPass: NoteEvent[] = [];
  /** The pass was picked up where it was left (`resume`). */
  resumed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly options: PlaySessionOptions) {
    this.written = options.chart;
    this.play = unrollRepeats(options.chart);
    this.chart = this.play.chart;
    this.hints = options.hints ?? { noteNames: false, fingers: false };
    this.lastWrong = options.wrongKey ?? null;
    this.scoreView = options.tempo?.scoreView ?? 'colour';
    const tempo = options.tempo;
    // a looped section's next lap goes on at `startAtMs` with no count-in: the clock was already running; a start on the
    // first note has none either
    const noCountIn = tempo !== undefined && (tempo.startAtMs !== undefined || tempo.start === 'firstNote');
    this.transport = tempo ? new Transport(this.chart, { tempoPercent: tempo.percent, ...(noCountIn ? { countInBars: 0 } : {}) }) : null;
    if (tempo?.startAtMs !== undefined) this.transport!.start(tempo.startAtMs);
    this.startJudge(options.resume);
  }

  /** Wait mode: the keys of this pass so far, for picking it up again on a fresh judge (`resume`); none in Tempo mode. */
  get passKeys(): readonly NoteEvent[] {
    return this.transport ? [] : this.keysOfPass;
  }

  /** The chart the staff draws: the written chart, or what `shown` puts in its place. */
  private get drawn(): Chart {
    return this.options.shown?.chart ?? this.written;
  }

  /** The judge of the round on screen. */
  get controller(): PracticeController {
    return this.controllerNow;
  }

  /** The staff on screen, and its layout; null before the first draw. */
  get staffView(): StaffView | null {
    return this.view;
  }

  get layout(): StaffLayout | null {
    return this.layoutNow;
  }

  get message(): string {
    return this.messageNow;
  }

  /** True while an icon stands before the message, for tests. */
  get messageHasIcon(): boolean {
    return this.iconNow !== undefined;
  }

  getState(): PlayState {
    return this.controllerNow.getState();
  }

  /**
   * A fresh judge for the same chart: the piece again from its first note (the play started over). Wait mode only: a
   * Tempo-mode transport cannot start over.
   */
  restart(): void {
    if (this.transport) throw new Error('PlaySession.restart: Tempo mode starts over with a new scene');
    this.controllerNow.dispose();
    this.startJudge();
  }

  private startJudge(resume?: PlaySessionOptions['resume']): void {
    const { callbacks } = this.options;
    this.keysOfPass = [];
    const waitMode = () => new WaitMode(this.chart, { hints: this.hints, ...(this.options.moveOnWrong ? { moveOnWrong: true } : {}) });
    let mode = this.transport
      ? new TempoMode(this.chart, this.transport, {
        hints: this.hints, loop: this.options.tempo?.loop === true, gradeHold: this.options.tempo?.gradeHold !== false, start: this.options.tempo?.start ?? 'anyKey',
        ...(this.options.tempo?.follow ? { follow: DEFAULT_FOLLOW_RULES } : {}),
      })
      : waitMode();
    this.resumed = false;
    if (resume && !this.transport && resume.keys.length > 0) {
      if (replayKeys(mode, resume.keys, resume.nowMs)) {
        this.keysOfPass = [...resume.keys];
        this.resumed = true;
      } else mode = waitMode();
    }
    // the keys the judge hears are kept, so a pass left for the settings can be picked up again
    const keyboard: KeyboardInput = {
      id: this.options.keyboard.id,
      getStatus: () => this.options.keyboard.getStatus(),
      onStatus: (listener) => this.options.keyboard.onStatus(listener),
      dispose: () => this.options.keyboard.dispose(),
      onNote: (listener) => this.options.keyboard.onNote((event) => {
        if (!this.transport) this.keysOfPass.push(event);
        listener(event);
      }),
    };
    this.controllerNow = new PracticeController(this.chart, keyboard, {
      onChange: (state) => {
        this.applyState(state);
        callbacks.onChange?.(state);
      },
      onJudged: (event, state) => {
        this.followKey(event);
        this.followCursor(state);
        callbacks.onJudged(event, state);
      },
      onCompleted: (result) => callbacks.onCompleted(result),
      ...(callbacks.onEvents ? { onEvents: (events: readonly JudgeEvent[], state: PlayState) => callbacks.onEvents!(events, state) } : {}),
    }, this.hints, mode);
  }

  /** Tempo mode, every frame: let the judge's clock reach `nowMs`. Wait mode does nothing. */
  advance(nowMs: number): void {
    this.controllerNow.advance(nowMs);
  }

  /** A tick of the judge's chart as the same moment on the staff drawn: its written pass, in the piece a run is shown in. */
  staffTick(playTick: number): number {
    return writtenTick(this.play, playTick) + (this.options.shown?.offset ?? 0);
  }

  /** The beat lanes drawn from the next `drawStaff` on; none hides them. */
  setLanes(looks: readonly LaneLook[]): void {
    this.laneLooks = looks;
  }

  /** The latest right key anchors the lane's wave in Wait mode: it runs on from there. */
  private followKey(event: JudgeEvent): void {
    if (event.type !== 'NoteJudged' || event.verdict !== 'correct') return;
    const note = this.chart.notes[event.noteIndex];
    if (!note) return;
    const tick = this.staffTick(note.tick);
    // a chord's other keys keep the time of its first
    if (this.laneAnchor?.tick !== tick) this.laneAnchor = { tick, atMs: event.timeMs };
  }

  /** The next note awaited after a key: the bar where a lane that follows the click runs its wave. */
  private followCursor(state: PlayState): void {
    const next = state.awaiting[0];
    const note = next === undefined ? undefined : this.chart.notes[next];
    if (note) this.cursorTick = this.staffTick(note.tick);
  }

  /**
   * Move the lane's wave to `nowMs` (core_13.AC1): in Tempo mode with the piece's clock, so it runs with the playhead and the
   * click; in Wait mode on from the latest right key at `msPerQuarter` (the click's, or the student's own pace in learning),
   * at most a bar on, where it waits for the next key; none with no pace. `marks` colour the keys played, by staff tick.
   */
  moveLane(nowMs: number, msPerQuarter: number | null, marks: ReadonlyMap<number, Pick<PaceMark, 'side' | 'far'>>, click?: { beat: { beatInBar: number; atMs: number } | null; msPerQuarter: number } | null): void {
    if (!this.view || this.laneLooks.length === 0) return;
    const drawn = this.drawn;
    const playTick = this.transport?.tickAt(nowMs) ?? null;
    if (playTick !== null) {
      // Tempo mode: the piece's clock is the click's, so every lane follows it
      this.view.moveLane(playTick < 0 ? null : this.staffTick(playTick), marks);
      return;
    }
    const wave = waveTick(this.laneAnchor, msPerQuarter === null ? null : msPerQuarter / drawn.ppq, nowMs, fullBarTicks(drawn.meterMap, drawn.ppq));
    // a lane that follows the click runs on its beats, in the bar of the next note; with no click it follows the student
    const at = this.cursorTick ?? this.laneAnchor?.tick ?? 0;
    const bar = drawn.bars.find((b) => at >= b.startTick && at < b.endTick) ?? drawn.bars[0] ?? null;
    this.view.moveLane(wave, marks, click ? clickWaveTick(bar, click.beat, click.msPerQuarter, nowMs, drawn.ppq) : undefined);
  }

  /** Tempo mode: move the playhead to where the piece is at `nowMs`. */
  movePlayhead(nowMs: number): void {
    const tick = this.transport?.tickAt(nowMs) ?? null;
    if (tick !== null && this.layoutNow) this.view?.setPlayhead(playheadAt(this.layoutNow, this.written, writtenTick(this.play, tick)));
  }

  setHints(hints: Hints): void {
    this.hints = hints;
    this.controllerNow.setHints(hints);
  }

  /** Stop listening to the keyboard (the piece or the tug is over); what is on screen stays. */
  stop(): void {
    this.controllerNow.dispose();
  }

  /**
   * Draw the staff into `area` (screen pixels), laid out for the player's settings and brought up to date with the
   * judge. A section is drawn at the size of the whole piece, with the whole piece's bar numbers.
   */
  drawStaff(area: { top: number; width: number; height: number }, prefs: StaffPrefs): StaffView {
    const settings = prefs.staffSettings;
    // in Tempo mode with the Scores view, room above chords for their stacked scores, so none goes off the page
    // the staff space range counts CSS pixels, so Windows display scaling keeps the notes as big as the player had them
    const options = { viewport: { width: area.width, height: area.height }, ...staffSpaceLimits(this.scene.scale.zoom), scoreRoom: this.transport !== null && this.scoreView === 'number', staffGap: prefs.staffGap, noteNaming: prefs.noteNaming, ...chordNamesOption(prefs), ...(this.options.restingTracks ? { restingTracks: this.options.restingTracks } : {}) };
    this.naming = prefs.noteNaming;
    const section = this.options.section;
    const drawn = this.drawn;
    this.areaWidth = area.width;
    let whole = layoutForSettings(section?.whole ?? this.written, options, settings);
    const room = this.options.roomRight ?? 0;
    if (room > 0) {
      // the room is in staff spaces of the staff that is left: laid out once to know its size, then again narrower
      options.viewport = { ...options.viewport, width: Math.max(1, area.width - Math.ceil(room * whole.staffSpace)) };
      whole = layoutForSettings(section?.whole ?? this.written, options, settings);
    }
    const layout = section ? layoutSection(drawn, whole, options, settings) : whole;
    this.layoutNow = layout;
    // numbered as printed: a piece's pick-up is bar 0 (core_09.AC25)
    // a learning run draws the whole piece, numbered from its first bar
    const numbers = barNumbersToShow(prefs.barNumberSettings.mode, drawn.bars.length, this.options.shown ? 0 : section?.first ?? 0, firstPrintedBar(section?.whole ?? this.written));
    // the parchment runs the whole width of the area, also past a staff that leaves room at its right
    this.view = new StaffView(this.scene, layout, undefined, { ...this.hints, chordFingers: this.options.chordFingers === true }, { x: 0, y: area.top }, numbers, room > 0 ? { x: 0, width: area.width } : undefined);
    this.view.setDurationMarks(durationMarks(layout, drawn, prefs.durationHelp));
    this.view.setLanes(this.laneLooks.map((look) => ({ dots: laneDots(layout, drawn, look.place, look.offset), look })), drawn.ppq);
    // where the hand moves, shown with the finger numbers (ft_1_30.AC10)
    this.view.setHandShifts(handShiftMap(drawn, LEVELS.find((l) => l.level === drawn.level)));
    this.view.veil(this.options.shown?.faint ?? []);
    if (this.options.partMarks) this.view.setPartMarks(this.options.partMarks);
    if (this.transport) this.view.followPlayhead(true);
    this.applyState(this.controllerNow.getState());
    if (this.lastWrong) this.showWrongKey(this.lastWrong);
    if (this.breathing) this.view.breathe(true);
    if (this.passScoreNow) this.drawPassScore(this.passScoreNow.stars, this.passScoreNow.numbers);
    return this.view;
  }

  private applyState(state: PlayState): void {
    const shown = this.toWritten(state);
    this.view?.applyProgress(shown.noteProgress, shown.awaiting, shown.retried);
    if (this.transport) this.view?.applyTimings(shown.noteProgress, shown.timings, this.scoreView);
  }

  /** The judge's state (play notes) as the written notes the staff draws: the pass that is on (core_09.AC18). */
  private toWritten(state: PlayState): Pick<PlayState, 'noteProgress' | 'awaiting' | 'timings' | 'retried'> {
    if (this.play.chart === this.written) return state;
    const position = state.awaiting.length > 0 ? Math.min(...state.awaiting) : this.chart.notes.length;
    const shown = writtenView(this.play, this.written.notes.length, position);
    const timings = state.timings;
    const retried = state.retried;
    return {
      noteProgress: shown.map((p) => state.noteProgress[p] ?? 'pending'),
      awaiting: state.awaiting.map((p) => this.play.writtenNote[p]!),
      ...(timings ? { timings: shown.map((p) => timings[p] ?? null) } : {}),
      ...(retried ? { retried: shown.map((p) => retried[p] === true) } : {}),
    };
  }

  /** Draw Kiur's bubble at `spot` with the current message; `onLines` hears how many lines it shows after every change. */
  drawBubble(root: Phaser.GameObjects.Container, spot: BubbleSpot, onLines?: (lines: number) => void): SpeechBubble {
    this.bubble = new SpeechBubble(this.scene, root, spot, this.messageNow);
    this.onBubbleLines = onLines;
    this.showMessage();
    return this.bubble;
  }

  /** The Kiur on screen, who looks puzzled at a wrong note. */
  setMascot(mascot: Mascot | null): void {
    this.mascot = mascot;
  }

  /**
   * What Kiur says in the bubble; an empty message hides it. `forMs` clears it again; with `hold` right notes played
   * meanwhile do not clear it (`feedback`).
   */
  say(text: string, forMs = 0, hold = false, icon?: Bitmap): void {
    this.messageNow = text;
    this.iconNow = icon;
    if (hold) this.holdUntil = this.scene.time.now + forMs;
    this.showMessage();
    this.messageTimer?.remove();
    this.messageTimer = null;
    if (forMs > 0) {
      this.messageTimer = this.scene.time.delayedCall(forMs, () => {
        this.messageTimer = null;
        this.messageNow = '';
        this.iconNow = undefined;
        this.showMessage();
      });
    }
  }

  /**
   * The feedback for a judged note: a right note clears the bubble (unless a held message is still on) and the played key;
   * a wrong one puts the key that was played beside the awaited note, with its name, makes Kiur look puzzled and flashes
   * the awaited notes. No sentence (the clean-screen rule, ft_1_12.AC7): the staff shows what was played.
   */
  feedback(event: NoteJudged, state: PlayState): void {
    this.breatheCursor(false);
    if (event.verdict === 'correct') {
      if (this.scene.time.now >= this.holdUntil) this.say('');
      this.view?.setPlayed(null);
      this.lastWrong = null;
      return;
    }
    const awaiting = this.toWritten(state).awaiting;
    this.showWrongKey({ midi: event.midi, awaiting, reason: event.reason });
    // the 8 by the played key is named in Kiur's bubble the first time this player sees it (d312)
    const tip = event.reason === 'wrong-octave' ? markTipFor(this.scene, 'octave') : null;
    if (tip !== null) this.say(tip, MESSAGE_MS, true);
    this.mascot?.setMood('hmm', HMM_MS);
    this.view?.flashWrong(awaiting); // MIDI cannot say which hand it was, so every awaited note flashes
    this.wrongTimer?.remove();
    this.wrongTimer = this.scene.time.delayedCall(WRONG_FLASH_MS, () => this.view?.flashWrong(null));
  }

  /** The wrong key played last, while it is on the staff (null after a right one): carried to the next learning run. */
  get wrongKey(): WrongKey | null {
    return this.lastWrong;
  }

  /** Put a wrong key on the staff beside the awaited note (`awaiting`, of the written notes), with its name; it stays until a right key. */
  showWrongKey(wrong: WrongKey): void {
    this.lastWrong = wrong;
    const mark = this.layoutNow ? playedMark(this.layoutNow, this.drawn, wrong.awaiting, wrong.midi) : null;
    this.view?.setPlayed(mark, mark ? noteLabel(mark.spelling, this.naming) : '', wrong.reason === 'wrong-octave');
  }

  private showMessage(): void {
    const lines = this.bubble?.show(this.messageNow, this.iconNow) ?? 0;
    this.onBubbleLines?.(lines);
  }

  /**
   * The lit note's cursor box breathes until the first key (d312: the start needs no line): on at a start, off at the first
   * key judged or when the count-in begins. It is kept over a redraw.
   */
  breatheCursor(on: boolean): void {
    if (this.breathing === on) return;
    this.breathing = on;
    this.view?.breathe(on);
  }

  /**
   * The grade of the pass just finished, at the end of the piece's last bar (ft_1_12.AC3, d312): in a row under the staff
   * ending at its final bar line, five stars as big as a notehead's two spaces, the earned ones gold (`passStarsFor`), then
   * its numbers: the share right in percent, the wrong key's ghost notehead with the count of wrong keys, and in Tempo mode
   * the tempo gauge with the timing score. Drawn at the staff's resolution (`passScorePlace`); it stays over a redraw
   * until `hidePassScore`.
   */
  showPassScore(stars: number, numbers?: PassNumbers): void {
    this.passScoreNow = { stars, ...(numbers ? { numbers } : {}) };
    this.drawPassScore(stars, numbers);
  }

  /** The pass's stars and numbers go. */
  hidePassScore(): void {
    this.passScoreNow = null;
    this.clearPassScore();
  }

  /** The numbers shown beside the stars now, for tests: "91%", the wrong keys, the timing; null with none shown. */
  get passScoreShown(): { stars: number; numbers?: PassNumbers } | null {
    return this.passScoreNow;
  }

  private drawPassScore(stars: number, numbers?: PassNumbers): void {
    this.clearPassScore();
    const layout = this.layoutNow;
    const view = this.view;
    if (!layout || !view) return;
    const S = layout.staffSpace;
    // one row under the last bar, ending at its final bar line: five stars as big as a notehead's two spaces, then the
    // numbers, the share right, the wrong keys by a red ghost notehead as on the staff, and in Tempo mode the timing by a
    // tempo gauge (a half dial and its needle)
    const star = S * PASS_STAR;
    const starStep = star * 1.05;
    const gap = 0.6 * S;
    const head = { rx: S * 0.6, ry: S * 0.45 };
    const r = S * 0.6;
    const style = { fontFamily: STAFF_FONT, fontStyle: 'bold', fontSize: `${Math.round(S * 1.2)}px`, color: PASS_INK };
    const values = numbers ? [`${numbers.percent}%`, String(numbers.wrong), ...(numbers.timing !== undefined ? [String(numbers.timing)] : [])] : [];
    const texts = values.map((value) => this.scene.add.text(0, 0, value, style).setOrigin(0, 0.5).setDepth(1));
    const marks = [0, 2 * head.rx + 0.3 * S, 2 * r + 0.3 * S];
    const starsW = star + 4 * starStep;
    const rowW = starsW + texts.reduce((sum, text, i) => sum + gap + marks[i]! + text.width, 0);
    const place = passScorePlace(layout, { w: Math.ceil(rowW), h: Math.ceil(star) });
    const y = view.origin.y + place.y + place.h / 2;
    const g = this.scene.add.graphics();
    for (let i = 0; i < GRADE_STARS; i++) {
      const points = starPoints(view.origin.x + place.x + star / 2 + i * starStep, y, star / 2, star / 4.4) as Phaser.Math.Vector2[];
      g.fillStyle(i < stars ? 0xf2b632 : 0xd8d2bf, 1).fillPoints(points, true);
      g.lineStyle(Math.max(1, Math.round(S / 10)), STAFF_INK, 1).strokePoints(points, true);
    }
    g.setDepth(1);
    this.passScore = [g];
    let x = view.origin.x + place.x + starsW + gap;
    texts.forEach((text, i) => {
      if (i === 1) g.fillStyle(WRONG_HEAD, WRONG_HEAD_ALPHA).fillEllipse(x + head.rx, y, head.rx * 2, head.ry * 2);
      if (i === 2) {
        const cx = x + r, cy = y + r * 0.45;
        g.lineStyle(Math.max(1, Math.round(S / 8)), STAFF_INK, 1);
        g.beginPath().arc(cx, cy, r, Math.PI, 2 * Math.PI).closePath().strokePath();
        g.lineBetween(cx, cy, cx + r * 0.55, cy - r * 0.7);
      }
      x += marks[i]!;
      text.setPosition(Math.round(x), Math.round(y));
      x += text.width + gap;
    });
    const objects: Phaser.GameObjects.GameObject[] = texts;
    this.passScore.push(...objects);
  }

  /** The prizes of learning a piece in a column at the sheet's top right (ft_1_32.AC19); they stay until the staff is drawn again. */
  showPrizes(rewards: LearnRewards, focus: PrizeFocus): void {
    this.prizes?.destroy();
    const layout = this.layoutNow;
    const view = this.view;
    if (!layout || !view) return;
    // the column's right edge a little in from the sheet's, in the room the staff left there
    const column = prizeColumn(layout.staffSpace, this.areaWidth - view.origin.x - 1.2 * layout.staffSpace, rewards, focus);
    this.prizesShown = column.glyphs;
    this.columnShown = column;
    this.prizes = drawPrizes(this.scene, column, view.origin, layout.staffSpace, { withoutClef: this.clef !== null });
  }

  /**
   * Lifts the learned piece's clef off the prize column and grows it smoothly to twice its size where it stands
   * (ft_1_32.AC22); it stays until the screen closes. Returns its grown box on the screen, or null with no clef shown.
   */
  liftClef(): { x: number; y: number; w: number; h: number } | null {
    const glyph = this.prizesShown.find((p) => p.role === 'piece');
    const layout = this.layoutNow;
    const view = this.view;
    if (!glyph || !layout || !view) return null;
    const S = layout.staffSpace;
    const box = { x: view.origin.x + glyph.x, y: view.origin.y + glyph.y, w: PRIZE.clefBox.w * PRIZE.clefScale * S, h: PRIZE.clefBox.h * PRIZE.clefScale * S };
    this.clef?.destroy();
    this.clef = drawMedalClef(this.scene, glyph.medal, { x: box.x + box.w / 2, y: box.y + box.h / 2 }, S).setDepth(3);
    // the column again without its clef: the lifted one stands in its place
    this.prizes?.destroy();
    if (this.columnShown) this.prizes = drawPrizes(this.scene, this.columnShown, view.origin, S, { withoutClef: true });
    if (motionAllowed()) this.scene.tweens.add({ targets: this.clef, scale: CLEF_FLIGHT.grow, duration: CLEF_FLIGHT.growMs, ease: 'Sine.easeInOut' });
    else this.clef.setScale(CLEF_FLIGHT.grow);
    return grownBox(box);
  }

  private clearPassScore(): void {
    for (const o of this.passScore) o.destroy();
    this.passScore = [];
  }

  /** Before the scene draws again: the staff goes, and the bubble and Kiur with the scene's root. */
  clearView(): void {
    this.clearPassScore();
    this.prizes?.destroy();
    this.prizes = null;
    this.view?.destroy();
    this.view = null;
    this.bubble = null;
    this.onBubbleLines = undefined;
    this.mascot = null;
  }

  /** On shutdown: the judge stops listening, the timers stop and the staff goes. */
  destroy(): void {
    this.controllerNow.dispose();
    this.wrongTimer?.remove();
    this.messageTimer?.remove();
    this.wrongTimer = null;
    this.messageTimer = null;
    this.clearView();
  }
}

/** The five points and five inner corners of a star around (cx, cy), point up. */
function starPoints(cx: number, cy: number, outer: number, inner: number): { x: number; y: number }[] {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

const CHORDS = loadChordContent(chordsJson);

/** The layout's chord names from the player's setting (core_09.AC59): none for the notes only. */
function chordNamesOption(prefs: StaffPrefs): Pick<StaffLayoutOptions, 'chordNames'> {
  const show = prefs.chordLabels ?? 'notes';
  if (show === 'notes') return {};
  return { chordNames: { show, name: (keys, spellings) => { const chord = nameChord(CHORDS, keys, { spellings }); return chord ? staffChordName(chord, prefs.noteNaming) : null; } } };
}
