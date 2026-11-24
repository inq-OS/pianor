import { firstPrintedBar, isSection, sectionHasNotes, sliceChart, writtenNotes, type Chart } from '../core/chart';
import { pieceTitle } from '../core/text/pieceTitle';
import { MissedBars, type Hints, type JudgeEvent, type NoteJudged, type PieceResult, type PlayState, type WrongNoteJudged } from '../core/judge';
import { learnLiveTempo, type LearnRewards } from '../core/learn/progress';
import { learnsOnOpen } from '../core/learn/route';
import { baselinePercent } from '../core/learn/tempo';
import { CHARACTER_PIECES } from './adventure/scenesData';
import { dayString } from '../io/teacher/teacherDesk';
import { PLAY_CHOICES, choiceSettings, followsPlayer, playChoiceOf, type PlayChoice, type PlaySettings } from '../core/judge/playSettings';
import { barAtPoint } from '../core/layout/barPick';
import { TAP_SLIP } from '../core/layout/bubble';
import { DEFAULT_RAMP, RAMP_CHOICES, RAMP_MAX_PERCENT, TEMPO_PERCENT, clampTempoPercent, cleanLap, nextChoice, nextTarget, rampAfterLap, scrollRamp, toggleUnit, type TempoRamp, type Transport, type MetronomePlan, clickBpm, clickPlan, stepClickOffset } from '../core/transport';
import { emptyFreePlay, recordFreePlayNote, recordFreePlayRound, summarizeFreePlay, type FreePlaySession } from '../core/scoring/freePlay';
import { t, type StringKey } from '../core/text/strings';
import { passStarsFor } from '../core/scoring/stars';
import { passLines } from '../core/text/rundown';
import { STATS_PANE_COUNT_HEIGHT, statsPane, type StatsPane } from '../core/layout/statsPane';
import { createBitmap, type Bitmap } from './ui/pixel/bitmap';
import type { CompletionOutcome } from './profile/ProfileService';
import { mergeOutcomes } from './profile/sessionOutcome';
import { contextOf, MIDI_CHANGED } from './context';
import { BarRecorder } from './practice/BarRecorder';
import { ListenAlong } from './practice/ListenAlong';
import { MESSAGE_MS, PlaySession, type PlaySessionOptions, type WrongKey } from './practice/PlaySession';
import { HOTKEYS, IDLE, actionForCode, chordStep, hotkeyLabel, typedBarRange, type Chord, type ChordContext, type ChordInput } from './practice/hotkeys';
import { carryOver, metronomeAtCreate } from './practice/metronomeStart';
import { CountInGrace } from './practice/countInGrace';
import { stripBpmLabel } from './practice/clickSpeed';
import { drawnText, fitLine, measure } from './ui/pixel/font';
import { panelBitmap } from './ui/pixel/frames';
import { C } from './ui/pixel/palette';
import { ICONS } from './ui/pixel/iconArt';
import { Mascot, PixelImage, PixelText, type PixelButton, type PixelButtonOptions } from './ui/pixel/PixelObjects';
import { MASCOT_SIZE } from './ui/pixel/sprites';
import { BAR_BUTTON_HEIGHT, BAR_EDGE, BAR_GAP, BUBBLE_X, TITLE_X, TOP_BAR } from './ui/pixel/playBars';
import { PixelScene, type MenuItem, type ToolbarItem } from './ui/pixel/PixelScene';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { openOverlay, startScene, type OverlayOutcome } from './scenes';
import type { KeriScreen } from './visit/islandVisit';
import { afterPlay, type PlayStage, type PracticeSpot } from '../core/intro/intro';
import { INTRO } from './intro/introContent';
import type { Rect } from '../core/layout/rect';
import { circleItem } from './CircleOfFifthsScene';
import { GuardedKeyboard } from './practice/GuardedKeyboard';
import { LearnSession, markersFor } from './practice/LearnSession';
import { REWARD_ROWS, rewardNotes } from './practice/rewardNotes';
import { passHeldFor } from '../core/judge/keyBash';

const RESULTS_DELAY_MS = 1000;
/** The loop (ft_1_12): how long the score of a pass stays past the last bar before the piece starts again at bar 1. */
const PASS_SCORE_MS = 2000;
/**
 * Learning bar by bar (ft_1_32): how long the wrong key and Kiur's line stay before the same step starts again, and how long
 * a perfect run's line stays before the next step. AX-3 provisional.
 */
const LEARN_STOP_MS = 1800;
const LEARN_NEXT_MS = 1400;
/** How long Kiur's pass numbers stay once the next pass begins; right notes do not clear them meanwhile. */
const PASS_SUMMARY_MS = 6000;

/** Heights of the bars below the top bar (`playBars`), in art pixels: the tools strip (click, tempo, section) and the bottom bar. */
// 18, not 16: its 14-pixel buttons hold a label with tails (Free play) inside their frame
const TOOLS_BAR = 18;
/** The second strip under the tools while a section is played: its tempo ramp (core_03.AC5). */
const RAMP_BAR = 16;
const BOTTOM_BAR = 32;
/** The stats pane under the bottom bar, in place of the on-screen keyboard (ft_1_12.AC5), and the registry key of its switch (session only, no save). */
const STATS_PANE = 40;
/** The live tempo's two half-size lines in the strip at the foot (ft_1_32.AC17), this many rows apart. */
const LIVE_TEMPO_LINE = 6;
export const STATS_PANE_KEY = 'statsPane';

/** Typing a bar number: how long a number that could still grow waits before it is taken (Enter takes it at once). */
const BAR_TYPING_MS = 1200;
/** The Analyze button at the right end of the tools strip. */
const ANALYZE_WIDTH = 56;
/** The button is as wide as its label needs, never narrower than ANALYZE_WIDTH: Estonian capitals are longer (ft_0_18.AC6); the label wraps when it is wider than the button less 8. */
const analyzeWidth = () => Math.max(ANALYZE_WIDTH, measure(drawnText(t('analyze.button'))) + 10);
/** The tools strip: the - and + buttons of the tempo, the room for "100%" between them, and the space either side of the BPM. */
const STEP_WIDTH = 14;
const PERCENT_WIDTH = 26;
/** The picture buttons of the bars: Wait / Tempo (moved here from the settings, for easier access), Click, the hints. */
const ICON_WIDTH = 22;
/** The section button's picture, A | -> | B, is wider. */
const SECTION_WIDTH = 26;
const BPM_PAD = 6;
/** A line of text centred on a button row starts this far above the row's centre. */
const TEXT_RISE = 4;
/** The bottom bar: Kiur at its left, the page buttons (while marking a section) at its right, this far in from the edge. */
const MASCOT_X = 6;
const MASCOT_DROP = 4;
const BOTTOM_EDGE = 6;
const PAGE_BUTTON_WIDTH = 16;
/** The bubble starts this far under the bottom bar's top; the piano status line sits this far above its bottom. */
const BUBBLE_DROP = 2;
const STATUS_RISE = 11;
/** With the band (ft_1_20): Kiur and his bubble stand in the strip between the door and the gear, this far below its top. */
const BAND_STRIP_DROP = 1;
/** How long Kiur's one hint about the bubble stays before the start message. */
const BUBBLE_HINT_MS = 6000;

/** The cycling mode button's name per choice (core_01.AC10). */
const MODE_LABEL: Readonly<Record<PlayChoice, 'settings.modeWait' | 'settings.modeFollow' | 'settings.modeTempo' | 'settings.modeTempoFirstNote'>> = {
  wait: 'settings.modeWait', follow: 'settings.modeFollow', tempo: 'settings.modeTempo', tempoFirstNote: 'settings.modeTempoFirstNote',
};

/** The mode button's tooltip: what Wait and Tempo mean, what the following clock does, or the name of the start on the first note. */
const modeTooltip = (choice: PlayChoice): string => {
  if (choice === 'follow') return t('settings.hintFollow');
  return choice === 'tempoFirstNote' ? t(MODE_LABEL[choice]) : t('settings.hint');
};

/** What the scene is started with; a restart (a new tempo, a section, the next lap) passes it on with a change. */
export interface PracticeData {
  chartId?: string;
  chart?: Chart;
  preview?: boolean;
  returnTo?: 'preview' | 'editor';
  /**
   * The teacher's check-up (ft_1_27.AC2): the whole piece once, in Wait mode at its written tempo, with no section, mode or
   * tempo buttons; at the end of the first pass (saved as any pass) back to the room, which hears the play from the log
   * after `since` (an ISO time, when she asked for it). Back returns to the room with nothing heard.
   */
  checkup?: { since: string };
  /** Learning bar by bar (ft_1_32): what Kiur says as this start begins, about the run just ended. */
  learnLine?: string;
  /** The wrong key that stopped the last learning run (ft_1_32.AC6): it stays on the staff until the first key of this run. */
  learnWrong?: { key: WrongKey; firstBar: number; lastBar: number };
  /**
   * Kiur was asked to teach this piece bar by bar (ft_1_32 rule 14): it opens in learning even when it was played to the end
   * before. Without it the piano is a sandbox: only a character's piece is learned before it is played in full.
   */
  learn?: boolean;
  /**
   * A character teaches this piece (ft_1_32.AC15): it opens in learning with `learn`, and Back, or the piece learned, goes
   * back to the character's scene of Keri, which keeps the learned piece as taught.
   */
  teacher?: { scene: KeriScreen };
  /**
   * One play of the first-run intro (ft_1_31.AC3, AC4): the lesson's bars as a section in Wait mode, with only Listen and
   * Start over; Kiur's spotlight shows the screen before the first lap (`shown` once it was); after `passes` laps back to
   * the room's next stage, and Back returns to the room's stage that opened it.
   */
  intro?: { stage: PlayStage; passes: number; shown?: boolean };
  /** Reopening a half-learned piece asked already whether to go on or start over (ft_1_32.AC16): not asked again on a restart. */
  resumeAsked?: boolean;
  /**
   * Practise bars `first` to `last` (0-based, inclusive) of the piece as a loop that earns no XP. `from`: started by a tap on
   * bar `first`, so it runs to the piece's end and carries a start mark instead of A and B.
   */
  section?: { first: number; last: number; from?: boolean };
  /** Tempo as a percent of the piece's own (default 100). */
  percent?: number;
  /** The metronome click: on by default in Tempo mode, off in Wait mode. */
  click?: boolean;
  /** The click speed in BPM on top of the tempo percent (Wait mode only; core/transport/practiceSpeed.ts). */
  clickOffset?: number;
  /** Laps of a section done so far. */
  lap?: number;
  /**
   * A section's next lap wraps on without a pause: at clock time `atMs` its first bar begins (Tempo mode: no count-in),
   * and the click that was running keeps running.
   */
  wrap?: { atMs: number };
  /** A section's tempo ramp (core_03.AC5) and the laps counted towards its next step. Not saved: it lasts while the piece is open. */
  ramp?: TempoRamp;
  rampLaps?: number;
  /** The section so far: laps played, clean laps and the BPM of the first lap (Kiur sums it up on leaving the section). */
  sectionLog?: { laps: number; clean: number; fromBpm: number };
  /** What Kiur says first: how the section just left went. */
  sectionSummary?: string;
  /** What Kiur says as the piece loops: the pass just finished in numbers (`passLines`), said once and held a while. */
  passSummary?: string;
  /** The ramp stepped up as this lap began (Kiur says the new BPM). */
  rampedUp?: boolean;
  /** The play session so far (ft_1_12): every key judged and every pass to the end, passed on from pass to pass. */
  session?: FreePlaySession;
  /** What each finished pass of this session earned and saved, for the score screen. */
  passes?: CompletionOutcome[];
  /** The last pass finished in this session, for the score screen. */
  lastResult?: PieceResult;
  /**
   * Kuula (listen): the scene starts with the judge off and the game plays the piece (or the section) from its first note
   * at the tempo percent, lighting the notes on the staff; at its end, or on Stop, the piece starts over to be played.
   * Starting the scene with it again while it plays starts the listening over (the space-bar reset).
   */
  listen?: boolean;
  /**
   * The space bar started the play over (ft_1_12.AC8): from the first bar, with nothing said; in Tempo mode the count-in
   * starts at once instead of waiting for the first key.
   */
  reset?: boolean;
  /**
   * The auto reset started the play over (core_01.AC11): like the space bar, but the start is waited for again (a key for the
   * count-in, or the first note), so a student who has stopped playing is not counted in over and over.
   */
  waitForStart?: boolean;
  /** A section wrapping on: its bars in a row with nothing played right so far (the auto reset's run, core_01.AC11). */
  missedBars?: number;
}

/**
 * Practice: the staff, a judge (Wait mode, or Tempo mode when the player chose it: the first key starts a one-bar count-in and
 * a line runs through the piece) and a keyboard, put together by a `PlaySession`. The scene only draws and forwards: the
 * judge decides what is right, the staff view draws what the judge says; the scene adds the practice tools around them. The bars around the staff are pixel art (Kiur speaks in the bottom
 * bar); the staff itself is drawn at the full screen resolution so its lines stay thin and sharp.
 */
