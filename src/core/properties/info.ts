import type { Chart } from '../chart/schema.ts';
import { complexityOf, type Complexity } from './complexity.ts';
import type { StringKey } from '../text/strings.ts';
import { pieceFeatures, type FeatureId } from './features.ts';
import { styleNameKeys, type StyleList } from './styles.ts';

/** What the info card in the menu shows about a piece. */
export interface PieceInfo {
  /** How hard it is: the grade and its stars (d157); null when the piece has no difficulty score (a piece written in the editor). */
  complexity: Complexity | null;
  /** The piece's own tempo in beats per minute (`chart.tempoMap[0].bpm`), shown whatever the play mode. */
  bpm: number;
  /** The name keys of the piece's styles that the closed style list knows, in the meta file's order. */
  styles: StringKey[];
  /** Free words from the piece's meta file (technique, provenance), as written. */
  tags: string[];
  /** Derived from the chart, in the order to list them. */
  features: FeatureId[];
}

/**
 * The stars, styles, tags and features of a piece. `difficulty` is in points 0 to 100 (d157, core_08), `styles` and `tags` those of
 * the meta file; `styleList` is the closed list that names the styles (without it a piece shows no style).
 */
export function pieceInfo(piece: { chart: Chart; styles?: readonly string[]; tags?: readonly string[]; difficulty?: number }, styleList?: StyleList): PieceInfo {
  const tags = [...new Set((piece.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag !== ''))];
  return {
    bpm: piece.chart.tempoMap[0]!.bpm,
    complexity: piece.difficulty === undefined ? null : complexityOf(piece.difficulty),
    styles: styleList ? styleNameKeys(styleList, piece.styles ?? []) : [],
    tags,
    features: pieceFeatures(piece.chart),
  };
}
