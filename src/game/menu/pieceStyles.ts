import styleFile from '../../../content/pieces/styles.json';
import { parseStyleList } from '../../core/properties/styles';

/** The closed list of piece styles (`content/pieces/styles.json`), which names the styles on the info card. */
export const pieceStyles = parseStyleList(styleFile);