export class PracticeScene extends PixelScene {
  private chart!: Chart;
  /** The whole piece; `chart` is a section of it while one is being practised. */
  private fullChart!: Chart;
  private startData: PracticeData = {};
  private percent = 100;
  private clickOn = false;
  private clickOffset = 0;
  /** Marking a section: waiting for the first bar, then the last, by a tap on the staff. */
  private picking: 'first' | 'last' | null = null;
  private firstPicked = 0;
  /** The page shown while a section is being marked: the staff keeps its size, and the player turns its pages. */
  private pickPage = 0;
  /** The R, first bar, last bar chord (hotkeys.ts) and the pause after which typed digits are taken. */
  private chord: Chord = IDLE;
  private chordTimer: Phaser.Time.TimerEvent | null = null;
  /** The staff, the judge (and in Tempo mode its clock) and Kiur's bubble. */
  private playSession!: PlaySession;
  /** The message Kiur starts with; the session has it once it exists. */
  private startMessage = '';
  /** The start message is the last pass's numbers, held for `PASS_SUMMARY_MS`. */
  private passSummaryShown = false;
  private metronomeOn = false;
  private lastBeat = -1;
  /** The count-in's grace note (d121), handed to the piano only just before its beat. */
  private countInGrace = new CountInGrace();
  private counting = false;
  private mascot: Mascot | null = null;
  private statusText: PixelText | null = null;
  private hints: Hints = { noteNames: false, fingers: false };
  private leaving = false;
  /** Opened by the preview tool or the editor: a chart that is not in the menu, no XP, and Back returns to `returnTo`. */
  private preview = false;
  private returnTo: 'preview' | 'editor' = 'preview';
  /** `PracticeData.checkup` of this start; null for any other play. */
  private checkup: { since: string } | null = null;
  /**
   * Learning the piece bar by bar (ft_1_32 slice 2): a new piece is learned before it is practised. The staff shows only the
   * run's bars in Wait mode, the first wrong key ends the run and the same step starts again; null for any other play.
   */
  private learn: LearnSession | null = null;
  /** The mistake markers of the chart shown, by note index (ft_1_32.AC5). */
  private markers: ReadonlyMap<number, number> = new Map();
  /** The reward notes as drawn (kept for the tests); null while the piece is not being learned. */
  protected rewardsData: LearnRewards | null = null;
  /** `PracticeData.intro` of this start; null for any other play. */
  private intro: NonNullable<PracticeData['intro']> | null = null;
  /** The intro's skip button was pressed: leaving goes to the room with the intro ended, not to its stage. */
  private introSkipped = false;
  /** The last save of bar plays to the practice log, so the check-up leaves only once its bars are kept. */
  private barsSaved: Promise<unknown> = Promise.resolve();
  /** The looping play (ft_1_12): the session so far, the passes saved, and the pause while a pass's score shows (Back may still leave then). */
  private passes: CompletionOutcome[] = [];
  /** The save of the pass whose score is showing; leaving waits for it. */
  private pendingPass: Promise<CompletionOutcome | undefined> | null = null;
  private lastResult: PieceResult | null = null;
  /** The stats pane as drawn (kept for the tests); null while it is off. */
  protected paneData: StatsPane | null = null;
  /** The live tempo lines of a learning run in the stats pane (ft_1_32.AC17), while it is shown. */
  private liveLabels: PixelText[] | null = null;
  /** Turns the judge's events into the practice log's bar plays; null for a draft preview. */
  private barRecorder: BarRecorder | null = null;
  private session: FreePlaySession = emptyFreePlay();
  private loopTimer: Phaser.Time.TimerEvent | null = null;
  /** The piece just learned (ft_1_32 rule 5): the reward stays on the paper until a key or a press calls this, once. */
  private learnedGoOn: (() => void) | null = null;
  /** This start follows a learning run, whose line Kiur says: no other words over it. */
  private afterLearnRun = false;
  /** The wrong key carried from the run before (`learnWrong`), shown again on this run's staff. */
  private carriedWrong: PracticeData['learnWrong'] | null = null;
  /** The ramp buttons a mouse wheel changes: the button and what one notch up (1) or down does. */
  private rampWheel: { button: PixelButton; scroll: (direction: 1 | -1) => void }[] = [];
  /** This start wraps on from the lap before (`PracticeData.wrap`); null for any other start. */
  private wrap: { atMs: number } | null = null;
  /** A section's lap is over and the next one starts at once: the click is left running for it. */
  private wrapping = false;
  /** Kuula: this start plays the piece to the player instead of judging it (`PracticeData.listen`). */
  private listening = false;
  private listenAlong: ListenAlong | null = null;
  /** This start comes from the space bar (`PracticeData.reset`). */
  private resetStart = false;
  /** The auto reset's watch over the finished bars (core_01.AC11): Tempo mode with the player's switch on; null otherwise. */
  private missedBars: MissedBars | null = null;
  /** `PracticeData.waitForStart` and `missedBars` of this start. */
  private waitForStart = false;
  private initialMissedBars = 0;
  /** The player's keyboard behind the key-bash guard (ft_1_15): the judge hears this one. */
  private guarded!: GuardedKeyboard;
  /** Kiur is at the door (ft_1_15), or the intro's spotlight is up (ft_1_31): the overlay is up and this screen is paused. */
  private atDoor = false;
  /** The staff's top on the screen, in screen pixels, as last drawn (the intro's spotlight finds the staff from it). */
  private staffOrigin: number | null = null;
  /** With the band (ft_1_20): the tempo ramp's panel is open over the staff's foot (an opening item, rule 2); not saved. */
  private rampOpen = false;

  constructor() {
    super('practice');
  }

  init(data: PracticeData): void {
    this.startData = data;
    this.learnedGoOn = null;
    this.preview = data.preview === true;
    this.returnTo = data.returnTo ?? 'preview';
    this.readLesson(data);
    if (data.chart) {
      this.fullChart = data.chart;
    } else {
      const piece = contextOf(this).pieces.find(data.chartId ?? '');
      if (!piece) throw new Error(`Unknown piece: ${data.chartId}`);
      this.fullChart = piece.chart;
    }
    this.learn = this.openLearning(data);
    this.chart = this.learn ? this.learn.chart : data.section ? sliceChart(this.fullChart, data.section.first, data.section.last) : this.fullChart;
    // a new start is where this player last played the piece (100 when never, and for a piece that is not in the menu)
    const profiles = (contextOf(this)).profiles;
    // the following clock starts from the tempo the player's own learning runs measured, when there is one (core_01.AC13)
    const own = !this.locked && followsPlayer(profiles.playSettings) ? baselinePercent(profiles.learnProgressOf(this.fullChart.id).bpm ?? [], this.fullChart.tempoMap[0]!.bpm) : null;
    const percent = this.asWritten ? 100 : (data.percent ?? own ?? profiles.startPercent(this.fullChart.id));
    // a section's tempo ramp may go past the -/+ range, up to RAMP_MAX_PERCENT
    this.percent = data.section && percent > TEMPO_PERCENT.max ? Math.min(RAMP_MAX_PERCENT, percent) : clampTempoPercent(percent);
    this.picking = null;
    this.chord = IDLE;
    this.chordTimer = null;
    // the finger numbers start on when the player's setting says so; the F key still toggles them
    this.hints = { noteNames: false, fingers: contextOf(this).profiles.showFingers };
    this.leaving = false;
    this.metronomeOn = false;
    this.lastBeat = -1;
    this.countInGrace = new CountInGrace();
    this.counting = false;
    this.session = data.session ?? emptyFreePlay();
    this.passes = data.passes ?? [];
    this.lastResult = data.lastResult ?? null;
    this.pendingPass = null;
    this.loopTimer = null;
    this.wrapping = false;
    this.listening = data.listen === true;
    // the piece loops (ft_1_12): a pass after the first starts with nothing said (its score was shown past the last bar)
    const looping = !data.section && (data.lap ?? 0) > 0;
    // after a pass Kiur says its numbers (the stats the old score screen showed per play)
    this.passSummaryShown = looping && !data.wrap && !data.sectionSummary && data.passSummary !== undefined;
    this.resetStart = data.reset === true && !data.wrap;
    this.waitForStart = data.waitForStart === true;
    this.initialMissedBars = data.missedBars ?? 0;
    // while it plays the piece Kiur says nothing: the staff and the sound are the message (the clean-screen rule)
    this.startMessage = this.listening ? '' : data.wrap ? this.lapMessage(data) : this.resetStart ? '' : this.openingLine(data, looping);
    // the summary is said once, not again after a later restart
    // the wrap, the step-up note and the summary belong to this start only: a later restart (a tempo change, Whole
    // piece) must not wrap on from an old time or say them again
    this.wrap = data.wrap ?? null;
    // a restart between learning runs carries Kiur's line: the piece was open already, so it never asks to go on (ft_1_32.AC16)
    this.startData = { ...data, ...(data.learnLine !== undefined ? { resumeAsked: true } : {}) };
    this.takeLearnCarry(data);
    delete this.startData.sectionSummary;
    delete this.startData.passSummary;
    delete this.startData.wrap;
    delete this.startData.rampedUp;
    delete this.startData.reset;
    delete this.startData.waitForStart;
    delete this.startData.missedBars;
    // any other restart (a tempo change, the mode, a section) ends the listening
    delete this.startData.listen;
  }

  /** What Kiur says first: about the learning run just ended or the one starting, a section left, the last pass, or the start. */
  private openingLine(data: PracticeData, looping: boolean): string {
    return data.learnLine ?? this.learn?.startLine() ?? data.sectionSummary ?? (looping ? (data.passSummary ?? '') : t('practice.start'));
  }

  /**
   * The bars played (a learning run's, or a section's; undefined for the whole piece), and the section the practice log
   * keeps: a learning run of the whole piece is logged as the piece.
   */
  private playedBars(): { section: { first: number; last: number } | undefined; logged: { first: number; last: number } | null } {
    const run = this.learn?.run;
    if (!run) return { section: this.startData.section, logged: this.startData.section ?? null };
    const section = { first: run.firstBar, last: run.lastBar };
    return { section, logged: run.firstBar === 0 && run.lastBar === this.fullChart.bars.length - 1 ? null : section };
  }

  /** The mistake markers over the bars shown (ft_1_32.AC5); none in a draft preview, which has no practice log. */
  private markersShown(section: { first: number } | undefined): ReadonlyMap<number, number> {
    return this.preview ? new Map() : markersFor(contextOf(this).profiles, this.fullChart.id, this.chart, section?.first ?? 0);
  }

  /**
   * The learning of this piece (ft_1_32), or null: not for a draft preview, the check-up, a section, with `?learn=0`, for a
   * piece picked at the piano that is not a character's (the piano is a sandbox, rule 14), or for a piece that is learned
   * (or, unless Kiur was asked, was played well before learning came, `LearnSession.open`).
   */
  private openLearning(data: PracticeData): LearnSession | null {
    const context = contextOf(this);
    if (this.preview || this.checkup || data.section || !context.flags.learn) return null;
    const asked = data.learn === true;
    if (!learnsOnOpen({ route: asked ? 'kiur' : 'piano', mustLearn: CHARACTER_PIECES.has(this.fullChart.id) })) return null;
    return LearnSession.open(context.profiles, this.fullChart, dayString(new Date()), undefined, asked);
  }

  /** The check-up, the intro and learning play the piece as given: Wait mode, no mode, tempo or section buttons. */
  private get locked(): boolean {
    return this.asWritten || this.learn !== null;
  }

  /** What Kiur says as a section wraps on: the lap, and the new BPM when the ramp has just stepped up. */
  private lapMessage(data: PracticeData): string {
    const n = (data.lap ?? 0) + 1;
    if (!data.rampedUp) return t('practice.again', { n });
    return t('practice.rampUp', { n, bpm: Math.round((this.fullChart.tempoMap[0]!.bpm * this.percent) / 100) });
  }

  /** Tempo mode's options for the session: the percent, the score view, a section's loop and wrap, the hold grading and the start. */
  private tempoOptions(play: PlaySettings): NonNullable<PlaySessionOptions['tempo']> {
    return {
      percent: this.percent, scoreView: play.scoreView, loop: this.startData.section !== undefined, gradeHold: contextOf(this).adminSettings.gradeNoteLength,
      start: play.tempoStart ?? 'anyKey', ...(this.wrap ? { startAtMs: this.wrap.atMs } : {}), ...(followsPlayer(play) ? { follow: true } : {}),
    };
  }

