// Covers ft_1_32.AC5.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { BarPlay } from '../progression/practiceLog';
import { markerKey, markerKeyOfNote, markersByNote, markerShade, mistakeMarkers } from './markers';

const miss = { tick: 480, track: 'rh', midi: 62 };

/** One play of bar `bar` of piece `p`, with the misses given. */
const barPlay = (bar: number, misses: BarPlay['misses'], pieceId = 'p'): BarPlay => ({
  at: '1998-11-22T10:00:00Z', pieceId, bar, notes: 4, firstTry: 4 - misses.length, timing: null, mode: 'wait', tempoPercent: 100,
  section: { first: 0, last: bar }, misses,
});

describe('mistake markers', () => {
  it('ignore a single miss, and appear at the second', () => {
    expect(mistakeMarkers([barPlay(2, [miss]), barPlay(2, [])], 'p').size).toBe(0);
    const markers = mistakeMarkers([barPlay(2, [miss]), barPlay(2, []), barPlay(2, [miss])], 'p');
    expect(markers.get(markerKey({ bar: 2, ...miss }))).toBeCloseTo(1 / 3);
  });

  it('darken with every further miss, full red at the 4th (the 3rd when the first is not forgiven)', () => {
    const plays = Array.from({ length: 5 }, () => barPlay(0, [miss]));
    const shade = (n: number, from?: number) => mistakeMarkers(plays.slice(0, n), 'p', from === undefined ? {} : { from }).get(markerKey({ bar: 0, ...miss }));
    expect(shade(3)).toBeCloseTo(2 / 3);
    expect(shade(4)).toBe(1);
    expect(shade(5)).toBe(1);
    expect(shade(1, 1)).toBeCloseTo(1 / 3);
    expect(shade(3, 1)).toBe(1);
  });

  it('count only the bar\'s last 10 plays, so a note played right again cools down', () => {
    const plays = [...Array.from({ length: 6 }, () => barPlay(1, [miss])), ...Array.from({ length: 9 }, () => barPlay(1, []))];
    expect(mistakeMarkers(plays.slice(0, 6), 'p').get(markerKey({ bar: 1, ...miss }))).toBe(1);
    expect(mistakeMarkers(plays, 'p').size).toBe(0); // one miss left in the window
  });

  it('other pieces do not count', () => {
    expect(mistakeMarkers([barPlay(0, [miss]), barPlay(0, [miss], 'other')], 'p').size).toBe(0);
  });

  it('shade 0 below the threshold and never above 1', () => {
    expect(markerShade(1, 2, 2)).toBe(0);
    expect(markerShade(9, 2, 2)).toBe(1);
    expect(markerShade(4, 4, 0)).toBe(1);
    expect(markerShade(4, 4, -1)).toBe(1);
  });

  it('find a chart note by the same address the practice log keeps', () => {
    const chart = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 1920 + 480, dur: 480, midi: 62 }]);
    expect(markerKeyOfNote(chart, 1)).toBe(markerKey({ bar: 1, tick: 480, track: 'rh', midi: 62 }));
  });

  it('find the notes of a section chart by the piece\'s bars, for the staff', () => {
    const section = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }]);
    const markers = new Map([[markerKey({ bar: 3, tick: 480, track: 'rh', midi: 62 }), 0.5]]);
    expect([...markersByNote(section, markers, 3)]).toEqual([[1, 0.5]]);
    expect(markersByNote(section, markers).size).toBe(0);
  });
});
