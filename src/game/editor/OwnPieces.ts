import { z } from 'zod';
import levelsJson from '../../../content/curriculum/levels.json';
import { checkPiece } from '../../core/piece/check';
import { unlimitedLevels } from '../../core/piece/levelsTable';
import { levelsFileSchema, type Chart, type LevelDefinition } from '../../core/chart';
import { toAbc, toMeta } from '../../core/editor/abc';
import { editorPieceV1Schema, migrateEditorPieceV1 } from '../../core/editor/migrate';
import { editorPieceSchema, playedPiece, setTitle, type EditorPiece } from '../../core/editor/model';
import { freeTitle } from '../../core/editor/title';
import { exportPieceFile, importPieceFile, ownIdFor, pieceFileName, type ImportRefusal } from '../../core/editor/pieceFile';
import type { KeyValueStore } from '../../core/progression';
import type { PieceProblem } from '../../core/text/labels';
import type { Piece } from '../pieceList';
import { pieceStyles } from '../menu/pieceStyles';

/** Own pieces live on this device, one key each, next to the saves. */
const PREFIX = 'pianor/v1/own-piece/';
/** The record format this build writes: 2 adds the key and the note alters (core_09.AC8). Format 1 is still read. */
export const OWN_PIECE_FORMAT = 2;

/** A saved own piece: the editor's piece (to edit again) and the two files it makes (to compile, and later to export). */
const recordFields = {
  id: z.string().regex(/^own-[a-z0-9]+(-[a-z0-9]+)*$/),
  savedAt: z.string().min(1),
  author: z.string(),
  contentVersion: z.int().positive(),
  abc: z.string().min(1),
  meta: z.string().min(1),
};
const recordSchema = z.object({ ...recordFields, schemaVersion: z.literal(OWN_PIECE_FORMAT), piece: editorPieceSchema });
/** Format 1 (frozen, d073): read and migrated to the current format when loaded; never written again. */
const recordV1Schema = z.object({ ...recordFields, schemaVersion: z.literal(1), piece: editorPieceV1Schema });
export type OwnRecord = z.infer<typeof recordSchema>;

/** Reads a saved record of any format this build knows, as the current format; null when it is not one. */
function readRecord(raw: unknown): OwnRecord | null {
  const current = recordSchema.safeParse(raw);
  if (current.success) return current.data;
  const old = recordV1Schema.safeParse(raw);
  if (!old.success) return null;
  return { ...old.data, schemaVersion: OWN_PIECE_FORMAT, piece: migrateEditorPieceV1(old.data.piece) };
}

const LEVELS: readonly LevelDefinition[] = levelsFileSchema.parse(levelsJson).levels;
/** Own pieces have no limits: chords, accidentals and every key pass the level check (core_09.AC1). */
const CHECK_LEVELS: readonly LevelDefinition[] = unlimitedLevels(LEVELS);

export interface OwnCompiled {
  abc: string;
  meta: string;
  chart: Chart | null;
  /** The curriculum level it is checked against: the lowest it fits, or the highest when it fits none. */
  level: number;
  fitsLevels: number[];
  /** The checker's problems a person should see, errors first; `problemLabel` turns one into text. */
  problems: (PieceProblem & { severity: 'error' | 'warning' })[];
}

/** Write a piece's two files and run the same check as `piece:lint`, against the lowest level it fits. */
export function compileOwn(piece: EditorPiece, options: { id: string; author: string; contentVersion?: number }): OwnCompiled {
  // the files are made for the hands that have notes: an empty hand of a two-hand piece is not played
  const played = playedPiece(piece);
  const run = (level: number) => {
    const abc = toAbc(played);
    const meta = JSON.stringify(toMeta(played, { ...options, level }), null, 2);
    return { abc, meta, check: checkPiece({ styles: pieceStyles, folder: null, abc, meta, levels: CHECK_LEVELS, privatePiece: true }) };
  };
  const first = run(LEVELS[0]!.level);
  const level = first.check.fitsLevels[0] ?? LEVELS[LEVELS.length - 1]!.level;
  const best = level === LEVELS[0]!.level ? first : run(level);
  const problems = best.check.diagnostics
    .map((d) => ({ severity: d.severity, message: d.message, ...(d.rule ? { rule: d.rule } : {}), ...(d.bar ? { bar: d.bar } : {}) }))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return { abc: best.abc, meta: best.meta, chart: best.check.compiled.chart ?? null, level, fitsLevels: first.check.fitsLevels, problems };
}

/** A title as letters and digits joined by dashes, at most 30 long; cut, it must not end on a dash, which no piece id may. */
export type ImportOutcome = { ok: true; id: string; title: string; saved: boolean } | { ok: false; reason: ImportRefusal | 'empty' | 'not-drawable'; message: string };

export type SaveResult = { ok: true; id: string; saved: boolean } | { ok: false; reason: 'empty' | 'not-drawable'; message: string };

/**
 * The player's own pieces from the editor: kept on this device (no limits on who writes them), each
 * playable at once from level 1 and earning XP like any piece. Licence "NaN"; never written to `content/pieces/`.
 */
