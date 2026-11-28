/**
 * A chart as a piece of the piece maker (ft_Y_04 slice 3, photo import): what the editor can hold comes in note for note;
 * what it cannot is listed with its bar and beat, never dropped silently. The converter keeps every note that fits and
 * leaves the rest out, so a person fixes the few listed places by hand; a caller that must refuse (the game importer,
 * slice 2) refuses when `problems` is not empty. Pure.
 *
 * Refused for the whole piece (no piece comes back): no hand to play, two parts for one hand, a meter other than 2/4, 3/4
 * or 4/4, a meter or key change. Per note: a length the editor has no button for (thirty-second,
 * triplet, double dot), a start off the sixteenth grid, a note across a bar line, a double sharp or flat, a key off the EZ-220, two rhythms
 * at once in one hand; past the editor's last bar. Tempo changes and voices in unison are only warned about.
 */
import { PPQ } from '../chart/time';
import type { Chart, ChartNote } from '../chart/schema';
import {
  barLength, BPM_MAX, BPM_MIN, LENGTH_TICKS, MAX_BARS, TITLE_MAX, emptyPiece, placeNote,
  type EditorHand, type EditorHands, type EditorLength, type EditorNote, type EditorPiece, type NoteRef, type Refusal,
} from './model';
import { setGrace } from './graces';
import { tieTargetOf } from './ties';
import { slurShapeProblem } from './slurRules';

/** A place the editor cannot hold: the bar as printed (1 is the first), the beat inside it (1 is the first, 2.5 the "and" of 2). */
export interface ImportProblem {
  bar: number;
  beat: number;
  hand: EditorHand;
  what: string;
}

export type FromChartResult =
  | { ok: true; piece: EditorPiece; problems: ImportProblem[]; warnings: string[] }
  | { ok: false; reason: string };

const LENGTH_BY_TICKS = new Map<number, EditorLength>(
  (Object.entries(LENGTH_TICKS) as [EditorLength, number][]).map(([length, ticks]) => [ticks, length]),
);

/** Names of the lengths the editor has no button for, so the person knows what to look for on the paper. */
const LENGTH_NAMES: Readonly<Record<number, string>> = {
  [PPQ / 8]: 'a thirty-second',
  [PPQ / 3]: 'a triplet eighth',
  [(PPQ * 2) / 3]: 'a triplet quarter',
  [PPQ / 6]: 'a triplet sixteenth',
  [PPQ * 3.5]: 'a double-dotted half',
  [PPQ * 6]: 'a dotted whole',
  [PPQ * 8]: 'a breve',
};

const REFUSAL_WORDS: Partial<Record<Refusal, string>> = {
  'bar-line': 'a note across a bar line',
  'no-room': 'two rhythms at once in one hand (a second voice)',
  range: 'a key outside C2 to C7',
  grid: 'a note that does not start on a sixteenth',
  'grace-chord': 'a grace note before a chord',
  pickup: 'a pick-up the piece maker cannot hold',
  'grace-tie': 'a grace note on a tied note',
  'grace-pitch': 'a grace note of its own pitch',
  'slur-target': 'a slur whose ends were not taken',
  'slur-overlap': 'a slur over another slur',
};

/** The beat of a tick inside its bar: 1 for the first quarter, 2.5 for the eighth after beat 2. */
export function beatOf(startInBar: number): number {
  return Math.round((startInBar / PPQ + 1) * 1000) / 1000;
}

/** "bar 5, beat 2.5": how a problem is shown to the person. */
export function problemLabel(p: ImportProblem): string {
  return `bar ${p.bar}, beat ${p.beat} (${p.hand === 'RH' ? 'right hand' : 'left hand'}): ${p.what}`;
}

/** How the chart's frame becomes the editor's: hands, meter, key, bars and tempo, or why it cannot. */
type Frame = { handOf: Map<string, EditorHand>; piece: EditorPiece; bars: number; bar: number };

