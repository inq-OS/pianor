import { describe, expect, it } from 'vitest';
import { FAKE_RATE, FakeContext, FakeSource, fakeFetch, urlOf, type FakeBuffer } from '../../../tests/helpers/fakeAudio';
import { SAMPLE_MIDIS, velocityToGain } from './mapping';
import { SamplerPiano } from './SamplerPiano';

async function setup(options: { maxVoices?: number; failFor?: (url: string) => boolean } = {}) {
  const ctx = new FakeContext();
  const piano = new SamplerPiano(ctx.asAudioContext(), {
    baseUrl: '/audio/salamander/', fetchFn: fakeFetch(options.failFor ? { failFor: options.failFor } : {}),
    ...(options.maxVoices ? { maxVoices: options.maxVoices } : {}),
  });
  await piano.ready;
  return { ctx, piano };
}

const lastSource = (ctx: FakeContext): FakeSource => ctx.sources.at(-1)!;

describe('SamplerPiano loading', () => {
  it('loads all 21 samples and becomes ready', async () => {
    const { ctx, piano } = await setup();
    expect(piano.loaded).toBe(true);
    expect(piano.failed).toBe(0);
    expect(ctx.decoded).toHaveLength(SAMPLE_MIDIS.length);
  });

  it('asks for the right files', async () => {
    const urls: string[] = [];
    const ctx = new FakeContext();
    const piano = new SamplerPiano(ctx.asAudioContext(), {
      baseUrl: '/a/', fetchFn: ((u: RequestInfo | URL) => (urls.push(urlOf(u)), fakeFetch()(u))),
    });
    await piano.ready;
    expect(urls).toContain('/a/C4.mp3');
    expect(urls).toContain('/a/Ds2.mp3');
    expect(urls).toContain('/a/C7.mp3');
    expect(urls).toHaveLength(21);
  });

  it('is silent, not broken, before loading finishes', () => {
    const ctx = new FakeContext();
    const piano = new SamplerPiano(ctx.asAudioContext(), { baseUrl: '/a/', fetchFn: fakeFetch() });
    expect(piano.loaded).toBe(false);
    expect(() => piano.noteOn(60, 80)).not.toThrow();
    expect(ctx.sources).toHaveLength(0);
  });

  it('counts failed files, still plays with the rest, and never rejects', async () => {
    const { ctx, piano } = await setup({ failFor: (url) => url.includes('C4') || url.includes('Ds4') });
    expect(piano.failed).toBe(2);
    expect(piano.loaded).toBe(false);
    piano.noteOn(60, 80);
    expect(ctx.sources).toHaveLength(1); // played from the nearest sample that did load
    expect(lastSource(ctx).playbackRate.value).not.toBe(1);
  });

  it('stays silent when every file fails', async () => {
    const { ctx, piano } = await setup({ failFor: () => true });
    expect(piano.failed).toBe(21);
    piano.noteOn(60, 80);
    expect(ctx.sources).toHaveLength(0);
  });
});

