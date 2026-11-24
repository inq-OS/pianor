import levelsJson from '../../../content/curriculum/levels.json';
import { levelsFileSchema } from '../../core/chart';
import { handShiftMap } from '../../core/fingering/shifts';
import type Phaser from 'phaser';
import { firstPrintedBar, fullBarTicks, unrollRepeats, writtenTick, writtenView, type Chart, type PlayChart } from '../../core/chart';
import { DEFAULT_FOLLOW_RULES, TempoMode, WaitMode, type Hints, type TempoStart, type JudgeEvent, type NoteJudged, type PieceResult, type PlaySettings, type PlayState } from '../../core/judge';
import { barNumbersToShow, type BarNumberSettings } from '../../core/layout/barNumbers';
import type { PaceMark } from '../../core/layout/beat';
import { laneDots, waveTick, type LanePlace } from '../../core/layout/beatLane';
import { PRIZE, prizeColumn, type PrizeColumn, type PrizeGlyph } from '../../core/layout/learnPrizes';
import { CLEF_FLIGHT, grownBox } from '../../core/layout/clefFlight';
import type { LearnRewards } from '../../core/learn/progress';
import type { PrizeFocus } from '../../core/learn/view';
import { passScorePlace } from '../../core/layout/passScore';
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
import { StaffView } from '../ui/staff/StaffView';
import { PracticeController } from './PracticeController';
import { drawMedalClef, drawPrizes } from './prizeGlyphs';
import { motionAllowed } from '../motion';
import { staffSpaceLimits } from '../../core/layout/canvasSize';


/** The levels' hand positions, which the hand-shift arrows prefer (ft_1_30.AC10). */
const LEVELS = levelsFileSchema.parse(levelsJson).levels;
/** A wrong key and the notes it was played for (indices of the written notes). */
export interface WrongKey {
  midi: number;
  awaiting: readonly number[];
}

