/**
 * The staff of the trainers and the circle of fifths stands still: a new note, another step of the note
 * trainer or another key draws on the same staff at the same place and size. Each layout is planned with a reserve (`StaffLayoutOptions.reserve`) for every
 * note the screen can show, in the clef it would be drawn in. Pure: no DOM, no engine.
 */
import type { Chart } from '../chart/schema.ts';
import { midiToSpelling, staffPosition, type Clef } from '../chart/pitch.ts';
import { PPQ } from '../chart/time.ts';
import { layoutForSettings, type StaffSettings } from '../layout/staffSettings.ts';
import type { StaffLayout, StaffLayoutOptions, StaffReserve } from '../layout/staffTypes.ts';
import type { KeyMode } from '../editor/key.ts';
import { layoutStaff } from '../layout/staff.ts';
import { trainerChart } from './noteChart.ts';
import { scaleChart } from './scaleChart.ts';
import type { TrainerRange } from './noteTrainer.ts';

/** Middle C: below it a note is drawn in the bass clef, from it up in the treble clef. */
const MIDDLE_C = 60;

/** Room for single whole notes at every key of `groups`, each in its clef; a staff whose clef can change gets the room of either clef. */
function reserveOf(groups: readonly { clef: Clef; keys: readonly number[] }[]): StaffReserve {
  const positions = groups.flatMap(({ clef, keys }) => keys.map((key) => staffPosition(midiToSpelling(key), clef)));
  const clefs = new Set(groups.filter((g) => g.keys.length > 0).map((g) => g.clef));
  return { shortestTicks: 4 * PPQ, low: Math.min(...positions), high: Math.max(...positions), widestChord: 0, anyClef: clefs.size > 1 };
}

const keysOf = (range: TrainerRange) => Array.from({ length: range.high - range.low + 1 }, (_, i) => range.low + i);

/** The note trainer's reserve for the keys `range`: each in the clef `clefOfRange` gives it (bass below middle C, treble from it up). */
function rangeReserve(range: TrainerRange): StaffReserve {
  const keys = keysOf(range);
  return reserveOf([{ clef: 'bass', keys: keys.filter((k) => k < MIDDLE_C) }, { clef: 'treble', keys: keys.filter((k) => k >= MIDDLE_C) }]);
}

/**
 * The note trainer's staff for `target` on step `index`. Its frame holds the step's keys and those of every other step that
 * fits at the same staff size (AX-0: a step never gets smaller notes for another step's sake), so cycling those steps
 * leaves the staff where it is; a step that needs a smaller staff (the whole keyboard) gets its own.
 * AX-3 provisional: steps of the same size share a staff.
 */
export function noteTrainerLayout(target: number, ranges: readonly TrainerRange[], index: number, options: StaffLayoutOptions, settings: StaffSettings): StaffLayout {
  const own = ranges[index]!;
  const chart = trainerChart(target, own);
  const sizeOf = (range: TrainerRange) => layoutForSettings(chart, { ...options, reserve: rangeReserve(range) }, settings).staffSpace;
  const size = sizeOf(own);
  let frame = own;
  for (const range of ranges) {
    const wider = { low: Math.min(frame.low, range.low), high: Math.max(frame.high, range.high) };
    if (sizeOf(wider) === size) frame = wider;
  }
  return layoutForSettings(chart, { ...options, reserve: rangeReserve(frame) }, settings);
}

/**
 * The ear trainer's answer (`earAnswerChart`) on a staff with room for every answer of its row: the row's keys in each clef
 * the first note can bring (bass below middle C, treble from it up), as the second note is drawn in the first one's clef.
 */
export function earAnswerLayout(chart: Chart, rowKeys: readonly number[], options: StaffLayoutOptions, settings: StaffSettings): StaffLayout {
  const clefs: Clef[] = [...(rowKeys.some((k) => k < MIDDLE_C) ? ['bass' as const] : []), ...(rowKeys.some((k) => k >= MIDDLE_C) ? ['treble' as const] : [])];
  return layoutForSettings(chart, { ...options, reserve: reserveOf(clefs.map((clef) => ({ clef, keys: rowKeys }))) }, settings);
}

/** Every key the circle of fifths can show: its fifths and mode. */
const CIRCLE_KEYS = Array.from({ length: 15 }, (_, i) => i - 7).flatMap((fifths) => (['major', 'minor'] as const).map((mode) => ({ fifths, mode })));

/**
 * The circle of fifths' scale of `fifths` and `mode` (`scaleChart`) on one staff for every key: room for every scale's
 * notes, and the size of the key whose signature takes the most room, so choosing another key changes the notes and the
 * signature, not where the staff stands or how big it is.
 */
export function circleScaleLayout(fifths: number, mode: KeyMode, options: StaffLayoutOptions): StaffLayout {
  const scales = CIRCLE_KEYS.map((key) => scaleChart(key.fifths, key.mode));
  const positions = scales.flatMap((chart) => chart.notes.map((n) => staffPosition(n.spelling, 'treble')));
  const reserve: StaffReserve = { shortestTicks: PPQ, low: Math.min(...positions), high: Math.max(...positions), widestChord: 0 };
  const staffSpace = Math.min(...scales.map((chart) => layoutStaff(chart, { ...options, reserve }).staffSpace));
  return layoutStaff(scaleChart(fifths, mode), { ...options, reserve, staffSpace });
}
