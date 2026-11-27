import { printedBar } from '../core/chart';
import { barStrip, learnStatsLayout, statsGraph, type LearnStatsLayout, type StatsGraph, type StripCell } from '../core/layout/learnStatsLayout';
import { rectCentre, rectRight, type Rect } from '../core/layout/rect';
import type { LearnTest } from '../core/learn/progress';
import {
  barProfile, DAY_FILTERS, DEFAULT_STATS_FILTER, filterTests, focusHints, KIND_FILTERS, MEASURES, measureSeries, seriesTrend, type Focus, type Measure, type StatsFilter,
} from '../core/learn/stats';
import { baselineBpm } from '../core/learn/tempo';
import { focusLine, MEANING_PAGES, meaningLine, measureValue } from '../core/text/learnStatsText';
import { pieceTitle } from '../core/text/pieceTitle';
import { t, type StringKey } from '../core/text/strings';
import { dayString } from '../io/teacher/teacherDesk';
import { contextOf } from './context';
import { startScene } from './scenes';
import { createBitmap } from './ui/pixel/bitmap';
import { measure as textWidth } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { PixelImage } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import type { SongReturn } from './songReturn';

export interface LearnStatsData {
  /** The piece whose learning is shown, for the active player. */
  chartId: string;
  /** A song's play (ft_1_36): handed back to the score screen, so its Back still leads to the song. */
  fromSong?: SongReturn | undefined;
}

const MONTHS: readonly StringKey[] = ['month.1', 'month.2', 'month.3', 'month.4', 'month.5', 'month.6', 'month.7', 'month.8', 'month.9', 'month.10', 'month.11', 'month.12'];
/** The measures where zero is the aim: their scale starts there. */
const FROM_ZERO: ReadonlySet<Measure> = new Set(['sd', 'mad', 'halts', 'hands', 'drift']);
/** The strip's tints, from a bar played as the rest to the slowest. */
const STRIP_TINTS = [C.cream, C.orangeLight, C.orange, C.red] as const;
const HELP_LINE_GAP = 4;
const PAGE_BUTTON = 14;

/** A day as the player reads it: day and month. */
function dayLabel(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  return t('stats.date', { day: date ?? 0, month: t(MONTHS[(month ?? 1) - 1] ?? 'month.1') });
}

const next = <T,>(all: readonly T[], now: T): T => all[(all.indexOf(now) + 1) % all.length]!;

/**
 * The learning stats of one piece (ft_1_32.AC9, AC10; always shown visually and filterable,
 * with a page that explains the meanings and what to focus on). Every number is a picture: the chosen measure
 * over the measured runs with its trend line, and the piece's bars tinted by their pace. Buttons choose the measure, the
 * kind of test and the days. The `?` opens the pages in words: what to work on by the latest runs, then what each number
 * means and what to aim for. All numbers come from the pure functions in `core/learn/stats`.
 */
export class LearnStatsScene extends PixelScene {
  private chartId = '';
  private filter: StatsFilter = DEFAULT_STATS_FILTER;
  /** The help page shown (0: what to work on, then the meanings), or null for the graph. */
  private help: number | null = null;
  /** What is drawn, kept for the tests. */
  protected graph: StatsGraph | null = null;
  protected strip: StripCell[] = [];
  protected focus: Focus[] = [];

  protected override keyboardNavigation = true;

  constructor() {
    super('learn-stats');
  }

  private fromSong: SongReturn | undefined = undefined;

  init(data: LearnStatsData): void {
    this.chartId = data.chartId;
    this.fromSong = data.fromSong;
    this.filter = DEFAULT_STATS_FILTER;
    this.help = null;
  }

  protected override back(): void {
    if (this.help !== null) {
      this.help = null;
      this.redraw();
      return;
    }
    startScene(this, 'results', { chartId: this.chartId, ...(this.fromSong ? { fromSong: this.fromSong } : {}) });
  }

