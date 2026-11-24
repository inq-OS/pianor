import type { Curriculum } from '../core/curriculum/curriculum';
import { pageOf } from '../core/layout/paging';
import { flowLine, REGISTER, registerRows, type RegisterLayout } from '../core/layout/register';
import { DEFAULT_PRESENCE_RULES } from '../core/island/presenceRules';
import { clipToWidth } from '../core/text/clip';
import { pieceTitle } from '../core/text/pieceTitle';
import { t, type StringKey } from '../core/text/strings';
import { dayString } from '../io/teacher/teacherDesk';
import { CHARACTERS, TUG_RULES, WANDERER_RULES } from './adventure/scenesData';
import { lineText } from './adventure/sceneScript';
import { guardTeacher } from './adminGuard';
import { contextOf } from './context';
import { startScene } from './scenes';
import { castChanged, changedMembers, castLines, castValues, stepChance, stepNeediness, toggleCastDay, toggleOn, toggleSend, withPiece, type CastFormRules, type CastKind, type CastLine } from './teacher/castForm';
import { WEEK_ORDER } from './teacher/testsForm';
import { drawnText, measure } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { inkDot, inkRing, RING_PAD } from './ui/pixel/paint/register';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';

/** Whose cast. */
export interface TeacherCastData {
  player: string;
}

/** One of the cast as the page lists it: a character of Keri or a wanderer the teacher can send. */
interface Member {
  readonly id: string;
  readonly kind: CastKind;
  readonly name: string;
}

/** A name at the head of the left page, a step or day button, and the room between two (an inked box each, d130). */
const NAME = { h: 11, gap: 8 } as const;
const STEP = { w: 26, gap: 3 } as const;
const DAY = { w: 16, gap: 2 } as const;
const width = (value: string): number => measure(drawnText(value));

const FORM_RULES: CastFormRules = { presence: DEFAULT_PRESENCE_RULES, wanderers: WANDERER_RULES, tugShares: TUG_RULES.levels.map((l) => l.share) };

/** Every character the teacher can set (never the teacher herself), then the wanderers. */
function members(): Member[] {
  const characters = [...CHARACTERS.values()].filter((c) => c.kind !== 'teacher')
    .map((c): Member => ({ id: c.id, kind: 'character', name: c.name.kind === 'generated' ? c.id : lineText(c.name.name) }));
  const wanderers = WANDERER_RULES.wanderers.map((w): Member => ({ id: w.id, kind: 'wanderer', name: lineText(w.name) }));
  return [...characters, ...wanderers];
}

/**
 * The teacher runs the cast for a player (ft_1_37): the characters and wanderers along the head of the left page, the
 * chosen one ringed; then a ruled line a setting, its value at the left page's edge and its buttons in inked boxes on the
 * right page (as `TeacherTestsScene`). Every press changes the page's draft and shows it; Save on the toolbar keeps the
 * whole draft in the player's curriculum and stays here (several of the cast are set in one visit, unlike the piece page,
 * which goes back on Save). A name whose settings are not saved yet has an ink dot after it; Back with anything not saved
 * says so first and leaves without saving on a second press (d286, d293). Pick lists the pieces down both pages, the
 * chosen one marked.
 * The rules are `teacher/castForm.ts` and `core/island/cast.ts`.
 */
export class TeacherCastScene extends PixelScene {
  /** An administrative screen, no gameplay: the toolbar, no band. */
  protected override keepsToolbar = true;
  protected override toolbarPlayer = false;
  protected override keyboardNavigation = true;
  private player = '';
  private chosen = '';
  /** The curriculum as saved, and the draft the presses change; null while read, or when it cannot be. */
  private saved: Curriculum | null = null;
  private draft: Curriculum | null = null;
  /** Picking a piece for the chosen one, at this page of the list; null when not. */
  private picking: number | null = null;
  private status = '';
  private saving = false;
  /** Back was pressed once with something not saved: a second press leaves without saving. */
  private leaving = false;

  constructor() {
    super('teacherCast');
  }

  init(data: TeacherCastData): void {
    this.player = data.player;
    this.chosen = members()[0]?.id ?? '';
    this.saved = null;
    this.draft = null;
    this.picking = null;
    this.status = '';
    this.saving = false;
    this.leaving = false;
  }

  override create(): void {
    super.create();
    guardTeacher(this);
    const player = this.player;
    void contextOf(this).profiles.curriculumOf(player).then((curriculum) => {
      if (!this.scene.isActive() || this.player !== player) return;
      if (curriculum === null) this.status = t('admin.failed');
      else { this.saved = curriculum; this.draft = curriculum; }
      this.redraw();
    });
  }

