/**
 * Key-light hint rule: when should the awaited key be lit after wrong presses? Pure: the scene feeds it the judge's
 * wrong presses and asks whether to light the key (`KeyLightOutput` does the lighting). The count is per awaited step:
 * a wrong press on another step starts the count again, so it resets on the next note by itself.
 */

/** Wrong presses on one awaited step. `step` is the step index the count belongs to. */
export interface KeyLightCounter {
  step: number;
  wrongPresses: number;
}

export const startKeyLightCounter = (): KeyLightCounter => ({ step: -1, wrongPresses: 0 });

/** Counts one more wrong press on `step`. A press on a different step than the counted one starts again at 1. */
export function recordWrongPress(counter: KeyLightCounter, step: number): KeyLightCounter {
  return counter.step === step
    ? { step, wrongPresses: counter.wrongPresses + 1 }
    : { step, wrongPresses: 1 };
}

/**
 * True when the awaited key should be lit: at once when `afterWrong` is 0, otherwise once `afterWrong` wrong presses
 * were made on this step.
 */
export function shouldLightKey(counter: KeyLightCounter, afterWrong: number, step: number): boolean {
  if (afterWrong <= 0) return true;
  return counter.step === step && counter.wrongPresses >= afterWrong;
}
