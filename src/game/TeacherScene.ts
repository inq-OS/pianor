import { pageOf } from '../core/layout/paging';
import { flowLine, placeColumns, REGISTER, registerRows, type RegisterLayout } from '../core/layout/register';
import type { Medal, PieceStatus, StatusColour } from '../core/curriculum/play';
import { clipToWidth } from '../core/text/clip';
import type { Curriculum, CurriculumPiece } from '../core/curriculum/curriculum';
import { pieceTitle } from '../core/text/pieceTitle';
import { t } from '../core/text/strings';
import { EMPTY_PRACTICE_LOG } from '../core/progression';
import { dayString } from '../io/teacher/teacherDesk';
import { teacherStatuses } from './teacher/teacherStatuses';
import { guardTeacher } from './adminGuard';
import { contextOf } from './context';
import { startScene } from './scenes';
import { drawnText, measure } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { inkDot, inkRing, RING_PAD } from './ui/pixel/paint/register';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { LOCK } from './ui/pixel/sprites';

/** Which player the teacher is looking at, and the page of their list. */
export interface TeacherData {
  player?: string;
  page?: number;
}

/** A player's name in the row of names at the head of the left page: its height, and the room between two names. */
const NAME = { h: 11, gap: 8 } as const;
/** The room between the names and the table's headings. */
const UNDER_NAMES = 3;
/** The dot of a piece's status at the line's start, the room it takes, and its medal's dot, in fine pixels and cells. */
const DOT = { fine: 11, cells: 8 } as const;
const MEDAL = { fine: 9, cells: 7 } as const;
/** The room between two columns of marks, and between a column's words and the rule before it. */
const COLUMN = { gap: 8, rule: 4 } as const;
/** Bare paper between a piece's name and the rule before its date. */
const NAME_ROOM = 9;
/** How far in from its box a line written as an ink button starts (`PixelButton`, left aligned): the box starts that much before the name. */
const INK_INDENT = 6;
/** The columns on the right page, after the piece and its date on the left (ft_1_26.AC2): a class register's marks. */
const MARKS = ['priority', 'level', 'expected', 'predicted', 'delta'] as const;
type Column = 'piece' | 'deadline' | (typeof MARKS)[number];
/** A medal's dot after the piece's name (d139). */
const MEDAL_COLOUR: Readonly<Record<Medal, number>> = { bronze: C.orange, silver: C.cream, gold: C.gold };

/** The colour of a status's dot (d139): purple under 3 plays, green by how near the target, strong green when retained. */
const SWATCH_COLOUR: Readonly<Record<StatusColour, number>> = { purple: C.purple, green: C.leafLight, strongGreen: C.green };

/** A number of a status, or a dash when there is none yet. */
const shown = (value: number | null): string => (value === null ? '-' : String(Math.round(value)));
const width = (value: string): number => measure(drawnText(value));

/**
 * The teacher's screen behind the academic hat (ft_1_26, WP-14): the players down the left, and the chosen player's
 * curriculum pieces, most urgent first, each with its colour, deadline, priority, level, expected level, predicted level at
 * the deadline and delta (ft_1_26.AC2), measured from the player's practice log by WP-04's queries (`teacherStatuses`). A
 * piece's name opens it for setting; Add puts a new one on (ft_1_26.AC3). An adult's page, so a list with words (as the
 * admin page). Stays open 30 minutes after her password, or until the lock.
 *
 * Written in her register (WP-14, d145): the players along the head of the left page,
 * the chosen one ringed in red ink; then a ruled line a piece, its status's dot, its name and its date on the left page and
 * its marks on the right, as a class register is kept.
 */
export class TeacherScene extends PixelScene {
  /** An administrative screen, no gameplay: the toolbar, no band. */
  protected override keepsToolbar = true;
  /** No player here (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  protected override keyboardNavigation = true;
  private player = '';
  private page = 0;
  /** The chosen player's curriculum and its statuses, most urgent first; null while they are read (or when they cannot be). */
  private curriculum: Curriculum | null = null;
  private statuses: PieceStatus[] | null = null;
  private failed = false;

