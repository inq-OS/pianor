import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeContext, FakeNode } from '../../../tests/helpers/fakeAudio';
import { createAudio } from './createAudio';

/** The fake context plus what `createAudio` needs on top: a compressor, resume(), latencies and a sample rate. */
class UnlockableContext extends FakeContext {
  static last: UnlockableContext | null = null;
  resumes = 0;
  resumeWorks = true;
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.0234;
  constructor() {
    super();
    this.state = 'suspended';
    UnlockableContext.last = this;
  }
  createDynamicsCompressor() { return new FakeNode(); }
  resume() {
    this.resumes++;
    if (!this.resumeWorks) return Promise.reject(new Error('blocked'));
    this.state = 'running';
    return Promise.resolve();
  }
}

function page() {
  const listeners = new Map<string, (() => void)[]>();
  const target = {
    addEventListener: (type: string, l: () => void) => listeners.set(type, [...(listeners.get(type) ?? []), l]),
    removeEventListener: (type: string, l: () => void) => listeners.set(type, (listeners.get(type) ?? []).filter((x) => x !== l)),
  };
  const tap = (type = 'pointerdown') => (listeners.get(type) ?? []).forEach((l) => l());
  const count = () => [...listeners.values()].reduce((n, list) => n + list.length, 0);
  return { target: target as unknown as Window, tap, count };
}

afterEach(() => vi.unstubAllGlobals());

describe('createAudio', () => {
  it('reports the context state, sample rate and latencies in ms, rounded to a tenth', () => {
    vi.stubGlobal('AudioContext', UnlockableContext);
    const audio = createAudio({ baseUrl: '/samples/' });
    expect(audio.info()).toEqual({ state: 'suspended', sampleRate: 48000, baseLatencyMs: 10, outputLatencyMs: 23.4 });
  });

  it('unlocks the sound at once when the browser allows it, and stops listening', async () => {
    vi.stubGlobal('AudioContext', UnlockableContext);
    const audio = createAudio({ baseUrl: '/samples/' });
    const { target, count } = page();
    audio.unlock(target);
    await Promise.resolve();
    expect(audio.context.state).toBe('running');
    expect(count()).toBe(0);
  });

  it('keeps trying on every tap or key while the browser refuses, and stops once the sound runs', async () => {
    vi.stubGlobal('AudioContext', UnlockableContext);
    const audio = createAudio({ baseUrl: '/samples/' });
    const context = UnlockableContext.last!;
    context.resumeWorks = false;
    const { target, tap, count } = page();
    audio.unlock(target);
    await Promise.resolve();
    expect(count()).toBe(3); // pointerdown, keydown, touchend
    tap();
    await Promise.resolve();
    expect(context.resumes).toBe(2);
    context.resumeWorks = true;
    tap('keydown');
    await Promise.resolve();
    expect(context.state).toBe('running');
    expect(count()).toBe(0);
    tap();
    expect(context.resumes).toBe(3); // nothing listens any more
  });
});
