import type { Chart } from '../../core/chart';
import { sliceChart } from '../../core/chart';
import { levelBars, loadLadder, type Ladder } from '../../core/campaign/content';
import type { CampaignLevel } from '../../core/campaign/campaign';
import ladderJson from '../../../content/campaign/ladder.json';

/** The monster ladder as shipped (content/campaign/ladder.json), validated once for the campaign scenes. */
export const LADDER: Ladder = loadLadder(ladderJson);

/** The bars a campaign level plays of the player's piece, as a section of its chart (ft_1_06, d095: level 1 the first half). */
export function levelChart(chart: Chart, level: CampaignLevel): Chart {
  const [first, last] = levelBars(level, chart.bars.length);
  return sliceChart(chart, first - 1, last - 1);
}
