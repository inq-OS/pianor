/**
 * MusicXML (score-partwise) to a chart, for analysis (ft_Y_04 slice 1, core_08): every sounding note keeps its time, pitch
 * and spelling, hand and voice, so the difficulty estimator and the learned model can score any engraved piece. Nothing a
 * score holds is refused for being beyond the game's notation (that is the game importer's job, slice 2): what this reader
 * leaves out or guesses is listed in `warnings`. Pure.
 *
 * Mapping: each staff of each part is a track; in a part of two or more staves the upper is the right hand and the others
 * the left, a part of one staff takes its hand from its clef. MusicXML voices become voices 1 to 4 of their track in the
 * order they appear. Divisions become ticks (480 a quarter). A measure lasts as long as its longest voice and at least its
 * time signature, unless it is a pick-up (`implicit="yes"`, or a first measure shorter than its time signature).
 */
import { PPQ } from '../chart/time';
import { spellingToMidi, type Spelling, type Step, STEPS } from '../chart/pitch';
import { chartSchema, type Chart, CHART_SCHEMA_VERSION } from '../chart/schema';
import { isDynamic } from '../chart/dynamics';
import { child, childAt, childrenOf, parseXml, textOf, XmlError, type XmlElement } from './xml';
import type { ZipEntry } from './zip';

export type MusicXmlResult = { ok: true; chart: Chart; warnings: string[] } | { ok: false; reason: string };

/**
 * Tempo words to quarter notes per minute, for a score that gives no number. AX-3 provisional: about the middle of the
 * usual metronome ranges, the beat taken as a quarter whatever the meter (TODO(builder, R3) in ft_Y_04).
 */
export const TEMPO_WORDS: Readonly<Record<string, number>> = {
  prestissimo: 200,
  presto: 176,
  vivacissimo: 168,
  vivace: 156,
  allegro: 132,
  allegretto: 116,
  moderato: 112,
  andantino: 96,
  andante: 88,
  adagietto: 76,
  adagio: 70,
  larghetto: 63,
  lento: 52,
  largo: 50,
  grave: 40,
};
/** MusicXML's own default when a score names no tempo. */
export const DEFAULT_BPM = 120;

const BEAT_UNITS: Readonly<Record<string, number>> = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125 };

/** The quarter-note tempo of the first tempo word in a text ("Allegro ma non troppo" is 132), if any. */
export function tempoFromWords(text: string): number | undefined {
  for (const word of text.toLowerCase().split(/[^a-zà-ÿ]+/)) {
    const bpm = TEMPO_WORDS[word];
    if (bpm !== undefined) return bpm;
  }
  return undefined;
}

type Pitch = Spelling & { step: Step };
interface RawNote extends Pitch {
  track: string;
  xmlVoice: string;
  measure: number;
  /** Start and end inside the measure, in ticks. */
  start: number;
  end: number;
  tie: boolean;
  finger?: number;
}
interface RawGrace extends Pitch {
  slash: boolean;
  /** The main note it goes before, an index into the notes. */
  main: number;
}
interface RawRest {
  track: string;
  xmlVoice: string;
  measure: number;
  start: number;
  end: number;
}
interface Mark<T> {
  measure: number;
  at: number;
  value: T;
}
type Meter = { num: number; den: number };
type Key = { fifths: number; mode: 'major' | 'minor' };

/** What was left out or guessed, each once with how often. */
class Warnings {
  private readonly counts = new Map<string, number>();
  add(text: string): void {
    this.counts.set(text, (this.counts.get(text) ?? 0) + 1);
  }
  list(): string[] {
    return [...this.counts].map(([text, n]) => (n > 1 ? `${text} (${n} times)` : text));
  }
}

const num = (el: XmlElement | undefined): number | undefined => {
  const t = textOf(el);
  if (t === '') return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
};

