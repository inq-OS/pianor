import type { CompletionOutcome } from './ProfileService';

/**
 * The passes of one looping play session (ft_1_12) as one outcome for the score screen: the piece XP of every pass added up (a new
 * best if any pass was one; the piece's level before the first pass and after the last, ft_1_13), every other event in order, the profile before the first pass and after the last, the
 * piece's stats after the last, and saved only when every pass was. Null for a session with no finished pass.
 */
export function mergeOutcomes(passes: readonly CompletionOutcome[]): CompletionOutcome | null {
  const first = passes[0];
  const last = passes[passes.length - 1];
  if (!first || !last) return null;
  const awarded = passes.flatMap((p) => p.events).flatMap((e) => (e.type === 'XpAwarded' ? [e] : []));
  const lastAward = awarded[awarded.length - 1];
  const others = passes.flatMap((p) => p.events).filter((e) => e.type !== 'XpAwarded');
  const xp = lastAward
    ? [{
        ...lastAward,
        xp: { ...lastAward.xp, total: awarded.reduce((sum, e) => sum + e.xp.total, 0) },
        newBest: awarded.some((e) => e.newBest),
        piece: { ...lastAward.piece, before: awarded[0]!.piece.before },
      }]
    : [];
  return {
    events: [...xp, ...others],
    before: first.before,
    after: last.after,
    saved: passes.every((p) => p.saved),
    ...(last.stats ? { stats: last.stats } : {}),
  };
}
