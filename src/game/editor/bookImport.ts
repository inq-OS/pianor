/**
 * The piece maker's requests for a PDF of many pages (ft_Y_04 slice 6) to the game's own server on the computer
 * (`tools/import/bookServer.ts`): the PDF, the pictures of the chosen pages, the reading followed page by page, and the
 * parts' strips once they are saved as own pieces.
 */
import type { PhotoLayout } from '../../core/editor/photoOverlay';
import type { Chart } from '../../core/chart/schema';
import type { ScoreMarks } from '../../core/import/musicxml';
import { PHOTO_API } from './photoImport';

const BOOK_API = `${PHOTO_API}/book`;

/** A movement read: its chart, printed marks and what the reader simplified. */
export interface ReadMovement {
  chart: Chart;
  marks: ScoreMarks;
  warnings: string[];
}

/** Where a bar was found on the pages read. */
export interface BarPlace {
  page: number;
  system: number;
  x1: number;
  x2: number;
}

export type BookStatus =
  | { state: 'waiting' }
  | { state: 'reading'; page?: number; pages: number[]; seconds: number }
  | { state: 'done'; movements: ReadMovement[]; pages: number[]; uneven: number[]; layouts?: PhotoLayout[]; places?: (BarPlace | null)[][] }
  | { state: 'failed'; reason: string };

type Reply<T> = ({ ok: true } & T) | { ok: false; reason: string };

async function ask<T>(path: string, init: RequestInit, fetcher: typeof fetch): Promise<Reply<T>> {
  try {
    const res = await fetcher(`${BOOK_API}${path}`, init);
    const body = (await res.json()) as Reply<T>;
    return body && typeof body === 'object' ? body : { ok: false, reason: `the server answered ${res.status}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Sends the PDF; the book's id. */
export function sendBook(name: string, title: string, bytes: Uint8Array, fetcher: typeof fetch = fetch): Promise<Reply<{ book: string }>> {
  return ask(`?name=${encodeURIComponent(name)}&title=${encodeURIComponent(title)}`, { method: 'POST', body: new Blob([bytes as BlobPart]) }, fetcher);
}

/** Sends page `n`'s picture. */
export function sendPage(book: string, n: number, bytes: Uint8Array, fetcher: typeof fetch = fetch): Promise<Reply<object>> {
  return ask(`/${book}/page/${n}`, { method: 'POST', body: new Blob([bytes as BlobPart]) }, fetcher);
}

/** Starts reading the chosen pages. */
export function readBook(book: string, pages: readonly number[], fetcher: typeof fetch = fetch): Promise<Reply<object>> {
  return ask(`/${book}/read?pages=${pages.join(',')}`, { method: 'POST' }, fetcher);
}

/** How the reading goes. */
export async function bookStatus(book: string, fetcher: typeof fetch = fetch): Promise<BookStatus> {
  try {
    const res = await fetcher(`${BOOK_API}/${book}/status`);
    return (await res.json()) as BookStatus;
  } catch (e) {
    return { state: 'failed', reason: e instanceof Error ? e.message : String(e) };
  }
}

export function stopBook(book: string, fetcher: typeof fetch = fetch): Promise<Reply<object>> {
  return ask(`/${book}/stop`, { method: 'POST' }, fetcher);
}

/** Asks for each saved part's strip of the pages, under its own piece's id. */
export function sendParts(book: string, parts: readonly { id: string; movement: number; firstBar: number; lastBar: number }[], fetcher: typeof fetch = fetch): Promise<Reply<{ written: number }>> {
  return ask(`/${book}/parts`, { method: 'POST', body: JSON.stringify(parts), headers: { 'Content-Type': 'application/json' } }, fetcher);
}