function readPitch(el: XmlElement | undefined, warn: Warnings): Pitch | undefined {
  const step = textOf(child(el, 'step')).toUpperCase() as Step;
  const octave = num(child(el, 'octave'));
  if (!STEPS.includes(step) || octave === undefined || !Number.isInteger(octave) || octave < -1 || octave > 9) return undefined;
  let alter = num(child(el, 'alter')) ?? 0;
  if (!Number.isInteger(alter)) {
    warn.add('microtones rounded to the nearest semitone');
    alter = Math.round(alter);
  }
  alter = Math.max(-2, Math.min(2, alter));
  const midi = spellingToMidi({ step, alter, octave });
  return midi >= 0 && midi <= 127 ? { step, alter, octave } : undefined;
}

/** Everything read from the parts, before it is laid out as bars and tracks. */
class ScoreReader {
  readonly warn = new Warnings();
  readonly notes: RawNote[] = [];
  readonly graces: RawGrace[] = [];
  readonly rests: RawRest[] = [];
  readonly meters: Mark<Meter>[] = [];
  readonly keys: Mark<Key>[] = [];
  readonly tempos: (Mark<{ bpm: number; exact: boolean }> & { part: number })[] = [];
  readonly repeatStarts: number[] = [];
  readonly repeatEnds: number[] = [];
  /** Dynamic marks by staff, for the first note of that staff from their place on. */
  readonly dynamics: { track: string; measure: number; at: number; value: string }[] = [];
  /** Slurs as the indexes of their first and last note. */
  readonly slurs: { start: number; end: number }[] = [];
  /** Slurs started and not yet stopped, by part and slur number (MusicXML pairs them so, across voices and staves). */
  readonly openSlurs = new Map<string, number>();
  endings = false;
  readonly clefs = new Map<string, 'treble' | 'bass'>();
  readonly trackOrder: string[] = [];
  readonly staves = new Map<number, number>();
  /** Content length per measure, in ticks, over every part. */
  readonly contentLength: number[];
  readonly implicit: boolean[];

  // the place being read
  private part = 0;
  private measure = 0;
  private divisions = 1;
  private cursor = 0;
  private lastStart = 0;
  private reach = 0;
  private pending = new Map<string, (Pitch & { slash: boolean })[]>();

  constructor(readonly measureCount: number) {
    this.contentLength = new Array<number>(measureCount).fill(0);
    this.implicit = new Array<boolean>(measureCount).fill(false);
  }

  /** Divisions to ticks; a time that is not a whole tick is rounded and noted. */
  private place(div: number): number {
    const exact = (div * PPQ) / this.divisions;
    if (!Number.isInteger(exact)) this.warn.add('times that are not whole ticks rounded');
    return Math.round(exact);
  }

  readPart(part: XmlElement, index: number): void {
    this.part = index;
    this.divisions = 1;
    childrenOf(part, 'measure').forEach((measure, m) => this.readMeasure(measure, m));
  }

  private readMeasure(measure: XmlElement, m: number): void {
    this.measure = m;
    if (measure.attrs.implicit === 'yes') this.implicit[m] = true;
    this.cursor = 0;
    this.lastStart = 0;
    this.reach = 0;
    for (const el of childrenOf(measure)) {
      if (el.name === 'attributes') this.readAttributes(el);
      else if (el.name === 'backup' || el.name === 'forward') this.move(el);
      else if (el.name === 'direction' || el.name === 'sound') this.readDirection(el);
      else if (el.name === 'barline') this.readBarline(el);
      else if (el.name === 'note') this.readNote(el);
    }
    this.contentLength[m] = Math.max(this.contentLength[m]!, this.reach);
    for (const left of this.pending.values()) if (left.length > 0) this.warn.add('grace notes before a rest or at the end of a measure left out');
    this.pending.clear();
  }

  private readAttributes(el: XmlElement): void {
    const d = num(child(el, 'divisions'));
    if (d !== undefined && d > 0 && d !== this.divisions) {
      // a change inside a measure: the time read so far is in the old unit
      this.cursor = (this.cursor * d) / this.divisions;
      this.lastStart = (this.lastStart * d) / this.divisions;
      this.divisions = d;
    }
    const staves = num(child(el, 'staves'));
    if (staves !== undefined) this.staves.set(this.part, Math.max(this.staves.get(this.part) ?? 1, staves));
    for (const clef of childrenOf(el, 'clef')) this.readClef(clef);
    if (this.part !== 0) return; // keys and meters come from the first part
    const key = childrenOf(el, 'key').find((k) => (k.attrs.number ?? '1') === '1');
    const fifths = num(child(key, 'fifths'));
    if (fifths !== undefined) this.keys.push({ measure: this.measure, at: this.place(this.cursor), value: { fifths: Math.max(-7, Math.min(7, Math.round(fifths))), mode: textOf(child(key, 'mode')) === 'minor' ? 'minor' : 'major' } });
    else if (key) this.warn.add('keys without fifths (non-traditional keys) read as C');
    const time = child(el, 'time');
    if (time) this.readTime(time);
  }

