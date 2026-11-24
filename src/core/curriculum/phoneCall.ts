import type { PieceId } from '../contracts';
import type { Curriculum } from './curriculum';

/** What the telephone in the room does now (ft_1_34): the piece its call is about, and whether it rings. */
export interface PhoneCall {
  readonly piece: PieceId;
  /** The teacher gave a piece whose learning has not begun: the telephone rings. */
  readonly ringing: boolean;
}

/** What the call needs to know of a piece for this player. */
export interface PhonePieces {
  /** Its whole learning plan is done (`pieceLearned`). */
  learned(piece: PieceId): boolean;
  /** Its learning has begun (a run was played). */
  begun(piece: PieceId): boolean;
  /** The game has the piece. */
  known(piece: PieceId): boolean;
}

/**
 * The telephone's call (ft_1_34): it rings while the teacher's curriculum holds a piece the player has not begun to learn,
 * and the call is about the one due first (the higher priority on the same day). With no new piece, an answered telephone
 * picks up the most urgent piece still being learned, without a ring. Null when no curriculum piece is left to learn. Pure.
 */
export function phoneCall(curriculum: Curriculum, pieces: PhonePieces): PhoneCall | null {
  const open = curriculum.pieces
    .filter((p) => pieces.known(p.piece) && !pieces.learned(p.piece))
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || b.priority - a.priority);
  const fresh = open.find((p) => !pieces.begun(p.piece));
  if (fresh) return { piece: fresh.piece, ringing: true };
  const first = open[0];
  return first ? { piece: first.piece, ringing: false } : null;
}
