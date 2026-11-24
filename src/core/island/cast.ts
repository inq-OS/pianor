/**
 * The teacher runs the cast (ft_1_37): per player, each character on or off, the weekdays it may come, how often it comes
 * on them, the piece it teaches in place of its own, and how needy it is (the share of a played phrase it needs). Kept in
 * the player's `curriculum` document as the optional `cast` (d069.3: absent reads as today's behaviour). Pure.
 */
import type { CharacterDef } from '../character/character';
import type { CharacterId, DayString, PieceId } from '../contracts';
import type { Curriculum } from '../curriculum/curriculum';
import type { TugRules } from '../exchange/tug';
import type { PresenceRules } from './presenceRules';
import { weekdayOf } from './teacher';

/** What the teacher set for one character; every field optional, absent is the default. */
export interface CastSetting {
  readonly on?: boolean;
  /** Weekdays it may come, 0 Sunday to 6 Saturday; absent every day, empty none. */
  readonly weekdays?: readonly number[];
  /** The chance it turns up on one of its days, 0.1 to 1; absent the presence rules' `appearChance`. */
  readonly chance?: number;
  /** A piece of the player's list it teaches and tugs in place of its own (ft_1_21.AC20). */
  readonly piece?: PieceId;
  /** 1 to 5; 3 keeps the usual shares (ft_1_37.AC8). */
  readonly neediness?: number;
}

/** A wanderer the teacher sent (ft_1_37.AC6): it stands in a scene on `day`, asking for `piece` or a learned one. */
export interface SentWanderer {
  readonly wanderer: string;
  readonly day: DayString;
  readonly piece?: PieceId;
}

export interface Cast {
  readonly characters?: Readonly<Record<CharacterId, CastSetting>>;
  readonly sent?: readonly SentWanderer[];
}

export const ALL_WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
export const DEFAULT_NEEDINESS = 3;
export const NEEDINESS = { min: 1, max: 5 } as const;
/** One step of neediness moves the needed share this much (ft_1_37.AC8). AX-3 provisional. */
export const NEEDINESS_STEP = 0.1;

export interface ResolvedCastSetting {
  readonly on: boolean;
  readonly weekdays: readonly number[];
  readonly chance: number;
  readonly piece?: PieceId;
  readonly neediness: number;
}

/** A character's setting for this player with every default filled in. */
export function castSettingOf(curriculum: Curriculum, character: CharacterId, rules: Pick<PresenceRules, 'appearChance'>): ResolvedCastSetting {
  const set = curriculum.cast?.characters?.[character] ?? {};
  const resolved: ResolvedCastSetting = {
    on: set.on ?? true,
    weekdays: [...new Set(set.weekdays ?? ALL_WEEKDAYS)].sort((a, b) => a - b),
    chance: set.chance ?? rules.appearChance,
    neediness: set.neediness ?? DEFAULT_NEEDINESS,
  };
  return set.piece === undefined ? resolved : { ...resolved, piece: set.piece };
}

/** Whether the setting lets the character come on `day` at all (on, and one of its weekdays). */
export function mayComeOn(setting: Pick<ResolvedCastSetting, 'on' | 'weekdays'>, day: DayString): boolean {
  return setting.on && setting.weekdays.includes(weekdayOf(day));
}

/** The curriculum with a character's setting changed: `patch` fields replace, an `undefined` one returns to the default. */
export function setCast(curriculum: Curriculum, character: CharacterId, patch: { readonly [K in keyof CastSetting]?: CastSetting[K] | undefined }): Curriculum {
  const merged: Record<string, unknown> = { ...(curriculum.cast?.characters?.[character] ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  const characters: Record<CharacterId, CastSetting> = { ...(curriculum.cast?.characters ?? {}) };
  if (Object.keys(merged).length === 0) delete characters[character];
  else characters[character] = merged as CastSetting;
  return { ...curriculum, cast: { ...(curriculum.cast ?? {}), characters } };
}

/** The character as this player meets it: the teacher's piece in place of its own at every level it teaches (ft_1_37.AC4). */
export function castCharacter(def: CharacterDef, curriculum: Curriculum): CharacterDef {
  const piece = curriculum.cast?.characters?.[def.id]?.piece;
  if (piece === undefined) return def;
  const phrases: Partial<Record<1 | 2 | 3, readonly PieceId[]>> = {};
  for (const level of Object.keys(def.phrases)) phrases[Number(level) as 1 | 2 | 3] = [piece];
  return { ...def, phrases };
}

/** The share a play needs at `neediness`: `share` at 3, 10 points a step, between 0 and all the notes (ft_1_37.AC8). */
export function neededShare(share: number, neediness: number): number {
  const moved = share + (neediness - DEFAULT_NEEDINESS) * NEEDINESS_STEP;
  // whole tenths of a per cent, so 0.6 - 0.2 is 0.4 and not 0.39999
  return Math.min(1, Math.max(0, Math.round(moved * 1000) / 1000));
}

/** The tug's rules for a character of this neediness: every level's share moved (ft_1_37.AC8); the stall raise stays. */
export function tugRulesFor(rules: TugRules, neediness: number): TugRules {
  if (neediness === DEFAULT_NEEDINESS) return rules;
  return { ...rules, levels: rules.levels.map((level) => ({ ...level, share: neededShare(level.share, neediness) })) as unknown as TugRules['levels'] };
}
