import type { Chart } from '../../core/chart';
import { WaitMode, type Hints, type JudgeEvent, type NoteJudged, type PieceResult, type PlayMode, type PlayState } from '../../core/judge';
import type { KeyboardInput, Unsubscribe } from '../../io/keyboard';

export interface PracticeCallbacks {
  /** After every key event that changed something: progress, cursor and held keys are in `state`. */
  onChange(state: PlayState): void;
  /** For each judged note (right or wrong), for feedback. */
  onJudged(event: NoteJudged, state: PlayState): void;
  onCompleted(result: PieceResult): void;
  /** Every judge event of a key press, before the callbacks above: for listeners that need bars too. */
  onEvents?(events: readonly JudgeEvent[], state: PlayState): void;
}

/**
 * Connects a keyboard to a play-mode judge (Wait unless another mode is given) and reports back. No Phaser and no rules
 * of its own: the judge decides, scenes draw. A mode that runs on the clock (Tempo) is told the time by `advance`, which the
 * scene calls every frame. Tested without a screen.
 */
export class PracticeController {
  private readonly mode: PlayMode;
  private readonly unsubscribe: Unsubscribe;
  private disposed = false;

  constructor(chart: Chart, keyboard: KeyboardInput, private readonly callbacks: PracticeCallbacks, hints?: Hints, mode?: PlayMode) {
    this.mode = mode ?? new WaitMode(chart, hints ? { hints } : {});
    this.unsubscribe = keyboard.onNote((event) => {
      if (this.disposed) return;
      this.dispatch(this.mode.handle(event), true); // every key changes the held keys
    });
  }

  /** Let the mode's clock reach `nowMs` (Tempo mode closes the notes whose time is over). Wait mode does nothing. */
  advance(nowMs: number): void {
    if (this.disposed || !this.mode.advance) return;
    this.dispatch(this.mode.advance(nowMs), false);
  }

  private dispatch(events: JudgeEvent[], always: boolean): void {
    if (events.length === 0 && !always) return;
    const state = this.mode.getState();
    if (events.length > 0) this.callbacks.onEvents?.(events, state);
    let completed: PieceResult | null = null;
    for (const judged of events) {
      if (judged.type === 'NoteJudged') this.callbacks.onJudged(judged, state);
      else if (judged.type === 'PieceCompleted') completed = judged.result;
    }
    this.callbacks.onChange(state);
    if (completed) this.callbacks.onCompleted(completed);
  }

  getState(): PlayState {
    return this.mode.getState();
  }

  setHints(hints: Hints): void {
    this.mode.setHints?.(hints);
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
  }
}
