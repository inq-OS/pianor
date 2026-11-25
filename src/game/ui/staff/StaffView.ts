import Phaser from 'phaser';
import { strokePolyline } from './polyline';
import type { NoteProgress, NoteTiming } from '../../../core/judge/types';
import type { PlaySettings } from '../../../core/judge/playSettings';
import type { BarNumber } from '../../../core/layout/barNumbers';
import type { Playhead } from '../../../core/layout/playhead';
import type { DurationMarks } from '../../../core/layout/durationHelp';
import { SCORE_COLOURS, STAFF_INK, scoreColour } from '../../../core/layout/scoreColour';
import { wordFits } from '../../../core/layout/dynamicWords';
import type { PlayedMark } from '../../../core/layout/playedMark';
import { accidentalKind, pageOfNotes, type BeamGlyph, type NoteGlyph, type NoteValue, type SlurGlyph, type StaffLayout, type TieGlyph, type TupletGlyph } from '../../../core/layout/staff';
import type { GraceGlyph } from '../../../core/layout/staffTypes';
import { slurPoints, tiePoints } from '../../../core/layout/preview';
import { STAFF_LAYERS, type StaffLayer } from './layers';
import { addSheet } from './sheetGround';
import { PARCHMENT_PAPER } from '../pixel/paint/parchment';
import { t } from '../../../core/text/strings';
import type { Dynamic } from '../../../core/chart/dynamics';
import { ACCIDENTAL_STROKES, BASS_CLEF_BALL, BASS_CLEF_DOTS, BASS_CLEF_STROKE, BRACE_PATH, DIGITS, QUARTER_REST_STROKE, TREBLE_CLEF_STROKE, type Pt } from './glyphs';
import { STAFF_FONT } from './staffFont';

export type NoteState = 'pending' | 'correct' | 'wrong';

export interface StaffTheme {
  paper: number;
  ink: number;
  correct: number;
  wrong: number;
  cursor: number;
  cursorFill: number;
  hint: string;
  /** The soft background of a section's bars while it is chosen, and the colour of its A and B. */
  sectionFill: number;
  sectionInk: string;
  /** A song's fold zigzag (ft_1_36 rule 7), as a number, and the words under it. */
  foldInk: number;
  foldText: string;
}

/** High-contrast defaults for a small student on a laptop screen. */
export const DEFAULT_THEME: StaffTheme = {
  // the flat colour of the parchment the staff lies on (d119): what is drawn in the sheet's own colour, a half note's inside
  paper: PARCHMENT_PAPER,
  ink: STAFF_INK,
  correct: 0x1f9d55,
  wrong: SCORE_COLOURS.missed,
  cursor: 0x2b6cff,
  // Halfway between the old highlight (0xdbe7ff) and the paper, so the box is softer.
  cursorFill: 0xeceff1,
  // slightly grey, so the note names and finger numbers do not muddy the notes
  hint: '#6e6e7a',
  // a highlighter's pale yellow, a quarter of the way from the paper to gold: soft, and unlike the grey cursor box
  sectionFill: 0xfbebbc,
  sectionInk: '#8a5a00',
  foldInk: 0x6e6e7a,
  foldText: '#4a4a55',
};

/** A song's marks on the staff (ft_1_36 rule 7): part names by chart bar (0-based), folds before a chart bar. */
export interface PartMarks {
  names: readonly { bar: number; text: string }[];
  folds: readonly { beforeBar: number; text: string }[];
}

/** AX-3 provisional: a marker's red from a pale pink at the threshold (shade near 0) to a full red (1). */
const MARKER_LIGHT = [0xf2, 0xa8, 0xa8] as const;
const MARKER_FULL = [0xc8, 0x10, 0x10] as const;
function markerColour(shade: number): number {
  const mix = (i: 0 | 1 | 2) => Math.round(MARKER_LIGHT[i] + (MARKER_FULL[i] - MARKER_LIGHT[i]) * shade);
  return (mix(0) << 16) | (mix(1) << 8) | mix(2);
}

/** The Estonian word of each dynamic mark, shown with the hints (core_09.AC15). */
const DYNAMIC_WORD_KEY: Record<Dynamic, 'staff.dyn.pp' | 'staff.dyn.p' | 'staff.dyn.mp' | 'staff.dyn.mf' | 'staff.dyn.f' | 'staff.dyn.ff'> = {
  pp: 'staff.dyn.pp', p: 'staff.dyn.p', mp: 'staff.dyn.mp', mf: 'staff.dyn.mf', f: 'staff.dyn.f', ff: 'staff.dyn.ff',
};

/** A section being chosen or practised: bars with a soft background, and letters (A, B) over its first and last bar. Bar indexes of the layout. */
export interface SectionMarks {
  tint: readonly number[];
  /** Bars with a background colour of their own (the practice analysis' heat, core_10); the section's tint is used for the rest. */
  fills?: ReadonlyMap<number, number>;
  letters: readonly { bar: number; text: string }[];
}

export interface StaffHints {
  noteNames: boolean;
  fingers: boolean;
  /** Show the finger of every head of a chord, each beside its head (the per-player setting); off shows the top head's only. */
  chordFingers?: boolean;
}

type NoteSelection = number | readonly number[] | null;
const toSet = (selection: NoteSelection): ReadonlySet<number> =>
  new Set(selection === null ? [] : typeof selection === 'number' ? [selection] : selection);

/** How long a page turn takes to fade in: quick, and no movement, so the eye stays on the notes. */
const PAGE_FADE_MS = 160;
/**
 * Tempo mode: the staff is passed by an invisible running line. Lines, bar lines and notes turn this grey the moment
 * it reaches them, so the grey edge is the current position.
 */
const PAST_GREY = 0x9a9aa6;
/** The note duration helper (ft_1_11): a light blue band and fainter blue ghost heads, as in the chosen previews. */
const DURATION_BLUE = 0x7aa5ff;
const DURATION_BAND_ALPHA = 0.38;
const DURATION_GHOST = 0x2b6cff;
const DURATION_GHOST_ALPHA = 0.28;
/** The key that was played: faint, in the wrong colour, its name under it (ft_1_12.AC7). */
const PLAYED_ALPHA = 0.55;
const PLAYED_INK = '#d7263d';
const PLAYED_NAME_GAP = 1.7;
/** How much of the sheet's copy covers bars drawn very faint (ft_1_32.AC20): a little ink shows through. */
const VEIL_ALPHA = 0.86;

/**
 * Draws a `StaffLayout`: one staff, or a grand staff with a brace. It reads play state (note states, which notes are
 * awaited) and never decides correctness. The static staff is drawn once per page; notes are redrawn when a state changes.
 * A layout with several pages (`linesPerPage`) shows one page at a time and turns to the page of the awaited notes.
 */
