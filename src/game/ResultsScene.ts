import type { PieceResult } from '../core/judge';
import type { XpAwarded } from '../core/progression';
import { historyGraph, type GraphPoint, type HistoryGraph } from '../core/layout/historyGraph';
import { rectRight, type Rect } from '../core/layout/rect';
import { resultsLayout, scoreGraphPlot } from '../core/layout/resultsLayout';
import { GRADE_STARS, passStarsFor } from '../core/scoring/stars';
import { resultsTitleKey } from '../core/text/resultsTitle';
import { scoreLines } from '../core/text/rundown';
import type { FreePlaySummary } from '../core/scoring/freePlay';
import { t, type StringKey } from '../core/text/strings';
import { contextOf } from './context';
import { createBitmap, type Bitmap } from './ui/pixel/bitmap';
import { measure } from './ui/pixel/font';
import type { CompletionOutcome } from './profile/ProfileService';
import { C } from './ui/pixel/palette';
import { Mascot, PixelImage, pixelStars } from './ui/pixel/PixelObjects';
import { OutcomeScene } from './results/OutcomeScene';
import type { SongReturn } from './songReturn';
import { SPARKLE, STAR_FULL } from './ui/pixel/sprites';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { startScene } from './scenes';

/** Kiur at twice the size (24 art pixels wide), centred in the left column, and the five grade stars at zoom 2 under it. */
const MASCOT_WIDTH = 48;
const MASCOT_Y = 30;
const STARS_GAP = 2;
const STARS_WIDTH = (GRADE_STARS * (STAR_FULL.width + STARS_GAP) - STARS_GAP) * 2;
const STARS_Y = 76;
/** The ribbon reaches this far above its title (`ribbon`): with the band it clears the door by this much. */
const RIBBON_ROOM = 1;
/** Row steps down the numbers column: one line of text, and a line with a gap after it. */
const LINE = 12;
/** The graph starts this far under the last line. */
const GRAPH_GAP = 3;
const MONTHS: readonly StringKey[] = ['month.1', 'month.2', 'month.3', 'month.4', 'month.5', 'month.6', 'month.7', 'month.8', 'month.9', 'month.10', 'month.11', 'month.12'];
const DOT: Record<GraphPoint['mode'], number> = { wait: C.featherStreak, tempo: C.redDark };

/** A play's date as the player reads it: day and month, in the player's own time zone. */
function dateLabel(at: string): string {
  const date = new Date(at);
  return t('stats.date', { day: date.getDate(), month: t(MONTHS[date.getMonth()]!) });
}

export interface ResultsData {
  chartId: string;
  /** A song's play (ft_1_36): Back and the pieces button lead to the songs list or song page it started from. */
  fromSong?: SongReturn | undefined;
  /** The session's keys and passes (ft_1_12); none for a single result. */
  summary?: FreePlaySummary;
  /** The last pass finished, if any. */
  result?: PieceResult;
  /** What the session's passes earned, added up (`mergeOutcomes`). */
  outcome?: CompletionOutcome | undefined;
}

/**
 * The score screen (ft_1_12.AC4; the results screen and the Free play rundown before it): shown when the student leaves a
 * piece. Left: the stars of the best pass and the two buttons; Kiur cheers only at a milestone. Right: the session
 * (passes, best and last, wrong keys by reason), then the XP of all passes, the level and what opened up. Nothing says "failed".
 */
export class ResultsScene extends OutcomeScene {
  private chartId = '';
  private summary: FreePlaySummary | null = null;
  /** The last pass (kept for the tests and the autoplay director). */
  private result: PieceResult | null = null;
  /** How far the left column sits lower with the band, clear of the door in the corner (set in `draw`). */
  private below = 0;
  private outcome: CompletionOutcome | null = null;
  /** The development graph as drawn (kept for the tests); null when there was no room for it. */
  protected graph: HistoryGraph | null = null;

  constructor() {
    super('results');
  }

  init(data: ResultsData): void {
    this.chartId = data.chartId;
    this.summary = data.summary ?? null;
    this.result = data.result ?? null;
    this.outcome = data.outcome ?? null;
    this.fromSong = data.fromSong;
  }

