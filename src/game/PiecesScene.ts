import { cabinetLayout, libraryDrawers, openDrawerLayout, type Box, type Drawer } from '../core/layout/libraryDrawers';
import { pieceTitle } from '../core/text/pieceTitle';
import { pageOf } from '../core/layout/paging';
import { rectCentre } from '../core/layout/rect';
import { t } from '../core/text/strings';
import { contextOf } from './context';
import type { Piece } from './content';
import { C } from './ui/pixel/palette';
import { drawnText, LINE_GAP, LINE_HEIGHT, wrap } from './ui/pixel/font';
import { createBitmap } from './ui/pixel/bitmap';
import { ART_DETAIL } from '../core/layout/frame';
import type { PixelImage } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import { CABINET_PALETTE, drawerLabelBox, paintCabinet, paintDrawerFront, paintDrawerInside, paintIndexCard } from './ui/pixel/paint/cabinet';
import { paintedOnce } from './ui/pixel/paintedOnce';
import { startScene } from './scenes';
import type { MenuData } from './MenuScene';

const MARGIN = 12;
/** The list starts this far down, or lower when a notice takes more than one line; it keeps this much room under the notice. */
const LIST_TOP = 38;
const LIST_GAP = 3;
/** The header lines: title, player name, and the notice line (hint or why a tap did nothing); Back sits level with them. */
const TITLE_Y = 8;
const NOTICE_Y = 26;
/** The on/off word at a card's right end: this far in from the edge, in cells. */
const STATE_INSET = 6;

/** `back`: the catalogue was opened from the book (ft_1_02c.AC9), and Back goes to that book again, not to Settings. */
export interface PiecesData {
  back?: MenuData;
}

/** A piece in the catalogue: its title as the menu shows it. */
interface Filed { id: string; title: string; piece: Piece }

/**
 * Every piece (hand-written, generated and own), where the active player turns each one on or off, as a library's card
 * catalogue (ft_1_02c.AC7): a cabinet of drawers sorted by first letter (`libraryDrawers`), a
 * drawer with no pieces a blank front that takes no tap; an open drawer shows its index cards, one per piece, and a tap
 * on a card turns its piece on or off. A piece that is off is hidden from the menu and from the tugs; its stars stay.
 * The last piece that is on cannot be turned off. The rules live in `core/progression/pieceSwitch`; this screen only
 * draws them and saves through `ProfileService`.
 */
export class PiecesScene extends PixelScene {
  private page = 0;
  /** The open drawer's place in the cabinet (labels can repeat: a full `#` drawer), or null while the cabinet is shown. */
  private open: number | null = null;
  /** What the line under the title says: the hint, or why a tap did nothing. */
  private notice: 'hint' | 'lastOne' | 'saveFailed' = 'hint';

  protected override keyboardNavigation = true;

  constructor() {
    super('pieces');
  }

  /** The book the catalogue was opened from, if any (ft_1_02c.AC9). */
  private fromBook: MenuData | null = null;

  init(data?: PiecesData): void {
    this.fromBook = data?.back ?? null;
    this.page = 0;
    this.open = null;
    this.notice = 'hint';
  }

  /** Back closes an open drawer first, then goes to Settings, or to the book it was opened from. */
  protected override back(): void {
    if (this.open !== null) {
      this.open = null;
      this.redraw();
      return;
    }
    if (this.fromBook) startScene(this, 'menu', this.fromBook);
    else startScene(this, 'settings');
  }

  /** The drawer that holds the piece with this title, its label and its place in the cabinet (for the end-to-end tests), or null. */
  drawerOf(title: string): { label: string; index: number } | null {
    const index = this.drawers().findIndex((d) => d.pieces.some((p) => p.title === title));
    return index < 0 ? null : { label: this.drawers()[index]!.label, index };
  }

  /** The page of drawers shown now (for the end-to-end tests). */
  get cabinetPage(): number {
    return this.page;
  }

  private drawers(): Drawer<Filed>[] {
    return libraryDrawers(contextOf(this).pieces.list().map((piece) => ({ id: piece.chart.id, title: pieceTitle(piece.chart), piece })));
  }

  protected draw(): void {
    const { width, height } = this.px;
    this.sky();
    const title = this.label(this.titleX(MARGIN), TITLE_Y, t('pieces.title'), C.gold, { big: true });
    const notices = { hint: t(this.open === null ? 'pieces.cabinet' : 'pieces.hint'), lastOne: t('pieces.lastOne'), saveFailed: t('pieces.saveFailed') };
    const noticeWidth = width - 2 * MARGIN;
    this.label(MARGIN, NOTICE_Y, notices[this.notice], this.notice === 'hint' ? C.dim : C.gold, { maxWidth: noticeWidth });
    // the cabinet starts under the longest notice, so it stays in place when a tap changes the notice (a wrapped Estonian hint)
    const noticeLines = Math.max(...Object.values(notices).map((n) => wrap(drawnText(n), noticeWidth).length));
    const top = Math.max(LIST_TOP, NOTICE_Y + noticeLines * LINE_HEIGHT - LINE_GAP + LIST_GAP);
    const drawers = this.drawers();
    const open = this.open === null ? undefined : drawers[this.open];
    if (open) {
      this.label(title.x + title.width * 2 + 10, TITLE_Y, open.label, C.goldLight, { big: true });
      this.drawOpen(open, width, height, top);
    } else {
      this.open = null;
      this.drawCabinet(drawers, width, height, top);
    }
  }

