import { printedBar } from '../core/chart';
import { partsInOrder } from '../core/chart/parts';
import { partStars } from '../core/analysis/partStars';
import { GRADE_STARS } from '../core/scoring/stars';
import { cardGrid } from '../core/layout/cardGrid';
import { pageOf } from '../core/layout/paging';
import { rectCentre } from '../core/layout/rect';
import { pieceTitle } from '../core/text/pieceTitle';
import { t } from '../core/text/strings';
import { contextOf } from './context';
import { C } from './ui/pixel/palette';
import { pixelStars, PixelText } from './ui/pixel/PixelObjects';
import { STAR_FULL } from './ui/pixel/sprites';
import { PixelScene } from './ui/pixel/PixelScene';
import { startScene } from './scenes';

const MARGIN = 12;
const TITLE_Y = 8;
const LIST_TOP = 32;
const ROW_HEIGHT = 28;
const ROW_GAP = 2;
/** A part's stars and bars sit at the card's right end, this far in from the edge; the stars are this far apart. */
const BARS_INSET = 5;
const STAR_GAP = 2;
const STARS_WIDTH = GRADE_STARS * (STAR_FULL.width + STAR_GAP) - STAR_GAP;
/** The open book's margin inside its cover and the gutter between its pages, in cells. */
const BOOK_MARGIN = 14;
const BOOK_GUTTER = 18;

/** What the scene is started with: the piece, which must have parts. */
export interface PartsData {
  chartId: string;
}

/**
 * A piece's parts (core_06, slice A), opened from the song list for a piece that has them. The whole piece comes first,
 * then one card per part in reading order. A tap on the whole piece starts it as usual; a tap on a part practises its bars as
 * a section (core_03), which earns no XP and is not saved.
 */
export class PartsScene extends PixelScene {
  private chartId = '';
  private page = 0;

  protected override keyboardNavigation = true;

  constructor() {
    super('parts');
  }

  init(data: PartsData): void {
    this.chartId = data.chartId;
    this.page = 0;
  }

  protected override back(): void {
    startScene(this, 'menu');
  }

  protected draw(): void {
    const { width, height } = this.px;
    const piece = contextOf(this).pieces.find(this.chartId);
    this.sky();
    this.label(this.titleX(MARGIN), TITLE_Y, piece ? pieceTitle(piece.chart) : t('parts.title'), C.gold, { big: true, maxWidth: width - 2 * MARGIN });
    if (!piece) return;

    const parts = partsInOrder(piece.chart.phrases);
    const plays = contextOf(this).profiles.practiceFor(this.chartId);
    // the parts are written in the open book on the desk, as the song list is
    this.openBook({ x: 3, y: LIST_TOP - 6, w: width - 6, h: height - LIST_TOP + 5 });
    this.inkWriting = true;
    const grid = cardGrid({ width, height, top: LIST_TOP, margin: BOOK_MARGIN, rowHeight: ROW_HEIGHT, rowGap: ROW_GAP, columnGap: BOOK_GUTTER });
    // item 0 is the whole piece; item n is part n - 1
    const slice = pageOf(parts.length + 1, this.page, { singlePageMax: grid.singlePageMax, perPage: grid.perPage });
    this.page = slice.page;

    for (let i = 0; i < slice.count; i++) {
      const item = slice.first + i;
      // read as a book: down the left page, then down the right
      const { x, y } = rectCentre(grid.pageCell(i, slice.paged ? grid.perPage : grid.singlePageMax));
      if (item === 0) {
        this.button({
          x, y: y - ROW_HEIGHT / 4, width: grid.cardWidth, height: ROW_HEIGHT / 2, label: t('parts.whole'), look: 'ink', align: 'left', labelWidth: grid.cardWidth - 12,
          onClick: () => startScene(this, 'practice', { chartId: this.chartId }),
        });
        continue;
      }
      const part = parts[item - 1]!;
      const card = this.button({
        x, y: y - ROW_HEIGHT / 4, width: grid.cardWidth, height: ROW_HEIGHT / 2, label: part.name, look: 'ink', align: 'left', labelWidth: grid.cardWidth - 12,
        onClick: () => startScene(this, 'practice', { chartId: this.chartId, section: { first: part.startBar, last: part.endBar } }),
      });
      // the line under the name: which bars, then the part's stars (on their own line, so a long name never runs into them: the name and "Bars 1-4" were drawn over each other)
      const second = card.rect.y + ROW_HEIGHT / 2 + 1;
      const bars = new PixelText(this, card.rect.x + 6, second + 1, t('parts.bars', { first: printedBar(piece.chart, part.startBar), last: printedBar(piece.chart, part.endBar) }), { color: C.umberDark });
      const starsX = Math.max(bars.x + bars.width + 6, card.rect.x + grid.cardWidth - BARS_INSET - STARS_WIDTH);
      const stars = pixelStars(this, this.root, starsX, second, partStars(plays, part.startBar, part.endBar), { gap: STAR_GAP, ink: true });
      this.root.add(bars);
      card.attach(bars, ...stars);
    }

    if (slice.paged) {
      this.pager(slice, (page) => {
        this.page = page;
        this.redraw();
      });
    }
  }
}
