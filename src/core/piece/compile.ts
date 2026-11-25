import { PPQ, barIndexAtTick, chartSchema, crossingParts, ticksPerBar, pieceMetaSchema, type BarSpan, type Chart, type PieceMeta } from '../chart';
import { formatIssues } from '../issues';
import { parseAbc, type AbcVoice } from './abc';
import { hasErrors, type Diagnostic } from './diagnostics';

export interface CompileInput {
  /** Contents of `piece.abc`. */
  abc: string;
  /** Contents of `piece.meta.json`. */
  meta: string;
  abcFile?: string;
  metaFile?: string;
}

/** Where in `piece.abc` something was written (1-based). */
export interface SourceLocation {
  line: number;
  column: number;
}

export interface CompileResult {
  /** The chart, or null when there is any error. */
  chart: Chart | null;
  meta: PieceMeta | null;
  diagnostics: Diagnostic[];
  /** Source positions aligned with `chart.notes` and `chart.rests`, so later checks can point into the ABC file. */
  sources: { notes: SourceLocation[]; rests: SourceLocation[] } | null;
}

const DEFAULT_BPM = 80;
const VOICE_IDS = ['RH', 'LH', 'ACC'] as const;

/**
 * Compile `piece.abc` plus `piece.meta.json` into the chart the game loads (docs/authoring/au03-chart-format.md).
 * Voices become tracks: RH and LH that the meta lists in `hands` are play tracks, other voices are accompaniment.
 * A piece without V: lines is a single voice for the one hand the meta names.
 * Linting a piece against a level is a separate step (the piece linter); this only refuses what cannot be a valid chart.
 */