  private readClef(clef: XmlElement): void {
    const sign = textOf(child(clef, 'sign')).toUpperCase();
    const kind = sign === 'F' ? 'bass' : 'treble';
    if (sign === 'C') this.warn.add('C clefs read as treble');
    const track = `${this.part}:${clef.attrs.number ?? '1'}`;
    const first = this.clefs.get(track);
    if (first === undefined) this.clefs.set(track, kind);
    else if (first !== kind) this.warn.add('clef changes inside a staff not kept (the staff keeps its first clef)');
  }

  private readTime(time: XmlElement): void {
    const beats = textOf(child(time, 'beats'))
      .split('+')
      .map(Number)
      .reduce((a, b) => a + b, 0);
    const beatType = num(child(time, 'beat-type'));
    if (Number.isInteger(beats) && beats > 0 && beatType !== undefined && Number.isInteger(beatType) && beatType > 0) this.meters.push({ measure: this.measure, at: 0, value: { num: beats, den: beatType } });
    else this.warn.add('time signatures that are not a number over a number ignored');
  }

  private move(el: XmlElement): void {
    const d = num(child(el, 'duration')) ?? 0;
    this.cursor += el.name === 'backup' ? -d : d;
    if (this.cursor < 0) {
      this.warn.add('a backup past the start of a measure clamped');
      this.cursor = 0;
    }
    this.reach = Math.max(this.reach, this.place(this.cursor));
  }

  private readDirection(el: XmlElement): void {
    const at = this.place(this.cursor);
    const mark = (bpm: number, exact: boolean) => this.tempos.push({ part: this.part, measure: this.measure, at, value: { bpm, exact } });
    const sound = el.name === 'sound' ? el : child(el, 'sound');
    const tempo = Number(sound?.attrs.tempo);
    if (Number.isFinite(tempo) && tempo > 0) mark(tempo, true);
    if (el.name !== 'direction') return;
    const track = `${this.part}:${textOf(child(el, 'staff')) || '1'}`;
    for (const type of childrenOf(el, 'direction-type')) {
      for (const marks of childrenOf(type, 'dynamics')) this.addDynamics(marks, track, at);
      const metronome = child(type, 'metronome');
      const perMinute = num(child(metronome, 'per-minute'));
      const unit = BEAT_UNITS[textOf(child(metronome, 'beat-unit'))];
      if (metronome && perMinute !== undefined && perMinute > 0 && unit !== undefined) mark(perMinute * unit * (2 - 0.5 ** childrenOf(metronome, 'beat-unit-dot').length), true);
      for (const words of childrenOf(type, 'words')) {
        const bpm = tempoFromWords(textOf(words));
        if (bpm !== undefined) mark(bpm, false);
      }
    }
  }

  private readBarline(el: XmlElement): void {
    const direction = child(el, 'repeat')?.attrs.direction;
    if (direction === 'forward') this.repeatStarts.push(this.measure);
    if (direction === 'backward') this.repeatEnds.push(this.measure);
    if (child(el, 'ending')) this.endings = true;
  }

