import { printedBar } from '../core/chart';
import { barSeries, sectionPlan } from '../core/analysis/sectionPlan';
import { hottestBar, pieceHeat, weakestSections } from '../core/analysis/barHeat';
import { notesCutShort } from '../core/analysis/cutShort';
import { analyzeLayout, heatColour } from '../core/layout/analyzeLayout';
import { historyGraph } from '../core/layout/historyGraph';
import { layoutForSettings } from '../core/layout/staffSettings';
import { staffSpaceLimits } from '../core/layout/canvasSize';
import type { Rect } from '../core/layout/rect';
import { t } from '../core/text/strings';
import type { BarPlay } from '../core/progression';
import { pieceTitle } from '../core/text/pieceTitle';
import { contextOf } from './context';
import { startScene } from './scenes';
import { createBitmap } from './ui/pixel/bitmap';
import { drawnText, measure } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { PixelImage } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import { StaffView } from './ui/staff/StaffView';

export interface AnalyzeData {
  /** The piece that is analysed, for the active player. */
  chartId: string;
}

/**
 * The Analyze screen (core_10): the whole piece with every bar tinted by how it has been played (warm reds, never a
 * cross or a count of mistakes), the three weakest sections each with a proposed practice (a start tempo and a tempo ramp),
 * and the graph of how the hottest bar of the chosen section was played over time against the ideal (100 percent right the
 * first time). All numbers come from the practice log through the pure functions in `core/analysis`.
 */
export class AnalyzeScene extends PixelScene {
  private chartId = '';
  /** The weakest section whose graph is shown (index into the cards). */
  private selected = 0;
  /** The page of the staff on screen, for a piece too long to show whole (Previous and Next). */
  private page = 0;

  protected override keyboardNavigation = true;

  constructor() {
    super('analyze');
  }

  init(data: AnalyzeData): void {
    this.chartId = data.chartId;
    this.selected = 0;
    this.page = 0;
  }

  protected override back(): void {
    startScene(this, 'practice', { chartId: this.chartId });
  }

