/**
 * The key that was played, as a faint note on the staff (ft_1_12.AC7): after a wrong key the student sees which note they
 * played, in the awaited note's column, instead of a sentence about it (the clean-screen rule). It
 * names what was played and says nothing about which way to go, so the student still reads the awaited note.
 * Pure: the practice view only draws it.
 */
import { ledgerLinePositions, midiToSpelling, staffPosition, type Chart, type Spelling } from '../chart';
import { keyAlters, keyAt } from '../chart/key';
import { ACCIDENTAL_BOX, accidentalKind } from './accidentals';
import type { StaffLayout } from './staffTypes';

export interface PlayedMark {
  system: number;
  /** Head centre: just right of the awaited note's column (further right when it prints an accidental), so a neighbour key does not cover the note to read. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** The played key spelled in the piece's key: sharps, or flats in a flat key. */
  spelling: Spelling;
  /** The accidental to print left of the head (1 sharp, -1 flat, 0 natural), or null when the key signature says it. */
  accidental: number | null;
  /** The centre of the accidental: between the awaited note's head and the mark's own ink, clear of both. */
  accidentalX: number;
  ledgerLines: { y: number; x1: number; x2: number }[];
}

/** Ledger lines reach this many head half-widths each side of the head, as on the notes. */
const LEDGER_REACH = 1.6;
/** The mark stands this many head half-widths right of the awaited column. */
export const PLAYED_OFFSET = 2.6;
/** Staff spaces of clear room each side of the mark's accidental, as between an accidental and its note. */
const ACCIDENTAL_CLEAR = 0.2;

/** Where `midi` goes next to the awaited notes (`awaited`, indexes into `chart.notes`): on the staff of the nearest one in pitch. Null when none of them is laid out. */
export function playedMark(layout: StaffLayout, chart: Chart, awaited: readonly number[], midi: number): PlayedMark | null {
  const glyphs = layout.notes.filter((g) => awaited.includes(g.index));
  const nearest = glyphs.reduce<(typeof glyphs)[number] | null>((best, g) => {
    if (!best) return g;
    return Math.abs(chart.notes[g.index]!.midi - midi) < Math.abs(chart.notes[best.index]!.midi - midi) ? g : best;
  }, null);
  if (!nearest) return null;
  const staff = layout.systems[nearest.system]!.staves[nearest.staff]!;
  const fifths = keyAt(chart.keyMap, chart.notes[nearest.index]!.tick).fifths;
  const spelling = midiToSpelling(midi, fifths < 0);
  const position = staffPosition(spelling, staff.clef);
  const S = layout.staffSpace;
  const yOf = (p: number) => staff.bottomLineY - (p * S) / 2;
  const reach = nearest.headRx * LEDGER_REACH;
  const keyAlter = keyAlters(fifths)[spelling.step];
  const accidental = keyAlter === spelling.alter ? null : spelling.alter;
  const ledgers = ledgerLinePositions(position);
  // a printed accidental stands right of the awaited head and pushes the mark right by its width, so it covers neither
  const signWidth = accidental === null ? 0 : ACCIDENTAL_BOX[accidentalKind(accidental)].width * S;
  const accidentalX = nearest.column + nearest.headRx + ACCIDENTAL_CLEAR * S + signWidth / 2;
  const leftReach = ledgers.length > 0 ? reach : nearest.headRx;
  const x = accidental === null
    ? nearest.column + nearest.headRx * PLAYED_OFFSET
    : Math.max(nearest.column + nearest.headRx * PLAYED_OFFSET, accidentalX + signWidth / 2 + ACCIDENTAL_CLEAR * S + leftReach);
  return {
    system: nearest.system,
    x,
    y: yOf(position),
    rx: nearest.headRx,
    ry: nearest.headRy,
    spelling,
    accidental,
    accidentalX,
    ledgerLines: ledgers.map((p) => ({ y: yOf(p), x1: x - reach, x2: x + reach })),
  };
}
