import { tempoLabel } from '../../core/chart/tempoLabel';
import { clickBpm } from '../../core/transport';

/**
 * The BPM text of the tools strip: the piece's own BPM, with the effective one in brackets. In Tempo mode the effective BPM
 * follows the tempo percent. In Wait mode it shows the click's BPM, but only while the click is on and has been moved by the
 * click keys (otherwise the label stays the piece's own BPM, as before). The click speed rules are in `core/transport/practiceSpeed.ts`.
 */
export function stripBpmLabel(pieceBpm: number, o: { tempoMode: boolean; percent: number; clickOn: boolean; offset: number }): string {
  if (o.tempoMode) return tempoLabel(pieceBpm, o.percent);
  if (o.clickOn && o.offset !== 0) return tempoLabel(pieceBpm, (clickBpm(pieceBpm, o.percent, o.offset) * 100) / pieceBpm);
  return tempoLabel(pieceBpm);
}
