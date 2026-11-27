/**
 * The staff of a lesson step (ft_1_39): what `LessonRun.current()` holds, as a chart the staff view draws. Notes to copy
 * are drawn all at once; an asked item (Try, Check) shows its given note and then only the answer played so far, so the
 * staff never gives the answer away. Pure: no DOM, no engine. Never saved.
 */
import type { Chart, ChartNote } from '../chart/schema.ts';
import { midiToSpelling } from '../chart/pitch.ts';
import { PPQ } from '../chart/time.ts';
import type { LessonItem } from './lesson.ts';

const BEATS = 4;
const BAR = BEATS * PPQ;
/** Below this every note goes on the bass staff (a lesson's notes stay in one hand). */
const MIDDLE_C = 60;

/** The notes of `now` on the staff: quarters in 4/4, sharps for the black keys (lesson notes are bare MIDI). */
export function lessonChart(now: LessonItem & { played: number }, asked: boolean): Chart {
  // an asked scale starts on its shown tonic, which the answer plays again: that note is drawn once
  const again = now.answer[0] === now.shown[0] ? 1 : 0;
  const drawn = asked ? [...now.shown, ...now.answer.slice(again, Math.max(again, now.played))] : now.shown;
  const track = 'play';
  const notes: ChartNote[] = drawn.map((midi, k) => ({ tick: k * PPQ, dur: PPQ, midi, spelling: midiToSpelling(midi), track, voice: 1, bar: Math.floor((k * PPQ) / BAR) }));
  const bars = Math.max(1, Math.ceil(drawn.length / BEATS));
  const low = Math.min(...drawn), high = Math.max(...drawn);
  return {
    schemaVersion: 2,
    id: 'lesson',
    contentVersion: 1,
    title: 'Lesson',
    level: 1,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: 80 }],
    meterMap: [{ tick: 0, num: BEATS, den: 4 }],
    keyMap: [{ tick: 0, fifths: 0, mode: 'major' }],
    tracks: [{ id: track, role: 'play', hand: 'RH', clef: high < MIDDLE_C ? 'bass' : 'treble' }],
    notes,
    rests: [],
    bars: Array.from({ length: bars }, (_, index) => ({ index, startTick: index * BAR, endTick: (index + 1) * BAR })),
    phrases: [{ name: 'lesson', startBar: 0, endBar: bars - 1 }],
    range: { low, high },
  };
}
