import type { GameAudio } from '../audio';
import { Metronome } from './Metronome';
import { SamplerPiano } from './SamplerPiano';
import { AudioSongClock } from './SongClock';
import { MS_PER_SECOND } from '../../core/chart';

export interface AudioInfo {
  state: AudioContextState;
  sampleRate: number;
  /** Time the browser adds before audio reaches the device driver, in ms. */
  baseLatencyMs: number;
  /** Extra time from the driver to the speakers, in ms (0 where the browser cannot tell). */
  outputLatencyMs: number;
}

export interface AudioSystem extends GameAudio {
  piano: SamplerPiano;
  metronome: Metronome;
  context: AudioContext;
  /** Browsers keep audio suspended until a user gesture: resume on the first click, tap or key press. */
  unlock(target: Window): void;
  info(): AudioInfo;
}

export interface CreateAudioOptions {
  /** Folder with the piano samples, ending in a slash. */
  baseUrl: string;
  /** Fetch no samples until `piano.load()` (ft_0_07.AC4). */
  deferLoad?: boolean;
}

/** Composition root for sound: one `AudioContext`, one song clock, a sampled piano and a metronome on a shared bus. */
export function createAudio(options: CreateAudioOptions): AudioSystem {
  const context = new AudioContext({ latencyHint: 'interactive' });
  const bus = context.createDynamicsCompressor(); // keeps loud chords from clipping
  bus.connect(context.destination);

  const clock = new AudioSongClock(context);
  const piano = new SamplerPiano(context, { baseUrl: options.baseUrl, output: bus, deferLoad: options.deferLoad ?? false });
  const metronome = new Metronome(context, { output: bus });

  const unlock = (target: Window): void => {
    const events = ['pointerdown', 'keydown', 'touchend'] as const;
    const resume = () => {
      if (context.state === 'running') return;
      void context.resume().then(() => {
        if (context.state === 'running') events.forEach((e) => target.removeEventListener(e, resume));
      }).catch(() => undefined); // a closed or failed context: the next tap tries again
    };
    events.forEach((e) => target.addEventListener(e, resume));
    resume();
  };

  const info = (): AudioInfo => ({
    state: context.state,
    sampleRate: context.sampleRate,
    baseLatencyMs: Math.round((context.baseLatency ?? 0) * MS_PER_SECOND * 10) / 10,
    outputLatencyMs: Math.round(((context as AudioContext & { outputLatency?: number }).outputLatency ?? 0) * MS_PER_SECOND * 10) / 10,
  });

  return { clock, piano, metronome, context, unlock, info };
}
