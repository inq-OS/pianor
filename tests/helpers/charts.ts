import { chartSchema, type Chart } from '../../src/core/chart';

/** Test chart builder: 4/4, 120 bpm, a right-hand and a left-hand play track plus an accompaniment track. */
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Natural-note helper: [tick, dur, midi]. All on one right-hand track unless a track is given. */
const STEPS = [0, 2, 4, 5, 7, 9, 11];
const spell = (midi: number) => {
  const pc = midi % 12;
  const idx = STEPS.indexOf(pc);
  const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  return idx >= 0
    ? { step: names[idx]!, alter: 0, octave: Math.floor(midi / 12) - 1 }
    : { step: names[STEPS.indexOf(pc - 1)]!, alter: 1, octave: Math.floor(midi / 12) - 1 };
};

/** A grace note (d121) for `chartWith`'s `graces`: before the note at `tick` of `track` (default the right hand), voice 1. */
export function graceAt(tick: number, midi: number, track = 'rh', slash = true): Json {
  return { track, voice: 1, tick, pitch: { midi, spelling: spell(midi) }, slash };
}

export function chartWith(notes: { tick: number; dur: number; midi: number; track?: string; tieNext?: boolean }[], extra: Json = {}): Chart {
  const end = Math.max(...notes.map((n) => n.tick + n.dur));
  const barCount = Math.ceil(end / 1920);
  const midis = notes.map((n) => n.midi);
  return chartSchema.parse({
    schemaVersion: 2, id: 'test', contentVersion: 3, title: 'Test', level: 1, ppq: 480,
    tempoMap: [{ tick: 0, bpm: 120 }], meterMap: [{ tick: 0, num: 4, den: 4 }], keyMap: [{ tick: 0, fifths: 0, mode: 'major' }],
    tracks: [
      { id: 'rh', role: 'play', hand: 'RH', clef: 'treble' },
      { id: 'lh', role: 'play', hand: 'LH', clef: 'bass' },
      { id: 'bk', role: 'accompaniment', hand: null, clef: 'treble' },
    ],
    notes: notes.map((n) => ({
      tick: n.tick, dur: n.dur, midi: n.midi, spelling: spell(n.midi), track: n.track ?? 'rh', voice: 1,
      bar: Math.floor(n.tick / 1920), ...(n.tieNext ? { tieNext: true } : {}),
    })),
    rests: [],
    bars: Array.from({ length: barCount }, (_, i) => ({ index: i, startTick: i * 1920, endTick: (i + 1) * 1920 })),
    phrases: [], range: { low: Math.min(...midis), high: Math.max(...midis) }, ...extra,
  });
}
