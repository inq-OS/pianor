// Covers ft_Y_04.AC3, ft_Y_04.AC4.
import { describe, expect, it } from 'vitest';
import type { Chart } from '../chart/schema';
import { DEFAULT_BPM, musicXmlToChart, mxlRootPath, tempoFromWords } from './musicxml';

/** synthetic: a score of one part, its measures given as the XML inside each <measure>. */
function score(measures: string[], opts: { parts?: string[][]; head?: string; implicitFirst?: boolean } = {}): string {
  const parts = opts.parts ?? [measures];
  return `<?xml version="1.0"?><score-partwise version="4.0">${opts.head ?? ''}<part-list/>${parts
    .map((ms, p) => `<part id="P${p + 1}">${ms.map((m, i) => `<measure number="${i + 1}"${i === 0 && opts.implicitFirst ? ' implicit="yes"' : ''}>${m}</measure>`).join('')}</part>`)
    .join('')}</score-partwise>`;
}
const attrs = (inner = '', divisions = 1) => `<attributes><divisions>${divisions}</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${inner}</attributes>`;
const n = (step: string, octave: number, dur: number, extra = '') => `<note>${extra.includes('<chord/>') ? '<chord/>' : ''}<pitch><step>${step}</step>${extra.match(/<alter>.*?<\/alter>/)?.[0] ?? ''}<octave>${octave}</octave></pitch><duration>${dur}</duration>${extra.replace(/<chord\/>|<alter>.*?<\/alter>/g, '')}</note>`;
const rest = (dur: number, extra = '') => `<note><rest/><duration>${dur}</duration>${extra}</note>`;

