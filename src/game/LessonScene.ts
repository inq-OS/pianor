import { lessonChart } from '../core/lessons/chart';
import { LESSON_RULES, LessonRun, type LessonStep } from '../core/lessons/run';
import type { Lesson } from '../core/lessons/lesson';
import { layoutForSettings } from '../core/layout/staffSettings';
import { staffSpaceLimits } from '../core/layout/canvasSize';
import type { StaffLayout } from '../core/layout/staffTypes';
import { t, type StringKey } from '../core/text/strings';
import { LESSON_CATALOG, LESSONS } from './lessonContent';
import { startScene } from './scenes';
import { contextOf } from './context';
import { watchKeyBash } from './practice/bashDoor';
import { drawMedalClef } from './practice/prizeGlyphs';
import { C } from './ui/pixel/palette';
import { PixelText } from './ui/pixel/PixelObjects';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { ICONS } from './ui/pixel/iconArt';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { StaffView } from './ui/staff/StaffView';

export interface LessonData {
  /** The lesson's id (`content/lessons/<id>.json`). */
  id: string;
}

/** The step's line under the frame, and the step track at its right (art pixels from the main area's top). */
const LINE_Y = 6;
/** The staff starts under the line and the marks' labels, and fills the rest of the main area. */
const STAFF_TOP = 30;
/** Kiur's show: one note this long (ms of wall time), after a short breath before the first. */
const SHOW_NOTE_MS = 700;
const SHOW_START_MS = 600;
/** MIDI velocity of Kiur's notes, a comfortable mezzo-forte. */
const VELOCITY = 90;
/** A wrong key flashes the awaited note (or the "?") this long (ms of wall time). */
const WRONG_FLASH_MS = 700;
/** The "?" breathes while it waits for the answer: one breath this long (ms of wall time). */
const PULSE_MS = 600;
/** The steps the track at the top counts, in order (Show is step 1). */
const TRACK: readonly LessonStep[] = ['show', 'copy', 'pitfall', 'try', 'playAlong', 'check'];
/** Colours with one meaning in every lesson (rule 4): a half step's mark, a whole step's mark. */
const MARK_INK = { half: 0xc0392b, whole: 0x2e6fb0 } as const;
const QUESTION_FILL = 0xe3ecf7;
const WRONG_FILL = 0xf4c7c3;
const WRONG_RUN_FILL = 0xc0392b;
const RUN_FILL = 0x2f7d32;
const INK = 0x1a1a2a;
/** Over the desk and the staff, as the frame's layer over the staff. */
const OVER_DEPTH = 20;

/**
 * One theory lesson (ft_1_39 rules 3 to 6): its six steps on one screen. Kiur plays the show while the keys light and the
 * staff's cursor follows; the student copies it with the keys lit, plays the pitfall, tries new items while the light fades,
 * plays the tune, and answers the check from the staff with no light. Marks name what lies between two notes (a half or
 * a whole step) above the staff. A wrong key with the pitfall's reason brings the pitfall card back. Every right note's
 * theory XP is saved at once. The rules are `core/lessons/run.ts`; this scene plays, lights and draws them.
 */
export class LessonScene extends PixelScene {
  protected override keyboardNavigation = false;