function frameOf(chart: Chart, title: string, warnings: string[]): Frame | { reason: string } {
  const handOf = new Map<string, EditorHand>();
  const withNotes = new Set(chart.notes.map((n) => n.track));
  for (const track of chart.tracks) {
    if (track.role !== 'play' || track.hand === null || !withNotes.has(track.id)) continue;
    if ([...handOf.values()].includes(track.hand)) return { reason: `two parts for the ${track.hand === 'RH' ? 'right' : 'left'} hand: the piece maker holds one staff per hand` };
    handOf.set(track.id, track.hand);
  }
  const handless = chart.notes.filter((n) => !handOf.has(n.track)).length;
  if (handless > 0) warnings.push(`${plural(handless, 'note', 'notes')} on a part for no hand (an accompaniment or a click) left out`);
  const played = new Set(chart.notes.filter((n) => handOf.has(n.track)).map((n) => handOf.get(n.track)!));
  if (played.size === 0) return { reason: 'no notes for either hand' };
  const hands: EditorHands = played.size === 2 ? 'both' : [...played][0]!;

  if (chart.meterMap.length > 1) return { reason: 'the meter changes inside the piece' };
  const meter = chart.meterMap[0]!;
  if (meter.den !== 4 || ![2, 3, 4].includes(meter.num)) return { reason: `the meter ${meter.num}/${meter.den}: the piece maker writes 2/4, 3/4 or 4/4` };
  const beats = meter.num as 2 | 3 | 4;
  if (chart.keyMap.length > 1) return { reason: 'the key changes inside the piece' };
  const key = chart.keyMap[0]!;
  const bar = beats * PPQ;

  const bars = Math.min(chart.bars.length, MAX_BARS);
  if (chart.bars.length > MAX_BARS) warnings.push(`the piece has ${chart.bars.length} bars; the piece maker holds ${MAX_BARS}, so bars ${MAX_BARS + 1} to ${chart.bars.length} were left out`);
  const written = chart.tempoMap[0]!.bpm;
  const bpm = Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, written)));
  if (chart.tempoMap.length > 1) warnings.push(`the tempo changes ${chart.tempoMap.length - 1} times; the piece keeps the first tempo (${bpm})`);
  else if (bpm !== Math.round(written)) warnings.push(`the tempo ${written} is outside ${BPM_MIN} to ${BPM_MAX}, so it became ${bpm}`);
  // a pick-up of whole beats whose last bar holds the rest of its bar is the piece maker's own pick-up (core_09.AC30)
  const first = chart.bars[0]!;
  const lastBar = chart.bars[chart.bars.length - 1]!;
  const short = bar - (first.endTick - first.startTick);
  const pickup = short > 0 && short % PPQ === 0 && bars >= 2 && chart.bars.length <= MAX_BARS && lastBar.endTick - lastBar.startTick === short
    ? { pickup: (bar - short) / PPQ } : {};
  const piece: EditorPiece = { ...emptyPiece({ title, hands, beats, bars }), bpm, fifths: key.fifths, mode: key.mode, ...pickup };
  return { handOf, piece, bars, bar };
}

const plainAlter = (alter: number): alter is -1 | 0 | 1 => alter === -1 || alter === 0 || alter === 1;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Takes the chart into the frame's piece a part at a time, listing what it cannot take. */
class Taker {
  readonly problems: ImportProblem[] = [];
  piece: EditorPiece;

  constructor(private readonly chart: Chart, private readonly frame: Frame, private readonly warnings: string[]) {
    this.piece = frame.piece;
  }

  private barAt(tick: number): number {
    return Math.max(0, this.chart.bars.findIndex((b) => b.startTick <= tick && tick < b.endTick));
  }

  /**
   * Where a tick lies in its bar of the piece. A short first bar (a pick-up, or a bar the recogniser read a beat short) becomes
   * a whole bar with its notes at its end, as a pick-up is played: the last beats of a bar. A later short bar keeps its notes
   * from its start (the MusicXML reader keeps those whole). The first bar is named to check by hand (`shortFirstBar`).
   * A pick-up the piece maker can write keeps its own length (core_09.AC30).
   */
  private startIn(bar: number, tick: number): number {
    const b = this.chart.bars[bar]!;
    const short = this.frame.bar - (b.endTick - b.startTick);
    return tick - b.startTick + (bar === 0 && short > 0 && this.piece.pickup === undefined ? short : 0);
  }