describe('SamplerPiano notes', () => {
  it('starts a note now with the sample, pitch shift and velocity gain', async () => {
    const { ctx, piano } = await setup();
    ctx.currentTime = 1.5;
    piano.noteOn(62, 100); // D4: nearest sample is Ds4 (63), one semitone down
    const source = lastSource(ctx);
    expect(source.startedAt).toBe(1.5);
    expect(source.playbackRate.value).toBeCloseTo(2 ** (-1 / 12), 10);
    const gain = ctx.gains.at(-1)!;
    expect(gain.gain.calls[0]).toEqual({ type: 'set', args: [velocityToGain(100), 1.5] });
    expect(source.connections).toContain(gain);
  });

  it('plays a sampled note at its natural speed', async () => {
    const { ctx, piano } = await setup();
    piano.noteOn(60, 80);
    expect(lastSource(ctx).playbackRate.value).toBe(1);
  });

  it('places a note on the audio clock when given a song time, and never in the past', async () => {
    const { ctx, piano } = await setup();
    ctx.currentTime = 2;
    piano.noteOn(60, 80, 3500);
    expect(lastSource(ctx).startedAt).toBe(3.5);
    piano.noteOn(64, 80, 1000);
    expect(lastSource(ctx).startedAt).toBe(2);
  });

  it('releases a note with a damper fade and stops its source shortly after', async () => {
    const { ctx, piano } = await setup();
    piano.noteOn(60, 80);
    ctx.currentTime = 1;
    piano.noteOff(60);
    const gain = ctx.gains.at(-1)!;
    expect(gain.gain.calls.at(-1)).toEqual({ type: 'target', args: [0, 1, 0.12] });
    expect(lastSource(ctx).stoppedAt).toBeCloseTo(1 + 0.12 * 8, 10);
  });

  it('ignores a release for a key that is not sounding, and does not release twice', async () => {
    const { ctx, piano } = await setup();
    piano.noteOff(60);
    piano.noteOn(60, 80);
    piano.noteOff(60);
    piano.noteOff(60);
    expect(ctx.gains.at(-1)!.gain.calls.filter((c) => c.type === 'target')).toHaveLength(1);
  });

  it('retriggering the same key quickly releases the old note first', async () => {
    const { ctx, piano } = await setup();
    piano.noteOn(60, 80);
    const first = ctx.gains.at(-1)!;
    piano.noteOn(60, 80);
    expect(first.gain.calls.at(-1)).toMatchObject({ type: 'target', args: [0, 0, 0.03] });
    expect(ctx.sources).toHaveLength(2);
  });

  it('limits polyphony by releasing the oldest voice', async () => {
    const { ctx, piano } = await setup({ maxVoices: 3 });
    [60, 62, 64, 65].forEach((m) => piano.noteOn(m, 80));
    const oldest = ctx.gains[ctx.gains.length - 4]!; // gains[0] is the master; voices follow
    expect(ctx.sources).toHaveLength(4);
    const released = ctx.gains.filter((g) => g.gain.calls.some((c) => c.type === 'target'));
    expect(released).toHaveLength(1);
    expect(released[0]).toBe(ctx.gains[1]);
    expect(oldest).toBeDefined();
  });

  it('forgets a voice when its source ends and frees its nodes', async () => {
    const { ctx, piano } = await setup();
    piano.noteOn(60, 80);
    expect(piano.voiceCount).toBe(1);
    lastSource(ctx).finish();
    expect(piano.voiceCount).toBe(0);
    expect(lastSource(ctx).disconnected).toBe(true);
  });

  it('silences everything on allNotesOff', async () => {
    const { ctx, piano } = await setup();
    [60, 64, 67].forEach((m) => piano.noteOn(m, 80));
    piano.allNotesOff();
    const faded = ctx.gains.filter((g) => g.gain.calls.some((c) => c.type === 'target' && c.args[0] === 0));
    expect(faded).toHaveLength(3);
  });

  it('sets and clamps the master volume', async () => {
    const { ctx, piano } = await setup();
    const master = ctx.gains[0]!;
    piano.setVolume(0.4);
    expect(master.gain.value).toBe(0.4);
    piano.setVolume(5);
    expect(master.gain.value).toBe(1);
    piano.setVolume(-1);
    expect(master.gain.value).toBe(0);
  });

  it('connects the master gain to the destination', async () => {
    const { ctx } = await setup();
    expect(ctx.gains[0]!.connections).toContain(ctx.destination);
  });
});

