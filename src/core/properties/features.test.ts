// Covers core_05.AC1, core_05.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import restWaltz from '../../../content/dev/charts/rest-waltz.chart.json';
import { chartWith } from '../../../tests/helpers/charts';
import { parseChart } from '../chart/migrate';
import { PPQ } from '../chart/time';
import { pieceFeatures } from './features';

const Q = PPQ;
/** Four quarter notes in the right hand (C D E F: no black keys). */
const rh = [60, 62, 64, 65].map((midi, i) => ({ tick: i * Q, dur: Q, midi }));
const lh = (midi: number, tick = 0) => ({ tick, dur: 4 * Q, midi, track: 'lh' });

describe('pieceFeatures', () => {
  it('lists only the fastest note for a plain one-hand piece on the white keys', () => {
    expect(pieceFeatures(chartWith(rh))).toEqual(['fastest.quarter']);
  });

  it('names the shortest note value the student plays', () => {
    const eighths = chartWith([{ tick: 0, dur: Q, midi: 60 }, { tick: Q, dur: Q / 2, midi: 62 }, { tick: Q * 1.5, dur: Q / 2, midi: 64 }]);
    expect(pieceFeatures(eighths)).toContain('fastest.eighth');
    expect(pieceFeatures(chartWith([{ tick: 0, dur: 4 * Q, midi: 60 }]))).toContain('fastest.whole');
    expect(pieceFeatures(chartWith([{ tick: 0, dur: 3 * Q, midi: 60 }, { tick: 3 * Q, dur: Q, midi: 62 }]))).toContain('fastest.quarter');
    expect(pieceFeatures(chartWith([{ tick: 0, dur: 3 * Q, midi: 60 }]))).toContain('fastest.dottedHalf');
    expect(pieceFeatures(chartWith([{ tick: 0, dur: Q / 4, midi: 60 }]))).toContain('fastest.sixteenth');
    expect(pieceFeatures(chartWith([{ tick: 0, dur: Q / 3, midi: 60 }]))).toContain('fastest.other');
  });

  it('ignores accompaniment notes when it looks for the fastest note and the black keys', () => {
    const chart = chartWith([...rh, { tick: 0, dur: Q / 2, midi: 61, track: 'bk' }]);
    expect(pieceFeatures(chart)).toEqual(['fastest.quarter']);
  });

  it('notices black keys', () => {
    expect(pieceFeatures(chartWith([{ tick: 0, dur: Q, midi: 61 }]))).toContain('blackKeys');
    expect(pieceFeatures(chartWith([{ tick: 0, dur: Q, midi: 70 }]))).toContain('blackKeys');
    expect(pieceFeatures(chartWith([{ tick: 0, dur: Q, midi: 71 }]))).not.toContain('blackKeys');
  });

  it('notices two hands, and hands apart only when the hands do not share any keys', () => {
    const apart = pieceFeatures(chartWith([...rh, lh(48)]));
    expect(apart).toContain('twoHands');
    expect(apart).toContain('handsApart');
    const crossing = pieceFeatures(chartWith([...rh, lh(62)]));
    expect(crossing).toContain('twoHands');
    expect(crossing).not.toContain('handsApart');
    expect(pieceFeatures(chartWith(rh))).not.toContain('twoHands');
    expect(pieceFeatures(chartWith([lh(48)]))).not.toContain('twoHands');
  });

  it('notices rests the student plays, not rests of other tracks', () => {
    const rest = (track: string) => ({ rests: [{ tick: 3 * Q, dur: Q, track, voice: 1, bar: 0 }] });
    expect(pieceFeatures(chartWith(rh.slice(0, 3), rest('rh')))).toContain('rests');
    expect(pieceFeatures(chartWith(rh.slice(0, 3), rest('bk')))).not.toContain('rests');
  });

  it('does not call a different but common meter unconventional', () => {
    const waltz = chartWith(rh, { meterMap: [{ tick: 0, num: 3, den: 4 }] });
    expect(pieceFeatures(waltz)).toEqual(['fastest.quarter']);
  });

  it('notices an odd meter', () => {
    for (const [num, den] of [[5, 4], [7, 8]] as const) {
      expect(pieceFeatures(chartWith(rh, { meterMap: [{ tick: 0, num, den }] }))).toContain('oddMeter');
    }
  });

  it('notices a meter, key or tempo change in the middle of a piece', () => {
    const two = [...rh, ...rh.map((n) => ({ ...n, tick: n.tick + 4 * Q }))];
    const features = pieceFeatures(chartWith(two, {
      meterMap: [{ tick: 0, num: 4, den: 4 }, { tick: 4 * Q, num: 3, den: 4 }],
      keyMap: [{ tick: 0, fifths: 0, mode: 'major' }, { tick: 4 * Q, fifths: 1, mode: 'major' }],
      tempoMap: [{ tick: 0, bpm: 100 }, { tick: 4 * Q, bpm: 80 }],
    }));
    expect(features).toEqual(expect.arrayContaining(['meterChange', 'keyChange', 'tempoChange']));
  });

  it('does not count a map entry that repeats the same value as a change', () => {
    const two = [...rh, ...rh.map((n) => ({ ...n, tick: n.tick + 4 * Q }))];
    const features = pieceFeatures(chartWith(two, {
      meterMap: [{ tick: 0, num: 4, den: 4 }, { tick: 4 * Q, num: 4, den: 4 }],
      keyMap: [{ tick: 0, fifths: 0, mode: 'major' }, { tick: 4 * Q, fifths: 0, mode: 'major' }],
      tempoMap: [{ tick: 0, bpm: 100 }, { tick: 4 * Q, bpm: 100 }],
    }));
    expect(features).toEqual(['fastest.quarter']);
  });

  it('lists a piece without notes as having no features', () => {
    expect(pieceFeatures(chartWith([{ tick: 0, dur: Q, midi: 60 }], { notes: [] }))).toEqual([]);
  });

  it('works on a real hand-written chart with rests in 3/4', () => {
    const parsed = parseChart(restWaltz);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const features = pieceFeatures(parsed.chart);
      expect(features).toContain('rests');
      expect(features).not.toContain('oddMeter');
    }
  });

  it('is the same for the same chart, lists no feature twice, and follows the notes (property)', () => {
    const noteArb = fc.record({
      tick: fc.integer({ min: 0, max: 7 }).map((i) => i * Q),
      dur: fc.constantFrom(Q / 2, Q, 2 * Q),
      midi: fc.integer({ min: 36, max: 84 }),
      track: fc.constantFrom('rh', 'lh', 'bk'),
    });
    fc.assert(
      fc.property(fc.array(noteArb, { minLength: 1, maxLength: 12 }), (notes) => {
        const chart = chartWith(notes);
        const features = pieceFeatures(chart);
        expect(pieceFeatures(chart)).toEqual(features);
        expect(new Set(features).size).toBe(features.length);
        if (features.includes('handsApart')) expect(features).toContain('twoHands');
        const play = notes.filter((n) => n.track !== 'bk');
        expect(features.some((f) => f.startsWith('fastest.'))).toBe(play.length > 0);
        expect(features.includes('blackKeys')).toBe(play.some((n) => [1, 3, 6, 8, 10].includes(n.midi % 12)));
      }),
    );
  });
});
