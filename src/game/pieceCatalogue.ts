import { parseChart, type Chart, type PieceMeta } from '../core/chart';
import { offeredPieces, type Piece } from './pieceList';

/** One compiled piece file as `virtual:pieces` gives it (`tools/vite-pieces.ts`). */
export interface PieceFile {
  meta: PieceMeta;
  chart: Chart;
  difficulty?: number;
}

/** What a catalogue is built from: everything the composition root knows about this page load, passed in once. */
export interface PieceCatalogueSources {
  /** The compiled pieces of this build (a production build leaves the drafts out). */
  files: readonly PieceFile[];
  /** Ids of pieces this build left out (the drafts of a production build): still taken, so a piece file cannot claim one. */
  omittedIds: readonly string[];
  /** The hand-written dev sample charts, unparsed; empty in a production build. */
  devCharts: readonly unknown[];
  /** The pieces written in the editor on this device, read on every call so a save, import or removal shows at once. */
  ownPieces: () => readonly Piece[];
  /** Offer drafts and the dev samples (the dev server). */
  showDrafts: boolean;
}

const samePieces = (a: readonly Piece[], b: readonly Piece[]): boolean =>
  a.length === b.length && a.every((p, i) => p.chart === b[i]!.chart && p.source === b[i]!.source);

/**
 * The pieces the game offers, built once by the composition root and handed to scenes in `GameContext`. The offered
 * list is built on first use and kept: the menu, the results screens and every profile save ask for it, and
 * building it lays out every piece's staff. It is built again when the own pieces are not the ones it was built with.
 */
export class PieceCatalogue {
  private readonly sources: PieceCatalogueSources;
  private samples: Chart[] | null = null;
  private offered: { own: readonly Piece[]; list: Piece[]; byId: Map<string, Piece> } | null = null;

  constructor(sources: PieceCatalogueSources) {
    this.sources = sources;
  }

  /**
   * Pieces the game offers, easiest first (`offeredPieces` is the approval gate). Drafts and the dev samples show only
   * with `showDrafts`. Each call returns a new array of the same pieces, so a caller may sort or filter its copy.
   */
  list(): Piece[] {
    return [...this.build().list];
  }

  /** The offered piece with this id, if any. */
  find(chartId: string): Piece | undefined {
    return this.build().byId.get(chartId);
  }

  /** Ids of the pieces that come with the game (not the player's own), shipped or not: a piece file must not claim one. */
  bundledIds(): string[] {
    return [...this.sources.files.map(({ meta }) => meta.id), ...this.sources.omittedIds, ...this.devSamples().map((chart) => chart.id)];
  }

  /** The hand-written dev samples that parse, parsed once (empty in a production build). */
  devSamples(): Chart[] {
    this.samples ??= this.sources.devCharts.flatMap((raw) => {
      const parsed = parseChart(raw);
      return parsed.ok ? [parsed.chart] : [];
    });
    return this.samples;
  }

  private build(): { list: Piece[]; byId: Map<string, Piece> } {
    const own = this.sources.ownPieces();
    if (this.offered && samePieces(this.offered.own, own)) return this.offered;
    const { files, showDrafts } = this.sources;
    const compiled: Piece[] = files.map(({ meta, chart, difficulty }) => ({
      chart, status: meta.status, level: meta.level, unlockLevel: meta.unlockLevel ?? meta.level, source: meta.source,
      styles: meta.styles, tags: meta.tags, ...(difficulty === undefined ? {} : { difficulty }),
    }));
    const samples: Piece[] = showDrafts
      ? this.devSamples().map((chart) => ({ chart, status: 'draft' as const, level: chart.level, unlockLevel: chart.level, source: 'dev sample' }))
      : [];
    const list = offeredPieces([...compiled, ...samples, ...own], showDrafts);
    this.offered = { own, list, byId: new Map(list.map((p) => [p.chart.id, p])) };
    return this.offered;
  }
}
