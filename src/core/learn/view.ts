import type { Chart } from '../chart';
import { handChart, LEARN_RULES, type LearnStep } from './plan';
import type { LearnRewards } from './progress';

/**
 * What the staff draws for a learning run (ft_1_32.AC20): the whole piece, so the staff stays where it is from step to step,
 * with the bars outside the run very faint (`faint`, ranges of bars, inclusive). The run's notes come first, in the order the
 * judge's chart has them, so a note's index is the same in both and the judge never waits for a faint one.
 */
export function shownWithPiece(piece: Chart, step: LearnStep): { chart: Chart; faint: { from: number; to: number }[] } {
  const chart = handChart(piece, step.hand);
  const inRun = (bar: number) => bar >= step.firstBar && bar <= step.lastBar;
  const notes = [...chart.notes.filter((n) => inRun(n.bar)), ...chart.notes.filter((n) => !inRun(n.bar))];
  const last = piece.bars.length - 1;
  const faint = [
    ...(step.firstBar > 0 ? [{ from: 0, to: step.firstBar - 1 }] : []),
    ...(step.lastBar < last ? [{ from: step.lastBar + 1, to: last }] : []),
  ];
  return { chart: { ...chart, notes }, faint };
}

/**
 * Which prizes a run is for (ft_1_32.AC19), so the view can light them: `chunk` is the chunk whose quarters are shown (that
 * of the step's last unit), `bars` its quarters (0 to 3) the step adds, `chunks` the chunk notes a confirmation play or join
 * earns, `clef` whether the run finishes the piece. A step over bars already secured (a recall, a hand step) aims at its last bar.
 */
export interface PrizeFocus {
  chunk: number;
  bars: number[];
  chunks: number[];
  clef: boolean;
}

export function prizeFocus(step: LearnStep, plan: readonly LearnStep[], rewards: LearnRewards): PrizeFocus {
  const size = LEARN_RULES.chunkUnits;
  const chunk = Math.floor(step.lastUnit / size);
  const last = plan.at(-1);
  const clef = last !== undefined && last.kind === step.kind && last.firstUnit === step.firstUnit && last.lastUnit === step.lastUnit && last.hand === step.hand;
  if (step.kind === 'whole') return { chunk, bars: [], chunks: [], clef: true };
  if (step.kind === 'confirm') return { chunk, bars: [], chunks: [chunk], clef };
  if (step.kind === 'join') {
    const chunks: number[] = [];
    for (let c = Math.floor(step.firstUnit / size); c <= chunk; c++) chunks.push(c);
    return { chunk, bars: [], chunks, clef };
  }
  const secured = rewards.chunks[chunk]?.quarters.length ?? 0;
  const bars: number[] = [];
  for (let u = Math.max(step.firstUnit, chunk * size); u <= step.lastUnit; u++) if (u - chunk * size >= secured) bars.push(u - chunk * size);
  return { chunk, bars: bars.length > 0 ? bars : [step.lastUnit - chunk * size], chunks: [], clef: false };
}
