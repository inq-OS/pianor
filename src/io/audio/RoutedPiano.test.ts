import { describe, expect, it } from 'vitest';
import { FakeContext, fakeFetch } from '../../../tests/helpers/fakeAudio';
import { KeyboardPiano, type NoteOutput } from '../midi/KeyboardPiano';
import { RoutedPiano, type RoutedPianoOptions } from './RoutedPiano';
import { SamplerPiano } from './SamplerPiano';

class FakeOut implements NoteOutput {
  readonly sent: number[][] = [];
  send(data: number[]) { this.sent.push([...data]); }
  notes() { return this.sent.filter((d) => (d[0]! & 0xf0) === 0x90); }
}

function setup(options: RoutedPianoOptions = {}) {
  const ctx = new FakeContext();
  let fetched = 0;
  const fetchFn = fakeFetch();
  const samples = new SamplerPiano(ctx.asAudioContext(), {
    baseUrl: '/a/', deferLoad: true, fetchFn: ((u: RequestInfo | URL) => (fetched++, fetchFn(u))),
  });
  const piano = new RoutedPiano(samples, new KeyboardPiano({ songNowMs: () => 0, domNowMs: () => 0 }), options);
  return { ctx, samples, piano, fetched: () => fetched };
}

describe('the piano the game plays: samples or the EZ-220 (ft_0_07.AC4)', () => {
  it('ft_0_07.AC4 loads the samples at once for full, as before', async () => {
    const { piano, ctx, fetched } = setup();
    await piano.ready;
    expect(fetched()).toBe(21);
    piano.noteOn(60, 80);
    expect(ctx.sources).toHaveLength(1);
  });

  it('ft_0_07.AC4 counts the voices of the samples that sound (the preview\'s Listen test reads it)', async () => {
    const { piano } = setup();
    await piano.ready;
    expect(piano.voiceCount).toBe(0);
    piano.noteOn(60, 80);
    expect(piano.voiceCount).toBe(1);
  });

  it('ft_0_07.AC4 waits for the admin settings before loading anything', async () => {
    const { piano, fetched } = setup({ waitForSound: true });
    piano.attachKeyboard(null);
    expect(fetched()).toBe(0);
    await piano.setSound('light');
    await piano.ready;
    expect(fetched()).toBe(21);
  });

  it('ft_0_07.AC4 with the keyboard attached plays on it and loads no samples', async () => {
    const { piano, ctx, samples, fetched } = setup({ waitForSound: true });
    await piano.setSound('keyboard');
    expect(fetched()).toBe(0); // MIDI not settled yet: wait for it
    const out = new FakeOut();
    piano.attachKeyboard(out);
    piano.noteOn(60, 80);
    expect(out.notes()).toEqual([[0x91, 60, 80]]);
    expect(ctx.sources).toHaveLength(0);
    expect(fetched()).toBe(0);
    expect(samples.loadStarted).toBe(false);
    expect(piano.playsOnKeyboard).toBe(true);
    expect(piano.loaded).toBe(true);
    await piano.ready;
  });

  it('ft_0_07.AC4 falls back on the full samples when there is no keyboard, or it goes away', async () => {
    const { piano, ctx, fetched } = setup({ sound: 'keyboard' });
    const out = new FakeOut();
    piano.attachKeyboard(out);
    piano.noteOn(60, 80);
    piano.attachKeyboard(null);
    expect(out.sent.at(-1)).toEqual([0xb1, 123, 0]); // the note left sounding is stopped
    expect(piano.playsOnKeyboard).toBe(false);
    await piano.ready;
    expect(fetched()).toBe(21);
    piano.noteOn(62, 80);
    expect(ctx.sources).toHaveLength(1);
    expect(out.notes()).toHaveLength(1);
  });

  it('ft_0_07.AC4 switches to and from the keyboard while the game runs', async () => {
    const { piano, ctx } = setup();
    const out = new FakeOut();
    piano.attachKeyboard(out);
    await piano.ready;
    piano.noteOn(60, 80);
    expect(ctx.sources).toHaveLength(1);
    await piano.setSound('keyboard');
    expect(piano.sound).toBe('keyboard');
    expect(ctx.sources[0]!.stoppedAt).not.toBeNull(); // the sample left sounding is released
    piano.noteOn(62, 80);
    expect(out.notes()).toEqual([[0x91, 62, 80]]);
    await piano.setSound('full');
    piano.noteOn(64, 80);
    expect(ctx.sources).toHaveLength(2);
    expect(piano.failed).toBe(0);
  });

  it('ft_0_07.AC4 sets the volume on both and stops both on allNotesOff', () => {
    const { piano } = setup({ sound: 'keyboard' });
    const out = new FakeOut();
    piano.attachKeyboard(out);
    out.sent.length = 0;
    piano.setVolume(1);
    piano.allNotesOff();
    expect(out.sent).toEqual([[0xb1, 7, 127], [0xb1, 123, 0]]);
  });
});
