import type Phaser from 'phaser';
import { ART_DETAIL } from '../core/layout/frame';
import { NAME_LETTERS, NAME_MAX, deleteLetter, nameFrom, typeLetter } from '../core/text/nameEntry';
import { t } from '../core/text/strings';
import { createBitmap } from './ui/pixel/bitmap';
import { drawnText, measure } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { BOOK_PALETTE, paintCover } from './ui/pixel/paint/book';
import { paintedOnce } from './ui/pixel/paintedOnce';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';

const MARGIN = 20;
/** The card the name is written on: its left and top, and the room under it, in cells. */
const SHEET = { x: 8, y: 4, foot: 4 } as const;
/** The box the name is typed into (ft_1_07.AC6): wide enough for the longest name in big letters, its height in cells. */
const FIELD_PAD = 5;
const FIELD_HEIGHT = 24;
/** The big letters' height and the widest big letter, in cells: the caret stands as tall, the box is as wide as 12 of them. */
const BIG_CAPS = 14;
const BIG_LETTER = 12;
const CARET_BLINK_MS = 530;
const BOTTOM_HEIGHT = 16;
/** The bottom row's centre sits this far above the main area's foot (d110: 320 x 157 on the target screen). */
const BOTTOM_FROM_FOOT = BOTTOM_HEIGHT / 2 + 13;
const ACTION_WIDTH = 40;
/** The closed book's left edge (its spine) from the screen's side, in cells; it is as far in on the right. */
const COVER_X = 6;
/** Room on the plate under the name for why a name was refused, in cells. */
const REASON_ROOM = 10;

/** What the picker asks, and what happens to the typed name. */
export interface NameData {
  title: string;
  /**
   * Saves the name and, when that worked, leaves for the next screen itself and returns null. A refused name (blank, or
   * another player's, ft_1_07.AC10) returns the reason: the box stays open and shows it.
   */
  save: (scene: Phaser.Scene, name: string) => Promise<string | null>;
  /** Leaves without saving (Back). None: the box has no Back (a new install's first player, ft_1_07.AC1). */
  back?: (scene: Phaser.Scene) => void;
}

/**
 * A name box a student can use (ft_1_07, AC6): the name is typed on the computer keyboard into a big box with a red caret,
 * with a delete button and a done button; only the letters of `NAME_LETTERS` are taken. The name is typed here, never in
 * the browser's box. Done hands the name to `save`, which leaves on success or says why the
 * name was refused (shown between the bottom buttons); Back leaves without saving. Used to rename a player (admin) and to
 * name a new one (ft_1_07.AC10). The letters and the length rule live in `core/text/nameEntry`.
 */
export class NameScene extends PixelScene {
  /** No player here yet (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  private request: NameData | null = null;
  private blink: Phaser.Time.TimerEvent | null = null;
  /**
   * A see-through text field over the name's box (ft_1_07.AC6): a tap on the box focuses it, which brings up a tablet's own
   * keyboard; what is typed into it becomes the name (`nameFrom`). The game draws the name, never the field.
   */
  private field: HTMLInputElement | null = null;
  private typed = '';
  private saving = false;
  /** Why the last Done was refused; cleared by the next letter. */
  private refused = '';

  protected override keyboardNavigation = true;

  constructor() {
    super('name');
  }

  init(data: NameData): void {
    this.request = data;
    this.toolbarBack = data.back !== undefined;
    this.typed = '';
    this.saving = false;
    this.refused = '';
  }

  protected override back(): void {
    this.request?.back?.(this);
  }

  /** The computer keys write the name (a letter of `NAME_LETTERS`, Backspace and Enter), and a tablet's keyboard through the field. */
  override create(): void {
    // ahead of the arrows-and-Enter navigation and of the computer-key piano, so a typed letter sounds no note
    this.onWindowKey((e) => this.onTyped(e));
    this.makeField();
    super.create();
  }

