import type Phaser from 'phaser';
import { lineSpot, type Point } from '../../core/layout/talk';
import { PixelImage } from '../ui/pixel/PixelObjects';
import { spokenLine, spokenPages, talkColour } from '../ui/pixel/talkArt';

/** Who speaks in the room: Kiur, or the teacher when she has landed (ft_1_27). */
export type RoomSpeaker = 'kiur' | 'teacher';

/** A line said in the room, as it reads (its piece's title filled in). */
export interface RoomLine {
  readonly who: RoomSpeaker;
  readonly text: string;
}

/** Where the lines are drawn: the main area's size and each speaker's head, in art pixels of the main area. */
export interface RoomTalkPlace {
  readonly area: { readonly w: number; readonly h: number };
  readonly heads: Readonly<Record<RoomSpeaker, Point>>;
}

/**
 * The lines said in the room (ft_1_27.AC2, AC3; WP-15), drawn as the conversations are (`talkView`, the painter's
 * `talkArt`): each line over its speaker's head in their colour, a page at a time. A press anywhere, Space or Enter turns
 * the page or goes to the next line; after the last `ended` is called. Esc leaves. What is said is `core/island/roomTalk.ts`.
 */
export class RoomTalkView {
  private line = 0;
  private page = 0;
  private done = false;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly lines: readonly RoomLine[],
    private readonly handlers: { readonly changed: () => void; readonly ended: (how: 'read' | 'left') => void },
  ) {}

  /** What shows now, for the tests and the self-playing demo; null once over. */
  get state(): { who: RoomSpeaker; text: string; page: number; index: number } | null {
    const l = this.lines[this.line];
    return this.done || !l ? null : { who: l.who, text: l.text, page: this.page, index: this.line };
  }

  /** The next page, or the next line; after the last, the talk ends. */
  press(): void {
    const l = this.lines[this.line];
    if (this.done || !l) return;
    if (this.page + 1 < spokenPages(l.text).length) this.page += 1;
    else {
      this.line += 1;
      this.page = 0;
    }
    if (this.line >= this.lines.length) return this.end('read');
    this.handlers.changed();
  }

  /** Esc: nothing more is said. */
  leave(): void {
    if (!this.done) this.end('left');
  }

  /** Keys while talking: true when the key was the talk's. */
  key(e: KeyboardEvent): boolean {
    if (this.done) return false;
    if (e.key === 'Escape') this.leave();
    else if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) this.press(); }
    else if (e.key !== 'Tab') return false;
    return true;
  }

  /** Draws the line showing now on `layer`; the scene calls it from its `draw`. */
  drawIn(layer: Phaser.GameObjects.Container, place: RoomTalkPlace): void {
    this.clear();
    const l = this.lines[this.line];
    if (this.done || !l) return;
    const { area } = place;
    // a press anywhere is the talk's: the room under it takes none while it is open
    const catcher = this.scene.add.zone(0, -area.h, area.w, area.h * 3).setOrigin(0).setInteractive();
    catcher.on('pointerup', () => this.press());
    layer.add(catcher);
    this.objects.push(catcher);
    const rows = spokenPages(l.text)[this.page] ?? [];
    const words = spokenLine(rows, l.who === 'kiur' ? talkColour('kiur') : talkColour('character', 'teacher'));
    const spot = lineSpot({ head: place.heads[l.who], size: { w: words.width, h: words.height }, area });
    const image = new PixelImage(this.scene, spot.x, spot.y, words).setName('roomLine');
    layer.add(image);
    this.objects.push(image);
  }

  clear(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
  }

  private end(how: 'read' | 'left'): void {
    this.done = true;
    this.clear();
    this.handlers.ended(how);
  }
}
