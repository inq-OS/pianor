/**
 * `PlayResult` and `PieceStatus` (core_12, WP-04; d139; contract A.11): every play's measured parts and score, and each
 * curriculum piece's level, trend, expected level, colour and medal. WP-01 delivers the types only.
 */
import type { DayString, Hand, PieceId } from '../contracts';

export interface HandMeasure {
  readonly notes: number;
  readonly firstTry: number;
  /** Tempo mode. */
  readonly onTime?: number;
  /** Tempo mode: signed mean deviation. */
  readonly onsetMeanTicks?: number;
  /** Tempo mode: standard deviation. */
  readonly onsetSpreadTicks?: number;
}
export interface PlayResult {
  readonly piece: PieceId;
  readonly day: DayString;
  /** Epoch ms, for ordering only. */
  readonly at: number;
  readonly mode: 'wait' | 'tempo';
  readonly tempoPercent: number;
  /** A section's play; absent for the whole piece. */
  readonly bars?: { readonly from: number; readonly to: number };
  readonly hands: Readonly<Partial<Record<Hand, HandMeasure>>>;
  /** 0 to 100 (d139). */
  readonly score: number;
}

export type StatusColour = 'purple' | 'green' | 'strongGreen';
export type Medal = 'bronze' | 'silver' | 'gold';

export interface PieceStatus {
  readonly piece: PieceId;
  /** In the window the teacher chose. */
  readonly plays: number;
  /** Median of the last X play scores; null under 3 plays. */
  readonly level: number | null;
  /** Standard deviation of the same. */
  readonly spread: number | null;
  /** Counts of play scores in 10-point bins, 0 to 100. */
  readonly histogram: readonly number[];
  /** The consistency rule (d139). */
  readonly retained: boolean;
  /** Base + priority. */
  readonly expected: number;
  /** At the deadline, Theil-Sen, capped at 100; null under 3 practice days. */
  readonly predicted: number | null;
  readonly band: { readonly low: number; readonly high: number } | null;
  /** Expected − predicted. */
  readonly delta: number | null;
  /** d139; 0 when nothing is owed. */
  readonly urgency: number;
  readonly colour: StatusColour;
  /** 0 to 1 for 'green'. */
  readonly greenStrength?: number;
  readonly medal?: Medal;
}
