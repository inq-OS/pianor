/** A tiny fake Web Audio, enough to test the sampler, metronome and clock without a browser. */

export class FakeParam {
  value = 1;
  readonly calls: { type: string; args: number[] }[] = [];
  setValueAtTime(v: number, t: number) { this.calls.push({ type: 'set', args: [v, t] }); return this; }
  setTargetAtTime(v: number, t: number, c: number) { this.calls.push({ type: 'target', args: [v, t, c] }); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.calls.push({ type: 'linear', args: [v, t] }); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { this.calls.push({ type: 'exp', args: [v, t] }); return this; }
}

export class FakeNode {
  readonly connections: unknown[] = [];
  disconnected = false;
  connect(target: unknown) { this.connections.push(target); return target; }
  disconnect() { this.disconnected = true; }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

export class FakeSource extends FakeNode {
  buffer: unknown = null;
  readonly playbackRate = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  start(t: number) { this.startedAt = t; }
  stop(t: number) { this.stoppedAt = t; }
  finish() { this.onended?.(); }
}

export class FakeOscillator extends FakeNode {
  type = 'sine';
  readonly frequency = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  start(t: number) { this.startedAt = t; }
  stop(t: number) { this.stoppedAt = t; }
}

/** The sample rate of the fake's decoded recordings: low, so a test's buffers stay small. */
export const FAKE_RATE = 1000;

/** An `AudioBuffer`: its channels as arrays. `id` is the byte length of the file it was decoded from, -1 for a made one. */
export class FakeBuffer {
  readonly channels: Float32Array[];
  constructor(readonly numberOfChannels: number, readonly length: number, readonly sampleRate: number, readonly id: number) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() { return this.length / this.sampleRate; }
  getChannelData(c: number) { return this.channels[c]!; }
  copyToChannel(data: Float32Array, c: number) { this.channels[c]!.set(data); }
}

export class FakeContext {
  currentTime = 0;
  state: 'running' | 'suspended' = 'running';
  readonly destination = new FakeNode();
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  outputTimestamp: { contextTime?: number; performanceTime?: number } = {};
  decoded: FakeBuffer[] = [];
  /** Buffers the code made itself (`createBuffer`), such as the light piano's. */
  readonly created: FakeBuffer[] = [];

  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  createOscillator() { const o = new FakeOscillator(); this.oscillators.push(o); return o; }
  decodeAudioData(data: ArrayBuffer) {
    // a stereo recording of 4 seconds at a low rate, both channels at full level
    const buffer = new FakeBuffer(2, 4 * FAKE_RATE, FAKE_RATE, data.byteLength);
    buffer.channels.forEach((c) => c.fill(1));
    this.decoded.push(buffer);
    return Promise.resolve(buffer);
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new FakeBuffer(channels, length, sampleRate, -1);
    this.created.push(buffer);
    return buffer;
  }
  getOutputTimestamp() { return this.outputTimestamp; }
  asAudioContext(): AudioContext { return this as unknown as AudioContext; }
}

/** The address a `fetch` call asks for, whichever of its three forms it was given. */
export function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

/** A `fetch` that answers every sample request with a small buffer whose length encodes the file name. */
export function fakeFetch(options: { failFor?: (url: string) => boolean } = {}): typeof fetch {
  return ((input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (options.failFor?.(url)) return Promise.resolve({ ok: false, status: 404 } as Response);
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(url.length)) } as Response);
  });
}

/** Timers you advance by hand. */
export class FakeTimers {
  now = 0;
  private nextId = 1;
  private tasks = new Map<number, { at: number; every: number | null; run: () => void }>();
  setInterval = (run: () => void, ms: number) => { const id = this.nextId++; this.tasks.set(id, { at: this.now + ms, every: ms, run }); return id; };
  clearInterval = (id: unknown) => { this.tasks.delete(id as number); };
  setTimeout = (run: () => void, ms: number) => { const id = this.nextId++; this.tasks.set(id, { at: this.now + ms, every: null, run }); return id; };
  clearTimeout = (id: unknown) => { this.tasks.delete(id as number); };
  get pending() { return this.tasks.size; }

  /** Advance time, running due tasks in order; `onTick` runs before each task so a fake context clock can follow. */
  advance(ms: number, onTick?: (now: number) => void) {
    const until = this.now + ms;
    for (;;) {
      const due = [...this.tasks.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      const [id, task] = due;
      this.now = task.at;
      onTick?.(this.now);
      if (task.every === null) this.tasks.delete(id);
      else task.at += task.every;
      task.run();
    }
    this.now = until;
    onTick?.(this.now);
  }
}
