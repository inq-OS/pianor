import { t } from '../core/text/strings';
import { panelBitmap } from './ui/pixel/frames';
import { C, PALETTE } from './ui/pixel/palette';
import { PixelImage, type PixelButton } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import { CANCELLED, closeOverlay, settleOverlay, type OverlayOutcome } from './scenes';

/** How dark the paused piece maker under the panel gets (the room's dusk, as at Kiur's door). */
const DIM_ALPHA = 0.7;
/** The panel and its buttons, in art pixels. */
const PANEL_WIDTH = 150;
const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 14;
const PAD = 6;
const GAP = 3;

/**
 * Leaving the piece maker with unsaved work (ft_1_02a.AC16): a panel over the paused piece maker asks Save and leave, Leave
 * without saving or Stay, with the keyboard on Stay (Enter stays, Esc stays, the arrows move). The overlay only returns the
 * choice; the piece maker acts on it.
 */
export class EditorLeaveScene extends PixelScene {
  protected override framed = false;
  protected override keyboardNavigation = true;
  private stay: PixelButton | undefined;

  constructor() {
    super('editorLeave');
  }

  override create(): void {
    this.scene.bringToTop();
    this.events.once('shutdown', () => settleOverlay('editorLeave', CANCELLED, this));
    super.create();
    // the keys start on Stay; a new size of the window keeps the ring where it is
    this.focusOn(this.stay);
  }

  protected override back(): void {
    this.close('stay');
  }

  private close(result: OverlayOutcome<'editorLeave'>): void {
    closeOverlay(this, 'editorLeave', result);
  }

  protected draw(): void {
    const { width, height, scale } = this.px;
    this.root.add(this.add.rectangle(0, -this.mainTop / scale, width, height + this.mainTop / scale, PALETTE[C.duskDeep], DIM_ALPHA).setOrigin(0, 0));
    const choices = [
      ['save', 'editor.leave.save'],
      ['leave', 'editor.leave.discard'],
      ['stay', 'editor.leave.stay'],
    ] as const;
    // the question first, so the panel is as tall as its lines; the panel then goes under it
    const question = this.label(0, 0, t('editor.leave.question'), C.white, { maxWidth: PANEL_WIDTH - 2 * PAD });
    const questionRows = Math.ceil(question.height) + PAD;
    const panelHeight = PAD + questionRows + choices.length * (BUTTON_HEIGHT + GAP) - GAP + PAD;
    const left = Math.floor((width - PANEL_WIDTH) / 2);
    const top = Math.floor((height - panelHeight) / 2);
    question.setPosition(left + PAD, top + PAD);
    const panel = new PixelImage(this, left, top, panelBitmap(PANEL_WIDTH, panelHeight, 'panel'));
    this.root.add(panel);
    this.root.moveBelow(panel, question);
    choices.forEach(([choice, key], i) => {
      const y = top + PAD + questionRows + i * (BUTTON_HEIGHT + GAP) + BUTTON_HEIGHT / 2;
      const b = this.button({ x: width / 2, y, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, label: t(key), onClick: () => this.close(choice) });
      if (choice === 'stay') this.stay = b;
    });
  }
}
