/**
 * The PDF import (ft_Y_04 slice 6): a plain page over the piece maker, in the browser's own look like the photo tool, for a
 * PDF of a whole piece, many pages long. The person leaves out the pages that are not the piece (a cover, text, exercises),
 * the computer reads the rest with Audiveris as one score, and before anything is saved the tool shows how the score is cut
 * into the parts of a song, drawn over the pages (d286), with Join and Split to move the cuts, and the key signature and
 * clefs to put right. Make the song then saves each part as an own piece and the song that holds them.
 */
import { bookParts, type BookMovement, type BookPart } from '../../core/import/book';
import { joinParts, proposeStarts, splitPart } from '../../core/import/songParts';
import { layoutOf } from '../../core/import/book';
import { handRanges, reclef, rekey } from '../../core/editor/photoFix';
import { keyName } from '../../core/editor/key';
import type { EditorHand, EditorPiece } from '../../core/editor/model';
import type { PhotoLayout } from '../../core/editor/photoOverlay';
import { noteLabel, type NoteNaming } from '../../core/text/noteName';
import { t } from '../../core/text/strings';
import { barsToFill } from './photoImport';
import { bookStatus, readBook, sendBook, sendPage, stopBook, type BarPlace, type BookStatus } from './bookImport';
import { jpegOf, openPdf, PAGE_WIDTH, type PdfPages } from './pdfPages';
import { titleOfName } from './photoTool';

/** What the tool needs from the piece maker. */
export interface BookToolHost {
  /** Lets the person choose another PDF. */
  pick(): Promise<{ name: string; bytes: Uint8Array } | null>;
  naming: NoteNaming;
  /**
   * Saves the parts (a song, or one piece when there is one part) and opens the result; the error to show, or null when it
   * is done and the tool may close.
   */
  make(result: { title: string; book: string; parts: BookPart[] }): Promise<string | null>;
  closed(): void;
}

