import type { StringKey } from '../core/text/strings';
import { t } from '../core/text/strings';
import type { PasswordLock } from '../io/admin/passwordLock';
import { REGISTER } from '../core/layout/register';
import { C } from './ui/pixel/palette';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';

const MARGIN = 12;
const TITLE_Y = 6;
const HINT_Y = 34;
const FIELD_Y = 58;
const WRONG_Y = 88;
const BUTTON_Y = 130;
const BUTTON_HEIGHT = 18;
const BUTTON_WIDTH = 120;
const MAX_LENGTH = 32;
/** The parchment round the password's box on a plain screen, in cells; the box's name (read by the tests). */
const FIELD_CARD_PAD = 7;
const PASSWORD_FIELD = 'passwordField';
/** The box the password is written in, in the register (layout cells). */
const FIELD_WIDTH = 110;

/**
 * A gate in front of a locked area: the admin page or the teacher's screen (d140). The password is typed on the laptop
 * keyboard and shown as stars. A wrong password stays here with a plain line (no lockout); the right one opens the area. A
 * child lock, not security. Back returns to the main menu.
 */
export abstract class PasswordGateScene extends PixelScene {
  /** No player here yet (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  /** Written in the teacher's register (WP-14, d145): the field on the left page, the hint on the right. */
  protected inRegister = false;
  private typed = '';
  private wrong = false;
  private checking = false;

  /** The lock this gate opens, its heading and its line under the heading. */
  protected abstract lock(): PasswordLock;
  protected abstract readonly titleKey: StringKey;
  protected abstract readonly hintKey: StringKey;
  /** Goes into the area once the password is right. */
  protected abstract open(): void;

  init(): void {
    this.typed = '';
    this.wrong = false;
    this.checking = false;
  }

  override create(): void {
    super.create();
    this.onWindowKey((event) => this.key(event));
  }

  protected draw(): void {
    const { width } = this.px;
    this.sky();
    if (this.inRegister) {
      this.drawInRegister();
      return;
    }
    this.label(this.titleX(MARGIN), TITLE_Y, t(this.titleKey), C.gold, { big: true });
    this.label(MARGIN, HINT_Y, t(this.hintKey), C.dim, { maxWidth: width - 2 * MARGIN });
    // the box the password is written in, as the teacher's gate has it: a slip of parchment with the inked field on it
    this.parchmentCard({ x: MARGIN - 3 - FIELD_CARD_PAD, y: FIELD_Y - 1 - FIELD_CARD_PAD, w: FIELD_WIDTH + 2 * FIELD_CARD_PAD, h: REGISTER.row - 2 + 2 * FIELD_CARD_PAD });
    this.ruledField(MARGIN, FIELD_Y, FIELD_WIDTH, '*'.repeat(this.typed.length), true).setName(PASSWORD_FIELD);
    if (this.wrong) this.label(MARGIN, WRONG_Y, t('adminGate.wrong'), C.dim, { maxWidth: width - 2 * MARGIN });
    // with the band (ft_1_20 rule 1) Enter is its action, not a button under the field
    if (!this.bandShown) this.button({ x: width / 2, y: BUTTON_Y, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, ...this.enter() });
  }

  /**
   * The register's pages, ruled: on the left the heading, a box to write the password in (its stars typed) and Enter in an
   * inked box; why it asks, on the right. A line of writing to a ruled line.
   */
  private drawInRegister(): void {
    const book = this.register();
    const { left, right, top } = book;
    const line = (k: number) => top + k * REGISTER.row;
    this.ruleToFoot(book, line(1));
    const title = this.ruledText(left, top, t(this.titleKey), C.gold);
    this.ruledText(right, top, t(this.hintKey), C.dim);
    const field = line(title + 1);
    this.ruledField(left.x, field, Math.min(left.w, FIELD_WIDTH), '*'.repeat(this.typed.length), true).setName(PASSWORD_FIELD);
    if (this.wrong) this.ruledText(left, field + REGISTER.row, t('adminGate.wrong'), C.redDark);
    if (!this.bandShown) {
      this.button({ x: left.x - 3 + BUTTON_WIDTH / 4, y: field + 3 * REGISTER.row + 4, width: BUTTON_WIDTH / 2, height: REGISTER.row - 1, look: 'ink', inkBox: true, ...this.enter() });
    }
  }

  protected override bandActions(): ToolbarItem[] {
    return [this.enter()];
  }

  private enter(): ToolbarItem {
    return { label: t('adminGate.enter'), onClick: () => void this.submit() };
  }

  /** Printable keys are typed; Backspace deletes; Enter submits; Esc goes back. */
  private key(event: KeyboardEvent): void {
    if (event.key === 'Enter') void this.submit();
    else if (event.key === 'Escape') this.back();
    else if (event.key === 'Backspace') this.typed = this.typed.slice(0, -1);
    else if (event.key.length === 1 && this.typed.length < MAX_LENGTH) this.typed += event.key;
    else return;
    // a key typed here is the password's, not a note on the computer-keyboard piano (as in the name box)
    event.preventDefault();
    event.stopImmediatePropagation();
    this.wrong = false;
    this.redraw();
  }

  private async submit(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    const ok = await this.lock().check(this.typed).catch(() => false);
    this.checking = false;
    if (ok) {
      this.open();
      return;
    }
    this.typed = '';
    this.wrong = true;
    this.redraw();
  }
}
