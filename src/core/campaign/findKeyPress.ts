import type { JudgeEvent } from '../judge/types';
import { pressKey, type FindKeyPress, type FindKeyState } from './findKey';

/**
 * The phase 1 press of one judge event (ft_1_06, find the key): every judged note is a key the student pressed, right or
 * wrong, `timeMs` after the attempt started. Other judge events (bars, misses, the end of the piece) press nothing.
 */
export function findKeyPressOf(event: JudgeEvent, timeMs: number): FindKeyPress | null {
  return event.type === 'NoteJudged' ? { midi: event.midi, timeMs } : null;
}

/**
 * Every judge event of one batch (one key press, in the order the judge reported them) as presses of phase 1, at `timeMs`.
 * The scene folds a judge batch through this, so the outcome of a press is decided here and not in a scene.
 */
export function pressEvents(state: FindKeyState, events: readonly JudgeEvent[], timeMs: number): FindKeyState {
  return events.reduce((current, event) => {
    const press = findKeyPressOf(event, timeMs);
    return press ? pressKey(current, press) : current;
  }, state);
}
