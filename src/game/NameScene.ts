import type Phaser from 'phaser';
import { NAME_LETTERS, deleteLetter, typeLetter } from '../core/text/nameEntry';
import { t } from '../core/text/strings';
import { C } from './ui/pixel/palette';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';

const MARGIN = 20;
/** The card the name is written on: its left and top, and the room under it, in cells. */
const SHEET = { x: 8, y: 4, foot: 4 } as const;
const TITLE_Y = 10;
const FIELD_Y = 22;
const GRID_TOP = 44;
const CELL_WIDTH = 26;
const CELL_HEIGHT = 14;
const CELL_GAP_X = 20;
const CELL_GAP_Y = 3;
const COLUMNS = 6;
/** With the band (ft_1_20) the letters start higher and sit closer, so all five rows fit the card in the 124 rows. */
const BAND_GRID_TOP = 36;
const BAND_CELL_GAP_Y = 2;
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
 * A name box a student can use (ft_1_07, AC6): the Estonian letters as big buttons, a delete button and a done button. The
 * name is typed here, never in the browser's box. Done hands the name to `save`, which leaves on success or says why the
 * name was refused (shown between the bottom buttons); Back leaves without saving. Used to rename a player (admin) and to
 * name a new one (ft_1_07.AC10). The letters and the length rule live in `core/text/nameEntry`.
 */
export class NameScene extends PixelScene {
  /** No player here yet (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  private request: NameData | null = null;
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

  /** The computer keys write the name too (typing on the computer keyboard is wanted): a letter of the picker, Backspace and Enter. */
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
    // the name so far, big; nothing while it is empty, no instructions
    this.label(MARGIN, FIELD_Y, this.typed, C.white, { big: true, maxWidth: (width - 2 * MARGIN) / 2 });

    const band = this.bandShown;
    NAME_LETTERS.forEach((letter, i) => {
      const x = MARGIN + (i % COLUMNS) * (CELL_WIDTH + CELL_GAP_X) + CELL_WIDTH / 2;
      const y = (band ? BAND_GRID_TOP : GRID_TOP) + Math.floor(i / COLUMNS) * (CELL_HEIGHT + (band ? BAND_CELL_GAP_Y : CELL_GAP_Y)) + CELL_HEIGHT / 2;
      this.button({ x, y, width: CELL_WIDTH, height: CELL_HEIGHT, label: letter, look: 'ink', inkBox: true, onClick: () => this.type(letter) });
    });
    // with the band (ft_1_20 rule 1) Delete and Done are its actions; the letters stay on the card (list entries)
    const [del, done] = this.actions();
    if (!this.bandShown) this.button({ x: MARGIN + ACTION_WIDTH / 2, y: bottomY, width: ACTION_WIDTH, height: BOTTOM_HEIGHT, look: 'ink', inkBox: true, iconOnly: true, ...del! });
    if (this.refused) {
      // with the band the reason stands right of the name, where the bottom row's buttons no longer are
      const left = band ? width / 2 : MARGIN + ACTION_WIDTH + CELL_GAP_X;
      this.label(left, band ? FIELD_Y + 4 : bottomY - 4, this.refused, C.dim, { maxWidth: band ? width / 2 - MARGIN : width - 2 * left });
    }
    if (!this.bandShown) this.button({ x: width - MARGIN - ACTION_WIDTH / 2, y: bottomY, width: ACTION_WIDTH, height: BOTTOM_HEIGHT, look: 'ink', inkBox: true, iconOnly: true, ...done! });
  }

  protected override stripCells(): ToolbarItem[] {
    return this.actions();
  }

  /** Delete the last letter and Done: buttons under the letters, or the band's actions. */
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
