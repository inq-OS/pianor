import type { Curriculum, CurriculumPiece } from '../core/curriculum/curriculum';
import { pageOf } from '../core/layout/paging';
import { REGISTER, registerRows, type RegisterLayout } from '../core/layout/register';
import { clipToWidth } from '../core/text/clip';
import { pieceTitle } from '../core/text/pieceTitle';
import { t } from '../core/text/strings';
import { dayString } from '../io/teacher/teacherDesk';
import { guardTeacher } from './adminGuard';
import { contextOf } from './context';
import { startScene } from './scenes';
import { FIELDS, MAIN_FIELDS, STEPS, fieldValues, newCurriculumPiece, stepField, withPiece, withoutPiece, type Field } from './teacher/curriculumForm';
import { drawnText, measure } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';

/** Whose curriculum, and which piece: none to pick one first (Add), or one on it to set it again. */
export interface TeacherPieceData {
  player: string;
  piece?: string;
  page?: number;
}

/** A step button's width and the room between two (an inked box each, d130). */
const STEP = { w: 22, gap: 4 } as const;

/**
 * Setting one curriculum piece (ft_1_26.AC3, WP-14): with no piece, the pieces not yet on the player's curriculum to pick
 * from; then its deadline and priority 1 to 10, and under More the base expectation and the numbers X, Y, Z and B (d139
 * point 4). Save puts it on the curriculum, Remove takes it off, Back leaves it as it was. The rules are in
 * `teacher/curriculumForm`; no calendar here (WP-18).
 *
 * Written in her register (WP-14, d145): the pieces to pick from down the left page and on down the right; a piece's
 * name at the head of the left page, its fields on ruled lines under it, and their steps in inked boxes on the right page.
 */
export class TeacherPieceScene extends PixelScene {
  /** An administrative screen, no gameplay: the toolbar, no band. */
  protected override keepsToolbar = true;
  /** No player here (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  protected override keyboardNavigation = true;
  private start: TeacherPieceData = { player: '' };
  /** The player's curriculum as saved; null while it is read, or when it cannot be. */
  private curriculum: Curriculum | null = null;
  /** The piece as she is setting it; null while she picks a piece. */
  private draft: CurriculumPiece | null = null;
  private more = false;
  /** Why the last save failed, or empty. */
  private status = '';
  private saving = false;

  constructor() {
    super('teacherPiece');
  }

  init(data: TeacherPieceData): void {
    this.start = data;
    this.more = false;
    this.curriculum = null;
    this.draft = null;
    this.status = '';
    this.saving = false;
  }

  override create(): void {
    super.create();
    guardTeacher(this);
    const { player, piece } = this.start;
    void contextOf(this).profiles.curriculumOf(player).then((curriculum) => {
      if (!this.scene.isActive()) return;
      if (curriculum === null) this.status = t('admin.failed');
      else {
        this.curriculum = curriculum;
        if (piece !== undefined) this.draft = curriculum.pieces.find((p) => p.piece === piece) ?? newCurriculumPiece(piece, dayString(new Date()));
      }
      this.redraw();
    });
  }

  protected override back(): void {
    startScene(this, 'teacher', { player: this.start.player });
  }

  protected draw(): void {
    this.sky();
    const book = this.register();
    if (this.status && (this.draft === null || this.curriculum === null)) this.label(book.left.x, book.bottom - REGISTER.row, this.status, C.redDark, { maxWidth: book.left.w });
    const curriculum = this.curriculum;
    if (curriculum === null) return;
    if (this.draft === null) this.drawPicker(book, curriculum);
    else this.drawForm(book, curriculum, this.draft);
  }

