import type { PianoSound } from '../audio';
import type { PianoSoundKind } from '../../core/sound/pianoSound';
import { lightBuffer } from './lightSample';
import { SAMPLE_MIDIS, playbackRate, sampleName, velocityToGain } from './mapping';
import { MS_PER_SECOND } from '../../core/chart';

export interface SamplerOptions {
  /** Folder with the sample MP3s, ending in a slash, e.g. "/audio/salamander/". */
  baseUrl: string;
  fetchFn?: typeof fetch;
  /** Simultaneous voices; the oldest is released when more are needed. */
  maxVoices?: number;
  /** Where the piano is connected. Defaults to the context destination. */
  output?: AudioNode;
  /** Release time constant in seconds: how fast the damper silences a released note. */
  releaseSeconds?: number;
  /** The full recordings, or the light ones (short and mono, `lightSample.ts`). Full when not given; `keyboard` is full too. */
  sound?: PianoSoundKind;
  /** Fetch nothing until `load()` is called (ft_0_07.AC4: no samples while the EZ-220 plays the game's notes). */
  deferLoad?: boolean;
}

interface Voice {
  midi: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
  released: boolean;
}

const QUICK_RELEASE_S = 0.03;

/**
 * A sampled grand piano: 21 recordings pitch-shifted to every key (at most 1.5 semitones), velocity as gain,
 * a damper release on note-off, voice limits and clean retriggering. Notes are placed on the audio clock,
 * so they can start at an exact song time.
 */
export class SamplerPiano implements PianoSound {
  loaded = false;
  failed = 0;
  /** Resolves once the samples are loaded; with `deferLoad`, only after `load()` was called. */
  readonly ready: Promise<void>;
  private loading: Promise<void> | null = null;
  private readonly loaded$: () => void;

  private buffers = new Map<number, AudioBuffer>();
  /** Each sample's file as fetched, kept (about 1.4 MB in all) so the other sound can be unpacked without fetching again. */
  private readonly encoded = new Map<number, ArrayBuffer>();
  private kind: PianoSoundKind;
  /** The latest switch: an older one that finishes after it does not replace its samples. */
  private switching = 0;
  private readonly master: GainNode;
  private voices: Voice[] = [];
  private readonly maxVoices: number;
  private readonly releaseSeconds: number;

  constructor(private readonly context: AudioContext, private readonly options: SamplerOptions) {
    this.maxVoices = options.maxVoices ?? 32;
    this.releaseSeconds = options.releaseSeconds ?? 0.12;
    this.kind = options.sound ?? 'full';
    this.master = context.createGain();
    this.master.connect(options.output ?? context.destination);
    let done = () => undefined as void;
    this.ready = new Promise<void>((resolve) => { done = resolve; });
    this.loaded$ = done;
    if (!options.deferLoad) void this.load();
  }

  /** True once fetching has started. */
  get loadStarted(): boolean {
    return this.loading !== null;
  }

  /** Fetches and unpacks the samples; a second call waits for the first. Never rejects. */
  load(): Promise<void> {
    this.loading ??= this.fetchAll().then(this.loaded$);
    return this.loading;
  }

  noteOn(midi: number, velocity: number, atMs?: number): void {
    const sampleMidi = this.pickSample(midi);
    if (sampleMidi === null) return; // nothing loaded yet: stay silent rather than fail
    const when = this.when(atMs);

    for (const voice of this.voices) if (voice.midi === midi && !voice.released) this.release(voice, when, QUICK_RELEASE_S);
    while (this.voices.filter((v) => !v.released).length >= this.maxVoices) {
      this.release(this.voices.find((v) => !v.released)!, when, QUICK_RELEASE_S);
    }

    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(sampleMidi)!;
    source.playbackRate.value = playbackRate(midi, sampleMidi);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(velocityToGain(velocity), when);
    source.connect(gain);
    gain.connect(this.master);
    const voice: Voice = { midi, source, gain, released: false };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices = this.voices.filter((v) => v !== voice);
    };
    this.voices.push(voice);
    source.start(when);
  }

  noteOff(midi: number, atMs?: number): void {
    const when = this.when(atMs);
    for (const voice of this.voices) if (voice.midi === midi && !voice.released) this.release(voice, when, this.releaseSeconds);
  }

  allNotesOff(): void {
    const when = this.context.currentTime;
    for (const voice of this.voices) if (!voice.released) this.release(voice, when, 0.05);
  }

  /** The sound the piano plays now (`full` or `light`). */
  get sound(): PianoSoundKind {
    return this.kind;
  }

  /**
   * Switches to the full or the light samples (ft_0_07.AC3): unpacks the kept files again and drops the other set. Notes
   * already sounding finish on the samples they started with; new notes take the new ones once they are ready.
   */
  async setSound(sound: PianoSoundKind): Promise<void> {
    if (sound === this.kind) return;
    const same = (sound === 'light') === (this.kind === 'light'); // `keyboard` falls back on the full samples
    this.kind = sound;
    if (same) return; // the samples are those already (or will be, from a switch still unpacking)
    const switching = ++this.switching;
    if (!this.loading) return; // not loaded yet: they load as this sound
    await this.loading;
    const next = new Map<number, AudioBuffer>();
    await Promise.all([...this.encoded].map(async ([midi, bytes]) => {
      try {
        next.set(midi, await this.unpack(bytes));
      } catch {
        // a file that unpacked once and not now: keep what it had
        const old = this.buffers.get(midi);
        if (old) next.set(midi, old);
      }
    }));
    if (switching === this.switching) this.buffers = next;
  }

  /** A kept file unpacked as the current sound. The browser takes the bytes it unpacks, so it gets a copy. */
  private async unpack(bytes: ArrayBuffer): Promise<AudioBuffer> {
    const decoded = await this.context.decodeAudioData(bytes.slice(0));
    return this.kind === 'light' ? lightBuffer(this.context, decoded) : decoded;
  }

  setVolume(volume: number): void {
    this.master.gain.value = Math.min(1, Math.max(0, volume));
  }

  /** Voices currently sounding or releasing, for tests and the audio demo. */
  get voiceCount(): number {
    return this.voices.length;
  }

  private when(atMs: number | undefined): number {
    return Math.max(this.context.currentTime, atMs === undefined ? 0 : atMs / MS_PER_SECOND);
  }

  private release(voice: Voice, when: number, timeConstant: number): void {
    voice.released = true;
    voice.gain.gain.setTargetAtTime(0, when, timeConstant);
    voice.source.stop(when + timeConstant * 8);
  }

  /** The nearest loaded sample, so a missing file only means a slightly bigger pitch shift. */
  private pickSample(midi: number): number | null {
    let best: number | null = null;
    for (const m of this.buffers.keys()) {
      if (best === null || Math.abs(midi - m) < Math.abs(midi - best) || (Math.abs(midi - m) === Math.abs(midi - best) && m < best)) best = m;
    }
    return best;
  }

  private async fetchAll(): Promise<void> {
    const fetchFn = this.options.fetchFn ?? ((input: RequestInfo | URL) => fetch(input));
    await Promise.all(
      SAMPLE_MIDIS.map(async (midi) => {
        try {
          const response = await fetchFn(`${this.options.baseUrl}${sampleName(midi)}.mp3`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();
          this.encoded.set(midi, bytes.slice(0));
          this.buffers.set(midi, await this.unpack(bytes));
        } catch {
          this.failed++;
        }
      }),
    );
    this.loaded = this.failed === 0;
  }
}
