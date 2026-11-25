/**
 * Photo import (ft_Y_04 slice 3): a scan, photo or PDF of a sheet becomes an own piece file the piece maker imports.
 * Audiveris (AGPL-3.0, a separate program the person installs; never bundled or copied) reads the image to MusicXML; the
 * slice 1 reader makes it a chart; `fromChart` makes that a piece of the piece maker and lists what it could not hold. A
 * MusicXML file (one Audiveris or MuseScore wrote) is taken as it is. Everything is written under the gitignored
 * `private/photo/`: school sheets are mostly copyrighted, so the result is an own piece (licence "NaN") and never committed.
 *
 * The menu (`photoMenu`) talks through a small `MenuIo`, so the whole flow is tested with fakes; `photo-cli.ts` only
 * wires it to the terminal, the file system and the Audiveris process.
 */
import { basename, extname, join } from 'node:path';
import type { MusicXmlResult } from '../../src/core/import/musicxml';
import { fromChart, problemLabel, type ImportProblem } from '../../src/core/editor/fromChart';
import { toAbc, toMeta } from '../../src/core/editor/abc';
import { exportPieceFile, ownIdFor, pieceFileName } from '../../src/core/editor/pieceFile';
import type { EditorPiece } from '../../src/core/editor/model';
import { photoLayout, type Cleaned } from './clean';

/** Where the sheets are looked for and where the results go (both under the gitignored `private/`). */
export const PHOTO_IN = join('private', 'photo', 'in');
export const PHOTO_OUT = join('private', 'photo', 'out');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.pdf']);
const SCORE_EXTENSIONS = new Set(['.mxl', '.musicxml', '.xml']);

/** What a file in the input folder is: an image for Audiveris, a score read as it is, or neither. */
export function sheetKind(name: string): 'image' | 'score' | null {
  const ext = extname(name).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (SCORE_EXTENSIONS.has(ext)) return 'score';
  return null;
}

/** The sheets of a folder listing, in name order. */
export function sheetsIn(names: readonly string[]): string[] {
  return names.filter((n) => sheetKind(n) !== null).sort((a, b) => a.localeCompare(b));
}

/**
 * Where Audiveris may be, first match wins: the `AUDIVERIS` environment variable, the installer's folders on Windows, the
 * Linux package's folder, then the name alone (found on the PATH).
 */
export function audiverisCandidates(platform: string, env: Readonly<Record<string, string | undefined>>): string[] {
  const list: string[] = [];
  if (env.AUDIVERIS) list.push(env.AUDIVERIS);
  if (platform === 'win32') {
    for (const root of [env.ProgramFiles ?? 'C:\\Program Files', env['ProgramFiles(x86)'], env.LOCALAPPDATA && `${env.LOCALAPPDATA}\\Programs`]) {
      if (root) list.push(`${root}\\Audiveris\\Audiveris.exe`);
    }
  } else {
    list.push('/opt/audiveris/bin/Audiveris', '/Applications/Audiveris.app/Contents/MacOS/Audiveris');
  }
  list.push('audiveris');
  return list;
}

/** Audiveris's command line: transcribe without its window and export MusicXML (`.mxl`) into `outDir`. */
export function audiverisArgs(input: string, outDir: string): string[] {
  return ['-batch', '-export', '-output', outDir, '--', input];
}

/**
 * The MusicXML Audiveris wrote for `input`, from the files under its output folder: `<name>.mxl`, or for a book of several
 * movements the first one (`<name>.mvt1.mxl`). Undefined when there is none (Audiveris read no music).
 */
export function exportOf(input: string, files: readonly string[]): string | undefined {
  const base = basename(input, extname(input)).toLowerCase();
  const scores = files.filter((f) => sheetKind(f) === 'score' && basename(f).toLowerCase().startsWith(base)).sort((a, b) => a.length - b.length || a.localeCompare(b));
  return scores[0];
}

/** Audiveris's command line for a book: the chosen sheets (pages, from 1) of a PDF read as one score, exported as MusicXML. */
export function audiverisBookArgs(input: string, outDir: string, sheets: readonly number[]): string[] {
  return ['-batch', '-export', '-output', outDir, '-sheets', ...sheets.map(String), '--', input];
}

/** Every MusicXML Audiveris wrote for a book, in movement order (`<name>.mxl`, or `<name>.mvt1.mxl`, `.mvt2.mxl`, ...). */
export function exportsOf(input: string, files: readonly string[]): string[] {
  const base = basename(input, extname(input)).toLowerCase();
  const movement = (f: string): number => Number(/\.mvt(\d+)\.[^.]+$/i.exec(f)?.[1] ?? 0);
  return files.filter((f) => sheetKind(f) === 'score' && basename(f).toLowerCase().startsWith(base)).sort((a, b) => movement(a) - movement(b) || a.localeCompare(b));
}

