// Covers ft_1_02d.AC20 (the next note's length is guessed from the last one).
import { describe, expect, it } from 'vitest';
import type { EditorLength } from './model';
import { nextLength } from './nextLength';

const four = { beats: 4 as const };
const three = { beats: 3 as const };

/** The lengths the piece maker offers note after note, from `first`, writing each length it offers. */
function run(piece: { beats: 2 | 3 | 4 }, first: EditorLength, count: number): EditorLength[] {
  const out: EditorLength[] = [first];
  let start = 0;
  for (let i = 1; i < count; i++) {
    const ticks = { whole: 1920, dottedHalf: 1440, half: 960, dottedQuarter: 720, quarter: 480, dottedEighth: 360, eighth: 240, sixteenth: 120 }[out[i - 1]!];
    out.push(nextLength(piece, { start, length: out[i - 1]! }));
    start = (start + ticks) % (piece.beats * 480);
  }
  return out;
}

describe('the next note\'s length (ft_1_02d.AC20)', () => {
  it('ft_1_02d.AC20 after one eighth another, after two eighths the quarter again', () => {
    expect(nextLength(four, { start: 0, length: 'eighth' })).toBe('eighth');
    expect(nextLength(four, { start: 240, length: 'eighth' })).toBe('quarter');
    expect(nextLength(four, { start: 480, length: 'quarter' })).toBe('quarter');
  });

  it('ft_1_02d.AC20 a note that ends inside a beat is followed by what completes the beat', () => {
    expect(nextLength(four, { start: 0, length: 'dottedQuarter' })).toBe('eighth');
    expect(nextLength(four, { start: 0, length: 'dottedEighth' })).toBe('sixteenth');
    expect(nextLength(four, { start: 0, length: 'sixteenth' })).toBe('sixteenth');
    expect(nextLength(four, { start: 360, length: 'sixteenth' })).toBe('quarter');
  });

  it('ft_1_02d.AC20 after a quarter or longer on the beat the same length, held to what the bar still holds', () => {
    expect(nextLength(four, { start: 0, length: 'half' })).toBe('half');
    expect(nextLength(four, { start: 0, length: 'dottedHalf' })).toBe('quarter');
    expect(nextLength(three, { start: 0, length: 'half' })).toBe('quarter');
    // a full bar: the next bar starts afresh with the same length
    expect(nextLength(four, { start: 0, length: 'whole' })).toBe('whole');
    expect(nextLength(three, { start: 0, length: 'dottedHalf' })).toBe('dottedHalf');
    // an eighth that leaves only an eighth before the bar line
    expect(nextLength(four, { start: 1440, length: 'eighth' })).toBe('eighth');
  });

  it('ft_1_02d.AC20 a bar of eighth pairs and quarters reads as it was written', () => {
    expect(run(four, 'eighth', 6)).toEqual(['eighth', 'eighth', 'quarter', 'quarter', 'quarter', 'quarter']);
    expect(run(three, 'dottedQuarter', 4)).toEqual(['dottedQuarter', 'eighth', 'quarter', 'quarter']);
  });
});
