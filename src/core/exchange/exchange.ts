/**
 * `TurnPlan` and `ExchangeResult` (ft_1_21, ft_1_22, ft_1_27; WP-10; contract A.10): one shape for every musical exchange:
 * teaching, the tug, the practice tug with Kiur, the teacher's check-up. WP-01 delivers the types only.
 */
import type { Hand, PieceId } from '../contracts';
import type { HandMeasure } from '../curriculum/play';

export type ExchangeKind = 'teach' | 'tug' | 'practiceTug' | 'checkup';

export interface TurnPlan {
  readonly kind: ExchangeKind;
  readonly piece: PieceId;
  readonly level: 1 | 2 | 3;
  readonly turns: readonly Turn[];
}
export interface Turn {
  readonly who: 'character' | 'student';
  /** Bar numbers as the chart counts them (a pick-up is bar 0, d120). */
  readonly bars: { readonly from: number; readonly to: number };
  /** A character's turn is never judged. */
  readonly judged: boolean;
  readonly mode: 'wait' | 'tempo';
  readonly hands: Hand | 'both';
  /** Whether the staff is shown in this turn. */
  readonly staff: boolean;
}
export interface TurnResult {
  /** Index into `turns`. */
  readonly turn: number;
  readonly hands: Readonly<Partial<Record<Hand, HandMeasure>>>;
  /** 0 to 1: notes right first try (Wait) or on time (Tempo). */
  readonly share: number;
  readonly passed: boolean;
  /** Miss reasons as the judge gives them (AX-0.2). */
  readonly reasons: readonly string[];
}
export interface ExchangeResult {
  readonly plan: TurnPlan;
  readonly turns: readonly TurnResult[];
  readonly outcome: 'won' | 'lost' | 'learned' | 'notYet' | 'left';
  /** The tug's marker at the end, -3 to 3. */
  readonly standing?: number;
}