  protected draw(): void {
    const { width, height, scale } = this.px;
    const { profiles, pieces } = contextOf(this);
    const chart = pieces.find(this.chartId)?.chart;
    if (!chart) return;
    const layout = analyzeLayout(width, height);
    this.sky();
    // right of the door under the band (ft_1_20), not under it
    const titleX = this.titleX(layout.graphTitle.x);
    this.label(titleX, layout.title.y, pieceTitle(chart), C.gold, { maxWidth: layout.title.w - (titleX - layout.graphTitle.x) });

    const plays = profiles.practiceFor(this.chartId);
    const heat = pieceHeat(plays, chart.bars.length);
    const sections = weakestSections(heat);

    // the staff at screen resolution, every bar tinted by its heat
    const options = {
      viewport: { width: this.scale.width, height: layout.staff.h * scale },
      ...staffSpaceLimits(this.scale.zoom),
      staffGap: profiles.staffGap,
      noteNaming: profiles.noteNaming,
    };
    // the whole piece when it fits; a long piece one line at a time, with page buttons beside the title (never over the cards)
    let staffLayout = layoutForSettings(chart, options, { lines: 'all', barsPerLine: 'auto' });
    if (!staffLayout.fits) staffLayout = layoutForSettings(chart, options, { lines: 1, barsPerLine: 'auto' });
    const pages = staffLayout.pageCount;
    this.page = Math.min(this.page, pages - 1);
    const view = new StaffView(this, staffLayout, undefined, { noteNames: false, fingers: false }, { x: 0, y: this.mainTop + layout.staff.y * scale });
    view.showPage(this.page, false);
    if (pages > 1) {
      const turn = (page: number) => { this.page = page; this.redraw(); };
      this.button({ x: width - 32, y: layout.title.y + 4, width: 14, height: 12, label: '<', disabled: this.page === 0, onClick: () => turn(this.page - 1) });
      this.button({ x: width - 14, y: layout.title.y + 4, width: 14, height: 12, label: '>', disabled: this.page === pages - 1, onClick: () => turn(this.page + 1) });
    }
    const fills = new Map<number, number>();
    heat.forEach((h, bar) => {
      const colour = heatColour(h);
      if (colour !== null) fills.set(bar, colour);
    });
    view.setSectionMarks({ tint: [], letters: [], fills });
    this.own(view);

    // no plays yet, or no tricky spot: the plain staff says it, with no line of text
    if (plays.length === 0 || sections.length === 0) return;

    this.selected = Math.min(this.selected, sections.length - 1);
    sections.forEach((section, i) => {
      const card = layout.cards[i]!;
      const plan = sectionPlan(plays, section.first, section.last);
      // numbered as printed: a pick-up is bar 0 (core_09.AC25)
      const bars = section.first === section.last ? t('analyze.bar', { n: printedBar(chart, section.first) }) : t('analyze.bars', { first: printedBar(chart, section.first), last: printedBar(chart, section.last) });
      // one row: the bars (a tap shows their graph) and Practise with the proposed start tempo
      const barsWidth = Math.max(40, measure(drawnText(bars)) + 10);
      const practise = t('analyze.practise', { percent: plan.startPercent });
      const practiseWidth = Math.min(card.w - barsWidth - 4, Math.max(40, measure(drawnText(practise)) + 10));
      this.button({ x: card.x + barsWidth / 2, y: card.y + card.h / 2, width: barsWidth, height: card.h, label: bars, onClick: () => { this.selected = i; this.redraw(); } }).setActive(i === this.selected);
      this.button({
        x: card.x + card.w - practiseWidth / 2, y: card.y + card.h / 2, width: practiseWidth, height: card.h, label: practise,
        onClick: () => startScene(this, 'practice', { chartId: this.chartId, section: { first: plan.first, last: plan.last }, percent: plan.startPercent, ramp: plan.ramp }),
      });
    });

    // the graph of the hottest bar of the chosen section
    const chosen = sections[this.selected]!;
    const hottest = hottestBar(heat, chosen.first, chosen.last);
    this.label(layout.graphTitle.x, layout.graphTitle.y, t('analyze.graph', { n: printedBar(chart, hottest) }), C.gold, { maxWidth: layout.graphTitle.w });
    // Tempo mode with hold grading: how many of that bar's notes were let go too early over its plays, under the cards (core_01 f3)
    const short = notesCutShort(plays.filter((play) => play.bar === hottest));
    if (short) {
      const below = layout.cards[sections.length - 1]!;
      this.label(below.x, below.y + below.h + 6, t('analyze.cutShort', { n: printedBar(chart, hottest), short }), C.white, { maxWidth: below.w });
    }
    this.drawGraph(layout.plot, hottest, plays);
  }

  /** The plot: guide lines at 0, 50 and the ideal 100 percent (gold), a dot per play of the bar, oldest left. */
  private drawGraph(plot: Rect, bar: number, plays: readonly BarPlay[]): void {
    const graph = historyGraph(barSeries(plays, bar), plot);
    const box = createBitmap(plot.w + 2, plot.h + 2);
    const set = (x: number, y: number, color: number) => {
      const bx = x - plot.x + 1;
      const by = y - plot.y + 1;
      if (bx >= 0 && by >= 0 && bx < box.width && by < box.height) box.pixels[by * box.width + bx] = color;
    };
    box.pixels.fill(C.ink);
    for (const line of graph.lines) for (let x = plot.x; x < plot.x + plot.w; x += 2) set(x, line.y, line.percent === 100 ? C.gold : C.lock);
    for (const point of graph.points) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(point.x + dx, point.y + dy, point.mode === 'tempo' ? C.gold : C.blueLight);
    this.root.add(new PixelImage(this, plot.x - 1, plot.y - 1, box));
    for (const line of graph.lines) {
      const text = `${line.percent}%`;
      this.label(plot.x - 3 - measure(text), line.y - 3, text, line.percent === 100 ? C.gold : C.dim);
    }
    if (graph.total === 0) this.label(plot.x + 2, plot.y + 2, t('analyze.graphEmpty'), C.dim, { maxWidth: plot.w - 4 });
  }
}
