// Covers ft_0_03.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseAbc, readKey } from './abc';
import { compilePiece } from './compile';

/** Header lines 1 to 6; music starts on line 7. */
const HEADER = 'X:1\nT:Test\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n';

const parse = (body: string, header = HEADER) => parseAbc(header + body);
const errors = (body: string, header = HEADER) => parse(body, header).diagnostics.filter((d) => d.severity === 'error');
const only = (body: string, header = HEADER) => {
  const list = errors(body, header);
  expect(list, JSON.stringify(list)).toHaveLength(1);
  return list[0]!;
};
const items = (body: string, header = HEADER) => {
  const parsed = parse(body, header);
  expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return parsed.voices[0]!.items;
};
const midis = (body: string) => items(body).flatMap((i) => (i.kind === 'notes' ? i.notes.map((n) => n.midi) : []));
const durs = (body: string, header = HEADER) => items(body, header).map((i) => i.dur);

describe('headers', () => {
  it('reads title, meter, tempo and the default length', () => {
    const parsed = parse('C D E F |]');
    expect(parsed.title).toBe('Test');
    expect(parsed.meter).toEqual({ num: 4, den: 4 });
    expect(parsed.bpm).toBe(100);
  });

  it('converts tempo notations to quarter-note beats per minute', () => {
    expect(parse('C4 |]', HEADER.replace('Q:1/4=100', 'Q:70')).bpm).toBe(70);
    expect(parse('C4 |]', HEADER.replace('Q:1/4=100', 'Q:1/8=140')).bpm).toBe(70);
    expect(parse('C4 |]', HEADER.replace('Q:1/4=100\n', '')).bpm).toBeUndefined();
  });

  it('accepts common time as 4/4 and the supported meters, in either default length', () => {
    expect(parse('C4 |]', HEADER.replace('M:4/4', 'M:C')).meter).toEqual({ num: 4, den: 4 });
    expect(parse('C D E |]', HEADER.replace('M:4/4', 'M:3/4')).meter).toEqual({ num: 3, den: 4 });
    expect(parse('C D |]', HEADER.replace('M:4/4', 'M:2/4')).meter).toEqual({ num: 2, den: 4 });
  });

  it('uses the ABC default note length when L: is missing: an eighth for 4/4 and 3/4, a sixteenth for 2/4', () => {
    const noL = HEADER.replace('L:1/4\n', '');
    expect(durs('C D E F G A B c |]', noL)).toEqual(Array(8).fill(240));
    expect(durs('C D E F G A B c |]', noL.replace('M:4/4', 'M:2/4'))).toEqual(Array(8).fill(120));
  });

  it('ignores comments, blank lines and fields that carry no music', () => {
    const parsed = parseAbc('X:1\nC:Someone\nT:Test\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n% a comment\n\nC D E F |] % trailing\nw: la la\n');
    expect(parsed.diagnostics).toEqual([]);
  });

  it('refuses unsupported meters, keys and changes inside the piece, with the line', () => {
    expect(only('C4 |]', HEADER.replace('M:4/4', 'M:6/8'))).toMatchObject({ line: 3, message: expect.stringContaining('meter "6/8" is not supported yet') });
    expect(only('C4 |]', HEADER.replace('K:C', 'K:Dor'))).toMatchObject({ line: 6, message: expect.stringContaining('key "Dor" is not supported yet') });
    expect(only('C4 |]\nM:3/4\n')).toMatchObject({ line: 8, message: expect.stringContaining('meter changes') });
    expect(only('C4 |]\nK:G\n')).toMatchObject({ line: 8, message: expect.stringContaining('key changes') });
    expect(only('C4 |]\nQ:1/4=90\n')).toMatchObject({ line: 8, message: expect.stringContaining('tempo changes') });
    expect(only('C4 |]\nL:1/8\n')).toMatchObject({ line: 8 });
  });

  it('needs M: before K:, and a K: line at all', () => {
    expect(only('C4 |]', HEADER.replace('M:4/4\n', ''))).toMatchObject({ line: 5, message: expect.stringContaining('missing meter') });
    const noKey = parseAbc('X:1\nM:4/4\nL:1/4\n');
    expect(noKey.diagnostics.some((d) => d.message.includes('missing K:C'))).toBe(true);
  });

  it('reports unknown fields and malformed values', () => {
    expect(errors('C4 |]', HEADER.replace('L:1/4', 'L:quarter'))[0]).toMatchObject({ line: 4 });
    expect(errors('C4 |]', HEADER.replace('Q:1/4=100', 'Q:fast'))[0]).toMatchObject({ line: 5 });
    expect(errors('C4 |]', HEADER.replace('Q:1/4=100', 'Q:0'))[0]).toMatchObject({ line: 5, message: expect.stringContaining('above zero') });
    expect(errors('C4 |]', HEADER.replace('X:1', 'Y:1'))[0]).toMatchObject({ line: 1, message: expect.stringContaining('"Y:"') });
    expect(errors('C4 |]', HEADER.replace('K:C', 'K:C mode=x'))[0]).toMatchObject({ line: 6 });
  });
});

describe('pitches', () => {
  it('maps letters and octave marks: C is middle C, c is an octave up, comma down, apostrophe up', () => {
    expect(midis('C D E F |]')).toEqual([60, 62, 64, 65]);
    expect(midis('G A B c |]')).toEqual([67, 69, 71, 72]);
    expect(midis("c' d' C, D, |]")).toEqual([84, 86, 48, 50]);
    expect(midis("B,, c'' C,, B |]")).toEqual([47, 96, 36, 71]);
  });

  it('stores the spelling beside the MIDI number', () => {
    const [first] = items('C, c z2 |]');
    expect(first!.kind === 'notes' && first!.notes[0]!.spelling).toEqual({ step: 'C', alter: 0, octave: 3 });
  });
});

