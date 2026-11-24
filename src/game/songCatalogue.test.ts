import { describe, expect, it } from 'vitest';
import { chartWith } from '../../tests/helpers/charts';
import type { Piece } from './pieceList';
import { SongCatalogue, songChartId } from './songCatalogue';

const piece = (id: string): Piece => ({ chart: { ...chartWith([{ tick: 0, dur: 1920, midi: 60 }]), id, title: id }, status: 'approved', level: 1, unlockLevel: 1, source: 'test' });
const pieces = new Map([['a', piece('a')], ['b', piece('b')]]);
const song = (id: string, status: 'draft' | 'approved', title = id) => ({
  schemaVersion: 1, id, title, status, source: 'original', license: 'CC0-1.0', bpm: 120, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 },
  nodes: [{ kind: 'piece', id: 'one', piece: 'a' }, { kind: 'blank', id: 'gap', name: 'Gap', bars: 2 }, { kind: 'piece', id: 'two', piece: 'b' }],
});

const catalogue = (over: { showDrafts?: boolean; off?: string[] } = {}) => {
  let off = over.off ?? [];
  const songs = new SongCatalogue({
    files: [song('zed', 'approved', 'Zed'), song('draft', 'draft', 'A draft'), { not: 'a song' }],
    showDrafts: over.showDrafts ?? true,
    piece: (id) => pieces.get(id),
    partsOff: () => off,
  });
  return { songs, setOff: (next: string[]) => { off = next; } };
};

describe('SongCatalogue', () => {
  it('ft_1_36.AC6 offers the songs that parse in title order, drafts only when built to show them, and knows their pieces', () => {
    expect(catalogue().songs.list().map((s) => s.id)).toEqual(['draft', 'zed']);
    expect(catalogue({ showDrafts: false }).songs.list().map((s) => s.id)).toEqual(['zed']);
    expect([...catalogue().songs.pieceIds()].sort()).toEqual(['a', 'b']);
  });

  it('ft_1_36.AC11 plays the whole song by its chart id with the player\'s parts that are off left out, joined again when they change', () => {
    const { songs, setOff } = catalogue();
    const whole = songs.pieceFor(songChartId('zed'))!;
    expect(whole.chart.id).toBe('song:zed');
    expect(whole.chart.bars).toHaveLength(2);
    expect(songs.pieceFor('song:zed')!.chart).toBe(whole.chart);
    setOff(['two']);
    expect(songs.pieceFor('song:zed')!.chart.bars).toHaveLength(1);
    expect(songs.resolved(songs.find('zed')!).rows.find((r) => r.id === 'two')).toMatchObject({ on: false });
    setOff(['one', 'two']);
    expect(songs.pieceFor('song:zed')).toBeUndefined();
    expect(songs.pieceFor('a')).toBeUndefined();
    expect(songs.pieceFor('song:nope')).toBeUndefined();
  });

  it('ft_1_36.AC8 plays a group as the section of the whole song its parts fill', () => {
    const songs = new SongCatalogue({
      files: [{ ...song('grouped', 'approved'), nodes: [{ kind: 'piece', id: 'one', piece: 'a' }, { kind: 'group', id: 'g', name: 'G', nodes: [{ kind: 'piece', id: 'two', piece: 'b' }] }] }],
      showDrafts: false,
      piece: (id) => pieces.get(id),
      partsOff: () => [],
    });
    const part = songs.joinedChart(songs.find('grouped')!)!.parts.find((p) => p.node === 'g');
    expect(part).toMatchObject({ startBar: 1, endBar: 1 });
  });
});
