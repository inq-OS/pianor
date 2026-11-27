import type { StringKey } from '../core/text/strings';
import { t } from '../core/text/strings';
import type { PasswordLock } from '../io/admin/passwordLock';
import { REGISTER } from '../core/layout/register';
import { C } from './ui/pixel/palette';
import { PixelScene } from './ui/pixel/PixelScene';

const MARGIN = 12;
const TITLE_Y = 6;
const HINT_Y = 32;
const FIELD_Y = [66, 96, 126];
const LABEL_KEYS = ['adminPassword.old', 'adminPassword.new', 'adminPassword.repeat'] as const;
const STATUS_Y = 150;
const MAX_LENGTH = 32;
/** A box to write a password in, in the register (layout cells). */
const FIELD_WIDTH = 110;

/**
 * Change a password (the teacher's own, d140): the old password, then the new one twice. Tab moves to the next box, Enter saves
 * (on the last box), Esc goes back. A refused change says why and changes nothing. Typed with the laptop keyboard, shown as stars.
 */
export abstract class PasswordChangeScene extends PixelScene {
  /** No player here yet (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  /** Written in the teacher's register (WP-14, d145): the boxes on the left page, the hint and what went wrong on the right. */
  protected inRegister = false;
  private fields: [string, string, string] = ['', '', ''];
  private active = 0;
  private status = '';
  private saving = false;

  /** The lock whose password is changed, and the heading. */
  protected abstract lock(): PasswordLock;
  protected abstract readonly titleKey: StringKey;
  /** Keeps the screen behind its lock (`guardLocked`), at the end of `create`. */
  protected abstract guard(): void;

  init(): void {
    this.fields = ['', '', ''];
    this.active = 0;
    this.status = '';
    this.saving = false;
  }

  override create(): void {
    super.create();
    this.onWindowKey((event) => this.key(event));
    this.guard();
  }

  protected draw(): void {
    const { width } = this.px;
    this.sky();
    if (this.inRegister) {
      this.drawInRegister();
      return;
    }
    const w = width - 2 * MARGIN;
    this.label(this.titleX(MARGIN), TITLE_Y, t(this.titleKey), C.gold, { big: true });
    this.label(MARGIN, HINT_Y, t('adminPassword.hint'), C.dim, { maxWidth: w });
    LABEL_KEYS.forEach((key, i) => {
      this.label(MARGIN, FIELD_Y[i]!, `${t(key)} ${'*'.repeat(this.fields[i]!.length)}`, i === this.active ? C.white : C.dim, { maxWidth: w });
    });
    if (this.status) this.label(MARGIN, STATUS_Y, this.status, C.dim, { maxWidth: w });
  }

  /**
   * The register's pages, ruled, a line of writing to a ruled line: on the left the heading, then each box's name and the box
   * to write in under it, the one being written in red; the hint and what went wrong on the right.
   */
  private drawInRegister(): void {
    const book = this.register();
    const { left, right, top } = book;
    const line = (k: number) => top + k * REGISTER.row;
    this.ruleToFoot(book, line(1));
    const title = this.ruledText(left, top, t(this.titleKey), C.gold);
    const hint = this.ruledText(right, top, t('adminPassword.hint'), C.dim);
    LABEL_KEYS.forEach((key, i) => {
      const at = line(title + 2 * i);
      this.label(left.x, at, t(key), C.umberDark, { maxWidth: left.w });
      this.ruledField(left.x, at + REGISTER.row, Math.min(left.w, FIELD_WIDTH), '*'.repeat(this.fields[i]!.length), i === this.active);
    });
    if (this.status) this.ruledText(right, line(hint + 1), this.status, C.redDark);
  }

  /** Printable keys go to the active box; Tab moves on; Backspace deletes; Enter goes on or saves; Esc goes back. */
  private key(event: KeyboardEvent): void {
    if (event.key === 'Escape') return this.back();
    if (event.key === 'Tab') {
      event.preventDefault();
      this.active = (this.active + 1) % 3;
    } else if (event.key === 'Enter') {
      if (this.active < 2) this.active += 1;
      else void this.save();
    } else if (event.key === 'Backspace') {
      this.fields[this.active] = this.fields[this.active]!.slice(0, -1);
    } else if (event.key.length === 1 && this.fields[this.active]!.length < MAX_LENGTH) {
      this.fields[this.active] += event.key;
    } else {
      return;
    }
    // a key typed here is the password's, not a note on the computer-keyboard piano (as in the name box)
    event.preventDefault();
    event.stopImmediatePropagation();
    this.redraw();
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const [oldPassword, next, repeat] = this.fields;
    const result = await this.lock().changePassword(oldPassword, next, repeat).catch(() => null);
    this.saving = false;
    if (result === 'ok') {
      this.back();
      return;
    }
    this.status = t(result === null ? 'admin.failed' : `adminPassword.${result}`);
    if (result === 'wrong') {
      // all three boxes start again, with the old password first
      this.fields = ['', '', ''];
      this.active = 0;
    }
    this.redraw();
  }
}
