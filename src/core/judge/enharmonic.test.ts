// Covers core_09.AC7 (Wait and Tempo mode accept either spelling of a black key).
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { Chart } from '../chart';
import { Transport } from '../transport';
import { TempoMode } from './tempo';
import type { JudgeEvent, NoteEvent, NoteJudged } from './types';
import { WaitMode } from './wait';

const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const judged = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged');

/** One note, MIDI 61, written with the given spelling (octave 4). */
function spelled(step: string, alter: number): Chart {
  const c = chartWith([{ tick: 0, dur: 480, midi: 61 }]);
  return { ...c, notes: c.notes.map((n) => ({ ...n, spelling: { step, alter, octave: 4 } })) } as Chart;
}

const spellings = [
  ['Db4', 'D', -1],
  ['C#4', 'C', 1],
] as const;

describe.each(spellings)('written %s (MIDI 61)', (_name, step, alter) => {
  describe('Wait mode', () => {
    it('core_09.AC7: MIDI 61 is judged correct', () => {
      expect(judged(new WaitMode(spelled(step, alter)).handle(on(61, 0)))[0]).toMatchObject({ verdict: 'correct' });
    });
    it('core_09.AC7: MIDI 60 is still judged wrong', () => {
      expect(judged(new WaitMode(spelled(step, alter)).handle(on(60, 0)))[0]).toMatchObject({ verdict: 'wrong' });
    });
  });

  describe('Tempo mode', () => {
    function started() {
      const c = spelled(step, alter);
      const transport = new Transport(c);
      const mode = new TempoMode(c, transport);
      expect(mode.handle(on(0, 0))).toEqual([]);
      return { mode, at: transport.timeOfTick(c.notes[0]!.tick)! };
    }
    it('core_09.AC7: MIDI 61 on time is judged correct', () => {
      const { mode, at } = started();
      expect(judged(mode.handle(on(61, at)))[0]).toMatchObject({ verdict: 'correct' });
    });
    it('core_09.AC7: MIDI 60 is still judged wrong', () => {
      const { mode, at } = started();
      expect(judged(mode.handle(on(60, at)))[0]).toMatchObject({ verdict: 'wrong' });
    });
  });
});