  protected override back(): void {
    if (this.picking !== null) { this.picking = null; this.redraw(); return; }
    if (this.unsaved() && !this.leaving) { this.leaving = true; this.redraw(); return; }
    startScene(this, 'teacher', { player: this.player });
  }

  /** Whether the draft holds anything not saved yet, by its contents. */
  private unsaved(): boolean {
    return this.saved !== null && this.draft !== null && castChanged(this.saved, this.draft);
  }

  /** The draft as the page shows it now, for the tests. */
  get cast(): Curriculum | null {
    return this.draft;
  }

  protected draw(): void {
    this.sky();
    const book = this.register();
    const draft = this.draft;
    if (draft === null) {
      if (this.status) this.label(book.left.x, book.top, this.status, C.redDark, { maxWidth: book.left.w });
      return;
    }
    const member = members().find((m) => m.id === this.chosen);
    if (!member) return;
    if (this.picking !== null) this.drawPicker(book, member, this.picking);
    else this.drawForm(book, draft, member);
  }

  /** The cast along the head of the left page, as many lines as they take, the chosen one ringed: the row under them. */
  private drawMembers(top: number, page: { x: number; w: number }): number {
    const all = members();
    const changed = this.saved && this.draft ? changedMembers(this.saved, this.draft) : [];
    const widths = all.map((m) => width(m.name));
    const flow = flowLine(widths, page.w, NAME.gap);
    all.forEach((m, i) => {
      const { x, line } = flow[i]!;
      const left = page.x + x, y = top + line * NAME.h;
      const chosen = m.id === this.chosen;
      if (chosen) this.fineImage(left * 2 - RING_PAD - 4, y * 2 - RING_PAD - 1, inkRing(widths[i]! * 2 + 8, (NAME.h - 2) * 2));
      this.button({
        x: left + widths[i]! / 2, y: y + 4, width: widths[i]! + 4, height: NAME.h - 1, look: 'ink', label: m.name, labelWidth: widths[i]! + 2,
        onClick: () => { this.chosen = m.id; this.redraw(); },
      }).setActive(chosen);
      // not saved yet: an ink dot after its name
      if (changed.includes(m.id)) this.fineImage((left + widths[i]! + 2) * 2, y * 2 + 3, inkDot(C.redDark, 7)).setName('castUnsaved');
    });
    const lines = flow.length === 0 ? 1 : flow[flow.length - 1]!.line + 1;
    return top + lines * NAME.h + 3;
  }

