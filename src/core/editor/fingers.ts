/**
 * AUTO fingers (ft_1_02d.AC13, AC23, ft_1_30): fills the finger of every note that has none with the cheapest fingering of
 * each hand's part (`bestFingering`), fitted around the fingers the author wrote, which are kept. The fingers AUTO wrote are
 * marked (`fingerAuto`) and fitted again each time, so an author's change is never overwritten; with a scope only AUTO's own
 * fingers of one hand's bar are fitted again, around everything else. Where the level teaches a hand position (`fingerings`
 * in content/curriculum/levels.json) its fingers are preferred. A note of a chord of more than five keys, or of a chord
 * whose written fingers clash, is left and counted. Pure.
 */
import type { Finger } from '../fingering/costs';
import { bestFingering } from '../fingering/search';
import { handSlices, type HandNote } from '../fingering/slices';
import { LENGTH_TICKS, soundingMidi, tickOf, type EditorHand, type EditorNote, type EditorPiece } from './model';

/** The part of a level this needs: the fingers of each hand's position, by note name (`C4`) for naturals. */
export interface FingerTable {
  fingerings: Partial<Record<'RH' | 'LH', Record<string, number>>>;
}

export interface AutoFingers {
  piece: EditorPiece;
  /** Notes that got a finger now. */
  filled: number;
  /** Notes whose AUTO finger was fitted again to another finger. */
  changed: number;
  /** Notes that still have no finger after this. */
  unfilled: number;
}

const asFinger = (n: number | undefined): Finger | undefined => (n !== undefined && n >= 1 && n <= 5 ? (n as Finger) : undefined);

/** Fit only AUTO's own fingers of this hand's bar again (ft_1_02d.AC23): after the author set a finger there. */
export interface FingerScope {
  hand: EditorHand;
  bar: number;
}

export function autoFingers(piece: EditorPiece, level: FingerTable, scope?: FingerScope): AutoFingers {
  const notes: EditorNote[] = [...piece.notes];
  // the notes AUTO may write: in the whole piece those with no finger or AUTO's own; in a scope only AUTO's own of that bar
  const free = (n: EditorNote): boolean => (scope ? n.hand === scope.hand && n.bar === scope.bar && n.fingerAuto === true : n.finger === undefined || n.fingerAuto === true);
  let filled = 0;
  let changed = 0;
  for (const hand of ['RH', 'LH'] as const satisfies readonly EditorHand[]) {
    if (scope && scope.hand !== hand) continue;
    const indices = notes.map((n, i) => (n.hand === hand ? i : -1)).filter((i) => i >= 0);
    if (indices.length === 0) continue;
    const table = level.fingerings[hand];
    const handNotes: HandNote[] = indices.map((i) => {
      const n = notes[i]!;
      const start = tickOf(piece, n.bar, n.start);
      return {
        midi: soundingMidi(n),
        start,
        end: start + LENGTH_TICKS[n.length],
        finger: free(n) ? undefined : asFinger(n.finger),
        tieNext: n.tieNext,
        preferred: n.alter === 0 ? asFinger(table?.[`${n.step}${n.octave}`]) : undefined,
      };
    });
    const { slices, places } = handSlices(handNotes);
    const best = bestFingering(hand, slices);
    indices.forEach((i, k) => {
      const n = notes[i]!;
      if (!free(n)) return;
      const place = places[k]!;
      const finger = best.fingers[place.slice]?.[place.key];
      if (finger === undefined || finger === n.finger) return;
      if (n.finger === undefined) filled++;
      else changed++;
      notes[i] = { ...n, finger, fingerAuto: true };
    });
  }
  const unfilled = notes.filter((n) => n.finger === undefined).length;
  return { piece: { ...piece, notes }, filled, changed, unfilled };
}
