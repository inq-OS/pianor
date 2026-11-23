import type Phaser from 'phaser';
import type { CharacterDef } from '../../core/character/character';
import type { StringKey } from '../../core/contracts';
import type { Conversation, Effect } from '../../core/dialogue/conversation';
import type { Outcome, TalkFacts } from '../../core/dialogue/talk';
import { chooseInTalk, openTalk, pressInTalk, type TalkFlow } from '../../core/dialogue/talkFlow';
import { choiceLayout, lineSpot, studentHead, type Point } from '../../core/layout/talk';
import { BOARD_ROWS } from '../../core/layout/board';
import { choiceNote, choiceRows, choiceWords, spokenLine, spokenPages, talkBoard, talkColour } from '../ui/pixel/talkArt';
import { PixelImage } from '../ui/pixel/PixelObjects';
import { lineText } from './sceneScript';
import { LINE_HEIGHT } from '../ui/pixel/font';

/** Where the conversation is drawn: the main area's size and the speaker's head. */
export interface TalkPlace {
  readonly area: { readonly w: number; readonly h: number };
  /** The character's head, in art pixels of the main area. */
  readonly head: Point;
}

export interface TalkHandlers {
  /** A node was shown: apply its flag and item effects to the world and save. */
  effects(effects: readonly Effect[]): void;
  /** The character speaks (true) or listens (false): its figure shows its state. */
  speaking(on: boolean): void;
  /** The talk is over; the outcome of its last node, if it had one (`teach`, `tug`, `checkup` start playing, WP-12, WP-13). */
  ended(outcome: Outcome | undefined): void;
}

/** The words of a line, a page at a time (the game's font), for `talkFlow`. */
const pagesOf = (key: StringKey): number => spokenPages(lineText(key)).length;

/**
 * A conversation drawn over a scene (ft_1_22.AC1, WP-09; the painter's look `talkArt.ts`, its places `core/layout/talk.ts`):
 * the speaker's line over their head, a page at a time; the student's choices on the board over the band, each lit under
 * the pointer or the keys. A press anywhere, Space or Enter turns the page; the arrows and Enter, a number key or a click
 * pick a choice; Esc leaves. What is said and what follows is `core/dialogue/talkFlow.ts`: this only draws it.
 */
export class TalkView {
  private flow: TalkFlow | null;
  private lit = 0;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  /** While choosing: for each choice, show it lit (true) or dim. */
  private lights: ((on: boolean) => void)[] = [];

  private constructor(
    private readonly scene: Phaser.Scene,
    private layer: Phaser.GameObjects.Container,
    private readonly conversation: Conversation,
    private readonly character: CharacterDef,
    private readonly place: TalkPlace,
    private readonly handlers: TalkHandlers,
    flow: TalkFlow,
  ) {
    this.flow = flow;
  }

  /** Opens the talk; null (and nothing drawn) when the conversation has nothing to say with these facts. */
  static open(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, conversation: Conversation, character: CharacterDef, facts: TalkFacts, place: TalkPlace, handlers: TalkHandlers): TalkView | null {
    const flow = openTalk(conversation, facts, pagesOf);
    if (!flow) return null;
    const view = new TalkView(scene, layer, conversation, character, place, handlers, flow);
    view.shown();
    return view;
  }

  /** What the talk shows now; null once it is over. For the tests and the self-playing demo. */
  get state(): { showing: TalkFlow['showing']; node: string; line: StringKey; page: number; choices: StringKey[]; lit: number } | null {
    const f = this.flow;
    return f ? { showing: f.showing, node: f.step.node, line: f.said ?? f.step.line, page: f.page, choices: f.step.choices.map((c) => c.text), lit: this.lit } : null;
  }

  /** The index of the shown choice that leads to a node starting `outcome` (the self-playing demo); -1 when none does. */
  choiceTo(outcome: 'tug' | 'teach'): number {
    const f = this.flow;
    if (!f || f.showing !== 'choices') return -1;
    return f.step.choices.findIndex((c) => (this.conversation.nodes[c.next]?.effects ?? []).some((e) => outcome in e));
  }

  /** A press anywhere (a click, Space, Enter): the next page or the next node; while choosing, Enter picks the lit choice. */
  press(): void {
    const f = this.flow;
    if (!f) return;
    if (f.showing === 'choices') return this.choose(this.lit);
    this.advance(pressInTalk(this.conversation, f, pagesOf), f.step.outcome);
  }

  /** Pick choice `index` of the ones shown (a click, a number key, or Enter on the lit one). */
  choose(index: number): void {
    const f = this.flow;
    if (!f || f.showing !== 'choices' || index < 0 || index >= f.step.choices.length) return;
    this.flow = chooseInTalk(f, index, pagesOf);
    this.draw();
  }

  /** Light the choice above (-1) or below (1), wrapping round. */
  moveLit(by: -1 | 1): void {
    const f = this.flow;
    if (!f || f.showing !== 'choices') return;
    const n = f.step.choices.length;
    this.light((this.lit + by + n) % n);
  }