  protected draw(): void {
    const { width, height } = this.px;
    // under the band the gear stands in the top right corner: the numbers end left of it (ft_1_20.AC2)
    const { left, again, back, more, numbers } = resultsLayout(width, height, this.bandShown ? { rightInset: width - this.cornerStrip.right } : {});
    const mascotX = left.x + (left.w - MASCOT_WIDTH) / 2;
    const profiles = contextOf(this).profiles;
    const session = this.summary !== null || this.outcome !== null;
    this.sky();
    // the whole screen is a card on the desk, written in ink, its title on a ribbon (in the style of the parchment of the 1991 game)
    this.parchmentCard({ x: 5, y: 2, w: width - 10, h: height - 4 }, 2);
    this.inkWriting = true;
    // left: the celebration after a session; the piece's title and best stars when opened from its card (the stats, core_04)
    const milestone = this.milestone();
    // with the band the door stands in the card's top left corner: the title, Kiur and the stars move down under it (the band
    // holds the buttons, so the column's foot is free)
    this.below = this.bandShown ? Math.max(0, this.cornerStrip.rows + RIBBON_ROOM - left.y) : 0;
    const title = session ? this.label(left.x, left.y, t(resultsTitleKey(milestone)), C.gold, { big: true, maxWidth: left.w / 2 }) : this.label(left.x, left.y, this.pieceTitle(this.chartId), C.gold, { maxWidth: left.w });
    const scale = session ? 2 : 1;
    const titleW = Math.ceil(title.width * scale), titleH = Math.ceil(title.height * scale);
    // the title in the middle of its column, so the ribbon's tails stay on the card
    title.setPosition(Math.round(left.x + (left.w - titleW) / 2), left.y + 2 + this.below);
    this.ribbon({ x: title.x, y: title.y, w: titleW, h: titleH });
    this.root.bringToTop(title);
    const mascot = this.own(new Mascot(this, this.root, mascotX, MASCOT_Y + this.below, 2));
    mascot.setMood(milestone ? 'cheer' : 'idle');
    const best = session ? (this.summary?.bestAccuracy ?? this.result?.accuracy ?? null) : null;
    const stars = best !== null ? passStarsFor(best) : session ? 0 : (profiles.recordFor(this.chartId)?.bestGrade ?? 0);
    pixelStars(this, this.root, Math.round(left.x + (left.w - STARS_WIDTH) / 2), STARS_Y + this.below, stars, { gap: STARS_GAP, zoom: 2, ink: true });
    // a piece learned bar by bar: a third button opens what its measured runs showed (ft_1_32.AC9)
    const measured = !session && (profiles.learnProgressOf(this.chartId).tests ?? []).length > 0;
    this.againAndBack(again, back, t(session ? 'results.again' : 'results.play'), () => startScene(this, 'practice', { chartId: this.chartId, ...(this.fromSong ? { fromSong: this.fromSong } : {}) }), measured ? {
      at: more, label: t('stats.toLearning'), icon: TOOL_ICONS.tempo, onClick: () => startScene(this, 'learn-stats', { chartId: this.chartId, ...(this.fromSong ? { fromSong: this.fromSong } : {}) }),
    } : undefined);
    this.playsColumn(numbers, session, mascotX);
  }

  /** Right: the session (or the piece's numbers), what it earned, then the piece's development graph to the bottom. */
  private playsColumn(numbers: Rect, session: boolean, mascotX: number): void {
    let y = session ? this.sessionLines(numbers) : this.statsLines(numbers);
    if (this.outcome) y = this.earnedLines(numbers, y, mascotX);
    const plot = scoreGraphPlot(numbers, y + GRAPH_GAP);
    this.graph = plot ? historyGraph(contextOf(this).profiles.historyFor(this.chartId), plot) : null;
    if (plot && this.graph) this.drawGraph(plot, this.graph);
  }

  /** A graph's own bitmap over `plot` with a pixel of room around it, and the function that sets a pixel of it by screen position. */
  private graphBox(plot: Rect): { box: Bitmap; set: (px: number, py: number, color: number) => void } {
    const box = createBitmap(plot.w + 2, plot.h + 2);
    const set = (px: number, py: number, color: number) => {
      const bx = px - plot.x + 1;
      const by = py - plot.y + 1;
      if (bx >= 0 && by >= 0 && bx < box.width && by < box.height) box.pixels[by * box.width + bx] = color;
    };
    return { box, set };
  }

  /** The first and the last date under a graph. */
  private graphDates(plot: Rect, first: string | undefined, last: string | undefined): void {
    const dateY = plot.y + plot.h + 3;
    if (first) this.label(plot.x, dateY, dateLabel(first), C.dim);
    if (last) {
      const text = dateLabel(last);
      this.label(rectRight(plot) - measure(text), dateY, text, C.dim);
    }
  }

  /** A text line of the numbers column at `y`; returns the y under it. */
  private line(numbers: Rect, y: number, value: string, color: number, gap = 2): number {
    return y + this.label(numbers.x, y, value, color, { maxWidth: numbers.w }).height + gap;
  }

