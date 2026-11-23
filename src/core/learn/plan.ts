import { pickupTicks, sectionHasNotes, type Chart } from '../chart';
import { chartSchema } from '../chart/schema';

/**
 * The step plan of learning a piece bar by bar (ft_1_32). Pure.
 *
 * A piece is learned in units, its printed bars (a pick-up goes with the first full bar). Units are cut into chunks of
 * `LEARN_RULES.chunkUnits`; inside a chunk the run grows by the step size (bars 1, 1-2, 1-3, 1-4). The finished chunk is
 * then played once more, the confirmation play. After every second chunk the two are joined (bars 1-8), and joins double
 * while they are shorter than the piece. Last comes the whole piece, `LEARN_RULES.wholeRuns` times perfectly in a row; a
 * piece of one chunk ends on its confirmation play, which is the whole piece and so is asked as often. Each other step
 * needs one perfect run.
 *
 * Every step is so confirmed by a final test that puts it together, a bar, a chunk, a pair of chunks at a time; the confirmation plays, joins and whole run are measured for the tempo the player keeps (`tempo.ts`).
 * What is learned is short: a character teaches a piece of a song (4 to 16 bars), not the song.
 */

/**
 * The chunk length in units (`AX-3 provisional`, ft_1_32 rule 7) and the perfect runs of the whole piece in a row that
 * finish the learning (ft_1_32 rule 2: three, AX-1).
 */
export const LEARN_RULES = { chunkUnits: 4, wholeRuns: 3 } as const;

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
  /** A growing step of a two-hand piece played by this hand alone (`handChart`); absent: every hand. */
  hand?: Hand;
}

export type Hand = 'RH' | 'LH';

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

/**
 * The chart of a step played by `hand` alone (ft_1_32 rule 13): the other hand's tracks become accompaniment, so the staff
 * shows and the judge waits for that hand only. The chart itself when `hand` is undefined.
 */
export function handChart(chart: Chart, hand: Hand | undefined): Chart {
  if (hand === undefined) return chart;
  return chartSchema.parse({ ...chart, tracks: chart.tracks.map((t) => (t.role === 'play' && t.hand !== hand ? { ...t, role: 'accompaniment' } : t)) });
}

/** The hands with notes to play in chart bars `first` to `last`. */
function handsIn(chart: Chart, first: number, last: number): Hand[] {
  const handOf = new Map(chart.tracks.filter((t) => t.role === 'play').map((t) => [t.id, t.hand]));
  const hands = new Set<Hand>();
  for (const n of chart.notes) {
    const hand = handOf.get(n.track);
    if ((hand === 'RH' || hand === 'LH') && n.bar >= first && n.bar <= last) hands.add(hand);
  }
  return (['RH', 'LH'] as const).filter((h) => hands.has(h));
}

/**
 * `handsApart` (ft_1_32 rule 13): in a piece for both hands each growing step is played first by the right hand alone, then
 * by the left hand alone, then by both; a step whose bars have only one hand's notes is played once. `AX-3 provisional`: hands apart in
 * every growing step; confirmation plays, joins and the whole run are always both hands.
 */
export function learnPlan(chart: Chart, stepSize: LearnStepSize = 1, handsApart = false): LearnStep[] {
  const rules = LEARN_RULES;
  const units = learnUnits(chart);
  const count = units.length;
  const hasNotes = (firstUnit: number, lastUnit: number) => sectionHasNotes(chart, units[firstUnit]!.first, units[lastUnit]!.last);
  if (count === 0 || !hasNotes(0, count - 1)) return [];
  const step = (kind: LearnStepKind, firstUnit: number, lastUnit: number, runs = 1): LearnStep => ({
    kind, firstUnit, lastUnit, firstBar: units[firstUnit]!.first, lastBar: units[lastUnit]!.last, runs,
  });
  const steps: LearnStep[] = [];
  const bothHands = handsIn(chart, 0, chart.bars.length - 1).length === 2;
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
        const grow = step('grow', start, upTo);
        const hands = handsApart && bothHands ? handsIn(chart, grow.firstBar, grow.lastBar) : [];
        // a step with one hand's notes only is that hand alone already
        if (hands.length === 2) steps.push(...hands.map((hand) => ({ ...grow, hand })));
        steps.push(grow);
        shown = upTo;
      }
      if (upTo === end) break;
    }
    // the confirmation play of a piece of one chunk is the whole piece: it is asked as often as the whole run
    steps.push(step('confirm', start, end, chunks === 1 ? rules.wholeRuns : 1));
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