  private drawForm(book: RegisterLayout, draft: Curriculum, member: Member): void {
    const { pieces } = contextOf(this);
    const { left, right } = book;
    const first = this.drawMembers(this.registerTitle(left, book.top, t('teacher.cast')), left) + 2;
    const today = dayString(new Date());
    const values = castValues(draft, member.id, member.kind, today, FORM_RULES);
    const id = member.id;
    const change = (next: Curriculum) => { this.draft = next; this.status = ''; this.leaving = false; this.redraw(); };
    const title = (piece: string) => { const chart = pieces.find(piece)?.chart; return chart ? pieceTitle(chart) : piece; };
    const valueOf: Record<CastLine, string> = {
      on: t(values.on ? 'teacher.cast.yes' : 'teacher.cast.no'),
      days: values.days.length === 0 ? t('teacher.tests.none') : values.days.map((d) => t(`weekday.${d}` as StringKey)).join(' '),
      often: t('teacher.cast.percent', { n: values.often }),
      piece: values.piece !== undefined ? title(values.piece) : t(member.kind === 'character' ? 'teacher.cast.own' : 'teacher.cast.learned'),
      needy: t('teacher.cast.needs', { n: values.needy, shares: values.shares.join(' ') }),
      send: t(values.sent ? 'teacher.cast.sent' : 'teacher.cast.notSent'),
    };
    castLines(member.kind).forEach((line, row) => {
      const y = first + row * REGISTER.row;
      const value = valueOf[line];
      const room = left.w - 30;
      const shown = clipToWidth(value, room, width);
      this.label(left.x + left.w - width(shown), y, shown, C.ink);
      this.label(left.x, y, t(`teacher.cast.line.${line}`), C.umberDark, { maxWidth: left.w - width(shown) - 6 });
      const box = (i: number, label: string, onClick: () => void, w: number = STEP.w, disabled = false) => this.button({
        x: right.x + i * (w + STEP.gap) + w / 2, y: y + 3, width: w, height: REGISTER.row - 2, look: 'ink', inkBox: true, label, onClick, disabled,
      });
      if (line === 'on') box(0, t(values.on ? 'teacher.cast.off' : 'teacher.cast.on'), () => change(toggleOn(draft, id)), 40);
      if (line === 'days') {
        WEEK_ORDER.forEach((weekday, i) => {
          this.button({
            x: right.x + i * (DAY.w + DAY.gap) + DAY.w / 2, y: y + 3, width: DAY.w, height: REGISTER.row - 2, look: 'ink', inkBox: true,
            label: t(`weekday.${weekday}` as StringKey), onClick: () => change(toggleCastDay(draft, id, weekday)),
          }).setActive(values.days.includes(weekday));
        });
      }
      if (line === 'often') [-10, 10].forEach((by, i) => box(i, t('teacher.cast.percent', { n: by > 0 ? `+${by}` : by }), () => change(stepChance(draft, id, by, FORM_RULES.presence))));
      if (line === 'needy') [-1, 1].forEach((by, i) => box(i, by > 0 ? '+1' : '-1', () => change(stepNeediness(draft, id, by))));
      if (line === 'piece') {
        box(0, t('teacher.cast.pick'), () => { this.picking = 0; this.redraw(); }, 40);
        box(1, t(member.kind === 'character' ? 'teacher.cast.ownPiece' : 'teacher.cast.learnedPiece'), () => change(withPiece(draft, id, undefined)), 40);
      }
      // a wanderer switched off does not come: nothing to send until it is on again
      if (line === 'send') box(0, t(values.sent ? 'teacher.cast.recall' : 'teacher.cast.send'), () => change(toggleSend(draft, id, today)), 40, !values.on && !values.sent);
    });
    const last = this.ruleToFoot(book, first);
    if (this.status) this.label(left.x, last, this.status, C.redDark, { maxWidth: left.w });
    else if (this.leaving) this.label(left.x, last, t('teacher.cast.leave'), C.redDark, { maxWidth: book.left.w + book.right.w });
    else if (this.unsaved()) this.label(left.x, last, t('teacher.cast.unsaved'), C.umberDark, { maxWidth: left.w });
  }

  /** The pieces this build offers, down the left page and on down the right; a click gives the chosen one that piece. */
  private drawPicker(book: RegisterLayout, member: Member, page: number): void {
    const { pieces } = contextOf(this);
    const first = this.registerTitle(book.left, book.top, t('teacher.cast.pickFor', { name: member.name })) + 2;
    const all = pieces.list();
    const current = this.draft?.cast?.characters?.[member.id]?.piece;
    const fit = registerRows(first, book.bottom, REGISTER.row);
    const slice = pageOf(all.length, page, { singlePageMax: 2 * fit.single, perPage: 2 * fit.paged });
    const lines = slice.paged ? fit.paged : fit.single;
    all.slice(slice.first, slice.first + slice.count).forEach((piece, i) => {
      const side = i < lines ? book.left : book.right;
      const y = first + (i % lines) * REGISTER.row;
      this.button({
        x: side.x + side.w / 2, y: y + 4, width: side.w, height: REGISTER.row - 2, look: 'ink', align: 'left',
        label: clipToWidth(pieceTitle(piece.chart), side.w - 6, width), labelWidth: side.w - 6,
        onClick: () => { if (this.draft) this.draft = withPiece(this.draft, member.id, piece.chart.id); this.picking = null; this.leaving = false; this.redraw(); },
      }).setActive(piece.chart.id === current);
    });
    const rules = Array.from({ length: lines + 1 }, (_, i) => first + i * REGISTER.row - 2);
    this.ruling(book, rules, [], null, first - 2, first + lines * REGISTER.row - 2);
    if (slice.paged) this.pager(slice, (next) => { this.picking = next; this.redraw(); });
  }

  /** Save keeps the draft; nothing to save while it is as saved. */
  protected override toolbarItems(): ToolbarItem[] {
    if (this.draft === null || this.picking !== null) return [];
    const draft = this.draft;
    return [{ label: t('teacher.save'), disabled: !this.unsaved(), onClick: () => void this.save(draft) }];
  }

  /** Saves the player's curriculum (its own save document, d136); a failed save keeps the draft and says so. */
  private async save(next: Curriculum): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const player = this.player;
    const ok = await contextOf(this).profiles.saveCurriculum(player, next);
    this.saving = false;
    if (!this.scene.isActive() || this.player !== player) return;
    if (ok) { this.saved = next; this.leaving = false; }
    this.status = ok ? '' : t('admin.failed');
    this.redraw();
  }
}
