import { playbackLengthMs, playbackNotes, soundingAt, type Chart, type PlaybackNote } from '../../core/chart';
import type { PianoSound, SongClock } from '../../io/audio';
import { ChartPlayer, type PlayerTimers } from '../preview/ChartPlayer';

/**
 * Kuula (listen) on the piano screen: the game plays the piece (or the section) at the player's tempo percent, and tells
 * the scene which notes sound now so the staff can light them; the student follows the notes while hearing them (AX-0.1:
 * the staff stays the main view). `start` while it plays starts again from the first note, so a reset can call it as it is.
 * The scene owns what happens around it (the judge is off while it plays).
 */
export class ListenAlong {
  private readonly player: ChartPlayer;
  private notes: readonly PlaybackNote[] = [];
  /** The notes lit at the last `changed`, as a key; null forces the next call to report. */
  private lit: string | null = null;

  constructor(piano: PianoSound, clock: SongClock, timers?: PlayerTimers) {
    this.player = new ChartPlayer(piano, clock, timers);
  }

  get isPlaying(): boolean {
    return this.player.isPlaying;
  }

  /** Play `chart` from its first note at `percent` of its tempo; `onEnd` after its last bar (not after `stop`). */
  start(chart: Chart, percent: number, onEnd: () => void): void {
    const options = { tempoScale: percent / 100 };
    this.notes = playbackNotes(chart, options);
    this.lit = null;
    this.player.start(this.notes, playbackLengthMs(chart, options), onEnd);
  }

  /** Stop at once and silence the piano. */
  stop(): void {
    this.player.stop();
  }

  /** The chart notes sounding now (empty during the lead-in and rests) when that changed since the last call; else undefined. */
  changed(): readonly number[] | undefined {
    const elapsed = this.player.elapsedMs();
    if (elapsed === null) return undefined;
    const sounding = elapsed < 0 ? [] : soundingAt(this.notes, elapsed);
    const key = sounding.join(',');
    if (key === this.lit) return undefined;
    this.lit = key;
    return sounding;
  }

  /** The staff was drawn anew: the next `changed` reports the sounding notes again. */
  relight(): void {
    this.lit = null;
  }
}
