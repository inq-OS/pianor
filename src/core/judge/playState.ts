import type { NoteJudged, NoteProgress, NoteTiming, PlayState } from './types';

/** The judge's live state, as the parts both play modes keep (Wait and Tempo share the same `getState` shape). */
export interface PlayStateParts {
  stepIndex: number;
  steps: readonly { noteIndices: readonly number[] }[];
  pressed: ReadonlySet<number>;
  progress: readonly NoteProgress[];
  held: ReadonlySet<number>;
  lastJudged: NoteJudged | null;
  /** Tempo mode only: leave it out in Wait mode, so the state has no `timings` key. */
  timings?: readonly (NoteTiming | null)[];
}

/** The read-only `PlayState` a view draws from: copies, so a caller cannot change the judge. */
export function playStateOf(parts: PlayStateParts): PlayState {
  const { stepIndex, steps, pressed, progress, held, lastJudged, timings } = parts;
  const step = steps[stepIndex];
  const state: PlayState = {
    done: step === undefined,
    stepIndex,
    stepCount: steps.length,
    awaiting: step ? step.noteIndices.filter((i) => !pressed.has(i)) : [],
    noteProgress: [...progress],
    heldKeys: [...held],
    lastJudged,
  };
  if (timings) state.timings = [...timings];
  return state;
}