  private readNote(el: XmlElement): void {
    const track = `${this.part}:${textOf(child(el, 'staff')) || '1'}`;
    if (!this.trackOrder.includes(track)) this.trackOrder.push(track);
    const xmlVoice = textOf(child(el, 'voice')) || '1';
    const isChord = child(el, 'chord') !== undefined;
    const grace = child(el, 'grace');
    if (grace) return this.readGrace(el, grace, `${track}/${xmlVoice}`, isChord);
    const duration = num(child(el, 'duration')) ?? 0;
    const start = isChord ? this.lastStart : this.cursor;
    if (!isChord) {
      this.lastStart = this.cursor;
      this.cursor += duration;
    }
    const from = this.place(start);
    const to = this.place(start + duration);
    this.reach = Math.max(this.reach, to);
    const voiceKey = `${track}/${xmlVoice}`;
    if (child(el, 'cue') || to <= from) return this.dropGraces(voiceKey);
    if (child(el, 'rest')) {
      if (!isChord) this.rests.push({ track, xmlVoice, measure: this.measure, start: from, end: to });
      return this.dropGraces(voiceKey);
    }
    const pitch = readPitch(child(el, 'pitch'), this.warn);
    if (!pitch) {
      this.dropGraces(voiceKey);
      return this.warn.add(child(el, 'unpitched') ? 'unpitched (percussion) notes left out' : 'notes with no readable pitch left out');
    }
    const finger = textOf(childAt(el, 'notations', 'technical', 'fingering')).match(/[1-5]/)?.[0];
    const tie = childrenOf(el, 'tie').some((t) => t.attrs.type === 'start');
    this.notes.push({ track, xmlVoice, measure: this.measure, start: from, end: to, ...pitch, tie, ...(finger ? { finger: Number(finger) } : {}) });
    for (const notations of childrenOf(el, 'notations')) {
      for (const marks of childrenOf(notations, 'dynamics')) this.addDynamics(marks, track, from);
      for (const slur of childrenOf(notations, 'slur')) this.readSlur(slur, `${this.part}/${slur.attrs.number ?? '1'}`);
    }
    if (!isChord) this.attachGraces(voiceKey);
  }

  private addDynamics(marks: XmlElement, track: string, at: number): void {
    for (const mark of childrenOf(marks)) this.dynamics.push({ track, measure: this.measure, at, value: mark.name });
  }

  private readSlur(slur: XmlElement, key: string): void {
    const here = this.notes.length - 1;
    if (slur.attrs.type === 'start') this.openSlurs.set(key, here);
    else if (slur.attrs.type === 'stop') {
      const start = this.openSlurs.get(key);
      this.openSlurs.delete(key);
      if (start !== undefined) this.slurs.push({ start, end: here });
      else this.warn.add('slur ends with no start left out');
    }
  }

  private dropGraces(voiceKey: string): void {
    if ((this.pending.get(voiceKey)?.length ?? 0) > 0) this.warn.add('grace notes before a rest or at the end of a measure left out');
    this.pending.delete(voiceKey);
  }

  private readGrace(el: XmlElement, grace: XmlElement, voiceKey: string, isChord: boolean): void {
    if (isChord) return this.warn.add('grace-note chords kept as their first note');
    const pitch = readPitch(child(el, 'pitch'), this.warn);
    if (!pitch) return;
    this.pending.set(voiceKey, [...(this.pending.get(voiceKey) ?? []), { ...pitch, slash: grace.attrs.slash === 'yes' }]);
  }

  /** The graces waiting in this voice go before the note just read: the chart keeps one, the nearest (checked against the chord when the chart is made). */
  private attachGraces(voiceKey: string): void {
    const before = this.pending.get(voiceKey);
    if (!before || before.length === 0) return;
    this.pending.delete(voiceKey);
    if (before.length > 1) this.warn.add('runs of several grace notes kept as their last one');
    this.graces.push({ ...before[before.length - 1]!, main: this.notes.length - 1 });
  }
}

/** Bars from the time signatures and what each measure holds. */
function layBars(r: ScoreReader): { bars: Chart['bars']; meterAt: (m: number) => Meter } {
  const meterAt = (m: number): Meter => r.meters.filter((x) => x.measure <= m).pop()?.value ?? { num: 4, den: 4 };
  if (r.meters.length === 0) r.warn.add('no time signature: 4/4 assumed');
  const bars: Chart['bars'] = [];
  let tick = 0;
  for (let m = 0; m < r.measureCount; m++) {
    const full = Math.round((meterAt(m).num * 4 * PPQ) / meterAt(m).den);
    const content = r.contentLength[m]!;
    const pickup = r.implicit[m] || (m === 0 && content > 0 && content < full);
    const length = pickup ? content || full : Math.max(content, full);
    bars.push({ index: m, startTick: tick, endTick: tick + length });
    tick += length;
  }
  return { bars, meterAt };
}

