import type Phaser from 'phaser';
import { lineSpot, type Point } from '../../core/layout/talk';
import { PixelImage } from '../ui/pixel/PixelObjects';
import { createBitmap, blit, type Bitmap } from '../ui/pixel/bitmap';
import { panelBitmap } from '../ui/pixel/frames';
import { spokenLine, spokenPages, talkColour } from '../ui/pixel/talkArt';

/** Who speaks in the room: Kiur, or the teacher when she has landed (ft_1_27). */
export type RoomSpeaker = 'kiur' | 'teacher';

/** A line said in the room, as it reads (its piece's title filled in). */
export interface RoomLine {
  readonly who: RoomSpeaker;
  readonly text: string;
  /** Said by a thing in the room rather than at the speaker's head: the telephone's message by the telephone. */
  readonly from?: 'phone';
}

/** Where the lines are drawn: the main area's size and each speaker's head, in art pixels of the main area. */
export interface RoomTalkPlace {
  readonly area: { readonly w: number; readonly h: number };
  readonly heads: Readonly<Record<RoomSpeaker, Point>>;
  /** Where a thing that speaks stands (its top's middle), for a line said `from` it. */
  readonly things?: { readonly phone?: Point };
  /** Rows at the area's top a line keeps off: the corner buttons' strip. */
  readonly top?: number;
}

/** Room round the words on their plate, and the "next" mark's width, in art pixels. */
const PLATE = { padX: 4, padY: 3, cue: 5 } as const;

/**
 * A line's page on its plate (the room's lines are said over a busy picture): the words on a board of the room's panels,
 * with a small mark at its lower right that a press goes on. AX-3 provisional: the plate's look (the painter's to refine).
 */
function onPlate(words: Bitmap, colour: number): Bitmap {
  const w = words.width + 2 * PLATE.padX + PLATE.cue, h = words.height + 2 * PLATE.padY;
  const plate = panelBitmap(w, h, 'panel');
  blit(plate, words, PLATE.padX, PLATE.padY);
  // the mark: a small triangle pointing down, in the speaker's colour
  const cue = createBitmap(5, 3);
  for (let y = 0; y < 3; y++) for (let x = y; x < 5 - y; x++) cue.pixels[y * 5 + x] = colour;
  blit(plate, cue, w - PLATE.padX - 4, h - PLATE.padY - 3);
  return plate;
}

/**
 * The lines said in the room (ft_1_27.AC2, AC3; WP-15), drawn as the conversations are (`talkView`, the painter's
 * `talkArt`): each line over its speaker's head in their colour, on a plate with a "next" mark, a page at a time. A press,
 * Space or Enter turns the page or goes to the next line; after the last `ended` is called. Esc leaves. A press the scene
 * takes (`through`: on one of its objects) ends the talk as left, and the scene does what was pressed. What is said is
 * `core/island/roomTalk.ts`.
 */
export class RoomTalkView {
  private line = 0;
  private page = 0;
  private done = false;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly lines: readonly RoomLine[],
    private readonly handlers: {
      readonly changed: () => void;
      readonly ended: (how: 'read' | 'left') => void;
      /** A press at this pointer: true when the scene takes it (the talk then ends as left). */
      readonly through?: (pointer: Phaser.Input.Pointer) => boolean;
    },
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
    catcher.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      if (this.handlers.through?.(pointer) !== true) this.press();
    });
    layer.add(catcher);
    this.objects.push(catcher);
    const rows = spokenPages(l.text)[this.page] ?? [];
    const colour = l.who === 'kiur' ? talkColour('kiur') : talkColour('character', 'teacher');
    const plate = onPlate(spokenLine(rows, colour), colour);
    const head = (l.from && place.things?.[l.from]) ?? place.heads[l.who];
    // laid in the area under the corner buttons' strip, so a line never covers the way back or the gear
    const top = place.top ?? 0;
    const under = lineSpot({ head: { x: head.x, y: head.y - top }, size: { w: plate.width, h: plate.height }, area: { w: area.w, h: area.h - top } });
    const spot = { x: under.x, y: under.y + top };
    const image = new PixelImage(this.scene, spot.x, spot.y, plate).setName('roomLine');
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