  protected draw(): void {
    const { width, height } = this.px;
    const { profiles, pieces } = contextOf(this);
    const chart = pieces.find(this.chartId)?.chart;
    if (!chart) return;
    const layout = learnStatsLayout(width, height, MEASURES.length, this.bandShown ? { rightInset: width - this.cornerStrip.right } : {});
    this.sky();
    const progress = profiles.learnProgressOf(this.chartId);
    const all = progress.tests ?? [];
    const baseline = baselineBpm(progress.bpm ?? []);
    const titleX = this.titleX(layout.title.x);
    const title = baseline === null ? t('learnStats.title', { title: pieceTitle(chart) }) : t('learnStats.titleTempo', { title: pieceTitle(chart), bpm: baseline });
    this.label(titleX, layout.title.y, title, C.gold, { maxWidth: layout.title.w - (titleX - layout.title.x) });
    this.button({
      ...rectCentre(layout.help), label: this.help === null ? '?' : 'x', tooltip: t(this.help === null ? 'learnStats.help' : 'learnStats.helpBack'),
      onClick: () => {
        this.help = this.help === null ? 0 : null;
        this.redraw();
      },
    });
    this.focus = focusHints(all);
    this.graph = null;
    this.strip = [];
    if (this.help !== null) {
      this.drawHelp(layout, (bar) => printedBar(chart, bar));
      return;
    }
    const tests = filterTests(all, this.filter, dayString(new Date()));
    this.drawFilters(layout, tests);
    this.drawGraph(layout.plot, tests, baseline);
    this.drawStrip(layout, tests, chart.bars.length, (bar) => printedBar(chart, bar));
  }

  /** The measures in a row, the two filters that step through their choices, and the latest value with its trend. */
  private drawFilters(layout: LearnStatsLayout, tests: readonly LearnTest[]): void {
    const choose = (filter: Partial<StatsFilter>) => {
      this.filter = { ...this.filter, ...filter };
      this.redraw();
    };
    MEASURES.forEach((measure, i) => {
      this.button({ ...rectCentre(layout.measures[i]!), label: t(`learnStats.measure.${measure}`), onClick: () => choose({ measure }) }).setActive(measure === this.filter.measure);
    });
    this.button({ ...rectCentre(layout.kind), label: t(`learnStats.kind.${this.filter.kind}`), onClick: () => choose({ kind: next(KIND_FILTERS, this.filter.kind) }) });
    this.button({ ...rectCentre(layout.days), label: t(`learnStats.days.${this.filter.days}`), onClick: () => choose({ days: next(DAY_FILTERS, this.filter.days) }) });
    this.label(layout.summary.x, layout.summary.y, this.summary(tests), C.white, { maxWidth: layout.summary.w });
  }

  /** The latest run's value of the chosen measure, and where the measure is heading. */
  private summary(tests: readonly LearnTest[]): string {
    const measure = this.filter.measure;
    const series = measureSeries(tests, measure);
    const latest = [...series].reverse().find((point) => point.value !== null);
    if (!latest || latest.value === null) return t('learnStats.none');
    if (measure === 'hands') return t('learnStats.hands', { right: latest.value, left: latest.other ?? 0 });
    const trend = seriesTrend(series.map((point) => point.value));
    const value = measureValue(measure, latest.value);
    return trend ? t('learnStats.latestTrend', { value, trend: measureValue(measure, trend.perRun, true) }) : t('learnStats.latest', { value });
  }