/** One track per staff that has notes or rests, hands from staves and clefs. */
function makeTracks(r: ScoreReader, onePiano: boolean): { tracks: Chart['tracks']; ids: Map<string, string> } {
  const tracks: Chart['tracks'] = [];
  const ids = new Map<string, string>();
  for (const key of r.trackOrder) {
    const [p, staff] = key.split(':').map(Number) as [number, number];
    const staves = r.staves.get(p) ?? 1;
    const clef = r.clefs.get(key) ?? (staff >= 2 ? 'bass' : 'treble');
    if (staff > 2) r.warn.add('staves past the second read as the left hand');
    const hand = staves >= 2 || staff >= 2 ? (staff === 1 ? 'RH' : 'LH') : clef === 'bass' ? 'LH' : 'RH';
    const id = onePiano ? (staff === 1 ? 'rh' : 'lh') : `p${p + 1}s${staff}`;
    ids.set(key, id);
    tracks.push({ id, role: 'play', hand, clef });
  }
  return { tracks, ids };
}

/** One map entry per change, from tick 0; a mark at the same tick as the one before replaces it, and no entry repeats the one before. */
function changeMap<T extends object>(marks: { tick: number; value: T }[], first: T, same: (a: T, b: T) => boolean): ({ tick: number } & T)[] {
  const out: ({ tick: number } & T)[] = [{ tick: 0, ...first }];
  for (const mk of [...marks].sort((a, b) => a.tick - b.tick)) {
    const last = out[out.length - 1]!;
    if (mk.tick === last.tick) Object.assign(last, mk.value);
    else out.push({ tick: mk.tick, ...mk.value });
  }
  // a later mark at the same tick can bring a change back to what was before it
  return out.filter((entry, i) => i === 0 || !same(out[i - 1]!, entry));
}

/** Plain repeat pairs that follow each other; with first and second endings the written bars count once. */
function readRepeats(r: ScoreReader): Chart['repeats'] {
  if (r.repeatEnds.length === 0) return undefined;
  if (r.endings) {
    r.warn.add('repeats with first and second endings not kept: the bars count once, as written');
    return undefined;
  }
  const pairs: NonNullable<Chart['repeats']> = [];
  let from = 0;
  for (const end of [...new Set(r.repeatEnds)].sort((a, b) => a - b)) {
    pairs.push({ startBar: Math.max(from, ...r.repeatStarts.filter((s) => s >= from && s <= end)), endBar: end });
    from = end + 1;
  }
  return pairs;
}

function tempoMapOf(r: ScoreReader, at: (mk: Mark<unknown>) => number): Chart['tempoMap'] {
  // the first part that marks a tempo speaks for the score (as keys and meters come from the first part); a number wins over a word at the same place
  const part = Math.min(...r.tempos.map((t) => t.part), Infinity);
  const ofPart = r.tempos.filter((t) => t.part === part);
  const marks = ofPart.filter((t) => t.value.exact || !ofPart.some((o) => o.value.exact && o.measure === t.measure && o.at === t.at));
  if (marks.length === 0) r.warn.add(`no tempo in the score: ${DEFAULT_BPM} a minute assumed`);
  else if (marks.every((t) => !t.value.exact)) r.warn.add('tempo read from the tempo words only');
  const sorted = [...marks].sort((a, b) => at(a) - at(b));
  return changeMap(
    sorted.map((mk) => ({ tick: at(mk), value: { bpm: Math.round(mk.value.bpm * 100) / 100 } })),
    { bpm: Math.round((sorted[0]?.value.bpm ?? DEFAULT_BPM) * 100) / 100 },
    (a, b) => a.bpm === b.bpm,
  );
}