  constructor() {
    super('teacher');
  }

  init(data?: TeacherData): void {
    this.player = data?.player ?? '';
    this.page = data?.page ?? 0;
    this.curriculum = null;
    this.statuses = null;
    this.failed = false;
  }

  override create(): void {
    const { profiles, pieces } = contextOf(this);
    if (!profiles.profiles.some((p) => p.id === this.player)) this.player = profiles.profile.id;
    super.create();
    guardTeacher(this);
    const player = this.player;
    void Promise.all([profiles.curriculumOf(player), profiles.practiceLogOf(player).catch(() => null)]).then(([curriculum, log]) => {
      if (!this.scene.isActive() || this.player !== player) return;
      if (curriculum === null) this.failed = true;
      else {
        const today = dayString(new Date());
        this.curriculum = curriculum;
        this.statuses = teacherStatuses(curriculum, log ?? EMPTY_PRACTICE_LOG, (id) => pieces.find(id)?.chart.bars.length, today, (iso) => dayString(new Date(iso)));
      }
      this.redraw();
    });
  }

  protected override back(): void {
    startScene(this, 'profiles');
  }

  protected draw(): void {
    const { pieces } = contextOf(this);
    this.sky();
    const book = this.register();
    const { left } = book;
    const below = this.drawPlayers(this.registerTitle(left, book.top, t('teacher.title')), left);
    if (this.failed) this.label(left.x, below, t('admin.failed'), C.dim, { maxWidth: left.w });
    const { statuses, curriculum } = this;
    if (statuses === null || curriculum === null) return;
    if (statuses.length === 0) {
      this.label(left.x, below, t('teacher.empty'), C.dim, { maxWidth: left.w });
      return;
    }
    const first = below + REGISTER.row;
    const fit = registerRows(first, book.bottom, REGISTER.row);
    const slice = pageOf(statuses.length, this.page, { singlePageMax: fit.single, perPage: fit.paged });
    const byPiece = new Map(curriculum.pieces.map((p) => [p.piece, p]));
    const rows = statuses.slice(slice.first, slice.first + slice.count).map((status) => {
      const chart = pieces.find(status.piece)?.chart;
      return { status, cells: rowCells(status, byPiece.get(status.piece)!, chart ? pieceTitle(chart) : status.piece) };
    });
    const at = this.columnsOf(book, rows.map((r) => r.cells));
    // the headings over the ruling, the ruling under every line the page holds, then a line a piece
    for (const key of ['deadline', ...MARKS] as const) this.label(at[key], below + 2, t(`teacher.col.${key}`), C.umberDark);
    const lines = slice.paged ? fit.paged : fit.single;
    const rules = Array.from({ length: lines + 1 }, (_, i) => first + i * REGISTER.row - 2);
    // the red margin runs between the status dots and the names, clear of both
    this.ruling(book, rules, [at.deadline - COLUMN.rule, ...at.rules, at.end + COLUMN.rule - 1], at.piece - 2, below, first + lines * REGISTER.row - 2);
    rows.forEach(({ status, cells }, i) => {
      const y = first + i * REGISTER.row;
      this.fineImage((left.x - 1) * 2, y * 2, inkDot(SWATCH_COLOUR[status.colour], DOT.fine));
      const room = at.deadline - at.piece - NAME_ROOM - (status.medal ? MEDAL.cells : 0);
      const name = clipToWidth(cells.piece, room, width);
      // the piece's name opens it for setting (ft_1_26.AC3)
      this.button({
        x: at.piece - INK_INDENT + (room + INK_INDENT) / 2, y: y + 4, width: room + INK_INDENT, height: REGISTER.row - 2, look: 'ink', align: 'left',
        label: name, labelWidth: room, onClick: () => startScene(this, 'teacherPiece', { player: this.player, piece: status.piece }),
      });
      if (status.medal) this.fineImage((at.piece + width(name) + 3) * 2, y * 2 + 1, inkDot(MEDAL_COLOUR[status.medal], MEDAL.fine));
      this.label(at.deadline, y, cells.deadline, C.ink);
      for (const key of MARKS) this.label(at[key], y, cells[key], key === 'delta' && cells.delta.startsWith('-') && cells.delta !== '-' ? C.redDark : C.ink);
    });
    if (slice.paged) this.pager(slice, (page) => startScene(this, 'teacher', { player: this.player, page }));
  }

