import introJson from '../../../content/intro/intro.json';
import { parseIntro } from '../../core/intro/intro';

/** The first-run intro's content (ft_1_31, `content/intro/intro.json`), parsed once for the room and the practice screen. */
export const INTRO = parseIntro(introJson);