/** How long a wrong note flashes, how long its feedback stays in the bubble, and how long Kiur looks puzzled. */
const WRONG_FLASH_MS = 700;
export const MESSAGE_MS = 3500;
export const HMM_MS = 2500;

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
  /** Where the beat lane runs (core_13 rule 2), and the latest right key: its tick on the staff and its time. */
  private lanePlace: LanePlace = 'off';
  private laneAnchor: { tick: number; atMs: number } | null = null;
  /** The score of the pass just finished, drawn past the last bar (ft_1_12); empty when none is shown. */
  private passScore: Phaser.GameObjects.GameObject[] = [];
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
  /** Until when (scene time) a message said with `hold` stays, even when right notes are played. */
  private holdUntil = 0;
  private lastWrong: WrongKey | null = null;
  private wrongTimer: Phaser.Time.TimerEvent | null = null;
  private messageTimer: Phaser.Time.TimerEvent | null = null;

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
    this.startJudge();
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

  private startJudge(): void {
    const { keyboard, callbacks } = this.options;
    const mode = this.transport
      ? new TempoMode(this.chart, this.transport, {
        hints: this.hints, loop: this.options.tempo?.loop === true, gradeHold: this.options.tempo?.gradeHold !== false, start: this.options.tempo?.start ?? 'anyKey',
        ...(this.options.tempo?.follow ? { follow: DEFAULT_FOLLOW_RULES } : {}),
      })
      : this.options.moveOnWrong ? new WaitMode(this.chart, { hints: this.hints, moveOnWrong: true }) : undefined;
    this.controllerNow = new PracticeController(this.chart, keyboard, {
      onChange: (state) => {
        this.applyState(state);
        callbacks.onChange?.(state);
      },
      onJudged: (event, state) => {
        this.followKey(event);
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

  /** Where the beat lane runs, from the next `drawStaff` on. */
  setLanePlace(place: LanePlace): void {
    this.lanePlace = place;
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

  /**
   * Move the lane's wave to `nowMs` (core_13.AC1): in Tempo mode with the piece's clock, so it runs with the playhead and the
   * click; in Wait mode on from the latest right key at `msPerQuarter` (the click's, or the student's own pace in learning),
   * at most a bar on, where it waits for the next key; none with no pace. `marks` colour the keys played, by staff tick.
   */
  moveLane(nowMs: number, msPerQuarter: number | null, marks: ReadonlyMap<number, Pick<PaceMark, 'side' | 'far'>>): void {
    if (!this.view || this.lanePlace === 'off') return;
    const drawn = this.drawn;
    const playTick = this.transport?.tickAt(nowMs) ?? null;
    const wave = playTick !== null
      ? (playTick < 0 ? null : this.staffTick(playTick))
      : waveTick(this.laneAnchor, msPerQuarter === null ? null : msPerQuarter / drawn.ppq, nowMs, fullBarTicks(drawn.meterMap, drawn.ppq));
    this.view.moveLane(wave, marks);
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
    const options = { viewport: { width: area.width, height: area.height }, ...staffSpaceLimits(this.scene.scale.zoom), scoreRoom: this.transport !== null && this.scoreView === 'number', staffGap: prefs.staffGap, noteNaming: prefs.noteNaming, ...(this.options.restingTracks ? { restingTracks: this.options.restingTracks } : {}) };
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
    this.view.setLane(laneDots(layout, drawn, this.lanePlace), drawn.ppq);
    // where the hand moves, shown with the finger numbers (ft_1_30.AC10)
    this.view.setHandShifts(handShiftMap(drawn, LEVELS.find((l) => l.level === drawn.level)));
    this.view.veil(this.options.shown?.faint ?? []);
    if (this.transport) this.view.followPlayhead(true);
    this.applyState(this.controllerNow.getState());
    if (this.lastWrong) this.showWrongKey(this.lastWrong);
    return this.view;
  }

  private applyState(state: PlayState): void {
    const shown = this.toWritten(state);
    this.view?.applyProgress(shown.noteProgress, shown.awaiting);
    if (this.transport) this.view?.applyTimings(shown.noteProgress, shown.timings, this.scoreView);
  }

  /** The judge's state (play notes) as the written notes the staff draws: the pass that is on (core_09.AC18). */
  private toWritten(state: PlayState): Pick<PlayState, 'noteProgress' | 'awaiting' | 'timings'> {
    if (this.play.chart === this.written) return state;
    const position = state.awaiting.length > 0 ? Math.min(...state.awaiting) : this.chart.notes.length;
    const shown = writtenView(this.play, this.written.notes.length, position);
    const timings = state.timings;
    return {
      noteProgress: shown.map((p) => state.noteProgress[p] ?? 'pending'),
      awaiting: state.awaiting.map((p) => this.play.writtenNote[p]!),
      ...(timings ? { timings: shown.map((p) => timings[p] ?? null) } : {}),
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
  say(text: string, forMs = 0, hold = false): void {
    this.messageNow = text;
    if (hold) this.holdUntil = this.scene.time.now + forMs;
    this.showMessage();
    this.messageTimer?.remove();
    this.messageTimer = null;
    if (forMs > 0) {
      this.messageTimer = this.scene.time.delayedCall(forMs, () => {
        this.messageTimer = null;
        this.messageNow = '';
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
    if (event.verdict === 'correct') {
      if (this.scene.time.now >= this.holdUntil) this.say('');
      this.view?.setPlayed(null);
      this.lastWrong = null;
      return;
    }
    const awaiting = this.toWritten(state).awaiting;
    this.showWrongKey({ midi: event.midi, awaiting });
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
    this.view?.setPlayed(mark, mark ? noteLabel(mark.spelling, this.naming) : '');
  }

  private showMessage(): void {
    const lines = this.bubble?.show(this.messageNow) ?? 0;
    this.onBubbleLines?.(lines);
  }

  /**
   * The grade of the pass just finished, right after the piece's last bar (ft_1_12.AC3): five stars, small
   * and upright, three in a column and two beside them set half a star down, the earned ones gold (`passStarsFor`). Drawn
   * at the staff's resolution (`passScorePlace`); it stays until the staff is drawn again.
   */
  showPassScore(stars: number): void {
    this.clearPassScore();
    const layout = this.layoutNow;
    const view = this.view;
    if (!layout || !view) return;
    const star = layout.staffSpace * 0.95;
    const step = star * 1.05;
    // the column of three, then the column of two half a star down, packed like coins
    const spots = [[0, 0], [0, 1], [0, 2], [1, 0.5], [1, 1.5]] as const;
    const columnStep = star * 0.9;
    const place = passScorePlace(layout, { w: Math.ceil(star + columnStep), h: Math.ceil(star + 2 * step) });
    const g = this.scene.add.graphics();
    spots.forEach(([column, row], i) => {
      const cx = view.origin.x + place.x + star / 2 + column * columnStep;
      const cy = view.origin.y + place.y + star / 2 + row * step;
      const points = starPoints(cx, cy, star / 2, star / 4.4) as Phaser.Math.Vector2[];
      g.fillStyle(i < stars ? 0xf2b632 : 0xd8d2bf, 1).fillPoints(points, true);
      g.lineStyle(Math.max(1, Math.round(layout.staffSpace / 10)), STAFF_INK, 1).strokePoints(points, true);
    });
    g.setDepth(1);
    this.passScore = [g];
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