/** Slurs whose two ends are notes of one track and voice at different times; one slur at a time per voice. */
function chartSlurs(r: ScoreReader, notes: Chart['notes']): NonNullable<Chart['slurs']> {
  if (r.openSlurs.size > 0) r.warn.add('slurs that never end left out');
  const out: NonNullable<Chart['slurs']> = [];
  const candidates = r.slurs
    .map(({ start, end }) => ({ a: notes[start]!, b: notes[end]! }))
    .sort((x, y) => x.a.tick - y.a.tick || y.b.tick - x.b.tick);
  for (const { a, b } of candidates) {
    if (a.track !== b.track || a.voice !== b.voice || b.tick <= a.tick) {
      r.warn.add('slurs across staves or voices, or on one chord, left out');
      continue;
    }
    if (out.some((o) => o.track === a.track && o.voice === a.voice && a.tick <= o.endTick && o.startTick <= b.tick)) {
      r.warn.add('nested or overlapping slurs kept as the outer one');
      continue;
    }
    out.push({ track: a.track, voice: a.voice, startTick: a.tick, endTick: b.tick });
  }
  return out;
}

/** Each dynamic mark goes on the first note of its staff from its place on (the lowest of a chord); pp to ff only. */
function applyDynamics(r: ScoreReader, notes: Chart['notes'], ids: Map<string, string>, at: (mk: { measure: number; at: number }) => number): void {
  const marks = r.dynamics.map((d) => ({ ...d, tick: at(d) })).sort((x, y) => x.tick - y.tick);
  for (const mark of marks) {
    if (!isDynamic(mark.value)) {
      r.warn.add('dynamic marks other than pp, p, mp, mf, f and ff left out');
      continue;
    }
    const track = ids.get(mark.track);
    const note = notes.find((x) => x.track === track && x.tick >= mark.tick);
    if (note) note.dynamic = mark.value;
    else r.warn.add('dynamic marks after the last note of their staff left out');
  }
}