/** The sheet (page) Audiveris says it is working on in a line of its log, if it names one (the word sheet, a hash sign, its number). */
export function sheetOfLine(line: string): number | undefined {
  const m = /sheet\s*#\s*(\d+)/i.exec(line);
  return m ? Number(m[1]) : undefined;
}

/** The scores of an earlier run in an output folder: removed before Audiveris runs, so a failed run never reports an old result. */
export function staleScores(files: readonly string[]): string[] {
  return files.filter((f) => sheetKind(f) === 'score');
}

/**
 * The Audiveris program to start, from the candidates and which of them exist. A set `AUDIVERIS` that does not exist is an
 * error, so a typo is not hidden behind the PATH. A `.bat` or `.cmd` cannot be started without a shell.
 */
export function pickAudiveris(candidates: readonly string[], exists: (path: string) => boolean, env: Readonly<Record<string, string | undefined>>): { ok: true; exe: string } | { ok: false; reason: string } {
  if (env.AUDIVERIS && !exists(env.AUDIVERIS)) return { ok: false, reason: `AUDIVERIS is set to ${env.AUDIVERIS}, which does not exist` };
  if (env.AUDIVERIS && /\.(bat|cmd)$/i.test(env.AUDIVERIS)) return { ok: false, reason: `AUDIVERIS must name the program itself (Audiveris.exe), not a .bat or .cmd file` };
  return { ok: true, exe: candidates.find((c) => c === 'audiveris' || exists(c)) ?? 'audiveris' };
}

/**
 * What to do when Audiveris read no music, from its log: the known failures in plain words, else nothing. "No regularly
 * spaced lines" means it found no staff spacing to trust, usually a photo taken at an angle: the lines are wider apart
 * at the near edge of the page than at the far one (measured on the first test photo: 36 to 49 pixels).
 */
export function audiverisHint(log: string): string | undefined {
  if (log.includes('No regularly spaced lines')) {
    return 'Audiveris found no evenly spaced staff lines. The photo is probably taken at an angle, so the lines are further apart at one edge than at the other. Scan the page flat (a flatbed scanner, or a phone scanning app that straightens the page, saved as PDF or JPG) and read it again.';
  }
  return undefined;
}

/** The title a sheet starts with: its file name, as words. */
export function titleOf(file: string): string {
  return basename(file, extname(file)).replace(/[_-]+/g, ' ').trim() || 'Imported piece';
}

export interface Imported {
  id: string;
  piece: EditorPiece;
  /** The piece file's text, ready to write. */
  file: string;
  fileName: string;
  problems: ImportProblem[];
  warnings: string[];
}

/** A read score as an own piece file, or why it cannot be one. */
export function importScore(read: MusicXmlResult, title: string): { ok: true; imported: Imported } | { ok: false; reason: string } {
  if (!read.ok) return { ok: false, reason: read.reason };
  const made = fromChart(read.chart, { title });
  if (!made.ok) return { ok: false, reason: made.reason };
  const id = ownIdFor(made.piece.title);
  const author = 'photo import';
  const meta = toMeta(made.piece, { id, level: 1, author });
  const file = exportPieceFile({ id, author, contentVersion: 1, piece: made.piece, abc: toAbc(made.piece), meta: `${JSON.stringify(meta, null, 2)}\n` });
  return { ok: true, imported: { id, piece: made.piece, file, fileName: pieceFileName(id), problems: made.problems, warnings: [...read.warnings, ...made.warnings] } };
}

const KEY_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR_NAMES = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];

/** The report shown in the terminal and written beside the piece file. */
export function reportLines(imported: Imported, savedAt: string): string[] {
  const p = imported.piece;
  const hands = p.hands === 'both' ? 'both hands' : p.hands === 'RH' ? 'right hand' : 'left hand';
  const key = p.mode === 'major' ? `${KEY_NAMES[p.fifths + 7]} major` : `${MINOR_NAMES[p.fifths + 7]} minor`;
  const lines = [`"${p.title}": ${p.bars} bars, ${hands}, ${p.beats}/4, ${key}, ${p.bpm ?? 80} a minute, ${p.notes.length} notes taken.`];
  if (imported.problems.length === 0) lines.push('Nothing left to fill by hand: check every bar against the paper anyway.');
  else {
    lines.push(`To fill by hand (${imported.problems.length}):`);
    for (const pr of imported.problems) lines.push(`  ${problemLabel(pr)}`);
  }
  if (imported.warnings.length > 0) {
    lines.push('Also:');
    for (const w of imported.warnings) lines.push(`  ${w}`);
  }
  lines.push(`Saved: ${savedAt}`, 'Open the piece maker, press Import, choose that file, fix it against the paper and save.');
  return lines;
}