  /** The text field a tablet's keyboard types into, focused at once so a computer's keys go there too. */
  private makeField(): void {
    const field = document.createElement('input');
    field.type = 'text';
    field.id = 'name-field';
    field.autocomplete = 'off';
    field.spellcheck = false;
    field.setAttribute('autocapitalize', 'characters');
    field.setAttribute('autocorrect', 'off');
    field.setAttribute('enterkeyhint', 'done');
    // the field is see-through and the name is drawn by the scene: Esc, Tab and the arrows move about the screen (PixelScene)
    field.dataset.screenKeys = 'move';
    field.setAttribute('aria-label', this.request?.title ?? '');
    // see-through: the game draws the box, the letters and the caret; 16px so a phone or tablet does not zoom in on focus
    field.style.cssText = 'position:absolute;opacity:0;border:0;padding:0;margin:0;font-size:16px;background:transparent;color:transparent;caret-color:transparent;z-index:5';
    // the field's own caret stays at the end, where the game draws its red one: a letter is never put in the middle
    const toEnd = () => field.setSelectionRange(field.value.length, field.value.length);
    field.addEventListener('input', () => {
      this.typed = nameFrom(field.value);
      field.value = this.typed;
      toEnd();
      this.refused = '';
      this.redraw();
    });
    for (const event of ['focus', 'click']) field.addEventListener(event, toEnd);
    document.body.append(field);
    this.field = field;
    field.focus({ preventScroll: true });
    // the page moved under the field (a resize, a tablet's keyboard coming up): lay it over the box again
    const replace = () => this.redraw();
    window.addEventListener('resize', replace);
    window.visualViewport?.addEventListener('resize', replace);
    this.events.once('shutdown', () => {
      window.removeEventListener('resize', replace);
      window.visualViewport?.removeEventListener('resize', replace);
      field.remove();
      if (this.field === field) this.field = null;
    });
  }

  /** The field laid over the name's box (layout cells), wherever the canvas sits on the page. */
  private placeField(x: number, y: number, w: number, h: number): void {
    const field = this.field;
    if (!field) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const zoom = rect.width / this.scale.width;
    const at = (v: number, origin: number) => (origin + v * this.px.scale) * zoom;
    field.style.left = `${rect.left + window.scrollX + at(x, this.root.x)}px`;
    field.style.top = `${rect.top + window.scrollY + at(y, this.root.y)}px`;
    field.style.width = `${w * this.px.scale * zoom}px`;
    field.style.height = `${h * this.px.scale * zoom}px`;
  }