export class StaffView {
  /** The sheet of parchment the staff is written on (d119), under everything; it stays while a page turns. */
  private readonly sheet: { image: Phaser.GameObjects.Image; release: () => void };
  /** Copies of the sheet laid over the bars drawn very faint (`veil`), one per line, with the line they cover. */
  private veils: { image: Phaser.GameObjects.Image; system: number }[] = [];
  /** The coloured bars on the sheet (a section being chosen), under the highlight boxes and the staff lines. */
  private readonly paperBg: Phaser.GameObjects.Graphics;
  private readonly paper: Phaser.GameObjects.Graphics;
  private readonly cursorGfx: Phaser.GameObjects.Graphics;
  /** The note duration helper (ft_1_11), under the lines; empty unless `setDurationMarks` gave it marks. */
  private readonly durationGfx: Phaser.GameObjects.Graphics;
  private durationMarks: DurationMarks = { bands: [], ghosts: [] };
  private readonly playheadGfx: Phaser.GameObjects.Graphics;
  private readonly notesGfx: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  /** The note-name hint of each grace note (core_09.AC32), small, under its head; in the order of `layout.graces`. */
  private readonly graceLabels: Phaser.GameObjects.Text[] = [];
  /** The graces drawn on the page shown, with the head centre each was drawn at (for tests: what is drawn, not only the layout). */
  private gracesDrawn: { index: number; x: number; y: number; slash: boolean }[] = [];
  private readonly fingerTexts: Phaser.GameObjects.Text[] = [];
  /** Where the hand moves along the keyboard (ft_1_30.AC10): an arrow above the staff over the note, shown with the finger numbers. */
  private shifts: { x: number; y: number; direction: 'up' | 'down'; system: number }[] = [];
  private shiftGfx: Phaser.GameObjects.Graphics | null = null;
  private shiftsDrawn = { up: 0, down: 0 };
  /** Mistake markers (ft_1_32.AC5): a circle over a note missed again and again, its shade 0 to 1 (light to full red). */
  private markers: { x: number; y: number; shade: number; system: number }[] = [];
  private markerGfx: Phaser.GameObjects.Graphics | null = null;
  private markersDrawn = 0;
  /** Tempo mode: the score number of each note, drawn where the finger would be. */
  private readonly scoreTexts: Phaser.GameObjects.Text[] = [];
  /** Dynamic marks (core_09.AC15): the letters on the staff, and the word beside them while note names are on. */
  private readonly dynamicTexts: { mark: Phaser.GameObjects.Text; word: Phaser.GameObjects.Text; system: number; fits: boolean }[] = [];
  /** The word LEGATO above each slur (core_09.AC27), shown with the note names like a dynamic word. */
  private readonly slurTexts: { text: Phaser.GameObjects.Text; system: number }[] = [];
  /** Tempo mode: the colour a played or missed note takes (null keeps the staff's colour). */
  private scoreColours: (number | null)[];
  private followsPlayhead = false;
  private playhead: Playhead | null = null;
  /** Tempo mode: how many notes the playhead has passed (they are drawn grey). */
  private pastNotes = 0;
  private readonly states: NoteState[];
  private cursors: ReadonlySet<number> = new Set();
  private wrong: ReadonlySet<number> = new Set();
  /** The key that was played after a wrong press (ft_1_12.AC7), drawn faint beside the awaited note, and its name. */
  private played: PlayedMark | null = null;
  private playedName: Phaser.GameObjects.Text | null = null;
  private hints: StaffHints;
  /** The page on screen (0 for a layout with one page). */
  private page = 0;
  /** False until the first play state arrives: a view made mid-piece (after a resize or a hint toggle) jumps to its page without a fade. */
  private synced = false;
  private section: SectionMarks | null = null;
  private veiled: readonly { from: number; to: number }[] = [];
  /** The A and B of a section, each with the system of its bar. */
  private readonly markTexts: { text: Phaser.GameObjects.Text; system: number }[] = [];
  /** A song's part names over their first bars and its folds (ft_1_36 rule 7); drawn with the marks, kept apart from a section's. */
  private partMarks: PartMarks | null = null;
  private readonly partTexts: { text: Phaser.GameObjects.Text; system: number; bar?: number }[] = [];
  /** Hears every page turn (the song map's frame follows the page, ft_1_36 rule 8). */
  onPageShown: ((page: number) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: StaffLayout,
    private readonly theme: StaffTheme = DEFAULT_THEME,
    hints: StaffHints = { noteNames: false, fingers: false },
    /** Where the layout's top-left corner sits on the screen. */
    readonly origin: { x: number; y: number } = { x: 0, y: 0 },
    /** The small numbers above bar lines (`core/layout/barNumbers`); none by default. */
    private readonly barNumbers: readonly BarNumber[] = [],
    /** Where the sheet of parchment starts and how wide it is, for a staff moved in from the sides of its area (d119); the layout's own area by default. */
    ground?: { x: number; width: number },
  ) {
    this.states = layout.notes.map(() => 'pending');
    this.scoreColours = layout.notes.map(() => null);
    this.hints = hints;
    // Creation order is draw order: the sheet, its coloured bars, then the highlight boxes, then the staff lines, notes and playhead on top.
    this.sheet = addSheet(scene, layout, origin, ground);
    const layers = {} as Record<StaffLayer, Phaser.GameObjects.Graphics>;
    for (const layer of STAFF_LAYERS) layers[layer] = scene.add.graphics();
    this.paperBg = layers.paper;
    this.cursorGfx = layers.highlight;
    this.durationGfx = layers.duration;
    this.paper = layers.lines;
    this.notesGfx = layers.notes;
    this.playheadGfx = layers.playhead;
    for (const g of [this.paperBg, this.paper, this.cursorGfx, this.durationGfx, this.notesGfx, this.playheadGfx]) g.setPosition(origin.x, origin.y);
    this.drawStaff();
    const fontSize = `${Math.round(layout.staffSpace * 1.1)}px`;
    // a word that would run into the next mark of its staff is not drawn (core_09.AC15)
    const marked = layout.notes.filter((n) => n.dynamic !== null);
    const fits = wordFits(marked.map((n) => ({ system: n.system, staff: n.staff, column: n.column, word: t(DYNAMIC_WORD_KEY[n.dynamic!.text]) })), layout.staffSpace);
    let markIndex = 0;
    for (const n of layout.notes) {
      const style = { fontFamily: STAFF_FONT, fontStyle: 'bold', fontSize, color: theme.hint };
      this.labels.push(scene.add.text(origin.x + n.column, origin.y + n.labelY, n.label, style).setOrigin(0.5));
      // a finger sits beside its head, level with it; the text is set by setHints
      this.fingerTexts.push(scene.add.text(origin.x + n.fingerX, origin.y + n.y, '', style).setOrigin(0.5));
      this.scoreTexts.push(scene.add.text(origin.x + n.column, origin.y + n.scoreY, '', { ...style, color: '#1b1b2f' }).setOrigin(0.5).setVisible(false));
      if (n.dynamic) {
        const mark = scene.add.text(origin.x + n.dynamic.x, origin.y + n.dynamic.y, n.dynamic.text, { ...style, fontStyle: 'bold italic' }).setOrigin(0.5);
        const word = scene.add.text(origin.x + n.dynamic.x + 1.2 * layout.staffSpace, origin.y + n.dynamic.y, t(DYNAMIC_WORD_KEY[n.dynamic.text]), { ...style, fontSize: `${Math.round(layout.staffSpace * 0.9)}px` }).setOrigin(0, 0.5);
        this.dynamicTexts.push({ mark, word, system: n.system, fits: fits[markIndex++]! });
      }
    }
    for (const g of layout.graces) {
      const style = { fontFamily: STAFF_FONT, fontStyle: 'bold', fontSize: `${Math.max(8, Math.round(layout.staffSpace * 1.1 * g.scale))}px`, color: theme.hint };
      this.graceLabels.push(scene.add.text(origin.x + g.x, origin.y + g.labelY, g.label, style).setOrigin(0.5));
    }
    // one word per slur, above the half that starts it (a slur across a line break has its word on the first line)
    for (const slur of layout.slurs) {
      if (slur.from === null) continue;
      const word = scene.add.text(origin.x + slur.label.x, origin.y + slur.label.y, t('staff.legato'), { fontFamily: STAFF_FONT, fontStyle: 'bold', fontSize: `${Math.round(layout.staffSpace * 0.9)}px`, color: theme.hint }).setOrigin(0.5, 1);
      this.slurTexts.push({ text: word, system: slur.system });
    }
    this.setHints(hints);
    this.drawNotes();
  }