  /** What every restart passes on: the click, and the session with its passes. */
  private carry(): Pick<PracticeData, 'click' | 'clickOffset' | 'session' | 'passes' | 'lastResult'> {
    return { ...carryOver({ clickOn: this.clickOn, clickOffset: this.clickOffset, session: this.session, passes: this.passes }), ...(this.lastResult ? { lastResult: this.lastResult } : {}) };
  }

  override create(): void {
    const context = contextOf(this);
    const play = this.playSettings();
    // the click keeps one beat and the following clock does not: no click while the clock follows (core_01.AC13)
    this.clickOn = !followsPlayer(play) && (this.startData.click ?? play.mode === 'tempo');
    this.clickOffset = this.startData.clickOffset ?? 0;
    // a learning run is drawn like a section, at the size of the whole piece
    const { section, logged } = this.playedBars();
    this.atDoor = false;
    this.guarded = new GuardedKeyboard(context.keyboard, { passHeld: passHeldFor(this.chart) }, () => this.onBash());
    this.playSession = new PlaySession(this, {
      chart: this.chart,
      ...(section ? { section: { whole: this.fullChart, first: section.first } } : {}),
      keyboard: this.guarded,
      hints: this.hints,
      chordFingers: contextOf(this).profiles.chordFingers,
      ...this.restingOption(),
      ...(play.mode === 'tempo' ? { tempo: this.tempoOptions(play) } : {}),
      callbacks: {
        onJudged: (event, state) => this.onJudged(event, state),
        onCompleted: (result) => this.onCompleted(result),
        onEvents: (events) => {
          this.recordBars(events);
          this.watchMissedBars(events);
          this.watchLearnRun(events);
        },
      },
    });
    this.missedBars = play.mode === 'tempo' && play.autoReset === true ? new MissedBars(this.wrap ? (this.initialMissedBars ?? 0) : 0) : null;
    this.markers = this.markersShown(section);
    // every bar played is logged for the practice analysis (core_10); a draft preview is not
    this.barRecorder = this.preview ? null : new BarRecorder(this.playSession.chart, { pieceId: this.fullChart.id, mode: play.mode, tempoPercent: this.percent, section: logged }, () => new Date(), this.playSession.play.writtenBar);
    // the space bar: Tempo mode counts in at once (the click starts with the count-in in `update`); a start on the first
    // note, and the auto reset, wait for the start instead (core_01.AC10, AC11)
    if (this.resetStart && !this.waitForStart && !this.listening && play.tempoStart !== 'firstNote') this.transport?.start(context.audio.clock.nowMs());
    // Tempo mode from the first note says what Wait mode says: play the lit note
    const counted = play.mode === 'tempo' && play.tempoStart !== 'firstNote';
    const startMessage = counted && !this.wrap && this.startMessage === t('practice.start') ? t('practice.tempoStart') : this.startMessage;
    if (this.passSummaryShown) this.playSession.say(startMessage, PASS_SUMMARY_MS, true);
    else if (this.bubbleHintDue()) {
      // Kiur shows the bubble once (ft_1_20, d282), then says what he says at every start
      this.playSession.say(t('practice.bubbleHint'), BUBBLE_HINT_MS, true);
      this.time.delayedCall(BUBBLE_HINT_MS, () => this.playSession.say(startMessage));
    } else this.playSession.say(startMessage);
    const wrap = this.wrap;
    if (wrap && this.clickOn) {
      // a section that wraps on keeps its click: Wait mode's runs on as it is, Tempo mode's starts again on the lap's first
      // beat, which is on its grid (a click already queued for that moment sounds together with it); a lap that starts with
      // a pick-up keeps beat 1 on the bar after it (core_09.AC23)
      if (play.mode === 'tempo') context.audio.metronome.start(this.lapClick(wrap.atMs));
      else context.audio.metronome.setBpm(clickPlan(this.chart, this.percent, this.clickOffset).bpm); // the ramp may have stepped
      this.metronomeOn = true;
    }
    // Wait mode has no count-in to start the click, so a restart (loop, section round, tempo change) that carries it on starts it here;
    // not while the game plays the piece (a click at its own speed would muddle what the student hears)
    const startPlan = wrap || this.listening ? null : metronomeAtCreate(play.mode, this.clickOn, this.chart, this.percent, this.clickOffset);
    if (startPlan) {
      context.audio.metronome.start(startPlan);
      this.metronomeOn = true;
    }

    const midiChanged = () => this.redraw();
    this.game.events.on(MIDI_CHANGED, midiChanged);
    // a key on the piano closes the bubble: the student's hands went back to playing (ft_1_20.AC22)
    const offBubbleKey = context.keyboard.onNote((e) => {
      if (e.kind !== 'on' || e.velocity === 0) return;
      if (this.learnedGoOn) this.learnedGoOn();
      else if (this.bubbleIsOpen) this.closeMenu();
    });
    this.input.keyboard?.on('keydown-ESC', () => (this.rampOpen && this.rampShown ? this.toggleRamp() : this.picking ? this.cancelPicking() : this.leave()));
    // a mouse press on a bar starts from it at once; a finger only once it lifts from a short tap, so that holding on (the long
    // press) or a second finger (the two-finger tap) can open the bubble instead (ft_1_20, d282)
    // a slow tap is still a tap: a finger held long enough opened the bubble instead, and that lift is the bubble's
    let fingerDown: { x: number; y: number } | null = null;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        // a finger down while a menu is open is the menu's: its lift closes it and starts nothing
        fingerDown = this.menuOpen ? null : { x: pointer.x, y: pointer.y };
      } else this.onTap(pointer);
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const down = fingerDown;
      fingerDown = null;
      if (!down || !pointer.wasTouch || this.menuOpen || this.severalFingers) return;
      if (Math.hypot(pointer.x - down.x, pointer.y - down.y) > TAP_SLIP) return;
      this.onTap(pointer);
    });
    // Hotkeys on the window in the capture phase: the computer-keyboard piano listens there too, and a key taken here must not also play a note
    // the mouse wheel over a ramp value turns it by one (a press still cycles through the presets)
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const hit = this.rampWheel.find(({ button }) => {
        const r = button.screenRect();
        return pointer.x >= r.left && pointer.x < r.right && pointer.y >= r.top && pointer.y < r.bottom;
      });
      // over the band's inventory the wheel is the band's (ft_1_20.AC16)
      if (dy === 0 || this.pointerOnInventory(pointer)) return;
      if (hit) hit.scroll(dy < 0 ? 1 : -1);
      // elsewhere the wheel turns the staff's pages: down is the next page
      else this.turnPage(dy > 0 ? 1 : -1);
    });
    this.onWindowKey((e) => this.onHotkey(e));
    this.events.once('shutdown', () => {
      this.game.events.off(MIDI_CHANGED, midiChanged);
      offBubbleKey();
      this.chordTimer?.remove();
      this.playSession.destroy();
      this.guarded.dispose();
      this.listenAlong?.stop();
      if (!this.wrapping) this.stopMetronome();
    });
    super.create();
    if (this.listening) this.startListening();
    else this.introAfterCreate();
    this.resumeAfterCreate();
  }

  /**
   * Whether Kiur tells this player about the bubble now: once, on the first practice that is not the intro, learning or a
   * check-up (those keep their own words). Kept per player in this browser. AX-3 provisional: a browser flag, not the save.
   */
  private bubbleHintDue(): boolean {
    const flags = contextOf(this).flags;
    // the intro switched off (the end-to-end tests) or a self-playing demo: no first-run words
    // nor over Kiur's line about a learning run just ended
    if (this.locked || this.wrap || this.listening || this.afterLearnRun || flags.intro === 'off' || flags.autoplay) return false;
    const key = `pianor.bubbleHint.${contextOf(this).profiles.profile.id}`;
    try {
      if (window.localStorage.getItem(key) === '1') return false;
      window.localStorage.setItem(key, '1');
      return true;
    } catch {
      return false;
    }
  }

  /** The teacher's check-up (ft_1_27.AC2) or the intro's lesson (ft_1_31.AC3) of this start; neither for any other play. */
  private readLesson(data: PracticeData): void {
    this.checkup = !this.preview && !data.section ? (data.checkup ?? null) : null;
    this.intro = !this.preview && data.section ? (data.intro ?? null) : null;
    this.introSkipped = false;
  }

  /** The check-up and the intro's lesson are played as written: at the piece's tempo, in Wait mode. */
  private get asWritten(): boolean {
    return this.checkup !== null || this.intro !== null;
  }

  /** The player's play settings, in Wait mode whatever their own for a play as written (`checkupPlan`, ft_1_31.AC3). */
  private playSettings(): PlaySettings {
    const own = contextOf(this).profiles.playSettings;
    return this.locked ? { ...own, mode: 'wait' } : own;
  }

  /**
   * A piece left halfway through learning, opened again (not a restart between runs): the screen pauses and asks with two
   * pictures whether to go on or start over from the first bar (ft_1_32.AC16, `LearnResumeScene`). Start over saves the
   * learning from its first step and opens it again; go on, or Esc, plays where it stopped.
   */
  private resumeAfterCreate(): void {
    const learn = this.learn;
    if (!learn?.halfway || this.startData.resumeAsked) return;
    this.startData = { ...this.startData, resumeAsked: true };
    this.time.delayedCall(0, () => {
      if (this.leaving || this.atDoor || !this.scene.isActive()) return;
      this.atDoor = true;
      this.guarded.setMuted(true);
      void openOverlay(this, 'learnResume').then((choice) => {
        this.atDoor = false;
        this.guarded.setMuted(false);
        if (choice !== 'over' || this.leaving) return;
        this.leaving = true;
        void learn.startOver().then(() => this.scene.restart({ ...this.startData, ...this.carry() }));
      });
    });
  }

  /** The intro's spotlight over the screen before its first lap, once the screen is drawn with its band (ft_1_31.AC3). */
  private introAfterCreate(): void {
    if (this.intro && !this.intro.shown && (this.startData.lap ?? 0) === 0) this.time.delayedCall(0, () => this.showIntro());
  }

  /**
   * Kiur shows the practice screen under the spotlight before the intro's first lap (ft_1_31.AC3): the screen is paused and
   * the keys muted as at the door; Esc there skips the rest of the intro's tour on this screen, and the play goes on.
   */
  private showIntro(): void {
    const intro = this.intro;
    if (!intro || this.leaving || this.atDoor || !this.scene.isActive()) return;
    this.intro = { ...intro, shown: true };
    this.startData = { ...this.startData, intro: this.intro };
    const top = this.mainTopRows;
    const steps = INTRO.practice[intro.stage].map((step) => {
      const spot = this.introSpot(step.spot);
      return { spot: spot ? { ...spot, y: spot.y + top } : null, text: t(step.line as StringKey, { n: INTRO.practisePasses }) };
    });
    if (steps.length === 0) return;
    this.atDoor = true;
    this.guarded.setMuted(true);
    void openOverlay(this, 'intro', { steps }).then((outcome) => {
      this.atDoor = false;
      this.guarded.setMuted(false);
      if (outcome === 'skip') this.skipIntro();
    });
  }

  /** The intro's skip button, in the band or on Kiur's spotlight: to the room, the intro ended there. */
  private skipIntro(): void {
    this.introSkipped = true;
    this.leave();
  }

  /** Where a thing the intro shows is on this screen now, in art pixels of the main area; null when it is not drawn. */
  private introSpot(spot: PracticeSpot | null): Rect | null {
    if (spot === null) return null;
    const scale = this.px.scale;
    const layout = this.playSession.layout;
    const fromScreen = (x: number, y: number, w: number, h: number): Rect => ({ x: Math.floor(x / scale), y: Math.floor(y / scale) - this.mainTopRows, w: Math.ceil(w / scale), h: Math.ceil(h / scale) });
    const origin = this.staffOrigin;
    if (spot === 'staff' || spot === 'note') {
      if (!layout || origin === null || layout.staffLines.length === 0) return null;
      if (spot === 'note') {
        const n = layout.notes[0];
        if (!n) return null;
        return fromScreen(n.x - 3 * n.headRx, origin + n.y - 3 * n.headRy, 6 * n.headRx, 6 * n.headRy);
      }
      const page = layout.staffLines.filter((l) => l.system < layout.linesPerPage);
      const x1 = Math.min(...page.map((l) => l.x1)), x2 = Math.max(...page.map((l) => l.x2));
      const y1 = Math.min(...page.map((l) => l.y)), y2 = Math.max(...page.map((l) => l.y));
      const room = 2 * layout.staffSpace;
      return fromScreen(x1, origin + y1 - room, x2 - x1, y2 - y1 + 2 * room);
    }
    // the intro's band has two actions, Listen and Start over, in that order (`bandActions`)
    const button = spot === 'back' ? this.toolbarButtons.back : this.toolbarButtons.items[spot === 'listen' ? 0 : 1];
    if (!button) return null;
    const r = button.rect;
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }

  /**
   * Kuula: the judge stops listening to the keys, and the game plays the piece from its first note at the tempo percent,
   * the notes lit on the staff as they sound (`update`). At its end the piece starts over, ready to be played.
   * AX-3 provisional: no count-in and no click while it plays; the end starts the piece over at bar 1 for the student.
   */
  private startListening(): void {
    const context = contextOf(this);
    this.playSession.stop();
    this.listenAlong = new ListenAlong(context.audio.piano, context.audio.clock);
    this.listenAlong.start(this.playSession.chart, this.percent, () => this.restartForPlay());
  }

  /**
   * The Kuula button: listen to the piece from bar 1, or (while it plays) stop and play it. A restart, so the staff, the
   * judge and the Tempo clock start clean; a reset during listening is `this.listen(true)` while it plays.
   */
  private listen(on: boolean): void {
    // the pass score showing past the last bar belongs to the loop: its save and restart go first
    if (this.leaving) return;
    this.listenAlong?.stop();
    this.stopMetronome();
    this.scene.restart({ ...this.startData, ...this.carry(), listen: on });
  }

  /** The piece played by the game is over: the piece starts again from bar 1 for the student. */
  private restartForPlay(): void {
    if (this.leaving || !this.scene.isActive()) return;
    this.listen(false);
  }

  protected override clear(): void {
    this.playSession.clearView();
    this.rampWheel = [];
    this.mascot = null;
    this.statusText = null;
  }

  /** Tempo mode: the clock of the piece; null in Wait mode. */
  /** Tempo mode's click for a lap that goes on at `atMs`, on the transport's grid (beat 1 after a pick-up stays accented). */
  private lapClick(atMs: number): MetronomePlan {
    return this.transport?.metronomeFrom(atMs) ?? { ...clickPlan(this.chart, this.percent, 0), startAtMs: atMs };
  }

  /** What typing a bar number needs: the piece's bars, numbered as printed (a pick-up is 0, core_09.AC25). */
  private chordContext(): ChordContext {
    return { barCount: this.fullChart.bars.length, inSection: this.startData.section !== undefined, firstPrinted: firstPrintedBar(this.fullChart) };
  }

  private get transport(): Transport | null {
    return this.playSession.transport;
  }

  private leave(): void {
    // while a pass's score shows the scene is already "leaving" for the next pass; Back still ends the session then
    if (this.leaving && this.loopTimer === null) return;
    this.leaving = true;
    this.loopTimer?.remove();
    this.loopTimer = null;
    this.stopMetronome();
    // Back in the intro's play: to the room, where its stage is said again (ft_1_31.AC4)
    if (this.intro) {
      const stage = this.introSkipped ? 'skip' : afterPlay(this.intro.stage, false);
      void this.barsSaved.then(() => startScene(this, 'profile', { intro: stage }));
      return;
    }
    const checkup = this.checkup;
    if (checkup) {
      // Back during the check-up: to the room. A whole pass already played (its score showing) is heard there once its
      // bars are kept; before that the teacher still waits for the piece
      const pending = this.pendingPass;
      if (pending === null && this.lastResult === null) {
        startScene(this, 'profile');
        return;
      }
      void Promise.all([pending, this.barsSaved]).then(() => startScene(this, 'profile', { checkup: { piece: this.fullChart.id, since: checkup.since } }));
      return;
    }
    const teacher = this.startData.teacher;
    if (teacher) {
      // a character's teaching: back to its scene once the run's bars and a whole run's pass are kept (ft_1_32.AC15)
      void Promise.all([this.pendingPass, this.barsSaved]).then(() => startScene(this, teacher.scene, {}));
      return;
    }
    if (this.learn) {
      // learning has no score screen: back to the pieces once the run's bars and a whole run's pass are kept
      void Promise.all([this.pendingPass, this.barsSaved]).then(() => startScene(this, 'menu'));
      return;
    }
    if (!this.preview) {
      // the score screen (ft_1_12.AC4) once a key was played; nothing played: straight back to the piece list
      const summary = summarizeFreePlay(this.session, contextOf(this).audio.clock.nowMs());
      const pending = this.pendingPass;
      if (!summary.played && !pending) {
        startScene(this, 'menu');
        return;
      }
      void (pending ?? Promise.resolve(undefined)).then((outcome) => {
        const passes = outcome ? [...this.passes, outcome] : this.passes;
        startScene(this, 'results', { chartId: this.fullChart.id, summary, outcome: mergeOutcomes(passes) ?? undefined, ...(this.lastResult ? { result: this.lastResult } : {}) });
      });
      return;
    }
    else if (this.returnTo === 'editor') startScene(this, 'editor', {});
    else startScene(this, 'preview', {});
  }

  /** Every frame in Tempo mode: let the judge's clock run, start the metronome with the count-in, move the playhead. */
  override update(): void {
    if (this.listening) {
      const lit = this.listenAlong?.changed();
      if (lit !== undefined) this.playSession.staffView?.setCursor(writtenNotes(this.playSession.play, lit)); // Kuula plays the play chart
      return;
    }
    const context = contextOf(this);
    const now = context.audio.clock.nowMs();
    // keys held back by the key-bash guard go on to the judge once their wait is over (ft_1_15)
    this.guarded.release(now);
    const transport = this.transport;
    if (!transport || this.leaving) return;
    // a clock-driven judge never runs past a key that still waits, so it is judged at its own time
    this.playSession.advance(this.guarded.judgeClock(now));
    if (!transport.started || this.leaving) return;
    this.countInGrace.update(transport, context.audio.piano, now); // the first note's grace takes the count-in's last beat
    if (!this.metronomeOn && this.clickOn) {
      // a piece started by its first note began at that press, a moment ago: the click joins on the next beat (core_01.AC10)
      const plan = transport.countInBars === 0 ? transport.metronomeFrom(now) : transport.metronome();
      if (plan) {
        context.audio.metronome.start(plan);
        this.metronomeOn = true;
      }
    }
    const beat = transport.countIn(now);
    if (beat !== null && beat.beat !== this.lastBeat) {
      this.lastBeat = beat.beat;
      this.counting = true;
      this.say(t('practice.countIn', { n: beat.inBar + 1 })); // counted 1 2 3 4 | 1 2 3 before a pick-up
    } else if (beat === null && this.counting) {
      this.counting = false;
      this.say('');
    }
    this.playSession.movePlayhead(now);
  }

  private stopMetronome(): void {
    if (!this.metronomeOn) return;
    this.metronomeOn = false;
    (contextOf(this)).audio.metronome.stop();
  }

  private onJudged(event: NoteJudged, state: PlayState): void {
    if (!this.preview) this.session = recordFreePlayNote(this.session, event, contextOf(this).audio.clock.nowMs());
    this.playSession.feedback(event, state);
  }

  /** Log the bars the judge has just finished (core_10); a failed save is reported, never shown to the student. */
  private recordBars(events: readonly JudgeEvent[]): void {
    const plays = this.barRecorder?.push(events) ?? [];
    if (plays.length === 0) return;
    this.barsSaved = contextOf(this).profiles.recordBarPlays(plays).catch((error: unknown) => console.error('recordBarPlays failed', error));
  }

  /** Learning (ft_1_32): the first wrong key ends the run at once. */
  private watchLearnRun(events: readonly JudgeEvent[]): void {
    const learn = this.learn;
    if (!learn || this.leaving || this.listening || this.atDoor) return;
    const verdict = learn.push(events, this.playSession.chart);
    this.showLiveTempo();
    if (verdict.state === 'stopped') this.stopLearnRun(verdict.wrong);
    else if (verdict.state === 'rushed') this.stopRushedRun();
  }

  /**
   * A learning run sped up beyond the piece's baseline tempo (the rushing stop, ft_1_32.AC11): it stops, Kiur says so, and
   * the same step starts again. Nothing was played wrong, so no bar is logged with a miss; it counts as a run asked again.
   */
  private stopRushedRun(): void {
    const learn = this.learn!;
    this.leaving = true;
    this.stopMetronome();
    this.playSession.stop();
    void learn.finish('unsteady');
    this.againAfter(learn.rushLine());
  }

  /**
   * A wrong key ended a learning run (ft_1_32.AC6): the judge stops, the wrong key stays on the staff, Kiur names the mistake
   * and its bar, the bar is logged with its miss (for the markers), and the same step starts again.
   */
  private stopLearnRun(wrong: WrongNoteJudged): void {
    const learn = this.learn!;
    this.leaving = true;
    this.stopMetronome();
    this.playSession.stop();
    const play = this.barRecorder?.stop(wrong);
    if (play) this.barsSaved = contextOf(this).profiles.recordBarPlays([play]).catch((error: unknown) => console.error('recordBarPlays failed', error));
    const bar = learn.run.firstBar + (this.playSession.play.writtenBar[wrong.bar] ?? wrong.bar);
    const run = learn.run; // the run that ended, before its end moves the progress on
    void learn.finish('stopped');
    this.againAfter(learn.stopLine(wrong, bar), run);
  }

  /**
   * A stopped learning run: Kiur says `line`, and after a moment the same step starts again with it; a wrong key that ended
   * `stopped` (on the staff by then) is carried, to stay until the next run's first key.
   */
  private againAfter(line: string, stopped?: { firstBar: number; lastBar: number }): void {
    this.playSession.say(line);
    this.loopTimer = this.time.delayedCall(LEARN_STOP_MS, () => {
      this.loopTimer = null;
      const key = this.playSession.wrongKey;
      const learnWrong = stopped && key ? { learnWrong: { key, firstBar: stopped.firstBar, lastBar: stopped.lastBar } } : {};
      if (this.scene.isActive()) this.scene.restart({ ...this.startData, ...this.carry(), learnLine: line, ...learnWrong });
    });
  }

  /**
   * A learning run reached its end with every note right (ft_1_32.AC2): it counts unless note names were shown, or it was a
   * measured run (a confirmation play, the whole piece) whose pace was uneven, which Kiur asks again, slower (AC7). A
   * measured run of the whole piece is also a pass of the piece, saved as one (XP as before). The next run starts after
   * Kiur's line; once the piece is learned, the screen opens it for practice.
   */
  private finishLearnRun(result: PieceResult): void {
    const learn = this.learn!;
    const { outcome, bpm } = learn.outcomeOf(this.playSession.chart, result.hints.noteNames > 0);
    this.stopMetronome();
    // a pass of the piece only when the run counts: one asked again is not a play of a piece the game calls unlearned
    if (learn.wholePiece && outcome === 'perfect') {
      this.session = recordFreePlayRound(this.session, result);
      this.pendingPass = contextOf(this).profiles.completePiece(result, { mode: 'wait', tempoPercent: this.percent })
        .catch((error: unknown) => { console.error('completePiece failed', error); return undefined; });
    }
    void learn.finish(outcome, bpm);
    const said = learn.endLine(outcome, bpm);
    // an uneven run is asked again with its own line; otherwise Kiur also says what comes next
    const line = learn.learned || outcome === 'unsteady' ? said : [said, learn.nextLine()].filter((part) => part !== '').join(' ');
    this.redraw(); // the new note shows at once
    this.playSession.say(learn.learned ? `${line}${/[.!?]$/.test(line) ? '' : '.'} ${t('learn.goOn')}` : line);
    this.loopTimer = this.time.delayedCall(LEARN_NEXT_MS, () => {
      this.loopTimer = null;
      void Promise.all([this.pendingPass, this.barsSaved]).then(() => {
        if (!this.scene.isActive() || this.loopTimer !== null) return;
        this.pendingPass = null;
        if (!learn.learned) {
          this.scene.restart({ ...this.startData, ...this.carry(), learnLine: line });
          return;
        }
        // learned (ft_1_32 rule 5): the whole note and the clef stay with Kiur's line until the student plays a key or presses
        this.learnedGoOn = () => {
          this.learnedGoOn = null;
          this.afterLearned(line);
        };
      });
    });
  }

  /**
   * Where a learned piece goes on: a character's piece back to the character, who has taught it (ft_1_32.AC15); a piece
   * Kiur was asked to teach back to the room, where Kiur waits with the tug (rule 15); a character's piece learned at the
   * piano opens for practice.
   */
  private afterLearned(line: string): void {
    const teacher = this.startData.teacher;
    if (teacher) startScene(this, teacher.scene, {});
    else if (this.startData.learn === true) startScene(this, 'profile', {});
    else this.scene.restart({ ...this.startData, ...this.carry(), learnLine: line });
  }

  private onCompleted(result: PieceResult): void {
    if (this.leaving) return;
    this.leaving = true;
    if (this.learn) {
      this.finishLearnRun(result);
      return;
    }
    const lap = (this.startData.lap ?? 0) + 1;
    if (isSection(this.chart)) {
      // A section is practice, not the piece: no XP and no score, also when it holds the last bar (ft_1_12.AC3); it wraps
      // over to its first bar at once, on the beat, and the click keeps ticking
      const now = contextOf(this).audio.clock.nowMs();
      const wrap = { atMs: Math.max(now, this.transport?.endMs ?? now) };
      this.wrapping = this.metronomeOn;
      const base = this.chart.tempoMap[0]!.bpm;
      const clean = cleanLap(result);
      const ramp = rampAfterLap(this.startData.ramp ?? DEFAULT_RAMP, base, this.percent, this.startData.rampLaps ?? 0, clean);
      const log = this.startData.sectionLog ?? { laps: 0, clean: 0, fromBpm: this.bpmNow };
      const sectionLog = { ...log, laps: log.laps + 1, clean: log.clean + (clean ? 1 : 0) };
      // the intro's play is over after its laps: once its bars are kept, the room's next stage (ft_1_31.AC4)
      if (this.intro && lap >= this.intro.passes) {
        const next = afterPlay(this.intro.stage, true);
        this.stopMetronome();
        void this.barsSaved.then(() => { if (this.scene.isActive()) startScene(this, 'profile', { intro: next }); });
        return;
      }
      this.scene.restart({
        ...this.startData, ...this.carry(), lap, wrap, percent: ramp.percent, rampLaps: ramp.laps, rampedUp: ramp.percent > this.percent, sectionLog,
        ...(this.missedBars ? { missedBars: this.missedBars.missed } : {}),
      });
      return;
    }
    this.stopMetronome();
    if (this.preview) {
      // A play-along of a draft earns nothing and is not saved: back to the preview with what happened.
      this.time.delayedCall(RESULTS_DELAY_MS, () => (this.returnTo === 'editor' ? startScene(this, 'editor', {}) : startScene(this, 'preview', { result })));
      return;
    }
    // The piece loops (ft_1_12.AC3): the pass is saved (XP as before; ft_1_13 moves it to the piece), its score shows past
    // the last bar, and the piece starts again at bar 1. Back while the score shows ends the session (`leave`).
    this.session = recordFreePlayRound(this.session, result);
    this.lastResult = result;
    // A failed save still reports `saved: false`; a rejection is a bug, and the loop goes on.
    const saved = contextOf(this).profiles.completePiece(result, { mode: this.transport ? 'tempo' : 'wait', tempoPercent: this.percent })
      .catch((error: unknown) => { console.error('completePiece failed', error); return undefined; });
    this.pendingPass = saved;
    this.playSession.showPassScore(passStarsFor(result.accuracy));
    const passSummary = passLines(result).map((line) => t(line.key, line.params)).join('   ');
    this.playSession.say(passSummary);
    this.loopTimer = this.time.delayedCall(PASS_SCORE_MS, () => {
      this.loopTimer = null;
      void saved.then((outcome) => {
        // Back may have been pressed meanwhile: `leave` has taken this pass then
        if (this.pendingPass !== saved || !this.scene.isActive()) return;
        this.pendingPass = null;
        // the check-up is one pass: once its bars are kept, the teacher hears it in the room
        const checkup = this.checkup;
        if (checkup) {
          void this.barsSaved.then(() => { if (this.scene.isActive()) startScene(this, 'profile', { checkup: { piece: this.fullChart.id, since: checkup.since } }); });
          return;
        }
        this.scene.restart({ ...this.startData, ...this.carry(), passes: outcome ? [...this.passes, outcome] : this.passes, lap, lastResult: result, passSummary });
      });
    });
  }

  /**
   * Key bashing (ft_1_15): the piece pauses and Kiur points at the door (`KiurDoorScene`). The keys of the bash were never
   * judged (`KeyBashGuard`), and nothing earned is touched. Not while the game plays the piece or a pass is ending.
   */
  private onBash(): void {
    if (this.leaving || this.listening || this.atDoor) return;
    this.atDoor = true;
    this.guarded.setMuted(true);
    this.stopMetronome();
    this.playSession.say('');
    // the keys judged before the bash could be told from playing leave no mark on the staff
    this.playSession.staffView?.setPlayed(null);
    void openOverlay(this, 'kiurDoor').then((choice) => this.fromDoor(choice));
  }

  /**
   * The circle of fifths over the piece (ft_1_28 rule 1), the piece's key marked: the piece pauses as at Kiur's door and goes
   * on the same way when the circle closes (Wait mode where the cursor was, Tempo mode from the start of the pass). Not while
   * the game plays the piece or a pass is ending.
   */
  private openCircle(): void {
    if (this.leaving || this.listening || this.atDoor) return;
    this.atDoor = true;
    this.guarded.setMuted(true);
    this.stopMetronome();
    const { fifths, mode } = this.chart.keyMap[0]!;
    void openOverlay(this, 'circle', { key: { fifths, mode } }).then(() => this.fromDoor('back'));
  }

  /**
   * The student's choice at the door. Back (or Esc): Wait mode goes on where the cursor was, with the click if it was on;
   * Tempo mode starts the pass again, as its clock ran on (AX-3 provisional: a Tempo clock cannot pause). The door: out to
   * the room, once the pass being saved is saved; a draft preview goes back where it came from.
   */
  private fromDoor(choice: OverlayOutcome<'kiurDoor'>): void {
    this.atDoor = false;
    // the screen may still be resuming here (Phaser runs the resume on its next step), so only a leave stops this
    if (this.leaving) return;
    if (choice === 'door') {
      // a draft preview goes back where it came from, a character's teaching to its scene
      if (this.preview || this.startData.teacher) {
        this.leave();
        return;
      }
      this.leaving = true;
      void (this.pendingPass ?? Promise.resolve(undefined)).then(() => startScene(this, 'profile'));
      return;
    }
    this.guarded.setMuted(false);
    if (this.transport) {
      this.scene.restart({ ...this.startData, ...this.carry() });
      return;
    }
    const plan = metronomeAtCreate('wait', this.clickOn, this.chart, this.percent, this.clickOffset);
    if (plan) {
      contextOf(this).audio.metronome.start(plan);
      this.metronomeOn = true;
    }
  }

  /** What Kiur says in the bubble; an empty message hides the bubble. */
  private say(text: string, forMs = 0): void {
    this.playSession.say(text, forMs);
  }

  protected draw(): void {
    if (this.bandShown) return this.drawOverBand();
    const { width, scale } = this.px;
    const rows = this.mainRows; // whole art pixel rows that fit on the screen
    this.sky();

    // the staff, at screen resolution, between the two bars, as the player likes it (one line at a time by default)
    const staffTop = this.mainTop + (TOP_BAR + this.toolRows) * scale;
    const paneRows = this.paneShown ? STATS_PANE : 0;
    this.paneData = null;
    this.liveLabels = null;
    const staffHeight = Math.max(1, (rows - TOP_BAR - this.toolRows - BOTTOM_BAR - paneRows) * scale);
    // A section is drawn at the size of the whole piece, and marking one keeps the player's own view, page by page: the
    // clef and the notes never change size when a section is chosen.
    this.staffOrigin = staffTop;
    const staffView = this.playSession.drawStaff({ top: staffTop, width: this.scale.width, height: staffHeight }, contextOf(this).profiles);
    staffView.setMarkers(this.markers);
    const layout = this.playSession.layout!;
    if (this.picking !== null) staffView.showPage(this.pickPage, false);
    if (this.listening) {
      // the lit notes, not the Tempo playhead, turn the pages while the game plays the piece; a new staff lights them again
      staffView.followPlayhead(false);
      this.listenAlong?.relight();
    }
    this.markSection();
    // the bars cover the sky and keep the staff's paper from running into them
    this.topBar(() => this.leave());
    const barTools = new PixelImage(this, 0, TOP_BAR, panelBitmap(Math.max(5, width), this.toolRows, 'panel'));
    const barBottom = new PixelImage(this, 0, rows - BOTTOM_BAR - paneRows, panelBitmap(Math.max(5, width), BOTTOM_BAR, 'panel'));
    this.root.add([barTools, barBottom]);

    // top bar: the title; Back and the two hint switches are on the toolbar (d088)
    // one line: a section's longer title gives way to the piece's own, then is cut short, rather than run out of the bar
    const titleRoom = width - BAR_EDGE - TITLE_X;
    this.topBarTitle(fitLine([pieceTitle(this.chart), pieceTitle(this.fullChart)], titleRoom));

    this.drawTools();
    if (this.rampShown) this.drawRamp();

    // bottom bar: Kiur, what it says, and the piano; while a section is being marked, the page buttons at its right end
    const barY = rows - BOTTOM_BAR - paneRows;
    this.mascot = this.own(new Mascot(this, this.root, MASCOT_X, barY + MASCOT_DROP));
    this.playSession.setMascot(this.mascot);
    const paging = this.picking !== null && layout.pageCount > 1;
    const pageButtonY = barY + BUBBLE_DROP + (BAR_BUTTON_HEIGHT / 2);
    const nextRight = width - BOTTOM_EDGE;
    const previousRight = nextRight - PAGE_BUTTON_WIDTH - BAR_GAP;
    if (paging) {
      const page = staffView.currentPage;
      this.button({ x: nextRight - PAGE_BUTTON_WIDTH / 2, y: pageButtonY, width: PAGE_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label: t('practice.pageNext'), disabled: page >= layout.pageCount - 1, onClick: () => this.turnPickPage(1) });
      this.button({ x: previousRight - PAGE_BUTTON_WIDTH / 2, y: pageButtonY, width: PAGE_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label: t('practice.pagePrevious'), disabled: page <= 0, onClick: () => this.turnPickPage(-1) });
    }
    // the bubble ends at the edge, or a gap of 4 short of the page buttons
    const bubbleRight = paging ? previousRight - PAGE_BUTTON_WIDTH - 4 : nextRight;
    const bubbleWidth = bubbleRight - BUBBLE_X;
    // the bubble is as tall as its text (one line or two); the piano status below it needs room, so it shows only while the
    // bubble is one line or empty
    const statusText = new PixelText(this, BUBBLE_X, barY + BOTTOM_BAR - STATUS_RISE, this.pianoStatus(), { color: C.dim, maxWidth: bubbleWidth });
    this.statusText = statusText;
    this.playSession.drawBubble(this.root, { x: BUBBLE_X, y: barY + BUBBLE_DROP, width: bubbleWidth }, (lines) => statusText.setVisible(lines <= 1));
    this.root.add(statusText);
    if (paneRows > 0) this.drawStatsPane(rows - paneRows, paneRows);
  }

  /**
   * The practice screen over the band (ft_1_20.AC8): no bars of its own, and what was in them is in the band's cells and
   * slots (`bandActions`, `bandItems`). The staff gets every row under the strip of the door and the gear (less the stats
   * pane while it is on). In that strip, between the door and the gear, stand Kiur and his bubble, and the page buttons of a
   * section being marked; the tempo ramp opens as a panel along the staff's foot. The piece's title is not shown (the
   * clean-screen rule). AX-3 provisional: Kiur in the corners' strip, so nothing of his covers a note (AX-0).
   */
  private drawOverBand(): void {
    const { width, scale } = this.px;
    const rows = this.mainRows;
    this.sky();
    const paneRows = this.paneShown ? STATS_PANE : 0;
    this.paneData = null;
    this.liveLabels = null;
    const foot = rows - paneRows;
    const strip = this.cornerStrip;
    this.staffOrigin = this.mainTop + strip.rows * scale;
    const staffView = this.playSession.drawStaff({ top: this.staffOrigin, width: this.scale.width, height: Math.max(1, (foot - strip.rows) * scale) }, contextOf(this).profiles);
    staffView.setMarkers(this.markers);
    const layout = this.playSession.layout!;
    if (this.picking !== null) staffView.showPage(this.pickPage, false);
    if (this.listening) {
      staffView.followPlayhead(false);
      this.listenAlong?.relight();
    }
    this.markSection();
    this.backWith(() => this.leave());

    const layer = this.overStaff();
    const make = (options: PixelButtonOptions) => this.buttonOn(layer, options);
    if (this.rampShown && this.rampOpen) {
      layer.add(new PixelImage(this, 0, foot - RAMP_BAR, panelBitmap(Math.max(5, width), RAMP_BAR, 'panel')));
      this.drawRamp(foot - RAMP_BAR / 2 - 1, make);
    }
    const mascotX = strip.left + 2;
    this.mascot = this.own(new Mascot(this, layer, mascotX, BAND_STRIP_DROP));
    this.playSession.setMascot(this.mascot);
    const paging = this.picking !== null && layout.pageCount > 1;
    const pageY = strip.rows / 2;
    const nextRight = strip.right - 2;
    const previousRight = nextRight - PAGE_BUTTON_WIDTH - BAR_GAP;
    if (paging) {
      const page = staffView.currentPage;
      make({ x: nextRight - PAGE_BUTTON_WIDTH / 2, y: pageY, width: PAGE_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label: t('practice.pageNext'), disabled: page >= layout.pageCount - 1, onClick: () => this.turnPickPage(1) });
      make({ x: previousRight - PAGE_BUTTON_WIDTH / 2, y: pageY, width: PAGE_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label: t('practice.pagePrevious'), disabled: page <= 0, onClick: () => this.turnPickPage(-1) });
    }
    const bubbleLeft = mascotX + MASCOT_SIZE.w + 2;
    let bubbleRight = paging ? previousRight - PAGE_BUTTON_WIDTH - 4 : nextRight;
    if (this.learn) {
      // the reward notes at the strip's right end, the bubble short of them (ft_1_32.AC4)
      const room = Math.floor((nextRight - bubbleLeft) / 3);
      const row = rewardNotes(this.learn.rewards(), room);
      const x = nextRight - row.width;
      this.drawRewards(x, Math.max(0, Math.floor((strip.rows - REWARD_ROWS) / 2)), room, layer);
      bubbleRight = x - 4;
    }
    this.playSession.drawBubble(layer, { x: bubbleLeft, y: BAND_STRIP_DROP + 1, width: bubbleRight - bubbleLeft });
    if (paneRows > 0) this.drawStatsPane(foot, paneRows);
  }

  /**
   * The strip along the foot (ft_1_20, d282): Listen or Stop, Start again, the mode (a menu of the four ways to play, and
   * the auto restart in Tempo mode), slower, the tempo, faster; More (drawn by the frame) opens the bubble. The tempo cell
   * shows the percent (its BPM in the tooltip) and a press puts it back to 100. Each cell's word is its label (read by tests).
   */
  protected override stripActions(): ToolbarItem[] {
    // the check-up is the piece as written: only starting over is left
    const restart: ToolbarItem = { label: t('practice.restart'), icon: TOOL_ICONS.repeat, tooltip: hotkeyLabel(t('practice.restart'), 'reset'), onClick: () => this.resetPlay() };
    if (this.checkup) return [restart];
    // the intro's lesson and learning (ft_1_31.AC3, ft_1_32): Listen and Start over, nothing that changes the play;
    // the intro's lesson also has its skip button, last
    if (this.intro) return [this.listenAction(), restart, { label: t('intro.skipShort'), tooltip: t('intro.skip'), onClick: () => this.skipIntro() }];
    if (this.learn) return [this.listenAction(), restart];
    const choice = playChoiceOf(contextOf(this).profiles.playSettings);
    const bpm = stripBpmLabel(this.chart.tempoMap[0]!.bpm, { tempoMode: this.transport !== null, percent: this.percent, clickOn: this.clickOn, offset: this.clickOffset });
    return [
      this.listenAction(),
      restart,
      {
        label: t(MODE_LABEL[choice]), icon: TOOL_ICONS[choice], tooltip: modeTooltip(choice), onClick: () => this.switchMode(),
        menu: { items: () => this.modeChoices(), cell: { w: 22, h: 22 }, columns: 5 },
      },
      { label: '-', tooltip: t('practice.slower'), disabled: this.percent <= TEMPO_PERCENT.min, onClick: () => this.setPercent(this.percent - TEMPO_PERCENT.step) },
      { label: t('practice.percent', { n: Math.round(this.percent) }), tooltip: bpm, keepCase: true, onClick: () => this.setPercent(100) },
      { label: '+', tooltip: t('practice.faster'), disabled: this.percent >= TEMPO_PERCENT.max, onClick: () => this.setPercent(this.percent + TEMPO_PERCENT.step) },
    ];
  }

  /** The mode cell's choices: the four ways to play in the order the button cycles them, and in Tempo mode the auto restart (core_01.AC11), lit while on. */
  private modeChoices(): MenuItem[] {
    const play = contextOf(this).profiles.playSettings;
    const now = playChoiceOf(play);
    const choices: MenuItem[] = PLAY_CHOICES.map((choice) => ({ label: t(MODE_LABEL[choice]), icon: TOOL_ICONS[choice], tooltip: modeTooltip(choice), active: choice === now, onPick: () => this.setMode(choice) }));
    if (play.mode === 'tempo') choices.push({ label: t('practice.autoReset'), icon: TOOL_ICONS.autoReset, active: play.autoReset === true, onPick: () => this.toggleAutoReset() });
    return choices;
  }

  /**
   * The bubble (ft_1_20, d282), the same wherever it opens on this screen, each option in its fixed slot: 0 the section (or
   * the whole piece again), 1 the tempo ramp (a section only), 2 the click, 3 the circle of fifths, 4 the latest plays, 5
   * Analyse, 6 note names and 7 fingers (worn: lit while on, and the bubble stays open). The check-up, the intro and
   * learning keep only the worn hints.
   */
  protected override bubbleOptions(): (ToolbarItem | null)[] | null {
    const worn: (ToolbarItem | null)[] = [
      { label: t('ui.hint.names'), icon: TOOL_ICONS[this.hints.noteNames ? 'noteNamesOn' : 'noteNames'], active: this.hints.noteNames, worn: true, shortcut: HOTKEYS.noteNames.letter, tooltip: hotkeyLabel(t('ui.hint.names'), 'noteNames'), onClick: () => this.toggle('noteNames') },
      { label: t('ui.hint.fingers'), icon: TOOL_ICONS.fingers, active: this.hints.fingers, worn: true, shortcut: HOTKEYS.fingers.letter, tooltip: hotkeyLabel(t('ui.hint.fingers'), 'fingers'), onClick: () => this.toggle('fingers') },
    ];
    if (this.locked) return [null, null, null, null, null, null, ...worn];
    const section = this.startData.section;
    const sectionName = t(section ? 'practice.whole' : 'practice.section');
    return [
      { label: sectionName, icon: TOOL_ICONS.section, tooltip: hotkeyLabel(sectionName, 'section'), active: this.picking !== null || section !== undefined, onClick: () => (section ? this.backToWhole() : this.startPicking()) },
      this.rampShown ? { label: t('practice.ramp'), icon: TOOL_ICONS.steps, active: this.rampOpen, onClick: () => this.toggleRamp() } : null,
      { label: t('practice.click'), icon: TOOL_ICONS.click, active: this.clickOn, tooltip: hotkeyLabel(t('practice.click'), 'click'), onClick: () => this.toggleClick() },
      { ...circleItem(() => this.openCircle()), disabled: this.listening },
      this.preview ? null : { label: t('practice.statsPane'), icon: TOOL_ICONS.statsPane, active: this.paneShown, onClick: () => this.toggleStatsPane() },
      // the analysis of the whole piece: where it is tricky and what to practise (core_10)
      this.preview ? null : { label: t('analyze.button'), icon: TOOL_ICONS.analyse, onClick: () => this.openAnalysis() },
      ...worn,
    ];
  }

  /** The piano's status as a picture left of the gear: lit while a piano is connected, its name or what to do without one in the tooltip. */
  protected override cornerStatus(): { label: string; icon: Bitmap; lit: boolean } {
    return { label: this.pianoStatus(), icon: ICONS.freePlay, lit: contextOf(this).midi?.getStatus().state === 'connected' };
  }

  /** Kuula in the band: listen to the piece (or the bars shown), or stop the game playing it. */
  private listenAction(): ToolbarItem {
    return {
      label: t(this.listening ? 'practice.listenStop' : 'practice.listen'), icon: this.listening ? TOOL_ICONS.stop : ICONS.ear, active: this.listening,
      onClick: () => this.listen(!this.listening),
    };
  }

  /** The tempo ramp's panel over the staff's foot (with the band): opened and closed by its item, or closed by Esc. */
  private toggleRamp(): void {
    this.rampOpen = !this.rampOpen;
    this.redraw();
  }

  /** Whether the stats pane is on (not in a draft preview, which has no history). */
  private get paneShown(): boolean {
    return !this.preview && this.registry.get(STATS_PANE_KEY) === true;
  }

  /**
   * The stats pane (ft_1_12.AC5): the latest full plays of the piece as bars (`statsPane`), the star lines, the trend and
   * the newest play's percent, and each play's wrong keys over its bar; pictures and numbers, not words. It is drawn again after every pass, so the new bar appears at once.
   */
  private drawStatsPane(top: number, height: number): void {
    const { width } = this.px;
    this.root.add(new PixelImage(this, 0, top, panelBitmap(Math.max(5, width), height, 'panel')));
    const plotWidth = Math.min(width - 60, 200);
    // the plot starts low enough that the wrong key count over a full bar stays inside the panel
    const plotX = Math.floor((width - plotWidth) / 2);
    const plot = { x: plotX, y: top + 3 + STATS_PANE_COUNT_HEIGHT, w: plotWidth, h: height - 5 - 3 - STATS_PANE_COUNT_HEIGHT };
    this.paneData = statsPane(contextOf(this).profiles.historyFor(this.fullChart.id), plot);
    const box = createBitmap(plot.w, plot.h + 1);
    const set = (x: number, y: number, color: number) => {
      const bx = x - plot.x;
      const by = y - plot.y;
      if (bx >= 0 && by >= 0 && bx < box.width && by < box.height) box.pixels[by * box.width + bx] = color;
    };
    for (const guide of this.paneData.guides) for (let x = plot.x; x < plot.x + plot.w; x += 2) set(x, guide.y, C.lock);
    for (const bar of this.paneData.bars) {
      const grade = passStarsFor(bar.accuracy);
      const colour = grade >= 4 ? C.gold : grade >= 2 ? C.cream : C.dim;
      for (let y = bar.y; y < bar.y + bar.h; y++) for (let x = bar.x; x < bar.x + bar.w; x++) set(x, y, bar.latest && (x === bar.x || x === bar.x + bar.w - 1 || y === bar.y) ? C.white : colour);
    }
    const trend = this.paneData.trend;
    if (trend) {
      const steps = Math.max(1, Math.abs(trend.x2 - trend.x1));
      for (let k = 0; k <= steps; k += 1) if (k % 4 < 2) set(Math.round(trend.x1 + ((trend.x2 - trend.x1) * k) / steps), Math.round(trend.y1 + ((trend.y2 - trend.y1) * k) / steps), C.green);
    }
    this.root.add(new PixelImage(this, plot.x, plot.y, box));
    // each play's wrong keys as a bare number over its bar: how many wrong keys were pressed
    for (const bar of this.paneData.bars) this.label(0, bar.count.y, String(bar.mistakes), bar.mistakes > 0 ? C.redLight : C.green).centerAt(bar.count.x);
    const latest = this.paneData.bars.at(-1);
    if (latest) {
      const text = t('practice.paneLatest', { percent: Math.round(latest.accuracy * 100) });
      this.label(latest.x + latest.w + 3, Math.max(top + 2, latest.y - 3), text, C.white);
    }
  }

  /** What a restart between learning runs carries: Kiur's line, said instead of any other words, and the wrong key. */
  private takeLearnCarry(data: PracticeData): void {
    this.afterLearnRun = data.learnLine !== undefined;
    this.carriedWrong = data.learnWrong ?? null;
    delete this.startData.learnLine;
    delete this.startData.learnWrong;
  }

  /** What a learning run adds to the play session: the resting hand's staff (AC18) and the wrong key that ended the run before (AC6). */
  private restingOption(): { restingTracks?: string[]; wrongKey?: WrongKey } {
    const resting = this.learn?.restingTracks ?? [];
    // only on the same bars: the indices of the awaited notes are of the run that ended
    const wrong = this.carriedWrong;
    const same = wrong && this.learn && this.learn.run.firstBar === wrong.firstBar && this.learn.run.lastBar === wrong.lastBar;
    return { ...(resting.length > 0 ? { restingTracks: resting } : {}), ...(same ? { wrongKey: wrong.key } : {}) };
  }

  /**
   * The learning run's live tempo in the strip at the foot (ft_1_32.AC17), when the player turned it on: the pace on the
   * first line, the spread and the wobble on the second, small and dim, at the right end of the strip's free stretch, out
   * of the student's way. Nothing when the stretch is too narrow for it.
   */
  protected override afterFrame(free: { left: number; right: number; top: number; rows: number } | null): void {
    this.liveLabels = null;
    if (!free || !this.learn || !learnLiveTempo(contextOf(this).profiles.learnSettings)) return;
    // at half size, on the fine pixels (d110): as wide as its widest second line, so changing numbers never move it
    const widest = `${t('practice.liveSpread', { value: '100%' })} ${t('practice.liveWobble', { value: '100%' })}`;
    const left = free.right - 3 - Math.ceil(measure(drawnText(widest)) / 2);
    if (left < free.left + 3) return;
    const top = free.top + Math.max(1, Math.floor((free.rows - 2 * LIVE_TEMPO_LINE) / 2));
    this.liveLabels = [0, 1].map((line) => this.label(left, top + line * LIVE_TEMPO_LINE, '', C.dim).setScale(0.5));
    this.showLiveTempo();
  }

  /**
   * The learning run measured while it is played (ft_1_32.AC17): the pace, the spread and the wobble of the notes so far,
   * as the learning stats screen names them; a dash before three notes are played.
   */
  private showLiveTempo(): void {
    const labels = this.liveLabels;
    if (!labels || !this.learn) return;
    const live = this.learn.liveTempo;
    const percent = (share: number): string => (live ? `${Math.round(share * 100)}%` : '-');
    labels[0]!.setText(t('practice.liveBpm', { bpm: live ? String(live.bpm) : '-' }));
    labels[1]!.setText(`${t('practice.liveSpread', { value: percent(live?.spread ?? 0) })} ${t('practice.liveWobble', { value: percent(live?.robust ?? 0) })}`);
  }

  /**
   * The two hint switches on the toolbar (d088): a hand with numbered fingers, and a note that shows its name once names are
   * on. Names first, so they keep the order they had in the top bar.
   */
  protected override toolbarItems(): ToolbarItem[] {
    return [
      // Kuula: an ear, a square while the game plays the piece
      {
        label: t(this.listening ? 'practice.listenStop' : 'practice.listen'), icon: this.listening ? TOOL_ICONS.stop : ICONS.ear, iconOnly: true, active: this.listening,
        onClick: () => this.listen(!this.listening),
      },
      ...(this.preview ? [] : [{
        label: t('practice.statsPane'), icon: TOOL_ICONS.statsPane, iconOnly: true, active: this.paneShown, onClick: () => this.toggleStatsPane(),
      }]),
      {
        label: t('ui.hint.names'), icon: TOOL_ICONS[this.hints.noteNames ? 'noteNamesOn' : 'noteNames'], iconOnly: true, active: this.hints.noteNames,
        tooltip: hotkeyLabel(t('ui.hint.names'), 'noteNames'), onClick: () => this.toggle('noteNames'),
      },
      {
        label: t('ui.hint.fingers'), icon: TOOL_ICONS.fingers, iconOnly: true, active: this.hints.fingers,
        tooltip: hotkeyLabel(t('ui.hint.fingers'), 'fingers'), onClick: () => this.toggle('fingers'),
      },
      { ...circleItem(() => this.openCircle()), disabled: this.listening },
    ];
  }

  /**
   * The stats pane in place of the on-screen keyboard (ft_1_12.AC5): turning it on hides the keyboard. Kept for the session
   * in the game's registry, not saved (no save-format bump).
   */
  private toggleStatsPane(): void {
    const on = !this.paneShown;
    this.registry.set(STATS_PANE_KEY, on);
    const keys = contextOf(this).keyboardSwitch;
    if (on && keys.shown()) keys.toggle();
    this.redraw();
  }

  /** The ramp strip is there while a section is played (not while one is being marked). */
  private get rampShown(): boolean {
    return this.startData.section !== undefined && this.picking === null;
  }

  /** Art rows of the tools strip, with the ramp strip under it while it is shown. */
  private get toolRows(): number {
    return TOOLS_BAR + (this.rampShown ? RAMP_BAR : 0);
  }

  /**
   * The tempo ramp of a section (core_03.AC5), one cycling button per value: the step and its unit, the laps per step,
   * Clean (lit: only a clean lap steps up) and the target and its unit. A unit button switches BPM and %. A change
   * applies from the next lap and does not start the lap over. The mouse wheel over a value turns it by one.
   * AX-3 provisional: the ramp sits on a second strip under the tools, which shows only while a section is played.
   */
  private drawRamp(y = TOP_BAR + TOOLS_BAR + RAMP_BAR / 2 - 1, make: (options: PixelButtonOptions) => PixelButton = (options) => this.button(options)): void {
    const h = BAR_BUTTON_HEIGHT;
    const ramp = this.startData.ramp ?? DEFAULT_RAMP;
    const base = this.chart.tempoMap[0]!.bpm;
    let x = BAR_EDGE;
    this.rampWheel = [];
    const add = (label: string, tooltip: string, onClick: () => void, active?: boolean, wheel?: 'step' | 'every' | 'target') => {
      const w = Math.max(STEP_WIDTH, measure(drawnText(label)) + 10);
      const button = make({ x: x + w / 2, y, width: w, height: h, label, tooltip, onClick });
      if (active !== undefined) button.setActive(active);
      if (wheel) this.rampWheel.push({ button, scroll: (direction) => set(scrollRamp(ramp, wheel, direction, base)) });
      x += w + BAR_GAP;
    };
    const unit = (u: TempoRamp['stepUnit']) => t(u === 'bpm' ? 'practice.unitBpm' : 'practice.unitPercent');
    const set = (next: TempoRamp) => {
      this.startData = { ...this.startData, ramp: next };
      this.redraw();
    };
    add(t('practice.rampStep', { n: ramp.step }), t('practice.rampStepHint'), () => set({ ...ramp, step: nextChoice(RAMP_CHOICES.step[ramp.stepUnit], ramp.step) }), ramp.step > 0, 'step');
    add(unit(ramp.stepUnit), t('practice.unitHint'), () => set(toggleUnit(ramp, 'step', base)));
    add(t('practice.rampEvery', { n: ramp.every }), t('practice.rampEveryHint'), () => set({ ...ramp, every: nextChoice(RAMP_CHOICES.every, ramp.every) }), undefined, 'every');
    add(t('practice.rampClean'), t('practice.rampCleanHint'), () => set({ ...ramp, onlyClean: !ramp.onlyClean }), ramp.onlyClean);
    add(t('practice.rampTarget', { n: ramp.target }), t('practice.rampTargetHint'), () => set({ ...ramp, target: nextTarget(ramp, base) }), undefined, 'target');
    add(unit(ramp.targetUnit), t('practice.unitHint'), () => set(toggleUnit(ramp, 'target', base)));
  }

  /**
   * The notes earned in learning the piece (ft_1_32.AC4), one row from (x, y) at most `maxWidth` wide; returns its width.
   * AX-3 provisional: in the tools strip, or with the band at the right end of Kiur's strip.
   */
  private drawRewards(x: number, y: number, maxWidth: number, layer?: Phaser.GameObjects.Container): number {
    const rewards = this.learn!.rewards();
    this.rewardsData = rewards;
    const row = rewardNotes(rewards, maxWidth);
    const image = new PixelImage(this, x, y, row);
    (layer ?? this.root).add(image);
    return row.width;
  }

  /** Leave for the Analyze screen of this piece; the metronome and the loop timer stop first. */
  private openAnalysis(): void {
    this.stopMetronome();
    this.loopTimer?.remove();
    startScene(this, 'analyze', { chartId: this.fullChart.id });
  }

  /** The strip under the top bar: the metronome click, the tempo percent, and marking a section to practise. */
  private drawTools(): void {
    if (this.asWritten) return;
    if (this.learn) {
      this.drawRewards(BAR_EDGE, TOP_BAR + Math.floor((TOOLS_BAR - REWARD_ROWS) / 2), this.px.width - 2 * BAR_EDGE);
      return;
    }
    const y = TOP_BAR + TOOLS_BAR / 2;
    const h = BAR_BUTTON_HEIGHT;
    let x = BAR_EDGE;
    const place = (w: number) => {
      const centre = x + w / 2;
      x += w + BAR_GAP;
      return centre;
    };
    const bpmText = stripBpmLabel(this.chart.tempoMap[0]!.bpm, { tempoMode: this.transport !== null, percent: this.percent, clickOn: this.clickOn, offset: this.clickOffset });
    // Pictures, not words: each button's name and key are its label (read by tests) and its tooltip.
    // Wait (a fermata) or Tempo (a running note); a press switches and starts the piece over in the other mode
    // a third press starts Tempo mode on the first note with no count-in (core_01.AC10)
    const play = contextOf(this).profiles.playSettings;
    const choice = playChoiceOf(play);
    this.button({
      x: place(ICON_WIDTH), y, width: ICON_WIDTH, height: h, label: t(MODE_LABEL[choice]), icon: TOOL_ICONS[choice], iconOnly: true, tooltip: modeTooltip(choice),
      onClick: () => this.switchMode(),
    });
    // the metronome, lit while it clicks
    const clickLabel = hotkeyLabel(t('practice.click'), 'click');
    this.button({ x: place(ICON_WIDTH), y, width: ICON_WIDTH, height: h, label: t('practice.click'), icon: TOOL_ICONS.click, iconOnly: true, tooltip: clickLabel, onClick: () => this.toggleClick() }).setActive(this.clickOn);
    // Tempo mode: start over after two bars with nothing played right, lit while on (core_01.AC11)
    if (this.transport) {
      this.button({ x: place(ICON_WIDTH), y, width: ICON_WIDTH, height: h, label: t('practice.autoReset'), icon: TOOL_ICONS.autoReset, iconOnly: true, tooltip: t('practice.autoReset'), onClick: () => this.toggleAutoReset() })
        .setActive(play.autoReset === true);
    }
    this.button({ x: place(STEP_WIDTH), y, width: STEP_WIDTH, height: h, label: '-', disabled: this.percent <= TEMPO_PERCENT.min, onClick: () => this.setPercent(this.percent - TEMPO_PERCENT.step) });
    const percent = new PixelText(this, x, y - TEXT_RISE, t('practice.percent', { n: Math.round(this.percent) }), { color: C.white, shadow: C.groove });
    this.root.add(percent);
    x += PERCENT_WIDTH + BAR_GAP;
    this.button({ x: place(STEP_WIDTH), y, width: STEP_WIDTH, height: h, label: '+', disabled: this.percent >= TEMPO_PERCENT.max, onClick: () => this.setPercent(this.percent + TEMPO_PERCENT.step) });
    x += BPM_PAD;
    // the piece's own BPM, in Wait mode too; in Tempo mode the effective BPM follows the percent
    const bpm = new PixelText(this, x, y - TEXT_RISE, bpmText, { color: C.white, shadow: C.groove });
    this.root.add(bpm);
    x += bpm.width + BPM_PAD;
    // A | -> | B: lit while a section is being marked or played; a press then goes back to the whole piece
    const section = this.startData.section;
    const sectionName = t(section ? 'practice.whole' : 'practice.section');
    this.button({
      x: place(SECTION_WIDTH), y, width: SECTION_WIDTH, height: h, label: sectionName, icon: TOOL_ICONS.section, iconOnly: true, tooltip: hotkeyLabel(sectionName, 'section'),
      onClick: () => (section ? this.backToWhole() : this.startPicking()),
    }).setActive(this.picking !== null || section !== undefined);
    if (!this.preview) {
      // the analysis of the whole piece: where it is tricky and what to practise (core_10)
      const analyze = analyzeWidth();
      this.button({ x: this.px.width - BAR_EDGE - analyze / 2, y, width: analyze, height: h, label: t('analyze.button'), onClick: () => this.openAnalysis() });
    }
  }

  /**
   * Wait or Tempo, saved for the player like the other play settings, starts the piece over from the top in the new mode. The
   * click starts as that mode's default (on in Tempo, off in Wait), not as it was.
   */
  private switchMode(): void {
    this.setMode(PLAY_CHOICES[(PLAY_CHOICES.indexOf(playChoiceOf(contextOf(this).profiles.playSettings)) + 1) % PLAY_CHOICES.length]!);
  }

  /** Play from now on in `choice` (a pick in the mode menu, or the next one on a press of the cell or its key). */
  private setMode(choice: PlayChoice): void {
    if (this.locked) return; // the check-up, the intro and learning play as given (ft_1_27.AC2, ft_1_31.AC3, ft_1_32)
    const profiles = contextOf(this).profiles;
    if (playChoiceOf(profiles.playSettings) === choice) return;
    this.stopMetronome();
    this.loopTimer?.remove();
    void profiles.updatePlaySettings(choiceSettings(choice)).then(() => {
      this.scene.restart({ ...this.startData, ...this.carry(), click: undefined, clickOffset: 0, lap: 0 });
    });
  }

  private toggleClick(): void {
    if (followsPlayer(this.playSettings())) {
      this.say(t('practice.clickFollow'), MESSAGE_MS); // core_01.AC13
      return;
    }
    this.clickOn = !this.clickOn;
    const context = contextOf(this);
    const metronome = context.audio.metronome;
    if (!this.clickOn) {
      this.stopMetronome();
    } else if (this.transport) {
      // Tempo mode: join the beat grid of the count-in on its next beat (the update loop starts it before the first key only after the start)
      const plan = this.transport.metronomeFrom(context.audio.clock.nowMs());
      if (plan) {
        metronome.start(plan);
        this.metronomeOn = true;
      }
    } else {
      metronome.start(clickPlan(this.chart, this.percent, this.clickOffset));
      this.metronomeOn = true;
    }
    this.redraw();
  }

  private setPercent(percent: number): void {
    if (this.locked) return; // the check-up, the intro and learning play as given (ft_1_27.AC2, ft_1_31.AC3, ft_1_32)
    this.stopMetronome();
    // a new tempo percent starts the click speed afresh
    this.scene.restart({ ...this.startData, percent: clampTempoPercent(percent), ...this.carry(), clickOffset: 0 });
  }

  /** Shift+= / Shift+-: the click 5 BPM faster or slower. Wait mode only; in Tempo mode the click is the pulse of the music. */
  private stepClick(direction: 1 | -1): void {
    if (this.transport) {
      this.say(t('practice.clickTempoMode'), MESSAGE_MS);
      return;
    }
    const pieceBpm = this.chart.tempoMap[0]!.bpm;
    this.clickOffset = stepClickOffset(this.clickOffset, direction, pieceBpm, this.percent);
    const bpm = clickBpm(pieceBpm, this.percent, this.clickOffset);
    if (this.metronomeOn) (contextOf(this)).audio.metronome.setBpm(bpm);
    this.say(t('practice.clickSpeed', { n: bpm }), MESSAGE_MS);
    this.redraw();
  }

  /** A, and the soft background, on the first bar once it is tapped; A and B over the section being practised. */
  private markSection(): void {
    const staffView = this.playSession.staffView;
    if (!staffView) return;
    if (this.picking === 'last') {
      staffView.setSectionMarks({ tint: [this.firstPicked], letters: [{ bar: this.firstPicked, text: t('practice.markStart') }] });
    } else if (this.picking === null && this.startData.section?.from) {
      staffView.setSectionMarks({ tint: [], letters: [{ bar: 0, text: t('practice.markFrom') }] });
    } else if (this.picking === null && this.startData.section) {
      const last = this.chart.bars.length - 1;
      // A carries the tempo and the lap, so a rising ramp is seen where the section begins
      const start = t('practice.markStartInfo', { mark: t('practice.markStart'), bpm: this.bpmNow, n: (this.startData.lap ?? 0) + 1 });
      staffView.setSectionMarks({ tint: [], letters: [{ bar: 0, text: start }, { bar: last, text: t('practice.markEnd') }] });
    } else {
      staffView.setSectionMarks(null);
    }
  }

  /**
   * Turn the staff's page (the arrow keys, Page Up / Page Down, the wheel): while a section is being marked, the page to
   * mark on; otherwise a look at another page, and the next key judged turns back to the lit notes.
   * AX-3 provisional: a look only, the play goes on where it was; a tap on a bar of that page starts the play there (`startFrom`).
   */
  private turnPage(step: number): void {
    if (this.picking !== null) {
      this.turnPickPage(step);
      return;
    }
    const { layout, staffView } = this.playSession;
    if (layout && staffView) staffView.showPage(staffView.currentPage + step);
  }

  /** Turn the page while a section is being marked (the page buttons, or the arrow keys). */
  private turnPickPage(step: number): void {
    const layout = this.playSession.layout;
    if (this.picking === null || !layout) return;
    const page = Math.max(0, Math.min(layout.pageCount - 1, this.pickPage + step));
    if (page === this.pickPage) return;
    this.pickPage = page;
    this.redraw();
  }

  private startPicking(): void {
    if (this.locked) return; // the check-up, the intro and learning play as given (ft_1_27.AC2, ft_1_31.AC3, ft_1_32)
    this.pickPage = this.playSession.staffView?.currentPage ?? 0;
    this.picking = 'first';
    this.chord = { phase: 'first', digits: '' };
    this.say(t('practice.pickStart'));
    this.redraw();
  }

  private cancelPicking(): void {
    this.picking = null;
    this.chord = IDLE;
    this.chordTimer?.remove();
    this.say('');
    this.redraw();
  }

  /** A tap on the staff: while marking a section the first, then the last bar (then the scene starts over on that part); otherwise the play starts from the bar. */
  private onTap(pointer: Phaser.Input.Pointer): void {
    if (this.learnedGoOn) {
      this.learnedGoOn();
      return;
    }
    const { layout, staffView } = this.playSession;
    // a press while the bubble or a menu is open is theirs: it never starts the play from a bar under them
    if (!layout || !staffView || this.isBubblePress(pointer) || this.menuOpen) return;
    // a press on a button over the staff (the page buttons, with the band) is the button's
    if (this.pointerOnButton(pointer)) return;
    const top = this.mainTop + (this.bandShown ? this.cornerStrip.rows : TOP_BAR + this.toolRows) * this.px.scale;
    const bar = barAtPoint(layout, pointer.x, pointer.y - top, staffView.currentPage);
    if (bar === null) return;
    if (this.picking === null) {
      this.startFrom(bar);
      return;
    }
    if (this.picking === 'first') {
      this.firstPicked = bar;
      this.picking = 'last';
      this.chord = { phase: 'last', first: bar, digits: '' };
      this.say(t('practice.pickEnd'));
      this.markSection();
      return;
    }
    this.startSection(Math.min(this.firstPicked, bar), Math.max(this.firstPicked, bar));
  }

  /**
   * A tap on a bar while the piece plays: the play starts over from that bar, marked with the start mark,
   * and loops from there to the end as a section does (no XP). A tap on the marked bar takes
   * the mark away; with no mark a tap on the first bar starts the piece over. Not in a section marked with A and B, while the game plays the piece, at the check-up, or
   * after a tap on bars that hold only rests.
   * AX-3 provisional: the mark lasts while the piece is open, and the Section button or R take it away too.
   */
  private startFrom(tapped: number): void {
    const section = this.startData.section;
    if (this.leaving || this.atDoor || this.listening || this.checkup || this.learn || (section && !section.from)) return;
    // a tap on the marked bar, or on the first bar of the piece, takes the mark away (the whole piece from bar 1)
    if (section && tapped === 0) {
      this.backToWhole();
      return;
    }
    // on a section's staff the bars are counted from its first bar
    const bar = tapped + (section?.first ?? 0);
    const last = this.fullChart.bars.length - 1;
    if (bar === 0) {
      this.resetPlay();
      return;
    }
    if (!sectionHasNotes(this.fullChart, bar, last)) return;
    this.stopMetronome();
    this.scene.restart({ ...this.startData, section: { first: bar, last, from: true }, lap: 0, sectionLog: undefined, rampLaps: 0, ...this.carry() });
  }

  private startSection(first: number, last: number): void {
    if (!sectionHasNotes(this.fullChart, first, last)) {
      // nothing to play there (rests only): the first bar stays, and the player picks another last bar
      this.picking = 'last';
      this.chord = { phase: 'last', first: this.firstPicked, digits: '' };
      this.say(t('practice.sectionEmpty'));
      this.markSection();
      return;
    }
    this.picking = null;
    this.chord = IDLE;
    this.stopMetronome();
    this.scene.restart({ ...this.startData, section: { first, last }, lap: 0, sectionLog: undefined, rampLaps: 0, ...this.carry() });
  }

  /** Leave the section for the whole piece; Kiur then says how the section went (laps, tempo from and to, clean laps). */
  private backToWhole(): void {
    this.stopMetronome();
    const log = this.startData.sectionLog;
    const summary = log && log.laps > 0 ? t('practice.sectionLog', { laps: log.laps, from: log.fromBpm, to: this.bpmNow, clean: log.clean }) : undefined;
    this.scene.restart({ ...this.startData, section: undefined, lap: 0, sectionLog: undefined, sectionSummary: summary, ...this.carry() });
  }

  /**
   * The space bar (ft_1_12.AC8): the piece, or the section being practised, starts over from its first
   * bar; the click and the count-in start again (Tempo mode counts in at once). The keys judged so far stay in the
   * session's numbers; the unfinished pass earns nothing and is not scored. A section keeps its lap and its tempo ramp.
   */
  private resetPlay(): void {
    if (this.leaving) return;
    this.stopMetronome();
    // Kuula starts over from its first note, play from its first bar
    this.scene.restart({ ...this.startData, ...this.carry(), reset: true, listen: this.listening });
  }

  /**
   * The auto reset (core_01.AC11): two bars in a row with nothing played right start the play over as the
   * space bar does, but the start is waited for again (any key for the count-in, or the first note). Not while the game plays
   * the piece, a pass is ending or Kiur is at the door.
   */
  private watchMissedBars(events: readonly JudgeEvent[]): void {
    if (!this.missedBars?.push(events) || this.leaving || this.listening || this.atDoor) return;
    this.leaving = true; // the same batch may finish the piece: that pass is not scored
    this.stopMetronome();
    this.loopTimer?.remove();
    this.scene.restart({ ...this.startData, ...this.carry(), reset: true, waitForStart: true });
  }

  /** The Tempo-mode switch "start over after 2 missed bars", saved for the player (core_01.AC11); no restart needed. */
  private toggleAutoReset(): void {
    const on = contextOf(this).profiles.playSettings.autoReset !== true;
    this.missedBars = on && this.transport ? new MissedBars() : null;
    void contextOf(this).profiles.updatePlaySettings({ autoReset: on }).then(() => this.redraw());
  }

  /** The tempo now, in BPM: the piece's first tempo at the tempo percent. */
  private get bpmNow(): number {
    return Math.round((this.fullChart.tempoMap[0]!.bpm * this.percent) / 100);
  }

  /** A hotkey of the practice screen (hotkeys.ts): the hint buttons and the section chord. Keys taken here do not reach the keyboard piano. */
  private onHotkey(e: KeyboardEvent): void {
    if (this.leaving || this.atDoor || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as { tagName?: string; isContentEditable?: boolean } | null;
    if (target?.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName?.toUpperCase() ?? '')) return;
    if (this.pageKey(e)) return;
    const action = actionForCode(e.code, e.shiftKey);
    const chording = this.chord.phase !== 'idle';
    const chordKey = chording && !(e.code === 'KeyR' && !e.shiftKey) && /^(Digit\d|Numpad\d|Enter|NumpadEnter|Backspace)$/.test(e.code);
    if (!action && !chordKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (action === 'reset') this.resetPlay();
    else if (action === 'click') this.toggleClick();
    else if (action === 'clickFaster') this.stepClick(1);
    else if (action === 'clickSlower') this.stepClick(-1);
    else if (action === 'noteNames') this.toggle('noteNames');
    else if (action === 'fingers') this.toggle('fingers');
    else this.stepChord({ kind: 'key', code: e.code });
  }

  /**
   * The arrow keys turn the staff's pages instead of moving the keyboard piano's octave, on a staff with
   * more pages; Page Up and Page Down always do. True when the key was taken.
   */
  private pageKey(e: KeyboardEvent): boolean {
    const pages = (this.playSession.layout?.pageCount ?? 1) > 1;
    if (!['PageUp', 'PageDown'].includes(e.code) && !(pages && ['ArrowLeft', 'ArrowRight'].includes(e.code))) return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) this.turnPage(e.code === 'ArrowLeft' || e.code === 'PageUp' ? -1 : 1);
    return true;
  }

  private stepChord(input: ChordInput): void {
    const step = chordStep(this.chord, input, this.chordContext());
    this.chord = step.chord;
    this.chordTimer?.remove();
    this.chordTimer = null;
    // a number that could still grow is taken after a pause
    if (this.chord.phase !== 'idle' && this.chord.digits !== '') this.chordTimer = this.time.delayedCall(BAR_TYPING_MS, () => this.stepChord({ kind: 'timeout' }));
    const effect = step.effect;
    switch (effect.kind) {
      case 'picking':
        this.chord = step.chord;
        this.startPicking();
        break;
      case 'first-picked': {
        this.firstPicked = (this.chord as { first: number }).first;
        this.picking = 'last';
        // a bar typed by number may be on another page: show it with its A
        const layout = this.playSession.layout;
        const bar = layout?.bars[this.firstPicked];
        if (bar && layout) this.pickPage = layout.systems[bar.system]!.page;
        this.say(t('practice.pickEnd'));
        this.redraw();
        break;
      }
      case 'cancel':
        this.cancelPicking();
        break;
      case 'whole':
        this.backToWhole();
        break;
      case 'section':
        this.startSection(effect.first, effect.last);
        break;
      case 'rejected':
        this.say(t('practice.badBar', { first: typedBarRange(this.chordContext()).first, n: typedBarRange(this.chordContext()).last }), MESSAGE_MS);
        break;
      case 'none':
        break;
    }
  }

  private toggle(hint: keyof Hints): void {
    // the run after one with note names is played without them (ft_1_32.AC3)
    if (hint === 'noteNames' && !this.hints.noteNames && this.learn?.namesHidden) {
      this.say(t('learn.namesOff'), MESSAGE_MS);
      return;
    }
    this.hints = { ...this.hints, [hint]: !this.hints[hint] };
    this.playSession.setHints(this.hints);
    this.redraw();
  }

  private pianoStatus(): string {
    const midi = (contextOf(this)).midi;
    const status = midi?.getStatus();
    if (status?.state === 'connected') return t('midi.connected', { name: status.name ?? '' });
    // the on-screen keys are hidden unless the settings screen's switch showed them (d099): point at the keys there are
    return t(contextOf(this).keyboardSwitch.shown() ? 'midi.notConnected' : 'midi.notConnectedHidden');
  }
}
