import type { Curriculum } from '../core/curriculum/curriculum';
import { REGISTER } from '../core/layout/register';
import { testWeekdaysOf, timeOf } from '../core/island/teacher';
import { t, type StringKey } from '../core/text/strings';
import { guardTeacher } from './adminGuard';
import { contextOf } from './context';
import { startScene } from './scenes';
import { DEFAULT_DELAY, DELAY_STEPS, TIME_STEPS, WEEK_ORDER, orderIn, orderedTests, stepDelay, stepTestTime, toggleWeekday } from './teacher/testsForm';
import { drawnText, measure } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';

/** Whose tests. */
export interface TeacherTestsData {
  player: string;
}

/** A step or day button's width and the room between two (an inked box each, d130). */
const STEP = { w: 26, gap: 3 } as const;
const DAY = { w: 16, gap: 2 } as const;

/** A step of minutes as its button says it: hours when whole. */
function stepLabel(by: number): string {
  const sign = by > 0 ? '+' : '-';
  const n = Math.abs(by);
  return sign + (n % 60 === 0 ? t('teacher.tests.h', { n: n / 60 }) : t('teacher.tests.min', { n }));
}

/**
 * When the teacher comes to test (ft_1_26.AC9): the weekly test days (Sunday and Wednesday unless
 * she sets others), the time of day from which she comes on them and on a deadline, and a test she orders for hours and
 * minutes from now; under them the ordered tests still to come. Each press is saved at once in the player's curriculum.
 * The rules are `teacher/testsForm.ts` and `core/island/teacher.ts`.
 *
 * Written in her register (d145), as the piece form: a ruled line a setting, its value at the left page's edge and its
 * buttons in inked boxes on the right page.
 */
export class TeacherTestsScene extends PixelScene {
  /** An administrative screen, no gameplay: the toolbar, no band. */
  protected override keepsToolbar = true;
  protected override toolbarPlayer = false;
  protected override keyboardNavigation = true;
  private player = '';
  private curriculum: Curriculum | null = null;
  /** The order's delay in minutes; not saved until ordered. */
  private delay = DEFAULT_DELAY;
  private status = '';
  /** The saves under way, one after another. */
  private saving: Promise<void> = Promise.resolve();
  /** When the page opened, for the `now` switch's clock. */
  private openedAt = Date.now();

  constructor() {
    super('teacherTests');
  }

  init(data: TeacherTestsData): void {
    this.player = data.player;
    this.curriculum = null;
    this.delay = DEFAULT_DELAY;
    this.status = '';
    this.saving = Promise.resolve();
  }

  override create(): void {
    super.create();
    this.openedAt = Date.now();
    guardTeacher(this);
    const player = this.player;
    void contextOf(this).profiles.curriculumOf(player).then((curriculum) => {
      if (!this.scene.isActive() || this.player !== player) return;
      if (curriculum === null) this.status = t('admin.failed');
      else this.curriculum = curriculum;
      this.redraw();
    });
  }

  protected override back(): void {
    startScene(this, 'teacher', { player: this.player });
  }

  /** The curriculum as saved now, for the tests. */
  get tests(): Curriculum | null {
    return this.curriculum;
  }