  /**
   * The chosen measure over the runs: dotted guides at the scale's ends (and at zero), the piece's own tempo as a gold dotted
   * line, the trend as a line, then a dot a run (red for an uneven one) with its whisker; the left hand as rings.
   */
  private drawGraph(plot: Rect, tests: readonly LearnTest[], baseline: number | null): void {
    const measure = this.filter.measure;
    const series = measureSeries(tests, measure);
    const graph = statsGraph(series, plot, {
      fromZero: FROM_ZERO.has(measure), trend: seriesTrend(series.map((point) => point.value)), reference: measure === 'bpm' ? baseline : null,
    });
    this.graph = graph;
    const box = createBitmap(plot.w + 2, plot.h + 2);
    const set = (x: number, y: number, color: number) => {
      const bx = x - plot.x + 1;
      const by = y - plot.y + 1;
      if (bx >= 0 && by >= 0 && bx < box.width && by < box.height) box.pixels[by * box.width + bx] = color;
    };
    box.pixels.fill(C.ink);
    for (const line of graph.lines) for (let x = plot.x; x < plot.x + plot.w; x += 2) set(x, line.y, C.lock);
    if (graph.referenceY !== null) for (let x = plot.x; x < plot.x + plot.w; x += 2) set(x, graph.referenceY, C.gold);
    if (graph.trend) {
      const { x1, y1, x2, y2 } = graph.trend;
      for (let x = x1; x <= x2; x++) set(x, Math.round(y1 + ((y2 - y1) * (x - x1)) / Math.max(1, x2 - x1)), C.teal);
    }
    for (const point of graph.points) {
      if (point.top !== null && point.bottom !== null) for (let y = point.top; y <= point.bottom; y++) set(point.x, y, C.dim);
      if (point.y2 !== null) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx !== 0 || dy !== 0) set(point.x + dx, point.y2 + dy, C.gold);
      if (point.y !== null) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(point.x + dx, point.y + dy, point.steady ? C.blueLight : C.red);
    }
    this.root.add(new PixelImage(this, plot.x - 1, plot.y - 1, box));
    for (const line of graph.lines) {
      const text = String(line.value);
      this.label(plot.x - 3 - textWidth(text), line.y - 3, text, C.dim);
    }
    if (graph.shown === 0) {
      this.label(plot.x + 3, plot.y + 3, t('learnStats.none'), C.dim, { maxWidth: plot.w - 6 });
      return;
    }
    const dateY = plot.y + plot.h + 2;
    this.label(plot.x, dateY, dayLabel(graph.points[0]!.day), C.dim);
    if (graph.points.length > 1) {
      const text = dayLabel(graph.points.at(-1)!.day);
      this.label(rectRight(plot) - textWidth(text), dateY, text, C.dim);
    }
  }

  /** The piece's bars in a row, each tinted by how much slower than the rest it is played (grey: not measured), with its printed number. */
  private drawStrip(layout: LearnStatsLayout, tests: readonly LearnTest[], bars: number, printed: (bar: number) => number): void {
    const { strip } = layout;
    this.strip = barStrip(barProfile(tests), bars, strip);
    const box = createBitmap(strip.w, strip.h);
    for (const cell of this.strip) {
      const colour = cell.shade === null ? C.lock : STRIP_TINTS[cell.shade]!;
      for (let y = 0; y < strip.h; y++) for (let x = cell.x - strip.x; x < cell.x - strip.x + cell.w; x++) box.pixels[y * strip.w + x] = colour;
    }
    this.root.add(new PixelImage(this, strip.x, strip.y, box));
    for (const cell of this.strip) {
      const text = String(printed(cell.bar));
      if (textWidth(text) + 2 <= cell.w) this.label(cell.x + Math.floor((cell.w - textWidth(text)) / 2), strip.y + 2, text, C.ink, { shadow: false });
    }
  }

  /** The pages in words: what to work on by the latest runs, then what each number means and what to aim for. */
  private drawHelp(layout: LearnStatsLayout, printed: (bar: number) => number): void {
    const pages = 1 + MEANING_PAGES.length;
    const page = Math.min(this.help ?? 0, pages - 1);
    const { width, height } = this.px;
    const x = layout.title.x;
    const room = width - 2 * x;
    let y = layout.measures[0]!.y;
    y += this.label(x, y, t(page === 0 ? 'learnStats.focusTitle' : 'learnStats.meaningTitle'), C.gold).height + HELP_LINE_GAP;
    const lines = page === 0
      ? (this.focus.length === 0 ? [t('learnStats.focus.none')] : this.focus.map((focus) => focusLine(focus, printed)))
      : MEANING_PAGES[page - 1]!.map((key) => meaningLine(key));
    for (const line of lines) y += this.label(x, y, line, C.white, { maxWidth: room }).height + HELP_LINE_GAP;
    const turn = (to: number) => {
      this.help = to;
      this.redraw();
    };
    const buttonY = height - x - PAGE_BUTTON / 2;
    this.button({ x: width - x - PAGE_BUTTON * 1.5 - 2, y: buttonY, width: PAGE_BUTTON, height: PAGE_BUTTON, label: '<', disabled: page === 0, onClick: () => turn(page - 1) });
    this.button({ x: width - x - PAGE_BUTTON / 2, y: buttonY, width: PAGE_BUTTON, height: PAGE_BUTTON, label: '>', disabled: page === pages - 1, onClick: () => turn(page + 1) });
  }
}
