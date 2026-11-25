import { OWN_PIECE_LICENSE, PPQ, pickupTicks, ticksPerBar, noteLengthOf, tupletOf, writtenDurOf, diatonicIndex, midiToSpelling, noteName, type Chart, type ChartNote, type ChartRest, type LevelDefinition, type PieceMeta } from '../chart';
import type { StyleList } from '../properties/styles';
import { keyAlters, keyAt, tonicStep } from '../chart/key';
import type { SourceLocation } from './compile';
import type { Diagnostic } from './diagnostics';
import { costlyFingers, searchedFingerAt } from '../fingering/chart';

const ALLOWED_LENGTHS = ['whole', 'dottedHalf', 'half', 'dottedQuarter', 'quarter', 'dottedEighth', 'eighth', 'sixteenth'] as const;
/** The licences a committed piece may have (anything else is a warning a person reviews). */
export const KNOWN_LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-SA-4.0', 'CC-BY-SA-3.0', 'public-domain'];
const MAX_REPORTS_PER_RULE = 8;
const INTERVAL_NAMES = ['repeated note', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'octave'];

export interface LintInput {
  chart: Chart;
  meta: PieceMeta;
  level: LevelDefinition;
  /** Positions in `piece.abc` aligned with the chart's notes and rests; messages then point into the file. */
  sources?: { notes: SourceLocation[]; rests: SourceLocation[] } | null;
  abcFile?: string;
  metaFile?: string;
  /** The piece lives in `private/pieces/` (an own piece, never committed or deployed): licence "NaN" is expected there. */
  privatePiece?: boolean;
  /** The closed style list `meta.styles` must come from: the content's `content/pieces/styles.json`, read by the caller. */
  styles: StyleList;
}

type Where = { note: number } | { rest: number } | { bar: number } | null;

const fmt = (n: number) => String(Math.round(n * 100) / 100);

type PlayNote = { note: ChartNote; index: number };
type Report = (rule: string, message: string, where?: Where, file?: string) => void;

/** What every lint rule sees: the piece, its level, the play tracks and how to report. */
interface LintContext {
  input: LintInput;
  chart: Chart;
  meta: PieceMeta;
  level: LevelDefinition;
  metaFile: string;
  playTracks: Map<string, Chart['tracks'][number]>;
  playNotes: PlayNote[];
  playRests: { rest: ChartRest; index: number }[];
  error: Report;
  warn: Report;
}

const name = (n: ChartNote) => noteName(n.spelling);
const at = (n: { index: number }) => ({ note: n.index });
const barLength = (chart: Chart, bar: number) => chart.bars[bar]!.endTick - chart.bars[bar]!.startTick;

/** Items grouped by a key, in first-seen order. */
function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}
const onsetKey = (e: PlayNote) => `${e.note.track}|${e.note.voice}|${e.note.tick}`;

/** Level: meter, hands, clefs. */
function checkMeterHandsClefs({ chart, level, playTracks, error }: LintContext): void {
  for (const m of chart.meterMap) {
    if (!level.meters.some((l) => l.num === m.num && l.den === m.den)) {
      error('meter', `${m.num}/${m.den} is not allowed at level ${level.level} (allowed: ${level.meters.map((l) => `${l.num}/${l.den}`).join(', ')})`);
    }
  }
  for (const track of playTracks.values()) {
    if (track.hand && !level.hands.includes(track.hand)) {
      error('hand', `the ${track.hand === 'RH' ? 'right' : 'left'} hand is not played at level ${level.level} (hands: ${level.hands.join(', ')})`);
    }
    if (!level.clefs.includes(track.clef)) error('clef', `the ${track.clef} clef is not used at level ${level.level} (clefs: ${level.clefs.join(', ')})`);
  }
}

/**
 * Every bar has its length and every voice fills it exactly (guards charts that did not come from the compiler): a whole
 * bar, except a pick-up first and then a last bar that makes up the rest of that bar (d120).
 */
