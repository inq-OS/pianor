/**
 * `WorldState` (ft_1_25, WP-08; the `world` save document; contract A.8): what happened in a player's world. Anything that
 * can be derived from the practice log is derived, not stored (d092). WP-01 delivers the type only.
 */
import type { CharacterId, DayString, ItemId, PieceId } from '../contracts';

export interface WorldState {
  readonly flags: readonly string[];
  readonly items: readonly ItemId[];
  readonly met: Readonly<Record<CharacterId, MetRecord>>;
  readonly teacherVisits: readonly { readonly day: DayString; readonly piece: PieceId; readonly result: 'passed' | 'notYet' }[];
  /**
   * The keepsakes wanderers gave (ft_1_37.AC9), one a wanderer a day; the item is in `items` too. Optional, as saves from
   * before it have none (the `world` document stays version 1, d069.3).
   */
  readonly wandererGifts?: readonly { readonly day: DayString; readonly wanderer: string; readonly item: ItemId }[];
}
export interface MetRecord {
  readonly firstDay: DayString;
  readonly lastDay: DayString;
  /** For a `generated` name, drawn once. */
  readonly generatedName?: string;
  /** The phrase book is these, over all characters. */
  readonly taught: readonly PieceId[];
  /**
   * The day each of `taught` was taught: a heard phrase becomes mine when played clean on a later day (ft_1_22.AC5).
   * Optional, as saves from before it have none (the `world` document stays version 1, d069.3).
   */
  readonly taughtOn?: Readonly<Record<PieceId, DayString>>;
  readonly tugs: { readonly won: number; readonly lost: number; readonly bestLevel: 0 | 1 | 2 | 3 };
  /** The last lost tug's piece and ISO time: the cool-down counts clean plays of that piece from here (ft_1_25.AC3). */
  readonly lastLostTug?: { readonly piece: PieceId; readonly at: string };
}
