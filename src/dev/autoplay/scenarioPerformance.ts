/**
 * From a scenario and a chart to what the virtual player does on the keyboard: a pure function, so the same scenario (same seed)
 * always gives the same run. The director (`director.ts`) plays the result through the virtual EZ-220.
 */
import type { Chart } from '../../core/chart';
import { tickToMs } from '../../core/chart';
import { buildSteps } from '../../core/judge';
import { mulberry32 } from '../../core/random';
import { composePerformance, wrongKeyFor, type MistakeKind, type ScriptedMistake, type TimedNoteEvent } from '../../io/mock/performance';
import type { Scenario, ScenarioPlayer } from './scenario';

export interface ScenarioPerformance {
  /** The key events, sorted by time, with `atMs` on the timeline whose zero is `options.startMs` plus the chart's time. */
  events: TimedNoteEvent[];
  /** The mistakes the messy player was told to make (empty for a clean player). */
  mistakes: ScriptedMistake[];
  /** The jitter used, in ms: the player's, cut so that two notes can never swap places. */
  jitterMs: number;
}

const WRONG_KINDS: Exclude<MistakeKind, 'skip'>[] = ['neighbour-key', 'wrong-octave', 'wrong-letter'];

/** The seed for mistakes is not the seed for jitter, so changing one count does not reshuffle the other. */
const MISTAKE_SEED_SALT = 0x5eed;

/** The step times of a chart in ms at the piece's own tempo. */
function stepTimesMs(chart: Chart): number[] {
  return buildSteps(chart).map((step) => tickToMs(chart.tempoMap, step.tick, chart.ppq));
}

/**
 * Which steps get a wrong key or are skipped, and what kind of wrong key, from the seed. Never the first step (the piece starts
 * cleanly), never two mistakes on one step; every wrong key is really wrong for the step it comes before. If a piece has fewer
 * steps than mistakes asked for, it gets as many as fit. Sorted by step.
 */
export function planMistakes(chart: Chart, player: ScenarioPlayer, seed: number): ScriptedMistake[] {
  if (player.style !== 'messy') return [];
  const steps = buildSteps(chart);
  const random = mulberry32((seed ^ MISTAKE_SEED_SALT) >>> 0);
  const candidates = steps.map((_, i) => i).slice(1);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  const kindStart = Math.floor(random() * WRONG_KINDS.length);
  const planned: ScriptedMistake[] = [];
  let taken = 0;
  const wrongFor = (stepIndex: number, attempt: number): ScriptedMistake | null => {
    const awaiting = steps[stepIndex]!.noteIndices.map((n) => chart.notes[n]!.midi);
    // the kind this mistake would have, or the next one that has a key to play near the awaited note
    for (let k = 0; k < WRONG_KINDS.length; k++) {
      const kind = WRONG_KINDS[(kindStart + attempt + k) % WRONG_KINDS.length]!;
      try {
        wrongKeyFor(kind, awaiting, 0);
        return { stepIndex, kind };
      } catch {
        // no such key near this note on the EZ-220: try another kind
      }
    }
    return null;
  };
  let wrongs = 0;
  while (wrongs < player.wrongKeys && taken < candidates.length) {
    const mistake = wrongFor(candidates[taken]!, wrongs);
    taken++;
    if (mistake) {
      planned.push(mistake);
      wrongs++;
    }
  }
  for (let skips = 0; skips < player.skips && taken < candidates.length; skips++) planned.push({ stepIndex: candidates[taken++]!, kind: 'skip' });
  return planned.sort((a, b) => a.stepIndex - b.stepIndex);
}

/**
 * What the player does for this scenario on `chart`. `startMs` is the time of the first note (on whatever timeline the caller plays on:
 * for Tempo mode the clock time of tick 0). Jitter is cut to 40% of the shortest gap between notes, so a note is never played
 * after the one that follows it.
 */
export function scenarioPerformance(chart: Chart, scenario: Scenario, options: { startMs?: number } = {}): ScenarioPerformance {
  const times = stepTimesMs(chart);
  const gaps = times.slice(1).map((time, i) => (time - times[i]!) / scenario.speed);
  const shortest = gaps.length > 0 ? Math.min(...gaps) : Infinity;
  const jitterMs = Math.min(scenario.player.jitterMs, 0.4 * shortest);
  const mistakes = planMistakes(chart, scenario.player, scenario.seed);
  const events = composePerformance(chart, {
    tempoScale: scenario.speed,
    startMs: options.startMs ?? 0,
    jitterMs,
    seed: scenario.seed,
    velocity: 80,
    velocityJitter: scenario.player.style === 'messy' ? 25 : 0,
    mistakes,
  });
  return { events, mistakes, jitterMs };
}
