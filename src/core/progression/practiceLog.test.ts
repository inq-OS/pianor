// Covers core_10.AC1: the practice log of one piece is its bar plays, in the order they were kept.
import { describe, expect, it } from 'vitest';
import { barPlaySchema, piecePlays, type BarPlay, type PracticeLog } from './practiceLog';

const play = (pieceId: string, bar: number, at = '1998-10-30T10:00:00.000Z'): BarPlay => ({
  at, pieceId, bar, notes: 4, firstTry: 4, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [],
});

describe('piecePlays (core_10.AC1)', () => {
  const log: PracticeLog = {
    bars: [play('little-steps', 0, '1998-10-30T10:00:00.000Z'), play('echo', 0), play('little-steps', 1, '1998-10-30T10:01:00.000Z'), play('little-steps', 0, '1998-10-30T10:02:00.000Z')],
  };

  it('returns only the bar plays of the piece, in the order they were kept', () => {
    expect(piecePlays(log, 'little-steps')).toEqual([log.bars[0], log.bars[2], log.bars[3]]);
  });

  it('returns an empty list for a piece with no plays, and for an empty log', () => {
    expect(piecePlays(log, 'unknown')).toEqual([]);
    expect(piecePlays({ bars: [] }, 'little-steps')).toEqual([]);
  });

  it('does not change the log it reads', () => {
    const before = JSON.stringify(log);
    piecePlays(log, 'echo');
    expect(JSON.stringify(log)).toBe(before);
  });
});

describe('barPlaySchema short (core_01 slice f, d093)', () => {
  const bar = { at: '1998-10-30T10:00:00Z', pieceId: 'echo', bar: 0, notes: 4, firstTry: 3, timing: 70, mode: 'tempo', tempoPercent: 80, section: null, misses: [] };

  it('parses a bar play with the count of notes let go too early', () => {
    const ok = barPlaySchema.safeParse({ ...bar, short: 2 });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.short).toBe(2);
  });

  it('parses a bar play without short, as Wait mode and older saves have it', () => {
    expect(barPlaySchema.safeParse({ ...bar, mode: 'wait', timing: null }).success).toBe(true);
    expect(barPlaySchema.safeParse(bar).success).toBe(true);
  });
});