  /** The session (ft_1_12): passes, the best (or the one) pass, wrong keys; the detail lines give their room to the graph. */
  private sessionLines(numbers: Rect): number {
    let y = numbers.y;
    if (!this.summary) return y;
    for (const row of scoreLines(this.summary).filter((r) => r.style !== 'detail')) {
      y = this.line(numbers, y, t(row.key, row.params), row.style === 'headline' ? C.gold : C.white, row.style === 'headline' ? 4 : 2);
    }
    return y + 4;
  }

  /** Opened from the piece's card: how often it was played, keeping it up, right the first time, the fastest (core_04). */
  private statsLines(numbers: Rect): number {
    let y = numbers.y;
    const stats = contextOf(this).profiles.statsFor(this.chartId);
    if (stats.plays === 0) return this.line(numbers, y, t('stats.notYet'), C.white) + 4;
    y = this.line(numbers, y, stats.plays === 1 ? t('stats.playsOne') : t('stats.plays', { count: stats.plays }), C.white);
    y = this.line(numbers, y, t('results.proficiency', { percent: stats.proficiency }), C.white);
    if (stats.accuracy !== null) y = this.line(numbers, y, t('stats.accuracy', { percent: Math.round(100 * stats.accuracy) }), C.white);
    if (stats.speed !== null) y = this.line(numbers, y, t('results.speed', { percent: stats.speed }), C.white);
    return y + 4;
  }

  /** The piece XP of the session, a new best, the piece's level and a piece level reached (ft_1_13); sparkles round Kiur at a piece level-up. */
  private earnedLines(numbers: Rect, top: number, mascotX: number): number {
    const outcome = this.outcome!;
    const { x, w: room } = numbers;
    let y = top;
    const awarded = this.awarded();
    if (awarded) {
      y = this.xpLines(x, y, room, awarded.xp.total, null, 4); // the XP alone, no breakdown of why
      if (awarded.newBest) {
        this.label(x, y, t('results.newBest'), C.gold);
        y += LINE;
      }
      y = this.levelLines(x, y + 2, room, awarded.piece.after, awarded.piece.xp);
      // a piece level reached: the level line already says it, so only Kiur and the title celebrate (no text that repeats it)
      if (awarded.piece.after.level > awarded.piece.before.level) this.sparkle(mascotX, MASCOT_Y + this.below);
    }
    return this.saveLine(x, y, room, outcome);
  }

  /** The session's piece XP (the passes added up by `mergeOutcomes`), or null without a finished pass. */
  private awarded(): XpAwarded | null {
    const found = this.outcome?.events.find((e) => e.type === 'XpAwarded');
    return found?.type === 'XpAwarded' ? found : null;
  }

  /** The development graph (core_04's, on the stats page before ft_1_12): dashed guides at 0, 50 and 100 percent, the plays joined, a dot each. */
  private drawGraph(plot: Rect, graph: HistoryGraph): void {
    // one pixel of room around the plot, so the dots on its edges are whole
    const { box, set } = this.graphBox(plot);
    // drawn in ink on the card: no box of its own, dotted guides in the parchment's dark buff
    for (const guide of graph.lines) for (let gx = plot.x; gx < plot.x + plot.w; gx += 2) set(gx, guide.y, C.buffDeep);
    for (let i = 1; i < graph.points.length; i++) {
      const a = graph.points[i - 1]!;
      const b = graph.points[i]!;
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (let k = 0; k <= steps; k++) set(Math.round(a.x + ((b.x - a.x) * k) / steps), Math.round(a.y + ((b.y - a.y) * k) / steps), C.featherStreak);
    }
    for (const point of graph.points) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(point.x + dx, point.y + dy, DOT[point.mode]);
    this.root.add(new PixelImage(this, plot.x - 1, plot.y - 1, box));
    for (const guide of graph.lines) {
      const text = `${guide.percent}%`;
      this.label(plot.x - 3 - measure(text), guide.y - 3, text, C.dim);
    }
    this.graphDates(plot, graph.points[0]?.at, graph.points.length > 1 ? graph.points.at(-1)?.at : undefined);
  }

  /** A real milestone: a new piece level or a new best (AX-2.1). Only then the title and Kiur celebrate. */
  private milestone(): boolean {
    const awarded = this.awarded();
    return awarded !== null && (awarded.newBest || awarded.piece.after.level > awarded.piece.before.level);
  }

  /** A few sparkles around Kiur that blink, for a level-up. */
  private sparkle(x: number, y: number): void {
    const spots = [[-8, 4], [52, 0], [-4, 38], [50, 40]] as const;
    const sparkles = spots.map(([dx, dy]) => new PixelImage(this, x + dx, y + dy, SPARKLE));
    this.root.add(sparkles);
    let on = true;
    const timer = this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        on = !on;
        sparkles.forEach((s, i) => s.setVisible(on === (i % 2 === 0)));
      },
    });
    this.own({ destroy: () => timer.remove() });
  }
}
