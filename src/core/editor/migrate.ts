/**
 * Migration of the editor's piece to version 2 (core_09.AC8, docs/decisions/notation.md#d073). Version 1
 * had no key and no note alters: every piece of it was in C with its letters natural. The step writes those values as
 * literals (d064): it never reads today's defaults, so a later change of the editor's defaults leaves old pieces alone.
 * The shapes below are frozen copies of version 1, for reading saved records and piece files.
 */
import { z } from 'zod';
import type { EditorPiece } from './model';

const noteV1 = z.object({
  hand: z.enum(['RH', 'LH']),
  bar: z.int().min(0),
  start: z.int().min(0),
  length: z.enum(['whole', 'dottedHalf', 'half', 'quarter', 'eighth']),
  step: z.enum(['C', 'D', 'E', 'F', 'G', 'A', 'B']),
  octave: z.int().min(-1).max(9),
});

/** The editor's piece as version 1 wrote it (the limits are the version 1 values). */
export const editorPieceV1Schema = z.object({
  title: z.string().max(60),
  hands: z.enum(['RH', 'LH', 'both']),
  beats: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  bars: z.int().min(1).max(32),
  bpm: z.int().min(30).max(200).optional(),
  notes: z.array(noteV1),
});
export type EditorPieceV1 = z.infer<typeof editorPieceV1Schema>;

/** Version 1 to version 2: the key is C major and every note is natural. */
export function migrateEditorPieceV1(piece: EditorPieceV1): EditorPiece {
  return {
    title: piece.title,
    hands: piece.hands,
    beats: piece.beats,
    bars: piece.bars,
    ...(piece.bpm === undefined ? {} : { bpm: piece.bpm }),
    fifths: 0,
    mode: 'major',
    notes: piece.notes.map((n) => ({ hand: n.hand, bar: n.bar, start: n.start, length: n.length, step: n.step, octave: n.octave, alter: 0 })),
  };
}
