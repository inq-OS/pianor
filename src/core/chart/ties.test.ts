import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { tieChain, tieLinks } from './ties';

describe('tieLinks', () => {
  const chart = chartWith([
    { tick: 0, dur: 960, midi: 60, tieNext: true }, // 0 -> 1 -> 2
    { tick: 960, dur: 960, midi: 60, tieNext: true },
    { tick: 1920, dur: 480, midi: 60 },
    { tick: 0, dur: 960, midi: 48, track: 'lh', tieNext: true }, // 3: no LH 48 at 960, links nothing
    { tick: 960, dur: 960, midi: 50, track: 'lh' },
    { tick: 0, dur: 960, midi: 64, track: 'bk', tieNext: true }, // 5 -> 6, an accompaniment track
    { tick: 960, dur: 960, midi: 64, track: 'bk' },
  ]);

  it('follows a chain of ties on the same track and pitch, and marks the continuations', () => {
    const { next, continuations } = tieLinks(chart, new Set(['rh', 'lh']));
    expect([...next]).toEqual([[0, 1], [1, 2]]);
    expect([...continuations]).toEqual([1, 2]);
  });

  it('only looks at the tracks asked for', () => {
    expect([...tieLinks(chart, new Set(['bk'])).next]).toEqual([[5, 6]]);
    expect(tieLinks(chart, new Set()).next.size).toBe(0);
  });

  it('walks a chain from its first note, and gives nothing for a note with no tie', () => {
    const links = tieLinks(chart, new Set(['rh', 'lh']));
    expect(tieChain(links, 0)).toEqual([1, 2]);
    expect(tieChain(links, 1)).toEqual([2]);
    expect(tieChain(links, 3)).toEqual([]);
  });
});