function read(text: string): { chart: Chart; warnings: string[] } {
  const result = musicXmlToChart(text, 'test');
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const notesOf = (c: Chart) => c.notes.map((x) => [x.tick, x.dur, x.midi, x.track, x.voice]);

describe('MusicXML to a chart (ft_Y_04.AC3)', () => {
  it('reads pitch, spelling, key, tempo, ties and fingers from one staff', () => {
    const { chart } = read(
      score([
        `<attributes><divisions>2</divisions><key><fifths>1</fifths><mode>minor</mode></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes><sound tempo="90"/>${n('F', 4, 2, '<alter>1</alter><notations><technical><fingering>3-1</fingering></technical></notations>')}${n('G', 4, 2, '<tie type="start"/>')}${n('B', 3, 2, '<alter>-1</alter>')}`,
        n('G', 4, 6, '<tie type="stop"/>'),
      ]),
    );
    expect(chart.notes.map((x) => [x.tick, x.dur, x.midi, x.spelling.alter, x.finger, x.tieNext])).toEqual([
      [0, 480, 66, 1, 3, undefined],
      [480, 480, 67, 0, undefined, true],
      [960, 480, 58, -1, undefined, undefined],
      [1440, 1440, 67, 0, undefined, undefined],
    ]);
    expect(chart.keyMap).toEqual([{ tick: 0, fifths: 1, mode: 'minor' }]);
    expect(chart.meterMap).toEqual([{ tick: 0, num: 3, den: 4 }]);
    expect(chart.tempoMap).toEqual([{ tick: 0, bpm: 90 }]);
    expect(chart.bars).toEqual([
      { index: 0, startTick: 0, endTick: 1440 },
      { index: 1, startTick: 1440, endTick: 2880 },
    ]);
    expect(chart.tracks).toEqual([{ id: 'p1s1', role: 'play', hand: 'RH', clef: 'treble' }]);
    expect(chart.range).toEqual({ low: 58, high: 67 });
  });

  it('chords share an onset; backup and forward move the time; a second voice gets voice 2', () => {
    const { chart } = read(score([`${attrs()}${n('C', 4, 2, '<voice>1</voice>')}${n('E', 4, 2, '<chord/><voice>1</voice>')}${n('D', 4, 2, '<voice>1</voice>')}<backup><duration>4</duration></backup><forward><duration>1</duration></forward>${n('G', 3, 3, '<voice>2</voice>')}`]));
    expect(notesOf(chart)).toEqual([
      [0, 960, 60, 'p1s1', 1],
      [0, 960, 64, 'p1s1', 1],
      [480, 1440, 55, 'p1s1', 2],
      [960, 960, 62, 'p1s1', 1],
    ]);
  });

  it('a pick-up measure is as long as its notes, marked or not; a later short measure is filled to its time signature', () => {
    const marked = read(score([`${attrs()}${n('G', 4, 1)}`, n('C', 5, 4), n('C', 5, 2)], { implicitFirst: true })).chart;
    expect(marked.bars.map((b) => b.endTick - b.startTick)).toEqual([480, 1920, 1920]);
    const unmarked = read(score([`${attrs()}${n('G', 4, 2)}`, n('C', 5, 4)])).chart;
    expect(unmarked.bars[0]).toEqual({ index: 0, startTick: 0, endTick: 960 });
  });

  it('triplets and other divisions come out in whole ticks; times that are not whole ticks are rounded and said', () => {
    const triplets = read(score([`${attrs('', 3)}${n('C', 4, 1)}${n('D', 4, 1)}${n('E', 4, 1)}${n('F', 4, 9)}`])).chart;
    expect(triplets.notes.map((x) => [x.tick, x.dur])).toEqual([
      [0, 160],
      [160, 160],
      [320, 160],
      [480, 1440],
    ]);
    const odd = read(score([`${attrs('', 7)}${n('C', 4, 1)}${n('D', 4, 27)}`]));
    expect(odd.chart.notes.map((x) => x.tick)).toEqual([0, 69]);
    expect(odd.warnings.join()).toContain('times that are not whole ticks rounded');
  });

  it('keeps one grace note before its main note and says what it left out', () => {
    const grace = (step: string, slash = false) => `<note><grace${slash ? ' slash="yes"' : ''}/><pitch><step>${step}</step><octave>4</octave></pitch></note>`;
    const { chart, warnings } = read(
      score([`${attrs()}${grace('D', true)}${n('C', 4, 1)}${grace('E')}${grace('F')}${n('G', 4, 1)}${grace('A')}${n('A', 4, 1)}${grace('B')}${rest(1)}`, `${grace('C')}<note><grace/><chord/><pitch><step>E</step><octave>4</octave></pitch></note>${n('D', 4, 4)}${grace('F')}`]),
    );
    expect(chart.graces).toEqual([
      { track: 'p1s1', voice: 1, tick: 0, pitch: { midi: 62, spelling: { step: 'D', alter: 0, octave: 4 } }, slash: true },
      { track: 'p1s1', voice: 1, tick: 480, pitch: { midi: 65, spelling: { step: 'F', alter: 0, octave: 4 } }, slash: false },
      { track: 'p1s1', voice: 1, tick: 1920, pitch: { midi: 60, spelling: { step: 'C', alter: 0, octave: 4 } }, slash: false },
    ]);
    expect(warnings).toEqual(
      expect.arrayContaining([
        'runs of several grace notes kept as their last one',
        "grace notes on the main note's own pitch left out",
        'grace notes before a rest or at the end of a measure left out (2 times)',
        'grace-note chords kept as their first note',
      ]),
    );
  });

  it('a grace before a chord goes before its lowest note, and one on that very pitch is left out, not the whole score', () => {
    const grace = (step: string) => `<note><grace/><pitch><step>${step}</step><octave>4</octave></pitch></note>`;
    const { chart, warnings } = read(score([`${attrs()}${grace('E')}${n('G', 4, 2)}${n('E', 4, 2, '<chord/>')}${grace('F')}${n('A', 4, 2)}${n('C', 4, 2, '<chord/>')}`]));
    expect(chart.graces).toEqual([{ track: 'p1s1', voice: 1, tick: 480 * 2, pitch: { midi: 65, spelling: { step: 'F', alter: 0, octave: 4 } }, slash: false }]);
    expect(warnings).toContain("grace notes on the main note's own pitch left out");
  });

  it('two graces on one note after voices merge keep the first', () => {
    const grace = (step: string, v: number) => `<note><grace/><pitch><step>${step}</step><octave>5</octave></pitch><voice>${v}</voice></note>`;
    const voices = [1, 2, 3, 4, 5].map((v) => `${grace(v === 4 ? 'D' : 'E', v)}${n('C', 4, 4, `<voice>${v}</voice>`)}<backup><duration>4</duration></backup>`).join('');
    const { chart, warnings } = read(score([`${attrs()}${voices}`]));
    expect(chart.graces?.filter((g) => g.voice === 4)).toHaveLength(1);
    expect(warnings).toContain('a second grace note on one note left out');
  });

  it('a grace before a rest is left out there, not moved to the next note', () => {
    const { chart, warnings } = read(score([`${attrs()}<note><grace/><pitch><step>E</step><octave>4</octave></pitch></note>${rest(1)}${n('G', 4, 3)}`]));
    expect(chart.graces).toBeUndefined();
    expect(warnings).toContain('grace notes before a rest or at the end of a measure left out');
  });

  it('a change of divisions inside a measure keeps the time read so far', () => {
    const { chart } = read(score([`${attrs()}${n('C', 4, 1)}<attributes><divisions>2</divisions></attributes>${n('D', 4, 2)}${n('E', 4, 4)}`]));
    expect(chart.notes.map((x) => [x.tick, x.dur])).toEqual([
      [0, 480],
      [480, 480],
      [960, 960],
    ]);
  });

  it('a measure lasts as long as its longest part', () => {
    const { chart } = read(score([], { parts: [[`${attrs()}${n('C', 5, 4)}`, n('D', 5, 4)], [`${attrs('<clef><sign>F</sign></clef>')}${n('C', 3, 4)}${n('E', 3, 2)}`, n('D', 3, 4)]] }));
    expect(chart.bars.map((b) => [b.startTick, b.endTick])).toEqual([
      [0, 2880],
      [2880, 4800],
    ]);
    expect(chart.notes.find((x) => x.midi === 74)?.tick).toBe(2880);
  });

  it('a third staff in a piano part gets its own track', () => {
    const { chart } = read(score([`${attrs('<staves>2</staves>')}${n('C', 5, 4, '<staff>1</staff>')}<backup><duration>4</duration></backup>${n('C', 3, 4, '<staff>2</staff>')}<backup><duration>4</duration></backup>${n('C', 2, 4, '<staff>3</staff>')}`]));
    expect(chart.tracks.map((t) => [t.id, t.hand])).toEqual([
      ['p1s1', 'RH'],
      ['p1s2', 'LH'],
      ['p1s3', 'LH'],
    ]);
  });

  it('the first part that marks a tempo speaks for the score', () => {
    const { chart } = read(score([], { parts: [[`${attrs()}<sound tempo="80"/>${n('C', 5, 4)}`], [`${attrs()}<sound tempo="150"/>${n('C', 4, 2)}<sound tempo="40"/>${n('D', 4, 2)}`]] }));
    expect(chart.tempoMap).toEqual([{ tick: 0, bpm: 80 }]);
  });

  it('ft_Y_04.AC3 dynamic marks go on the next note of their staff; marks other than pp to ff are said', () => {
    const dyn = (mark: string, staff = 1) => `<direction><direction-type><dynamics><${mark}/></dynamics></direction-type><staff>${staff}</staff></direction>`;
    const { chart, warnings } = read(
      score([`${attrs('<staves>2</staves>')}${dyn('p')}${n('C', 5, 2, '<staff>1</staff>')}${dyn('sfz')}${n('D', 5, 2, '<staff>1</staff>')}<backup><duration>4</duration></backup>${dyn('f', 2)}${n('C', 3, 4, '<staff>2</staff>')}`, `${n('E', 5, 4, '<staff>1</staff><notations><dynamics><mf/></dynamics></notations>')}${dyn('ff', 2)}`]),
    );
    expect(chart.notes.map((x) => [x.midi, x.dynamic])).toEqual([
      [48, 'f'],
      [72, 'p'],
      [74, undefined],
      [76, 'mf'],
    ]);
    expect(warnings).toEqual(expect.arrayContaining(['dynamic marks other than pp, p, mp, mf, f and ff left out', 'dynamic marks after the last note of their staff left out']));
  });

  it('ft_Y_04.AC3 slurs join notes of one voice; across voices, nested or unclosed ones are said', () => {
    const slur = (type: string, number = 1) => `<notations><slur type="${type}" number="${number}"/></notations>`;
    const { chart, warnings } = read(
      score([
        `${attrs()}${n('C', 4, 1, slur('start'))}${n('D', 4, 1, slur('start', 2))}${n('E', 4, 1, slur('stop', 2))}${n('F', 4, 1, slur('stop'))}`,
        `${n('G', 4, 1, `<voice>1</voice>${slur('start')}`)}<backup><duration>1</duration></backup>${n('B', 3, 1, `<voice>2</voice>${slur('stop')}`)}${n('A', 4, 1, slur('stop', 3))}${n('B', 4, 2, slur('start', 4))}`,
      ]),
    );
    expect(chart.slurs).toEqual([{ track: 'p1s1', voice: 1, startTick: 0, endTick: 1440 }]);
    expect(warnings).toEqual(
      expect.arrayContaining(['nested or overlapping slurs kept as the outer one', 'slurs across staves or voices, or on one chord, left out', 'slur ends with no start left out', 'slurs that never end left out']),
    );
  });

  it('two slurs that share a note keep the first, as the chart allows one slur at a time in a voice', () => {
    const slur = (type: string) => `<notations><slur type="${type}"/></notations>`;
    const { chart, warnings } = read(score([`${attrs()}${n('C', 4, 1, slur('start'))}${n('D', 4, 1, `<notations><slur type="stop"/><slur type="start"/></notations>`)}${n('E', 4, 2, slur('stop'))}`]));
    expect(chart.slurs).toEqual([{ track: 'p1s1', voice: 1, startTick: 0, endTick: 480 }]);
    expect(warnings).toContain('nested or overlapping slurs kept as the outer one');
  });

  it('keeps rests, skips cue notes, and says what it could not play', () => {
    const { chart, warnings } = read(
      score([
        `${attrs()}${rest(1, '<voice>1</voice>')}<note><cue/><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration></note><note><unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched><duration>1</duration></note>${n('C', 4, 1)}<note><pitch><step>H</step><octave>4</octave></pitch><duration>1</duration></note>${n('C', 4, 0)}`,
      ]),
    );
    expect(chart.notes.map((x) => x.tick)).toEqual([1440]);
    expect(chart.rests).toEqual([{ tick: 0, dur: 480, track: 'p1s1', voice: 1, bar: 0 }]);
    expect(warnings).toEqual(expect.arrayContaining(['unpitched (percussion) notes left out', 'notes with no readable pitch left out']));
  });

  it('tempo from a number, a metronome mark (dotted beats too), or a tempo word, else the default', () => {
    const at = (head: string, extra = '') => read(score([`${attrs()}${head}${n('C', 4, 4)}`, `${extra}${n('D', 4, 4)}`]));
    const words = (text: string) => `<direction><direction-type><words>${text}</words></direction-type></direction>`;
    const metro = (unit: string, dots: number, per: number) => `<direction><direction-type><metronome><beat-unit>${unit}</beat-unit>${'<beat-unit-dot/>'.repeat(dots)}<per-minute>${per}</per-minute></metronome></direction-type></direction>`;
    expect(at(metro('quarter', 1, 60)).chart.tempoMap).toEqual([{ tick: 0, bpm: 90 }]);
    expect(at(metro('half', 0, 50), metro('eighth', 0, 200)).chart.tempoMap).toEqual([{ tick: 0, bpm: 100 }]); // the same speed twice is one entry
    const word = at(words('Allegro ma non troppo'), words('Adagio'));
    expect(word.chart.tempoMap).toEqual([
      { tick: 0, bpm: 132 },
      { tick: 1920, bpm: 70 },
    ]);
    expect(word.warnings).toContain('tempo read from the tempo words only');
    expect(at(`${words('Andante')}<sound tempo="80"/>`).chart.tempoMap).toEqual([{ tick: 0, bpm: 80 }]);
    expect(at('<sound tempo="100"/>', '<sound tempo="120"/><sound tempo="100"/>').chart.tempoMap).toEqual([{ tick: 0, bpm: 100 }]); // a change taken back at once is none
    const none = at('');
    expect(none.chart.tempoMap).toEqual([{ tick: 0, bpm: DEFAULT_BPM }]);
    expect(none.warnings).toContain(`no tempo in the score: ${DEFAULT_BPM} a minute assumed`);
    expect(tempoFromWords('dolce')).toBeUndefined();
    expect(tempoFromWords('Presto.')).toBe(176);
  });

  it('meter and key changes fall on bar lines; no time signature is 4/4, said', () => {
    const { chart } = read(score([`${attrs()}${n('C', 4, 4)}`, `<attributes><key><fifths>-2</fifths></key><time><beats>3+2</beats><beat-type>8</beat-type></time></attributes>${n('C', 4, 2)}${n('D', 4, 1)}`]));
    expect(chart.meterMap).toEqual([
      { tick: 0, num: 4, den: 4 },
      { tick: 1920, num: 5, den: 8 },
    ]);
    expect(chart.keyMap).toEqual([
      { tick: 0, fifths: 0, mode: 'major' },
      { tick: 1920, fifths: -2, mode: 'major' },
    ]);
    expect(chart.bars[1]).toEqual({ index: 1, startTick: 1920, endTick: 1920 + 1440 });
    const bare = read(score([`<attributes><divisions>1</divisions><time><beats>common</beats><beat-type>4</beat-type></time><key><cancel>1</cancel></key></attributes>${n('C', 4, 4)}`]));
    expect(bare.warnings).toEqual(expect.arrayContaining(['no time signature: 4/4 assumed', 'time signatures that are not a number over a number ignored', 'keys without fifths (non-traditional keys) read as C']));
  });

  it('plain repeats are kept, a missing start repeats from the top, and endings leave the bars as written', () => {
    const fwd = '<barline location="left"><repeat direction="forward"/></barline>';
    const back = '<barline location="right"><repeat direction="backward"/></barline>';
    const bars = (b: string[]) => read(score([`${attrs()}${n('C', 4, 4)}${b[0] ?? ''}`, `${n('D', 4, 4)}${b[1] ?? ''}`, `${n('E', 4, 4)}${b[2] ?? ''}`]));
    expect(bars(['', back, '']).chart.repeats).toEqual([{ startBar: 0, endBar: 1 }]);
    expect(bars(['', `${fwd}${back}`, '']).chart.repeats).toEqual([{ startBar: 1, endBar: 1 }]);
    expect(bars(['', back, `${fwd}${back}`]).chart.repeats).toEqual([
      { startBar: 0, endBar: 1 },
      { startBar: 2, endBar: 2 },
    ]);
    const endings = bars(['', `<barline><ending number="1" type="start"/></barline>${back}`, '']);
    expect(endings.chart.repeats).toBeUndefined();
    expect(endings.warnings).toContain('repeats with first and second endings not kept: the bars count once, as written');
  });

  it('parts of one staff take their hand from the clef; staves past the second are left hand', () => {
    const { chart, warnings } = read(
      score([], {
        parts: [
          [`${attrs('<clef><sign>G</sign></clef>')}${n('C', 5, 4)}`],
          [`${attrs('<clef><sign>F</sign></clef>')}${n('C', 3, 4)}`],
          [`${attrs('<staves>3</staves><clef number="3"><sign>F</sign></clef>')}${n('C', 2, 4, '<staff>3</staff>')}`],
        ],
      }),
    );
    expect(chart.tracks.map((t) => [t.id, t.hand, t.clef])).toEqual([
      ['p1s1', 'RH', 'treble'],
      ['p2s1', 'LH', 'bass'],
      ['p3s3', 'LH', 'bass'],
    ]);
    expect(warnings).toContain('staves past the second read as the left hand');
  });

  it('notes what it simplified: microtones, clef changes, C clefs, a fifth voice, a backup past the start', () => {
    const voices = [1, 2, 3, 4, 5].map((v) => `${n('C', 4, 4, `<voice>${v}</voice>`)}<backup><duration>4</duration></backup>`).join('');
    const { chart, warnings } = read(
      score([`${attrs('<clef><sign>C</sign></clef>')}${voices}<backup><duration>9</duration></backup>${n('D', 4, 4, '<alter>0.5</alter>')}`, `<attributes><clef><sign>F</sign></clef></attributes>${n('E', 3, 4)}`]),
    );
    expect(new Set(chart.notes.map((x) => x.voice))).toEqual(new Set([1, 2, 3, 4]));
    expect(warnings).toEqual(
      expect.arrayContaining([
        'C clefs read as treble',
        'voices past the fourth in a staff merged into the fourth',
        'a backup past the start of a measure clamped',
        'microtones rounded to the nearest semitone',
        'clef changes inside a staff not kept (the staff keeps its first clef)',
      ]),
    );
  });

  it.each([
    ['<a', 'not readable XML'],
    ['<score-timewise/>', 'score-timewise'],
    ['<opus/>', 'not a MusicXML score (the root is <opus>)'],
    ['<score-partwise><part id="P1"/></score-partwise>', 'no measures'],
    [score([`${attrs()}${rest(4)}`]), 'no notes to play'],
  ])('ft_Y_04.AC3 refuses what is not a readable score, saying why: %#', (text, reason) => {
    expect(musicXmlToChart(text, 'x')).toEqual({ ok: false, reason: expect.stringContaining(reason) });
  });

  it('reports a reading that breaks a chart rule instead of returning a broken chart', () => {
    const result = musicXmlToChart(score([`${attrs()}${n('C', 4, 4, '<voice>1</voice>')}<note><grace/><pitch><step>C</step><octave>4</octave></pitch></note>`]), 'x');
    expect(result.ok).toBe(true); // a grace left at the end is dropped, not a broken chart
    const bad = musicXmlToChart(score([`${attrs()}${n('C', 4, 4)}`]), '');
    expect(bad).toEqual({ ok: false, reason: expect.stringContaining('broke a chart rule') });
  });

  it('a movement title stands in for a missing work title, then the id', () => {
    expect(read(score([`${attrs()}${n('C', 4, 4)}`], { head: '<movement-title>Menuet</movement-title>' })).chart.title).toBe('Menuet');
    expect(read(score([`${attrs()}${n('C', 4, 4)}`])).chart.title).toBe('test');
  });
});

describe('the score inside a .mxl (ft_Y_04.AC4)', () => {
  it('ft_Y_04.AC4 is the rootfile META-INF/container.xml names, else the first score file', () => {
    const container = '<container><rootfiles><rootfile full-path="music/score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
    expect(mxlRootPath(container, ['META-INF/container.xml', 'music/score.xml'])).toBe('music/score.xml');
    expect(mxlRootPath(container, ['META-INF/container.xml', 'other.musicxml'])).toBe('other.musicxml');
    expect(mxlRootPath('<broken', ['META-INF/container.xml', 'a.xml'])).toBe('a.xml');
    expect(mxlRootPath(undefined, ['META-INF/x.xml'])).toBeUndefined();
  });
});