  /** The pieces this build offers that are not on the player's curriculum yet, down the left page and on down the right; a click sets the chosen one. */
  private drawPicker(book: RegisterLayout, curriculum: Curriculum): void {
    const { pieces } = contextOf(this);
    const first = this.registerTitle(book.left, book.top, t('teacher.pick')) + 2;
    const taken = new Set(curriculum.pieces.map((p) => p.piece));
    const free = pieces.list().filter((p) => !taken.has(p.chart.id));
    const fit = registerRows(first, book.bottom, REGISTER.row);
    // the right page has the heading's room too, so both pages hold the same number of lines
    const slice = pageOf(free.length, this.start.page ?? 0, { singlePageMax: 2 * fit.single, perPage: 2 * fit.paged });
    const lines = slice.paged ? fit.paged : fit.single;
    const width = (value: string) => measure(drawnText(value));
    free.slice(slice.first, slice.first + slice.count).forEach((piece, i) => {
      const page = i < lines ? book.left : book.right;
      const y = first + (i % lines) * REGISTER.row;
      this.button({
        x: page.x + page.w / 2, y: y + 4, width: page.w, height: REGISTER.row - 2, look: 'ink', align: 'left',
        label: clipToWidth(pieceTitle(piece.chart), page.w - 6, width), labelWidth: page.w - 6,
        onClick: () => startScene(this, 'teacherPiece', { player: this.start.player, piece: piece.chart.id }),
      });
    });
    const rules = Array.from({ length: lines + 1 }, (_, i) => first + i * REGISTER.row - 2);
    this.ruling(book, rules, [], null, first - 2, first + lines * REGISTER.row - 2);
    if (slice.paged) this.pager(slice, (page) => startScene(this, 'teacherPiece', { player: this.start.player, page }));
  }

  /** The piece's name at the head of the left page, then a ruled line per field, its value at the page's edge and its steps on the right page; the pages ruled on to their foot. */
  private drawForm(book: RegisterLayout, curriculum: Curriculum, draft: CurriculumPiece): void {
    const { pieces } = contextOf(this);
    const { left, right } = book;
    const chart = pieces.find(draft.piece)?.chart;
    const first = this.registerTitle(left, book.top, chart ? pieceTitle(chart) : draft.piece) + 4;
    const values = fieldValues(draft, curriculum);
    const today = dayString(new Date());
    const fields = this.more ? FIELDS : MAIN_FIELDS;
    const width = (value: string) => measure(drawnText(value));
    fields.forEach((field, i) => {
      const y = first + i * REGISTER.row;
      const value = field === 'deadline' ? draft.deadline : String(values[field]);
      this.label(left.x + left.w - width(value), y, value, C.ink);
      this.label(left.x, y, t(`teacher.field.${field}`), C.umberDark, { maxWidth: left.w - width(value) - 6 });
      const [small, big] = STEPS[field];
      const steps = small === big ? [-small, small] : [-big, -small, small, big];
      steps.forEach((by, j) => {
        this.button({
          x: right.x + j * (STEP.w + STEP.gap) + STEP.w / 2, y: y + 3, width: STEP.w, height: REGISTER.row - 2, look: 'ink', inkBox: true,
          label: by > 0 ? `+${by}` : String(by), onClick: () => this.step(field, by, today),
        });
      });
    });
    // every line of both pages ruled to the foot (the art review); what went wrong on the last of them
    const last = this.ruleToFoot(book, first);
    if (this.status) this.label(left.x, last, this.status, C.redDark, { maxWidth: left.w });
  }

  private step(field: Field, by: number, today: string): void {
    if (this.draft === null || this.curriculum === null) return;
    this.draft = stepField(this.draft, field, by, today, this.curriculum);
    this.redraw();
  }

  /** Save and More (or Less) while setting a piece, and Remove for one already on the curriculum. */
  protected override toolbarItems(): ToolbarItem[] {
    const { draft, curriculum } = this;
    if (draft === null || curriculum === null) return [];
    const on = curriculum.pieces.some((p) => p.piece === draft.piece);
    return [
      { label: t('teacher.save'), onClick: () => void this.save(withPiece(curriculum, draft)) },
      { label: t(this.more ? 'teacher.less' : 'teacher.more'), onClick: () => { this.more = !this.more; this.redraw(); } },
      ...(on ? [{ label: t('teacher.remove'), onClick: () => void this.save(withoutPiece(curriculum, draft.piece)) }] : []),
    ];
  }

  /** Saves the player's curriculum (its own save document, d136) and goes back; a failed save stays here and says so. */
  private async save(next: Curriculum): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const ok = await contextOf(this).profiles.saveCurriculum(this.start.player, next);
    this.saving = false;
    if (ok) {
      this.back();
      return;
    }
    this.status = t('admin.failed');
    this.redraw();
  }
}