  setHints(hints: StaffHints): void {
    this.hints = hints;
    this.layout.notes.forEach((n, slot) => {
      const shown = this.onPage(n.system);
      this.labels[slot]!.setVisible(shown && hints.noteNames);
      const digit = hints.chordFingers ? n.headFinger : n.finger;
      this.fingerTexts[slot]!.setText(digit === null ? '' : String(digit));
      this.fingerTexts[slot]!.setVisible(shown && hints.fingers);
    });
    this.drawShifts();
    this.drawMarkers();
    this.layout.graces.forEach((g, slot) => this.graceLabels[slot]!.setVisible(this.onPage(g.system) && hints.noteNames));
    for (const d of this.dynamicTexts) {
      d.mark.setVisible(this.onPage(d.system));
      d.word.setVisible(this.onPage(d.system) && hints.noteNames && d.fits);
    }
    for (const mark of this.markTexts) mark.text.setVisible(this.onPage(mark.system));
    for (const mark of this.partTexts) mark.text.setVisible(this.onPage(mark.system));
    for (const slur of this.slurTexts) slur.text.setVisible(this.onPage(slur.system) && hints.noteNames);
    for (const v of this.veils) v.image.setVisible(this.onPage(v.system));
  }

  /** The bars drawn very faint (`veil`), as inclusive ranges (read by the tests). */
  get faintBars(): readonly { from: number; to: number }[] {
    return this.veiled;
  }

  /**
   * Draw the bars of `ranges` (inclusive) very faint (ft_1_32.AC20): a copy of the sheet, nearly opaque, laid over each run of
   * them on a line. The bar lines that bound the bars played stay in ink; a line that starts faint is veiled from its clef,
   * and one that ends faint to its end. Lay it before anything drawn over the staff that must stay clear (the prizes, the markers).
   */
  veil(ranges: readonly { from: number; to: number }[]): void {
    for (const v of this.veils) v.image.destroy();
    this.veils = [];
    this.veiled = ranges;
    const { layout } = this;
    const S = layout.staffSpace;
    const faint = (bar: number) => ranges.some((r) => bar >= r.from && bar <= r.to);
    for (const here of layout.systems) {
      const bars = layout.bars.filter((b) => b.system === here.index);
      const lineRight = Math.max(...layout.staffLines.filter((l) => l.system === here.index).map((l) => l.x2)) + 0.3 * S;
      let k = 0;
      while (k < bars.length) {
        if (!faint(bars[k]!.index)) {
          k++;
          continue;
        }
        let end = k;
        while (end + 1 < bars.length && faint(bars[end + 1]!.index)) end++;
        const left = k === 0 ? -0.2 * S : bars[k]!.x + 0.2 * S;
        const right = end === bars.length - 1 ? lineRight : bars[end]!.x + bars[end]!.width - 0.2 * S;
        this.veilOver(here.index, left, right);
        k = end + 1;
      }
    }
  }

  /** One copy of the sheet over line `system` from `left` to `right` (layout x), between the middles of the gaps to its neighbours. */
  private veilOver(system: number, left: number, right: number): void {
    const { layout } = this;
    const sheet = this.sheet.image;
    const fine = sheet.scaleX;
    const before = layout.systems[system - 1];
    const after = layout.systems[system + 1];
    const here = layout.systems[system]!;
    const top = before && before.page === here.page ? (before.bottomLineY + here.topLineY) / 2 : 0;
    const bottom = after && after.page === here.page ? (here.bottomLineY + after.topLineY) / 2 : layout.height;
    const x0 = this.origin.x + left;
    const crop = { x: Math.floor((x0 - sheet.x) / fine), y: Math.floor((this.origin.y + top - sheet.y) / fine) };
    const image = this.scene.add.image(sheet.x, sheet.y, sheet.texture.key).setOrigin(0, 0).setScale(fine).setAlpha(VEIL_ALPHA)
      .setCrop(crop.x, crop.y, Math.ceil((right - left) / fine) + 1, Math.ceil((bottom - top) / fine) + 1);
    image.setVisible(this.onPage(system));
    this.veils.push({ image, system });
  }

  /**
   * Mark a section, or none with null: its bars get a soft background, and its letters sit above the bar line where
   * a bar starts, after the bar number when there is one. The staff keeps its size; only these marks change.
   */
  setSectionMarks(marks: SectionMarks | null): void {
    this.section = marks;
    for (const mark of this.markTexts) mark.text.destroy();
    this.markTexts.length = 0;
    const S = this.layout.staffSpace;
    const style = { fontFamily: STAFF_FONT, fontStyle: 'bold', fontSize: `${Math.round(S * 1.1)}px`, color: this.theme.sectionInk };
    const used = new Map<number, number>();
    for (const { bar: index, text } of marks?.letters ?? []) {
      const bar = this.layout.bars[index];
      if (!bar) continue;
      const number = this.barNumbers.find((n) => n.index === index);
      const cell = (0.8 * S) / 5;
      const numberWidth = number === undefined ? 0 : String(number.number).length * 4 * cell - cell + 0.4 * S;
      const before = used.get(index) ?? 0;
      used.set(index, before + 1);
      const x = this.origin.x + bar.x + 0.25 * S + numberWidth + before * 1.1 * S;
      const y = this.origin.y + this.layout.systems[bar.system]!.topLineY - 1.95 * S;
      this.markTexts.push({ text: this.scene.add.text(x, y, text, style).setOrigin(0, 0.5), system: bar.system });
    }
    this.drawStaff();
    this.setHints(this.hints);
  }

  /**
   * A song's parts (ft_1_36 rule 7), or none with null: each part's name over its first bar in the section ink, after any bar
   * number, and a thin double line at each fold with its words under the staff, where a blank or a part that is off was
   * left out. The staff keeps its size.
   */
  setPartMarks(marks: PartMarks | null): void {
    this.partMarks = marks;
    for (const mark of this.partTexts) mark.text.destroy();
    this.partTexts.length = 0;
    const S = this.layout.staffSpace;
    const name = { fontFamily: STAFF_FONT, fontStyle: 'bold', fontSize: `${Math.round(S * 1.1)}px`, color: this.theme.sectionInk };
    const fold = { fontFamily: STAFF_FONT, fontSize: `${Math.round(S * 0.9)}px`, color: this.theme.foldText };
    const cell = (0.8 * S) / 5;
    for (const { bar: index, text } of marks?.names ?? []) {
      const bar = this.layout.bars[index];
      if (!bar) continue;
      const number = this.barNumbers.find((n) => n.index === index);
      const numberWidth = number === undefined ? 0 : String(number.number).length * 4 * cell - cell + 0.4 * S;
      const x = this.origin.x + bar.x + 0.25 * S + numberWidth;
      const y = this.origin.y + this.layout.systems[bar.system]!.topLineY - 1.95 * S;
      this.partTexts.push({ text: this.scene.add.text(x, y, text, name).setOrigin(0, 0.5), system: bar.system, bar: index });
    }
    for (const at of this.foldsAt()) {
      const y = this.origin.y + this.layout.systems[at.system]!.bottomLineY + 2.2 * S;
      this.partTexts.push({ text: this.scene.add.text(this.origin.x + at.x + 0.3 * S, y, at.text, fold).setOrigin(0, 0.5), system: at.system });
    }
    this.drawStaff();
    this.setHints(this.hints);
  }

