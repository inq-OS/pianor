import type { GameAudio, MetronomeSound } from '../../io/audio';
import { t } from '../../core/text/strings';
import type { PlaySession } from './PlaySession';
import { CountInGrace } from './countInGrace';

/**
 * What a Tempo-mode play screen does every frame (the campaign's door and battle): let the judge's clock run, start the
 * click with the count-in when the screen wants one, say the count-in beats in Kiur's bubble and move the playhead.
 * `click`: the door clicks all through; a monster battle clicks all through at level 2 and only the count-in at level 3 (d100).
 */
export class TempoFrame {
  private metronomeOn = false;
  private lastBeat = -1;
  private counting = false;
  private readonly grace = new CountInGrace();

  constructor(private readonly click: 'none' | 'all' | 'count-in') {}

  run(session: PlaySession, audio: Pick<GameAudio, 'clock' | 'metronome' | 'piano'>): void {
    const transport = session.transport;
    if (!transport) return;
    const now = audio.clock.nowMs();
    session.advance(now);
    if (!transport.started) return;
    this.grace.update(transport, audio.piano, now); // the first note's grace takes the count-in's last beat (d121)
    if (this.click !== 'none' && !this.metronomeOn) {
      const plan = transport.metronome({ countInOnly: this.click === 'count-in' });
      if (plan) {
        audio.metronome.start(plan);
        this.metronomeOn = true;
      }
    }
    const beat = transport.countIn(now);
    if (beat !== null && beat.beat !== this.lastBeat) {
      this.lastBeat = beat.beat;
      this.counting = true;
      session.say(t('practice.countIn', { n: beat.inBar + 1 })); // counted 1 2 3 4 | 1 2 3 before a pick-up
    } else if (beat === null && this.counting) {
      this.counting = false;
      session.say('');
    }
    session.movePlayhead(now);
  }

  /** The click stops (the part is over, or the player leaves), and a count-in grace not yet queued never sounds. */
  stop(metronome: MetronomeSound): void {
    this.grace.stop();
    if (!this.metronomeOn) return;
    this.metronomeOn = false;
    metronome.stop();
  }
}