  /** Esc: the talk ends here, nothing more is said or played. */
  leave(): void {
    if (!this.flow) return;
    this.flow = null;
    this.clear();
    this.handlers.speaking(false);
    this.handlers.ended(undefined);
  }

  /**
   * Keys while talking: true when the key was the talk's (the scene then stops it). A held Space or Enter and Tab are
   * the talk's too, doing nothing, so they never reach the buttons under the talk.
   */
  key(e: KeyboardEvent): boolean {
    if (!this.flow) return false;
    if (e.key === 'Escape') this.leave();
    else if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) this.press(); }
    else if (e.key === 'ArrowUp') this.moveLit(-1);
    else if (e.key === 'ArrowDown') this.moveLit(1);
    else if (/^[1-9]$/.test(e.key)) this.choose(Number(e.key) - 1);
    else if (e.key !== 'Tab') return false;
    return true;
  }

  /** Remove what the talk drew (the scene is drawn again, or the talk ended). */
  clear(): void {
    this.lights = [];
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
  }

  /** Draw again where the screen now is (after the scene was drawn again on a resize). */
  redrawIn(layer: Phaser.GameObjects.Container): void {
    this.layer = layer;
    this.draw();
  }

  private advance(next: TalkFlow | null, outcome: Outcome | undefined): void {
    this.flow = next;
    if (!next) {
      this.clear();
      this.handlers.speaking(false);
      this.handlers.ended(outcome);
      return;
    }
    this.shown();
  }

  /** A step was reached: hand its effects over once, then draw it. */
  private shown(): void {
    const f = this.flow!;
    if (f.newEffects.length > 0) this.handlers.effects(f.newEffects);
    this.lit = 0;
    this.draw();
  }

  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.layer.add(object);
    this.objects.push(object);
    return object;
  }

  private draw(): void {
    this.clear();
    const f = this.flow;
    if (!f) return;
    const { area } = this.place;
    // a press anywhere on the screen is the talk's: the scene and the band under it take none while it is open
    const catcher = this.add(this.scene.add.zone(0, -area.h, area.w, area.h * 3).setOrigin(0).setInteractive());
    // while choosing, a click beside the choices does nothing: only a click on one picks it (no stray pick by a student's tap)
    catcher.on('pointerup', () => { if (this.flow?.showing !== 'choices') this.press(); });
    const characterSpeaks = f.showing === 'line' && f.step.speaker === 'character';
    this.handlers.speaking(characterSpeaks);
    if (f.showing === 'choices') return this.drawChoices(f);
    const student = f.showing === 'student' || f.step.speaker === 'student';
    const text = lineText(f.said ?? f.step.line);
    const rows = spokenPages(text)[f.page] ?? [];
    const colour = student ? talkColour('student') : talkColour(f.step.speaker, this.character.id);
    const words = spokenLine(rows, colour);
    const head = student ? studentHead(area) : this.place.head;
    const spot = lineSpot({ head, size: { w: words.width, h: words.height }, area });
    this.add(new PixelImage(this.scene, spot.x, spot.y, words).setName('talkLine'));
  }

  private drawChoices(f: TalkFlow): void {
    const { area } = this.place;
    // the board along the foot, under the picture (`BOARD_ROWS`)
    const top = area.h - BOARD_ROWS;
    const width = area.w;
    this.add(new PixelImage(this.scene, 0, top, talkBoard(width)).setName('talkBoard'));
    const texts = f.step.choices.map((c) => lineText(c.text));
    const { textWidth } = choiceLayout({ rows: texts.map(() => 1), lineHeight: LINE_HEIGHT, width });
    const { choices } = choiceLayout({ rows: texts.map((s) => choiceRows(s, textWidth)), lineHeight: LINE_HEIGHT, width });
    // each choice is drawn dim and lit once; lighting one only shows the other picture, so the pointer's zones stay put
    this.lights = choices.map((spot, i) => {
      const looks = [false, true].map((lit) => [
        this.add(new PixelImage(this.scene, spot.bullet.x, top + spot.bullet.y, choiceNote(lit))),
        this.add(new PixelImage(this.scene, spot.text.x, top + spot.text.y, choiceWords(texts[i]!, textWidth, lit)).setName(lit ? `talkChoiceLit:${i}` : `talkChoice:${i}`)),
      ]);
      const hit = this.add(this.scene.add.zone(spot.hit.x, top + spot.hit.y, spot.hit.w, spot.hit.h).setOrigin(0).setInteractive({ useHandCursor: true }));
      hit.on('pointerover', () => this.light(i));
      hit.on('pointerup', () => this.choose(i));
      return (on: boolean) => {
        looks[0]!.forEach((o) => o.setVisible(!on));
        looks[1]!.forEach((o) => o.setVisible(on));
      };
    });
    this.light(this.lit);
  }

  /** Light choice `index` and dim the others. */
  private light(index: number): void {
    this.lit = index;
    this.lights.forEach((show, i) => show(i === index));
  }
}
