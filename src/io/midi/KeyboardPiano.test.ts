import { describe, expect, it } from 'vitest';
import { KeyboardPiano, type NoteOutput } from './KeyboardPiano';

class FakeOut implements NoteOutput {
  readonly sent: { data: number[]; at: number | undefined }[] = [];
  broken = false;
  send(data: number[], timeStamp?: number) {
    if (this.broken) throw new Error('InvalidStateError');
    this.sent.push({ data: [...data], at: timeStamp });
  }
}

function setup(songNow = 1000, domNow = 50_000) {
  const piano = new KeyboardPiano({ songNowMs: () => songNow, domNowMs: () => domNow });
  const out = new FakeOut();
  piano.attach(out);
  out.sent.length = 0;
  return { piano, out };
}

describe('the game\'s notes on the EZ-220 (ft_0_07.AC4)', () => {
  it('ft_0_07.AC4 picks the grand piano on channel 2 and sets its volume when attached', () => {
    const piano = new KeyboardPiano({ songNowMs: () => 0 });
    const out = new FakeOut();
    piano.setVolume(0.5);
    piano.attach(out);
    expect(out.sent.map((m) => m.data)).toEqual([[0xb1, 0, 0], [0xb1, 32, 112], [0xc1, 0], [0xb1, 7, 64]]);
  });

  it('ft_0_07.AC4 plays notes on channel 2, never on channel 1 that lights the keys', () => {
    const { piano, out } = setup();
    piano.noteOn(60, 90);
    piano.noteOff(60);
    expect(out.sent).toEqual([{ data: [0x91, 60, 90], at: undefined }, { data: [0x81, 60, 0], at: undefined }]);
    expect(out.sent.every((m) => (m.data[0]! & 0x0f) === 1)).toBe(true);
  });

  it('ft_0_07.AC4 places a later note at the same moment on the MIDI clock, and a past one at once', () => {
    const { piano, out } = setup(1000, 50_000);
    piano.noteOn(64, 70, 1250);
    piano.noteOff(64, 1500);
    piano.noteOn(65, 70, 900);
    expect(out.sent.map((m) => m.at)).toEqual([50_250, 50_500, undefined]);
  });

  it('ft_0_07.AC4 keeps velocity inside 1 to 127', () => {
    const { piano, out } = setup();
    piano.noteOn(60, 300);
    piano.noteOn(61, 0);
    expect(out.sent.map((m) => m.data[2])).toEqual([127, 1]);
  });

  it('ft_0_07.AC4 releases what sounds on allNotesOff and when the keyboard goes away', () => {
    const { piano, out } = setup();
    piano.noteOn(60, 80);
    piano.noteOn(64, 80);
    piano.noteOff(60);
    out.sent.length = 0;
    piano.attach(null);
    expect(out.sent.map((m) => m.data)).toEqual([[0x81, 64, 0], [0xb1, 123, 0]]);
    expect(piano.attached).toBe(false);
    piano.noteOn(60, 80);
    piano.allNotesOff();
    expect(out.sent).toHaveLength(2);
  });

  it('ft_0_07.AC4 survives a send to a keyboard pulled out mid-note', () => {
    const { piano, out } = setup();
    out.broken = true;
    expect(() => piano.noteOn(60, 80)).not.toThrow();
    expect(() => piano.attach(null)).not.toThrow();
  });
});
