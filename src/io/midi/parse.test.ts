// Covers ft_0_06.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ACTIVE_SENSING, DATA_MASK, NOTE_OFF, NOTE_ON, STATUS_BIT, TYPE_MASK } from './bytes';
import { parseMidiMessage } from './parse';

const parse = (bytes: number[], t = 5) => parseMidiMessage(bytes, t, 'test');

describe('parseMidiMessage', () => {
  it('reads a note-on with velocity', () => {
    expect(parse([0x90, 60, 100])).toEqual({ kind: 'on', midi: 60, velocity: 100, timeMs: 5, source: 'test' });
  });

  it('treats note-on with velocity 0 as a note-off', () => {
    expect(parse([0x90, 60, 0])).toEqual({ kind: 'off', midi: 60, velocity: 0, timeMs: 5, source: 'test' });
  });

  it('reads a note-off and drops the release velocity', () => {
    expect(parse([0x80, 60, 64])).toEqual({ kind: 'off', midi: 60, velocity: 0, timeMs: 5, source: 'test' });
  });

  it('accepts every channel', () => {
    for (let channel = 0; channel < 16; channel++) {
      expect(parse([0x90 | channel, 64, 70])).toMatchObject({ kind: 'on', midi: 64 });
      expect(parse([0x80 | channel, 64, 0])).toMatchObject({ kind: 'off', midi: 64 });
    }
  });

  it('ignores everything that is not a key press or release', () => {
    expect(parse([0xfe])).toBeNull(); // active sensing
    expect(parse([0xf8])).toBeNull(); // clock
    expect(parse([0xb0, 64, 127])).toBeNull(); // sustain pedal / control change
    expect(parse([0xc0, 5, 0])).toBeNull(); // program change (padded)
    expect(parse([0xe0, 0, 64])).toBeNull(); // pitch bend
    expect(parse([0xa0, 60, 50])).toBeNull(); // polyphonic aftertouch
    expect(parse([0x90, 60])).toBeNull(); // truncated
    expect(parse([])).toBeNull();
    expect(parse([0x3c, 60, 100])).toBeNull(); // starts with a data byte
  });

  it('works on typed arrays like real Web MIDI data', () => {
    expect(parseMidiMessage(Uint8Array.from([0x90, 72, 90]), 1, 'midi')).toMatchObject({ midi: 72, velocity: 90 });
  });

  it('never throws and only returns valid events for any 3 bytes (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 4 }), (bytes) => {
        const event = parse(bytes);
        if (event) {
          expect(event.midi).toBeGreaterThanOrEqual(0);
          expect(event.midi).toBeLessThanOrEqual(127);
          expect(event.kind === 'on' ? event.velocity > 0 : event.velocity === 0).toBe(true);
        }
      }),
    );
  });
});

describe('MIDI byte constants', () => {
  it('match the MIDI 1.0 channel voice messages the parser decodes', () => {
    expect([STATUS_BIT, TYPE_MASK, DATA_MASK, NOTE_OFF, NOTE_ON, ACTIVE_SENSING]).toEqual([0x80, 0xf0, 0x7f, 0x80, 0x90, 0xfe]);
    expect(parseMidiMessage([NOTE_ON, 60, 90], 0, 'x')).toMatchObject({ kind: 'on', midi: 60, velocity: 90 });
    expect(parseMidiMessage([NOTE_OFF, 60, 0], 0, 'x')).toMatchObject({ kind: 'off', midi: 60 });
    expect(parseMidiMessage([ACTIVE_SENSING], 0, 'x')).toBeNull();
  });
});