  /**
   * A song's folds (ft_1_36 rule 7): a zigzag in the fold grey through the staff, like a page folded under, so it is never
   * read as a bar line or a repeat sign.
   */
  private drawFolds(): void {
    const g = this.paper;
    const S = this.layout.staffSpace;
    for (const at of this.foldsAt()) {
      if (!this.onPage(at.system)) continue;
      const system = this.layout.systems[at.system]!;
      g.lineStyle(this.lineWidth() * 1.5, this.theme.foldInk, 1);
      const top = system.topLineY - S;
      const steps = Math.max(2, Math.round((system.bottomLineY + S - top) / (0.6 * S)));
      const step = (system.bottomLineY + S - top) / steps;
      for (let i = 0; i < steps; i++) g.lineBetween(at.x + (i % 2 === 0 ? -0.3 : 0.3) * S, top + i * step, at.x + (i % 2 === 0 ? 0.3 : -0.3) * S, top + (i + 1) * step);
    }
    g.lineStyle(this.lineWidth(), this.theme.ink, 1);
  }

  /** The page that shows bar `index` (0-based), or null for a bar past the staff. */
  pageOfBar(index: number): number | null {
    const bar = this.layout.bars[index];
    return bar ? this.layout.systems[bar.system]!.page : null;
  }

  /** The bars (0-based, first and last) on page `page`. */
  barsOnPage(page: number): { first: number; last: number } | null {
    const on = this.layout.bars.flatMap((b, i) => (this.layout.systems[b.system]!.page === page ? [i] : []));
    return on.length === 0 ? null : { first: on[0]!, last: on[on.length - 1]! };
  }

  /** A part's name over bar `index` flashes twice, so the eye finds where the song map turned to (ft_1_36 rule 8). */
  flashPart(index: number): void {
    const texts = this.partTexts.filter((p) => p.bar === index).map((p) => p.text);
    if (texts.length === 0) return;
    this.scene.tweens.killTweensOf(texts);
    this.scene.tweens.add({ targets: texts, alpha: { from: 1, to: 0.15 }, duration: 180, yoyo: true, repeat: 1 });
  }

  /** Where each fold stands: at the start of the bar it comes before, or at the end of the last bar. */
  private foldsAt(): { x: number; system: number; text: string }[] {
    const bars = this.layout.bars;
    return (this.partMarks?.folds ?? []).flatMap(({ beforeBar, text }) => {
      const bar = bars[beforeBar];
      if (bar) return [{ x: bar.x, system: bar.system, text }];
      const last = bars[bars.length - 1];
      return last ? [{ x: last.x + last.width, system: last.system, text }] : [];
    });
  }

  /**
   * Arrows where the hand moves along the keyboard (ft_1_30.AC10), by chart note index: right for up the keyboard, left for
   * down. Drawn above the staff over the note, in the hint grey, and shown only with the finger numbers; an empty map clears them.
   */
  setHandShifts(shifts: ReadonlyMap<number, 'up' | 'down'>): void {
    const S = this.layout.staffSpace;
    const seen = new Set<number>();
    this.shifts = [];
    for (const n of this.layout.notes) {
      const direction = shifts.get(n.index);
      if (direction === undefined || seen.has(n.index)) continue;
      seen.add(n.index);
      const top = this.layout.systems[n.system]!.staves[n.staff]!.topLineY;
      this.shifts.push({ x: n.column, y: Math.min(top, n.y - S) - 1.2 * S, direction, system: n.system });
    }
    if (!this.shiftGfx) this.shiftGfx = this.scene.add.graphics().setPosition(this.origin.x, this.origin.y);
    this.drawShifts();
  }

  /**
   * Mistake markers (ft_1_32.AC5): for each chart note index, its shade (above 0) from `mistakeMarkers`. A small circle over
   * the note, above the staff when the note is inside it, from light red at the threshold to full red.
   */
  setMarkers(shades: ReadonlyMap<number, number>): void {
    const S = this.layout.staffSpace;
    const seen = new Set<number>();
    this.markers = [];
    for (const n of this.layout.notes) {
      const shade = shades.get(n.index);
      if (shade === undefined || shade <= 0 || seen.has(n.index)) continue;
      seen.add(n.index);
      const top = this.layout.systems[n.system]!.staves[n.staff]!.topLineY;
      this.markers.push({ x: n.column, y: Math.min(top, n.y - S) - 2.4 * S, shade: Math.min(1, shade), system: n.system });
    }
    if (!this.markerGfx) this.markerGfx = this.scene.add.graphics().setPosition(this.origin.x, this.origin.y);
    this.drawMarkers();
  }

  /** The mistake markers drawn on the page shown (for tests). */
  get markersShown(): number {
    return this.markersDrawn;
  }

  /** A ring per marker on the page shown, its red as deep as its shade. */
  private drawMarkers(): void {
    const g = this.markerGfx;
    this.markersDrawn = 0;
    if (!g) return;
    g.clear();
    const S = this.layout.staffSpace;
    for (const m of this.markers) {
      if (!this.onPage(m.system)) continue;
      g.lineStyle(Math.max(1.5, 0.28 * S), markerColour(m.shade), 1);
      g.strokeCircle(m.x, m.y, 0.55 * S);
      this.markersDrawn++;
    }
  }

  /** The hand-shift arrows drawn on the page shown (for tests): how many point up the keyboard and how many down. */
  get handShiftsShown(): { up: number; down: number } {
    return { ...this.shiftsDrawn };
  }

  /** A chunky arrow per shift on the page shown: a shaft and a head, about two staff spaces long. */
  private drawShifts(): void {
    const g = this.shiftGfx;
    this.shiftsDrawn = { up: 0, down: 0 };
    if (!g) return;
    g.clear();
    if (!this.hints.fingers) return;
    const S = this.layout.staffSpace;
    const colour = Phaser.Display.Color.HexStringToColor(this.theme.hint).color;
    g.fillStyle(colour, 1);
    for (const shift of this.shifts) {
      if (!this.onPage(shift.system)) continue;
      const d = shift.direction === 'up' ? 1 : -1;
      const half = 0.9 * S;
      const head = 0.6 * S;
      // the shaft, then the head at the end it points to
      g.fillRect(d > 0 ? shift.x - half : shift.x - half + head, shift.y - 0.15 * S, 2 * half - head, 0.3 * S);
      const tip = shift.x + d * half;
      g.fillTriangle(tip, shift.y, tip - d * head, shift.y - 0.45 * S, tip - d * head, shift.y + 0.45 * S);
      this.shiftsDrawn[shift.direction]++;
    }
  }

  /** Show the note duration helper's marks (`core/layout/durationHelp`, ft_1_11); empty marks clear it. */
  setDurationMarks(marks: DurationMarks): void {
    this.durationMarks = marks;
    this.drawDuration();
  }

  /** How many marks of the duration helper are on the page shown (for tests). */
  get durationMarksShown(): { bands: number; ghosts: number } {
    return { bands: this.durationMarks.bands.filter((b) => this.onPage(b.system)).length, ghosts: this.durationMarks.ghosts.filter((g) => this.onPage(g.system)).length };
  }

