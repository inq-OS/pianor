/**
 * One play of a theory lesson (ft_1_39): its six steps in order, what is awaited, which keys are lit, the clean run of Try,
 * the check's first tries and its medal, and the theory XP earned. The scene draws it and plays Kiur's show; this decides.
 * Pure: no DOM, no engine. Never saved (the medal is kept from slice 2).
 */
import { classifyWrongNote } from '../judge/classify';
import type { NoteEvent, WrongReason } from '../judge/types';
import { medalOf, type Medal } from '../learn/progress';
import { lessonItems, type Lesson, type LessonItem, type LessonMark } from './lesson';

export type LessonStep = 'show' | 'copy' | 'pitfall' | 'try' | 'playAlong' | 'check' | 'done';
const ORDER: readonly LessonStep[] = ['show', 'copy', 'pitfall', 'try', 'playAlong', 'check', 'done'];

export const LESSON_RULES = {
  /** `AX-3 provisional:` clean items in a row that finish Try (AX-1: a run, not a total). */
  tryRun: 5,
  /**
   * `AX-3 provisional:` how the light fades in Try, by the items finished in it: the awaited key is lit at once for the
   * first `litUntil`, then only after `afterWrong` wrong presses until `afterWrongUntil`, then never (ft_Y_06's rule).
   */
  fade: { litUntil: 2, afterWrongUntil: 4, afterWrong: 2 },
  /** Theory XP for each right note after the show, as the scales and chords trainer gives (ft_1_29). */
  xpPerNote: 10,
} as const;

/** What the staff shows now: its notes, what is to be played, how much of it is played, and the step's marks. */
export interface LessonNow extends LessonItem {
  played: number;
  marks: readonly LessonMark[];
}

export type LessonPress =
  | { verdict: 'ignored' }
  | { verdict: 'right'; itemDone: boolean; stepDone: boolean }
  /** `pitfall`: the mistake has the reason of the lesson's pitfall, so its card comes back. */
  | { verdict: 'wrong'; midi: number; reason: WrongReason; pitfall: boolean };

export class LessonRun {
  private stepIndex = 0;
  private items: LessonItem[] = [];
  private itemIndex = 0;
  private played = 0;
  private wrongOnItem = 0;
  private run = 0;
  private finishedInStep = 0;
  private firstTry = 0;
  private earned = 0;
  private result: Medal | null = null;
  private tryRound = 0;

  constructor(private readonly lesson: Lesson, private readonly seed: string) {}

  step(): LessonStep {
    return ORDER[this.stepIndex]!;
  }

  /** Kiur has played the show: the student copies it. */
  showDone(): void {
    if (this.step() === 'show') this.enter(1);
  }

  /** The item on the staff now, or null in the show and when the lesson is done. */
  current(): LessonNow | null {
    const item = this.items[this.itemIndex];
    if (!item) return null;
    return { ...item, played: this.played, marks: this.marksOf() };
  }

  /** The keys to light now: the awaited one in Copy and the pitfall, in Try as the help fades, never in the play-along or the check. */
  lit(): number[] {
    const awaited = this.items[this.itemIndex]?.answer[this.played];
    if (awaited === undefined) return [];
    const step = this.step();
    if (step === 'copy' || step === 'pitfall') return [awaited];
    if (step !== 'try') return [];
    const { litUntil, afterWrongUntil, afterWrong } = LESSON_RULES.fade;
    if (this.finishedInStep < litUntil) return [awaited];
    if (this.finishedInStep < afterWrongUntil && this.wrongOnItem >= afterWrong) return [awaited];
    return [];
  }

  press(event: NoteEvent): LessonPress {
    if (event.kind === 'off' || event.velocity === 0) return { verdict: 'ignored' };
    const item = this.items[this.itemIndex];
    const awaited = item?.answer[this.played];
    if (!item || awaited === undefined) return { verdict: 'ignored' };
    if (event.midi !== awaited) {
      this.wrongOnItem += 1;
      if (this.step() === 'try') this.run = 0;
      const { reason } = classifyWrongNote(event.midi, [awaited]);
      const asked = this.step() === 'try' || this.step() === 'check';
      return { verdict: 'wrong', midi: event.midi, reason, pitfall: asked && reason === this.lesson.pitfall.reason };
    }
    this.played += 1;
    this.earned += LESSON_RULES.xpPerNote;
    if (this.played < item.answer.length) return { verdict: 'right', itemDone: false, stepDone: false };
    return { verdict: 'right', itemDone: true, stepDone: this.finishItem() };
  }

  /** Clean items in a row in Try. */
  cleanRun(): number {
    return this.run;
  }

  /** The check's items right the first time, of all its items so far. */
  checkScore(): { firstTry: number; of: number } {
    return { firstTry: this.firstTry, of: this.lesson.check.count };
  }

  /** The lesson's medal once the check is played (gold, silver or bronze by its items not right the first time), else null. */
  medal(): Medal | null {
    return this.result;
  }

  xp(): number {
    return this.earned;
  }

  /** Ends the current item; true when that ends the step too. */
  private finishItem(): boolean {
    const clean = this.wrongOnItem === 0;
    const step = this.step();
    this.finishedInStep += 1;
    if (step === 'try') this.run = clean ? this.run + 1 : 0;
    if (step === 'check' && clean) this.firstTry += 1;
    const stepDone =
      step === 'try' ? this.run >= LESSON_RULES.tryRun : this.itemIndex + 1 >= this.items.length;
    if (stepDone) {
      if (step === 'check') this.result = medalOf(this.lesson.check.count - this.firstTry);
      this.enter(this.stepIndex + 1);
    } else {
      this.itemIndex += 1;
      if (step === 'try' && this.itemIndex >= this.items.length) this.moreTryItems();
      this.played = 0;
      this.wrongOnItem = 0;
    }
    return stepDone;
  }

  private enter(index: number): void {
    this.stepIndex = index;
    this.itemIndex = 0;
    this.played = 0;
    this.wrongOnItem = 0;
    this.finishedInStep = 0;
    const { lesson } = this;
    const step = this.step();
    if (step === 'copy') this.items = [{ shown: lesson.show.notes, answer: lesson.show.notes }];
    else if (step === 'pitfall') this.items = [{ shown: lesson.pitfall.notes, answer: lesson.pitfall.notes }];
    else if (step === 'playAlong') this.items = [{ shown: lesson.playAlong.notes, answer: lesson.playAlong.notes }];
    else if (step === 'check') this.items = lessonItems(lesson.check.items, `${this.seed}#check`, lesson.check.count);
    else if (step === 'try') {
      this.items = [];
      this.moreTryItems();
    } else this.items = [];
  }

  /** Try goes on until the clean run: items come in batches, each from its own seed. */
  private moreTryItems(): void {
    this.tryRound += 1;
    const last = this.items.at(-1)?.shown[0] ?? null;
    this.items = lessonItems(this.lesson.try.items, `${this.seed}#try#${this.tryRound}`, LESSON_RULES.tryRun * 2, last);
    this.itemIndex = 0;
  }

  private marksOf(): readonly LessonMark[] {
    const step = this.step();
    if (step === 'copy') return this.lesson.show.marks;
    if (step === 'pitfall') return this.lesson.pitfall.marks;
    if (step === 'playAlong') return this.lesson.playAlong.marks;
    return [];
  }
}
