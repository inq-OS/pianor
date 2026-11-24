import { loadLadder, type Ladder } from '../../core/campaign/content';
import ladderJson from '../../../content/campaign/ladder.json';

/** The monster ladder as shipped (content/campaign/ladder.json), validated once for the scenes that place the characters. */
export const LADDER: Ladder = loadLadder(ladderJson);
