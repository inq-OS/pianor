// Covers ft_Y_04.AC6, ft_Y_04.AC7.
import { describe, expect, it } from 'vitest';
import { musicXmlToChart } from '../import/musicxml';
import type { Chart } from '../chart/schema';
import { beatOf, fromChart, problemLabel, type ImportProblem } from './fromChart';
import { MAX_BARS, pieceProblem } from './model';

/** synthetic: a one-part score, each measure the XML inside its <measure>. */
function score(measures: string[], opts: { beats?: number; beatType?: number; divisions?: number; staves?: number; parts?: number } = {}): string {
  const attrs = `<attributes><divisions>${opts.divisions ?? 2}</divisions><key><fifths>0</fifths></key><time><beats>${opts.beats ?? 4}</beats><beat-type>${opts.beatType ?? 4}</beat-type></time>${opts.staves === 2 ? '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>' : ''}</attributes>`;
  const part = (p: number) => `<part id="P${p}">${measures.map((m, i) => `<measure number="${i + 1}">${i === 0 ? attrs : ''}${m}</measure>`).join('')}</part>`;
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list/>${Array.from({ length: opts.parts ?? 1 }, (_, i) => part(i + 1)).join('')}</score-partwise>`;
}
/** A note of `dur` divisions (2 a quarter). */
const n = (step: string, octave: number, dur: number, extra = '') => `<note>${extra.includes('<chord/>') ? '<chord/>' : ''}<pitch><step>${step}</step>${extra.match(/<alter>.*?<\/alter>/)?.[0] ?? ''}<octave>${octave}</octave></pitch><duration>${dur}</duration>${extra.replace(/<chord\/>|<alter>.*?<\/alter>/g, '')}</note>`;
const chartOf = (text: string): Chart => {
  const r = musicXmlToChart(text, 'test');
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
};
const convert = (text: string) => {
  const r = fromChart(chartOf(text));
  if (!r.ok) throw new Error(r.reason);
  return r;
};
const where = (ps: ImportProblem[]) => ps.map((p) => [p.bar, p.beat, p.hand]);

describe('a chart as a piece of the piece maker (ft_Y_04.AC6)', () => {
  it('ft_Y_04.AC6 keeps chords, accidentals, ties, slurs, dynamics, graces and repeats', () => {
    const chart = chartOf(score([
      `${n('C', 4, 2)}${n('E', 4, 2, '<chord/>')}${n('F', 4, 2, '<alter>1</alter>')}${n('G', 4, 2)}<note><grace slash="yes"/><pitch><step>B</step><octave>4</octave></pitch><type>eighth</type></note>${n('A', 4, 2, '<tie type="start"/>')}`,
      `${n('A', 4, 4, '<tie type="stop"/>')}${n('C', 5, 4)}<barline location="right"><repeat direction="backward"/></barline>`,
    ]));
    // slurs and dynamics set on the chart directly: the converter, apart from the reader (read from MusicXML in the next test)
    const track = chart.tracks[0]!.id;
    const withMarks: Chart = { ...chart, slurs: [{ track, voice: 1, startTick: 0, endTick: 960 }], notes: chart.notes.map((x, i) => (i === 0 ? { ...x, dynamic: 'p' } : x)) };
    const r = fromChart(withMarks);
    if (!r.ok) throw new Error(r.reason);
    expect(r.problems).toEqual([]);
    const p = r.piece;
    expect(p.notes.map((x) => [x.bar, x.start, x.length, x.step, x.alter])).toEqual([
      [0, 0, 'quarter', 'C', 0], [0, 0, 'quarter', 'E', 0], [0, 480, 'quarter', 'F', 1], [0, 960, 'quarter', 'G', 0], [0, 1440, 'quarter', 'A', 0],
      [1, 0, 'half', 'A', 0], [1, 960, 'half', 'C', 0],
    ]);
    expect(p.notes[0]!.dynamic).toBe('p');
    expect(p.notes[4]!.tieNext).toBe(true);
    expect(p.notes[4]!.grace).toEqual({ step: 'B', octave: 4, alter: 0, slash: true });
    expect(p.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 960 } }]);
    expect(p.repeats).toEqual([{ startBar: 0, endBar: 1 }]);
    expect(pieceProblem(p)).toBeNull();
    // a slur over another is listed, not kept
    const twice = fromChart({ ...withMarks, slurs: [...withMarks.slurs!, { track, voice: 1, startTick: 480, endTick: 1440 }] });
    expect(twice.ok && twice.problems.map(problemLabel)).toEqual(['bar 1, beat 2 (right hand): a slur over another slur']);
  });

  it('ft_Y_04.AC6 slurs and dynamics read from MusicXML come in', () => {
    const r = convert(score([`<direction><direction-type><dynamics><f/></dynamics></direction-type></direction>${n('C', 4, 2, '<notations><slur type="start" number="1"/></notations>')}${n('D', 4, 2)}${n('E', 4, 4, '<notations><slur type="stop" number="1"/></notations>')}`]));
    expect(r.problems).toEqual([]);
    expect(r.piece.notes[0]!.dynamic).toBe('f');
    expect(r.piece.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 960 } }]);
  });

  it('ft_Y_04.AC6 takes 2/4 and 3/4, and the hand from the clef of a one-staff part', () => {
    const r = convert(score([n('C', 4, 6)], { beats: 3 }));
    expect(r.piece.beats).toBe(3);
    expect(r.piece.notes[0]!.length).toBe('dottedHalf');
    const bass = fromChart(chartOf(score([`<attributes><clef><sign>F</sign><line>4</line></clef></attributes>${n('C', 3, 4)}`], { beats: 2 })));
    expect(bass.ok && bass.piece.hands).toBe('LH');
  });
});

describe('what the piece maker cannot hold (ft_Y_04.AC7)', () => {
  it('ft_Y_04.AC7 lists lengths it has no button for with bar and beat, and keeps the other notes', () => {
    // a double-dotted half and an eighth, then a thirty-second pair, in 4/4 (divisions 8: a quarter is 8)
    const r = convert(score([`${n('C', 4, 28)}${n('D', 4, 4)}`, `${n('E', 4, 1)}${n('F', 4, 1)}${n('G', 4, 6)}${n('A', 4, 24)}`], { divisions: 8 }));
    expect(r.problems.map(problemLabel)).toEqual([
      'bar 1, beat 1 (right hand): a double-dotted half, which the piece maker has no button for',
      'bar 2, beat 1 (right hand): a thirty-second, which the piece maker has no button for',
      'bar 2, beat 1.125 (right hand): a thirty-second, which the piece maker has no button for',
    ]);
    expect(r.piece.notes.map((x) => [x.bar, x.start, x.length])).toEqual([[0, 1680, 'eighth'], [1, 120, 'dottedEighth'], [1, 480, 'dottedHalf']]);
  });

  it('core_09.AC55 takes dotted quarters, dotted eighths and sixteenths note for note', () => {
    // a dotted quarter and an eighth, a dotted eighth and a sixteenth, four sixteenths (divisions 4: a quarter is 4)
    const r = convert(score([`${n('C', 4, 6)}${n('D', 4, 2)}${n('E', 4, 3)}${n('F', 4, 1)}${n('G', 4, 1)}${n('A', 4, 1)}${n('B', 4, 1)}${n('C', 5, 1)}`], { divisions: 4 }));
    expect(r.problems).toEqual([]);
    expect(r.piece.notes.map((x) => [x.start, x.length])).toEqual([
      [0, 'dottedQuarter'], [720, 'eighth'], [960, 'dottedEighth'], [1320, 'sixteenth'], [1440, 'sixteenth'], [1560, 'sixteenth'], [1680, 'sixteenth'], [1800, 'sixteenth'],
    ]);
  });

  it('ft_Y_04.AC7 lists triplets, double sharps and a second rhythm in one hand', () => {
    const triplet = `<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>`;
    const r = convert(score([
      `${n('C', 4, 1, triplet)}${n('D', 4, 1, triplet)}${n('E', 4, 1, triplet)}${n('F', 4, 3, '<alter>2</alter>')}${n('G', 4, 6)}`,
      `${n('C', 5, 12, '<voice>1</voice>')}<backup><duration>12</duration></backup>${n('E', 4, 6, '<voice>2</voice>')}${n('F', 4, 6, '<voice>2</voice>')}`,
    ], { divisions: 3 }));
    expect(r.problems.map((p) => [p.bar, p.beat, p.what])).toEqual([
      [1, 1, 'a triplet eighth, which the piece maker has no button for'],
      [1, 1.333, 'a triplet eighth, which the piece maker has no button for'],
      [1, 1.667, 'a triplet eighth, which the piece maker has no button for'],
      [1, 2, 'a double sharp'],
      [2, 1, 'two rhythms at once in one hand (a second voice)'],
      [2, 3, 'two rhythms at once in one hand (a second voice)'],
    ]);
    expect(r.piece.notes.map((x) => [x.bar, x.start, x.step])).toEqual([[0, 960, 'G'], [1, 0, 'C']]);
  });

  it('ft_Y_04.AC7 a bar holding more than its meter (a misread) is listed once per hand and left empty', () => {
    const r = convert(score([`${n('C', 4, 8)}${n('D', 4, 2)}`, n('E', 4, 8)]));
    expect(r.problems.map(problemLabel)).toEqual(['bar 1, beat 1 (right hand): the bar holds 5 beats, not 4: its notes were not taken']);
    expect(r.piece.notes.map((x) => [x.bar, x.step])).toEqual([[1, 'E']]);
  });

  it('ft_Y_04.AC7 a tie whose next note was not taken is taken away and listed', () => {
    const r = convert(score([`${n('C', 4, 6)}${n('D', 4, 2, '<tie type="start"/>')}`, `${n('D', 4, 7, '<tie type="stop"/>')}${n('E', 4, 1)}`], { divisions: 2 }));
    expect(where(r.problems)).toEqual([[1, 4, 'RH'], [2, 1, 'RH']]);
    expect(r.problems[0]!.what).toBe('a tie whose next note was not taken');
    expect(r.piece.notes.find((x) => x.step === 'D')!.tieNext).toBeUndefined();
  });

  it('ft_Y_04.AC7 refuses with a reason what cannot be a piece maker piece at all', () => {
    const refused = (text: string) => {
      const r = fromChart(chartOf(text));
      return r.ok ? null : r.reason;
    };
    expect(refused(score([n('C', 4, 6)], { beats: 6, beatType: 8 }))).toContain('6/8');
    expect(refused(score([n('C', 4, 10)], { beats: 5 }))).toContain('5/4');
    expect(refused(score([`<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>${n('C', 4, 6)}`, n('C', 4, 8)].reverse()))).toContain('meter changes');
    expect(refused(score([n('C', 4, 8)], { parts: 2 }))).toContain('two parts for the right hand');
  });

  it('ft_Y_04.AC7 a short first bar (a pick-up, or a bar the photo reading read short) becomes a whole bar with its notes at the end, named to check', () => {
    // a pick-up of one quarter, then a whole bar, then a bar written a beat short (the reader keeps it a whole bar)
    const text = `<?xml version="1.0"?><score-partwise version="4.0"><part-list/><part id="P1"><measure number="0" implicit="yes"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${n('G', 4, 2)}</measure><measure number="1">${n('C', 4, 8)}</measure><measure number="2">${n('E', 4, 2)}${n('D', 4, 4)}</measure></part></score-partwise>`;
    const r = convert(text);
    expect(r.piece.bars).toBe(3);
    expect(r.piece.notes.map((x) => `${x.bar}:${x.start}:${x.step}`)).toEqual(['0:1440:G', '1:0:C', '2:0:E', '2:480:D']);
    expect(r.problems).toEqual([
      { bar: 1, beat: 1, hand: 'RH', what: 'the bar holds 1 beats, not 4: its notes were put at the end of a whole bar, as a pick-up is played; check it' },
    ]);
  });

  it('ft_Y_04.AC7 keeps the first bars the piece maker holds and warns about the rest and about tempo changes', () => {
    const bars = Array.from({ length: MAX_BARS + 2 }, (_, i) => (i === 0 ? `<sound tempo="80"/>${n('C', 4, 8)}` : i === 3 ? `<sound tempo="100"/>${n('C', 4, 8)}` : n('C', 4, 8)));
    const r = convert(score(bars));
    expect(r.piece.bars).toBe(MAX_BARS);
    expect(r.piece.notes).toHaveLength(MAX_BARS);
    expect(r.warnings.join('\n')).toContain(`bars ${MAX_BARS + 1} to ${MAX_BARS + 2} were left out`);
    expect(r.warnings.join('\n')).toContain('tempo changes');
  });

  it('ft_Y_04.AC7 a part for no hand is left out with a warning; an empty part does not count as a second one', () => {
    const chart = chartOf(score([n('C', 4, 8)]));
    const rh = chart.tracks[0]!;
    const extra: Chart = {
      ...chart,
      tracks: [{ ...rh, id: 'empty' }, rh, { id: 'acc', role: 'accompaniment', hand: null, clef: 'bass' }],
      notes: [...chart.notes, { ...chart.notes[0]!, track: 'acc', midi: 48, spelling: { step: 'C', alter: 0, octave: 3 } }],
    };
    const r = fromChart(extra);
    if (!r.ok) throw new Error(r.reason);
    expect(r.piece.notes).toHaveLength(1);
    expect(r.warnings).toContain('1 note on a part for no hand (an accompaniment or a click) left out');
  });

  it('beats are counted from 1, eighths as halves', () => {
    expect([beatOf(0), beatOf(240), beatOf(1440)]).toEqual([1, 1.5, 4]);
  });
});