  /** A painted picture on the fine grid over `box` (cells), from the catalogue's painter, kept by its size. */
  private painted(box: Box, key: string, paint: (w: number, h: number) => ReturnType<typeof paintCabinet>): PixelImage {
    const w = box.w * ART_DETAIL, h = box.h * ART_DETAIL;
    return this.fineImage(box.x * ART_DETAIL, box.y * ART_DETAIL, paintedOnce(`${key}:${w}x${h}`, () => paint(w, h)), CABINET_PALETTE);
  }

  /** The cabinet: a front for each drawer, labelled and pullable where it holds pieces, blank where it does not. */
  private drawCabinet(drawers: Drawer<Filed>[], width: number, height: number, top: number): void {
    const { cabinet, fronts } = cabinetLayout(width, height, top);
    const slice = pageOf(drawers.length, this.page, { singlePageMax: fronts.length, perPage: fronts.length });
    this.page = slice.page;
    this.painted(cabinet, 'cabinet', paintCabinet);
    fronts.forEach((front, i) => {
      const drawer = i < slice.count ? drawers[slice.first + i] : undefined;
      if (!drawer) {
        this.painted(front, `front-blank-${i % 5}`, (w, h) => paintDrawerFront(w, h, false, false, i % 5));
        return;
      }
      const seed = (slice.first + i) % 5;
      const image = this.painted(front, `front-${seed}`, (w, h) => paintDrawerFront(w, h, true, false, seed));
      const pulled = paintedOnce(`front-pulled-${seed}:${front.w * ART_DETAIL}x${front.h * ART_DETAIL}`, () => paintDrawerFront(front.w * ART_DETAIL, front.h * ART_DETAIL, true, true, seed));
      const rest = paintedOnce(`front-${seed}:${front.w * ART_DETAIL}x${front.h * ART_DETAIL}`, () => paintDrawerFront(front.w * ART_DETAIL, front.h * ART_DETAIL, true, false, seed));
      const box = drawerLabelBox(front.w * ART_DETAIL, seed);
      this.inkWriting = true;
      const label = this.label(0, front.y + Math.floor(box.y / ART_DETAIL) + 2, drawer.label, C.white, { maxWidth: Math.floor(box.w / ART_DETAIL) });
      label.centerAt(front.x + (box.x + box.w / 2) / ART_DETAIL);
      this.inkWriting = false;
      const button = this.button({
        ...rectCentre(front), width: front.w, height: front.h, label: drawer.label, picture: createBitmap(front.w, front.h),
        onHover: (over) => image.setBitmap(over ? pulled : rest, CABINET_PALETTE),
        onClick: () => {
          this.open = slice.first + i;
          this.notice = 'hint';
          this.redraw();
        },
      });
      // the letters on the label are the drawer's own
      button.attach(label);
    });
    if (slice.paged) {
      this.pager(slice, (page) => {
        this.page = page;
        this.redraw();
      });
    }
  }

  /** An open drawer: its index cards, each with the piece's title over the red rule and its state; a tap turns the piece on or off. */
  private drawOpen(drawer: Drawer<Filed>, width: number, height: number, top: number): void {
    const profiles = contextOf(this).profiles;
    const { drawer: box, cards } = openDrawerLayout(width, height, top);
    this.painted(box, 'drawer-inside', paintDrawerInside);
    drawer.pieces.forEach((filed, i) => {
      const card = cards[i]!;
      const on = profiles.isPieceOn(filed.id);
      this.painted(card, `index-${on ? 'on' : 'off'}-${i}`, (w, h) => paintIndexCard(w, h, on, i));
      this.inkWriting = true;
      const state = this.label(0, 0, on ? t('pieces.on') : t('pieces.off'), on ? C.gold : C.lock);
      state.setPosition(card.x + card.w - STATE_INSET - state.width, card.y + Math.max(1, Math.round(card.h * 0.62) - state.height - 1));
      const name = this.label(card.x + STATE_INSET, state.y, filed.title, C.white, { maxWidth: card.w - 3 * STATE_INSET - state.width });
      this.inkWriting = false;
      const button = this.button({
        ...rectCentre(card), width: card.w, height: card.h, label: filed.title, keepCase: true, picture: createBitmap(card.w, card.h),
        onClick: () => {
          void profiles.setPieceOn(filed.id, !on).then(({ changed, saved }) => {
            this.notice = !saved ? 'saveFailed' : !changed && on ? 'lastOne' : 'hint';
            this.redraw();
          });
        },
      });
      button.attach(state);
      button.attach(name);
    });
  }
}