  private problem(hand: EditorHand, bar: number, tick: number, what: string): void {
    this.problems.push({ bar: bar + 1, beat: beatOf(this.startIn(bar, tick)), hand, what });
  }

  /** A short first bar, for each hand with notes in it: taken as a whole bar with its notes at the end, to check against the sheet. */
  shortFirstBar(): void {
    const first = this.chart.bars[0]!;
    const length = first.endTick - first.startTick;
    if (length >= this.frame.bar || this.piece.pickup !== undefined) return;
    const { handOf } = this.frame;
    const hands = new Set(this.chart.notes.filter((n) => n.bar === 0 && handOf.has(n.track)).map((n) => handOf.get(n.track)!));
    const what = `the bar holds ${length / PPQ} beats, not ${this.frame.bar / PPQ}: its notes were put at the end of a whole bar, as a pick-up is played; check it`;
    for (const hand of hands) this.problems.push({ bar: 1, beat: 1, hand, what });
  }

  notes(): void {
    const { handOf, bars, bar } = this.frame;
    // a bar longer than the meter (the recogniser read a note too many, or a wrong length): its notes are not taken
    const tooLong = new Set(this.chart.bars.filter((b) => b.endTick - b.startTick > bar).map((b) => b.index));
    const flagged = new Set<string>();
    let unisons = 0;
    let pastEnd = 0;
    const notes = this.chart.notes.filter((n) => handOf.has(n.track)).sort((a, b) => a.tick - b.tick || a.voice - b.voice || a.midi - b.midi);
    for (const n of notes) {
      const hand = handOf.get(n.track)!;
      if (n.bar >= bars) pastEnd++;
      else if (!tooLong.has(n.bar)) unisons += this.note(n, hand);
      else if (!flagged.has(`${hand}${n.bar}`)) {
        flagged.add(`${hand}${n.bar}`);
        const b = this.chart.bars[n.bar]!;
        this.problem(hand, n.bar, b.startTick, `the bar holds ${(b.endTick - b.startTick) / PPQ} beats, not ${bar / PPQ}: its notes were not taken`);
      }
    }
    if (unisons > 0) this.warnings.push(`${plural(unisons, 'note', 'notes')} sounding the same key twice in one hand at once were taken once`);
    if (pastEnd > 0) this.warnings.push(`${plural(pastEnd, 'note', 'notes')} past bar ${MAX_BARS} left out`);
  }

  /** One note; 1 when it was a unison taken once, else 0. */
  private note(n: ChartNote, hand: EditorHand): number {
    const start = this.startIn(n.bar, n.tick);
    const length = LENGTH_BY_TICKS.get(n.dur);
    const alter = n.spelling.alter;
    let what: string | null = null;
    if (length === undefined) what = `${LENGTH_NAMES[n.dur] ?? `a note of ${n.dur} ticks`}, which the piece maker has no button for`;
    else if (start + n.dur > barLength(this.piece, n.bar)) what = REFUSAL_WORDS['bar-line']!;
    else if (!plainAlter(alter)) what = `a double ${alter > 0 ? 'sharp' : 'flat'}`;
    else {
      const placed = placeNote(this.piece, {
        hand, bar: n.bar, start, length, step: n.spelling.step, octave: n.spelling.octave, alter,
        ...(n.finger === undefined ? {} : { finger: n.finger }),
        ...(n.dynamic === undefined ? {} : { dynamic: n.dynamic }),
        ...(n.tieNext ? { tieNext: true } : {}),
      });
      if (placed.ok) this.piece = placed.piece;
      else if (placed.reason === 'duplicate') return 1;
      else what = REFUSAL_WORDS[placed.reason] ?? placed.reason;
    }
    if (what !== null) this.problem(hand, n.bar, n.tick, what);
    return 0;
  }

  /** A tie whose next note did not come in is taken away, and said so. */
  ties(): void {
    for (const note of this.piece.notes.filter((x) => x.tieNext)) {
      if (tieTargetOf(this.piece, note) !== null) continue;
      this.piece = { ...this.piece, notes: this.piece.notes.map((x) => (x === note ? untied(x) : x)) };
      this.problems.push({ bar: note.bar + 1, beat: beatOf(note.start), hand: note.hand, what: 'a tie whose next note was not taken' });
    }
  }