  private lesson!: Lesson;
  private run!: LessonRun;
  private staff: StaffView | null = null;
  private unsubscribe: (() => void) | null = null;
  /** The note Kiur is playing in the show, by index on the staff; null when he is not. */
  private showing: number | null = null;
  private showTimers: Phaser.Time.TimerEvent[] = [];
  /** A wrong key: flash until this time (wall ms). */
  private wrongUntil = 0;
  /** The pitfall card shows until this time (wall ms). */
  private cardUntil = 0;
  /** The clean run a wrong key just emptied: its boxes flash red while the wrong key flashes. */
  private lostRun = 0;
  private pulse: Phaser.Tweens.Tween | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super('lesson');
  }

  init(data: LessonData): void {
    const lesson = LESSONS.find((l) => l.id === data.id) ?? LESSONS[0]!;
    this.lesson = lesson;
    this.run = new LessonRun(lesson, `${lesson.id}-${Date.now()}`);
    this.showing = null;
    this.wrongUntil = 0;
    this.cardUntil = 0;
  }

  override create(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.events.once('shutdown', () => this.stop());
    watchKeyBash(this, contextOf(this).keyboard, () => this.leave());
    this.unsubscribe = contextOf(this).keyboard.onNote((event) => {
      if (!this.scene.isActive()) return;
      // a key while Kiur plays ends his show: the student is ready to copy (the ergonomics review)
      if (this.showing !== null) {
        if (event.kind === 'on' && event.velocity > 0) this.endShow();
        return;
      }
      const runBefore = this.run.cleanRun();
      const result = this.run.press(event);
      if (result.verdict === 'ignored') return;
      // the pitfall card stays until the next key (the ergonomics review)
      if (!(result.verdict === 'wrong' && result.pitfall)) this.cardUntil = 0;
      if (result.verdict === 'right') {
        void contextOf(this).profiles.addTrainerXp(LESSON_RULES.xpPerNote);
      } else {
        this.wrongUntil = performance.now() + WRONG_FLASH_MS;
        this.lostRun = runBefore;
        this.later(WRONG_FLASH_MS, () => this.redraw());
        if (result.pitfall) this.cardUntil = Number.POSITIVE_INFINITY;
      }
      this.redraw();
    });
    super.create();
    this.playShow();
  }

  protected override back(): void {
    this.leave();
  }

  protected override clear(): void {
    this.pulse?.remove();
    this.pulse = null;
    this.staff?.destroy();
    this.staff = null;
  }

  protected draw(): void {
    const { width, scale } = this.px;
    const { profiles, lights } = contextOf(this);
    this.sky();
    const step = this.run.step();
    this.label(0, LINE_Y, t(this.lineKey(step), this.lineParams()), C.white).centerAt(width / 2);
    this.drawTrack(step);
    lights.setLitKeys(this.showing === null ? this.run.lit() : this.showNotes().slice(this.showing, this.showing + 1));

    if (step === 'done') {
      this.drawDone();
      return;
    }
    const asked = step === 'try' || step === 'check';
    const now = step === 'show' ? { shown: this.showNotes(), answer: this.showNotes(), played: 0, marks: this.lesson.show.marks } : this.run.current();
    if (!now) return;
    const chart = lessonChart(now, asked);
    const top = this.mainTop + STAFF_TOP * scale;
    const height = Math.max(1, (this.mainRows - STAFF_TOP - 4) * scale);
    const options = { viewport: { width: this.scale.width, height }, ...staffSpaceLimits(this.scale.zoom), staffGap: profiles.staffGap, noteNaming: profiles.noteNaming };
    const layout = layoutForSettings(chart, options, profiles.staffSettings);
    this.staff = new StaffView(this, layout, undefined, { noteNames: false, fingers: false }, { x: 0, y: top }, []);
    const wrong = performance.now() < this.wrongUntil;
    if (asked) {
      chart.notes.forEach((_, i) => this.staff!.setNoteState(i, i === 0 ? 'pending' : 'correct'));
      this.drawQuestion(layout, top, step === 'try', wrong);
    } else {
      const at = this.showing ?? now.played;
      for (let i = 0; i < chart.notes.length; i++) this.staff.setNoteState(i, step !== 'show' && i < now.played ? 'correct' : 'pending');
      this.staff.setCursor(at < chart.notes.length ? [at] : null);
      if (wrong) this.staff.flashWrong([at]);
      this.drawMarks(layout, top, now.marks);
    }
    if (performance.now() < this.cardUntil) this.drawPitfallCard();
  }

  /** The numbered steps at the top right: done steps in green, the current one in gold, the rest dim. */
  private drawTrack(step: LessonStep): void {
    const current = TRACK.indexOf(step);
    // left of the gear in the top right corner
    const right = this.px.width - 24;
    TRACK.forEach((_, i) => {
      const x = right - (TRACK.length - i) * 9;
      const colour = step === 'done' || i < current ? C.green : i === current ? C.gold : C.dim;
      this.label(x, LINE_Y, String(i + 1), colour);
    });
  }

  /** The marks above the staff: a bracket over the two notes and its name over it, in the mark's colour (on the layer over the staff). */
  private drawMarks(layout: StaffLayout, top: number, marks: readonly { from: number; to: number; kind: 'half' | 'whole' }[]): void {
    if (marks.length === 0) return;
    const layer = this.overStaff();
    const k = 1 / this.px.scale;
    const S = layout.staffSpace * k;
    const g = this.add.graphics();
    layer.add(g);
    const topLine = (Math.min(...layout.staffLines.map((l) => l.y)) + top - this.mainTop) * k;
    // a label that would touch the one before it goes a line higher, its bracket with it
    let previous: { right: number; lift: number } | null = null;
    for (const mark of marks) {
      const a = layout.notes.find((n) => n.index === mark.from), b = layout.notes.find((n) => n.index === mark.to);
      if (!a || !b) continue;
      const tip = (n: typeof a) => Math.min(n.y, n.stem?.up ? n.stem.y2 : n.y);
      const highest = (Math.min(tip(a), tip(b)) + top - this.mainTop) * k;
      const x1 = Math.round(a.x * k - S * 0.5), x2 = Math.round(b.x * k + S * 0.5);
      const label = new PixelText(this, 0, 0, t(mark.kind === 'half' ? 'lessons.mark.half' : 'lessons.mark.whole'), { color: mark.kind === 'half' ? C.red : C.blue, shadow: C.groove });
      const labelX = Math.round((x1 + x2) / 2 - label.width / 2);
      const lift: number = previous && labelX < previous.right + 8 && previous.lift === 0 ? label.height + 3 : 0;
      previous = { right: labelX + label.width, lift };
      const y = Math.round(Math.min(topLine, highest) - 1.2 * S) - lift;
      g.fillStyle(MARK_INK[mark.kind], 1);
      g.fillRect(x1, y, x2 - x1 + 1, 1);
      const leg = Math.max(2, Math.round(S * 0.6)) + lift;
      g.fillRect(x1, y, 1, leg);
      g.fillRect(x2, y, 1, leg);
      label.setPosition(labelX, y - label.height - 2);
      layer.add(label);
    }
  }

  /** The "?" where the answer goes, after the notes on the staff; in Try the clean run under it, a box a clean item. */
  private drawQuestion(layout: StaffLayout, top: number, withRun: boolean, wrong: boolean): void {
    const last = layout.notes.at(-1);
    if (!last) return;
    const layer = this.overStaff();
    const k = 1 / this.px.scale;
    const S = layout.staffSpace * k;
    const lines = layout.staffLines.map((l) => (l.y + top - this.mainTop) * k);
    const y1 = Math.round(Math.min(...lines) - S), y2 = Math.round(Math.max(...lines) + S);
    const x = Math.round(last.x * k + 3 * S), w = Math.round(2.4 * S);
    const g = this.add.graphics();
    layer.add(g);
    g.fillStyle(wrong ? WRONG_FILL : QUESTION_FILL, 1);
    g.fillRect(x, y1, w, y2 - y1);
    const mark = new PixelText(this, 0, 0, '?', { color: wrong ? C.red : C.blue });
    mark.setScale(2);
    mark.setPosition(Math.round(x + w / 2 - mark.width), Math.round((y1 + y2) / 2 - mark.height));
    layer.add(mark);
    // the box breathes while it waits, and stands still red after a wrong key
    if (!wrong) this.pulse = this.tweens.add({ targets: [g, mark], alpha: 0.45, duration: PULSE_MS, yoyo: true, repeat: -1 });
    if (!withRun) return;
    // the clean run: a wrong key empties it at once (the ergonomics review)
    const box = Math.max(5, Math.round(S * 1.4)), gap = Math.max(2, Math.round(S * 0.5));
    const total = LESSON_RULES.tryRun * box + (LESSON_RULES.tryRun - 1) * gap;
    for (let i = 0; i < LESSON_RULES.tryRun; i++) {
      const bx = Math.round(x + w / 2 - total / 2 + i * (box + gap)), by = y2 + Math.round(S);
      g.fillStyle(INK, 1).fillRect(bx, by, box, box);
      const fill = i < this.run.cleanRun() ? RUN_FILL : wrong && i < this.lostRun ? WRONG_RUN_FILL : QUESTION_FILL;
      g.fillStyle(fill, 1).fillRect(bx + 1, by + 1, box - 2, box - 2);
    }
  }

  /** The pitfall card over the staff: its line on a parchment card. */
  private drawPitfallCard(): void {
    const { width } = this.px;
    const w = Math.min(width - 16, 160), h = 22;
    const rect = { x: Math.floor((width - w) / 2), y: STAFF_TOP - 6, w, h };
    const layer = this.overStaff();
    const card = this.parchmentCard(rect, 3);
    layer.add(card);
    const line = new PixelText(this, 0, 0, t(this.lesson.pitfall.line as StringKey), { color: C.redDark, maxWidth: w - 12 });
    line.setPosition(Math.round(width / 2 - line.width / 2), rect.y + Math.round((h - line.height) / 2));
    layer.add(line);
  }

  /** The check's result: its medal as a clef in gold, silver or bronze, and the first-try count in the line above. */
  private drawDone(): void {
    const medal = this.run.medal();
    const S = (this.mainRows * this.px.scale) / 14;
    // over the desk, removed when the screen is drawn again
    this.own(drawMedalClef(this, medal, { x: this.scale.width / 2, y: this.mainTop + (this.mainRows / 2) * this.px.scale }, S).setDepth(OVER_DEPTH));
  }

  private lineKey(step: LessonStep): StringKey {
    const { lesson } = this;
    const own: Record<LessonStep, string> = {
      show: lesson.show.line, copy: 'lessons.line.copy', pitfall: lesson.pitfall.line, try: lesson.try.line,
      playAlong: 'lessons.line.playAlong', check: lesson.check.line, done: 'lessons.line.done',
    };
    return own[step] as StringKey;
  }

  private lineParams(): Record<string, number> {
    const { firstTry, of } = this.run.checkScore();
    return { right: firstTry, of };
  }

  private showNotes(): number[] {
    return this.lesson.show.notes;
  }

  /** Kiur plays the show: each note sounds, lights its key and takes the staff's cursor; then the student copies it. */
  private playShow(): void {
    const { piano } = contextOf(this).audio;
    this.stopShow();
    const notes = this.showNotes();
    notes.forEach((midi, i) => {
      this.showTimers.push(
        this.time.delayedCall(SHOW_START_MS + i * SHOW_NOTE_MS, () => {
          this.showing = i;
          piano.noteOn(midi, VELOCITY);
          this.redraw();
        }),
        this.time.delayedCall(SHOW_START_MS + (i + 1) * SHOW_NOTE_MS - 50, () => piano.noteOff(midi)),
      );
    });
    this.showTimers.push(this.time.delayedCall(SHOW_START_MS + notes.length * SHOW_NOTE_MS, () => this.endShow()));
  }

  /** Kiur's show is over (played through, or cut short by a key): the student copies it. */
  private endShow(): void {
    this.stopShow();
    const { piano } = contextOf(this).audio;
    for (const midi of this.showNotes()) piano.noteOff(midi);
    this.showing = null;
    this.run.showDone();
    this.redraw();
  }

  /** The ear: Kiur plays the notes on the staff again (in the show, the show from its start). */
  private listenAgain(): void {
    if (this.run.step() === 'show') {
      this.playShow();
      return;
    }
    const now = this.run.current();
    if (!now) return;
    const { piano } = contextOf(this).audio;
    const notes = this.run.step() === 'try' || this.run.step() === 'check' ? now.shown : now.answer;
    notes.forEach((midi, i) => {
      this.later(i * SHOW_NOTE_MS, () => piano.noteOn(midi, VELOCITY));
      this.later((i + 1) * SHOW_NOTE_MS - 50, () => piano.noteOff(midi));
    });
  }

  protected override toolbarItems(): ToolbarItem[] {
    const items: ToolbarItem[] = [{ label: t('ear.playAgain'), icon: ICONS.ear, iconOnly: true, tooltip: t('ear.playAgain'), onClick: () => this.listenAgain() }];
    if (this.run.step() === 'done') {
      items.push(
        { label: t('room.lessons'), icon: TOOL_ICONS.bookOpen, iconOnly: true, tooltip: t('room.lessons'), onClick: () => this.leave() },
        { label: t('theory.again'), icon: TOOL_ICONS.repeat, iconOnly: true, tooltip: t('theory.again'), main: true, onClick: () => this.again() },
      );
    }
    return items;
  }

  protected override bandActions(): ToolbarItem[] {
    return this.toolbarItems();
  }

  private again(): void {
    this.init({ id: this.lesson.id });
    this.redraw();
    this.playShow();
  }

  private later(ms: number, then: () => void): void {
    this.timers.push(this.time.delayedCall(ms, then));
  }

  private stopShow(): void {
    for (const timer of this.showTimers) timer.remove();
    this.showTimers = [];
  }

  private stop(): void {
    this.stopShow();
    for (const timer of this.timers) timer.remove();
    this.timers = [];
    this.unsubscribe?.();
    this.unsubscribe = null;
    contextOf(this).lights.setLitKeys([]);
  }

  private leave(): void {
    const area = LESSON_CATALOG.areas.findIndex((a) => a.topics.some((topic) => topic.id === this.lesson.topic));
    startScene(this, 'lessonBook', { area: Math.max(0, area) });
  }
}