function checkBarsFilled({ chart, error }: LintContext): void {
  const pickup = pickupTicks(chart.bars, chart.meterMap, chart.ppq);
  for (const bar of chart.bars) {
    const m = [...chart.meterMap].reverse().find((c) => c.tick <= bar.startTick) ?? chart.meterMap[0]!;
    const full = ticksPerBar(m, chart.ppq);
    const meter = `${m.num}/${m.den}`;
    const last = bar.index === chart.bars.length - 1 && bar.index > 0;
    const expected = bar.index === 0 && pickup > 0 ? pickup : last && pickup > 0 ? full - pickup : full;
    const length = barLength(chart, bar.index);
    if (length === expected) continue;
    const why = last && pickup > 0 ? `with a pick-up of ${fmt(pickup / PPQ)} beats the last bar needs ${fmt(expected / PPQ)}, so the two make one ${meter} bar` : `${meter} needs ${fmt(expected / PPQ)}`;
    error('bar-length', `this bar is ${fmt(length / PPQ)} beats long but ${why}`, { bar: bar.index });
  }
  const voices = groupBy<ChartNote | ChartRest>([...chart.notes, ...chart.rests], (e) => `${e.track}|${e.voice}`);
  for (const [key, events] of voices) {
    for (const bar of chart.bars) {
      const lengths = new Map<number, number>();
      for (const e of events) {
        if (e.tick >= bar.startTick && e.tick < bar.endTick) lengths.set(e.tick, Math.max(lengths.get(e.tick) ?? 0, e.dur));
      }
      // a second voice (d164) fills only the bars it is written in
      if (lengths.size === 0 && !key.endsWith('|1')) continue;
      let cursor = bar.startTick;
      let filled = true;
      for (const tick of [...lengths.keys()].sort((a, b) => a - b)) {
        if (tick !== cursor) filled = false;
        cursor = tick + lengths.get(tick)!;
      }
      if (cursor !== bar.endTick || !filled) {
        error('bar-length', `${key.split('|')[0]} does not fill the ${fmt(barLength(chart, bar.index) / PPQ)} beats exactly`, { bar: bar.index });
      }
    }
  }
}

/** Key signature, then each note: range, note value, accidental, tie. */
function checkKeyAndNotes({ chart, level, playNotes, error }: LintContext): void {
  for (const entry of chart.keyMap) {
    if (!level.keys.includes(entry.fifths)) error('key', `this key (${entry.fifths > 0 ? `${entry.fifths} sharps` : entry.fifths < 0 ? `${-entry.fifths} flats` : 'no sharps or flats'}) is not allowed at level ${level.level}`);
  }
  for (const e of playNotes) {
    const n = e.note;
    if (n.midi < level.range.low || n.midi > level.range.high) {
      error('range', `${name(n)} is outside the notes of level ${level.level} (${noteName(midiToSpelling(level.range.low))} to ${noteName(midiToSpelling(level.range.high))})`, at(e));
    }
    // A triplet note is judged by its written value (an eighth triplet is an eighth), and only where the level has triplets (core_09.AC51).
    const tuplet = tupletOf(chart, n) !== undefined;
    const value = noteLengthOf(writtenDurOf(chart, n), ALLOWED_LENGTHS);
    if (tuplet && !level.tuplets) error('note-value', `triplets are not allowed at level ${level.level}`, at(e));
    else if (!value) error('note-value', `a note of ${n.dur} ticks is not a whole, dotted half, half, dotted quarter, quarter, dotted eighth, eighth or sixteenth note (other dotted and shorter notes, and triplet lengths outside a triplet, are not allowed)`, at(e));
    else if (!level.noteValues.includes(value)) error('note-value', `${value} notes are not allowed at level ${level.level} (allowed: ${level.noteValues.join(', ')})`, at(e));
    const inKey = keyAlters(keyAt(chart.keyMap, n.tick).fifths)[n.spelling.step];
    if (n.spelling.alter !== inKey && !level.accidentals) error('accidental', `${name(n)} needs an accidental, which level ${level.level} does not use`, at(e));
    if (n.tieNext && !level.ties) error('tie', `ties are not allowed at level ${level.level}`, at(e));
  }
}

function checkChords({ level, playNotes, error }: LintContext): void {
  if (level.chords) return;
  for (const group of groupBy(playNotes, onsetKey).values()) {
    if (group.length > 1) error('chord', `several notes of one hand at once (a chord) are not allowed at level ${level.level}`, { note: group[0]!.index });
  }
}

/** Two voices in one hand (core_09.AC54, d164) only where the level allows them. */
function checkVoices({ level, playNotes, error }: LintContext): void {
  for (const e of playNotes) {
    if (e.note.voice > level.voices) error('voices', `a second voice in one hand (&) is not allowed at level ${level.level}`, at(e));
  }
}

