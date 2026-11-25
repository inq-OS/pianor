import { PPQ, spellingToMidi, type Spelling } from '../chart';
import { keyAlters } from '../chart/key';
import { isDynamic, type Dynamic } from '../chart/dynamics';
import { ABC_ORNAMENTS, neighbourLetter, usesLower, usesUpper, type OrnamentKind } from '../chart/ornaments';
import { MAX_GRACE_GROUP } from '../chart/schema';

/** Key signatures by name, for K: lines. Major keys: C G D A E B F# C# F Bb Eb Ab Db Gb Cb. */
const MAJOR_KEYS: Record<string, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
/** Minor keys by tonic; the signature is the one of the relative major. */
const MINOR_KEYS: Record<string, number> = { A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7, D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7 };

/** Reads a K: name such as `C`, `Cmaj`, `G`, `F#m`, `Bb`, `Dmin`: its signature (fifths) and mode. Undefined for anything else (modes such as Dor). */
export function readKey(name: string): { fifths: number; mode: 'major' | 'minor' } | undefined {
  const m = /^([A-G][#b]?)(maj|major|min|minor|m)?$/.exec(name);
  if (!m) return undefined;
  const minor = ['min', 'minor', 'm'].includes(m[2] ?? '');
  const fifths = (minor ? MINOR_KEYS : MAJOR_KEYS)[m[1]!];
  return fifths === undefined ? undefined : { fifths, mode: minor ? 'minor' : 'major' };
}

/** Reads an accidental before a note: ^ sharp, ^^ double sharp, _ flat, __ double flat, = natural. `alter` is undefined when none is written. */
const readAccidental = (s: string, from: number): { alter: number | undefined; next: number } => {
  if (s[from] === '^') return s[from + 1] === '^' ? { alter: 2, next: from + 2 } : { alter: 1, next: from + 1 };
  if (s[from] === '_') return s[from + 1] === '_' ? { alter: -2, next: from + 2 } : { alter: -1, next: from + 1 };
  if (s[from] === '=') return { alter: 0, next: from + 1 };
  return { alter: undefined, next: from };
};
import type { Diagnostic } from './diagnostics';

/**
 * A strict reader for the beginner subset of ABC notation (docs/authoring/au02-abc-subset.md).
 * Anything outside the subset is an error with a line and column, never silently accepted:
 * tuplets other than triplets, chord symbols, other decorations, key changes.
 * It turns text into notes and rests on a tick timeline; checking against a level is the linter's job.
 */

export const SUPPORTED_METERS = ['4/4', '3/4', '2/4'] as const;
const WHOLE_NOTE_TICKS = PPQ * 4;

export interface AbcNote {
  midi: number;
  spelling: Spelling;
  finger?: number;
  /** Tied to the next note of the same pitch. */
  tieNext?: boolean;
  /** A dynamic mark written before this note (or chord): it holds from here on (core_09.AC14). */
  dynamic?: Dynamic;
}

/** A grace note written before a note: no length (core_09.AC31, d121); `{gab}C` writes a group of them (core_09.AC60). `slash` is `{/g}`. */
export interface AbcGrace {
  note: AbcNote;
  slash: boolean;
  line: number;
  column: number;
}

/** An ornament sign on a note (`!trill!C`, core_09.AC60, d305), with the neighbour notes it uses, spelled in the key and bar. */
export interface AbcOrnament {
  kind: OrnamentKind;
  upper?: AbcNote;
  lower?: AbcNote;
}

export type AbcItem =
  | { kind: 'notes'; tick: number; dur: number; notes: AbcNote[]; line: number; column: number; graces?: AbcGrace[]; ornament?: AbcOrnament; voice?: 2 }
  | { kind: 'rest'; tick: number; dur: number; line: number; column: number; voice?: 2 };

export interface AbcVoice {
  /** Voice id as written ("RH", "LH", "ACC"), or "" for a piece without V: lines. */
  id: string;
  clef?: 'treble' | 'bass';
  items: AbcItem[];
  /** Complete bars in this voice. */
  bars: number;
  /** The ticks of a short first bar, a pick-up (d120); 0 without one. The next bar starts here. */
  pickup: number;
  /** Where the music ends: the end of the last bar, which may be short (d120). */
  endTick: number;
  /**
   * Repeats as written (`|:` to `:|`), 0-based bars, in order (core_09.AC17); with first and second endings (`|1`, `:|2`)
   * the repeat ends with the first ending and the second follows it (core_09.AC45).
   */
  repeats: AbcRepeat[];
  /** Slurs as written (`(` to `)`), from the first note to the last note's start, in ticks (core_09.AC26); `voice: 2` in an overlay. */
  slurs: { startTick: number; endTick: number; voice?: 2 }[];
  /** Triplets as written (`(3` and three notes, chords or rests of one length), from the first member's start to the last's (core_09.AC49, d163); `voice: 2` in an overlay. */
  tuplets: { startTick: number; endTick: number; voice?: 2 }[];
  /** Where the V: line was written. */
  line: number;
}

/** Bars from `startBar` to `endBar`, 0-based, both included. */
export interface BarSpan {
  startBar: number;
  endBar: number;
}

/** A written repeat (core_09.AC17), with its first and second endings when it has them (core_09.AC45). */
export interface AbcRepeat extends BarSpan {
  endings?: { first: BarSpan; second: BarSpan };
}

export interface ParsedAbc {
  title?: string;
  meter?: { num: number; den: number };
  /** Quarter-note beats per minute. */
  bpm?: number;
  /** The K: signature; C major when the piece has none yet. */
  key: { fifths: number; mode: 'major' | 'minor' };
  voices: AbcVoice[];
  diagnostics: Diagnostic[];
}

/** Info fields that carry no music and are ignored. */
const IGNORED_FIELDS = new Set(['X', 'C', 'N', 'Z', 'S', 'R', 'H', 'B', 'D', 'G', 'O', 'W', 'w', 'I', 'U', 'A', 'F', 'P', 's', 'm', 'r']);

/** What each voice of one hand keeps for itself: where it is in time, and its open tie, slur and accidentals (d164). */
interface Layer {
  tick: number;
  barErrored: boolean;
  pendingTie: { midis: number[]; pitches: string[]; line: number; column: number } | null;
  openSlur: { line: number; column: number; startTick: number | null } | null;
  /** The triplet a `(3` opened, until its third member (core_09.AC49): the written length of its members and how many are in. */
  openTuplet: { line: number; column: number; startTick: number; written: number; count: number } | null;
  accidentals: Map<string, number>;
}

const newLayer = (): Layer => ({ tick: 0, barErrored: false, pendingTie: null, openSlur: null, openTuplet: null, accidentals: new Map() });

/** Keep the accidentals of the pitches a tie carries into the next bar (core_09.AC11), forget the rest. */
function carryAccidentals(layer: Layer): void {
  const carried = new Map<string, number>();
  for (const pitch of layer.pendingTie?.pitches ?? []) {
    const alter = layer.accidentals.get(pitch);
    if (alter !== undefined) carried.set(pitch, alter);
  }
  layer.accidentals.clear();
  for (const [pitch, alter] of carried) layer.accidentals.set(pitch, alter);
}

interface VoiceState extends AbcVoice, Layer {
  /** 2 between a `&` and the next bar line: the music goes to voice 2 of this hand (core_09.AC52, d164). */
  layer: 1 | 2;
  /** Voice 1's own state while voice 2 is written; voice 2's state between overlays. */
  other: Layer;
  /** This bar has an overlay; `mainFilled` is how much voice 1 holds in it. */
  overlaid: boolean;
  mainFilled: number;
  /** Bars shorter than the meter, where their bar line is: only a pick-up (the first) or the last may be short (d120). */
  shortBars: { bar: number; filled: number; line: number; column: number }[];
  /** The last bar closed so far, to check at the end that it and a pick-up make one whole bar (d120). */
  lastBar: { filled: number; errored: boolean; line: number; column: number } | null;
  barStart: number;
  /** The bar a `|:` opened, until its `:|`. */
  repeatOpen: number | null;
  /** The ending being read (core_09.AC45): a first one until its `:|`, a second one until `||`, `|]` or `|:` (or one bar). */
  ending: { n: 1 | 2; startBar: number; first?: BarSpan; repeat?: number; line: number; column: number } | null;
  /** A first ending closed by its `:|`, until the second ending opens right after it. */
  awaitSecond: { first: BarSpan; repeat: number; line: number; column: number } | null;
  /*
   * From Layer: `openSlur` is the slur a `(` opened, until its `)` (`startTick` set by the first note after it,
   * core_09.AC26); `accidentals` are those written in this bar, by pitch (step and octave, e.g. F#4 is "F4"), to the bar line.
   */
  /** Each triplet read, where it starts in its bar, to check once the pick-up is known that it starts on a beat. */
  tupletStarts: { bar: number; offset: number; line: number; column: number }[];
}

/** The written lengths a triplet's members may have: eighths (one beat for three) and quarters (two beats), AX-3 provisional (d163). */
const TUPLET_LENGTHS: readonly number[] = [PPQ / 2, PPQ];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

type Finger = { value: number; column: number };
type DynamicMark = { value: Dynamic; column: number };
type GraceMark = { notes: AbcNote[]; slash: boolean; column: number };
type OrnamentMark = { kind: OrnamentKind; column: number };

/** What a line of music needs from the parser around it: error reports, and the helpers that keep a voice on its bar grid. */
interface MusicHost {
  error(line: number, column: number, message: string): void;
  closeBar(voice: VoiceState, line: number, column: number): void;
  readLength(s: string, from: number, line: number): { dur: number | null; next: number };
  spellNote(voice: VoiceState, note: AbcNote, written: number | undefined): AbcNote;
  addItem(voice: VoiceState, item: AbcItem, line: number, column: number): void;
  startOverlay(voice: VoiceState, line: number, column: number): void;
}

/** Scans one line of music into a voice: a position in the line and the fingering waiting for its note. */
class MusicLine {
  private i = 0;
  private finger: Finger | undefined;
  private dynamic: DynamicMark | undefined;
  /** A grace note (or group) read, waiting for the note it goes before. */
  private grace: GraceMark | undefined;
  /** An ornament sign read, waiting for its note. */
  private ornament: OrnamentMark | undefined;

  constructor(
    private readonly host: MusicHost,
    private readonly voice: VoiceState,
    private readonly s: string,
    private readonly line: number,
    private readonly barTicks: number,
  ) {}

  scan(): void {
    while (this.i < this.s.length && this.readToken());
    this.flushFinger('a fingering needs a note after it');
    this.flushDynamic();
    this.flushGrace();
  }

  private error(column: number, message: string): void {
    this.host.error(this.line, column, message);
  }

  private unsupported(column: number, what: string): void {
    this.error(column, `${what} is not supported`);
  }

  /** Report a fingering that found no note to go on, and drop it. */
  private flushFinger(message: string): void {
    if (this.finger) this.error(this.finger.column, message);
    this.finger = undefined;
  }

  /** Report a dynamic mark that found no note to go on, and drop it. */
  private flushDynamic(): void {
    if (this.dynamic) this.error(this.dynamic.column, 'a dynamic mark needs a note after it');
    this.dynamic = undefined;
  }

  /** Report a grace note that found no note to go before (a bar line or the end of the line), and drop it. */
  private flushGrace(): void {
    if (this.grace) this.error(this.grace.column, 'a grace note needs a note after it');
    this.grace = undefined;
    if (this.ornament) this.error(this.ornament.column, 'an ornament needs a note after it');
    this.ornament = undefined;
  }

  /** The ornament sign waiting for the next note, if any; it is taken by that note or refused. */
  private takeOrnament(): OrnamentMark | undefined {
    const o = this.ornament;
    this.ornament = undefined;
    return o;
  }

  /** The grace note waiting for the next note, if any; it is taken by that note or refused. */
  private takeGrace(): GraceMark | undefined {
    const g = this.grace;
    this.grace = undefined;
    return g;
  }

  /**
   * `{g}C` (plain) or `{/g}C` (slashed): a note in the braces, before the main note (core_09.AC31, d121); `{gfg}C` is a
   * group of up to `MAX_GRACE_GROUP`, played in the order written (core_09.AC60). The letters are notes, so `g` is G5.
   * Anything else in the braces, two of one pitch in a row, and a second pair of braces on one note, are refused.
   */
  private readGrace(): void {
    const { s } = this;
    const column = this.i + 1;
    const close = s.indexOf('}', this.i);
    if (close < 0) {
      this.error(column, 'a grace note must end with "}"');
      this.i = s.length;
      return;
    }
    const body = s.slice(this.i + 1, close);
    this.i = close + 1;
    const slash = body.startsWith('/');
    const notes: AbcNote[] = [];
    let k = slash ? 1 : 0;
    while (k < body.length) {
      if (body[k] === ' ') {
        k++;
        continue;
      }
      if (/[0-9/]/.test(body[k]!)) {
        this.error(column, 'a grace note has no length (write the length on the main note)');
        return;
      }
      const acc = readAccidental(body, k);
      const p = readPitch(body, acc.next);
      if (!p) {
        this.error(column, `"${body[k]}" is not allowed in a grace note (write notes in the braces)`);
        return;
      }
      notes.push(this.host.spellNote(this.voice, p.note, acc.alter));
      k = p.next;
    }
    if (notes.length === 0 || notes.length > MAX_GRACE_GROUP) {
      this.error(column, notes.length === 0 ? 'a grace note needs a note in the braces' : `a grace group takes at most ${MAX_GRACE_GROUP} notes`);
      return;
    }
    if (notes.some((n, j) => j > 0 && n.midi === notes[j - 1]!.midi)) {
      this.error(column, 'two grace notes in a row cannot have one pitch');
      return;
    }
    if (this.grace) {
      this.error(column, 'a note takes one grace group: write its notes in one pair of braces');
      return;
    }
    this.grace = { notes, slash, column };
  }

  /** The dynamic written before the next note or chord, if any. */
  private takeDynamic(): Dynamic | undefined {
    const d = this.dynamic?.value;
    this.dynamic = undefined;
    return d;
  }

  private takeFinger(): number | undefined {
    const f = this.finger?.value;
    this.finger = undefined;
    return f;
  }

  /** Read one token at the position. False stops the line (a broken decoration or chord). */
  private readToken(): boolean {
    const { s, i } = this;
    const ch = s[i]!;
    if (ch === ' ' || ch === '\t') this.i++;
    else if (ch === '|' || (ch === '[' && s[i + 1] === '|')) this.readBarLine();
    else if (ch === '[' && /[0-9]/.test(s[i + 1] ?? '')) this.i = this.readEnding(i);
    else if (ch === ':') this.readRepeatEnd();
    else if (ch === '!') return this.readDecoration();
    else if (ch === '[') return this.readChord();
    else if (ch === '{') this.readGrace();
    else if (ch === 'z' || ch === 'Z') this.readRest();
    else if (/[A-Ga-g^_=]/.test(ch)) this.readNote();
    else this.readOther(ch);
    return true;
  }

  private readBarLine(): void {
    const { s, i } = this;
    const column = i + 1;
    this.flushFinger('a fingering needs a note after it');
    this.flushDynamic();
    this.flushGrace();
    let j = i + 1;
    if (s[i] === '[') j++;
    const opens = s[j] === ':';
    // `||`, `|]`, `[|` and `|:` close a second ending (core_09.AC45)
    const closesSecond = s[i] === '[' || opens || s[j] === ']' || s[j] === '|';
    if (opens) j++;
    else if (s[j] === ']' || s[j] === '|') j++;
    this.host.closeBar(this.voice, this.line, column);
    this.noSecondEnding();
    if (closesSecond) this.closeSecondEnding();
    if (opens) this.repeatStart(column);
    this.i = this.readEnding(j);
  }

  /** `:|`, `:||`, `:|]`, and `::` or `:|:` (an end and a new start) (core_09.AC17). */
  private readRepeatEnd(): void {
    const { s, i } = this;
    const column = i + 1;
    this.flushFinger('a fingering needs a note after it');
    this.flushGrace();
    let j = i + 1;
    const both = s[j] === ':' || (s[j] === '|' && s[j + 1] === ':');
    if (s[j] === '|') j++;
    if (s[j] === ':' || s[j] === ']' || s[j] === '|') j++;
    this.host.closeBar(this.voice, this.line, column);
    this.noSecondEnding();
    this.closeSecondEnding();
    const v = this.voice;
    if (v.pendingTie) this.error(column, 'a tie cannot cross a repeat sign');
    if (v.openSlur) this.error(column, 'a slur cannot cross a repeat sign');
    if (v.other.pendingTie || v.other.openSlur) this.error(column, 'a tie or slur in voice 2 cannot cross a repeat sign');
    const startBar = v.repeatOpen ?? (v.repeats.length === 0 ? 0 : null);
    const first = v.ending?.n === 1 ? v.ending : null;
    if (startBar === null) this.error(column, 'a second :| for one repeat is not supported (add a |: where the repeat starts)');
    else if (v.bars - 1 < startBar) this.error(column, 'a repeat needs at least one bar between |: and :|');
    else {
      v.repeats.push({ startBar, endBar: v.bars - 1 });
      // the first ending ends here; the second must open right after this :| (core_09.AC45)
      if (first) v.awaitSecond = { first: { startBar: first.startBar, endBar: v.bars - 1 }, repeat: v.repeats.length - 1, line: this.line, column };
    }
    if (first) v.ending = null;
    v.repeatOpen = null;
    if (both) this.repeatStart(column);
    this.i = this.readEnding(j);
  }

  /**
   * `1` or `2` right after a bar line, or `[1` and `[2` (core_09.AC45): a first ending inside an open repeat, which its
   * `:|` ends, or the second ending right after that `:|`. A third ending is refused. Returns the position after it.
   */
  private readEnding(from: number): number {
    const s = this.s;
    let j = from;
    if (s[j] === '[' && /[0-9]/.test(s[j + 1] ?? '')) j++;
    if (!/[0-9]/.test(s[j] ?? '')) return from;
    const column = from + 1;
    let digits = '';
    while (/[0-9]/.test(s[j] ?? '')) digits += s[j++];
    const v = this.voice;
    const n = Number(digits);
    if (v.tick !== v.barStart) {
      this.error(column, 'an ending starts right after a bar line');
      return j;
    }
    if (n === 1) {
      if (v.ending || v.awaitSecond) this.error(column, 'a first ending cannot start inside another ending');
      else if (v.repeatOpen === null && v.repeats.length > 0) this.error(column, 'a first ending needs a repeat to end (add a |: where the repeat starts)');
      else v.ending = { n: 1, startBar: v.bars, line: this.line, column };
    } else if (n === 2) {
      if (!v.awaitSecond) this.error(column, 'a second ending needs a first ending right before it (|1 ... :|2)');
      else {
        v.ending = { n: 2, startBar: v.bars, first: v.awaitSecond.first, repeat: v.awaitSecond.repeat, line: this.line, column };
        v.awaitSecond = null;
      }
    } else this.error(column, n === 3 ? 'a third ending is not supported' : `ending ${digits} is not supported (only first and second endings)`);
    return j;
  }

  /** A first ending whose :| was not followed by a second ending (core_09.AC45). */
  private noSecondEnding(): void {
    const wait = this.voice.awaitSecond;
    if (!wait) return;
    this.host.error(wait.line, wait.column, 'a first ending needs a second ending (:|2) right after its :|');
    this.voice.awaitSecond = null;
  }

  /** The second ending being read ends with the bar just closed (core_09.AC45). */
  private closeSecondEnding(): void {
    const v = this.voice;
    if (v.ending?.n !== 2) return;
    closeSecond(v, v.bars - 1);
  }

  private repeatStart(column: number): void {
    const v = this.voice;
    if (v.pendingTie) this.error(column, 'a tie cannot cross a repeat sign');
    if (v.openSlur) this.error(column, 'a slur cannot cross a repeat sign');
    if (v.other.pendingTie || v.other.openSlur) this.error(column, 'a tie or slur in voice 2 cannot cross a repeat sign');
    if (v.repeatOpen !== null) this.error(column, 'nested repeats are not supported (this |: comes before the :| of the last one)');
    v.repeatOpen = v.bars;
  }

  /** `!1!` to `!5!`: a fingering for the next note. False when the decoration never closes (the rest of the line is skipped). */
  private readDecoration(): boolean {
    const close = this.s.indexOf('!', this.i + 1);
    if (close < 0) {
      this.error(this.i + 1, 'a decoration must end with a second "!"');
      this.i = this.s.length;
      return false;
    }
    const name = this.s.slice(this.i + 1, close);
    const ornament = ABC_ORNAMENTS[name];
    if (/^[1-5]$/.test(name)) this.finger = { value: Number(name), column: this.i + 1 };
    else if (isDynamic(name)) this.dynamic = { value: name, column: this.i + 1 };
    else if (ornament && this.ornament) this.error(this.i + 1, 'a note takes one ornament');
    else if (ornament) this.ornament = { kind: ornament, column: this.i + 1 };
    else this.unsupported(this.i + 1, `the decoration !${name}! (only fingerings !1! to !5!, dynamics and !trill!, !mordent!, !uppermordent!, !turn!)`);
    this.i = close + 1;
    return true;
  }

  /** An optional accidental and a pitch, spelled for this bar, with the fingering written before it. Null when no pitch follows. */
  private readSpelledNote(): AbcNote | null {
    const acc = readAccidental(this.s, this.i);
    const p = readPitch(this.s, acc.next);
    if (!p) {
      this.i = acc.next;
      return null;
    }
    this.i = p.next;
    const note = this.host.spellNote(this.voice, p.note, acc.alter);
    const f = this.takeFinger();
    if (f !== undefined) note.finger = f;
    return note;
  }

  private readNote(): void {
    const column = this.i + 1;
    const note = this.readSpelledNote();
    if (note) this.commitNotes([note], column);
    else this.error(column, 'an accidental must be followed by a note');
  }

  /** `[CEG]2`: notes struck together, with their fingerings inside the brackets. False when the chord never closes. */
  private readChord(): boolean {
    const { s } = this;
    const column = this.i + 1;
    const grace = this.takeGrace();
    if (grace) this.error(grace.column, 'a grace note cannot come before a chord');
    const ornament = this.takeOrnament();
    if (ornament) this.error(ornament.column, 'an ornament goes on a single note, not on a chord');
    this.flushFinger('put fingerings inside the chord brackets, before each note');
    let close = this.i + 1;
    while (close < s.length && s[close] !== ']' && s[close] !== '|') close++; // a chord never holds a bar line
    if (s[close] !== ']') {
      this.error(column, 'a chord must end with "]"');
      this.voice.barErrored = true;
      return false;
    }
    this.i++;
    const notes: AbcNote[] = [];
    let lengthInChord = false;
    while (this.i < close) {
      const inner = s[this.i]!;
      if (inner === ' ') this.i++;
      else if (inner === '!') {
        if (!this.readDecoration()) break;
      } else {
        const at = this.i;
        const hasAccidental = readAccidental(s, at).alter !== undefined;
        const note = this.readSpelledNote();
        if (!note) {
          this.error(at + 1, hasAccidental ? 'an accidental must be followed by a note' : `unexpected "${inner}" inside a chord`);
          this.i = Math.max(this.i, at + 1);
          continue;
        }
        if (/[0-9/]/.test(s[this.i] ?? '')) {
          if (!lengthInChord) this.error(this.i + 1, 'write the length after the closing "]" of the chord');
          lengthInChord = true;
          while (/[0-9/]/.test(s[this.i] ?? '')) this.i++;
        }
        if (notes.some((n) => n.midi === note.midi)) this.error(column, 'the same note appears twice in the chord');
        notes.push(note);
      }
    }
    this.flushFinger('a fingering needs a note after it');
    this.i = close + 1;
    if (notes.length === 0) {
      this.flushDynamic();
      this.error(column, 'an empty chord');
    }
    else this.commitNotes(notes.sort((a, b) => a.midi - b.midi), column);
    return true;
  }

  /** `z2` a rest of a length, `Z` or `Z3` whole-bar rests (the number counts bars). */
  private readRest(): void {
    const { s, voice, line } = this;
    const column = this.i + 1;
    const whole = s[this.i] === 'Z';
    const grace = this.takeGrace();
    if (grace) this.error(grace.column, 'a grace note cannot come before a rest');
    const ornament = this.takeOrnament();
    if (ornament) this.error(ornament.column, 'an ornament cannot go on a rest');
    this.flushFinger('a rest cannot have a fingering');
    this.flushDynamic();
    this.i++;
    if (!whole) {
      const { dur, next } = this.host.readLength(s, this.i, line);
      this.i = next;
      if (dur === null) voice.barErrored = true;
      else this.host.addItem(voice, { kind: 'rest', tick: voice.tick, dur, line, column }, line, column);
      return;
    }
    const digitsStart = this.i;
    while (s[this.i] !== undefined && s[this.i]! >= '0' && s[this.i]! <= '9') this.i++;
    const bars = this.i > digitsStart ? Number(s.slice(digitsStart, this.i)) : 1;
    if (bars < 1) this.error(column, 'Z needs at least one bar');
    if (voice.tick !== voice.barStart) this.error(column, 'a whole-bar rest (Z) must start a bar');
    if (voice.layer === 2 && bars > 1) this.error(column, 'a whole-bar rest in voice 2 (after &) fills one bar: write Z, not Z' + bars);
    // `Z & C4`: voice 1 rests for the bar under voice 2, so its bar stays open for the overlay (d164)
    let next = this.i;
    while (s[next] === ' ' || s[next] === '\t') next++;
    const overlaid = s[next] === '&' && voice.layer === 1 && bars === 1;
    if (voice.openTuplet) {
      this.error(voice.openTuplet.column, 'a triplet cannot hold a whole-bar rest (Z)');
      voice.openTuplet = null;
    }
    for (let b = 0; b < bars; b++) {
      voice.items.push({ kind: 'rest', tick: voice.tick, dur: this.barTicks, line, column, ...(voice.layer === 2 ? { voice: 2 as const } : {}) });
      voice.tick += this.barTicks;
      if (!overlaid) this.host.closeBar(voice, line, column);
    }
  }

  /** `(` opens a slur over the notes that follow; `)` closes it after the last one (core_09.AC26). */
  private readSlurMark(): void {
    const column = this.i + 1;
    const v = this.voice;
    if (this.s[this.i] === '(') {
      if (v.openSlur) this.error(column, 'nested slurs are not supported (a slur must end with ")" before the next one starts)');
      else v.openSlur = { line: this.line, column, startTick: null };
      this.i++;
      return;
    }
    this.i++;
    const open = v.openSlur;
    if (!open) {
      this.error(column, 'a ")" has no slur to close (write "(" before the first note of the slur)');
      return;
    }
    v.openSlur = null;
    if (open.startTick === null) {
      this.host.error(open.line, open.column, 'a slur needs a note after its "(" (nothing is played under it)');
      return;
    }
    const layer = v.layer === 2 ? 2 : undefined;
    const notes = v.items.filter((item): item is Extract<AbcItem, { kind: 'notes' }> => item.kind === 'notes' && item.voice === layer && item.tick >= open.startTick!);
    const onsets = new Set(notes.map((item) => item.tick));
    const pitchSets = new Set(notes.map((item) => item.notes.map((n) => n.midi).join(',')));
    if (onsets.size < 2) this.host.error(open.line, open.column, 'a slur needs two different notes');
    else if (pitchSets.size < 2) this.host.error(open.line, open.column, 'a slur over one pitch is a tie (write "-" between the notes)');
    else v.slurs.push({ startTick: open.startTick, endTick: Math.max(...onsets), ...(layer ? { voice: layer } : {}) });
  }

  /** `&` inside a bar: what follows, up to the bar line, is voice 2 of this hand (core_09.AC52, d164). */
  private readOverlay(): void {
    const column = this.i + 1;
    if (this.s[this.i + 1] === ')') return this.overlayBrackets(column);
    this.i++;
    this.flushFinger('a fingering needs a note after it');
    this.flushDynamic();
    this.flushGrace();
    this.host.startOverlay(this.voice, this.line, column);
  }

  private overlayBrackets(column: number): void {
    this.error(column, 'an overlay over several bars, (& and &), is not supported: write & in each bar');
    this.voice.barErrored = true;
    this.i += 2;
  }

  /**
   * `(3` opens a triplet over the next three notes, chords or rests (core_09.AC49, d163). Other tuplets (`(2`, `(4` and up,
   * `(p:q:r`) and a triplet inside a triplet are refused.
   */
  private readTuplet(): void {
    const { s, voice } = this;
    const column = this.i + 1;
    let j = this.i + 1;
    while (/\d/.test(s[j] ?? '')) j++;
    const n = s.slice(this.i + 1, j);
    const ratio = s[j] === ':';
    while (/[\d:]/.test(s[j] ?? '')) j++;
    this.i = j;
    if (ratio) return this.error(column, `the tuplet "${s.slice(column - 1, j)}" is not supported (only triplets, written "(3")`);
    if (n !== '3') return this.error(column, `the tuplet "(${n}" is not supported (only triplets, written "(3")`);
    if (voice.openTuplet) {
      voice.barErrored = true;
      voice.openTuplet = null;
      return this.error(column, 'nested triplets are not supported (a triplet needs its three notes before the next "(3")');
    }
    voice.openTuplet = { line: this.line, column, startTick: voice.tick, written: 0, count: 0 };
  }

  /** Everything outside the subset, reported and skipped so the rest of the line is still read. */
  private readOther(ch: string): void {
    const { s } = this;
    const column = this.i + 1;
    if (ch === '(' && s[this.i + 1] !== undefined && /\d/.test(s[this.i + 1]!)) {
      this.readTuplet();
    } else if (ch === '(' && s[this.i + 1] === '&') {
      this.overlayBrackets(column);
    } else if (ch === '(' || ch === ')') {
      this.readSlurMark();
    } else if (ch === '.' && (s[this.i + 1] === '(' || s[this.i + 1] === ')')) {
      this.error(column, 'a dotted slur (.( or .)) is not supported');
      this.i++; // the slur mark after it is read as a slur
    } else if (ch === '}') {
      this.error(column, 'unexpected "}" (a grace note starts with "{")');
      this.i++;
    } else if (ch === '"') {
      this.unsupported(column, 'chord symbols and text annotations');
      const close = s.indexOf('"', this.i + 1);
      this.i = close < 0 ? s.length : close + 1;
    } else if (ch === '&') {
      this.readOverlay();
    } else if (ch === '\\') {
      this.i++; // line continuation: the music simply goes on
    } else if (ch === '.' || ch === '~' || ch === '-') {
      this.unsupported(column, `"${ch}"`);
      this.i++;
    } else {
      this.error(column, `unexpected character "${ch}"`);
      this.voice.barErrored = true;
      this.i++;
    }
  }

  /** Read the length and an optional tie after notes, then add them. A tie is only pending once the notes are in. */
  private commitNotes(notes: AbcNote[], column: number): void {
    const { s, voice, line } = this;
    const grace = this.takeGrace();
    const ornamentMark = this.takeOrnament();
    const { dur, next } = this.host.readLength(s, this.i, line);
    this.i = next;
    let tie: { midis: number[]; pitches: string[]; line: number; column: number } | null = null;
    if (s[this.i] === '-') {
      this.i++;
      for (const n of notes) n.tieNext = true;
      tie = { midis: notes.map((n) => n.midi), pitches: notes.map((n) => `${n.spelling.step}${n.spelling.octave}`), line, column: this.i };
    }
    if (dur === null) {
      voice.barErrored = true;
      return;
    }
    // A chord carries its dynamic on its lowest note only, so the mark is drawn once.
    const dynamic = this.takeDynamic();
    if (dynamic !== undefined && notes[0]) notes[0].dynamic = dynamic;
    // A grace note sits before this note: not on a tie's second note, and the last never with the same pitch (core_09.AC31).
    let before: AbcGrace[] | undefined;
    if (grace && voice.pendingTie) this.error(grace.column, 'a grace note cannot come before the second note of a tie');
    else if (grace && notes[0] && grace.notes.at(-1)!.midi === notes[0].midi) this.error(grace.column, 'a grace note cannot have the same pitch as its main note');
    else if (grace) before = grace.notes.map((note) => ({ note, slash: grace.slash, line, column: grace.column }));
    const ornament = ornamentMark ? this.ornamentOn(ornamentMark, notes) : undefined;
    this.host.addItem(voice, { kind: 'notes', tick: voice.tick, dur, notes, line, column, ...(before ? { graces: before } : {}), ...(ornament ? { ornament } : {}) }, line, column);
    if (tie) voice.pendingTie = tie;
  }

  /**
   * The sign on a single note with its neighbours (core_09.AC60, d305): the letter a step above or below, with the alter
   * the key and the bar's accidentals give it. Refused on the second note of a tie. AX-3 provisional: TODO(architect, R2) in core_09:
   * an accidental written over the sign (a turn with a sharp below) is not in the subset yet.
   */
  private ornamentOn(mark: OrnamentMark, notes: AbcNote[]): AbcOrnament | undefined {
    if (notes.length !== 1) return void this.error(mark.column, 'an ornament goes on a single note, not on a chord');
    if (this.voice.pendingTie) return void this.error(mark.column, 'an ornament cannot go on the second note of a tie');
    const main = notes[0]!;
    const near = (dir: 1 | -1): AbcNote => this.host.spellNote(this.voice, { midi: 0, spelling: { ...neighbourLetter(main.spelling, dir), alter: 0 } }, undefined);
    // a neighbour must sound above (below) the note: a B sharp's C above is the same key, so the sign cannot be played
    const upper = near(1);
    const lower = near(-1);
    if ((usesUpper(mark.kind) && upper.midi <= main.midi) || (usesLower(mark.kind) && lower.midi >= main.midi)) {
      return void this.error(mark.column, 'an ornament needs a neighbour note that sounds above (or below) its note; here the key gives the same key');
    }
    return {
      kind: mark.kind,
      ...(usesUpper(mark.kind) ? { upper } : {}),
      ...(usesLower(mark.kind) ? { lower } : {}),
    };
  }
}

/** A note letter with its octave marks (`c'`, `C,`), natural; null when there is no letter at `from`. */
function readPitch(s: string, from: number): { note: AbcNote; next: number } | null {
  const ch = s[from];
  if (ch === undefined || !/[A-Ga-g]/.test(ch)) return null;
  const upper = ch.toUpperCase();
  let octave = ch === upper ? 4 : 5;
  let i = from + 1;
  while (s[i] === ',' || s[i] === "'") {
    octave += s[i] === "'" ? 1 : -1;
    i++;
  }
  const spelling: Spelling = { step: upper as Spelling['step'], alter: 0, octave };
  return { note: { midi: spellingToMidi(spelling), spelling }, next: i };
}

/** The open second ending ends at `endBar`: its repeat gets both endings (core_09.AC45). */
function closeSecond(voice: VoiceState, endBar: number): void {
  const ending = voice.ending;
  voice.ending = null;
  if (ending?.n !== 2 || !ending.first || ending.repeat === undefined) return;
  const repeat = voice.repeats[ending.repeat];
  if (repeat && endBar >= ending.startBar) repeat.endings = { first: ending.first, second: { startBar: ending.startBar, endBar } };
}

export function parseAbc(text: string, file = 'piece.abc'): ParsedAbc {
  const diagnostics: Diagnostic[] = [];
  const error = (line: number, column: number, message: string) => void diagnostics.push({ severity: 'error', file, line, column, message });
  const warn = (line: number, column: number, message: string) => void diagnostics.push({ severity: 'warning', file, line, column, message });

  const voices = new Map<string, VoiceState>();
  const newVoice = (id: string, line: number): VoiceState => ({
    id, items: [], bars: 0, pickup: 0, endTick: 0, shortBars: [], lastBar: null, repeats: [], repeatOpen: null, ending: null, awaitSecond: null, openSlur: null, slurs: [], tuplets: [], openTuplet: null, tupletStarts: [], line, tick: 0, barStart: 0, barErrored: false, pendingTie: null, accidentals: new Map(),
    layer: 1, other: newLayer(), overlaid: false, mainFilled: 0,
  });

  let title: string | undefined;
  let meter: { num: number; den: number } | undefined;
  let bpm: number | undefined;
  let unit: { num: number; den: number } | undefined;
  let keySeen = false;
  let keyInfo: { fifths: number; mode: 'major' | 'minor' } = { fifths: 0, mode: 'major' };
  let signature = keyAlters(0);
  let meterBroken = false;
  let barTicks = 0;
  let current: VoiceState | undefined;
  let clefFromKey: 'treble' | 'bass' | undefined;

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  const setClef = (voice: VoiceState | null, value: string, line: number, column: number): 'treble' | 'bass' | undefined => {
    if (value !== 'treble' && value !== 'bass') {
      error(line, column, `clef "${value}" is not supported (use treble or bass)`);
      return undefined;
    }
    if (voice) voice.clef = value;
    return value;
  };

  /** "1/4=70" or "70": quarter-note beats per minute. */
  const readTempo = (value: string, line: number, column: number): number | undefined => {
    const m = /^(?:(\d+)\/(\d+)\s*=\s*)?(\d+)$/.exec(value.trim());
    if (!m) {
      error(line, column, `tempo "${value}" is not understood (write Q:1/4=70)`);
      return undefined;
    }
    const n = m[1] ? Number(m[1]) : 1;
    const d = m[2] ? Number(m[2]) : 4;
    const perMinute = Number(m[3]) * ((n / d) / (1 / 4));
    if (!(perMinute > 0)) {
      error(line, column, 'tempo must be above zero');
      return undefined;
    }
    return perMinute;
  };

  const readMeterField = (value: string, line: number, column: number): void => {
    if (keySeen) return error(line, column, 'meter changes inside the piece are not supported');
    const normalised = value === 'C' ? '4/4' : value;
    if (!(SUPPORTED_METERS as readonly string[]).includes(normalised)) {
      meterBroken = true;
      return error(line, column, `meter "${value}" is not supported yet (use ${SUPPORTED_METERS.join(', ')})`);
    }
    const [num, den] = normalised.split('/').map(Number) as [number, number];
    meter = { num, den };
  };

  const readUnitField = (value: string, line: number, column: number): void => {
    if (keySeen) return error(line, column, 'changing the default note length inside the piece is not supported');
    const m = /^(\d+)\/(\d+)$/.exec(value);
    if (!m || Number(m[1]) === 0) return error(line, column, `default note length "${value}" is not understood (write L:1/4)`);
    unit = { num: Number(m[1]), den: Number(m[2]) };
  };

  /** K: ends the header: the key, an optional clef, and from the meter the bar length and default note length. */
  const readKeyField = (value: string, line: number, column: number): void => {
    if (keySeen) return error(line, column, 'key changes are not supported');
    const [key, ...rest] = value.split(/\s+/);
    const named = readKey(key ?? '');
    if (named) {
      keyInfo = named;
      signature = keyAlters(named.fifths);
    } else error(line, column, `key "${key ?? ''}" is not supported yet (use a major or minor key such as C, G, F#m or Bb)`);
    for (const token of rest) {
      const clef = /^clef=(\S+)$/.exec(token);
      if (clef) clefFromKey = setClef(null, clef[1]!, line, column);
      else error(line, column, `"${token}" is not supported in the K: line`);
    }
    keySeen = true;
    if (!meter) {
      if (!meterBroken) error(line, column, 'missing meter: write M:4/4 before K:');
      return;
    }
    barTicks = (WHOLE_NOTE_TICKS * meter.num) / meter.den;
    unit ??= meter.num / meter.den < 0.75 ? { num: 1, den: 16 } : { num: 1, den: 8 }; // the ABC default
  };

  const readVoiceField = (value: string, line: number, column: number): void => {
    const m = /^(\S+)\s*(.*)$/.exec(value);
    if (!m) return error(line, column, 'V: needs a voice name, e.g. V:RH clef=treble');
    const id = m[1]!;
    if (voices.has('')) return error(line, column, 'cannot mix music without V: lines and voices');
    const voice = voices.get(id) ?? newVoice(id, line);
    voices.set(id, voice);
    if (keySeen && current?.layer === 2 && current !== voice) error(line, column, 'voice 2 (after &) needs a bar line before the next V: line');
    if (keySeen) current = voice;
    for (const prop of m[2]!.matchAll(/(\w+)=("[^"]*"|\S+)/g)) {
      if (prop[1] === 'clef') setClef(voice, prop[2]!, line, column);
      else if (!['name', 'nm', 'snm', 'sname', 'subname'].includes(prop[1]!)) {
        error(line, column, `voice property "${prop[1]}" is not supported`);
      }
    }
  };

  const fieldReaders: Readonly<Record<string, (value: string, line: number, column: number) => void>> = {
    T: (value) => void (title ??= value),
    M: readMeterField,
    L: readUnitField,
    Q: (value, line, column) => {
      if (keySeen) return error(line, column, 'tempo changes inside the piece are not supported');
      bpm = readTempo(value, line, column);
    },
    K: readKeyField,
    V: readVoiceField,
  };

  const parseField = (letter: string, rawValue: string, line: number, valueColumn: number): void => {
    const read = fieldReaders[letter];
    if (read) read(rawValue.trim(), line, valueColumn);
    else if (!IGNORED_FIELDS.has(letter)) error(line, valueColumn - 2, `field "${letter}:" is not supported`);
  };

  /** Close the current bar at a bar line (or the end of the music). `line`/`column` locate the bar line. */
  const closeBar = (voice: VoiceState, line: number, column: number): void => {
    if (voice.openTuplet) {
      error(voice.openTuplet.line, voice.openTuplet.column, 'a triplet cannot cross a bar line (its three notes must be in one bar)');
      voice.openTuplet = null;
      voice.barErrored = true;
    }
    if (voice.layer === 2) endOverlay(voice, line, column);
    const filled = voice.tick - voice.barStart;
    if (filled === 0) return; // doubled or leading bar lines hold no music
    if (!voice.overlaid) dropVoiceTwo(voice);
    voice.overlaid = false;
    voice.endTick = voice.barStart + filled;
    const short = filled < barTicks && !voice.barErrored;
    // Whether a short bar is allowed is known at the end: the first (a pick-up) and the last may be short (d120).
    if (short) voice.shortBars.push({ bar: voice.bars, filled, line, column });
    voice.lastBar = { filled, errored: voice.barErrored, line, column };
    // A pick-up's bar ends where its notes end; otherwise stay on the bar grid so one mistake does not shift every later bar.
    voice.tick = short && voice.bars === 0 ? filled : voice.barStart + barTicks;
    voice.barStart = voice.tick;
    voice.bars++;
    voice.barErrored = false;
    carryAccidentals(voice);
  };

  /** Swap the voice's own time, tie, slur and accidentals with those kept in `other`: from one voice of the hand to the other. */
  const swapLayers = (voice: VoiceState): void => {
    const keep: Layer = { tick: voice.tick, barErrored: voice.barErrored, pendingTie: voice.pendingTie, openSlur: voice.openSlur, openTuplet: voice.openTuplet, accidentals: voice.accidentals };
    Object.assign(voice, voice.other);
    voice.other = keep;
  };

  /** `&`: voice 1 has written its bar; voice 2 starts at the same bar line (core_09.AC52, d164). */
  const startOverlay = (voice: VoiceState, line: number, column: number): void => {
    if (voice.layer === 2) {
      error(line, column, 'more than two voices in one hand are not supported (one & per bar)');
      voice.barErrored = true;
      return;
    }
    if (voice.openTuplet) {
      error(voice.openTuplet.line, voice.openTuplet.column, 'a triplet needs its three notes before the & (it cannot go on in the other voice)');
      voice.openTuplet = null;
      voice.barErrored = true;
    }
    voice.mainFilled = voice.tick - voice.barStart;
    voice.overlaid = true;
    swapLayers(voice);
    voice.layer = 2;
    voice.tick = voice.barStart;
    voice.barErrored = voice.mainFilled === 0; // reported once here, not again for every note after it
    if (voice.mainFilled === 0) error(line, column, 'an & needs the music of voice 1 before it, in the same bar (after a whole-bar rest Z, write the & on the same line)');
  };

  /** The bar line ends voice 2: it holds as much as voice 1, and voice 1 goes on where it was. */
  const endOverlay = (voice: VoiceState, line: number, column: number): void => {
    const filled = voice.tick - voice.barStart;
    if (filled !== voice.mainFilled && !voice.barErrored && voice.mainFilled > 0) {
      error(line, column, `voice 2 of bar ${voice.bars + 1} has ${filled / PPQ} beats but voice 1 has ${voice.mainFilled / PPQ} (after & write as much as before it, with rests z)`);
    }
    carryAccidentals(voice);
    swapLayers(voice);
    voice.layer = 1;
  };

  /** A bar with no overlay: a tie or slur voice 2 left open has nowhere to go. */
  const dropVoiceTwo = (voice: VoiceState): void => {
    const two = voice.other;
    if (two.pendingTie) error(two.pendingTie.line, two.pendingTie.column, 'a tie in voice 2 needs voice 2 (&) in the next bar too');
    if (two.openSlur) error(two.openSlur.line, two.openSlur.column, 'a slur in voice 2 needs voice 2 (&) in the next bar too, up to its ")"');
    two.pendingTie = null;
    two.openSlur = null;
    carryAccidentals(two);
  };

  /** Read `2`, `/2`, `3/2`, `/`, `//` after a note. Returns the length in ticks, or null after reporting an error. */
  const readLength = (s: string, from: number, line: number): { dur: number | null; next: number } => {
    let i = from;
    const digits = (): string => {
      const start = i;
      while (i < s.length && s[i]! >= '0' && s[i]! <= '9') i++;
      return s.slice(start, i);
    };
    const n = digits();
    let multNum = n === '' ? 1 : Number(n);
    let multDen = 1;
    if (s[i] === '/') {
      let slashes = 0;
      while (s[i] === '/') {
        slashes++;
        i++;
      }
      const d = digits();
      multDen = d !== '' && slashes === 1 ? Number(d) : 2 ** slashes;
    }
    if (multNum === 0 || multDen === 0) {
      error(line, from + 1, 'a note length cannot be zero');
      return { dur: null, next: i };
    }
    const g = gcd(multNum, multDen);
    multNum /= g;
    multDen /= g;
    const ticksTimesDen = WHOLE_NOTE_TICKS * unit!.num * multNum;
    const ticksDen = unit!.den * multDen;
    if (ticksTimesDen % ticksDen !== 0) {
      error(line, from + 1, `this note length does not fit the ${PPQ} ticks per quarter note`);
      return { dur: null, next: i };
    }
    return { dur: ticksTimesDen / ticksDen, next: i };
  };

  /** An accidental written here holds for its pitch to the bar line; otherwise the key signature gives the alter. */
  const spellNote = (voice: VoiceState, note: AbcNote, written: number | undefined): AbcNote => {
    const { step, octave } = note.spelling;
    const pitch = `${step}${octave}`;
    if (written !== undefined) voice.accidentals.set(pitch, written);
    const alter = written ?? voice.accidentals.get(pitch) ?? signature[step];
    const spelling: Spelling = { step, alter, octave };
    return { ...note, midi: spellingToMidi(spelling), spelling };
  };

  /** A member of an open triplet plays two thirds of its written length (core_09.AC49); refused when its length differs from the first member's. */
  const inTuplet = (voice: VoiceState, item: AbcItem): AbcItem => {
    const t = voice.openTuplet;
    if (!t) return item;
    if (t.count === 0) {
      t.written = item.dur;
      t.startTick = voice.tick;
    }
    const fail = (message: string): AbcItem => {
      error(t.line, t.column, message);
      voice.openTuplet = null;
      voice.barErrored = true;
      return item;
    };
    if (item.dur !== t.written) return fail('the three notes of a triplet must have one length (a triplet of different lengths is not supported)');
    if (!TUPLET_LENGTHS.includes(item.dur)) return fail('only eighth and quarter triplets are supported (three eighths in one beat, or three quarters in two)');
    t.count++;
    if (t.count === 3) {
      voice.tuplets.push({ startTick: t.startTick, endTick: voice.tick, ...(voice.layer === 2 ? { voice: 2 as const } : {}) });
      voice.tupletStarts.push({ bar: voice.bars, offset: t.startTick - voice.barStart, line: t.line, column: t.column });
      voice.openTuplet = null;
    }
    return { ...item, dur: (item.dur * 2) / 3 };
  };

  const addItem = (voice: VoiceState, written: AbcItem, line: number, column: number): void => {
    const item = inTuplet(voice, written);
    const two = voice.layer === 2;
    if (voice.tick + item.dur > voice.barStart + (two ? voice.mainFilled : barTicks) && !voice.barErrored) {
      voice.barErrored = true;
      if (two) error(line, column, `this ${item.kind === 'rest' ? 'rest' : 'note'} in voice 2 runs past the end of bar ${voice.bars + 1} (voice 2 ends at the bar line)`);
      else error(line, column, `this ${item.kind === 'rest' ? 'rest' : 'note'} runs past the end of bar ${voice.bars + 1} (split it with a tie)`);
    }
    if (two) item.voice = 2;
    if (voice.pendingTie) {
      const tie = voice.pendingTie;
      voice.pendingTie = null;
      const ok = item.kind === 'notes' && tie.midis.every((m) => item.notes.some((n) => n.midi === m));
      if (!ok) error(tie.line, tie.column, 'a tie must join two notes of the same pitch');
    }
    if (item.kind === 'notes' && voice.openSlur?.startTick === null) voice.openSlur.startTick = item.tick;
    voice.items.push(item);
    voice.tick += item.dur;
  };

  for (let index = 0; index < lines.length; index++) {
    const lineNo = index + 1;
    const raw = lines[index]!;
    const noComment = raw.replace(/%.*$/, '');
    if (noComment.trim() === '') continue;
    const field = /^\s*([A-Za-z]):(.*)$/.exec(noComment);
    if (field) {
      const column = noComment.indexOf(':') + 2;
      parseField(field[1]!, field[2]!, lineNo, column);
      continue;
    }
    if (!keySeen) {
      error(lineNo, 1, 'music before the K: line (the header must end with K:C)');
      continue;
    }
    if (barTicks === 0) continue; // the header is broken and already reported
    if (!current) {
      if (voices.size > 0) {
        error(lineNo, 1, 'music before the first V: line');
        continue;
      }
      current = newVoice('', lineNo);
      voices.set('', current);
    }
    new MusicLine({ error, closeBar, readLength, spellNote, addItem, startOverlay }, current, noComment.trimEnd(), lineNo, barTicks).scan();
  }

  if (!keySeen) error(lines.length, 1, 'missing K:C line');
  const lastLine = lines.length;
  for (const voice of voices.values()) {
    if (voice.openTuplet) {
      error(voice.openTuplet.line, voice.openTuplet.column, 'a triplet needs three notes after its "(3"');
      voice.openTuplet = null;
      voice.barErrored = true;
    }
    if (voice.tick !== voice.barStart || voice.layer === 2) closeBar(voice, lastLine, 1);
    dropVoiceTwo(voice);
    checkUnisons(voice, error);
    if (meter) checkBarLengths(voice, barTicks, `${meter.num}/${meter.den}`, error); // no meter: already reported, no music was read
    if (voice.pendingTie) error(voice.pendingTie.line, voice.pendingTie.column, 'a tie must join two notes of the same pitch');
    if (voice.repeatOpen !== null) error(lastLine, 1, `the repeat that starts at bar ${voice.repeatOpen + 1} needs a :| where it ends`);
    if (voice.awaitSecond) error(voice.awaitSecond.line, voice.awaitSecond.column, 'a first ending needs a second ending (:|2) right after its :|');
    if (voice.ending?.n === 1) error(voice.ending.line, voice.ending.column, 'a first ending needs a :| where it ends');
    // a second ending nothing closed holds one bar (core_09.AC45)
    if (voice.ending?.n === 2) closeSecond(voice, Math.min(voice.bars - 1, voice.ending.startBar));
    if (voice.openSlur) error(voice.openSlur.line, voice.openSlur.column, 'a slur that starts here is not closed with ")"');
    checkTupletBeats(voice, barTicks, error);
    if (voice.items.length === 0 && voice.id !== '') warn(voice.line, 1, `voice ${voice.id} has no music`);
    if (clefFromKey) voice.clef ??= clefFromKey;
  }

  const result: ParsedAbc = { voices: [...voices.values()].map(({ id, clef, items, bars, pickup, endTick, repeats, slurs, tuplets, line }) => ({ id, ...(clef ? { clef } : {}), items, bars, pickup, endTick, repeats, slurs, tuplets, line })), key: keyInfo, diagnostics };
  if (title !== undefined) result.title = title;
  if (meter) result.meter = meter;
  if (bpm !== undefined) result.bpm = bpm;
  return result;
}

/** AX-3 provisional (d164): one key cannot be held and pressed again, so a pitch the other voice still holds (or starts on the same tick) is refused. */
function checkUnisons(voice: VoiceState, error: (line: number, column: number, message: string) => void): void {
  const notes = voice.items.filter((item): item is Extract<AbcItem, { kind: 'notes' }> => item.kind === 'notes');
  const one = notes.filter((item) => item.voice === undefined);
  const two = notes.filter((item) => item.voice === 2);
  for (const a of one) {
    for (const b of two) {
      if (!(a.tick < b.tick + b.dur && b.tick < a.tick + a.dur)) continue;
      const sameLine = a.tick === b.tick && a.notes.some((n) => b.notes.some((m) => m.midi !== n.midi && m.spelling.step === n.spelling.step && m.spelling.octave === n.spelling.octave));
      if (sameLine) error(b.line, b.column, 'both voices start a note on the same line of the staff with different signs: it cannot be read');
      if (!a.notes.some((n) => b.notes.some((m) => m.midi === n.midi))) continue;
      const later = b.tick >= a.tick ? b : a;
      if (a.tick === b.tick) error(later.line, later.column, 'the same pitch starts at the same time in both voices: write it once, in one voice');
      else error(later.line, later.column, 'this key is still held in the other voice: one key cannot be held and struck again');
    }
  }
}

/**
 * d120: the first bar may be a short pick-up, and then the last bar holds the rest of
 * that whole bar; without a pick-up every bar, the last too, is whole. Sets `voice.pickup`.
 */
function checkBarLengths(voice: VoiceState, barTicks: number, meter: string, error: (line: number, column: number, message: string) => void): void {
  const pickupBar = voice.shortBars.find((sb) => sb.bar === 0 && voice.bars > 1);
  if (pickupBar) voice.pickup = pickupBar.filled;
  const lastIndex = voice.bars - 1;
  for (const sb of voice.shortBars) {
    if (sb === pickupBar || (sb.bar === lastIndex && voice.pickup > 0)) continue;
    error(sb.line, sb.column, `bar ${sb.bar + 1} has ${sb.filled / PPQ} beats but ${meter} needs ${barTicks / PPQ}`);
  }
  const last = voice.lastBar;
  if (voice.pickup > 0 && last && !last.errored && last.filled !== barTicks - voice.pickup) {
    error(last.line, last.column, `with a pick-up of ${voice.pickup / PPQ} beats the last bar needs ${(barTicks - voice.pickup) / PPQ} beats, so the two make one ${meter} bar (it has ${last.filled / PPQ})`);
    // the first bar may be a mistake rather than a pick-up: say so where it is
    error(pickupBar!.line, pickupBar!.column, `bar 1 has ${pickupBar!.filled / PPQ} beats: if it is not a pick-up, ${meter} needs ${barTicks / PPQ}`);
  }
}

/**
 * A triplet is a beat group (core_09.AC49, d163): it starts on a beat of its bar, counted in a pick-up from the bar's end
 * (d120), so it fills one beat (eighths) or two (quarters). Runs after `checkBarLengths`, which knows the pick-up.
 */
function checkTupletBeats(voice: VoiceState, barTicks: number, error: (line: number, column: number, message: string) => void): void {
  for (const t of voice.tupletStarts) {
    const fromBeat = t.bar === 0 && voice.pickup > 0 ? t.offset + barTicks - voice.pickup : t.offset;
    if (fromBeat % PPQ !== 0) error(t.line, t.column, 'a triplet must start on a beat (three eighths fill one beat, three quarters two)');
  }
}
