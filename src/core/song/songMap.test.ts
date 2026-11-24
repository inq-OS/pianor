import { describe, expect, it } from 'vitest';
import morning from '../../../content/songs/morning-song/song.json';
import { resolveSong } from './resolve.ts';
import { songSchema } from './schema.ts';
import { songBarX, songMapLayout, songMapParts, type MapPart } from './songMap.ts';

const song = songSchema.parse(morning);
const facts = (id: string) => ({ title: id, bpm: 80, key: { fifths: 0, mode: 'major' as const }, meter: { num: 4, den: 4 }, bars: 12, phrases: [] });
const rows = (off: string[] = []) => resolveSong(song, facts, new Set(off)).rows;
const part = (id: string, startBar: number, endBar: number): MapPart => ({ id, name: id, startBar, endBar, look: 'written' });

describe('song map', () => {
  it('ft_1_36.AC10 has a block per piece, link and blank in song order, blanks and parts that are off looking so', () => {
    expect(songMapParts(rows()).map((p) => [p.id, p.startBar, p.endBar, p.look])).toEqual([
      ['intro', 1, 12, 'written'], ['verse-1', 13, 36, 'blank'], ['chorus', 37, 46, 'blank'], ['verse-2', 47, 70, 'blank'], ['outro', 71, 82, 'written'],
    ]);
    expect(songMapParts(rows(['outro'])).find((p) => p.id === 'outro')!.look).toBe('off');
    // under a group that is off, a part is off too; a group's map holds only its own parts
    expect(songMapParts(rows(['middle'])).filter((p) => p.look === 'off').map((p) => p.id)).toEqual(['verse-1', 'chorus', 'verse-2']);
    expect(songMapParts(rows(), 'middle').map((p) => p.id)).toEqual(['verse-1', 'chorus', 'verse-2']);
  });

  it('ft_1_36.AC10 makes each block as wide as its bars, never narrower than its minimum, filling the width', () => {
    const blocks = songMapLayout([part('a', 1, 1), part('b', 2, 41), part('c', 42, 81)], 100, 16);
    expect(blocks.map((b) => [b.x, b.w])).toEqual([[0, 16], [16, 42], [58, 42]]);
    const even = songMapLayout([part('a', 1, 10), part('b', 11, 30)], 90, 16);
    expect(even.map((b) => b.w)).toEqual([30, 60]);
    expect(songBarX(even, 11)).toBe(30);
    expect(songBarX(even, 21)).toBe(60);
    expect(songBarX(even, 31)).toBe(90);
    expect(songMapLayout([], 90, 16)).toEqual([]);
  });

  it('ft_1_36.AC10 a map too narrow for every minimum shares the width evenly and never runs past it', () => {
    const blocks = songMapLayout([part('a', 1, 1), part('b', 2, 41), part('c', 42, 81)], 30, 16);
    const last = blocks[blocks.length - 1]!;
    expect(last.x + last.w).toBe(30);
    expect(blocks.map((b) => b.w)).toEqual([10, 10, 10]);
  });
});