function checkRests({ chart, level, playRests, error }: LintContext): void {
  for (const e of playRests) {
    if (!level.rests) {
      error('rest', `rests are not allowed at level ${level.level}`, { rest: e.index });
      continue;
    }
    const wholeBar = e.rest.dur === barLength(chart, e.rest.bar);
    if (tupletOf(chart, e.rest) && !level.tuplets) {
      error('note-value', `triplets are not allowed at level ${level.level}`, { rest: e.index });
      continue;
    }
    const value = noteLengthOf(writtenDurOf(chart, e.rest), ALLOWED_LENGTHS);
    if (!wholeBar && (!value || !level.noteValues.includes(value))) {
      error('rest-value', `a rest of ${e.rest.dur} ticks is not allowed at level ${level.level} (rests use the same lengths as notes)`, { rest: e.index });
    }
  }
}

/** Melodic leaps within one voice (chords are left out). */
function checkLeaps({ level, playNotes, error }: LintContext): void {
  for (const line of groupBy(playNotes, (e) => `${e.note.track}|${e.note.voice}`).values()) {
    const sorted = [...line].sort((a, b) => a.note.tick - b.note.tick);
    const single = sorted.filter((e) => sorted.filter((m) => m.note.tick === e.note.tick).length === 1);
    for (let i = 1; i < single.length; i++) {
      const from = single[i - 1]!;
      const to = single[i]!;
      const steps = Math.abs(diatonicIndex(to.note.spelling) - diatonicIndex(from.note.spelling));
      if (steps > level.maxLeapSteps) {
        const interval = INTERVAL_NAMES[steps] ?? `${steps + 1}th`;
        error('leap', `a jump of ${article(interval)} ${interval} (${name(from.note)} to ${name(to.note)}); level ${level.level} allows at most ${describeLeap(level.maxLeapSteps)}`, at(to));
      }
    }
  }
}

function checkHandsTogether({ level, playTracks, playNotes, error }: LintContext): void {
  if (level.handsTogether) return;
  const rh = playNotes.filter((e) => playTracks.get(e.note.track)!.hand === 'RH');
  const lh = playNotes.filter((e) => playTracks.get(e.note.track)!.hand === 'LH');
  for (const a of rh) {
    const other = lh.find((b) => a.note.tick < b.note.tick + b.note.dur && b.note.tick < a.note.tick + a.note.dur);
    if (other) {
      const later = a.note.tick >= other.note.tick ? a : other;
      error('hands-together', `both hands sound at once (${name(a.note)} and ${name(other.note)}); level ${level.level} plays one hand at a time`, at(later));
    }
  }
}

/** Length of the piece and of its phrases. */
function checkLengths({ chart, level, metaFile, error, warn }: LintContext): void {
  // a pick-up and the last bar make one whole bar (d120), so they count as one
  const barCount = chart.bars.length - (pickupTicks(chart.bars, chart.meterMap, chart.ppq) > 0 ? 1 : 0);
  if (barCount < level.bars.min || barCount > level.bars.max) {
    error('piece-length', `the piece has ${barCount} bars; level ${level.level} needs ${level.bars.min} to ${level.bars.max}`);
  }
  for (const phrase of chart.phrases) {
    const length = phrase.endBar - phrase.startBar + 1;
    if (length < 2 || length > 8) error('phrase-length', `phrase "${phrase.name}" has ${length} bar(s); a phrase needs 2 to 8`, null, metaFile);
  }
  if (chart.phrases.length === 0) warn('no-phrases', 'the piece has no phrases; phrases are what the characters trade', null, metaFile);
}

/**
 * Fingerings against the level's hand position: a position note must take the position's finger (an error). One exception
 * (ft_1_30): in a part that leaves the position, a different finger that the fingering search takes there too, such as the
 * thumb turning under on F, is a warning for a person to review.
 */
