import styleFile from '../../content/pieces/styles.json';
import { parseStyleList, type StyleList } from '../../src/core/properties/styles.ts';

/** The closed list of piece styles the linter checks `styles` against (`content/pieces/styles.json`). */
export const contentStyles: StyleList = parseStyleList(styleFile);
