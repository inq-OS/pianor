// Covers ft_0_01.AC3.
import { describe, expect, it } from 'vitest';
import { buildExport, describeMidi, noteName, summarize, toReplayEvents, type LogEntry } from './midiLog';

const entry = (t: number, bytes: number[], dir: 'in' | 'out' = 'in', port = 'EZ-220'): LogEntry => ({ t, received: t + 1, dir, port, bytes });

describe('noteName', () => {
  it('names MIDI notes with middle C as C4, sharps for black keys', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(61)).toBe('C#4');
    expect(noteName(36)).toBe('C2');
    expect(noteName(96)).toBe('C7');
    expect(noteName(59)).toBe('B3');
  });
});

describe('describeMidi', () => {
  it('reads a note-on with its channel, note and velocity', () => {
    expect(describeMidi([0x90, 60, 80])).toMatchObject({ kind: 'note-on', channel: 1, note: 60, noteName: 'C4', velocity: 80 });
    expect(describeMidi([0x93, 72, 1])).toMatchObject({ kind: 'note-on', channel: 4, note: 72, velocity: 1 });
  });

  it('a note-on with velocity 0 is a release, and says which way the release came', () => {
    expect(describeMidi([0x90, 60, 0])).toMatchObject({ kind: 'note-off', note: 60, releaseStyle: 'velocity0' });
    expect(describeMidi([0x80, 60, 64])).toMatchObject({ kind: 'note-off', note: 60, velocity: 64, releaseStyle: 'note-off' });
  });

  it('reads control changes, naming Local Control and All Notes Off', () => {
    expect(describeMidi([0xb0, 122, 0])).toMatchObject({ kind: 'control', channel: 1, controller: 122, value: 0 });
    expect(describeMidi([0xb0, 122, 0]).text).toContain('Local Control off');
    expect(describeMidi([0xb0, 122, 127]).text).toContain('Local Control on');
    expect(describeMidi([0xb2, 123, 0]).text).toContain('All Notes Off');
    expect(describeMidi([0xb0, 64, 127]).text).toContain('Sustain');
  });

  it('reads the other channel messages and the one-byte system messages', () => {
    expect(describeMidi([0xc0, 5]).kind).toBe('program');
    expect(describeMidi([0xe0, 0, 64]).kind).toBe('pitch-bend');
    expect(describeMidi([0xd0, 30]).kind).toBe('aftertouch');
    expect(describeMidi([0xa0, 60, 30]).kind).toBe('aftertouch');
    expect(describeMidi([0xfe]).kind).toBe('active-sensing');
    expect(describeMidi([0xf8]).kind).toBe('clock');
    expect(describeMidi([0xfa]).kind).toBe('system');
    expect(describeMidi([0xf0, 0x43, 0x10, 0xf7]).kind).toBe('sysex');
  });

  it('never throws on rubbish: empty, data bytes first, or too short', () => {
    for (const bad of [[], [60, 80], [0x90], [0x90, 60]]) expect(describeMidi(bad).kind).toBe('unknown');
    expect(describeMidi([0x90, 60]).text).toContain('90 3C');
  });
});

describe('summarize', () => {
  it('counts what came in from the keyboard, and how releases and active sensing arrive', () => {
    const log = [
      entry(0, [0xfe]), entry(300, [0xfe]), entry(600, [0xfe]),
      entry(1000, [0x90, 60, 70]), entry(1200, [0x90, 60, 0]),
      entry(1500, [0x90, 64, 101]), entry(1700, [0x80, 64, 40]),
      entry(1800, [0x90, 72, 64], 'out', 'EZ-220 out'),
      entry(1900, [0xf8]),
    ];
    const s = summarize(log);
    expect(s).toMatchObject({
      notesOn: 2, notesOff: 2, releaseStyles: { velocity0: 1, noteOff: 1 }, velocity: { min: 70, max: 101 },
      channels: [1], keyRange: { low: 60, high: 64 }, activeSensing: { count: 3, medianIntervalMs: 300 }, clock: 1, sent: 1,
    });
  });

  it('is empty-safe', () => {
    expect(summarize([])).toMatchObject({ notesOn: 0, velocity: null, keyRange: null, activeSensing: { count: 0, medianIntervalMs: null } });
  });
});

describe('toReplayEvents', () => {
  it('turns received key presses and releases into replay events, timed from the first press', () => {
    const log = [
      entry(500, [0xfe]),
      entry(1000.25, [0x90, 60, 70]), entry(1300.5, [0x90, 60, 0]),
      entry(1400, [0x90, 62, 64], 'out'),
      entry(1500, [0x90, 62, 66]), entry(1650, [0x80, 62, 30]),
    ];
    expect(toReplayEvents(log)).toEqual([
      { kind: 'on', midi: 60, velocity: 70, timeMs: 0 },
      { kind: 'off', midi: 60, velocity: 0, timeMs: 300.3 },
      { kind: 'on', midi: 62, velocity: 66, timeMs: 499.8 },
      { kind: 'off', midi: 62, velocity: 0, timeMs: 649.8 },
    ]);
  });

  it('can keep to one input port, and gives nothing for a log without presses', () => {
    const log = [entry(0, [0x90, 60, 70], 'in', 'A'), entry(10, [0x90, 61, 70], 'in', 'B')];
    expect(toReplayEvents(log, 'B').map((e) => e.midi)).toEqual([61]);
    expect(toReplayEvents([entry(0, [0xfe])])).toEqual([]);
  });
});

describe('buildExport', () => {
  it('keeps the raw log and adds a replay draft that is not marked synthetic', () => {
    const log = [entry(1000, [0x90, 60, 70]), entry(1200, [0x90, 60, 0])];
    const out = buildExport(log, { recordedAt: '1998-10-08T10:00:00.000Z', source: 'real', userAgent: 'UA', ports: [{ type: 'input', name: 'EZ-220', manufacturer: 'Yamaha', state: 'connected' }] });
    expect(out).toMatchObject({ format: 'pianor-midi-log', version: 1, source: 'real', recordedAt: '1998-10-08T10:00:00.000Z' });
    expect(out.entries).toEqual(log);
    expect(out.summary.notesOn).toBe(1);
    expect(out.replay).toMatchObject({ synthetic: false, chart: null, events: [{ kind: 'on', midi: 60 }, { kind: 'off', midi: 60 }] });
    expect(out.replay.description.length).toBeGreaterThan(10);
  });

  it('marks a recording from the virtual keyboard as synthetic', () => {
    const out = buildExport([entry(0, [0x90, 60, 70])], { recordedAt: 'x', source: 'virtual', userAgent: 'UA', ports: [] });
    expect(out.replay.synthetic).toBe(true);
  });
});
