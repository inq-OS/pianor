import { describe, expect, it } from 'vitest';
import type { ProgressEvent, ProgressSummary } from '../../core/progression';
import type { CompletionOutcome } from './ProfileService';
import { mergeOutcomes } from './sessionOutcome';

const summary = (totalXp: number, level: number) => ({ totalXp, level: { level }, pieces: {} }) as unknown as ProgressSummary;
const award = (total: number, newBest = false, from = 1, to = from) =>
  ({ type: 'XpAwarded', v: 1, pieceId: 'p', stars: 2, xp: { total }, totalXp: 0, newBest, piece: { xp: total, before: { level: from }, after: { level: to } } }) as unknown as ProgressEvent;
const pass = (events: ProgressEvent[], before: number, after: number, saved = true): CompletionOutcome => ({
  events, before: summary(before, 1), after: summary(after, after >= 100 ? 2 : 1), saved,
});

describe('mergeOutcomes (ft_1_12.AC4)', () => {
  it('is null for a session with no finished pass', () => {
    expect(mergeOutcomes([])).toBeNull();
  });

  it('adds up the piece XP of every pass, keeps level-ups, and spans the first before to the last after (ft_1_13.AC1)', () => {
    const levelUp = { type: 'LevelUp', v: 1, from: 1, to: 2 } as ProgressEvent;
    const merged = mergeOutcomes([pass([award(40, false, 1, 1)], 0, 40), pass([award(70, true, 1, 2), levelUp], 40, 110)])!;
    const xp = merged.events.find((e) => e.type === 'XpAwarded');
    expect(xp && xp.type === 'XpAwarded' ? [xp.xp.total, xp.newBest] : null).toEqual([110, true]);
    expect(xp && xp.type === 'XpAwarded' ? [xp.piece.before.level, xp.piece.after.level] : null).toEqual([1, 2]);
    expect(merged.events.filter((e) => e.type === 'LevelUp')).toEqual([levelUp]);
    expect(merged.before.totalXp).toBe(0);
    expect(merged.after.totalXp).toBe(110);
    expect(merged.saved).toBe(true);
  });

  it('is not saved when any pass failed to save', () => {
    expect(mergeOutcomes([pass([award(10)], 0, 10), pass([award(10)], 10, 20, false)])!.saved).toBe(false);
  });
});