  /** The players along the head of the left page, as many lines as they take, the chosen one ringed: the row under them. */
  private drawPlayers(top: number, page: { x: number; w: number }): number {
    const { profiles } = contextOf(this);
    const players = profiles.profiles;
    const widths = players.map((p) => width(p.name));
    const flow = flowLine(widths, page.w, NAME.gap);
    players.forEach((player, i) => {
      const { x, line } = flow[i]!;
      const left = page.x + x, y = top + line * NAME.h;
      const chosen = player.id === this.player;
      if (chosen) this.fineImage(left * 2 - RING_PAD - 4, y * 2 - RING_PAD - 1, inkRing(widths[i]! * 2 + 8, (NAME.h - 2) * 2));
      this.button({
        x: left + widths[i]! / 2, y: y + 4, width: widths[i]! + 4, height: NAME.h - 1, look: 'ink', label: player.name,
        onClick: () => startScene(this, 'teacher', { player: player.id }),
      }).setActive(chosen);
    });
    const lines = flow.length === 0 ? 1 : flow[flow.length - 1]!.line + 1;
    return top + lines * NAME.h + UNDER_NAMES;
  }

  /**
   * Where each column starts: the dot, the name and the date on the left page; the marks side by side on the right, as
   * wide as their widest word. `rules`: the rule between two marks, halfway across the room between them, so the
   * words stay clear of it when the room narrows to fit the page.
   */
  private columnsOf(book: RegisterLayout, rows: readonly Record<Column, string>[]): Record<Column, number> & { end: number; rules: number[] } {
    const widest = (key: Exclude<Column, 'piece'>) => Math.max(width(t(`teacher.col.${key}` as const)), ...rows.map((r) => width(r[key])));
    const widths = MARKS.map((key) => widest(key));
    const placed = placeColumns(widths, book.right.w - COLUMN.rule, COLUMN.gap);
    const xs = placed.x.map((x) => book.right.x + x);
    const rules = xs.slice(1).map((x, i) => Math.round((xs[i]! + widths[i]! + x) / 2));
    const at = { piece: book.left.x + DOT.cells, deadline: book.left.x + book.left.w - widest('deadline'), end: book.right.x + placed.end, rules } as Record<Column, number> & { end: number; rules: number[] };
    MARKS.forEach((key, i) => { at[key] = xs[i]!; });
    return at;
  }

  /** Adding a piece (ft_1_26.AC3), her own password, and the lock (ft_1_07.AC8's lock, for her screen): the lock closes it and returns to the main menu. */
  protected override toolbarItems(): ToolbarItem[] {
    const { teacher } = contextOf(this);
    return [
      { label: t('teacher.add'), disabled: this.curriculum === null, onClick: () => startScene(this, 'teacherPiece', { player: this.player }) },
      // when she comes to test: the weekly days, the time, a test ordered for later (ft_1_26.AC9)
      { label: t('teacher.tests'), disabled: this.curriculum === null, onClick: () => startScene(this, 'teacherTests', { player: this.player }) },
      { label: t('teacher.password'), onClick: () => startScene(this, 'teacherPassword') },
      { label: t('admin.lock'), icon: LOCK, iconOnly: true, tooltip: t('admin.lock'), onClick: () => { teacher.lock.lock(); startScene(this, 'profiles'); } },
    ];
  }
}

/** What a piece's row says in each column: a dash where nothing is measured yet. The deadline is written month-day. */
function rowCells(status: PieceStatus, set: CurriculumPiece, title: string): Record<Column, string> {
  return {
    piece: title, deadline: set.deadline.slice(5), priority: String(set.priority), level: shown(status.level),
    expected: String(status.expected), predicted: shown(status.predicted), delta: shown(status.delta),
  };
}
