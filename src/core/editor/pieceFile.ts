/**
 * Own pieces as files (ft_1_02b): one JSON "piece file" holds an own piece (the editor's piece, and the ABC and meta text it
 * makes), so it can be moved to another device and read back. Pure: text in, text out, no DOM; the game layer does the
 * download and the file picker. Reading never throws on user input: a bad file comes back as a reason with a readable
 * message (string keys, like all text). The format is persisted, so it has a `schemaVersion` (docs/decisions/notation.md#d050).
 */
import { z } from 'zod';
import { OWN_PIECE_LICENSE } from '../chart/schema';
import { t, type StringKey } from '../text/strings';
import { editorPieceSchema, pieceProblem, type EditorPiece } from './model';
import { editorPieceV1Schema, migrateEditorPieceV1 } from './migrate';

/** Marks the file as a Pianor piece file, so another JSON file is told apart from a damaged piece file. */
export const PIECE_FILE_KIND = 'pianor-piece';
/** The version this build writes and reads. Older versions get a migration here when one exists; newer ones are refused. */
export const PIECE_FILE_VERSION = 3;
/** The only licence an own piece has: it is private, and its licence does not matter here. */
export const OWN_LICENSE = OWN_PIECE_LICENSE;
/** Ids of own pieces; every bundled piece has another kind of id, so an own piece can never take its place. */
export const OWN_ID = /^own-[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The id a new own piece with this title starts from (before a number is added when it is taken): its words in lower-case
 * letters and digits, a letter with a mark as the letter (ä as a, õ as o). The photo import names the folder of a piece's
 * photo the same way, so the piece maker finds the photo of a piece it saved (ft_Y_04.AC16).
 */
export function ownIdFor(title: string): string {
  const words = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return `own-${words.join('-').slice(0, 30).replace(/-+$/, '') || 'piece'}`;
}

/** The file in the order it is written (the key order is part of the committed fixtures). */
const pieceFileShape = <V extends number, P extends z.ZodType>(version: V, piece: P) => z.object({
  kind: z.literal(PIECE_FILE_KIND),
  schemaVersion: z.literal(version),
  id: z.string().regex(OWN_ID),
  /** Who wrote it (the player's name when it was saved). */
  author: z.string().max(200),
  contentVersion: z.int().positive(),
  piece,
  abc: z.string().min(1),
  meta: z.string().min(1),
});
const pieceFileSchema = pieceFileShape(3, editorPieceSchema);
/** Version 2: the same piece without ties (core_09.AC13); a version 2 piece is a version 3 piece with no tied notes. */
const pieceFileV2Schema = pieceFileShape(2, editorPieceSchema);
/** Version 1 (frozen, d073): the same file with the piece as version 1 wrote it; read with `migrateEditorPieceV1`. */
const pieceFileV1Schema = pieceFileShape(1, editorPieceV1Schema);

/** An own piece as a file holds it. */
export type PieceFile = Omit<z.infer<typeof pieceFileSchema>, 'kind' | 'schemaVersion'>;

export type ImportRefusal =
  | 'not-json' // the text is not JSON at all
  | 'not-a-piece-file' // JSON, but not made by Pianor
  | 'newer-version' // made by a newer Pianor than this one
  | 'invalid' // a Pianor piece file whose content is wrong
  | 'not-own' // the piece is not an own piece (its licence is not "NaN", or its id is not an own id)
  | 'reserved-id'; // the id belongs to a bundled piece

export type PieceImportResult = { ok: true; file: PieceFile } | { ok: false; reason: ImportRefusal; message: string };

const refuse = (reason: ImportRefusal): PieceImportResult => ({ ok: false, reason, message: t(`editor.import.${reason}` as StringKey) });

/** The piece as the text of a piece file. */
export function exportPieceFile(file: PieceFile): string {
  const body = { kind: PIECE_FILE_KIND, schemaVersion: PIECE_FILE_VERSION, ...file };
  return `${JSON.stringify(pieceFileSchema.parse(body), null, 2)}\n`;
}

/** A file name for the download: the id, as lower-case letters, digits and hyphens. */
export function pieceFileName(id: string): string {
  return `${id}.pianor-piece.json`;
}

/**
 * Read the text of a piece file. `reservedIds` are the ids of the bundled pieces: a file must not claim one (it would
 * replace a piece that is not the player's own). The result is the same piece the file was made from; the game then saves
 * it as a new own piece, so it never overwrites anything either.
 */
export function importPieceFile(text: string, options: { reservedIds?: Iterable<string> } = {}): PieceImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return refuse('not-json');
  }
  if (typeof raw !== 'object' || raw === null || (raw as { kind?: unknown }).kind !== PIECE_FILE_KIND) return refuse('not-a-piece-file');
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return refuse('not-a-piece-file');
  if (version > PIECE_FILE_VERSION) return refuse('newer-version');
  // a version 1 file is read as version 2: its piece gets the key C and natural notes (core_09.AC8); version 2 has no ties to read (core_09.AC13)
  const parsed = version === 1 ? pieceFileV1Schema.safeParse(raw) : version === 2 ? pieceFileV2Schema.safeParse(raw) : pieceFileSchema.safeParse(raw);
  if (!parsed.success) return refuse(parsed.error.issues.some((i) => i.path[0] === 'id') ? 'not-own' : 'invalid');
  const { id, author, contentVersion, abc, meta: metaText } = parsed.data;
  const piece: EditorPiece = parsed.data.schemaVersion === 1 ? migrateEditorPieceV1(parsed.data.piece) : parsed.data.piece;
  // the editor's own rules, for the whole piece: nothing outside the keyboard, the grid or the bar gets in through a file
  if (pieceProblem(piece) !== null) return refuse('invalid');
  const file: PieceFile = { id, author, contentVersion, piece, abc, meta: metaText };

  let meta: unknown;
  try {
    meta = JSON.parse(file.meta);
  } catch {
    return refuse('invalid');
  }
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return refuse('invalid');
  const { license, id: metaId } = meta as { license?: unknown; id?: unknown };
  if (license !== OWN_LICENSE) return refuse('not-own');
  if (metaId !== file.id) return refuse('invalid');
  if ([...(options.reservedIds ?? [])].includes(file.id)) return refuse('reserved-id');
  return { ok: true, file };
}