function checkFingerings({ chart, level, playTracks, playNotes, error, warn }: LintContext): void {
  const unchecked = new Set<string>();
  const leaves = new Set<string>();
  for (const e of playNotes) {
    const hand = playTracks.get(e.note.track)!.hand;
    const table = hand ? level.fingerings[hand] : undefined;
    if (table && table[name(e.note)] === undefined) leaves.add(e.note.track);
  }
  for (const e of playNotes) {
    const n = e.note;
    if (n.finger === undefined) continue;
    const hand = playTracks.get(n.track)!.hand;
    const table = hand ? level.fingerings[hand] : undefined;
    const expected = table?.[name(n)];
    if (expected === undefined) {
      if (!unchecked.has(name(n))) warn('fingering-unchecked', `finger ${n.finger} on ${name(n)}: the level has no hand position for this note, so the fingering is not checked`, at(e));
      unchecked.add(name(n));
    } else if (expected !== n.finger) {
      const message = `finger ${n.finger} on ${name(n)}; in the ${hand === 'RH' ? 'right' : 'left'}-hand position of level ${level.level} this note uses finger ${expected}`;
      if (leaves.has(n.track) && searchedFingerAt(chart, e.index, level) === n.finger) warn('fingering', `${message}, but the part leaves the position and finger ${n.finger} fits the hand here`, at(e));
      else error('fingering', message, at(e));
    }
  }
}

/** Keys pressed together by one hand need different fingers, in the order the hand lies on the keyboard. */
function checkChordFingers({ playTracks, playNotes, error }: LintContext): void {
  for (const group of groupBy(playNotes, onsetKey).values()) {
    const fingered = group.filter((e) => e.note.finger !== undefined).sort((a, b) => a.note.midi - b.note.midi);
    const rightHand = playTracks.get(group[0]!.note.track)!.hand === 'RH';
    for (let i = 1; i < fingered.length; i++) {
      const low = fingered[i - 1]!.note.finger!;
      const high = fingered[i]!.note.finger!;
      if (low === high || (rightHand ? high < low : high > low)) {
        error('fingering', `fingers ${low} and ${high} cannot play ${name(fingered[i - 1]!.note)} and ${name(fingered[i]!.note)} together`, at(fingered[i]!));
      }
    }
  }
}

/** A written finger that costs the hand far more than the best one the fingering search finds there (ft_1_30.AC8). */
function checkCostlyFingers({ chart, level, warn }: LintContext): void {
  for (const c of costlyFingers(chart, level)) {
    warn('fingering-cost', `finger ${c.written} on ${name(chart.notes[c.note]!)} is hard for the hand here; finger ${c.better} is ${fmt(c.extra)} points easier`, { note: c.note });
  }
}

/** The meta file: licence and styles. */
function checkMeta({ input, meta, metaFile, error, warn }: LintContext): void {
  if (meta.license === OWN_PIECE_LICENSE) {
    if (!input.privatePiece) warn('license', `licence "${OWN_PIECE_LICENSE}" is for own pieces kept private in private/pieces/; a piece in content/pieces/ is committed and deployed and needs a real licence (one of ${KNOWN_LICENSES.join(', ')})`, null, metaFile);
  } else if (!KNOWN_LICENSES.includes(meta.license)) warn('license', `licence "${meta.license}" is not one of ${KNOWN_LICENSES.join(', ')}; check it can be used`, null, metaFile);

  const styleIds = input.styles.styles.map((s) => s.id);
  for (const style of meta.styles) {
    if (!styleIds.includes(style)) error('style', `style "${style}" is not in content/pieces/styles.json (one of ${styleIds.join(', ')}); free words go in "tags"`, null, metaFile);
  }
  if (meta.styles.length === 0 && !input.privatePiece) warn('style', `no style: name one or more in "styles" (${styleIds.join(', ')})`, null, metaFile);
}

/** Warnings for a human to review: the ending, repeated bars, one rhythm throughout. */
function checkMusicality({ chart, playTracks, playNotes, warn }: LintContext): void {
  const key = chart.keyMap.at(-1)!;
  const tonic = tonicStep(key.fifths, key.mode);
  for (const track of playTracks.values()) {
    const last = playNotes.filter((e) => e.note.track === track.id).sort((a, b) => a.note.tick - b.note.tick || a.note.midi - b.note.midi).at(-1);
    // a part that ends on a chord ends on the tonic when any key of that chord is the tonic (core_09.AC58)
    const ending = playNotes.filter((e) => e.note.track === track.id && e.note.tick === last?.note.tick);
    if (last && !ending.some((e) => e.note.spelling.step === tonic)) warn('no-cadence', `the ${track.id.toUpperCase()} part ends on ${name(last.note)}, not on the tonic ${tonic}`, at(last));
  }
  const signatures = chart.bars.map((bar) =>
    [...chart.notes, ...chart.rests]
      .filter((e) => e.tick >= bar.startTick && e.tick < bar.endTick && playTracks.has(e.track))
      .map((e) => `${e.track}:${e.tick - bar.startTick}:${e.dur}:${'midi' in e ? e.midi : 'rest'}`)
      .sort()
      .join(','),
  );
  let run = 1;
  for (let i = 1; i <= signatures.length; i++) {
    if (i < signatures.length && signatures[i] === signatures[i - 1]) run++;
    else {
      if (run >= 3) warn('identical-bars', `${run} identical bars in a row (bars ${i - run + 1} to ${i})`, { bar: i - run });
      run = 1;
    }
  }
  if (signatures.length >= 4 && new Set(signatures).size <= signatures.length / 2) {
    warn('repeated-bars', `only ${new Set(signatures).size} different bars in ${signatures.length}; a piece of mostly repeated bars is dull to play`);
  }
  const durations = new Set(playNotes.map((e) => e.note.dur));
  if (playNotes.length >= 8 && durations.size === 1) warn('monotone-rhythm', 'every note has the same length; add rhythmic variety');
}

