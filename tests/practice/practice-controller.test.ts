// Covers ft_0_09.AC3.
import { describe, expect, it } from 'vitest';
import littleSteps from '../fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../../src/core/chart';
import type { NoteJudged, PieceResult, PlayState } from '../../src/core/judge';
import { PracticeController } from '../../src/game/practice/PracticeController';
import { composePerformance } from '../../src/io/mock/performance';
import { ScriptedKeyboard } from '../../src/io/mock/ScriptedKeyboard';

const chart = chartSchema.parse(littleSteps);

function setup(mistakes: Parameters<typeof composePerformance>[1] = {}) {
  const keyboard = new ScriptedKeyboard(composePerformance(chart, mistakes));
  const judged: NoteJudged[] = [];
  const states: PlayState[] = [];
  const completed: PieceResult[] = [];
  const controller = new PracticeController(chart, keyboard, {
    onChange: (s) => states.push(s),
    onJudged: (e) => judged.push(e),
    onCompleted: (r) => completed.push(r),
  });
  return { keyboard, controller, judged, states, completed };
}

describe('PracticeController', () => {
  it('plays a whole piece from a keyboard: every note judged, progress updated, completed once', () => {
    const { keyboard, controller, judged, states, completed } = setup();
    keyboard.flush();
    expect(judged).toHaveLength(11);
    expect(judged.every((j) => j.verdict === 'correct')).toBe(true);
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ chartId: 'little-steps', accuracy: 1 });
    expect(controller.getState().done).toBe(true);
    expect(states.at(-1)!.noteProgress.every((p) => p === 'correct')).toBe(true);
  });

  it('reports wrong notes with their reason, and the cursor stays', () => {
    const { keyboard, controller, judged, completed } = setup({ mistakes: [{ stepIndex: 1, kind: 'wrong-octave' }] });
    for (let i = 0; i < 3; i++) keyboard.step(); // C on, C off, wrong octave on
    expect(judged.at(-1)).toMatchObject({ verdict: 'wrong', reason: 'wrong-octave' });
    expect(controller.getState().awaiting).toEqual([1]);
    expect(completed).toEqual([]);
  });

  it('tells the view about every event, including note-offs (held keys)', () => {
    const { keyboard, states } = setup();
    keyboard.step();
    expect(states.at(-1)!.heldKeys).toEqual([60]);
    keyboard.step();
    expect(states.at(-1)!.heldKeys).toEqual([]);
  });

  it('passes hints to the judge and records them in the result', () => {
    const keyboard = new ScriptedKeyboard(composePerformance(chart));
    const completed: PieceResult[] = [];
    const controller = new PracticeController(chart, keyboard, { onChange: () => undefined, onJudged: () => undefined, onCompleted: (r) => completed.push(r) }, { noteNames: true, fingers: false });
    controller.setHints({ noteNames: true, fingers: true });
    keyboard.flush();
    expect(completed[0]!.hints).toEqual({ noteNames: 11, fingers: 11 });
  });

  it('stops reacting after dispose', () => {
    const { keyboard, controller, judged } = setup();
    keyboard.step();
    controller.dispose();
    keyboard.flush();
    expect(judged).toHaveLength(1);
  });
});