  /** The band and the ghost heads, in the cursor's blue and faint, so they read as help and not as notes to play. */
  private drawDuration(): void {
    const g = this.durationGfx;
    g.clear();
    for (const b of this.durationMarks.bands) if (this.onPage(b.system)) g.fillStyle(DURATION_BLUE, DURATION_BAND_ALPHA).fillRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
    for (const h of this.durationMarks.ghosts) if (this.onPage(h.system)) g.fillStyle(DURATION_GHOST, DURATION_GHOST_ALPHA).fillEllipse(h.x, h.y, h.rx * 2, h.ry * 2);
  }

  /** The page on screen. */
  get currentPage(): number {
    return this.page;
  }

  /** Show another page of lines (a no-op for a layout with one page, or the page already shown); `fade` for a page turn. */
  showPage(page: number, fade = true): void {
    const target = Math.max(0, Math.min(this.layout.pageCount - 1, page));
    if (target === this.page) return;
    this.page = target;
    this.onPageShown?.(target);
    this.drawStaff();
    this.drawDuration();
    this.setHints(this.hints);
    this.drawNotes();
    this.drawPlayhead();
    if (!fade) return;
    const targets = [this.paperBg, this.paper, this.cursorGfx, this.durationGfx, this.notesGfx, this.playheadGfx, ...this.labels, ...this.graceLabels, ...this.fingerTexts, ...(this.shiftGfx ? [this.shiftGfx] : []), ...(this.markerGfx ? [this.markerGfx] : []), ...this.scoreTexts, ...this.markTexts.map((m) => m.text), ...this.partTexts.map((m) => m.text), ...this.dynamicTexts.flatMap((d) => [d.mark, d.word]), ...this.slurTexts.map((s) => s.text)];
    this.scene.tweens.killTweensOf(targets);
    this.scene.tweens.add({ targets, alpha: { from: 0.2, to: 1 }, duration: PAGE_FADE_MS });
  }

  setNoteState(noteIndex: number, state: NoteState): void {
    const slot = this.layout.notes.findIndex((n) => n.index === noteIndex);
    if (slot < 0) return;
    this.states[slot] = state;
    this.drawNotes();
  }

  /**
   * Show play progress from the judge: `progress` is indexed by chart note, `cursorNotes` are the notes awaited now
   * (one per hand in a two-hand step; each is highlighted on its own staff).
   */
  applyProgress(progress: readonly NoteProgress[], cursorNotes: NoteSelection): void {
    this.layout.notes.forEach((n, slot) => {
      this.states[slot] = progress[n.index] === 'correct' ? 'correct' : 'pending';
    });
    this.cursors = toSet(cursorNotes);
    this.followCursor();
    this.drawNotes();
  }

  /** Briefly show notes in the wrong colour (null clears them). The scene decides how long. */
  flashWrong(noteIndexes: NoteSelection): void {
    this.wrong = toSet(noteIndexes);
    this.drawNotes();
  }

  /** Highlight the notes the player should play next, or clear with null. */
  setCursor(noteIndexes: NoteSelection): void {
    this.cursors = toSet(noteIndexes);
    this.followCursor();
    this.drawNotes();
  }

  /**
   * Tempo mode: show each note's timing the way the player chose. `timings` and `progress` come from the play state; with the
   * view 'off' nothing is coloured, with 'colour' played and missed notes take the score colour, with 'number' the score
   * is written over the note as well.
   */
  applyTimings(progress: readonly NoteProgress[], timings: readonly (NoteTiming | null)[] | undefined, view: PlaySettings['scoreView']): void {
    this.layout.notes.forEach((n, slot) => {
      const missed = progress[n.index] === 'missed';
      const timing = timings?.[n.index] ?? null;
      this.scoreColours[slot] = view === 'off' ? null : scoreColour(timing, missed);
      const text = this.scoreTexts[slot]!;
      const number = view === 'number' && (missed || timing !== null);
      text.setText(missed ? '0' : timing ? String(timing.score) : '');
      text.setVisible(number && this.onPage(n.system));
      if (number) this.fingerTexts[slot]!.setVisible(false);
    });
    this.drawNotes();
  }

  /** Tempo mode: where the piece is now (null shows no grey). The page turns to it, so the grey always meets the notes being played. */
  setPlayhead(playhead: Playhead | null): void {
    this.playhead = playhead;
    if (playhead !== null && this.followsPlayhead) this.showPage(playhead.page, this.synced);
    if (playhead !== null) this.synced = true;
    this.drawPlayhead();
  }

  /** Let the playhead, not the awaited note, decide the page (Tempo mode). */
  followPlayhead(on: boolean): void {
    this.followsPlayhead = on;
  }

  /**
   * Tempo mode: the staff lines and bar lines the playhead has passed turn grey (the notes do too, in `noteColor`).
   * A playhead on a later page leaves every system here grey, as they all come before it.
   */
  private drawPlayhead(): void {
    const g = this.playheadGfx;
    g.clear();
    const head = this.playhead;
    if (head === null) {
      this.refreshPastNotes();
      return;
    }
    g.lineStyle(this.lineWidth(), PAST_GREY, 1);
    for (const line of this.layout.staffLines) {
      if (!this.onPage(line.system) || !this.isPast(line.system, line.x1)) continue;
      const end = line.system === head.system ? Math.min(line.x2, head.x) : line.x2;
      if (end > line.x1) g.lineBetween(line.x1, line.y, end, line.y);
    }
    for (const bar of this.layout.barlines) {
      if (this.onPage(bar.system) && this.isPast(bar.system, bar.x)) g.lineBetween(bar.x, bar.y1, bar.x, bar.y2);
    }
    this.refreshPastNotes();
  }

  /** Whether something at `x` on `system` lies before the playhead. */
  private isPast(system: number, x: number): boolean {
    const head = this.playhead;
    if (head === null) return false;
    return system < head.system || (system === head.system && x <= head.x);
  }

  /** Redraw the notes only when the playhead has passed a different number of them (passed notes are a prefix). */
  private refreshPastNotes(): void {
    const passed = this.layout.notes.filter((n) => this.isPast(n.system, n.x)).length;
    if (passed === this.pastNotes) return;
    this.pastNotes = passed;
    this.drawNotes();
  }

  /** Turn to the page of the awaited notes; with nothing awaited (the piece is over) the page stays. */
  private followCursor(): void {
    if (this.followsPlayhead) return;
    const page = pageOfNotes(this.layout, [...this.cursors]);
    if (page !== null) this.showPage(page, this.synced);
    this.synced = true;
  }

  private onPage(system: number): boolean {
    return this.layout.systems[system]?.page === this.page;
  }

  destroy(): void {
    [this.paperBg, this.paper, this.cursorGfx, this.durationGfx, this.notesGfx, this.playheadGfx, ...this.labels, ...this.graceLabels, ...this.fingerTexts, ...(this.shiftGfx ? [this.shiftGfx] : []), ...(this.markerGfx ? [this.markerGfx] : []), ...this.scoreTexts, ...this.markTexts.map((m) => m.text), ...this.partTexts.map((m) => m.text), ...this.dynamicTexts.flatMap((d) => [d.mark, d.word]), ...this.slurTexts.map((s) => s.text)].forEach((o) => o.destroy());
    this.playedName?.destroy();
    for (const v of this.veils) v.image.destroy();
    this.sheet.release();
  }

  private lineWidth(): number {
    return Math.max(1.5, this.layout.staffSpace * 0.08);
  }