describe('SamplerPiano full and light (ft_0_07.AC3)', () => {
  it('plays the full recordings by default', async () => {
    const { ctx, piano } = await setup();
    expect(piano.sound).toBe('full');
    piano.noteOn(60, 80);
    expect((lastSource(ctx).buffer as FakeBuffer).numberOfChannels).toBe(2);
    expect(ctx.created).toHaveLength(0);
  });

  it('starts light when asked: every sample one channel, cut short', async () => {
    const ctx = new FakeContext();
    const piano = new SamplerPiano(ctx.asAudioContext(), { baseUrl: '/a/', fetchFn: fakeFetch(), sound: 'light' });
    await piano.ready;
    expect(ctx.created).toHaveLength(SAMPLE_MIDIS.length);
    piano.noteOn(60, 80);
    const buffer = lastSource(ctx).buffer as FakeBuffer;
    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.length).toBeLessThanOrEqual(5 * FAKE_RATE);
  });

  it('switches while it runs without fetching again: a sounding note keeps its sample, new notes take the new one', async () => {
    let fetched = 0;
    const ctx = new FakeContext();
    const fetchFn = fakeFetch();
    const piano = new SamplerPiano(ctx.asAudioContext(), { baseUrl: '/a/', fetchFn: ((u: RequestInfo | URL) => (fetched++, fetchFn(u))) });
    await piano.ready;
    piano.noteOn(60, 80);
    const before = lastSource(ctx).buffer as FakeBuffer;
    await piano.setSound('light');
    expect(piano.sound).toBe('light');
    expect(fetched).toBe(SAMPLE_MIDIS.length);
    expect(before.numberOfChannels).toBe(2);
    piano.noteOn(62, 80);
    expect((lastSource(ctx).buffer as FakeBuffer).numberOfChannels).toBe(1);
    await piano.setSound('full');
    piano.noteOn(64, 80);
    expect((lastSource(ctx).buffer as FakeBuffer).numberOfChannels).toBe(2);
  });

  it('does nothing when asked for the sound it already plays', async () => {
    const { ctx, piano } = await setup();
    const decoded = ctx.decoded.length;
    await piano.setSound('full');
    expect(ctx.decoded).toHaveLength(decoded);
  });

  it('keeps the last switch when two overlap', async () => {
    const { ctx, piano } = await setup();
    const a = piano.setSound('light');
    const b = piano.setSound('full');
    await Promise.all([a, b]);
    expect(piano.sound).toBe('full');
    piano.noteOn(60, 80);
    expect((lastSource(ctx).buffer as FakeBuffer).numberOfChannels).toBe(2);
  });
});

describe('SamplerPiano loading only when asked (ft_0_07.AC4)', () => {
  it('ft_0_07.AC4 fetches nothing until load(), then loads once however often it is asked', async () => {
    const urls: string[] = [];
    const ctx = new FakeContext();
    const piano = new SamplerPiano(ctx.asAudioContext(), {
      baseUrl: '/a/', deferLoad: true, fetchFn: ((u: RequestInfo | URL) => (urls.push(urlOf(u)), fakeFetch()(u))),
    });
    await Promise.resolve();
    expect(urls).toHaveLength(0);
    expect(piano.loadStarted).toBe(false);
    piano.noteOn(60, 80);
    expect(ctx.sources).toHaveLength(0);
    void piano.load();
    await piano.load();
    await piano.ready;
    expect(urls).toHaveLength(21);
    expect(piano.loaded).toBe(true);
  });

  it('ft_0_07.AC4 a sound chosen before loading is the one it loads, and keyboard loads the full samples', async () => {
    const ctx = new FakeContext();
    const piano = new SamplerPiano(ctx.asAudioContext(), { baseUrl: '/a/', deferLoad: true, fetchFn: fakeFetch() });
    await piano.setSound('light');
    expect(ctx.decoded).toHaveLength(0);
    await piano.load();
    piano.noteOn(60, 80);
    expect((lastSource(ctx).buffer as FakeBuffer).numberOfChannels).toBe(1);
    const decodedBefore = ctx.decoded.length;
    await piano.setSound('keyboard');
    expect(ctx.decoded.length).toBe(decodedBefore + 21);
    piano.noteOn(62, 80);
    expect((lastSource(ctx).buffer as FakeBuffer).numberOfChannels).toBe(2);
    await piano.setSound('full');
    expect(ctx.decoded.length).toBe(decodedBefore + 21);
  });
});