describe('lengths and rests', () => {
  it('reads multipliers, fractions and slashes against the default length', () => {
    expect(durs('C2 C C/2 C/ |]')).toEqual([960, 480, 240, 240]);
    expect(durs('C4 | C3/2 C// C/4 C2 |]')).toEqual([1920, 720, 120, 120, 960]);
    expect(durs('C3 C |]')).toEqual([1440, 480]);
  });

  it('core_09.AC37 reads a dotted quarter and its eighth, a dotted quarter rest, and the same with L:1/8', () => {
    expect(durs('C3/2 D/2 E2 | z3/2 D/2 E2 |]')).toEqual([720, 240, 960, 720, 240, 960]);
    expect(durs('C3 D E4 | z3 D E4 |]', HEADER.replace('L:1/4', 'L:1/8'))).toEqual([720, 240, 960, 720, 240, 960]);
  });

  it('reads rests, and a whole-bar rest Z that works in any meter', () => {
    const rests = items('z C z2 |]').filter((i) => i.kind === 'rest');
    expect(rests.map((r) => [r.tick, r.dur])).toEqual([[0, 480], [960, 960]]);
    const bar = items('Z | Z |]');
    expect(bar.map((i) => [i.kind, i.dur])).toEqual([['rest', 1920], ['rest', 1920]]);
    expect(durs('Z |]', HEADER.replace('M:4/4', 'M:3/4'))).toEqual([1440]);
  });

  it('Z with a number rests that many bars', () => {
    expect(items('Z2 |]')).toHaveLength(2);
    expect(parse('Z2 |]').voices[0]!.bars).toBe(2);
  });

  it('reports a length that does not fit the 480 ticks per quarter, and zero lengths', () => {
    expect(only('C/7 C3 |]')).toMatchObject({ line: 7, column: 2, message: expect.stringContaining('does not fit') });
    expect(only('C0 C3 |]')).toMatchObject({ message: expect.stringContaining('cannot be zero') });
  });
});

describe('bars', () => {
  it('counts complete bars with or without bar lines at the end', () => {
    expect(parse('C D E F | G4 |]').voices[0]!.bars).toBe(2);
    expect(parse('C D E F | G4').voices[0]!.bars).toBe(2);
    expect(parse('C D E F |\nG4 |]').voices[0]!.bars).toBe(2);
    expect(errors('C D E F\nG4 |]')).toHaveLength(1); // a line break is not a bar line, so the 5th beat is past the end of bar 1
  });

  it('ignores leading and doubled bar lines', () => {
    expect(parse('| C D E F || G4 |]').voices[0]!.bars).toBe(2);
    expect(parse('[| C D E F |]').voices[0]!.bars).toBe(1);
  });

  it('reports a short bar at its bar line, and says how many beats it has', () => {
    // a piece of one short bar has no full bar after a pick-up (d120)
    expect(only('C D E |]')).toMatchObject({ line: 7, column: 7, message: expect.stringContaining('bar 1 has 3 beats but 4/4 needs 4') });
    expect(only('C D E F | G2 | A4 |]')).toMatchObject({ column: 14, message: expect.stringContaining('bar 2 has 2 beats') });
  });

  it('core_09.AC21 a short first bar is a pick-up: the next bar starts where it ends, and the last bar holds the rest of that bar', () => {
    const parsed = parse('G | C D E F | G3 |]');
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const voice = parsed.voices[0]!;
    expect(voice).toMatchObject({ bars: 3, pickup: 480, endTick: 480 + 1920 + 1440 });
    expect(voice.items.map((i) => i.tick)).toEqual([0, 480, 960, 1440, 1920, 2400]);
    expect(parse('C D E F | G4 |]').voices[0]).toMatchObject({ pickup: 0, endTick: 3840 });
  });

  it('core_09.AC21 the pick-up and the last bar make one whole bar (d120)', () => {
    expect(errors('G | C D E F | G4 |]').map((e) => e.message)).toEqual([
      expect.stringContaining('with a pick-up of 1 beats the last bar needs 3 beats, so the two make one 4/4 bar (it has 4)'),
      // a first bar short by mistake is named too, at its own bar line
      expect.stringContaining('bar 1 has 1 beats: if it is not a pick-up, 4/4 needs 4'),
    ]);
    expect(errors('C D E | C D E F | C D E F |]')[1]).toMatchObject({ column: 7, message: expect.stringContaining('bar 1 has 3 beats') });
    expect(errors('G | C D E F | G2 |]')[0]).toMatchObject({ message: expect.stringContaining('last bar needs 3 beats') });
    expect(errors('G2 | C D E F | G2 |]')).toEqual([]);
  });

  it('core_09.AC21 any other short bar is refused, with its position; without a pick-up the last bar is whole too', () => {
    expect(only('G | C D | E3 |]')).toMatchObject({ column: 9, message: expect.stringContaining('bar 2 has 2 beats') });
    expect(only('G | C D E F | G2 | A3 |]')).toMatchObject({ message: expect.stringContaining('bar 3 has 2 beats') });
    expect(only('C D E F | G3 |]')).toMatchObject({ message: expect.stringContaining('bar 2 has 3 beats') });
  });

  it('reports a note that runs past the end of the bar, once, at the note', () => {
    expect(only('C D E F G |]')).toMatchObject({ line: 7, column: 9, message: expect.stringContaining('runs past the end of bar 1') });
    expect(only('C D E4 |]')).toMatchObject({ column: 5 });
  });

  it('does not let one wrong bar shift every later bar', () => {
    const result = errors('C D E F | C D E | C D E F | C D E F |]');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ message: expect.stringContaining('bar 2') });
  });

  it('reports an unfinished last bar', () => {
    expect(only('C D E F | C D')).toMatchObject({ message: expect.stringContaining('bar 2 has 2 beats') });
  });
});

