/**
 * `Presence` (ft_1_25, ft_1_24, ft_1_27; WP-08; contract A.9): who is where today, from one pure function (WP-08) that gives
 * the same answer for the same day. WP-01 delivers the types only.
 */
import type { CharacterDef } from '../character/character';
import type { CharacterId, DayString, PlaceId, SceneId, StringKey } from '../contracts';
import type { Curriculum } from '../curriculum/curriculum';
import type { PieceStatus } from '../curriculum/play';
import type { WorldState } from './worldState';

export interface PresenceInput {
  readonly day: DayString;
  /** Total, from the practice log. */
  readonly practiceMinutes: number;
  readonly practiceMinutesToday: number;
  readonly characters: readonly CharacterDef[];
  readonly world: WorldState;
  readonly curriculum: Curriculum;
  /** A.11, for the teacher's schedule and Kiur. */
  readonly statuses: readonly PieceStatus[];
  /** From the practice log: clean plays of `lastLostTug.piece` after `lastLostTug.at`, per character with one. */
  readonly cleanPlaysSinceLostTug: Readonly<Record<CharacterId, number>>;
}

export type Whereabouts =
  | { readonly at: 'scene'; readonly scene: SceneId; readonly place: PlaceId }
  /** World-model path ids, walked in order. */
  | { readonly at: 'map'; readonly path: readonly string[] }
  | { readonly at: 'away' };

export interface Presence {
  readonly day: DayString;
  readonly characters: Readonly<Record<CharacterId, { readonly where: Whereabouts; readonly phase: 'arriving' | 'present' | 'leaving' }>>;
  /** 0 far out to 1 landed, from the nearest deadline. */
  readonly teacherBoat: { readonly progress: number } | null;
  /** Kiur's hints. */
  readonly headsUps: readonly { readonly character: CharacterId; readonly line: StringKey }[];
}
