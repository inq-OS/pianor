import type { Chart } from '../core/chart';
import { layoutStaff } from '../core/layout/staff';

/** A piece the game can offer. */
export interface Piece {
  chart: Chart;
  status: 'draft' | 'approved';
  /** Curriculum level (what notes it uses). */
  level: number;
  /** Player level needed to play it. */
  unlockLevel: number;
  source: string;
  /** Style ids from the meta file (the closed list of `content/pieces/styles.json`). */
  styles?: readonly string[];
  /** Free technique and provenance words from the meta file. */
  tags?: readonly string[];
  /** How hard, in points 0 to 100 (d157): confirmed in the meta file or proposed by the estimator (core_08); absent for pieces that were not linted (the editor's, the dev samples). */
  difficulty?: number;
  /** Written in the game's editor on this device. */
  own?: boolean;
}

/** The screen size the drawability check lays a chart out for (it only asks whether the layout throws). */
const REFERENCE_VIEWPORT = { width: 1280, height: 720 } as const;

/** Charts already checked: a chart is never changed in place, so its answer stays true. */
const drawableCache = new WeakMap<Chart, boolean>();

/** True when the staff renderer can show this chart (it throws on notation it does not draw yet). Laid out once per chart. */
export function drawable(chart: Chart): boolean {
  const known = drawableCache.get(chart);
  if (known !== undefined) return known;
  let ok: boolean;
  try {
    layoutStaff(chart, { viewport: REFERENCE_VIEWPORT });
    ok = true;
  } catch {
    ok = false;
  }
  drawableCache.set(chart, ok);
  return ok;
}

/**
 * The pieces the game offers, easiest first. This is the approval gate: only approved pieces reach a student, and drafts
 * show only when `showDrafts` is on (the dev server). Charts the staff cannot draw are always left out, and a piece id
 * is offered once, the first one listed winning.
 */
export function offeredPieces(candidates: readonly Piece[], showDrafts: boolean): Piece[] {
  const seen = new Set<string>();
  return candidates
    .filter((p) => (showDrafts || p.status === 'approved') && drawable(p.chart))
    .filter((p) => !seen.has(p.chart.id) && !!seen.add(p.chart.id))
    .sort((a, b) => a.unlockLevel - b.unlockLevel || a.level - b.level || a.chart.title.localeCompare(b.chart.title));
}

/**
 * The pieces a player sees in the menu and can play in a tug: `pieces` without the ones turned off (`hidden` holds their ids,
 * and ids of pieces that no longer exist are ignored). The list screen still shows every piece, so one can be turned on again.
 */
export function piecesThatAreOn(pieces: readonly Piece[], hidden: readonly string[]): Piece[] {
  return pieces.filter((p) => !hidden.includes(p.chart.id));
}

/** The groups of the piece book's filter: own pieces, the teacher's curriculum, the characters' phrases. */
export const PIECE_GROUPS = ['own', 'curriculum', 'character'] as const;
export type PieceGroup = (typeof PIECE_GROUPS)[number];

/** The groups a piece is in: own when written in the editor, curriculum when in `curriculum`, character when a character teaches it. */
export function groupsOf(piece: Piece, curriculum: ReadonlySet<string>, characterPieces: ReadonlyMap<string, string>): PieceGroup[] {
  const id = piece.chart.id;
  return PIECE_GROUPS.filter((g) => (g === 'own' ? piece.own === true : g === 'curriculum' ? curriculum.has(id) : characterPieces.has(id)));
}

/** A bookmark of the piece book (ft_1_12.AC10): every piece, or one group's. */
export type Bookmark = 'all' | PieceGroup;
export const BOOKMARKS: readonly Bookmark[] = ['all', ...PIECE_GROUPS];

/** The pieces the book shows at a bookmark: every piece at `all`, else the pieces in that group (a piece may be in two). */
export function piecesUnderBookmark(pieces: readonly Piece[], groups: (piece: Piece) => readonly PieceGroup[], mark: Bookmark): Piece[] {
  return mark === 'all' ? [...pieces] : pieces.filter((p) => groups(p).includes(mark));
}
