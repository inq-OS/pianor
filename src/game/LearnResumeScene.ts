import { t } from '../core/text/strings';
import { C, PALETTE } from './ui/pixel/palette';
import { PixelScene } from './ui/pixel/PixelScene';
import { SYMBOL_HEIGHT, SYMBOL_WIDTH, resumeSymbol } from './ui/pixel/settingArt';
import { CANCELLED, closeOverlay, settleOverlay, type OverlayOutcome } from './scenes';

/** How dark the paused screen under the overlay gets (the room's dusk, as at Kiur's door). */
const DIM_ALPHA = 0.7;
/** Room round each picture on its button, and between the two buttons (art pixels). */
const PAD = 4;
const GAP = 16;

/**
 * Reopening a piece left halfway through learning (ft_1_32.AC16): an overlay on the paused practice screen with two
 * pictures and no words (d285), go on where the learning stopped, or start over from the first bar. Esc goes on. The
 * overlay only returns the choice; the practice screen acts on it.
 */
export class LearnResumeScene extends PixelScene {
  protected override framed = false;
  protected override keyboardNavigation = true;

  constructor() {
    super('learnResume');
  }

  override create(): void {
    this.scene.bringToTop();
    this.events.once('shutdown', () => settleOverlay('learnResume', CANCELLED, this));
    super.create();
  }

  protected override back(): void {
    this.close(CANCELLED);
  }

  private close(result: OverlayOutcome<'learnResume'>): void {
    closeOverlay(this, 'learnResume', result);
  }

  protected draw(): void {
    const { width, height, scale } = this.px;
    this.root.add(this.add.rectangle(0, -this.mainTop / scale, width, height + this.mainTop / scale, PALETTE[C.duskDeep], DIM_ALPHA).setOrigin(0, 0));
    const w = SYMBOL_WIDTH + 2 * PAD, h = SYMBOL_HEIGHT + 2 * PAD;
    const left = Math.floor((width - (2 * w + GAP)) / 2);
    const y = Math.floor(height / 2);
    (['continue', 'over'] as const).forEach((choice, i) => {
      const label = t(choice === 'continue' ? 'learn.resume.continue' : 'learn.resume.over');
      this.button({ x: left + i * (w + GAP) + w / 2, y, width: w, height: h, label, icon: resumeSymbol(choice), iconOnly: true, onClick: () => this.close(choice) });
    });
  }
}
