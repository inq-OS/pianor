import { KeyBashGuard, type KeyBashOptions } from '../../core/judge/keyBash';
import type { NoteEvent } from '../../core/judge/types';
import type { KeyboardInput, KeyboardStatus, Unsubscribe } from '../../io/keyboard';

/**
 * The player's keyboard as the practice judge hears it (ft_1_15): every key goes through a `KeyBashGuard`, so the keys of
 * a bash never reach the judge, and `onBash` hears the bash. The scene calls `release` every frame with the clock of the
 * key events, so a key that was held back to see whether a bash forms goes on. No rules here: the guard decides.
 */
export class GuardedKeyboard implements KeyboardInput {
  readonly id: string;
  private readonly guard: KeyBashGuard;
  private readonly listeners = new Set<(event: NoteEvent) => void>();
  private readonly unsubscribe: Unsubscribe;

  constructor(private readonly source: KeyboardInput, options: KeyBashOptions, private readonly onBash: () => void) {
    this.id = `guarded-${source.id}`;
    this.guard = new KeyBashGuard(options);
    this.unsubscribe = source.onNote((event) => {
      const out = this.guard.handle(event);
      this.emit(out.pass);
      if (out.bash) this.onBash();
    });
  }

  /** While the screen is paused: new keys are dropped. */
  setMuted(muted: boolean): void {
    this.guard.setMuted(muted);
  }

  /** Every frame: the held-back keys whose wait is over go to the judge. */
  release(nowMs: number): void {
    this.emit(this.guard.release(nowMs));
  }

  /** The clock a judge that runs on time may be moved to (`KeyBashGuard.judgeClock`). */
  judgeClock(nowMs: number): number {
    return this.guard.judgeClock(nowMs);
  }

  private emit(events: readonly NoteEvent[]): void {
    for (const event of events) for (const listener of [...this.listeners]) listener(event);
  }

  getStatus(): KeyboardStatus {
    return this.source.getStatus();
  }

  onNote(listener: (event: NoteEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: (status: KeyboardStatus) => void): Unsubscribe {
    return this.source.onStatus(listener);
  }

  /** Stops listening to the player's keyboard; the keyboard itself stays (the game owns it). */
  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }
}