  private onTyped(e: KeyboardEvent): void {
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    // Esc is Back even while the field holds the keys (the screen's navigation leaves a field's keys alone)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.back();
      return;
    }
    const letter = e.key.length === 1 ? e.key.toLocaleUpperCase('et') : '';
    const done = e.key === 'Enter' && this.typed.length > 0;
    // with the field focused its own typing writes the name (a tablet's keyboard sends no key names, and `nameFrom` drops
    // what is no name letter): every printable key and Backspace only goes no further, so the computer-key piano plays no
    // note, a digit included; Esc, Tab and the arrows still move about the screen
    if (!done && this.field && document.activeElement === this.field && (e.key.length === 1 || e.key === 'Backspace')) {
      e.stopImmediatePropagation();
      return;
    }
    if (!NAME_LETTERS.includes(letter) && e.key !== 'Backspace' && !done) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (done) this.finish();
    else if (e.key === 'Backspace') this.delete();
    else this.type(letter);
  }

  protected draw(): void {
    const { width, height } = this.px;
    const bottomY = height - BOTTOM_FROM_FOOT;
    this.sky();
    // the name is written on the song book's cover (ft_1_07), on its blank name plate, the letters in ink: the same book
    // the piano holds, closed
    const fieldW = Math.min(width - 2 * MARGIN, NAME_MAX * BIG_LETTER + 2 * FIELD_PAD);
    const left = Math.round((width - fieldW) / 2) + FIELD_PAD;
    const fieldY = Math.round((height - FIELD_HEIGHT) / 2) - FIELD_PAD;
    const fine = (v: number) => v * ART_DETAIL;
    // a massive book, too big for the desk: its foot runs off the bottom of the screen
    const cover = { x: COVER_X, y: SHEET.y, w: width - 2 * COVER_X, h: height - SHEET.y };
    const plate = { x: fine(left - FIELD_PAD - cover.x), y: fine(fieldY - FIELD_PAD - cover.y), w: fine(fieldW), h: fine(FIELD_HEIGHT + REASON_ROOM) };
    this.fineImage(fine(cover.x), fine(cover.y), paintedOnce(`cover:${fine(cover.w)}x${fine(cover.h)}:${plate.x},${plate.y},${plate.w},${plate.h}`, () => paintCover(fine(cover.w), fine(cover.h), plate)), BOOK_PALETTE);
    this.placeField(left - FIELD_PAD, fieldY - FIELD_PAD, fieldW, FIELD_HEIGHT);
    this.inkWriting = true;
    // the name stands in the middle of the plate, as a name on a book's label does; raised when a reason is written under it
    const typedW = this.typed ? measure(drawnText(this.typed)) * 2 : 0;
    const nameX = Math.round(width / 2 - typedW / 2);
    const nameY = this.refused ? fieldY : fieldY - FIELD_PAD + Math.round((FIELD_HEIGHT + REASON_ROOM - BIG_CAPS) / 2);
    if (this.typed) this.label(nameX, nameY, this.typed, C.white, { big: true });
    const caret = createBitmap(fine(1), fine(BIG_CAPS));
    caret.pixels.fill(C.redDark);
    // the caret blinks, so the empty plate asks for letters without a word of instruction
    this.blink?.remove();
    const shown = this.fineImage(fine(nameX + (this.typed ? typedW + 2 : 0)), fine(nameY), caret);
    this.blink = this.time.addEvent({ delay: CARET_BLINK_MS, loop: true, callback: () => shown.setVisible(!shown.visible) });

    const band = this.bandShown;
    // with the band (ft_1_20 rule 1) Delete and Done are its actions
    const [del, done] = this.actions();
    if (!band) this.button({ x: MARGIN + ACTION_WIDTH / 2, y: bottomY, width: ACTION_WIDTH, height: BOTTOM_HEIGHT, look: 'ink', inkBox: true, iconOnly: true, ...del! });
    // why the name was refused stands under the box
    if (this.refused) this.label(left, fieldY + FIELD_HEIGHT - 2, this.refused, C.dim, { maxWidth: fieldW - 2 * FIELD_PAD });
    if (!band) this.button({ x: width - MARGIN - ACTION_WIDTH / 2, y: bottomY, width: ACTION_WIDTH, height: BOTTOM_HEIGHT, look: 'ink', inkBox: true, iconOnly: true, ...done! });
  }

  protected override bandActions(): ToolbarItem[] {
    return this.actions();
  }

  /** Delete the last letter and Done: buttons at the card's foot, or the band's actions. */
  private actions(): ToolbarItem[] {
    return [
      { label: t('name.delete'), icon: TOOL_ICONS.backspace, tooltip: t('name.delete'), onClick: () => this.delete() },
      { label: t('name.done'), icon: TOOL_ICONS.tick, tooltip: t('name.done'), main: true, onClick: () => this.finish() },
    ];
  }

  private type(letter: string): void {
    this.typed = typeLetter(this.typed, letter);
    if (this.field) this.field.value = this.typed;
    this.refused = '';
    this.redraw();
  }

  private delete(): void {
    this.typed = deleteLetter(this.typed);
    if (this.field) this.field.value = this.typed;
    this.refused = '';
    this.redraw();
  }

  private finish(): void {
    if (!this.request || this.saving) return;
    this.saving = true;
    void this.request.save(this, this.typed)
      .catch(() => t('admin.failed'))
      .then((refused) => {
        this.saving = false;
        if (refused === null) return;
        this.refused = refused;
        this.redraw();
      });
  }
}
