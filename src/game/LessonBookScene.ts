import { areaNameKey, topicNameKey } from '../core/lessons/catalog';
import { suggestedLesson } from '../core/lessons/path';
import { lessonBookLayout } from '../core/layout/lessonBook';
import { rectCentre } from '../core/layout/rect';
import { t, type StringKey } from '../core/text/strings';
import { LESSON_CATALOG, LESSONS } from './lessonContent';
import { startScene } from './scenes';
import { watchKeyBash } from './practice/bashDoor';
import { contextOf } from './context';
import { createBitmap } from './ui/pixel/bitmap';
import { fitLine } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { PixelScene } from './ui/pixel/PixelScene';
import type { PixelText } from './ui/pixel/PixelObjects';

/** How long "not written yet" stays beside a placeholder that was pressed (ms of wall time). */
const NOT_YET_MS = 1500;

export interface LessonBookData {
  /** The area to open the book at (its index in the catalog); the suggested lesson's area when left out. */
  area?: number;
}

/**
 * The lesson book (ft_1_39 rule 1, d303), opened from the stand: every topic of the learning catalog, one area a spread. A topic with a written lesson opens it; the rest are ghosted placeholders that say "not written yet"
 * when pressed. The suggested next lesson (rule 13) is written in red ink with "Next" after it. Nothing is locked (rule 2).
 * Left and Right turn the spread, Enter opens the suggested lesson, Esc leaves; a tab per area at the foot.
 */
export class LessonBookScene extends PixelScene {
  /** The area the book is open at (its index in the catalog), one a spread. */
  private area = 0;
  /** The placeholder pressed last, saying "not written yet" for a moment. */
  private notYet: string | null = null;
  private notYetTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('lessonBook');
  }

  init(data: LessonBookData | undefined): void {
    const suggested = suggestedLesson(LESSONS, new Set());
    const area = data?.area ?? LESSON_CATALOG.areas.findIndex((a) => a.id === suggested?.topic[0]);
    this.area = Math.max(0, area);
    this.notYet = null;
  }

  override create(): void {
    this.onWindowKey((event) => this.key(event));
    watchKeyBash(this, contextOf(this).keyboard, () => this.leave());
    super.create();
  }

  protected override back(): void {
    this.leave();
  }

  protected draw(): void {
    this.sky();
    const areas = LESSON_CATALOG.areas;
    const area = areas[this.area]!;
    const layout = lessonBookLayout(this.px.width, this.mainRows, area.topics.length, areas.length);
    this.openBook(layout.register.book);
    this.inkWriting = true;
    const suggested = suggestedLesson(LESSONS, new Set());
    // the heading starts right of the door when the door sits in the book's corner
    const headingX = Math.max(layout.heading.x, this.titleX(layout.heading.x));
    this.label(headingX, layout.heading.y, fitLine([`${area.id} ${t(areaNameKey(area.id) as StringKey)}`, t(areaNameKey(area.id) as StringKey)], layout.heading.x + layout.heading.w - headingX), C.umberDark);
    area.topics.forEach((topic, k) => {
      const lesson = LESSONS.find((l) => l.topic === topic.id);
      const name = t(topicNameKey(topic.id) as StringKey);
      const row = layout.rows[k]!;
      // a written lesson in ink, the suggested one in red ink; a placeholder ghosted
      const colour = lesson === undefined ? C.umberLight : lesson === suggested ? C.gold : C.white;
      const text = this.label(row.x, row.y, fitLine([name], row.w), colour);
      const after = lesson === suggested ? t('lessons.next') : this.notYet === topic.id ? t('lessons.notYet') : null;
      const note: PixelText | null = after ? this.label(row.x + text.width + 4, row.y, after, lesson ? C.gold : C.umber) : null;
      const box = { x: row.x - 1, y: row.y - 1, w: Math.min(row.w, text.width + 2), h: text.height + 2 };
      const button = this.button({
        ...rectCentre(box), width: box.w, height: box.h, label: name, keepCase: true, picture: createBitmap(box.w, box.h),
        onClick: () => (lesson ? this.open(lesson.id) : this.sayNotYet(topic.id)),
      });
      button.attach(text, ...(note ? [note] : []));
    });
    // a tab per area at the foot; the open one in red ink
    areas.forEach((tabArea, i) => {
      const tab = layout.tabs[i]!;
      const letter = this.label(0, tab.y + 2, tabArea.id, i === this.area ? C.gold : C.white);
      letter.centerAt(tab.x + tab.w / 2);
      const button = this.button({
        ...rectCentre(tab), width: tab.w, height: tab.h, label: t(areaNameKey(tabArea.id) as StringKey), keepCase: true, picture: createBitmap(tab.w, tab.h),
        onClick: () => this.turnTo(i),
      });
      button.attach(letter);
    });
    // the page-turn arrows, for the mouse and the touch screen
    const last = areas.length - 1;
    for (const [rect, glyph, to, name] of [[layout.previous, '<', this.area - 1, 'lessons.previousPage'], [layout.next, '>', this.area + 1, 'lessons.nextPage']] as const) {
      if (to < 0 || to > last) continue;
      const arrow = this.label(0, rect.y + 2, glyph, C.white);
      arrow.centerAt(rect.x + rect.w / 2);
      this.button({ ...rectCentre(rect), width: rect.w, height: rect.h, label: t(name), keepCase: true, picture: createBitmap(rect.w, rect.h), onClick: () => this.turnTo(to) }).attach(arrow);
    }
    this.inkWriting = false;
  }

  private key(event: KeyboardEvent): void {
    const last = LESSON_CATALOG.areas.length - 1;
    if (event.key === 'ArrowLeft') this.turnTo(Math.max(0, this.area - 1));
    else if (event.key === 'ArrowRight') this.turnTo(Math.min(last, this.area + 1));
    else if (event.key === 'Enter') {
      const suggested = suggestedLesson(LESSONS, new Set());
      if (suggested) this.open(suggested.id);
    } else if (event.key === 'Escape') this.leave();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  private turnTo(area: number): void {
    if (area === this.area) return;
    this.area = area;
    this.notYet = null;
    this.redraw();
  }

  private sayNotYet(topic: string): void {
    this.notYet = topic;
    this.notYetTimer?.remove();
    this.notYetTimer = this.time.delayedCall(NOT_YET_MS, () => {
      this.notYet = null;
      this.redraw();
    });
    this.redraw();
  }

  private open(id: string): void {
    startScene(this, 'lesson', { id });
  }

  private leave(): void {
    startScene(this, 'profile');
  }
}
