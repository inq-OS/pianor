// Covers ft_Y_04.AC9, ft_Y_04.AC10, ft_Y_04.AC11.
import { describe, expect, it } from 'vitest';
import type { Chart } from '../chart/schema';
import { compilePiece } from '../piece/compile';
import { musicXmlToChart } from './musicxml';
import { chartToAbc, type ChartAbcOptions } from './toAbc';

const meta = (hands: readonly string[]) =>
  JSON.stringify({ id: 't', title: 'T', level: 1, status: 'draft', hands, phrases: [], source: 'synthetic', license: 'CC0-1.0', generator: { kind: 'test' } });

/** synthetic: a piece compiled from ABC, as the game would load it. */
function compile(abc: string, hands: readonly string[] = ['RH']): Chart {
  const r = compilePiece({ abc, meta: meta(hands) });
  if (!r.chart) throw new Error(`${r.diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`).join('\n')}\n${abc}`);
  return r.chart;
}

function write(chart: Chart, options?: ChartAbcOptions) {
  const r = chartToAbc(chart, options);
  if (!r.ok) throw new Error(`${r.reason}: ${JSON.stringify(r.problems)}`);
  return r;
}

/** What a piece plays and shows, without the ids the two paths name differently. */
const music = (c: Chart) => ({
  notes: c.notes.map((n) => [n.tick, n.dur, n.midi, n.spelling.alter, n.track, n.finger, n.tieNext, n.dynamic]),
  graces: (c.graces ?? []).map((g) => [g.tick, g.track, g.pitch.midi, g.slash]),
  slurs: (c.slurs ?? []).map((s) => [s.track, s.startTick, s.endTick]),
  repeats: c.repeats ?? [],
  bars: c.bars.map((b) => [b.startTick, b.endTick]),
  meter: c.meterMap,
  key: c.keyMap,
  tempo: c.tempoMap,
  tracks: c.tracks.map((t) => [t.id, t.hand, t.clef]),
});

/** The chart written as ABC and compiled again plays the same notes. */
function roundTrip(abc: string, hands: readonly string[] = ['RH']) {
  const chart = compile(abc, hands);
  const out = write(chart);
  expect(music(compile(out.abc, out.hands))).toEqual(music(chart));
  return out;
}

const head = (extra = '', meter = '4/4', key = 'C') => `X:1\nT:T\nM:${meter}\nL:1/8\nQ:1/4=90\nK:${key}\n${extra}`;
const twoHands = (rh: string, lh: string, h = head()) => `${h}V:RH clef=treble\nV:LH clef=bass\nV:RH\n${rh}\nV:LH\n${lh}\n`;

describe('a chart written as a game piece (ft_Y_04.AC9)', () => {
  it('ft_Y_04.AC9 keeps lengths from a whole note to a sixteenth, dotted ones, rests and chords in both hands', () => {
    const out = roundTrip(twoHands('C8 | D6 E2 | F4 G3 A | B2 c3/2 d/2 e/2 f/2 g z2 | [CEG]4 z4 |]', 'C,8 | Z | z2 G,,2 [C,E,]4 | C,6 z2 | C,8 |]'), ['RH', 'LH']);
    expect(out.hands).toEqual(['RH', 'LH']);
    expect(out.warnings).toEqual([]);
    expect(out.abc).toContain('V:RH clef=treble\nV:LH clef=bass');
  });

  it('ft_Y_04.AC9 keeps accidentals to the bar line, double ones, and an accidental carried by a tie', () => {
    roundTrip(head('', '4/4', 'G') + '^^F2 F2 =F2 _B2 | __B2 ^c2- c4 | F2 ^G2- G2 g2 |]');
    roundTrip(head('', '3/4', 'Bb') + '=B2 B2 _B2 | ^A6- | A2 =E2 E2 |]');
  });

  it('ft_Y_04.AC9 keeps meter, key, tempo, fingerings, dynamics, ties, slurs, grace notes and repeats', () => {
    roundTrip(head('', '3/4', 'Dm') + '!p!!1!D2 (!2!E2 F2 | {/^G}A6- | A2) !f!{B}c2 (d2 | e2 d2) c2 |: [D^F]6- | [DF]6 :|: A2 G2 F2 | E6 :|]');
  });

  it('ft_Y_04.AC9 keeps a pick-up, and breaks long voices into lines of four bars', () => {
    const out = roundTrip(head('', '3/4') + 'G2 | c4 e2 | d6 | c2 d2 e2 | f6 | g6 | e4 |]');
    expect(out.abc).toContain('V:RH\nG2 | c4 e2 | d6 | c2 d2 e2 |\nf6 | g6 | e4 |]');
  });

  it('ft_Y_04.AC9 the pick-up of a score whose last bar is whole: cut when nothing is played past the beats the pick-up lacks', () => {
    const chart = compile(head() + 'G2 c2 | d8 | c4 |]');
    const out = write({ ...chart, bars: chart.bars.map((b, i) => (i === 2 ? { ...b, endTick: b.endTick + 960 } : b)) });
    expect(out.abc).toContain('G2 c2 | d8 | c4 |]');
    expect(compile(out.abc).bars.map((b) => b.endTick - b.startTick)).toEqual([960, 1920, 960]);
  });

  it('ft_Y_04.AC9 makes the pick-up a whole bar with rests in front when the last bar is whole too', () => {
    const r = musicXmlToChart(xml([`${attrs()}${note('G', 4, 1)}`, note('C', 5, 4), note('D', 5, 4)], true), 'x');
    if (!r.ok) throw new Error(r.reason);
    const out = write(r.chart);
    expect(out.abc).toContain('z6 G2 | c8 | d8 |]');
    expect(out.warnings).toEqual(['the pick-up is written as a whole bar with rests in front, because the last bar is whole']);
    const back = compile(out.abc);
    expect(back.notes.map((n) => [n.tick, n.midi])).toEqual([[1440, 67], [1920, 72], [3840, 74]]);
  });

  it('ft_Y_04.AC9 fills a short last bar with rests, and a one-bar piece too', () => {
    const one = compile(head() + 'C2 D2 E2 F2 |]');
    expect(write({ ...one, bars: [{ index: 0, startTick: 0, endTick: 1920 }] }).abc).toContain('C2 D2 E2 F2 |]');
    const short = { ...one, notes: one.notes.slice(0, 2), bars: [{ index: 0, startTick: 0, endTick: 960 }] };
    expect(write(short).abc).toContain('C2 D2 z4 |]');
  });

  it('ft_Y_04.AC9 two voices of one hand that move together become chords; voices in unison are played once', () => {
    const r = musicXmlToChart(xml([`${attrs()}${note('E', 4, 2, '<voice>1</voice>')}${note('F', 4, 2, '<voice>1</voice>')}<backup><duration>4</duration></backup>${note('C', 4, 2, '<voice>2</voice>')}${note('F', 4, 2, '<voice>2</voice>')}`]), 'x');
    if (!r.ok) throw new Error(r.reason);
    const out = write(r.chart);
    expect(out.abc).toContain('[CE]4 F4 |]');
    expect(out.warnings).toEqual(['the right hand has the same note twice at once (two voices in unison): it is played once']);
  });

  it('ft_Y_04.AC9 the title from the options, cleaned for ABC; a tempo change kept as the first tempo', () => {
    const chart = compile(head() + 'C8 | D8 |]');
    const out = write({ ...chart, tempoMap: [{ tick: 0, bpm: 72.4 }, { tick: 1920, bpm: 100 }] }, { title: 'Song % one\nline' });
    expect(out.abc).toContain('T:Song one line\n');
    expect(out.abc).toContain('Q:1/4=72\n');
    expect(out.warnings).toEqual(['tempo changes are left out: the whole piece goes at 72 beats a minute']);
  });
});

describe('what the game piece cannot hold (ft_Y_04.AC10)', () => {
  const base = compile(head() + 'C2 D2 E2 F2 | G8 |]');

  it('ft_Y_04.AC10 refuses the whole piece for a meter or key it does not read, or a change of either', () => {
    expect(chartToAbc({ ...base, meterMap: [{ tick: 0, num: 6, den: 8 }] })).toMatchObject({ ok: false, reason: 'the meter 6/8: the game reads 4/4, 3/4 and 2/4' });
    expect(chartToAbc({ ...base, meterMap: [...base.meterMap, { tick: 1920, num: 3, den: 4 }] })).toMatchObject({ ok: false, reason: 'the meter changes inside the piece' });
    expect(chartToAbc({ ...base, keyMap: [...base.keyMap, { tick: 1920, fifths: 1, mode: 'major' }] })).toMatchObject({ ok: false, reason: 'the key changes inside the piece' });
  });

  it('ft_Y_04.AC10 refuses bars it cannot write: longer than the meter, or short inside the piece', () => {
    const three = compile(head() + 'C8 | D8 | E8 |]');
    const long = { ...three, bars: [{ index: 0, startTick: 0, endTick: 2400 }, { index: 1, startTick: 2400, endTick: 3840 }, { index: 2, startTick: 3840, endTick: 5760 }] };
    expect(chartToAbc(long)).toMatchObject({ ok: false, reason: 'bar 1 is longer than a 4/4 bar' });
    const split = { ...three, bars: [{ index: 0, startTick: 0, endTick: 1920 }, { index: 1, startTick: 1920, endTick: 2880 }, { index: 2, startTick: 2880, endTick: 5760 }] };
    expect(chartToAbc(split)).toMatchObject({ ok: false, reason: expect.stringContaining('bar 2 is shorter than the others') });
  });

  it('ft_Y_04.AC10 lists every place by bar and beat: a triplet, a thirty-second, a double dot, two voices, a bar line crossed', () => {
    const notes = (...ns: [number, number, number][]) => ns.map(([tick, dur, midi]) => ({ ...base.notes[0]!, tick, dur, midi, spelling: { step: 'C' as const, alter: 0, octave: Math.floor(midi / 12) - 1 }, bar: Math.floor(tick / 1920) }));
    const chart: Chart = {
      ...base,
      range: { low: 36, high: 96 },
      notes: notes([0, 160, 60], [160, 160, 60], [320, 160, 60], [480, 60, 60], [540, 420, 60], [960, 480, 60], [960, 240, 72], [1440, 960, 60], [2400, 960, 72], [3360, 480, 60]),
    };
    const r = chartToAbc(chart);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('7 places the game cannot write yet');
    expect(r.problems.map((p) => [p.bar, p.beat, p.hand, p.what])).toEqual([
      [1, 1, 'RH', 'a triplet or another tuplet'],
      [1, 1.333, 'RH', 'a triplet or another tuplet'],
      [1, 1.667, 'RH', 'a triplet or another tuplet'],
      [1, 2, 'RH', 'a note shorter than a sixteenth (a thirty-second)'],
      [1, 2.125, 'RH', 'a double-dotted note'],
      [1, 3, 'RH', 'notes that start together end apart (two voices in one hand)'],
      [1, 4, 'RH', 'a note across a bar line'],
    ]);
    const overlap = chartToAbc({ ...base, notes: notes([0, 960, 60], [480, 480, 64], [1920, 1920, 60]) });
    expect(overlap).toMatchObject({ ok: false, problems: [{ bar: 1, beat: 2, what: 'a note starts while the one before still sounds (two voices in one hand)' }] });
    const offGrid = chartToAbc({ ...base, bars: [{ index: 0, startTick: 0, endTick: 1920 }, { index: 1, startTick: 1920, endTick: 3840 }], notes: notes([60, 240, 60], [1920, 1920, 60]) });
    expect(offGrid).toMatchObject({ ok: false, problems: [{ bar: 1, beat: 1.125, what: 'a note off the sixteenth grid (after a triplet)' }] });
    const odd = chartToAbc({ ...base, notes: notes([0, 1200, 60], [1920, 1920, 60]) });
    expect(odd).toMatchObject({ ok: false, problems: [{ what: 'a note of 2.5 beats, which the staff does not draw as one note' }] });
    const dotted16 = chartToAbc({ ...base, notes: notes([0, 180, 60], [1920, 1920, 60]) });
    expect(dotted16).toMatchObject({ ok: false, problems: [{ what: 'a dotted sixteenth' }] });
  });

  it('ft_Y_04.AC10 numbers the bars as the score prints them: a pick-up is bar 0', () => {
    const chart = compile(head() + 'G2 | c8 | d6 |]');
    const r = chartToAbc({ ...chart, notes: chart.notes.map((n, i) => (i === 1 ? { ...n, dur: 640 } : n)) });
    expect(r).toMatchObject({ ok: false, problems: [{ bar: 1, beat: 1, hand: 'RH' }] });
  });

  it('ft_Y_04.AC10 asks which part a hand plays when the score has two for it, and leaves the others out with a warning', () => {
    const two = { ...base, tracks: [...base.tracks, { id: 'p2s1', role: 'play' as const, hand: 'RH' as const, clef: 'treble' as const }], notes: [...base.notes, ...base.notes.map((n) => ({ ...n, track: 'p2s1' }))] };
    expect(chartToAbc(two)).toMatchObject({ ok: false, reason: 'more than one part for the right hand (rh, p2s1): choose the one to play' });
    const picked = write(two, { tracks: { RH: 'p2s1' } });
    expect(picked.warnings).toEqual(['the part rh is left out (only one part for each hand is played)']);
    expect(chartToAbc(two, { tracks: { RH: 'p2s1', LH: 'nope' } })).toMatchObject({ ok: false, reason: 'there is no part "nope" with notes (parts: rh, p2s1)' });
    expect(chartToAbc({ ...base, notes: [] })).toMatchObject({ ok: false, reason: 'no part has notes to play' });
  });
});

describe('marks the game piece cannot hold where they stand (ft_Y_04.AC11)', () => {
  it('ft_Y_04.AC11 leaves out a tie on some notes of a chord, a tie with no target, and a tie or slur across a repeat sign', () => {
    const chart = compile(head() + '[CE]2 [CE]2 E2 F2 |: F4 G2 A2 :| c8 |]');
    const notes = chart.notes.map((n, i) => (i === 0 || i === 4 || i === 5 ? { ...n, tieNext: true } : n));
    const out = write({ ...chart, notes });
    expect(out.warnings).toEqual([
      'bar 1, beat 1 (right hand): a tie on some notes of a chord is left out (the game ties a whole chord)',
      'bar 1, beat 3 (right hand): a tie with no note of the same pitch after it is left out',
      'bar 1, beat 4 (right hand): a tie across a repeat sign is left out',
    ]);
    const crossing = { ...chart, slurs: [{ track: 'rh', voice: 1, startTick: 2880, endTick: 3840 }] };
    expect(write(crossing).warnings).toEqual(['bar 2, beat 3 (right hand): a slur across a repeat sign is left out']);
  });

  it('ft_Y_04.AC11 leaves out a grace note before a chord, on a tied note, of its own pitch, or one of the pitch before it', () => {
    const chart = compile(head() + '[CE]2 D2- D2 F2 | G8 |]');
    const grace = (tick: number, midi: number) => ({ track: 'rh', voice: 1, tick, pitch: { midi, spelling: { step: 'B' as const, alter: 0, octave: 3 } }, slash: false });
    const out = write({ ...chart, graces: [grace(0, 59), grace(480, 59), grace(960, 59), grace(1440, 65), grace(1920, 59), grace(1920, 59)] });
    expect(out.warnings).toEqual([
      'bar 1, beat 1 (right hand): a grace note before a chord is left out',
      'bar 1, beat 3 (right hand): a grace note on the second note of a tie is left out',
      "bar 1, beat 4 (right hand): a grace note of its main note's pitch is left out",
      'bar 2, beat 1 (right hand): a grace note of the pitch of the grace before it is left out',
    ]);
    expect(out.abc).toContain('[CE]2 {B,}D2- D2 F2 | {B,}G8 |]');
  });

  it('core_09.AC66 writes a grace group in its order and an ornament sign, and they compile back the same', () => {
    const chart = compile(head() + '{/^FE}D2 !turn!E2 !trill!F2 !mordent!G2 | C8 |]');
    const out = write(chart);
    expect(out.warnings).toEqual([]);
    expect(out.abc).toContain('{/^FE}D2 !turn!E2 !trill!F2 !lowermordent!G2');
    const back = compile(out.abc);
    expect(back.graces).toEqual(chart.graces);
    expect(back.ornaments).toEqual(chart.ornaments);
  });

  it('ft_Y_04.AC11 keeps one dynamic on a chord whose voices bring two', () => {
    const chart = compile(head() + '[CE]8 |]');
    const out = write({ ...chart, notes: chart.notes.map((n, i) => ({ ...n, dynamic: i === 0 ? 'p' as const : 'f' as const })) });
    expect(out.warnings).toEqual(['bar 1, beat 1 (right hand): a second dynamic on one chord is left out (the first is kept)']);
    expect(out.abc).toContain('!p![CE]8 |]');
  });

  it('ft_Y_04.AC11 leaves out a slur over another, or over one pitch', () => {
    const chart = compile(head() + 'C2 D2 E2 F2 | G2 G2 G2 G2 |]');
    const slur = (startTick: number, endTick: number) => ({ track: 'rh', voice: 1, startTick, endTick });
    const out = write({ ...chart, slurs: [slur(0, 960), slur(480, 1440), slur(1920, 2880)] });
    expect(out.warnings).toEqual([
      'bar 1, beat 2 (right hand): a slur over another slur is left out',
      'bar 2, beat 1 (right hand): a slur over one pitch is left out (it reads as a tie)',
    ]);
    expect(out.abc).toContain('(C2 D2 E2) F2');
  });
});

/** synthetic MusicXML of one part in 4/4, one division to the quarter. */
function xml(measures: string[], implicitFirst = false): string {
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list/><part id="P1">${measures
    .map((m, i) => `<measure number="${i + 1}"${i === 0 && implicitFirst ? ' implicit="yes"' : ''}>${m}</measure>`)
    .join('')}</part></score-partwise>`;
}
const attrs = () => '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>';
const note = (step: string, octave: number, dur: number, extra = '') => `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${dur}</duration>${extra}</note>`;