describe('pick-up bars in the chart (core_09.AC21, core_09.AC25)', () => {
  const META = (hands: string[], phrases: { name: string; bars: [number, number] }[] = []) =>
    JSON.stringify({ id: 'up', title: 'Up', level: 1, status: 'draft', hands, phrases, source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
  const abc = (body: string) => `X:1\nT:Up\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`;

  it('core_09.AC21 compiles to a short bars[0] and a short last bar; notes take their bar from the bars', () => {
    const out = compilePiece({ abc: abc('G | C D E F | G3 |]'), meta: META(['RH']) });
    expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(out.chart!.bars).toEqual([{ index: 0, startTick: 0, endTick: 480 }, { index: 1, startTick: 480, endTick: 2400 }, { index: 2, startTick: 2400, endTick: 3840 }]);
    expect(out.chart!.notes.map((n) => n.bar)).toEqual([0, 1, 1, 1, 1, 2]);
    expect(out.chart!.schemaVersion).toBe(2);
  });

  it('core_09.AC21 every voice starts with the same pick-up; a whole-bar rest Z cannot stand in for one', () => {
    const two = (lh: string) => compilePiece({ abc: abc(`V:RH clef=treble\nG | C D E F | G3 |]\nV:LH clef=bass\n${lh}\n`), meta: META(['RH', 'LH']) });
    expect(two('z | C,4 | C,3 |]').diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(two('z | C,4 | C,3 |]').chart!.rests).toEqual([{ tick: 0, dur: 480, track: 'lh', voice: 1, bar: 0 }]);
    const z = two('Z | C,4 | C,4 |]').diagnostics.filter((d) => d.severity === 'error');
    expect(z.map((d) => d.message)).toEqual(expect.arrayContaining([expect.stringMatching(/pick-up.*Z/)]));
  });

  it('core_09.AC25 with a pick-up, phrases number it 0 and the first full bar 1, as a printed score does', () => {
    const out = compilePiece({ abc: abc('G | C D E F | G4 | A3 |]'), meta: META(['RH'], [{ name: 'a', bars: [0, 1] }, { name: 'b', bars: [2, 3] }]) });
    expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(out.chart!.phrases).toEqual([{ name: 'a', startBar: 0, endBar: 1 }, { name: 'b', startBar: 2, endBar: 3 }]);
    const bad = compilePiece({ abc: abc('G | C D E F | G4 | A3 |]'), meta: META(['RH'], [{ name: 'x', bars: [3, 4] }]) });
    expect(bad.diagnostics.some((d) => d.severity === 'error' && /do not fit/.test(d.message))).toBe(true);
    // without a pick-up nothing changes: the first bar is 1
    const plain = compilePiece({ abc: abc('C D E F | G4 |]'), meta: META(['RH'], [{ name: 'a', bars: [1, 2] }]) });
    expect(plain.chart!.phrases).toEqual([{ name: 'a', startBar: 0, endBar: 1 }]);
  });
});

describe('fingerings, chords and ties', () => {
  it('reads fingerings 1 to 5 before a note', () => {
    const fingers = items('!1!C !2!D !5!G C |]').flatMap((i) => (i.kind === 'notes' ? [i.notes[0]!.finger] : []));
    expect(fingers).toEqual([1, 2, 5, undefined]);
  });

  it('rejects other decorations, an unclosed one, and a fingering with no note', () => {
    expect(only('!sf!C D E F |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('!sf!') });
    expect(only('!6!C D E F |]')).toMatchObject({ message: expect.stringContaining('!6!') });
    expect(only('!1 C D E F |]')).toMatchObject({ message: expect.stringContaining('second "!"') });
    expect(only('C D E F !1! |]')).toMatchObject({ message: expect.stringContaining('needs a note after it') });
    expect(only('!1!z C D E |]')).toMatchObject({ message: expect.stringContaining('rest cannot have a fingering') });
  });

  it('reads dynamic marks pp to ff onto the note or chord after them (core_09.AC14)', () => {
    const list = items('!p!C D !ff!E [!mf!CE] |]');
    const dyn = list.flatMap((i) => (i.kind === 'notes' ? [i.notes.map((n) => n.dynamic)] : []));
    expect(dyn).toEqual([['p'], [undefined], ['ff'], ['mf', undefined]]);
  });

  it('rejects a dynamic mark with no note after it, and other decorations near it', () => {
    expect(only('C D E F !p! |]')).toMatchObject({ message: expect.stringContaining('needs a note after it') });
    expect(errors('!p!z C D E F |]').map((e) => e.message)).toEqual(expect.arrayContaining([expect.stringContaining('dynamic mark needs a note')]));
    expect(only('!fff!C D E F |]')).toMatchObject({ message: expect.stringContaining('!fff!') });
  });

  it('reads chords with the length after the bracket, notes sorted low to high, fingerings inside', () => {
    const [chord] = items('[!3!E !1!C G]4 |]');
    expect(chord).toMatchObject({ kind: 'notes', dur: 1920 });
    expect(chord!.kind === 'notes' && chord!.notes.map((n) => [n.midi, n.finger])).toEqual([[60, 1], [64, 3], [67, undefined]]);
  });

  it('rejects chord mistakes with a clear message', () => {
    expect(only('[C2E2]2 C2 |]')).toMatchObject({ message: expect.stringContaining('length after the closing') });
    expect(only('[CC]4 |]')).toMatchObject({ message: expect.stringContaining('twice') });
    expect(only('[CE G4 |]')).toMatchObject({ message: expect.stringContaining('must end with "]"') });
    expect(only('!1![CE]4 |]')).toMatchObject({ message: expect.stringContaining('inside the chord') });
    expect(errors('[]4 |]')[0]).toMatchObject({ column: 1, message: expect.stringContaining('empty chord') });
    expect(only('[^ E]4 |]')).toMatchObject({ message: expect.stringContaining('must be followed by a note') });
  });

  it('marks tied notes and lets a tie cross a bar line', () => {
    const list = items('C2 E2- | E2 C2 |]');
    const tied = list.flatMap((i) => (i.kind === 'notes' ? i.notes.filter((n) => n.tieNext).map((n) => n.midi) : []));
    expect(tied).toEqual([64]);
  });

  it('core_09.AC11 a tie carries its accidental into the next bar', () => {
    expect(errors('^F2 ^F2- | F2 C2 |]')).toEqual([]);
    const midis = items('^F2 ^F2- | F2 C2 |]').flatMap((i) => (i.kind === 'notes' ? i.notes.map((n) => n.midi) : []));
    expect(midis).toEqual([66, 66, 66, 60]);
    expect(errors('^F2 ^F2- | _F2 C2 |]').length).toBeGreaterThan(0);
  });

  it('rejects a tie to a different pitch, to a rest, or at the very end', () => {
    expect(only('C- D E F |]')).toMatchObject({ message: expect.stringContaining('same pitch') });
    expect(only('C- z E F |]')).toMatchObject({ message: expect.stringContaining('same pitch') });
    expect(only('C D E F-')).toMatchObject({ message: expect.stringContaining('same pitch') });
  });

  it('ties whole chords, requiring every pitch to continue', () => {
    expect(errors('[CE]4- | [CE]4 |]')).toEqual([]);
    expect(only('[CE]4- | [CG]4 |]')).toMatchObject({ message: expect.stringContaining('same pitch') });
  });
});

describe('slurs (core_09.AC26)', () => {
  const META = (hands: string[]) => JSON.stringify({ id: 'slur', title: 'Slur', level: 1, status: 'draft', hands, phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
  const slursOf = (body: string) => parse(body).voices[0]!.slurs;

  it('( before a note and ) after a note mark a slur from the first note to the last', () => {
    expect(errors('C (D E) F |]')).toEqual([]);
    expect(slursOf('C (D E) F |]')).toEqual([{ startTick: 480, endTick: 960 }]);
    expect(slursOf('C D E F |]')).toEqual([]);
  });

  it('a slur may cross bar lines and start on a chord', () => {
    expect(errors('(C4 | D4) |]')).toEqual([]);
    expect(slursOf('(C4 | D4) |]')).toEqual([{ startTick: 0, endTick: 1920 }]);
    expect(slursOf('([CE] [DF]) G A |]')).toEqual([{ startTick: 0, endTick: 480 }]);
  });

  it('core_09.AC26 compiles to the chart slurs of its track and voice', () => {
    const abc = (body: string) => `X:1\nT:Slur\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`;
    const out = compilePiece({ abc: abc('C (D E) F |]'), meta: META(['RH']) });
    expect(out.diagnostics).toEqual([]);
    expect(out.chart!.slurs).toEqual([{ track: 'rh', voice: 1, startTick: 480, endTick: 960 }]);
    expect(compilePiece({ abc: abc('C D E F |]'), meta: META(['RH']) }).chart!.slurs).toBeUndefined();
    const hands = compilePiece({ abc: abc('V:RH clef=treble\nC D E F |]\nV:LH clef=bass\n(C D) E F |]\n'), meta: META(['RH', 'LH']) });
    expect(hands.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(hands.chart!.slurs).toEqual([{ track: 'lh', voice: 1, startTick: 0, endTick: 480 }]);
  });

  it('refuses a slur over fewer than two different notes, or over one pitch (a tie), with its position', () => {
    expect(only('(C) D E F |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('two different notes') });
    expect(only('(C-C) D E |]')).toMatchObject({ column: 1, message: expect.stringContaining('tie') });
    expect(only('([CE] [CE]) D E |]')).toMatchObject({ column: 1, message: expect.stringContaining('tie') });
  });

  it('refuses nested and dotted slurs, with their position', () => {
    expect(only('((C D) E F |]')).toMatchObject({ column: 2, message: expect.stringContaining('nested') });
    expect(only('.(C D) E F |]')).toMatchObject({ column: 1, message: expect.stringContaining('dotted') });
  });

  it('refuses an unclosed slur and a ")" with no slur to close, with their position', () => {
    expect(only('C (D E F |]')).toMatchObject({ column: 3, message: expect.stringContaining('not closed') });
    expect(only('C D) E F |]')).toMatchObject({ column: 4, message: expect.stringContaining('no slur') });
  });

  it('refuses a slur across a repeat sign, with its position', () => {
    expect(only('C D (E F |: G A B c) :|')).toMatchObject({ column: 10, message: expect.stringContaining('repeat sign') });
  });

  it('reads ( followed by a digit as a tuplet, never as a slur', () => {
    expect(only('(2CD E F |]')).toMatchObject({ column: 1, message: expect.stringContaining('only triplets') });
  });
});

describe('unsupported syntax gets a line and a column, never silent acceptance', () => {
  const table: [string, string, number, string][] = [
    ['accidental without a note', '^ C D E F |]', 1, 'must be followed by a note'],
    ['tuplet other than a triplet', '(5C/C/C/C/ E F |]', 1, 'only triplets'],
    ['chord symbol', '"C"C D E F |]', 1, 'chord symbols'],
    ['overlay over several bars', 'C D E F &) |]', 9, '(& and &)'],
    ['staccato', '.C D E F |]', 1, '"."'],
    ['stray character', 'C D E ? |]', 7, 'unexpected character "?"'],
    ['unsupported clef', 'C4 |]', 0, ''],
  ];
  it.each(table.filter(([, , column]) => column > 0))('%s', (_name, body, column, message) => {
    const e = only(body);
    expect(e).toMatchObject({ file: 'piece.abc', line: 7, column });
    expect(e.message).toContain(message);
  });

  it('reports every problem, not just the first', () => {
    const list = errors('^ C D E F |]\n_ D E F G |]');
    expect(list.map((e) => [e.line, e.column])).toEqual([[7, 1], [8, 1]]);
  });

  it('reports music before the K: line', () => {
    const parsed = parseAbc('X:1\nM:4/4\nC D E F |]\nK:C\n');
    expect(parsed.diagnostics.find((d) => d.line === 3)).toMatchObject({ message: expect.stringContaining('before the K: line') });
  });
});

describe('voices', () => {
  const TWO = HEADER + 'V:RH clef=treble\nV:LH clef=bass name="Left"\nV:RH\nC D E F |]\nV:LH\nC, D, E, F, |]\n';

  it('reads voices with their clefs and music; header V: lines only define, the body selects', () => {
    const parsed = parseAbc(TWO);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.voices.map((v) => [v.id, v.clef, v.items.length, v.bars])).toEqual([['RH', 'treble', 4, 1], ['LH', 'bass', 4, 1]]);
  });

  it('a clef on the K: line applies to voices that name none', () => {
    const parsed = parseAbc(HEADER.replace('K:C', 'K:C clef=bass') + 'C, D, E, F, |]\n');
    expect(parsed.voices[0]!.clef).toBe('bass');
  });

  it('rejects unsupported clefs and voice properties, music before the first V:, and mixing', () => {
    expect(errors('V:RH clef=alto\nC4 |]').some((e) => e.message.includes('clef "alto"'))).toBe(true);
    expect(errors('V:RH octave=1\nC4 |]').some((e) => e.message.includes('voice property "octave"'))).toBe(true);
    expect(parseAbc(HEADER + 'V:RH\nV:LH\nV:RH\nC4 |]\nV:LH\nC,4 |]\n').diagnostics).toEqual([]);
    expect(errors('C4 |]\nV:LH\nC,4 |]').some((e) => e.message.includes('cannot mix'))).toBe(true);
    const before = parseAbc('X:1\nM:4/4\nL:1/4\nV:RH\nV:LH\nK:C\nC4 |]\n'); // voices defined in the header, none chosen in the body
    expect(before.diagnostics.find((d) => d.severity === 'error')).toMatchObject({ message: expect.stringContaining('before the first V: line') });
  });

  it('warns about a voice with no music', () => {
    const parsed = parseAbc(HEADER + 'V:RH\nC4 |]\nV:LH\n');
    expect(parsed.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('LH has no music') })]);
  });
});

describe('properties', () => {
  /** A random but valid bar of 4/4 as ABC with L:1/4: a partition of 4 beats into 1, 2 or 4 beat notes and rests. */
  const barArb = fc.constantFrom([4], [2, 2], [2, 1, 1], [1, 1, 2], [1, 1, 1, 1], [1, 2, 1]).chain((lengths) =>
    fc.tuple(...lengths.map((len) => fc.tuple(fc.constantFrom('C', 'D', 'E', 'F', 'G', 'A', 'B', 'z'), fc.constantFrom('', ',', "'"), fc.constant(len)))),
  );

  it('any valid piece parses without errors, with exact ticks, bar sums and monotonic order', () => {
    fc.assert(
      fc.property(fc.array(barArb, { minLength: 1, maxLength: 8 }), (bars) => {
        const body = bars
          .map((bar) => bar.map(([letter, mark, len]) => `${letter}${letter === 'z' ? '' : mark}${len === 1 ? '' : len}`).join(' '))
          .join(' | ');
        const parsed = parse(`${body} |]`);
        expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        const voice = parsed.voices[0]!;
        expect(voice.bars).toBe(bars.length);
        let tick = 0;
        for (const item of voice.items) {
          expect(item.tick).toBe(tick);
          tick += item.dur;
        }
        expect(tick).toBe(bars.length * 1920);
      }),
    );
  });

  it('a V: line with no M: line is reported, not thrown (fast-check counterexample "V:&")', () => {
    const result = parseAbc('V:&');
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('never throws on arbitrary text, it reports', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (text) => {
        expect(() => parse(text)).not.toThrow();
        expect(() => parseAbc(text)).not.toThrow();
      }),
    );
  });
});

describe('accidentals', () => {
  // Covers core_09.AC4.
  const spellings = (body: string, header = HEADER) => items(body, header).flatMap((i) => (i.kind === 'notes' ? i.notes.map((n) => n.spelling) : []));

  it('reads sharp, flat, natural and double marks before a note, with the MIDI number', () => {
    expect(spellings('^C C C C |]')[0]).toEqual({ step: 'C', alter: 1, octave: 4 });
    expect(midis('^C C C C |]')[0]).toBe(61);
    expect(spellings('_D D D D |]')[0]).toEqual({ step: 'D', alter: -1, octave: 4 });
    expect(spellings('=C C C C |]')[0]).toEqual({ step: 'C', alter: 0, octave: 4 });
    expect(midis('^^F F F F |]')[0]).toBe(67);
    expect(midis('__B, B, B, B, |]')[0]).toBe(57);
  });

  it('holds an accidental for its pitch to the bar line, and forgets it at the bar line', () => {
    expect(spellings('^F2 F2 |]').map((s) => s.alter)).toEqual([1, 1]);
    expect(spellings('^F2 F2 |F2 F2 |]').map((s) => s.alter)).toEqual([1, 1, 0, 0]);
  });

  it('does not carry an accidental to another octave of the same letter', () => {
    expect(spellings('^F2 f2 |]').map((s) => s.alter)).toEqual([1, 0]);
  });

  it('applies the key signature, and an explicit natural cancels it for the bar', () => {
    const G = HEADER.replace('K:C', 'K:G');
    expect(spellings('F G A B |]', G)[0]).toEqual({ step: 'F', alter: 1, octave: 4 });
    expect(spellings('=F F F F |]', G).map((s) => s.alter)).toEqual([0, 0, 0, 0]);
    expect(spellings('F2 =F2 |]', G).map((s) => s.alter)).toEqual([1, 0]);
  });

  it('spells the flats of F major and Bb major', () => {
    expect(spellings('B2 E2 |]', HEADER.replace('K:C', 'K:Bb')).map((s) => s.alter)).toEqual([-1, -1]);
    expect(spellings('B2 E2 |]', HEADER.replace('K:C', 'K:F')).map((s) => s.alter)).toEqual([-1, 0]);
  });

  it('gives a minor key the signature of its relative major, and keeps the key on the parsed piece', () => {
    expect(spellings('B2 A2 |]', HEADER.replace('K:C', 'K:Dm')).map((s) => s.alter)).toEqual([-1, 0]);
    expect(parse('C4 |]', HEADER.replace('K:C', 'K:G')).key).toEqual({ fifths: 1, mode: 'major' });
    expect(parse('C4 |]').key).toEqual({ fifths: 0, mode: 'major' });
  });

  it('reads chord accidentals per note, sorted low to high', () => {
    const [chord] = items('[_E^C]4 |]');
    expect(chord).toMatchObject({ kind: 'notes' });
    if (chord?.kind !== 'notes') return;
    expect(chord.notes.map((n) => n.midi)).toEqual([61, 63]);
  });

  it('reads key names: major, minor, and refuses modes and unknown tonics', () => {
    expect(readKey('G')).toEqual({ fifths: 1, mode: 'major' });
    expect(readKey('Cmaj')).toEqual({ fifths: 0, mode: 'major' });
    expect(readKey('F#m')).toEqual({ fifths: 3, mode: 'minor' });
    expect(readKey('C#min')).toEqual({ fifths: 4, mode: 'minor' });
    expect(readKey('Dor')).toBeUndefined();
    expect(readKey('H')).toBeUndefined();
    expect(readKey('Cbm')).toBeUndefined();
  });
});

describe('repeat signs', () => {
  const repeats = (body: string) => parse(body).voices[0]!.repeats;
  // Covers core_09.AC17.
  it('reads |: :| and :: and a :| with no |: as repeats of written bars', () => {
    expect(errors('C4 |: D4 | E4 :| F4 |]')).toEqual([]);
    expect(repeats('C4 |: D4 | E4 :| F4 |]')).toEqual([{ startBar: 1, endBar: 2 }]);
    expect(repeats('C4 | D4 :| E4 |]')).toEqual([{ startBar: 0, endBar: 1 }]);
    expect(repeats('|: C4 :: D4 :|]')).toEqual([{ startBar: 0, endBar: 0 }, { startBar: 1, endBar: 1 }]);
    expect(repeats('C4 :|\n|: D4 :|')).toEqual([{ startBar: 0, endBar: 0 }, { startBar: 1, endBar: 1 }]);
    expect(repeats('C4 | D4 |]')).toEqual([]);
  });

  it('refuses a second :|, nested repeats, an open |: and a tie across a repeat sign, with their position', () => {
    expect(only('C4 :| D4 :|')).toMatchObject({ column: 10, message: expect.stringContaining('second :|') });
    expect(only('|: C4 |: D4 :|')).toMatchObject({ column: 7, message: expect.stringContaining('nested') });
    expect(only('|: C4 | D4 |]')).toMatchObject({ message: expect.stringContaining('needs a :|') });
    expect(only('C4- :| C4 |]')).toMatchObject({ column: 5, message: expect.stringContaining('tie cannot cross') });
  });
});

describe('first and second endings (core_09.AC45)', () => {
  const repeats = (body: string) => parse(body).voices[0]!.repeats;
  it('core_09.AC45 reads |1 and :|2 as the endings of the repeat, in every spelling', () => {
    const want = [{ startBar: 1, endBar: 3, endings: { first: { startBar: 3, endBar: 3 }, second: { startBar: 4, endBar: 4 } } }];
    for (const body of ['C4 |: D4 | E4 |1 F4 :|2 G4 |]', 'C4 |: D4 | E4 |[1 F4 :|[2 G4 |]', 'C4 |: D4 | E4 | [1 F4 :| [2 G4 |]']) {
      expect(errors(body), body).toEqual([]);
      expect(repeats(body), body).toEqual(want);
    }
  });

  it('core_09.AC45 a first ending may hold several bars, and the second runs to the next || |] or |:, or holds one bar', () => {
    expect(repeats('|: C4 |1 D4 | E4 :|2 F4 | G4 || A4 |]')).toEqual([{ startBar: 0, endBar: 2, endings: { first: { startBar: 1, endBar: 2 }, second: { startBar: 3, endBar: 4 } } }]);
    expect(repeats('|: C4 |1 D4 :|2 E4 | F4 |]')).toEqual([{ startBar: 0, endBar: 1, endings: { first: { startBar: 1, endBar: 1 }, second: { startBar: 2, endBar: 3 } } }]);
    expect(repeats('|: C4 |1 D4 :|2 E4 |: F4 :|]')).toEqual([
      { startBar: 0, endBar: 1, endings: { first: { startBar: 1, endBar: 1 }, second: { startBar: 2, endBar: 2 } } },
      { startBar: 3, endBar: 3 },
    ]);
    // nothing closes it before another plain bar line: one bar
    expect(repeats('|: C4 |1 D4 :|2 E4 | F4 | G4 ')).toEqual([{ startBar: 0, endBar: 1, endings: { first: { startBar: 1, endBar: 1 }, second: { startBar: 2, endBar: 2 } } }]);
    // a :| with no |: repeats from the start, endings too
    expect(repeats('C4 |1 D4 :|2 E4 |]')).toEqual([{ startBar: 0, endBar: 1, endings: { first: { startBar: 1, endBar: 1 }, second: { startBar: 2, endBar: 2 } } }]);
  });

  it('core_09.AC45 refuses an ending without a repeat, a third ending, a second ending not right after the first, a lone first or second, and an ending inside a bar, with their position', () => {
    expect(only('C4 | D4 |1 E4 | F4 |]')).toMatchObject({ column: 10, message: expect.stringContaining('ending') });
    expect(only('|: C4 |1 D4 :|2 E4 |3 F4 |]')).toMatchObject({ column: 21, message: expect.stringContaining('third') });
    expect(errors('|: C4 |1 D4 :| E4 |2 F4 |]').map((d) => [d.column, d.message])).toEqual([[13, expect.stringContaining('needs a second ending')], [20, expect.stringContaining('needs a first ending')]]);
    expect(only('|: C4 |1 D4 :| E4 |]')).toMatchObject({ message: expect.stringContaining('second ending') });
    expect(only('|: C4 :|2 D4 |]')).toMatchObject({ column: 9, message: expect.stringContaining('first ending') });
    expect(errors('|: C2 [1 D2 :|2 E4 |]')[0]).toMatchObject({ column: 7, message: expect.stringContaining('bar line') });
  });
});

describe('grace notes (core_09.AC31)', () => {
  // Covers core_09.AC31.
  it('reads {g}C as a plain grace note and {/g}C as a slashed one, before the main note', () => {
    const plain = items('{g}C D E F |]');
    expect(plain[0]).toMatchObject({ kind: 'notes', tick: 0, dur: 480, notes: [{ midi: 60 }], graces: [{ note: { midi: 79, spelling: { step: 'G', alter: 0, octave: 5 } }, slash: false }] });
    expect(plain[1]).toMatchObject({ tick: 480, dur: 480 });
    expect(items('{/g}C D E F |]')[0]).toMatchObject({ graces: [{ slash: true }] });
    expect(items('{^F}G D E F |]')[0]).toMatchObject({ graces: [{ note: { midi: 66, spelling: { step: 'F', alter: 1, octave: 4 } } }] });
  });

  it('core_09.AC60 reads a grace group in the order written, with the accidentals held to the bar line', () => {
    const [first] = items('{^FGA}B C D E |]');
    expect(first).toMatchObject({ graces: [{ note: { midi: 66 } }, { note: { midi: 67 } }, { note: { midi: 69 } }] });
    expect(items('{cBc}d C D E |]')[0]).toMatchObject({ graces: [{ note: { midi: 72 } }, { note: { midi: 71 } }, { note: { midi: 72 } }] });
  });

  it('core_09.AC60 refuses a group of five, two of one pitch in a row, and a second pair of braces, with their position', () => {
    expect(only('{gfgfg}E F G A |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('at most 4') });
    expect(only('{gg}E F G A |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('in a row') });
  });

  // Covers core_09.AC31.
  it('refuses a grace note before a rest or a chord, with its position', () => {
    expect(only('{g}z F G A |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('before a rest') });
    expect(only('{g}[CE] F G A |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('before a chord') });
  });

  // Covers core_09.AC31.
  it('refuses a grace note on the continuation of a tie, and one with no note after it', () => {
    expect(only('C-{g}C D E |]')).toMatchObject({ line: 7, column: 3, message: expect.stringContaining('second note of a tie') });
    expect(only('C D E F {g}| G A B C |]')).toMatchObject({ line: 7, column: 9, message: expect.stringContaining('needs a note after it') });
  });

  // Covers core_09.AC31.
  it('refuses an unclosed brace, a grace with the main note pitch and a second grace on one note', () => {
    expect(only('{gC D E F |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('must end with "}"') });
    expect(only('{C}C D E F |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('same pitch') });
    expect(only('{g}{/g}C D E F |]')).toMatchObject({ line: 7, column: 4, message: expect.stringContaining('one grace group') });
  });
});

describe('ornament signs (core_09.AC60, d305)', () => {
  it('core_09.AC60 reads !trill!, !uppermordent!, !pralltriller!, !lowermordent!, !mordent! and !turn! on the next note, with the neighbours spelled in the key', () => {
    expect(items('!trill!C D E F |]')[0]).toMatchObject({ ornament: { kind: 'trill', upper: { midi: 62 } } });
    expect(items('!uppermordent!C !pralltriller!D E F |]').map((i) => i.kind === 'notes' && i.ornament?.kind)).toEqual(['upperMordent', 'upperMordent', undefined, undefined]);
    expect(items('!mordent!C !lowermordent!D E F |]')[0]).toMatchObject({ ornament: { kind: 'lowerMordent', lower: { midi: 59, spelling: { step: 'B', octave: 3 } } } });
    const turn = items('!turn!E F G A |]', 'X:1\nT:Test\nM:4/4\nL:1/4\nQ:1/4=100\nK:G\n')[0];
    expect(turn).toMatchObject({ ornament: { kind: 'turn', upper: { spelling: { step: 'F', alter: 1 } }, lower: { midi: 62 } } });
  });

  it('core_09.AC60 a neighbour takes the accidental written earlier in the bar', () => {
    expect(items('^F !turn!G A B |]')[1]).toMatchObject({ ornament: { upper: { midi: 69 }, lower: { midi: 66 } } });
  });

  it('core_09.AC60 refuses a sign on a chord, a rest, the second note of a tie, with no note after it, and two signs on one note', () => {
    expect(only('!trill![CE] F G A |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('single note') });
    expect(only('!trill!z F G A |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('rest') });
    expect(only('C-!trill!C D E |]')).toMatchObject({ line: 7, column: 3, message: expect.stringContaining('second note of a tie') });
    expect(only('C D E F !trill!| G A B C |]')).toMatchObject({ line: 7, column: 9, message: expect.stringContaining('needs a note after it') });
    expect(only('!trill!!turn!C D E F |]')).toMatchObject({ line: 7, column: 8, message: expect.stringContaining('one ornament') });
    expect(only('!trill!^B, D E F |]')).toMatchObject({ line: 7, column: 1, message: expect.stringContaining('neighbour note that sounds above') });
  });
});

describe('grace notes in the chart (core_09.AC31)', () => {
  const META = JSON.stringify({ id: 'gr', title: 'Gr', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
  const compile = (body: string) => compilePiece({ abc: `X:1\nT:Gr\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`, meta: META });

  // Covers core_09.AC31.
  it('compiles a grace to the chart graces; notes, bars and beats are the same with and without it', () => {
    const plain = compile('C D E F |]');
    const graced = compile('{/g}C D E F |]');
    expect(plain.diagnostics).toEqual([]);
    expect(graced.diagnostics).toEqual([]);
    const note = graced.chart!.notes[0]!;
    expect(graced.chart!.graces).toEqual([{ track: note.track, voice: 1, tick: 0, pitch: { midi: 79, spelling: { step: 'G', alter: 0, octave: 5 } }, slash: true }]);
    expect(plain.chart!.graces).toBeUndefined();
    expect(graced.chart!.notes).toEqual(plain.chart!.notes);
    expect(graced.chart!.bars).toEqual(plain.chart!.bars);
    expect(graced.chart!.meterMap).toEqual(plain.chart!.meterMap);
    expect(graced.chart!.tempoMap).toEqual(plain.chart!.tempoMap);
  });

  it('core_09.AC60 compiles a grace group in playing order and a sign with its neighbours, the notes unchanged', () => {
    const out = compile('{/fe}d !trill!C D E |]');
    expect(out.diagnostics).toEqual([]);
    expect(out.chart!.graces!.map((g) => g.pitch.midi)).toEqual([77, 76]);
    expect(out.chart!.ornaments).toEqual([{ track: out.chart!.notes[1]!.track, voice: 1, tick: 480, kind: 'trill', upper: { midi: 62, spelling: { step: 'D', alter: 0, octave: 4 } } }]);
    expect(out.chart!.notes).toEqual(compile('d C D E |]').chart!.notes);
  });
});

describe('triplets (core_09.AC49, d163)', () => {
  const E8 = 'X:1\nT:Test\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\n';
  const tupletsOf = (body: string, header = HEADER) => {
    const parsed = parse(body, header);
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    return parsed.voices[0]!.tuplets;
  };

  it('core_09.AC49 (3 before three eighths plays each for 160 ticks, filling one beat, and records the triplet', () => {
    expect(durs('(3CDE F2 G2 A2 |]', E8)).toEqual([160, 160, 160, 480, 480, 480]);
    expect(tupletsOf('(3CDE F2 G2 A2 |]', E8)).toEqual([{ startTick: 0, endTick: 320 }]);
  });

  it('core_09.AC49 a quarter triplet plays 320 ticks each, two beats for three', () => {
    expect(durs('C (3DEF G |]')).toEqual([480, 320, 320, 320, 480]);
    expect(tupletsOf('C (3DEF G |]')).toEqual([{ startTick: 480, endTick: 1120 }]);
  });

  it('core_09.AC49 a triplet may hold chords and rests of the same length', () => {
    expect(durs('(3[CE]z[DF] G2 A2 B2 |]', E8)).toEqual([160, 160, 160, 480, 480, 480]);
    expect(tupletsOf('(3[CE]z[DF] G2 A2 B2 |]', E8)).toEqual([{ startTick: 0, endTick: 320 }]);
  });

  it('core_09.AC49 two triplets in a row, and a triplet in a pick-up bar counted from its end', () => {
    expect(tupletsOf('(3CDE (3FGA B2 c2 |]', E8)).toEqual([{ startTick: 0, endTick: 320 }, { startTick: 480, endTick: 800 }]);
    expect(errors('(3ABc | d2 e2 f2 g2 | f2 e2 d2 |]', E8)).toEqual([]);
  });

  it('core_09.AC49 refuses other tuplets with their position', () => {
    expect(only('C (2DE F |]')).toMatchObject({ line: 7, column: 3, message: expect.stringContaining('"(2"') });
    expect(only('(4C/C/C/C/ E F |]')).toMatchObject({ column: 1, message: expect.stringContaining('"(4"') });
    expect(only('(3:2:3CDE F |]')).toMatchObject({ column: 1, message: expect.stringContaining('"(3:2:3"') });
  });

  it('core_09.AC49 refuses a triplet of mixed lengths, of other lengths, nested, across a bar line or off the beat', () => {
    expect(only('(3CD2 F2 G2 A2 |]', E8)).toMatchObject({ column: 1, message: expect.stringContaining('one length') });
    expect(only('(3C/D/E/ F2 G2 A2 B |]', E8)).toMatchObject({ column: 1, message: expect.stringContaining('only eighth and quarter triplets') });
    expect(only('(3C(3DE F2 G2 A2 |]', E8)).toMatchObject({ column: 4, message: expect.stringContaining('nested') });
    expect(only('C2 D2 E2 (3FG | A B c2 d2 e2 |]', E8)).toMatchObject({ column: 10, message: expect.stringContaining('cross a bar line') });
    expect(only('C (3DEF G2 A2 B |]', E8)).toMatchObject({ column: 3, message: expect.stringContaining('on a beat') });
  });

  it('core_09.AC49 refuses a triplet left open at the end or holding a whole-bar rest', () => {
    expect(errors('C D E (3F', HEADER).some((d) => d.message.includes('three notes after'))).toBe(true);
    expect(errors('(3Z | C4 |]').some((d) => d.message.includes('whole-bar rest'))).toBe(true);
  });
});