  graces(): void {
    const all = this.chart.graces ?? [];
    for (const g of all) {
      const hand = this.frame.handOf.get(g.track);
      const bar = this.barAt(g.tick);
      if (!hand || bar >= this.frame.bars) continue;
      // the piece maker writes one grace a note: a group (core_09.AC60) is reported once, on its first grace, and not taken
      const group = all.filter((o) => o.track === g.track && o.voice === g.voice && o.tick === g.tick);
      if (group.length > 1) {
        if (group[0] === g) this.problem(hand, bar, g.tick, 'a group of grace notes');
        continue;
      }
      const start = this.startIn(bar, g.tick);
      const main = this.piece.notes.find((x) => x.hand === hand && x.bar === bar && x.start === start);
      const alter = g.pitch.spelling.alter;
      if (!main) { this.problem(hand, bar, g.tick, 'a grace note whose main note was not taken'); continue; }
      if (!plainAlter(alter)) { this.problem(hand, bar, g.tick, 'a grace note with a double sharp or flat'); continue; }
      const edit = setGrace(this.piece, refOf(main), { step: g.pitch.spelling.step, octave: g.pitch.spelling.octave, alter, slash: g.slash });
      if (edit.ok) this.piece = edit.piece;
      else this.problem(hand, bar, g.tick, REFUSAL_WORDS[edit.reason] ?? edit.reason);
    }
  }

  /** The piece maker cannot write an ornament sign yet (core_09.AC66): each is reported, its note taken plain. */
  ornaments(): void {
    for (const o of this.chart.ornaments ?? []) {
      const hand = this.frame.handOf.get(o.track);
      const bar = this.barAt(o.tick);
      if (hand && bar < this.frame.bars) this.problem(hand, bar, o.tick, 'an ornament sign (trill, mordent or turn)');
    }
  }

  slurs(): void {
    const onset = (tick: number) => ({ bar: this.barAt(tick), start: this.startIn(this.barAt(tick), tick) });
    for (const s of this.chart.slurs ?? []) {
      const hand = this.frame.handOf.get(s.track);
      const slur = { hand: hand ?? 'RH', from: onset(s.startTick), to: onset(s.endTick) };
      if (!hand || slur.to.bar >= this.frame.bars) continue;
      const refusal = slurShapeProblem(this.piece, slur);
      if (refusal) this.problem(hand, slur.from.bar, s.startTick, REFUSAL_WORDS[refusal] ?? refusal);
      else this.piece = { ...this.piece, slurs: [...(this.piece.slurs ?? []), slur] };
    }
  }

  repeats(): void {
    const repeats = (this.chart.repeats ?? []).filter((r) => r.endBar < this.frame.bars);
    if (repeats.length > 0) this.piece = { ...this.piece, repeats };
  }
}

/** The chart as an editor piece, or why it cannot be one at all. */
/**
 * `pickup`: the short first bar is a pick-up known from the whole score (a book's movement whose last bar holds the rest of
 * its bar, ft_Y_04.AC28): taken as a whole bar with its notes at the end, as a pick-up is played, and not listed to check.
 */
export function fromChart(chart: Chart, options: { title?: string; pickup?: boolean } = {}): FromChartResult {
  const warnings: string[] = [];
  const title = (options.title ?? chart.title).trim().slice(0, TITLE_MAX) || 'Imported piece';
  const frame = frameOf(chart, title, warnings);
  if ('reason' in frame) return { ok: false, reason: frame.reason };
  const taker = new Taker(chart, frame, warnings);
  taker.notes();
  if (!options.pickup) taker.shortFirstBar();
  taker.ties();
  taker.graces();
  taker.ornaments();
  taker.slurs();
  taker.repeats();
  const problems = [...taker.problems].sort((a, b) => a.bar - b.bar || a.beat - b.beat || a.hand.localeCompare(b.hand));
  return { ok: true, piece: taker.piece, problems, warnings };
}

function untied(note: EditorNote): EditorNote {
  const copy = { ...note };
  delete copy.tieNext;
  return copy;
}

function refOf(note: EditorNote): NoteRef {
  return { hand: note.hand, bar: note.bar, start: note.start, step: note.step, octave: note.octave };
}