/** The rules in the order their reports are listed. */
const RULES: readonly ((context: LintContext) => void)[] = [
  checkMeterHandsClefs, checkBarsFilled, checkKeyAndNotes, checkChords, checkVoices, checkRests, checkLeaps, checkHandsTogether,
  checkLengths, checkFingerings, checkChordFingers, checkCostlyFingers, checkMeta, checkMusicality,
];

/**
 * Check a compiled piece against its level (docs/authoring/au05-linter.md). Hard rules are errors, review hints are warnings.
 * Every limit comes from the level definition, so the same rules serve any table. Reports per rule are capped so one
 * systematic mistake does not bury everything else.
 */
export function lintPiece(input: LintInput): Diagnostic[] {
  const { chart, meta, level, sources } = input;
  const abcFile = input.abcFile ?? 'piece.abc';
  const metaFile = input.metaFile ?? 'piece.meta.json';
  const out: Diagnostic[] = [];
  const counts = new Map<string, number>();
  const hidden = new Map<string, { severity: Diagnostic['severity']; count: number }>();

  const place = (where: Where): { text: string; bar?: number; loc?: SourceLocation } => {
    if (where === null) return { text: '' };
    if ('bar' in where) return { text: `bar ${where.bar + 1}: `, bar: where.bar + 1 };
    const item = 'note' in where ? chart.notes[where.note]! : chart.rests[where.rest]!;
    const loc = 'note' in where ? sources?.notes[where.note] : sources?.rests[where.rest];
    const beat = (item.tick - chart.bars[item.bar]!.startTick) / PPQ + 1;
    return { text: `bar ${item.bar + 1}, beat ${fmt(beat)}: `, bar: item.bar + 1, ...(loc ? { loc } : {}) };
  };
  const report = (severity: Diagnostic['severity']): Report => (rule, message, where = null, file = abcFile) => {
    const key = `${severity}:${rule}`;
    const seen = counts.get(key) ?? 0;
    counts.set(key, seen + 1);
    if (seen >= MAX_REPORTS_PER_RULE) {
      hidden.set(key, { severity, count: (hidden.get(key)?.count ?? 0) + 1 });
      return;
    }
    const { text, bar, loc } = place(where);
    out.push({ severity, file, ...(loc ? { line: loc.line, column: loc.column } : {}), message: `${text}${message}`, rule, ...(bar ? { bar } : {}) });
  };

  const playTracks = new Map(chart.tracks.filter((t) => t.role === 'play').map((t) => [t.id, t]));
  const context: LintContext = {
    input, chart, meta, level, metaFile, playTracks,
    playNotes: chart.notes.map((note, index) => ({ note, index })).filter((e) => playTracks.has(e.note.track)),
    playRests: chart.rests.map((rest, index) => ({ rest, index })).filter((e) => playTracks.has(e.rest.track)),
    error: report('error'),
    warn: report('warning'),
  };
  for (const rule of RULES) rule(context);

  for (const [key, h] of hidden) out.push({ severity: h.severity, file: abcFile, message: `and ${h.count} more ${key.split(':')[1]} problem(s) not shown`, rule: key.split(':')[1]! });
  return out;
}

const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');

function describeLeap(steps: number): string {
  const word = INTERVAL_NAMES[steps] ?? `${steps + 1}th`;
  return steps === 0 ? 'repeated notes only' : steps === 1 ? 'a step' : `${article(word)} ${word}`;
}