export function compilePiece(input: CompileInput): CompileResult {
  const abcFile = input.abcFile ?? 'piece.abc';
  const metaFile = input.metaFile ?? 'piece.meta.json';
  const diagnostics: Diagnostic[] = [];
  const error = (file: string, message: string, line?: number) => {
    diagnostics.push({ severity: 'error', file, ...(line === undefined ? {} : { line }), message });
  };
  const fail = (): CompileResult => ({ chart: null, meta: null, diagnostics, sources: null });

  let rawMeta: unknown;
  try {
    rawMeta = JSON.parse(input.meta);
  } catch (e) {
    error(metaFile, `not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return fail();
  }
  const metaResult = pieceMetaSchema.safeParse(rawMeta);
  if (!metaResult.success) {
    for (const line of formatIssues(metaResult.error)) error(metaFile, line);
    return fail();
  }
  const meta = metaResult.data;

  const parsed = parseAbc(input.abc, abcFile);
  diagnostics.push(...parsed.diagnostics);
  const failedMeta: CompileResult = { chart: null, meta, diagnostics, sources: null };
  if (hasErrors(diagnostics)) return failedMeta;

  const voices = resolveVoices(parsed.voices, meta, abcFile, metaFile, error);
  if (!voices || hasErrors(diagnostics)) return failedMeta;
  const meter = parsed.meter!;
  const barTicks = ticksPerBar(meter);

  const barCounts = new Set(voices.map((v) => v.voice.bars));
  if (barCounts.size > 1) {
    error(abcFile, `the voices have different numbers of bars (${voices.map((v) => `${v.voice.id} has ${v.voice.bars}`).join(', ')})`);
    return failedMeta;
  }
  const barCount = voices[0]!.voice.bars;
  // d120: every voice starts with the same pick-up and ends on the same tick (with a pick-up the last bar is short: the two make one bar).
  const pickup = voices[0]!.voice.pickup;
  if (voices.some((v) => v.voice.pickup !== pickup)) {
    error(abcFile, `every voice must start with the same pick-up (${voices.map((v) => `${v.voice.id} ${v.voice.pickup / PPQ} beats`).join(', ')}); a whole-bar rest Z fills a whole bar, so in a pick-up write a rest with its length (z)`);
    return failedMeta;
  }
  const endTick = voices[0]!.voice.endTick;
  if (voices.some((v) => v.voice.endTick !== endTick)) {
    error(abcFile, `every voice must end on the same beat; the last bar differs (${voices.map((v) => `${v.voice.id} ends at beat ${v.voice.endTick / PPQ}`).join(', ')})`);
    return failedMeta;
  }
  const repeats = voices[0]!.voice.repeats;
  if (voices.some((v) => JSON.stringify(v.voice.repeats) !== JSON.stringify(repeats))) {
    error(abcFile, 'every voice must have the same repeat signs at the same bar lines');
    return failedMeta;
  }
  if (barCount === 0 || voices.every((v) => !v.voice.items.some((i) => i.kind === 'notes'))) {
    error(abcFile, 'the piece has no notes');
    return failedMeta;
  }

  if (parsed.title !== undefined && parsed.title !== meta.title) {
    diagnostics.push({ severity: 'warning', file: abcFile, message: `T: "${parsed.title}" differs from the title in ${metaFile} ("${meta.title}"); the meta file wins` });
  }
  if (parsed.bpm === undefined) {
    diagnostics.push({ severity: 'warning', file: abcFile, message: `no Q: tempo, assuming ${DEFAULT_BPM} beats per minute` });
  }

  // Printed bar numbers (d120, core_09.AC25): with a pick-up it is bar 0 and the first full bar is 1, so bar n is index n.
  const firstPrinted = pickup > 0 ? 0 : 1;
  checkPhrases(meta.phrases, barCount, firstPrinted, metaFile, error);
  if (hasErrors(diagnostics)) return failedMeta;

  const bars = barSpans(pickup, barTicks, barCount, endTick);
  const barOf = (tick: number) => barIndexAtTick(bars, tick);
  const noted = voices
    .flatMap(({ voice, trackIndex, track }) =>
      voice.items.flatMap((item) =>
        item.kind === 'notes'
          ? item.notes.map((n) => ({
              trackIndex,
              where: { line: item.line, column: item.column },
              note: {
                tick: item.tick, dur: item.dur, midi: n.midi, spelling: n.spelling, track: track.id, voice: item.voice ?? 1,
                bar: barOf(item.tick),
                ...(n.finger === undefined ? {} : { finger: n.finger }),
                ...(n.tieNext ? { tieNext: true } : {}),
                ...(n.dynamic === undefined ? {} : { dynamic: n.dynamic }),
              },
            }))
          : [],
      ),
    )
    .sort((a, b) => a.note.tick - b.note.tick || a.trackIndex - b.trackIndex || a.note.midi - b.note.midi);
  const notes = noted.map((e) => e.note);

  const restful = voices
    .flatMap(({ voice, trackIndex, track }) =>
      voice.items.flatMap((item) =>
        item.kind === 'rest'
          ? [{ trackIndex, where: { line: item.line, column: item.column }, rest: { tick: item.tick, dur: item.dur, track: track.id, voice: item.voice ?? 1, bar: barOf(item.tick) } }]
          : [],
      ),
    )
    .sort((a, b) => a.rest.tick - b.rest.tick || a.trackIndex - b.trackIndex || a.rest.voice - b.rest.voice);
  const rests = restful.map((e) => e.rest);

  const slurs = voices.flatMap(({ voice, track }) => voice.slurs.map((s) => ({ track: track.id, voice: s.voice ?? 1, startTick: s.startTick, endTick: s.endTick })));
  // Triplets (core_09.AC49, d163): three in the time of two, from the first member's start to the last's.
  const tuplets = voices.flatMap(({ voice, track }) => voice.tuplets.map((t) => ({ track: track.id, voice: t.voice ?? 1, startTick: t.startTick, endTick: t.endTick, actual: 3, normal: 2 })));
  // Grace notes (core_09.AC31, d121): each sits on the start of its main note, in the voice's track.
  const graces = voices
    .flatMap(({ voice, track }) =>
      voice.items.flatMap((item) =>
        item.kind === 'notes' && item.grace
          ? [{ track: track.id, voice: item.voice ?? 1, tick: item.tick, pitch: { midi: item.grace.note.midi, spelling: item.grace.note.spelling }, slash: item.grace.slash }]
          : [],
      ),
    )
    .sort((a, b) => a.tick - b.tick);

  const midis = notes.map((n) => n.midi);
  const meterMap = [{ tick: 0, num: meter.num, den: meter.den }];
  const chart = {
    schemaVersion: 2,
    id: meta.id,
    contentVersion: meta.contentVersion,
    title: meta.title,
    ...(meta.titles ? { titles: meta.titles } : {}),
    level: meta.level,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: parsed.bpm ?? DEFAULT_BPM }],
    meterMap,
    keyMap: [{ tick: 0, fifths: parsed.key.fifths, mode: parsed.key.mode }, ...(parsed.keyChanges ?? [])],
    tracks: voices.map((v) => v.track),
    notes,
    rests,
    bars,
    phrases: meta.phrases.map((p) => ({ name: p.name, startBar: p.bars[0] - firstPrinted, endBar: p.bars[1] - firstPrinted })),
    ...(repeats.length > 0 ? { repeats } : {}),
    ...(slurs.length > 0 ? { slurs } : {}),
    ...(graces.length > 0 ? { graces } : {}),
    ...(tuplets.length > 0 ? { tuplets } : {}),
    range: { low: Math.min(...midis), high: Math.max(...midis) },
  };

  const checked = chartSchema.safeParse(chart);
  if (!checked.success) {
    for (const issue of checked.error.issues) error(abcFile, `internal error, the compiled chart is invalid: ${issue.path.join('.')}: ${issue.message}`);
    return failedMeta;
  }
  return { chart: checked.data, meta, diagnostics, sources: { notes: noted.map((e) => e.where), rests: restful.map((e) => e.where) } };
}

/**
 * The bars of a piece (d120): a pick-up (`pickup` ticks, 0 for none) is a short bar 0, then full bars; the last ends at
 * `endTick`, short by the pick-up's length when there is one (the parser holds each voice to that). One meter for the whole piece, as the compiler reads only one M: line.
 */
function barSpans(pickup: number, barTicks: number, barCount: number, endTick: number): BarSpan[] {
  const bars: BarSpan[] = [];
  let tick = 0;
  for (let index = 0; index < barCount; index++) {
    const length = index === 0 && pickup > 0 ? pickup : barTicks;
    const end = index === barCount - 1 ? endTick : tick + length;
    bars.push({ index, startTick: tick, endTick: end });
    tick = end;
  }
  return bars;
}

/**
 * Each phrase's bars must fit the piece, and phrases may nest but not cross (a part is a section of the piece). Bars are
 * numbered as printed: from `firstPrinted` (0 with a pick-up, else 1).
 */
function checkPhrases(phrases: PieceMeta['phrases'], barCount: number, firstPrinted: number, metaFile: string, error: (file: string, message: string) => void): void {
  const lastPrinted = barCount - 1 + firstPrinted;
  for (const phrase of phrases) {
    const [first, last] = phrase.bars;
    if (first > last || first < firstPrinted || last > lastPrinted) {
      error(metaFile, `phrase "${phrase.name}": bars ${first} to ${last} do not fit a piece of ${firstPrinted === 0 ? `bars 0 to ${lastPrinted} (bar 0 is the pick-up)` : `${barCount} bars`}`);
    }
  }
  const parts = phrases.map((p) => ({ name: p.name, startBar: p.bars[0] - firstPrinted, endBar: p.bars[1] - firstPrinted }));
  for (const [a, b] of crossingParts(parts)) {
    error(metaFile, `phrases "${a.name}" and "${b.name}" cross; parts may nest but not cross`);
  }
}

interface ResolvedVoice {
  voice: AbcVoice;
  trackIndex: number;
  track: Chart['tracks'][number];
}

function resolveVoices(
  voices: AbcVoice[],
  meta: PieceMeta,
  abcFile: string,
  metaFile: string,
  error: (file: string, message: string, line?: number) => void,
): ResolvedVoice[] | null {
  if (voices.length === 0) {
    error(abcFile, 'the piece has no music');
    return null;
  }
  let named = voices;
  if (voices.length === 1 && voices[0]!.id === '') {
    if (meta.hands.length !== 1) {
      error(abcFile, `a piece without V: lines is for one hand, but ${metaFile} lists hands ${meta.hands.join(' and ')}; add V:RH and V:LH lines`);
      return null;
    }
    named = [{ ...voices[0]!, id: meta.hands[0]! }];
  }

  const out: ResolvedVoice[] = [];
  named.forEach((voice, trackIndex) => {
    if (!(VOICE_IDS as readonly string[]).includes(voice.id)) {
      error(abcFile, `voice "${voice.id}" is not supported (use RH, LH or ACC)`, voice.line);
      return;
    }
    const isPlayed = (meta.hands as string[]).includes(voice.id);
    const hand = voice.id === 'ACC' ? null : (voice.id as 'RH' | 'LH');
    out.push({
      voice,
      trackIndex,
      track: {
        id: voice.id.toLowerCase(),
        role: isPlayed ? 'play' : 'accompaniment',
        hand,
        clef: voice.clef ?? (voice.id === 'LH' ? 'bass' : 'treble'),
      },
    });
  });
  for (const hand of meta.hands) {
    if (!named.some((v) => v.id === hand)) error(metaFile, `hands lists ${hand}, but the piece has no V:${hand} voice`);
  }
  return out;
}
