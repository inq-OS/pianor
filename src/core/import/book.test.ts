// Covers ft_Y_04.AC22.
import { describe, expect, it } from 'vitest';
import { songSchema, songTreeProblems } from '../song/schema';
import { bookParts, bookSong, layoutOf, type BookMovement } from './book';
import { musicXmlToChart } from './musicxml';
import { proposeStarts } from './songParts';

/** synthetic: a score of one piano staff, `bars` bars of one note each, with changes at given bars. */
function movement(bars: number, opts: { beats?: number; beatType?: number; keyAt?: number; meterAt?: number; tieInto?: number; repeat?: [number, number] } = {}): BookMovement {
  const beats = opts.beats ?? 4;
  const beatType = opts.beatType ?? 4;
  const length = beatType === 8 ? beats / 2 : beats;
  const measures = Array.from({ length: bars }, (_, i) => {
    let head = i === 0 ? `<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><sound tempo="96"/>` : '';
    if (opts.keyAt === i) head += '<attributes><key><fifths>2</fifths></key></attributes>';
    if (opts.meterAt === i) head += '<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>';
    const meterNow = opts.meterAt !== undefined && i >= opts.meterAt ? 3 : length;
    const tie = opts.tieInto === i + 1 ? '<tie type="start"/>' : opts.tieInto === i ? '<tie type="stop"/>' : '';
    const left = opts.repeat?.[0] === i ? '<barline location="left"><repeat direction="forward"/></barline>' : '';
    const right = opts.repeat?.[1] === i ? '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>' : '';
    return `<measure number="${i + 1}">${left}${head}<note><pitch><step>C</step><octave>5</octave></pitch><duration>${meterNow * 2}</duration>${tie}</note>${right}</measure>`;
  });
  const result = musicXmlToChart(`<?xml version="1.0"?><score-partwise version="4.0"><part-list/><part id="P1">${measures.join('')}</part></score-partwise>`, 'book');
  if (!result.ok) throw new Error(result.reason);
  return { chart: result.chart, marks: result.marks };
}

const nameOf = (n: number) => `Part ${n}`;

describe('a book read into the parts of an own song (ft_Y_04.AC22)', () => {
  it('a key or meter change starts a part; bars inside a repeat and bars a tie reaches into are known', () => {
    const m = movement(30, { keyAt: 20, tieInto: 6, repeat: [2, 4] });
    const layout = layoutOf(m);
    expect(layout.mustStarts).toEqual([20]);
    expect(layout.inRepeat).toEqual([3, 4]);
    expect(layout.tiedInto).toEqual([6]);
    expect(proposeStarts(layout)).toContain(20);
  });

  it('each part becomes a piece of its own bars titled with the song and its name; the song takes the first part values', () => {
    const book = [movement(30, { keyAt: 20 })];
    const parts = bookParts(book, book.map((m) => proposeStarts(layoutOf(m))), 'Waltz', nameOf);
    expect(parts.map((p) => [p.firstBar, p.lastBar, p.name])).toEqual([[0, 9, 'Part 1'], [10, 19, 'Part 2'], [20, 29, 'Part 3']]);
    const pieces = parts.map((p) => ('piece' in p ? p.piece : null));
    expect(pieces.map((p) => [p?.title, p?.bars, p?.fifths])).toEqual([['Waltz: Part 1', 10, 0], ['Waltz: Part 2', 10, 0], ['Waltz: Part 3', 10, 2]]);
    const song = bookSong('own-song-waltz', 'Waltz', parts, ['own-waltz-p01', 'own-waltz-p02', 'own-waltz-p03'], (m) => `Movement ${m}`);
    expect(songSchema.safeParse(song).success).toBe(true);
    expect(songTreeProblems(song.nodes)).toEqual([]);
    expect(song).toMatchObject({ bpm: 96, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 }, license: 'NaN' });
    expect(song.nodes).toEqual([
      { kind: 'piece', id: 'part-1', piece: 'own-waltz-p01', name: 'Part 1' },
      { kind: 'piece', id: 'part-2', piece: 'own-waltz-p02', name: 'Part 2' },
      { kind: 'piece', id: 'part-3', piece: 'own-waltz-p03', name: 'Part 3', key: { fifths: 2, mode: 'major' } },
    ]);
  });

  it('a part the piece maker cannot hold, or one not saved, stays a blank of its bars; movements become groups', () => {
    const book = [movement(8), movement(6, { beats: 6, beatType: 8 })];
    const parts = bookParts(book, [[0], [0]], 'Suite', nameOf);
    expect('reason' in parts[1]! && parts[1].reason).toMatch(/6\/8/);
    const song = bookSong('own-song-suite', 'Suite', parts, ['own-suite-p01', undefined], (m) => `Movement ${m}`);
    expect(songSchema.safeParse(song).success).toBe(true);
    expect(song.nodes).toEqual([
      { kind: 'group', id: 'movement-1', name: 'Movement 1', nodes: [{ kind: 'piece', id: 'part-1', piece: 'own-suite-p01', name: 'Part 1' }] },
      { kind: 'group', id: 'movement-2', name: 'Movement 2', nodes: [{ kind: 'blank', id: 'part-2', name: 'Part 2', bars: 6 }] },
    ]);
  });
});
