import catalogJson from '../../content/lessons/catalog.json';
import halfStep from '../../content/lessons/half-step.json';
import majorScale from '../../content/lessons/major-scale.json';
import wholeStep from '../../content/lessons/whole-step.json';
import { loadCatalog } from '../core/lessons/catalog';
import { loadLessons } from '../core/lessons/lesson';
import { isStringKey } from '../core/text/strings';

/**
 * The learning catalog and the written lessons (ft_1_39), loaded and checked once for the page. A new lesson is one more
 * file in `content/lessons/` and one more line here.
 */
export const LESSON_CATALOG = loadCatalog(catalogJson);
export const LESSONS = loadLessons([halfStep, wholeStep, majorScale], LESSON_CATALOG, isStringKey);