/** Read a MusicXML document's text as a chart named `id`. */
export function musicXmlToChart(text: string, id: string): MusicXmlResult {
  let root: XmlElement;
  try {
    root = parseXml(text);
  } catch (e) {
    return { ok: false, reason: `not readable XML: ${e instanceof XmlError ? e.message : String(e)}` };
  }
  if (root.name === 'score-timewise') return { ok: false, reason: 'a score-timewise file: save it as score-partwise (the usual MusicXML)' };
  if (root.name !== 'score-partwise') return { ok: false, reason: `not a MusicXML score (the root is <${root.name}>)` };
  const parts = childrenOf(root, 'part');
  const measureCount = parts.reduce((most, p) => Math.max(most, childrenOf(p, 'measure').length), 0);
  if (measureCount === 0) return { ok: false, reason: 'the score has no measures' };

  const r = new ScoreReader(measureCount);
  parts.forEach((part, p) => r.readPart(part, p));
  if (r.notes.length === 0) return { ok: false, reason: 'the score has no notes to play' };

  const { bars, meterAt } = layBars(r);
  const at = (mk: { measure: number; at: number }) => bars[mk.measure]!.startTick + mk.at;
  const { tracks, ids } = makeTracks(r, parts.length === 1 && (r.staves.get(0) ?? 1) === 2 && r.trackOrder.every((t) => t === '0:1' || t === '0:2'));
  const voiceIds = new Map<string, number>();
  const voiceOf = (track: string, xmlVoice: string): number => {
    const key = `${track}/${xmlVoice}`;
    const known = voiceIds.get(key);
    if (known !== undefined) return known;
    const before = [...voiceIds.keys()].filter((k) => k.startsWith(`${track}/`)).length;
    if (before >= 4) r.warn.add('voices past the fourth in a staff merged into the fourth');
    const v = Math.min(4, before + 1);
    voiceIds.set(key, v);
    return v;
  };

  const notes: Chart['notes'] = r.notes.map((n) => {
    const spelling = { step: n.step, alter: n.alter, octave: n.octave };
    return {
      tick: at({ measure: n.measure, at: n.start }),
      dur: n.end - n.start,
      midi: spellingToMidi(spelling),
      spelling,
      track: ids.get(n.track)!,
      voice: voiceOf(n.track, n.xmlVoice),
      bar: n.measure,
      ...(n.finger !== undefined ? { finger: n.finger } : {}),
      ...(n.tie ? { tieNext: true } : {}),
    };
  });
  // the chart's main note of a grace is the lowest note its voice starts at that tick
  const lowest = new Map<string, number>();
  for (const x of notes) {
    const key = `${x.track}/${x.voice}/${x.tick}`;
    lowest.set(key, Math.min(lowest.get(key) ?? Infinity, x.midi));
  }
  const graces: NonNullable<Chart['graces']> = [];
  for (const g of r.graces) {
    const main = notes[g.main]!;
    const spelling = { step: g.step, alter: g.alter, octave: g.octave };
    const midi = spellingToMidi(spelling);
    if (graces.some((o) => o.track === main.track && o.voice === main.voice && o.tick === main.tick)) r.warn.add('a second grace note on one note left out');
    else if (midi === lowest.get(`${main.track}/${main.voice}/${main.tick}`)) r.warn.add("grace notes on the main note's own pitch left out");
    else graces.push({ track: main.track, voice: main.voice, tick: main.tick, pitch: { midi, spelling }, slash: g.slash });
  }
  const rests: Chart['rests'] = r.rests
    .filter((x) => ids.has(x.track))
    .map((x) => ({ tick: at({ measure: x.measure, at: x.start }), dur: x.end - x.start, track: ids.get(x.track)!, voice: voiceOf(x.track, x.xmlVoice), bar: x.measure }));

  const slurs = chartSlurs(r, notes);
  notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi);
  applyDynamics(r, notes, ids, at);
  const repeats = readRepeats(r);
  const midis = [...notes.map((n) => n.midi), ...graces.map((g) => g.pitch.midi)];
  const chart = {
    schemaVersion: CHART_SCHEMA_VERSION,
    id,
    contentVersion: 1,
    title: textOf(childAt(root, 'work', 'work-title')) || textOf(child(root, 'movement-title')) || id,
    level: 1,
    ppq: PPQ,
    tempoMap: tempoMapOf(r, at),
    meterMap: changeMap(
      r.meters.map((mk) => ({ tick: at(mk), value: mk.value })),
      meterAt(0),
      (a, b) => a.num === b.num && a.den === b.den,
    ),
    keyMap: changeMap(
      r.keys.map((mk) => ({ tick: at(mk), value: mk.value })),
      r.keys[0]?.value ?? { fifths: 0, mode: 'major' },
      (a, b) => a.fifths === b.fifths && a.mode === b.mode,
    ),
    tracks,
    notes,
    rests,
    bars,
    phrases: [],
    ...(repeats ? { repeats } : {}),
    ...(slurs.length > 0 ? { slurs } : {}),
    ...(graces.length > 0 ? { graces } : {}),
    range: { low: midis.reduce((a, b) => Math.min(a, b)), high: midis.reduce((a, b) => Math.max(a, b)) },
  };
  const parsed = chartSchema.safeParse(chart);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, reason: `the reading broke a chart rule: ${issue.message} at ${issue.path.join('.')}` };
  }
  return { ok: true, chart: parsed.data, warnings: r.warn.list() };
}

/** The score inside a compressed `.mxl`: the one `META-INF/container.xml` names, else the first `.xml` outside META-INF. */
export function mxlRootPath(containerXml: string | undefined, names: readonly string[]): string | undefined {
  if (containerXml) {
    try {
      const path = childAt(parseXml(containerXml), 'rootfiles', 'rootfile')?.attrs['full-path'];
      if (path && names.includes(path)) return path;
    } catch {
      // a damaged container: take the first score file
    }
  }
  return names.find((n) => !n.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(n));
}

/** Text of a score file: UTF-8, or UTF-16 when it starts with a byte-order mark (some exporters write it). */
export function scoreText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

/** The score text inside a compressed MusicXML archive, given its entries and a way to read one (sync zlib, or pre-read). */
export function mxlScoreText(entries: readonly ZipEntry[], contents: (entry: ZipEntry) => Uint8Array): string {
  const container = entries.find((e) => e.name === 'META-INF/container.xml');
  const path = mxlRootPath(container ? scoreText(contents(container)) : undefined, entries.map((e) => e.name));
  const score = entries.find((e) => e.name === path);
  if (!score) throw new Error('no score file inside the .mxl');
  return scoreText(contents(score));
}
