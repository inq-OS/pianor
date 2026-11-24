import type Phaser from 'phaser';
import { ART_DETAIL } from '../core/layout/frame';
import { NAME_LETTERS, NAME_MAX, deleteLetter, typeLetter } from '../core/text/nameEntry';
import { t } from '../core/text/strings';
import { createBitmap } from './ui/pixel/bitmap';
import { drawnText, measure } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { inkField } from './ui/pixel/paint/register';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';

const MARGIN = 20;
/** The card the name is written on: its left and top, and the room under it, in cells. */
const SHEET = { x: 8, y: 4, foot: 4 } as const;
const TITLE_Y = 10;
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

  /** The computer keys write the name: a letter of `NAME_LETTERS`, Backspace and Enter. */
  override create(): void {
    // ahead of the arrows-and-Enter navigation and of the computer-key piano, so a typed letter sounds no note
    this.onWindowKey((e) => this.onTyped(e));
    super.create();
  }

  private onTyped(e: KeyboardEvent): void {
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    const letter = e.key.length === 1 ? e.key.toLocaleUpperCase('et') : '';
    const done = e.key === 'Enter' && this.typed.length > 0;
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
    // the name is written on a card of parchment on the desk, the letters as keys drawn in ink on it
    this.parchmentCard({ x: SHEET.x, y: SHEET.y, w: width - 2 * SHEET.x, h: height - SHEET.y - (this.bandShown ? 1 : SHEET.foot) }, 1);
    this.inkWriting = true;
    // with the band the door stands in the top left corner: the title starts right of it
    this.label(this.titleX(MARGIN), TITLE_Y, this.request?.title ?? '', C.gold);
    // the box the name is typed into, big and red while it waits for letters, with the caret where the next one goes
    // in the middle of the card, so the one thing to do there is plain to see
    const fieldW = Math.min(width - 2 * MARGIN, NAME_MAX * BIG_LETTER + 2 * FIELD_PAD);
    const left = Math.round((width - fieldW) / 2) + FIELD_PAD;
    const fieldY = Math.round((height - FIELD_HEIGHT) / 2) - FIELD_PAD;
    const fine = (v: number) => v * ART_DETAIL;
    this.fineImage(fine(left - FIELD_PAD), fine(fieldY - FIELD_PAD), inkField(fine(fieldW), fine(FIELD_HEIGHT), true));
    if (this.typed) this.label(left, fieldY, this.typed, C.white, { big: true });
    const caret = createBitmap(fine(1), fine(BIG_CAPS));
    caret.pixels.fill(C.redDark);
    // the caret blinks, so the empty box asks for letters without a word of instruction
    this.blink?.remove();
    const shown = this.fineImage(fine(left + (this.typed ? measure(drawnText(this.typed)) * 2 + 2 : 0)), fine(fieldY), caret);
    this.blink = this.time.addEvent({ delay: CARET_BLINK_MS, loop: true, callback: () => shown.setVisible(!shown.visible) });

    const band = this.bandShown;
    // with the band (ft_1_20 rule 1) Delete and Done are its actions
    const [del, done] = this.actions();
    if (!band) this.button({ x: MARGIN + ACTION_WIDTH / 2, y: bottomY, width: ACTION_WIDTH, height: BOTTOM_HEIGHT, look: 'ink', inkBox: true, iconOnly: true, ...del! });
    // why the name was refused stands under the box
    if (this.refused) this.label(left - FIELD_PAD, fieldY + FIELD_HEIGHT, this.refused, C.dim, { maxWidth: fieldW });
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
    this.refused = '';
    this.redraw();
  }

  private delete(): void {
    this.typed = deleteLetter(this.typed);
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