export type Recognised = { ok: true; score: string; cleaned?: { file: string; result: Cleaned } } | { ok: false; reason: string };

/** The name of the bar map written beside a cleaned photo: where each bar of the piece is on it (ft_Y_04.AC16). */
export const PHOTO_MAP = 'photo.json';

/** The bar map of a cleaned photo, as written: the picture's file name and its layout. */
export interface PhotoMap {
  readonly image: string;
  readonly layout: ReturnType<typeof photoLayout>;
}

/** What reading one sheet gave: the piece and its report, or why there is none. */
export type SheetResult = { ok: true; imported: Imported; lines: string[]; saved: string; stavesUneven?: boolean } | { ok: false; reason: string };

/**
 * Reads one sheet into an own piece file and its report in `outDir` (and, for a cleaned photo, the bar map beside the
 * cleaned picture): what the menu and the piece maker's photo import both do.
 */
export async function readSheet(io: Pick<MenuIo, 'recognise' | 'readScore' | 'write'>, path: string, title: string, outDir: string): Promise<SheetResult> {
  let score = path;
  let cleaned: { file: string; result: Cleaned } | undefined;
  const dir = join(outDir, ownIdFor(title));
  if (sheetKind(path) === 'image') {
    const run = await io.recognise(path, dir);
    if (!run.ok) return { ok: false, reason: `Audiveris could not read it: ${run.reason}` };
    score = run.score;
    cleaned = run.cleaned;
  }
  const result = importScore(io.readScore(score), title);
  if (!result.ok) return { ok: false, reason: `Not taken: ${result.reason}` };
  const saved = join(outDir, result.imported.fileName);
  const lines = reportLines(result.imported, saved);
  io.write(saved, result.imported.file);
  io.write(join(outDir, `${result.imported.id}.report.txt`), `${lines.join('\n')}\n`);
  let stavesUneven = false;
  if (cleaned?.result.straightened) {
    const perSystem = result.imported.piece.hands === 'both' ? 2 : 1;
    const map: PhotoMap = { image: basename(cleaned.file), layout: photoLayout(cleaned.result.image, cleaned.result.staves, perSystem) };
    io.write(join(dir, PHOTO_MAP), `${JSON.stringify(map)}\n`);
    // a staff missed or found twice puts every later system's bars off: the person is told to move the photo
    stavesUneven = cleaned.result.staves.length % perSystem !== 0;
  }
  return { ok: true, imported: result.imported, lines, saved, ...(stavesUneven ? { stavesUneven } : {}) };
}

/** The terminal, the files and Audiveris, as the menu sees them. */
export interface MenuIo {
  ask(question: string): Promise<string>;
  say(line: string): void;
  list(dir: string): string[];
  /** Runs Audiveris on an image (cleaned first); the MusicXML path it wrote and the cleaning, or why not. */
  recognise(image: string, outDir: string): Promise<Recognised>;
  readScore(path: string): MusicXmlResult;
  write(path: string, text: string): void;
}

/** The menu: choose a sheet, give it a title, read it, see the report; again, the next sheet or quit. */
export async function photoMenu(io: MenuIo, folder = PHOTO_IN, outDir = PHOTO_OUT): Promise<void> {
  io.say('Pianor photo import: a scan, photo or PDF of a sheet to a piece for the piece maker.');
  for (;;) {
    const sheets = sheetsIn(io.list(folder));
    io.say('');
    io.say(`Sheets in ${folder}:`);
    if (sheets.length === 0) io.say('  (none yet: put scans, photos, PDFs or MusicXML files there)');
    sheets.forEach((s, i) => io.say(`  ${i + 1}  ${s}`));
    io.say('  f  another folder    r  look again    q  quit');
    const answer = (await io.ask('Choose: ')).trim().toLowerCase();
    if (answer === 'q') return;
    if (answer === '' || answer === 'r') continue;
    if (answer === 'f') {
      const next = (await io.ask('Folder: ')).trim();
      if (next) folder = next;
      continue;
    }
    const sheet = sheets[Number(answer) - 1];
    if (!sheet) { io.say(`No sheet ${answer}.`); continue; }
    const title = (await io.ask(`Title [${titleOf(sheet)}]: `)).trim() || titleOf(sheet);
    for (;;) {
      await readOne(io, join(folder, sheet), title, outDir);
      const then = (await io.ask('a  read it again    n  another sheet    q  quit: ')).trim().toLowerCase();
      if (then === 'q') return;
      if (then !== 'a') break;
    }
  }
}

async function readOne(io: MenuIo, path: string, title: string, outDir: string): Promise<void> {
  if (sheetKind(path) === 'image') io.say('Reading the sheet with Audiveris (about a minute a page)...');
  const result = await readSheet(io, path, title, outDir);
  if (!result.ok) return io.say(result.reason);
  for (const line of result.lines) io.say(line);
}