/** How often the reading is asked after, in milliseconds. */
const POLL_MS = 1500;
/** The small pictures of the pages, in pixels across. */
const THUMB = 180;
/** The parts' colours over the pages: light enough to read the notes through. */
const PART_COLOURS = ['rgba(230,120,40,0.28)', 'rgba(40,120,230,0.28)', 'rgba(40,170,90,0.28)', 'rgba(180,60,180,0.28)'];
const PART_INK = ['#b35a10', '#1f5fb8', '#1d7f45', '#8a2b8a'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<Omit<HTMLElementTagNameMap[K], 'style'>> & { style?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { style, ...rest } = props;
  Object.assign(node, rest);
  if (style) node.style.cssText = style;
  node.append(...children);
  return node;
}

const BUTTON = 'font:inherit;padding:6px 14px;margin:0 6px 0 0;cursor:pointer';
/** The one button that saves: at the bar's right end, dark, apart from Back. */
const PRIMARY = 'font:inherit;font-weight:bold;padding:6px 18px;margin:0 0 0 auto;cursor:pointer;background:#1f3f7a;color:#fff;border:1px solid #1f3f7a';
/** How wide a page is drawn when looked at closely. */
const PAGE_VIEW = 1400;

/** "1 to 3" or "2": a range of numbers. */
function span(a: number, b: number): string {
  return a === b ? String(a) : t('editor.book.range', { from: a, to: b });
}

export class BookTool {
  private readonly root: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly note: HTMLDivElement;
  private pdf: PdfPages | null = null;
  private name = '';
  private title = '';
  private thumbs: HTMLCanvasElement[] = [];
  /** The pages' cards of step 1, made once per PDF and only marked again when a page is left out or taken back. */
  private cards: HTMLButtonElement[] = [];
  private pageGrid: HTMLDivElement | null = null;
  /** Where step 1's main button stands: Read, or back to a kept reading. */
  private readonly primary = el('span', { style: 'margin-left:auto;display:flex' });
  private readonly left = new Set<number>();
  private book = '';
  private movements: BookMovement[] = [];
  private done: Extract<BookStatus, { state: 'done' }> | null = null;
  private starts: number[][] = [];
  private fifths: number | null = null;
  private clefMoves: Record<EditorHand, number> = { RH: 0, LH: 0 };
  private closed = false;
  private poll: number | null = null;
  private readonly escape = (e: KeyboardEvent) => {
    // the browser's own undo and redo would reach the piece maker's title field behind the tool: only the tool's fields take them
    if ((e.ctrlKey || e.metaKey) && ['KeyZ', 'KeyY'].includes(e.code) && !(e.target instanceof Node && this.root.contains(e.target))) e.preventDefault();
    if (e.key !== 'Escape') return;
    e.preventDefault();
    // in the close view of a page, Esc goes back to the parts first
    if (this.viewing) this.showCheck();
    else this.close();
  };

  constructor(private readonly host: BookToolHost, first: { name: string; bytes: Uint8Array }) {
    this.root = el('div', { id: 'book-tool', style: 'position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;background:#f4f4f2;color:#111;font:15px system-ui,sans-serif' });
    this.note = el('div', { id: 'book-tool-note', style: 'padding:8px 12px;min-height:1.4em' });
    this.stage = el('div', { style: 'flex:1;position:relative;overflow:auto;padding:0 12px 12px' });
    this.bar = el('div', { style: 'padding:10px 12px;border-top:1px solid #ccc;display:flex;flex-wrap:wrap;align-items:center;gap:6px 0' });
    const close = el('button', { textContent: t('editor.photoTool.close'), id: 'book-tool-close', style: `${BUTTON};margin-left:auto` });
    close.onclick = () => this.close();
    const head = el('div', { style: 'display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #ccc' }, el('strong', {}, t('editor.book.title')), close);
    this.root.append(head, this.note, this.stage, this.bar);
    // the piece maker's keys are the window's: typing a title here must not write notes behind the tool
    this.root.addEventListener('keydown', (e) => e.stopPropagation());
    this.root.addEventListener('keyup', (e) => e.stopPropagation());
    document.body.append(this.root);
    window.addEventListener('keydown', this.escape, true);
    void this.load(first);
  }

  private say(text: string): void {
    this.note.textContent = text;
  }

  private buttons(...items: { label: string; id: string; act: () => void; disabled?: boolean; primary?: boolean }[]): HTMLButtonElement[] {
    return items.map((item) => {
      const b = el('button', { textContent: item.label, id: item.id, disabled: item.disabled ?? false, style: item.primary ? PRIMARY : BUTTON });
      b.onclick = item.act;
      return b;
    });
  }

  private async load(file: { name: string; bytes: Uint8Array }): Promise<void> {
    this.say(t('editor.book.opening'));
    let pdf: PdfPages;
    try {
      pdf = await openPdf(file.bytes);
    } catch {
      return this.say(t('editor.book.cannotOpen'));
    }
    if (this.closed) return pdf.close();
    this.pdf?.close();
    this.pdf = pdf;
    this.name = file.name;
    this.title = titleOfName(file.name);
    this.left.clear();
    this.thumbs = [];
    this.cards = [];
    this.book = '';
    // a reading belongs to its PDF: another PDF is read anew, never shown with the last one's parts
    this.done = null;
    this.readPages = '';
    this.movements = [];
    this.starts = [];
    this.bytes = file.bytes;
    this.showPages();
    // each page is drawn once, into its own card; nothing else on the page is drawn again (ft_Y_04.AC30)
    for (let n = 1; n <= pdf.count && !this.closed && this.pdf === pdf; n++) {
      const thumb = await pdf.render(n, THUMB * 2);
      if (this.closed || this.pdf !== pdf) return;
      this.thumbs[n - 1] = thumb;
      this.cards[n - 1]?.firstElementChild?.replaceWith(this.thumbPicture(thumb));
      this.markCard(n);
      this.refreshPages();
    }
  }

  /** A page's small picture in its card. */
  private thumbPicture(thumb: HTMLCanvasElement): HTMLCanvasElement {
    const picture = el('canvas', { width: thumb.width, height: thumb.height, style: `width:${THUMB}px;display:block` });
    picture.getContext('2d')?.drawImage(thumb, 0, 0);
    return picture;
  }

  /** A page's card as it stands: in or left out. */
  private markCard(n: number): void {
    const card = this.cards[n - 1];
    if (!card) return;
    const out = this.left.has(n);
    card.title = t(out ? 'editor.book.pageTakeBack' : 'editor.book.pageLeaveOut');
    card.style.borderColor = out ? '#ccc' : '#333';
    card.setAttribute('aria-pressed', String(!out));
    (card.firstElementChild as HTMLElement | null)?.style.setProperty('opacity', out ? '0.25' : '1');
    const label = card.lastElementChild;
    label?.replaceChildren(el('span', { textContent: out ? '☐' : '☑', style: 'font-size:18px' }), t(out ? 'editor.book.pageOut' : 'editor.book.pageIn', { n }));
  }

  private bytes: Uint8Array = new Uint8Array();
  /** The pages the reading in `done` was made of. */
  private readPages = '';
  /** True while a page is shown large. */
  private viewing = false;
  /** True while the parts are being saved: nothing closes the tool then. */
  private saving = false;

  /** The chosen pages, in order. */
  private chosen(): number[] {
    return Array.from({ length: this.pdf?.count ?? 0 }, (_, i) => i + 1).filter((n) => !this.left.has(n));
  }

  /** Step 1: the pages, all in; a click leaves one out or takes it back. */
  private showPages(): void {
    const pdf = this.pdf;
    if (!pdf) return;
    if (this.cards.length !== pdf.count || !this.pageGrid) {
      this.pageGrid = el('div', { id: 'book-tool-pages', style: 'display:flex;flex-wrap:wrap;gap:12px;padding-top:4px' });
      this.cards = Array.from({ length: pdf.count }, (_, i) => {
        const n = i + 1;
        const thumb = this.thumbs[i];
        const picture = thumb ? this.thumbPicture(thumb) : el('div', { style: `width:${THUMB}px;height:${Math.round(THUMB * 1.41)}px;background:#ddd` });
        const card = el('button', { className: 'book-tool-page', id: `book-tool-page-${n}`, style: 'font:inherit;padding:6px;background:#fff;border:2px solid #333;cursor:pointer;text-align:left' }, picture, el('div', { style: 'padding:4px 2px;display:flex;gap:6px;align-items:center' }));
        card.onclick = () => {
          if (this.left.has(n)) this.left.delete(n);
          else this.left.add(n);
          this.markCard(n);
          this.refreshPages();
        };
        return card;
      });
      this.pageGrid.append(...this.cards);
      this.cards.forEach((_, i) => this.markCard(i + 1));
    }
    this.stage.replaceChildren(this.pageGrid);
    const title = el('input', { id: 'book-tool-name', value: this.title, maxLength: 60, style: 'font:inherit;padding:5px;width:16em;margin-right:12px' });
    title.oninput = () => (this.title = title.value);
    title.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      const { same, canRead } = this.readiness();
      if (same) this.showCheck();
      else if (canRead) void this.read();
    };
    this.bar.replaceChildren(
      ...this.buttons({ label: t('editor.book.choose'), id: 'book-tool-choose', act: () => void this.choose() }),
      el('label', { style: 'margin:0 6px 0 12px' }, t('editor.book.nameLabel')),
      title,
      this.primary,
    );
    this.refreshPages();
  }

  /** What step 1 can do now: read the chosen pages once all are drawn, or go back to the reading kept for them. */
  private readiness(): { ready: number; canRead: boolean; same: boolean } {
    const count = this.pdf?.count ?? 0;
    const ready = this.thumbs.filter(Boolean).length;
    return {
      ready,
      canRead: this.chosen().length > 0 && ready === count,
      // the reading is kept while the same pages are chosen: back to it without reading again (Enter too)
      same: this.done !== null && this.readPages === this.chosen().join(','),
    };
  }

  /** Step 1's line and main button, after a page is drawn or chosen: the cards and the name field stay as they are. */
  private refreshPages(): void {
    const pdf = this.pdf;
    if (!pdf || this.stage.firstElementChild !== this.pageGrid) return;
    const { ready, canRead, same } = this.readiness();
    this.say(ready < pdf.count ? t('editor.book.preparing', { n: ready + 1, of: pdf.count }) : t('editor.book.pagesHint', { pages: pdf.count }));
    const button = same
      ? { label: t('editor.book.toParts'), id: 'book-tool-to-check', act: () => this.showCheck(), primary: true }
      : { label: ready < pdf.count ? t('editor.book.preparingShort', { n: ready + 1, of: pdf.count }) : t('editor.book.read', { pages: this.chosen().length }), id: 'book-tool-read', act: () => void this.read(), disabled: !canRead, primary: true };
    this.primary.replaceChildren(...this.buttons(button));
  }

  private async choose(): Promise<void> {
    const file = await this.host.pick();
    if (file) await this.load(file);
  }

  /** Step 2: send the PDF and the chosen pages' pictures, then follow the reading. */
  private async read(): Promise<void> {
    const pdf = this.pdf;
    if (!pdf) return;
    const pages = this.chosen();
    this.readPages = pages.join(',');
    this.done = null;
    for (const b of this.bar.querySelectorAll('button, input')) (b as HTMLButtonElement).disabled = true;
    this.say(t('editor.book.sending'));
    const made = await sendBook(this.name, this.title.trim() || titleOfName(this.name), this.bytes);
    if (!made.ok) return this.failed(made.reason);
    this.book = made.book;
    for (const [i, n] of pages.entries()) {
      if (this.closed) return;
      this.say(t('editor.book.sendingPage', { n: i + 1, of: pages.length }));
      const picture = await jpegOf(await pdf.render(n, PAGE_WIDTH));
      const sent = picture ? await sendPage(this.book, n, picture) : { ok: false as const, reason: t('editor.book.cannotOpen') };
      if (!sent.ok) return this.failed(sent.reason);
    }
    // closed while the last page was on its way: no reading is started that nothing would stop
    if (this.closed) return;
    const started = await readBook(this.book, pages);
    if (!started.ok) return this.failed(started.reason);
    this.showReading(pages.length);
  }

  private failed(reason: string): void {
    this.showPages();
    this.say(t('editor.book.failed', { reason }));
  }

  /** The reading, page by page, with Stop. */
  private showReading(pages: number): void {
    this.stage.replaceChildren(el('div', { style: 'padding:24px 0;line-height:1.8' }, t('editor.book.readingHint', { pages })));
    this.bar.replaceChildren(...this.buttons({ label: t('editor.book.stop'), id: 'book-tool-stop', act: () => void stopBook(this.book) }));
    const tick = async () => {
      this.poll = null;
      if (this.closed) return;
      const status = await bookStatus(this.book);
      if (this.closed) return;
      if (status.state === 'reading') {
        const at = status.page === undefined ? 0 : status.pages.indexOf(status.page) + 1;
        const time = t('editor.book.time', { minutes: Math.floor(status.seconds / 60), seconds: status.seconds % 60 });
        this.say(at > 0 ? t('editor.book.readingPage', { n: at, of: status.pages.length, time }) : t('editor.book.reading', { time }));
        this.poll = window.setTimeout(() => void tick(), POLL_MS);
      } else if (status.state === 'done') this.readDone(status);
      else if (status.state === 'failed') this.failed(status.reason === 'stopped' ? t('editor.book.stopped') : status.reason);
      else this.poll = window.setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
  }

  private readDone(status: Extract<BookStatus, { state: 'done' }>): void {
    this.done = status;
    this.movements = status.movements.map((m) => ({ chart: m.chart, marks: m.marks }));
    this.starts = this.movements.map((m) => proposeStarts(layoutOf(m)));
    this.fifths = null;
    this.clefMoves = { RH: 0, LH: 0 };
    this.showCheck();
  }

  /** The parts as they stand: cut, with the key signature and clefs put right. */
  private parts(): { parts: BookPart[]; message: string } {
    const title = this.title.trim() || titleOfName(this.name);
    const raw = bookParts(this.movements, this.starts, title, (n) => t('editor.book.partName', { n }));
    const firstKey = raw.find((p) => 'piece' in p);
    const readFifths = firstKey && 'piece' in firstKey ? firstKey.piece.fifths : 0;
    let message = '';
    const parts = raw.map((p) => {
      if (!('piece' in p)) return p;
      let piece: EditorPiece = p.piece;
      // the key fix is for the key the reading took for the first part; a part in a key of its own keeps it
      if (this.fifths !== null && piece.fifths === readFifths) piece = rekey(piece, this.fifths, piece.mode);
      for (const hand of ['RH', 'LH'] as const) {
        const moves = this.clefMoves[hand];
        for (let k = 0; k < Math.abs(moves); k++) {
          const moved = reclef(piece, hand, moves > 0 ? 1 : -1);
          if (moved) piece = moved;
          else message = t('editor.photoTool.offKeys');
        }
      }
      return { ...p, piece };
    });
    return { parts, message };
  }

  /** Where a part is on the pages: the pages it stands on. */
  private pagesOf(part: BookPart): number[] {
    const places = this.done?.places?.[part.movement] ?? [];
    const pages = new Set<number>();
    for (let b = part.firstBar; b <= part.lastBar; b++) {
      const place = places[b];
      if (place) pages.add(this.done?.pages[place.page] ?? 0);
    }
    return [...pages].sort((a, b) => a - b);
  }

  /** Step 3: the parts over the pages, and the list to join and split them; nothing is saved yet. */
  private showCheck(message = ''): void {
    this.viewing = false;
    const status = this.done;
    if (!status) return;
    const { parts, message: fixMessage } = this.parts();
    const indexOf = (part: BookPart) => parts.indexOf(part);
    // the picture: every chosen page with each part's bars in its colour and its number at its first bar
    const pictures = el('div', { id: 'book-tool-split', style: 'display:flex;flex-wrap:wrap;gap:12px;padding:4px 0 12px' });
    status.pages.forEach((n, i) => {
      const thumb = this.thumbs[n - 1];
      const layout = status.layouts?.[i];
      if (!thumb) return;
      const canvas = el('canvas', { width: thumb.width, height: thumb.height, style: `width:${THUMB}px;border:1px solid #999;background:#fff` });
      const g = canvas.getContext('2d');
      g?.drawImage(thumb, 0, 0);
      if (g && layout) this.drawParts(g, layout, i, parts, thumb.width / layout.width);
      const open = el('button', { id: `book-tool-look-${n}`, title: t('editor.book.look'), style: 'font:inherit;padding:0;border:0;background:none;cursor:zoom-in' }, canvas, el('div', { style: 'text-align:center' }, t('editor.book.pageIn', { n })));
      open.onclick = () => void this.showPage(i);
      pictures.append(open);
    });
    const list = el('div', { id: 'book-tool-parts', style: 'max-width:56em;line-height:1.7' });
    for (const part of parts) {
      const i = indexOf(part);
      const pages = this.pagesOf(part);
      const where = t(pages.length > 1 && pages[0] !== pages.at(-1) ? 'editor.book.wherePages' : 'editor.book.where', { bars: span(part.firstBar + 1, part.lastBar + 1), pages: pages.length ? span(pages[0]!, pages.at(-1)!) : '?' });
      // the bars to fill are counted from the book, as the bars of the list and the paper (ft_Y_04.AC29)
      const fill = 'piece' in part ? barsToFill(part.problems).map((bar) => part.firstBar + bar) : [];
      const state = 'piece' in part
        ? (fill.length === 0 ? t('editor.photoTool.noneToFill') : t('editor.photoTool.fill', { bars: fill.join(', ') }))
        : t('editor.book.blank', { reason: part.reason });
      const firstPiece = parts.find((p) => 'piece' in p);
      const ownKey = 'piece' in part && firstPiece && 'piece' in firstPiece && (part.piece.fifths !== firstPiece.piece.fifths || part.piece.mode !== firstPiece.piece.mode)
        ? ` ${t('editor.book.ownKey', { key: keyName(part.piece.fifths, part.piece.mode, this.host.naming) })}` : '';
      const local = this.localIndex(i);
      const first = this.pagesOf(part)[0];
      const split = splitPart(layoutOf(this.movements[part.movement]!), this.starts[part.movement]!, local);
      const join = joinParts(layoutOf(this.movements[part.movement]!), this.starts[part.movement]!, local);
      list.append(el('div', { className: 'book-tool-part', style: 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #ddd' },
        el('span', { style: `display:inline-block;width:14px;height:14px;background:${PART_INK[i % PART_INK.length]}` }),
        el('strong', {}, `${i + 1}. ${part.name}`), ` ${where}${ownKey} `, el('span', { style: 'color:#555' }, state),
        el('span', { style: 'margin-left:auto' }),
        ...this.buttons(
          { label: t('editor.book.show'), id: `book-tool-show-${i + 1}`, disabled: first === undefined, act: () => void this.showPage(status.pages.indexOf(first ?? 0), i) },
          { label: t('editor.book.split'), id: `book-tool-split-${i + 1}`, disabled: !split, act: () => { if (split) this.starts[part.movement] = split; this.showCheck(); } },
          { label: t('editor.book.join'), id: `book-tool-join-${i + 1}`, disabled: !join, act: () => { if (join) this.starts[part.movement] = join; this.showCheck(); } },
        )));
    }
    const fixes = this.fixes(parts);
    const uneven = status.uneven.length > 0 ? [el('div', { style: 'color:#a33' }, t('editor.book.uneven', { pages: status.uneven.join(', ') }))] : [];
    this.stage.replaceChildren(pictures, list, ...fixes, ...uneven, el('div', { id: 'book-tool-message', style: 'color:#a33' }, message || fixMessage));
    const written = parts.filter((p) => 'piece' in p).length;
    this.say(parts.length === 1 ? t('editor.book.checkOne') : t('editor.book.checkHint', { parts: parts.length }));
    this.bar.replaceChildren(...this.buttons(
      { label: t('editor.book.back'), id: 'book-tool-back', act: () => this.showPages() },
      { label: parts.length === 1 ? t('editor.photoTool.open') : t('editor.book.make', { parts: parts.length }), id: 'book-tool-make', disabled: written === 0, act: () => void this.make(parts), primary: true },
    ));
  }

  /** One chosen page large, its parts drawn over it, part `outline` framed; back to the parts. */
  private async showPage(index: number, outline?: number): Promise<void> {
    const status = this.done;
    const pdf = this.pdf;
    const layout = status?.layouts?.[index];
    const n = status?.pages[index];
    if (!status || !pdf || !layout || n === undefined) return;
    const { parts } = this.parts();
    const page = await pdf.render(n, PAGE_VIEW);
    if (this.closed || this.done !== status) return;
    const g = page.getContext('2d');
    if (g) this.drawParts(g, layout, index, parts, page.width / layout.width, outline);
    page.id = 'book-tool-page-view';
    page.style.cssText = 'display:block;max-width:100%;margin:4px auto;border:1px solid #999';
    this.stage.replaceChildren(page);
    // the part asked for is brought into view: its first bar on this page
    const part = outline === undefined ? undefined : parts[outline];
    const places = part ? (status.places?.[part.movement] ?? []).slice(part.firstBar, part.lastBar + 1) : [];
    const first = places.find((p) => p?.page === index);
    const top = first ? layout.systems[first.system]?.staves[0]?.top : undefined;
    this.stage.scrollTop = top === undefined ? 0 : Math.max(0, (top * page.clientWidth) / layout.width - 80);
    this.viewing = true;
    this.say(t('editor.book.pageIn', { n }));
    this.bar.replaceChildren(...this.buttons(
      { label: t('editor.book.toParts'), id: 'book-tool-to-parts', act: () => this.showCheck() },
      { label: t('editor.book.previous'), id: 'book-tool-previous', disabled: index === 0, act: () => void this.showPage(index - 1) },
      { label: t('editor.book.next'), id: 'book-tool-next', disabled: index + 1 >= status.pages.length, act: () => void this.showPage(index + 1) },
    ));
  }

  /** Part `i` of the book as its index among its movement's parts. */
  private localIndex(i: number): number {
    let n = i;
    for (const starts of this.starts) {
      if (n < starts.length) return n;
      n -= starts.length;
    }
    return n;
  }

  private drawParts(g: CanvasRenderingContext2D, layout: PhotoLayout, page: number, parts: readonly BookPart[], scale: number, outline?: number): void {
    parts.forEach((part, i) => {
      const places = this.done?.places?.[part.movement] ?? [];
      let labelled = false;
      for (let b = part.firstBar; b <= part.lastBar; b++) {
        const place: BarPlace | null | undefined = places[b];
        if (!place || place.page !== page) continue;
        const system = layout.systems[place.system];
        const top = system?.staves[0]?.top ?? 0;
        const bottom = system?.staves.at(-1)?.bottom ?? 0;
        g.fillStyle = PART_COLOURS[i % PART_COLOURS.length]!;
        g.fillRect(place.x1 * scale, (top - 8) * scale, (place.x2 - place.x1) * scale, (bottom - top + 16) * scale);
        if (outline === i) {
          g.strokeStyle = PART_INK[i % PART_INK.length]!;
          g.lineWidth = 3;
          g.strokeRect(place.x1 * scale, (top - 8) * scale, (place.x2 - place.x1) * scale, (bottom - top + 16) * scale);
        }
        if (!labelled && b === part.firstBar) {
          g.fillStyle = PART_INK[i % PART_INK.length]!;
          g.font = 'bold 22px system-ui,sans-serif';
          g.fillText(String(i + 1), place.x1 * scale + 2, (top - 10) * scale);
          labelled = true;
        }
      }
    });
  }

  /** The key signature and each hand's clef, put right for the whole song, as in the photo tool. */
  private fixes(parts: readonly BookPart[]): HTMLElement[] {
    const pieces = parts.flatMap((p) => ('piece' in p ? [p.piece] : []));
    const first = pieces[0];
    if (!first) return [];
    const naming = this.host.naming;
    const key = el('select', { id: 'book-tool-key', style: 'font:inherit;padding:3px' });
    for (let fifths = -7; fifths <= 7; fifths++) {
      const signs = fifths === 0 ? '' : ` (${Math.abs(fifths)}${fifths > 0 ? '♯' : '♭'})`;
      key.append(el('option', { value: String(fifths), textContent: `${keyName(fifths, first.mode, naming)}${signs}`, selected: fifths === first.fifths }));
    }
    key.onchange = () => {
      this.fifths = Number(key.value);
      this.showCheck();
    };
    // each hand's range over the whole song
    const all = pieces.flatMap((p) => handRanges(p));
    const pitch = (p: { step: EditorPiece['notes'][number]['step']; octave: number; alter: -1 | 0 | 1 }) => `${noteLabel(p, naming)}${p.octave}`;
    const hands = (['RH', 'LH'] as const).flatMap((hand) => {
      const ranges = all.filter((r) => r.hand === hand);
      if (ranges.length === 0) return [];
      const low = ranges.reduce((a, b) => (midiOf(b.low) < midiOf(a.low) ? b : a)).low;
      const high = ranges.reduce((a, b) => (midiOf(b.high) > midiOf(a.high) ? b : a)).high;
      return [el('div', { className: `book-tool-hand-${hand}`, style: 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:4px 0' },
        `${t('editor.photoTool.hand', { hand: t(hand === 'RH' ? 'editor.photoTool.rh' : 'editor.photoTool.lh'), low: pitch(low), high: pitch(high) })} `,
        ...this.buttons(
          { label: t('editor.photoTool.up'), id: `book-tool-up-${hand}`, act: () => { this.clefMoves[hand]++; this.showCheck(); } },
          { label: t('editor.photoTool.down'), id: `book-tool-down-${hand}`, act: () => { this.clefMoves[hand]--; this.showCheck(); } },
        ))];
    });
    return [el('div', { style: 'margin-top:12px' }, `${t('editor.photoTool.key')} `, key), ...hands];
  }

  private async make(parts: BookPart[]): Promise<void> {
    this.saving = true;
    for (const b of this.bar.querySelectorAll('button')) b.disabled = true;
    this.say(t('editor.book.saving'));
    const error = await this.host.make({ title: this.title.trim() || titleOfName(this.name), book: this.book, parts });
    this.saving = false;
    if (this.closed) return;
    if (error) {
      this.showCheck(error);
      return;
    }
    this.destroy();
  }

  close(): void {
    if (this.closed || this.saving) return;
    // a reading of many pages took minutes: it is not thrown away by a slip of Esc
    if ((this.done !== null || this.poll !== null) && !window.confirm(t('editor.book.discard'))) return;
    if (this.book && this.done === null) void stopBook(this.book);
    this.destroy();
    this.host.closed();
  }

  destroy(): void {
    this.closed = true;
    if (this.poll !== null) window.clearTimeout(this.poll);
    window.removeEventListener('keydown', this.escape, true);
    this.pdf?.close();
    this.root.remove();
  }
}

const STEP_SEMITONES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOf(p: { step: string; octave: number; alter: number }): number {
  return (p.octave + 1) * 12 + (STEP_SEMITONES[p.step] ?? 0) + p.alter;
}
