import type { StringKey } from './strings';

/**
 * The results title (AX-2.1). Finishing a piece is not praise-worthy on its own, so the title is neutral and
 * only a real milestone (a new level or a new best) gets the celebratory title.
 */
export function resultsTitleKey(milestone: boolean): StringKey {
  return milestone ? 'results.titleMilestone' : 'results.title';
}
