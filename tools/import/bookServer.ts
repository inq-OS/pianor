/**
 * The PDF import's requests on the game's own server (ft_Y_04 slice 6), beside the photo import (`tools/vite-photo.ts`): the
 * piece maker sends a PDF and the pictures of the pages chosen (the browser renders them), asks for the book to be read,
 * follows the reading page by page, and once the parts are saved as own pieces asks for each part's strip of the pages. One
 * book is read at a time. Everything stays under the gitignored `private/photo/`: a PDF from a lesson is mostly copyrighted.
 *
 * Requests, all under `/__pianor/photo/book`:
 * - `POST ?name=&title=` with the PDF: a new book, answered with its id;
 * - `POST /<book>/page/<n>` with page n's picture (JPEG or PNG);
 * - `POST /<book>/read?pages=1,2,5`: Audiveris starts on those pages;
 * - `GET /<book>/status`: reading (with the page), done (the movements read, the pages whose bars to check), failed;
 * - `POST /<book>/stop`;
 * - `POST /<book>/parts` with `[{ id, movement, firstBar, lastBar }]`: each part's strip and bar map under its piece's id.
 */
import { join } from 'node:path';
import type { PhotoLayout } from '../../src/core/editor/photoOverlay';
import type { MusicXmlResult, ScoreMarks } from '../../src/core/import/musicxml';
import type { Chart } from '../../src/core/chart/schema';
import type { BookRun } from './audiveris';
import { matchBars, partStrip, type BarPlace } from './bookPhoto';
import type { Gray } from './clean';
import { pageLayout } from './page';
import { PHOTO_MAP, sheetOfLine, type PhotoMap } from './photo';

export const BOOK_PATH = '/book';
/** The most pages one book may have. */
export const MAX_PAGES = 200;
/** The name of a part's strip picture beside its bar map. */
export const STRIP = 'strip.png';

/** The server's files, Audiveris and pictures, as the book requests see them (faked in the tests). */
export interface BookIo {
  readonly inDir: string;
  readonly outDir: string;
  available(): { ok: true } | { ok: false; reason: string };
  writeFile(path: string, bytes: Uint8Array): void;
  read(pdf: string, sheets: readonly number[], outDir: string, line: (text: string) => void): BookRun;
  readScore(path: string): MusicXmlResult;
  /** A page picture as grey, or null when it cannot be read. */
  decode(path: string): Gray | null;
  encodePng(img: Gray): Uint8Array;
  now(): number;
}

/** A movement as the piece maker gets it: its chart, printed marks and what the reader simplified. */
export interface BookMovementReply {
  readonly chart: Chart;
  readonly marks: ScoreMarks;
  readonly warnings: string[];
}

export type BookStatus =
  | { state: 'waiting' }
  | { state: 'reading'; page?: number; pages: number[]; seconds: number }
  | { state: 'done'; movements: BookMovementReply[]; pages: number[]; uneven: number[]; layouts: PhotoLayout[]; places: (BarPlace | undefined)[][] }
  | { state: 'failed'; reason: string };

interface Book {
  readonly id: string;
  readonly dir: string;
  readonly pdf: string;
  readonly pageFiles: Map<number, string>;
  status: BookStatus;
  run?: BookRun;
  started?: number;
  layouts?: PhotoLayout[];
  places?: (BarPlace | undefined)[][];
}

/** A part whose strip is asked for: the own piece's id and its bars in its movement. */
export interface PartAsk {
  readonly id: string;
  readonly movement: number;
  readonly firstBar: number;
  readonly lastBar: number;
}

function slug(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '') || 'book';
}

export type Answer = { status: number; body: unknown };
const ok = (body: unknown): Answer => ({ status: 200, body });
const no = (reason: string, status = 200): Answer => ({ status, body: { ok: false, reason } });

/** The book requests; `busy` is shared with the photo import, so one Audiveris runs at a time. */
export class BookServer {
  private readonly books = new Map<string, Book>();
  private reading: Book | null = null;

  constructor(private readonly io: BookIo) {}

  /** True while a book is being read. */
  busy(): boolean {
    return this.reading !== null;
  }

  /** A new book from its PDF. */
  create(title: string, bytes: Uint8Array): Answer {
    if (bytes.length < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') return no('the file is not a PDF');
    let id = `book-${slug(title)}`;
    for (let n = 2; this.books.has(id); n++) id = `book-${slug(title)}-${n}`;
    const dir = join(this.io.inDir, id);
    const pdf = join(dir, 'book.pdf');
    this.io.writeFile(pdf, bytes);
    this.books.set(id, { id, dir, pdf, pageFiles: new Map(), status: { state: 'waiting' } });
    return ok({ ok: true, book: id });
  }

  /** Page `n`'s picture, as the browser rendered it. */
  page(id: string, n: number, bytes: Uint8Array): Answer {
    const book = this.books.get(id);
    if (!book) return no('no such book', 404);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGES) return no('no such page');
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    if (!jpeg && !png) return no('the page is not a JPEG or PNG picture');
    const file = join(book.dir, `page-${n}.${jpeg ? 'jpg' : 'png'}`);
    this.io.writeFile(file, bytes);
    book.pageFiles.set(n, file);
    return ok({ ok: true });
  }

