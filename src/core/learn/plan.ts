import { pickupTicks, sectionHasNotes, type Chart } from '../chart';

/**
 * The step plan of learning a piece bar by bar (ft_1_32). Pure.
 *
 * A piece is learned in units, its printed bars (a pick-up goes with the first full bar). Units are cut into chunks of
 * `LEARN_RULES.chunkUnits`; inside a chunk the run grows by the step size (bars 1, 1-2, 1-3, 1-4). The finished chunk is
 * then played once more, the confirmation play. After every second chunk the two are joined (bars 1-8), and joins double
 * while they are shorter than the piece. Last comes the whole piece, `LEARN_RULES.wholeRuns` times perfectly in a row; a
 * piece of one chunk ends on its confirmation play, which is the whole piece. Each other step needs one perfect run.
 *
 * Every step is so confirmed by a final test that puts it together, a bar, a chunk, a pair of chunks at a time; the confirmation plays, joins and whole run are measured for the tempo the player keeps (`tempo.ts`).
 * What is learned is short: a character teaches a piece of a song (4 to 16 bars), not the song.
 */

/**
 * AX-3 provisional (ft_1_32 rule 7): the chunk length in units and the perfect whole runs that finish the learning
 * (TODO(architect, R2) in ft_1_32).
 */
export const LEARN_RULES = { chunkUnits: 4, wholeRuns: 1 } as const;

/** Units a step adds: 1 bar (the beginner's step), or 2. Slice 5 takes it from a difficulty budget. */
export type LearnStepSize = 1 | 2;

/** One unit: chart bars `first` to `last`, 0-based and inclusive (two bars only for a pick-up and its full bar). */
export interface LearnUnit {
  first: number;
  last: number;
}

/**
 * `grow`: the run gets longer inside its chunk; `confirm`: the finished chunk once more; `join`: finished chunks together;
 * `whole`: the whole piece. All but `grow` are measured.
 */
export type LearnStepKind = 'grow' | 'confirm' | 'join' | 'whole';

export interface LearnStep {
  kind: LearnStepKind;
  /** Units of the step, 0-based and inclusive. */
  firstUnit: number;
  lastUnit: number;
  /** Chart bars of the step, 0-based and inclusive: what the staff shows and `sliceChart` cuts. */
  firstBar: number;
  lastBar: number;
  /** Perfect runs in a row the step needs. */
  runs: number;
}

/** The units of a piece: one per bar, a pick-up with the bar after it. */
export function learnUnits(chart: Chart): LearnUnit[] {
  const units: LearnUnit[] = [];
  const pickup = pickupTicks(chart.bars, chart.meterMap) > 0;
  for (let bar = 0; bar < chart.bars.length; bar++) {
    if (pickup && bar === 0) {
      units.push({ first: 0, last: 1 });
      bar++;
    } else units.push({ first: bar, last: bar });
  }
  return units;
}

export function learnPlan(chart: Chart, stepSize: LearnStepSize = 1): LearnStep[] {
  const rules = LEARN_RULES;
  const units = learnUnits(chart);
  const count = units.length;
  const hasNotes = (firstUnit: number, lastUnit: number) => sectionHasNotes(chart, units[firstUnit]!.first, units[lastUnit]!.last);
  if (count === 0 || !hasNotes(0, count - 1)) return [];
  const step = (kind: LearnStepKind, firstUnit: number, lastUnit: number, runs = 1): LearnStep => ({
    kind, firstUnit, lastUnit, firstBar: units[firstUnit]!.first, lastBar: units[lastUnit]!.last, runs,
  });
  const steps: LearnStep[] = [];
  const chunks = Math.ceil(count / rules.chunkUnits);
  for (let chunk = 0; chunk < chunks; chunk++) {
    const start = chunk * rules.chunkUnits;
    const end = Math.min(start + rules.chunkUnits, count) - 1;
    if (!hasNotes(start, end)) continue; // a chunk of rests is never played on its own
    let shown = start - 1; // the last unit of the last step kept in this chunk
    for (let last = start + stepSize - 1; ; last += stepSize) {
      const upTo = Math.min(last, end);
      // a step that adds only bars with nothing to play is left out; the chunk's last bars then come with the confirmation
      if (hasNotes(shown + 1, upTo)) {
        steps.push(step('grow', start, upTo));
        shown = upTo;
      }
      if (upTo === end) break;
    }
    steps.push(step('confirm', start, end));
  }
  // after every second chunk the pair is joined, then pairs of pairs, while shorter than the piece: each join comes right
  // after the confirmation play of its last chunk
  const joined: LearnStep[] = [];
  for (const s of steps) {
    joined.push(s);
    if (s.kind !== 'confirm') continue;
    const chunk = s.firstUnit / rules.chunkUnits;
    for (let size = 2; (chunk + 1) % size === 0; size *= 2) {
      const first = (chunk + 1 - size) * rules.chunkUnits;
      if (first === 0 && s.lastUnit === count - 1) break; // that is the whole piece
      joined.push(step('join', first, s.lastUnit));
    }
  }
  // a piece of one chunk ends on its confirmation play: that is the whole piece
  if (chunks > 1) joined.push(step('whole', 0, count - 1, rules.wholeRuns));
  return joined;
}
