import type { Chart } from '../chart';
import { sliceChart } from '../chart/section';
import { handChart, LEARN_RULES, learnUnits, type LearnStep } from './plan';
import type { LearnRewards } from './progress';

/**
 * What the staff draws for a learning run (ft_1_32.AC20): the run's bars, then the rest of the chunk its last bar is in, which
 * the view draws very faint (`faintFrom`, the first of them as a bar of `chart`; null when the run ends its chunk). The run's
 * notes come first, in the order the judge's chart has them, so a note's index is the same in both and the judge never
 * waits for a faint one.
 */
export function shownWithChunk(piece: Chart, step: LearnStep): { chart: Chart; faintFrom: number | null } {
  const units = learnUnits(piece);
  const chunkEnd = Math.min(units.length - 1, (Math.floor(step.lastUnit / LEARN_RULES.chunkUnits) + 1) * LEARN_RULES.chunkUnits - 1);
  const lastBar = Math.max(step.lastBar, units[chunkEnd]!.last);
  const chart = handChart(sliceChart(piece, step.firstBar, lastBar), step.hand);
  if (lastBar === step.lastBar) return { chart, faintFrom: null };
  const faintFrom = step.lastBar - step.firstBar + 1;
  const notes = [...chart.notes.filter((n) => n.bar < faintFrom), ...chart.notes.filter((n) => n.bar >= faintFrom)];
  return { chart: { ...chart, notes }, faintFrom };
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