  /** Starts reading the chosen pages; one book at a time. */
  read(id: string, pages: readonly number[], photoBusy: boolean): Answer {
    const book = this.books.get(id);
    if (!book) return no('no such book', 404);
    if (pages.length === 0) return no('no page chosen');
    const missing = pages.filter((p) => !book.pageFiles.has(p));
    if (missing.length > 0) return no(`the pictures of pages ${missing.join(', ')} did not arrive`);
    if (this.reading || photoBusy) return no('another sheet is being read: wait for it');
    const ready = this.io.available();
    if (!ready.ok) return ok(ready);
    const sorted = [...new Set(pages)].sort((a, b) => a - b);
    book.started = this.io.now();
    const status: Extract<BookStatus, { state: 'reading' }> = { state: 'reading', pages: sorted, seconds: 0 };
    book.status = status;
    this.reading = book;
    book.run = this.io.read(book.pdf, sorted, join(book.dir, 'audiveris'), (line) => {
      // Audiveris numbers the sheets of the whole PDF
      const sheet = sheetOfLine(line);
      if (sheet !== undefined && sorted.includes(sheet)) status.page = sheet;
    });
    void book.run.done.then((run) => {
      this.reading = null;
      if (!run.ok) {
        book.status = { state: 'failed', reason: run.reason === 'stopped' ? 'stopped' : `Audiveris could not read it: ${run.reason}` };
        return;
      }
      const movements: BookMovementReply[] = [];
      for (const score of run.scores) {
        const read = this.io.readScore(score);
        if (!read.ok) {
          book.status = { state: 'failed', reason: `Not taken: ${read.reason}` };
          return;
        }
        movements.push({ chart: read.chart, marks: read.marks, warnings: read.warnings });
      }
      book.layouts = sorted.map((p) => {
        const img = this.io.decode(book.pageFiles.get(p) ?? '');
        return img ? pageLayout(img) : { width: 1, height: 1, systems: [] };
      });
      const matched = matchBars(movements.map((m) => ({ bars: m.chart.bars.length, marks: m.marks })), book.layouts);
      book.places = matched.places;
      // the layouts and places let the piece maker draw each proposed part over the pages it chose
      book.status = { state: 'done', movements, pages: sorted, uneven: matched.uneven.map((i) => sorted[i] ?? 0), layouts: book.layouts, places: matched.places };
    });
    return ok({ ok: true });
  }

  status(id: string): Answer {
    const book = this.books.get(id);
    if (!book) return no('no such book', 404);
    const status = book.status;
    if (status.state === 'reading') status.seconds = Math.round((this.io.now() - (book.started ?? 0)) / 1000);
    return ok(status);
  }

  stop(id: string): Answer {
    const book = this.books.get(id);
    if (!book) return no('no such book', 404);
    book.run?.stop();
    return ok({ ok: true });
  }

  /** Each part's strip of the pages and its bar map, under its own piece's folder, where the piece maker finds it. */
  parts(id: string, asks: readonly PartAsk[]): Answer {
    const book = this.books.get(id);
    if (!book || book.status.state !== 'done' || !book.layouts || !book.places) return no('the book is not read', 404);
    const pages = book.status.pages;
    const images = pages.map((p) => this.io.decode(book.pageFiles.get(p) ?? '') ?? { width: 1, height: 1, data: new Uint8Array([255]) });
    let written = 0;
    for (const ask of asks) {
      if (!/^own-[a-z0-9]+(-[a-z0-9]+)*$/.test(ask.id)) return no(`not an own piece's id: ${ask.id}`);
      const bars = book.places[ask.movement]?.slice(ask.firstBar, ask.lastBar + 1) ?? [];
      const strip = partStrip(images, book.layouts, bars);
      if (!strip) continue;
      const dir = join(this.io.outDir, ask.id);
      this.io.writeFile(join(dir, STRIP), this.io.encodePng(strip.image));
      const map: PhotoMap = { image: STRIP, layout: strip.layout };
      this.io.writeFile(join(dir, PHOTO_MAP), new TextEncoder().encode(`${JSON.stringify(map)}\n`));
      written++;
    }
    return ok({ ok: true, written });
  }
}
