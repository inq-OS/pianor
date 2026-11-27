import { rectCentre, type Rect } from '../../core/layout/rect';
import type { LevelInfo } from '../../core/progression';
import { pieceTitle } from '../../core/text/pieceTitle';
import { t } from '../../core/text/strings';
import { contextOf } from '../context';
import type { CompletionOutcome } from '../profile/ProfileService';
import { C } from '../ui/pixel/palette';
import { PixelBar } from '../ui/pixel/PixelObjects';
import { PixelScene, type ToolbarItem } from '../ui/pixel/PixelScene';
import { TOOL_ICONS } from '../ui/pixel/toolArt';
import type { Bitmap } from '../ui/pixel/bitmap';
import { paintSeal } from '../ui/pixel/paint/card';
import { goBackFrom, type SongReturn } from '../songReturn';

/** The big XP line and the steps after it; the level line, the gap to its bar and the gap under the bar. */
/** How far a bar written on a card stays in from the card's torn edge, in cells. */
const INK_EDGE = 8;
const BIG_LINE = 18;
const LINE = 12;
const BAR_GAP = 14;
const BAR_WIDTH = 170;
const BAR_HEIGHT = 9;
/** Under a line that may wrap (a level-up): its own height and this gap. */
const EVENT_GAP = 4;

/**
 * What a results screen shares: the keyboard and Esc go
 * back to the menu, the two buttons on the left, and in the numbers column the XP line and a level with its bar (the
 * piece's after a piece: ft_1_13), a level-up and a failed save. Positions in art pixels.
 */
export abstract class OutcomeScene extends PixelScene {
  protected override keyboardNavigation = true;
  /** With the band: play again and back to the pieces, set by `againAndBack` while the screen draws. */
  private outcomeActions: ToolbarItem[] = [];
  /** Where Back and the pieces button lead: the song page or songs list a song's play started from (ft_1_36), else the book. */
  protected fromSong: SongReturn | undefined = undefined;

  protected override bandActions(): ToolbarItem[] {
    return this.outcomeActions;
  }

  protected override back(): void {
    goBackFrom(this, this.fromSong);
  }

  /** The play-again button (`again` from `resultsLayout`) and, under it, back to the pieces. */
  /** Two small icon buttons (ft_1_12.AC7): play again (the loop), back to the pieces (the cards); their labels are the tooltips. */
  protected againAndBack(again: Rect, back: Rect, againLabel: string, onAgain: () => void, more?: { at: Rect; label: string; icon: Bitmap; onClick: () => void }): void {
    // with the band (ft_1_20) the two (and a screen's third, `more`) are its actions, not buttons on the screen
    if (this.bandShown) {
      this.outcomeActions = [
        { label: againLabel, icon: TOOL_ICONS.repeat, main: true, onClick: onAgain },
        { label: this.backLabel(), icon: this.fromSong ? TOOL_ICONS.songs : TOOL_ICONS.bookOpen, onClick: () => this.back() },
        ...(more ? [{ label: more.label, icon: more.icon, onClick: more.onClick }] : []),
      ];
      return;
    }
    // on a card the two are wax seals pressed into it, their pictures in the wax
    const sealed = (icon: Bitmap) => (this.inkWriting ? { picture: paintSeal(icon, Math.min(again.w, again.h)) } : {});
    this.button({ ...rectCentre(again), label: againLabel, icon: TOOL_ICONS.repeat, iconOnly: true, ...sealed(TOOL_ICONS.repeat), onClick: onAgain });
    const backIcon = this.fromSong ? TOOL_ICONS.songs : TOOL_ICONS.bookOpen;
    this.button({ ...rectCentre(back), label: this.backLabel(), icon: backIcon, iconOnly: true, ...sealed(backIcon), onClick: () => this.back() });
    if (more) this.button({ ...rectCentre(more.at), label: more.label, icon: more.icon, iconOnly: true, ...sealed(more.icon), onClick: more.onClick });
  }

  /** The back button's name: to the pieces, or to the song or songs list a song's play started from. */
  private backLabel(): string {
    return t(this.fromSong === undefined ? 'results.pieces' : this.fromSong === 'songs' ? 'results.songs' : 'results.song');
  }

  /** A piece's title as the menu shows it, or its id when it is not on offer. */
  protected pieceTitle(id: string): string {
    const found = contextOf(this).pieces.find(id);
    return found ? pieceTitle(found.chart) : id;
  }

  /** The XP earned, big, and under it why (`why`, which may wrap in `room`; null for none); returns the y `gap` under it. */
  protected xpLines(x: number, y: number, room: number, xp: number, why: string | null, gap: number): number {
    this.label(x, y, t('results.xp', { xp }), C.gold, { big: true });
    const next = y + BIG_LINE;
    if (why === null) return next + gap;
    return next + this.label(x, next, why, C.dim, { maxWidth: room }).height + gap;
  }

  /** A level line ("Level 2   30 / 100 XP") and its bar; returns the y under the bar. */
  protected levelLines(x: number, y: number, room: number, level: LevelInfo, totalXp: number): number {
    const xp = level.xpForLevel === null ? t('menu.xpTop', { xp: totalXp }) : t('menu.xp', { xp: level.xpIntoLevel, next: level.xpForLevel });
    this.label(x, y, `${t('results.level', { level: level.level })}   ${xp}`, C.white, { maxWidth: room });
    // on a card the bar keeps clear of its torn edge
    const barRoom = this.inkWriting ? room - INK_EDGE : room;
    this.root.add(new PixelBar(this, x, y + LINE, Math.min(barRoom, BAR_WIDTH), BAR_HEIGHT, level.progress, this.inkWriting ? 'ink' : undefined));
    return y + LINE + BAR_GAP;
  }

  /** A green line that may wrap (a level reached); returns the y under it. */
  protected eventLine(x: number, y: number, room: number, text: string): number {
    return y + this.label(x, y, text, C.green, { maxWidth: room }).height + EVENT_GAP;
  }

  /** Says so when the save failed; returns the y under it. */
  protected saveLine(x: number, y: number, room: number, outcome: CompletionOutcome): number {
    return outcome.saved ? y : y + this.label(x, y, t('results.saveFailed'), C.gold, { maxWidth: room }).height + EVENT_GAP;
  }

  /** The player's level line and its bar, then a level-up, then a failed save; says whether a level was gained and where the lines end. */
  protected outcomeLines(x: number, y: number, room: number, outcome: CompletionOutcome): { leveledUp: boolean; bottom: number } {
    y = this.levelLines(x, y, room, outcome.after.level, outcome.after.totalXp);
    let leveledUp = false;
    for (const event of outcome.events) {
      if (event.type !== 'LevelUp') continue;
      leveledUp = true;
      y = this.eventLine(x, y, room, t('results.levelUp', { level: event.to }));
    }
    return { leveledUp, bottom: this.saveLine(x, y, room, outcome) };
  }
}
