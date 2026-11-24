import type { DayString, PieceId } from '../../core/contracts';
import type { Curriculum } from '../../core/curriculum/curriculum';
import { castSettingOf, NEEDINESS, neededShare, setCast } from '../../core/island/cast';
import type { PresenceRules } from '../../core/island/presenceRules';
import { recallWanderer, sendWanderer, type WandererRules } from '../../core/island/wanderer';
import { WEEK_ORDER } from './testsForm';

/**
 * Setting the cast for a player (ft_1_37): a character on or off, its weekdays, how often it comes, the piece it teaches in
 * place of its own and its neediness; a wanderer's piece and neediness, and sending it for today. Every press changes the
 * draft the page shows; Save keeps it (d286). Pure; `TeacherCastScene` draws it.
 */

export type CastKind = 'character' | 'wanderer';
export type CastLine = 'on' | 'days' | 'often' | 'piece' | 'needy' | 'send';

/** The lines of a character's or a wanderer's page, top to bottom. A wanderer comes only when sent: no days or chance. */
export function castLines(kind: CastKind): CastLine[] {
  return kind === 'character' ? ['on', 'days', 'often', 'piece', 'needy'] : ['on', 'piece', 'needy', 'send'];
}

/** How often in whole per cent, stepped by 10, from 10 to 100. */
const OFTEN = { min: 10, max: 100 } as const;

export interface CastFormRules {
  readonly presence: Pick<PresenceRules, 'appearChance'>;
  readonly wanderers: Pick<WandererRules, 'share'>;
  /** A tug's level shares, 1 to 3 (content/challenge/rules.json). */
  readonly tugShares: readonly number[];
}

/** What the page shows for one of the cast. `shares`: what a play needs at this neediness, in whole per cent (per tug level for a character). */
export function castValues(curriculum: Curriculum, id: string, kind: CastKind, today: DayString, rules: CastFormRules): {
  on: boolean; days: number[]; often: number; piece: PieceId | undefined; needy: number; shares: number[]; sent: boolean;
} {
  const set = castSettingOf(curriculum, id, rules.presence);
  const base = kind === 'character' ? rules.tugShares : [rules.wanderers.share];
  return {
    on: set.on,
    days: WEEK_ORDER.filter((d) => set.weekdays.includes(d)),
    often: Math.round(set.chance * 100),
    piece: set.piece,
    needy: set.neediness,
    shares: base.map((share) => Math.round(neededShare(share, set.neediness) * 100)),
    sent: sentToday(curriculum, id, today),
  };
}

export function toggleOn(curriculum: Curriculum, id: string): Curriculum {
  const on = curriculum.cast?.characters?.[id]?.on ?? true;
  return setCast(curriculum, id, { on: on ? false : undefined });
}

export function toggleCastDay(curriculum: Curriculum, id: string, weekday: number): Curriculum {
  const days = curriculum.cast?.characters?.[id]?.weekdays ?? WEEK_ORDER;
  const next = days.includes(weekday) ? days.filter((d) => d !== weekday) : [...days, weekday];
  return setCast(curriculum, id, { weekdays: next.length === 7 ? undefined : [...next].sort((a, b) => a - b) });
}

export function stepChance(curriculum: Curriculum, id: string, by: number, rules: Pick<PresenceRules, 'appearChance'>): Curriculum {
  const now = Math.round(castSettingOf(curriculum, id, rules).chance * 100);
  const next = Math.min(OFTEN.max, Math.max(OFTEN.min, Math.round((now + by) / 10) * 10));
  return setCast(curriculum, id, { chance: next === Math.round(rules.appearChance * 100) ? undefined : next / 100 });
}

export function stepNeediness(curriculum: Curriculum, id: string, by: number): Curriculum {
  const now = curriculum.cast?.characters?.[id]?.neediness ?? 3;
  const next = Math.min(NEEDINESS.max, Math.max(NEEDINESS.min, now + by));
  return setCast(curriculum, id, { neediness: next === 3 ? undefined : next });
}

/** The piece it teaches (a character) or asks for (a wanderer); undefined is its own, or a learned one. */
export function withPiece(curriculum: Curriculum, id: string, piece: PieceId | undefined): Curriculum {
  return setCast(curriculum, id, { piece });
}

export function sentToday(curriculum: Curriculum, id: string, today: DayString): boolean {
  return (curriculum.cast?.sent ?? []).some((s) => s.wanderer === id && s.day === today);
}

/** Sends the wanderer for today, or takes the sending back. */
export function toggleSend(curriculum: Curriculum, id: string, today: DayString): Curriculum {
  return sentToday(curriculum, id, today) ? recallWanderer(curriculum, id, today) : sendWanderer(curriculum, id, today);
}
