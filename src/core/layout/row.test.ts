import { describe, expect, it } from 'vitest';
import { row } from './row';

describe('row', () => {
  it('lays boxes left to right with the gap between them', () => {
    const r = row(4, 2);
    expect(r.take(38)).toBe(4);
    expect(r.take(38)).toBe(44);
    expect(r.end).toBe(82);
    expect(r.next).toBe(84);
  });

  it('leaves extra room where asked', () => {
    const r = row(4, 2);
    r.take(10);
    r.skip(2);
    expect(r.take(10)).toBe(18);
  });

  it('lays boxes right to left from a right edge', () => {
    const r = row(316, 4, -1);
    expect(r.take(50)).toBe(266);
    expect(r.take(48)).toBe(214);
    expect(r.end).toBe(214);
    expect(r.next).toBe(210);
    r.skip(6);
    expect(r.next).toBe(204);
  });
});