  protected draw(): void {
    this.sky();
    const book = this.register();
    const { left, right } = book;
    const first = this.registerTitle(left, book.top, t('teacher.tests')) + 4;
    const curriculum = this.curriculum;
    if (curriculum === null) {
      if (this.status) this.label(left.x, first, this.status, C.redDark, { maxWidth: left.w });
      return;
    }
    const width = (value: string) => measure(drawnText(value));
    const line = (row: number, key: StringKey, value: string) => {
      const y = first + row * REGISTER.row;
      this.label(left.x + left.w - width(value), y, value, C.ink);
      this.label(left.x, y, t(key), C.umberDark, { maxWidth: left.w - width(value) - 6 });
      return y;
    };
    // the test days: their short names, Monday first, and a box a weekday, ringed while it is one
    const days = testWeekdaysOf(curriculum);
    const shown = WEEK_ORDER.filter((d) => days.includes(d)).map((d) => t(`weekday.${d}` as StringKey));
    const daysY = line(0, 'teacher.tests.days', shown.length === 0 ? t('teacher.tests.none') : shown.join(' '));
    WEEK_ORDER.forEach((weekday, i) => {
      this.button({
        x: right.x + i * (DAY.w + DAY.gap) + DAY.w / 2, y: daysY + 3, width: DAY.w, height: REGISTER.row - 2, look: 'ink', inkBox: true,
        label: t(`weekday.${weekday}` as StringKey), onClick: () => void this.save(toggleWeekday(curriculum, weekday)),
      }).setActive(days.includes(weekday));
    });
    // the time of day she comes from
    const timeY = line(1, 'teacher.tests.time', curriculum.testTime ?? timeOf(0));
    this.steps(right.x, timeY, TIME_STEPS, (by) => void this.save(stepTestTime(curriculum, by)));
    // a test ordered for hours and minutes from now (Order on the toolbar)
    const inY = line(2, 'teacher.tests.in', t('teacher.tests.hm', { h: Math.floor(this.delay / 60), m: this.delay % 60 }));
    this.steps(right.x, inY, DELAY_STEPS, (by) => { this.delay = stepDelay(this.delay, by); this.redraw(); });
    // the ordered tests to come
    const ordered = orderedTests(curriculum, this.now());
    let y = first + 4 * REGISTER.row;
    if (ordered.length > 0) {
      this.label(left.x, y, t('teacher.tests.ordered'), C.umberDark);
      for (const o of ordered.slice(0, 4)) {
        y += REGISTER.row;
        this.label(left.x + 4, y, t('teacher.tests.at', { day: Number(o.day.slice(8)), month: Number(o.day.slice(5, 7)), time: o.time }), C.ink);
      }
    }
    const last = this.ruleToFoot(book, first);
    if (this.status) this.label(left.x, last, this.status, C.redDark, { maxWidth: left.w });
  }

  private steps(x: number, y: number, steps: readonly number[], press: (by: number) => void): void {
    steps.forEach((by, j) => {
      this.button({
        x: x + j * (STEP.w + STEP.gap) + STEP.w / 2, y: y + 3, width: STEP.w, height: REGISTER.row - 2, look: 'ink', inkBox: true,
        label: stepLabel(by), onClick: () => press(by),
      });
    });
  }

  /** Order: a test for the delay from now, saved at once. */
  protected override toolbarItems(): ToolbarItem[] {
    const curriculum = this.curriculum;
    return [{ label: t('teacher.tests.order'), disabled: curriculum === null, onClick: () => { if (curriculum) void this.save(orderIn(curriculum, this.now(), this.delay)); } }];
  }

  /** Now, on the clock the room keeps (the `now` switch, then running on): the order and the list to come use it too. */
  private now(): Date {
    const set = contextOf(this).flags.sky.now;
    return set === null || set === undefined ? new Date() : new Date(set + Date.now() - this.openedAt);
  }

  /**
   * Saves the player's curriculum (its own save document, d136); a failed save says so. The curriculum is taken as shown at
   * once, so a press while a save is under way builds on it and is saved after it, never lost.
   */
  private save(next: Curriculum): Promise<void> {
    const before = this.curriculum;
    const player = this.player;
    this.curriculum = next;
    this.redraw();
    this.saving = this.saving.then(async () => {
      const ok = await contextOf(this).profiles.saveCurriculum(player, next);
      if (!this.scene.isActive() || this.player !== player) return;
      if (!ok && this.curriculum === next) this.curriculum = before;
      this.status = ok ? '' : t('admin.failed');
      this.redraw();
    });
    return this.saving;
  }
}
