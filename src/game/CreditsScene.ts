import { t } from '../core/text/strings';
import { C } from './ui/pixel/palette';
import { Mascot } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import { startScene } from './scenes';

const MARGIN = 24;
/** Under the top left corner vine's arm, as on the main menu. */
const TITLE_Y = 14;
/** The four paragraphs: the first starts at FIRST_Y, one every PARAGRAPH_STEP, wrapped at most this wide. */
const FIRST_Y = 42;
const PARAGRAPH_STEP = 28;
const TEXT_MAX_WIDTH = 260;
/** Kiur in the top right corner (24 art pixels wide), under and left of the corner vine. */
const MASCOT_WIDTH = 24;
const MASCOT_Y = 16;
const MASCOT_RIGHT = 20;
/** With the band: the title, the first paragraph and the step between them. */
const BAND_TITLE_Y = 5;
const BAND_FIRST_Y = 32;
const BAND_PARAGRAPH_STEP = 22;
/** Back at the bottom left: centre this far above the bottom. */

/**
 * Who made what: the piano recordings (CC BY 3.0 asks for this credit), the pictures, and the source of Keri's map (the
 * Maa- ja Ruumiamet open data licence asks for it; docs/keri.md section 1, ft_1_18.AC2).
 */
export class CreditsScene extends PixelScene {
  /** No player here yet (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  protected override keyboardNavigation = true;

  protected override back(): void {
    startScene(this, 'profiles');
  }

  constructor() {
    super('credits');
  }

  protected draw(): void {
    const { width } = this.px;
    this.sky();
    // the credits on a card on the desk, written in ink, the title on a ribbon
    // with the band (ft_1_20) the 124 rows above it hold the card higher, the title right of the door and the lines closer
    const band = this.bandShown;
    const [top, titleY, firstY, step] = band ? [2, BAND_TITLE_Y, BAND_FIRST_Y, BAND_PARAGRAPH_STEP] : [6, TITLE_Y, FIRST_Y, PARAGRAPH_STEP];
    this.parchmentCard({ x: 12, y: top, w: width - 24, h: this.px.height - 2 * top }, 4);
    this.inkWriting = true;
    const title = this.label(this.titleX(MARGIN), titleY, t('credits.title'), C.gold, { big: true });
    this.ribbon({ x: title.x, y: title.y, w: title.width * 2, h: title.height * 2 });
    this.root.bringToTop(title);
    const wrap = Math.min(width - 2 * MARGIN, TEXT_MAX_WIDTH);
    this.label(MARGIN, firstY, t('menu.credits'), C.white, { maxWidth: wrap });
    this.label(MARGIN, firstY + step, t('credits.art'), C.white, { maxWidth: wrap });
    this.label(MARGIN, firstY + 2 * step, t('credits.map'), C.white, { maxWidth: wrap });
    this.label(MARGIN, firstY + 3 * step, t('credits.thanks'), C.dim, { maxWidth: wrap });
    const mascot = this.own(new Mascot(this, this.root, width - MASCOT_RIGHT - MASCOT_WIDTH, MASCOT_Y));
    mascot.setMood('cheer');
  }
}