export class OwnPieces {
  private readonly records = new Map<string, { record: OwnRecord; chart: Chart | null; level: number }>();
  /** Saved pieces that could not be read (kept in storage untouched). */
  unreadable = 0;

  private constructor(private readonly store: KeyValueStore, private readonly now: () => Date) {}

  static async load(store: KeyValueStore, now: () => Date = () => new Date()): Promise<OwnPieces> {
    const own = new OwnPieces(store, now);
    for (const key of await store.keys(PREFIX)) {
      try {
        const raw = await store.get(key);
        const record = readRecord(raw === null ? null : JSON.parse(raw));
        if (!record) {
          own.unreadable++;
          continue;
        }
        own.remember(record);
      } catch {
        own.unreadable++;
      }
    }
    return own;
  }

  /** Every own piece, by title. */
  list(): OwnRecord[] {
    return [...this.records.values()].map((r) => r.record).sort((a, b) => a.piece.title.localeCompare(b.piece.title) || a.id.localeCompare(b.id));
  }

  get(id: string): OwnRecord | null {
    return this.records.get(id)?.record ?? null;
  }

  /** The own pieces as the game offers pieces: approved by whoever saved them, open from level 1. */
  pieces(): Piece[] {
    return [...this.records.values()].flatMap(({ record, chart, level }) =>
      chart ? [{ chart, status: 'approved' as const, level, unlockLevel: 1, source: `own: ${record.author}`, own: true }] : []);
  }

  /** Save a new piece (no `id`) or a new version of one. Refused when it has no notes or cannot be drawn. */
  async save(piece: EditorPiece, options: { id?: string | undefined; author: string }): Promise<SaveResult> {
    if (piece.notes.length === 0) return { ok: false, reason: 'empty', message: 'no notes' };
    const previous = options.id ? this.records.get(options.id)?.record : undefined;
    const id = previous?.id ?? this.freeId(piece.title);
    const contentVersion = (previous?.contentVersion ?? 0) + 1;
    const compiled = compileOwn(piece, { id, author: options.author, contentVersion });
    if (!compiled.chart) return { ok: false, reason: 'not-drawable', message: compiled.problems[0]?.message ?? 'it does not compile' };
    const record: OwnRecord = {
      schemaVersion: OWN_PIECE_FORMAT, id, savedAt: this.now().toISOString(), author: options.author, contentVersion,
      piece: editorPieceSchema.parse(piece), abc: compiled.abc, meta: compiled.meta,
    };
    this.records.set(id, { record, chart: compiled.chart, level: compiled.level });
    try {
      await this.store.set(PREFIX + id, JSON.stringify(record));
      return { ok: true, id, saved: true };
    } catch {
      return { ok: true, id, saved: false };
    }
  }

  /** A saved piece as a piece file to download (ft_1_02b), or null when there is no such piece. */
  exportFile(id: string): { name: string; text: string } | null {
    const record = this.records.get(id)?.record;
    if (!record) return null;
    const { author, contentVersion, piece, abc, meta } = record;
    return { name: pieceFileName(id), text: exportPieceFile({ id, author, contentVersion, piece, abc, meta }) };
  }

  /**
   * Add the piece in a piece file as a new own piece (a new id when its title is taken: an import never replaces a piece).
   * `reservedIds` are the ids of the bundled pieces, which a file must not claim. A title another piece has (an own piece, or
   * one of `takenTitles`, the game's pieces), in any case, gets the next free number (ft_1_02a.AC15).
   */
  async importFile(text: string, options: { reservedIds?: Iterable<string>; takenTitles?: Iterable<string> } = {}): Promise<ImportOutcome> {
    const read = importPieceFile(text, options);
    if (!read.ok) return read;
    const { author } = read.file;
    const piece = this.withFreeTitle(read.file.piece, options.takenTitles ?? []);
    const saved = await this.save(piece, { author });
    if (!saved.ok) return saved;
    return { ok: true, id: saved.id, title: piece.title, saved: saved.saved };
  }

  /** The piece with a title no own piece and none of `takenTitles` has: its own, or that with the next free number (ft_1_02a.AC15). */
  withFreeTitle(piece: EditorPiece, takenTitles: Iterable<string>): EditorPiece {
    const title = freeTitle(piece.title, [...takenTitles, ...this.list().map((r) => r.piece.title)]);
    return title === piece.title || title === '' ? piece : setTitle(piece, title);
  }

  async remove(id: string): Promise<void> {
    this.records.delete(id);
    await this.store.remove(PREFIX + id);
  }

  private remember(record: OwnRecord): void {
    const compiled = compileOwn(record.piece, { id: record.id, author: record.author, contentVersion: record.contentVersion });
    this.records.set(record.id, { record, chart: compiled.chart, level: compiled.level });
  }

  private freeId(title: string): string {
    const base = ownIdFor(title);
    let id = base;
    for (let n = 2; this.records.has(id); n++) id = `${base}-${n}`;
    return id;
  }
}
