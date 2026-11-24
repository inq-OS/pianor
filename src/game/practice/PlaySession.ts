import levelsJson from '../../../content/curriculum/levels.json';
import { levelsFileSchema } from '../../core/chart';
import { handShiftMap } from '../../core/fingering/shifts';
import type Phaser from 'phaser';
import { firstPrintedBar, unrollRepeats, writtenTick, writtenView, type Chart, type PlayChart } from '../../core/chart';
import { DEFAULT_FOLLOW_RULES, TempoMode, WaitMode, type Hints, type TempoStart, type JudgeEvent, type NoteJudged, type PieceResult, type PlaySettings, type PlayState } from '../../core/judge';
import { barNumbersToShow, type BarNumberSettings } from '../../core/layout/barNumbers';
import { prizeColumn, type PrizeGlyph } from '../../core/layout/learnPrizes';
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
import { drawPrizes } from './prizeGlyphs';
import { staffSpaceLimits } from '../../core/layout/canvasSize';


/** The levels' hand positions, which the hand-shift arrows prefer (ft_1_30.AC10). */
const LEVELS = levelsFileSchema.parse(levelsJson).levels;
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
   * What the staff draws instead of `chart` (learning, ft_1_32.AC20): `chart` with bars after it, drawn very faint from bar
   * `faintFrom`; its first notes are `chart`'s, in the same order, so the judge's note indexes are its own.
   */
  shown?: { chart: Chart; faintFrom: number | null };
  /** Staff spaces left free right of the staff (the prizes of learning past the last bar line, ft_1_32.AC19). */
  roomRight?: number;
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
  /** The score of the pass just finished, drawn past the last bar (ft_1_12); empty when none is shown. */
  private passScore: Phaser.GameObjects.GameObject[] = [];
  /** The prizes of learning drawn past the last bar line (ft_1_32.AC19), and what they show (read by the tests). */
  private prizes: Phaser.GameObjects.Graphics | null = null;
  prizesShown: readonly PrizeGlyph[] = [];
  private bubble: SpeechBubble | null = null;
  private onBubbleLines: ((lines: number) => void) | undefined;
  private mascot: Mascot | null = null;
  private messageNow = '';
  /** Until when (scene time) a message said with `hold` stays, even when right notes are played. */
  private holdUntil = 0;
  private wrongTimer: Phaser.Time.TimerEvent | null = null;
  private messageTimer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly options: PlaySessionOptions) {
    this.written = options.chart;
    this.play = unrollRepeats(options.chart);
    this.chart = this.play.chart;
    this.hints = options.hints ?? { noteNames: false, fingers: false };
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
   * A fresh judge for the same chart: the piece again from its first note (find the key started over). Wait mode only: a
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
      onJudged: (event, state) => callbacks.onJudged(event, state),
      onCompleted: (result) => callbacks.onCompleted(result),
      ...(callbacks.onEvents ? { onEvents: (events: readonly JudgeEvent[], state: PlayState) => callbacks.onEvents!(events, state) } : {}),
    }, this.hints, mode);
  }

  /** Tempo mode, every frame: let the judge's clock reach `nowMs`. Wait mode does nothing. */
  advance(nowMs: number): void {
    this.controllerNow.advance(nowMs);
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

  /** Stop listening to the keyboard (the piece or the fight is over); what is on screen stays. */
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
    const numbers = barNumbersToShow(prefs.barNumberSettings.mode, drawn.bars.length, section?.first ?? 0, firstPrintedBar(section?.whole ?? this.written));
    // the parchment runs the whole width of the area, also past a staff that leaves room at its right
    this.view = new StaffView(this.scene, layout, undefined, { ...this.hints, chordFingers: this.options.chordFingers === true }, { x: 0, y: area.top }, numbers, room > 0 ? { x: 0, width: area.width } : undefined);
    this.view.setDurationMarks(durationMarks(layout, drawn, prefs.durationHelp));
    // where the hand moves, shown with the finger numbers (ft_1_30.AC10)
    this.view.setHandShifts(handShiftMap(drawn, LEVELS.find((l) => l.level === drawn.level)));
    this.view.veil(this.options.shown?.faintFrom ?? null);
    if (this.transport) this.view.followPlayhead(true);
    this.applyState(this.controllerNow.getState());
    return this.view;
  }

  private applyState(state: PlayState): void {
    const shown = this.toWritten(state);
    this.view?.applyProgress(shown.noteProgress, shown.awaiting);
    this.showPrizesOnPage();
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
      return;
    }
    const awaiting = this.toWritten(state).awaiting;
    const mark = this.layoutNow ? playedMark(this.layoutNow, this.drawn, awaiting, event.midi) : null;
    this.view?.setPlayed(mark, mark ? noteLabel(mark.spelling, this.naming) : '');
    this.mascot?.setMood('hmm', HMM_MS);
    this.view?.flashWrong(awaiting); // MIDI cannot say which hand it was, so every awaited note flashes
    this.wrongTimer?.remove();
    this.wrongTimer = this.scene.time.delayedCall(WRONG_FLASH_MS, () => this.view?.flashWrong(null));
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

  /** The prizes of learning a piece past the staff's last bar line (ft_1_32.AC19); they stay until the staff is drawn again. */
  showPrizes(rewards: LearnRewards, focus: PrizeFocus): void {
    this.prizes?.destroy();
    const layout = this.layoutNow;
    const view = this.view;
    if (!layout || !view) return;
    this.prizesShown = prizeColumn(layout, rewards, focus).glyphs;
    this.prizes = drawPrizes(this.scene, this.prizesShown, view.origin, layout.staffSpace);
    this.showPrizesOnPage();
  }

  /** The prizes stand on the line of the last bar line: shown while its page is (one line at a time turns with the cursor). */
  private showPrizesOnPage(): void {
    const system = this.prizesShown[0]?.system;
    if (system !== undefined) this.prizes?.setVisible(this.layoutNow?.systems[system]?.page === this.view?.currentPage);
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