  private drawStaff(): void {
    const g = this.paper;
    const { layout, theme } = this;
    const S = layout.staffSpace;
    const here = <T extends { system: number }>(items: readonly T[]) => items.filter((item) => this.onPage(item.system));
    this.paperBg.clear();
    // the bars of a section being chosen, softly, behind the cursor box and the lines
    const fills = new Map<number, number>(this.section?.tint.map((index) => [index, theme.sectionFill]) ?? []);
    for (const [index, colour] of this.section?.fills ?? []) fills.set(index, colour);
    for (const [index, colour] of fills) {
      const bar = layout.bars[index];
      if (!bar || !this.onPage(bar.system)) continue;
      const system = layout.systems[bar.system]!;
      this.paperBg.fillStyle(colour, 1).fillRect(bar.x, system.topLineY - 1.2 * S, bar.width, system.bottomLineY - system.topLineY + 2.4 * S);
    }
    g.clear();
    g.lineStyle(this.lineWidth(), theme.ink, 1);
    for (const line of here(layout.staffLines)) g.lineBetween(line.x1, line.y, line.x2, line.y);
    this.drawFolds();
    for (const bar of here(layout.barlines)) {
      if (bar.kind === 'final') {
        g.lineStyle(this.lineWidth(), theme.ink, 1).lineBetween(bar.x - S * 0.35, bar.y1, bar.x - S * 0.35, bar.y2);
        g.lineStyle(S * 0.3, theme.ink, 1).lineBetween(bar.x - S * 0.1, bar.y1, bar.x - S * 0.1, bar.y2);
      } else if (bar.kind === 'double') {
        // two thin lines before a key change (core_09.AC57)
        g.lineStyle(this.lineWidth(), theme.ink, 1).lineBetween(bar.x - S * 0.35, bar.y1, bar.x - S * 0.35, bar.y2);
        g.lineBetween(bar.x, bar.y1, bar.x, bar.y2);
      } else {
        g.lineStyle(bar.kind === 'start' ? S * 0.12 : this.lineWidth(), theme.ink, 1).lineBetween(bar.x, bar.y1, bar.x, bar.y2);
      }
    }
    for (const r of here(layout.repeatSigns ?? [])) {
      // thin and thick lines with two dots per staff, facing the repeated bars (core_09.AC19)
      const dir = r.side === 'start' ? 1 : -1;
      g.lineStyle(S * 0.3, theme.ink, 1).lineBetween(r.x + dir * S * 0.1, r.y1, r.x + dir * S * 0.1, r.y2);
      g.lineStyle(this.lineWidth(), theme.ink, 1).lineBetween(r.x + dir * S * 0.4, r.y1, r.x + dir * S * 0.4, r.y2);
      g.fillStyle(theme.ink, 1);
      for (const y of r.dotYs) g.fillCircle(r.x + dir * S * 0.75, y, S * 0.18);
    }
    this.drawEndings(g, here(layout.endings ?? []));
    for (const brace of here(layout.braces)) {
      const width = S * 1.1;
      const height = brace.y2 - brace.y1;
      g.lineStyle(S * 0.22, theme.ink, 1).beginPath();
      BRACE_PATH.forEach((p, i) => {
        const x = brace.x - width + p.x * width;
        const y = brace.y1 + p.y * height;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.strokePath();
    }
    for (const clef of here(layout.clefs)) {
      if (clef.clef === 'treble') this.stroke(g, TREBLE_CLEF_STROKE, clef.x, clef.y, S * 0.3);
      else {
        this.stroke(g, BASS_CLEF_STROKE, clef.x, clef.y, S * 0.32);
        g.fillStyle(theme.ink, 1).fillCircle(clef.x + BASS_CLEF_BALL.x * S, clef.y + BASS_CLEF_BALL.y * S, BASS_CLEF_BALL.r * S);
        for (const dot of BASS_CLEF_DOTS) g.fillCircle(clef.x + dot.x * S, clef.y + dot.y * S, S * 0.2);
      }
    }
    for (const k of here(layout.keySignature)) this.drawAccidental(g, k.alter, k.x, k.y, theme.ink);
    for (const ts of here(layout.timeSignatures)) {
      this.drawNumber(g, ts.num, ts.x, ts.yNum, ts.digitHeight);
      this.drawNumber(g, ts.den, ts.x, ts.yDen, ts.digitHeight);
    }
    for (const rest of here(layout.rests)) {
      g.lineStyle(this.lineWidth(), this.theme.ink, 1);
      for (const ledger of rest.ledgerLines ?? []) g.lineBetween(ledger.x1, ledger.y, ledger.x2, ledger.y);
      this.drawRest(g, rest.value, rest.x, rest.y);
      if (rest.dot) g.fillStyle(this.theme.ink, 1).fillCircle(rest.dot.x, rest.dot.y, layout.staffSpace * 0.14);
    }
    this.drawBarNumbers(g);
  }

  /** Each ending's bracket, hooks down toward the staff, "1." or "2." under its line at the left (core_09.AC47). */
  private drawEndings(g: Phaser.GameObjects.Graphics, endings: NonNullable<StaffLayout['endings']>): void {
    const S = this.layout.staffSpace;
    const hook = S * 1.2;
    for (const e of endings) {
      g.lineStyle(this.lineWidth(), this.theme.ink, 1).lineBetween(e.x1, e.y, e.x2, e.y);
      if (e.hookLeft) g.lineBetween(e.x1, e.y, e.x1, e.y + hook);
      if (e.hookRight) g.lineBetween(e.x2, e.y, e.x2, e.y + hook);
      if (!e.label) continue;
      const height = S * 1.1;
      const cx = e.x1 + S * 0.8;
      const cy = e.y + S * 0.3 + height / 2;
      this.drawNumber(g, e.number, cx, cy, height);
      g.fillStyle(this.theme.ink, 1).fillRect(cx + height * 0.45, cy + height / 2 - height / 5, height / 5, height / 5);
    }
  }

  /**
   * The bar numbers: small pixel digits just right of the bar line, above the top line. They sit above the cursor box
   * (which reaches 1.2 staff spaces above the top line) and beside the clef and time signature, which end before the first bar.
   */
  private drawBarNumbers(g: Phaser.GameObjects.Graphics): void {
    const S = this.layout.staffSpace;
    const height = 0.8 * S;
    const cell = height / 5;
    for (const { index, number } of this.barNumbers) {
      const bar = this.layout.bars[index];
      if (!bar || !this.onPage(bar.system)) continue;
      const digits = String(number).length;
      const total = digits * 3 * cell + (digits - 1) * cell;
      this.drawNumber(g, number, bar.x + 0.25 * S + total / 2, this.layout.systems[bar.system]!.topLineY - 1.95 * S, height);
    }
  }

  /** Stroke a glyph path given in staff spaces from the box origin (x0, y0). */
  private stroke(g: Phaser.GameObjects.Graphics, path: readonly Pt[], x0: number, y0: number, width: number): void {
    const S = this.layout.staffSpace;
    g.lineStyle(width, this.theme.ink, 1).beginPath();
    path.forEach((p, i) => (i === 0 ? g.moveTo(x0 + p.x * S, y0 + p.y * S) : g.lineTo(x0 + p.x * S, y0 + p.y * S)));
    g.strokePath();
  }

  private drawNumber(g: Phaser.GameObjects.Graphics, value: number, cx: number, cy: number, height: number): void {
    const text = String(value);
    const cell = height / 5;
    const digitW = 3 * cell;
    const gap = cell;
    const total = text.length * digitW + (text.length - 1) * gap;
    g.fillStyle(this.theme.ink, 1);
    [...text].forEach((ch, d) => {
      const rows = DIGITS[ch];
      if (!rows) return;
      const left = cx - total / 2 + d * (digitW + gap);
      rows.forEach((row, r) => {
        [...row].forEach((bit, c) => {
          if (bit === '#') g.fillRect(left + c * cell, cy - height / 2 + r * cell, cell + 0.5, cell + 0.5);
        });
      });
    });
  }

  private drawRest(g: Phaser.GameObjects.Graphics, value: NoteValue, x: number, y: number): void {
    const S = this.layout.staffSpace;
    g.fillStyle(this.theme.ink, 1);
    if (value === 'whole') g.fillRect(x - S * 0.6, y, S * 1.2, S * 0.5);
    else if (value === 'half') g.fillRect(x - S * 0.6, y - S * 0.5, S * 1.2, S * 0.5);
    else if (value === 'eighth' || value === 'sixteenth') {
      // a dot with a curl, and a slanted stroke down from it; a sixteenth rest has a second curl a space lower on the stroke
      g.fillCircle(x - S * 0.35, y - S * 0.45, S * 0.28);
      g.lineStyle(Math.max(2, S * 0.2), this.theme.ink, 1);
      g.lineBetween(x - S * 0.3, y - S * 0.4, x + S * 0.3, y - S * 0.75);
      g.lineBetween(x + S * 0.3, y - S * 0.75, x - S * 0.2, y + S * 1.0);
      if (value === 'sixteenth') {
        g.fillCircle(x - S * 0.5, y + S * 0.4, S * 0.28);
        g.lineBetween(x - S * 0.45, y + S * 0.45, x + S * 0.1, y + S * 0.2);
      }
    } else this.stroke(g, QUARTER_REST_STROKE, x - S * 0.5, y - S * 1.5, S * 0.28);
  }

  /** Whether a staff of a system is a resting hand's, drawn to be read and not played (ft_1_32.AC18). */
  private resting(system: number, staff: number): boolean {
    return this.layout.systems[system]?.staves[staff]?.resting === true;
  }

  private noteColor(slot: number): number {
    const note = this.layout.notes[slot]!;
    if (this.resting(note.system, note.staff)) return PAST_GREY;
    if (this.wrong.has(note.index)) return this.theme.wrong;
    // a played or missed note keeps its timing colour (objective feedback); only the rest of the past goes grey
    const scored = this.scoreColours[slot];
    if (scored !== null && scored !== undefined) return scored;
    if (this.isPast(note.system, note.x)) return PAST_GREY;
    const state = this.states[slot];
    return state === 'correct' ? this.theme.correct : state === 'wrong' ? this.theme.wrong : this.theme.ink;
  }

  private drawNotes(): void {
    const { layout, theme } = this;
    const S = layout.staffSpace;
    const g = this.notesGfx;
    g.clear();
    this.cursorGfx.clear();
    // a chord's heads share one cursor box and arrow, drawn once per column
    const cursored = new Set<string>();
    layout.notes.forEach((n: NoteGlyph, slot) => {
      if (!this.onPage(n.system)) return;
      const color = this.noteColor(slot);
      if (this.cursors.has(n.index) && !cursored.has(`${n.system}/${n.staff}/${n.column}`)) {
        cursored.add(`${n.system}/${n.staff}/${n.column}`);
        this.drawCursor(n);
      }
      g.lineStyle(this.lineWidth(), theme.ink, 1);
      for (const ledger of n.ledgerLines) g.lineBetween(ledger.x1, ledger.y, ledger.x2, ledger.y);
      const w = n.headRx * 2;
      const h = n.headRy * 2;
      if (n.filled) {
        g.fillStyle(color, 1).fillEllipse(n.x, n.y, w, h);
      } else {
        const thick = S * (n.value === 'whole' ? 0.32 : 0.24);
        g.fillStyle(theme.paper, 1).fillEllipse(n.x, n.y, w, h);
        g.lineStyle(thick, color, 1).strokeEllipse(n.x, n.y, w - thick, h - thick * 0.6);
      }
      if (n.accidental) this.drawAccidental(g, n.accidental.alter, n.accidental.x, n.accidental.y, color);
      if (n.dot) g.fillStyle(color, 1).fillCircle(n.dot.x, n.dot.y, S * 0.14);
      if (n.stem) g.lineStyle(Math.max(2, S * 0.13), color, 1).lineBetween(n.stem.x, n.stem.y1, n.stem.x, n.stem.y2);
      if (n.stem) for (let k = 0; k < n.flags; k++) this.drawFlagAt({ ...n.stem, y2: n.stem.y2 + (n.stem.up ? 1 : -1) * k * S * 0.8 }, color);
    });
    this.gracesDrawn = [];
    for (const grace of layout.graces) if (this.onPage(grace.system)) this.drawGrace(grace);
    for (const beam of layout.beams) if (this.onPage(beam.system)) this.drawBeam(beam);
    for (const tuplet of layout.tuplets) if (this.onPage(tuplet.system)) this.drawTuplet(tuplet);
    for (const tie of layout.ties) if (this.onPage(tie.system)) this.drawTie(tie);
    for (const slur of layout.slurs) if (this.onPage(slur.system)) this.drawSlur(slur);
    this.drawPlayed();
  }

  /**
   * Show the key that was played (`core/layout/playedMark`) with its name, or clear it with null. It shows what was
   * played, not which way to go (the clean-screen rule; the ear and note trainers name notes the same way).
   */
  setPlayed(mark: PlayedMark | null, name = ''): void {
    this.played = mark;
    this.playedName?.destroy();
    this.playedName = null;
    if (mark && this.onPage(mark.system)) {
      const S = this.layout.staffSpace;
      const style = { fontFamily: STAFF_FONT, fontStyle: 'bold', fontSize: `${Math.round(S * 1.1)}px`, color: PLAYED_INK };
      this.playedName = this.scene.add.text(this.origin.x + mark.x, this.origin.y + mark.y + PLAYED_NAME_GAP * S, name, style).setOrigin(0.5).setAlpha(PLAYED_ALPHA);
    }
    this.drawNotes();
  }

  /** The played key's name, for tests: null when none is shown. */
  get playedShown(): string | null {
    return this.playedName?.text ?? null;
  }

  private drawPlayed(): void {
    const mark = this.played;
    if (!mark || !this.onPage(mark.system)) return;
    const g = this.notesGfx;
    const color = this.theme.wrong;
    g.lineStyle(this.lineWidth(), this.theme.ink, PLAYED_ALPHA);
    for (const ledger of mark.ledgerLines) g.lineBetween(ledger.x1, ledger.y, ledger.x2, ledger.y);
    g.fillStyle(color, PLAYED_ALPHA).fillEllipse(mark.x, mark.y, mark.rx * 2, mark.ry * 2);
    if (mark.accidental !== null) {
      g.setAlpha(PLAYED_ALPHA);
      this.drawAccidental(g, mark.accidental, mark.x - mark.rx * 2.4, mark.y, color);
      g.setAlpha(1);
    }
  }

  /** The graces drawn on the page shown and where each head was drawn (for tests). */
  get gracesShown(): readonly { index: number; x: number; y: number; slash: boolean }[] {
    return this.gracesDrawn;
  }

  /**
   * A grace note (core_09.AC32, d121): its ledger lines, a small filled head, its small accidental, its stem, and for a
   * slashed one a flag and the slash across the stem, all where the layout put them and at its `scale`. A grace is never
   * awaited or judged, so it keeps the ink colour, and turns grey like the notes once the playhead has passed it.
   */
  private drawGrace(grace: GraceGlyph): void {
    const S = this.layout.staffSpace;
    const k = grace.scale;
    const g = this.notesGfx;
    const color = this.isPast(grace.system, grace.x) ? PAST_GREY : this.theme.ink;
    g.lineStyle(this.lineWidth(), this.theme.ink, 1);
    for (const ledger of grace.ledgerLines) g.lineBetween(ledger.x1, ledger.y, ledger.x2, ledger.y);
    g.fillStyle(color, 1).fillEllipse(grace.x, grace.y, grace.headRx * 2, grace.headRy * 2);
    if (grace.accidental) this.drawAccidental(g, grace.accidental.alter, grace.accidental.x, grace.accidental.y, color, k);
    const stem = grace.stem;
    const thin = Math.max(1.5, S * 0.13 * k);
    g.lineStyle(thin, color, 1).lineBetween(stem.x, stem.y1, stem.x, stem.y2);
    if (grace.flag) this.drawFlagAt(stem, color, k);
    if (grace.slash) g.lineStyle(thin, color, 1).lineBetween(grace.slash.x1, grace.slash.y1, grace.slash.x2, grace.slash.y2);
    this.gracesDrawn.push({ index: grace.index, x: grace.x, y: grace.y, slash: grace.slash !== null });
  }

  /** A sharp, flat or natural centred on (cx, cy), drawn from its strokes (`ACCIDENTAL_STROKES`), at `scale` of its size (a grace's is smaller). */
  private drawAccidental(g: Phaser.GameObjects.Graphics, alter: number, cx: number, cy: number, color: number, scale = 1): void {
    const S = this.layout.staffSpace * scale;
    for (const stroke of ACCIDENTAL_STROKES[accidentalKind(alter)]) {
      g.lineStyle(Math.max(scale < 1 ? 1.5 : 2, stroke.width * S), color, 1).beginPath();
      stroke.points.forEach((p, i) => (i === 0 ? g.moveTo(cx + p.x * S, cy + p.y * S) : g.lineTo(cx + p.x * S, cy + p.y * S)));
      g.strokePath();
    }
  }

  /** A flag at the tip of an eighth's (or a slashed grace's) stem: a curl that falls away to the right (stem up) or rises (stem down), at `scale` of its size. */
  private drawFlagAt(stem: { x: number; y2: number; up: boolean }, color: number, scale = 1): void {
    const S = this.layout.staffSpace * scale;
    const g = this.notesGfx;
    const dir = stem.up ? 1 : -1; // the flag hangs down from an up stem, and sweeps up from a down stem
    g.lineStyle(Math.max(scale < 1 ? 1.5 : 2, S * 0.2), color, 1).beginPath();
    g.moveTo(stem.x, stem.y2);
    g.lineTo(stem.x + S * 0.45, stem.y2 + dir * S * 0.55);
    g.lineTo(stem.x + S * 0.85, stem.y2 + dir * S * 1.35);
    g.lineTo(stem.x + S * 0.55, stem.y2 + dir * S * 2.0);
    g.strokePath();
  }

  /** A tie: a quadratic curve that bows away from the heads (core_09.AC10), drawn as a polyline in the ink colour. */
  private drawTie(tie: TieGlyph): void {
    const S = this.layout.staffSpace;
    strokePolyline(this.notesGfx.lineStyle(Math.max(2, S * 0.13), this.theme.ink, 1), tiePoints(tie));
  }

  /** A slur (core_09.AC27): a quadratic curve from the first head to the last, in the ink colour, bowing as the layout says. */
  private drawSlur(slur: SlurGlyph): void {
    const S = this.layout.staffSpace;
    strokePolyline(this.notesGfx.lineStyle(Math.max(2, S * 0.1), this.theme.ink, 1), slurPoints(slur));
  }

  /** The beams of a run of eighths and sixteenths, in the colour of its notes once all are right. */
  private drawBeam(beam: BeamGlyph): void {
    const S = this.layout.staffSpace;
    const slots = beam.notes.map((index) => this.layout.notes.findIndex((n) => n.index === index));
    const wrong = beam.notes.some((index) => this.wrong.has(index));
    const correct = slots.every((slot) => this.states[slot] === 'correct');
    const color = this.resting(beam.system, beam.staff) ? PAST_GREY : wrong ? this.theme.wrong : correct ? this.theme.correct : this.theme.ink;
    const half = Math.max(2, S * 0.13) / 2;
    const top = beam.up ? beam.y : beam.y - beam.thickness;
    this.notesGfx.fillStyle(color, 1).fillRect(beam.x1 - half, top, beam.x2 - beam.x1 + half * 2, beam.thickness);
    for (const second of beam.secondary) {
      const y = beam.up ? second.y : second.y - beam.thickness;
      this.notesGfx.fillRect(second.x1 - half, y, second.x2 - second.x1 + half * 2, beam.thickness);
    }
  }

  /** A triplet's small 3, on its beam or in the gap of its bracket, the bracket's ends hooked toward the notes (core_09.AC50). */
  private drawTuplet(tuplet: TupletGlyph): void {
    const g = this.notesGfx;
    const { number, bracket } = tuplet;
    if (bracket) {
      const gap = number.height * 0.6; // half the gap the 3 sits in: half its width and a little room
      g.lineStyle(this.lineWidth(), this.theme.ink, 1);
      g.lineBetween(bracket.x1, bracket.y + bracket.hook, bracket.x1, bracket.y);
      g.lineBetween(bracket.x1, bracket.y, number.x - gap, bracket.y);
      g.lineBetween(number.x + gap, bracket.y, bracket.x2, bracket.y);
      g.lineBetween(bracket.x2, bracket.y, bracket.x2, bracket.y + bracket.hook);
    }
    this.drawNumber(g, 3, number.x, number.y, number.height);
  }

  /**
   * A highlight box around the awaited note on its own staff, and an arrow on the outer side so it never relies on colour alone.
   * The box is drawn on its own layer between the paper and the staff lines, so the lines and ledger lines always show through it.
   */
  private drawCursor(n: NoteGlyph): void {
    const S = this.layout.staffSpace;
    const staff = this.layout.systems[n.system]!.staves[n.staff]!;
    const halfWidth = S * 1.25;
    // the box takes in the chord's accidentals, which stand left of the heads
    const left = n.accidentalLeft === null ? n.column - halfWidth : Math.min(n.column - halfWidth, n.accidentalLeft - 0.3 * S);
    this.cursorGfx.fillStyle(this.theme.cursorFill, 1).fillRoundedRect(left, staff.topLineY - 1.2 * S, n.column + halfWidth - left, 6.4 * S, S * 0.4);
    // The arrow is drawn on the notes layer (cleared with it in drawNotes), so it keeps full alpha.
    const a = this.notesGfx;
    const tipY = staff.arrow.tipY;
    a.fillStyle(this.theme.cursor, 1);
    if (staff.arrow.direction === 'up') a.fillTriangle(n.column, tipY - S * 0.9, n.column - S * 0.6, tipY, n.column + S * 0.6, tipY);
    else a.fillTriangle(n.column, tipY + S * 0.9, n.column - S * 0.6, tipY, n.column + S * 0.6, tipY);
  }
}
