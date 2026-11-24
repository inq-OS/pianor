import Phaser from 'phaser';
import { playbackLengthMs, playbackNotes, soundingAt, type Chart, type PlaybackNote } from '../core/chart';
import type { Hints, PieceResult } from '../core/judge';
import { UnsupportedNotationError, layoutStaff } from '../core/layout/staff';
import { contextOf } from './context';
import { ChartPlayer } from './preview/ChartPlayer';
import { hexCss } from './ui/pixel/palette';
import { DEFAULT_THEME, StaffView, type SectionMarks } from './ui/staff/StaffView';
import { startScene } from './scenes';
import { STAFF_FONT } from './ui/staff/staffFont';

/** Dev-only preview of a piece (`?demo=preview`, `npm run piece:preview`). The page around it talks to this scene by game events. */
export const PREVIEW_SHOW = 'preview:show';
export const PREVIEW_HINTS = 'preview:hints';
export const PREVIEW_LISTEN = 'preview:listen';
export const PREVIEW_STOP = 'preview:stop';
export const PREVIEW_PRACTICE = 'preview:practice';
/** Bar marks over the staff (the difficulty panel's heat and chosen passage, core_08.AC10), or null for none. */
export const PREVIEW_MARKS = 'preview:marks';
/** From the scene to the page. */
export const PREVIEW_STATUS = 'preview:status';
/** The scene is (re)built, for instance after a play-along: the page sends what to show again. */
export const PREVIEW_READY = 'preview:ready';

export interface PreviewShow {
  /** The chart to draw, or null when the piece does not compile. */
  chart: Chart | null;
  /** Said instead of a staff when there is no chart. */
  problem?: string;
}

export interface PreviewStatus {
  listening: boolean;
  /** What the page shows under the staff, e.g. the result of a play-along. */
  message?: string;
}

interface PreviewState {
  show: PreviewShow;
  hints: Hints;
  marks?: SectionMarks | null;
}

const STATE_KEY = 'preview-state';

export interface PreviewData {
  result?: PieceResult;
}

/**
 * Shows one chart with the game's own staff renderer, plays it with the sampled piano while lighting the sounding
 * notes, and starts the real practice scene as a play-along. It holds no rules: layout is `layoutStaff`, correctness
 * is the judge's, sound is the sampler's.
 */
export class PreviewScene extends Phaser.Scene {
  private view: StaffView | null = null;
  private note: Phaser.GameObjects.Text | null = null;
  private player: ChartPlayer | null = null;
  private playing: readonly PlaybackNote[] = [];
  private lit = '';
  private result: PieceResult | null = null;

  constructor() {
    super('preview');
  }

  init(data: PreviewData = {}): void {
    this.result = data.result ?? null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(DEFAULT_THEME.paper);
    const context = contextOf(this);
    this.player = new ChartPlayer(context.audio.piano, context.audio.clock);

    const events = this.game.events;
    const onShow = (show: PreviewShow) => {
      this.stopListening();
      this.setState({ show });
      this.build();
    };
    const onHints = (hints: Hints) => {
      this.setState({ hints });
      this.view?.setHints(hints);
    };
    const onMarks = (marks: SectionMarks | null) => {
      this.setState({ marks });
      this.view?.setSectionMarks(marks);
    };
    const onListen = (options: { tempoScale: number }) => this.listen(options.tempoScale);
    const onStop = () => this.stopListening();
    const onPractice = () => {
      const { chart } = this.state().show;
      if (!chart) return;
      this.stopListening();
      startScene(this, 'practice', { chart, preview: true });
    };
    const onResize = () => this.build();

    events.on(PREVIEW_SHOW, onShow);
    events.on(PREVIEW_HINTS, onHints);
    events.on(PREVIEW_MARKS, onMarks);
    events.on(PREVIEW_LISTEN, onListen);
    events.on(PREVIEW_STOP, onStop);
    events.on(PREVIEW_PRACTICE, onPractice);
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      this.player?.stop();
      events.off(PREVIEW_SHOW, onShow);
      events.off(PREVIEW_HINTS, onHints);
      events.off(PREVIEW_MARKS, onMarks);
      events.off(PREVIEW_LISTEN, onListen);
      events.off(PREVIEW_STOP, onStop);
      events.off(PREVIEW_PRACTICE, onPractice);
      this.scale.off('resize', onResize);
    });

    this.build();
    if (this.result) {
      const r = this.result;
      const together = r.bothHands.notes > 0 ? `, both hands together ${r.bothHands.together} of ${r.bothHands.notes}` : '';
      this.emitStatus({ listening: false, message: `Played along: ${Math.round(r.accuracy * 100)}% right, ${r.mistakes} mistake(s)${together}.` });
    }
    events.emit(PREVIEW_READY);
  }

  override update(): void {
    const elapsed = this.player?.elapsedMs();
    if (elapsed === null || elapsed === undefined) return;
    const indexes = elapsed < 0 ? [] : soundingAt(this.playing, elapsed);
    const key = indexes.join(',');
    if (key === this.lit) return;
    this.lit = key;
    this.view?.setCursor(indexes);
  }

  private state(): PreviewState {
    return (this.registry.get(STATE_KEY) as PreviewState | undefined) ?? { show: { chart: null, problem: 'Choose a piece on the left.' }, hints: { noteNames: false, fingers: false } };
  }

  private setState(patch: Partial<PreviewState>): void {
    this.registry.set(STATE_KEY, { ...this.state(), ...patch });
  }

  private emitStatus(status: PreviewStatus): void {
    this.game.events.emit(PREVIEW_STATUS, status);
  }

  private listen(tempoScale: number): void {
    const { chart } = this.state().show;
    if (!chart || !this.player) return;
    this.playing = playbackNotes(chart, { tempoScale });
    this.lit = '';
    this.player.start(this.playing, playbackLengthMs(chart, { tempoScale }), () => {
      this.view?.setCursor(null);
      this.emitStatus({ listening: false });
    });
    this.emitStatus({ listening: true });
  }

  private stopListening(): void {
    if (!this.player?.isPlaying) return;
    this.player.stop();
    this.view?.setCursor(null);
    this.emitStatus({ listening: false });
  }

  private build(): void {
    this.view?.destroy();
    this.view = null;
    this.lit = ''; // a rebuilt view lights the sounding notes again on the next frame
    this.note?.destroy();
    this.note = null;
    const { show, hints, marks } = this.state();
    const { width, height } = this.scale;
    const say = (text: string) => {
      this.note = this.add
        .text(width / 2, height / 2, text, { fontFamily: STAFF_FONT, fontSize: '18px', color: hexCss(DEFAULT_THEME.ink), align: 'center', wordWrap: { width: width * 0.8 } })
        .setOrigin(0.5);
    };
    if (!show.chart) {
      say(show.problem ?? 'Nothing to show.');
      return;
    }
    try {
      const layout = layoutStaff(show.chart, { viewport: { width, height } });
      this.view = new StaffView(this, layout, undefined, hints);
      if (marks) this.view.setSectionMarks(marks);
    } catch (e) {
      if (!(e instanceof UnsupportedNotationError)) throw e;
      say(`The game cannot draw this piece yet:\n${e.message}`);
    }
  }
}
