/**
 * The chart of an editor piece, made directly from the model. The editor draws and hit-tests this while a piece is
 * written, also when it has no notes yet (the compiler refuses an empty piece). A test proves it equals what the ABC
 * compiler makes of the editor's ABC, so what the editor shows is what the game will play. Pure.
 */
import { PPQ } from '../chart/time';
import { chartSchema, type Chart } from '../chart/schema';
import { barLength, barStartTick, barTicks, bpmOf, handsOf, LENGTH_TICKS, restsFor, soundingMidi, tickOf, type EditorPiece } from './model';
import { cleanTitle } from './abc';
import { repeatsOf } from './repeats';
import { slursOf } from './slurRules';
import { tieWritten } from './ties';
import { graceWritten } from './graces';

export function toChart(piece: EditorPiece, options: { id: string; level?: number; contentVersion?: number }): Chart {
  const hands = handsOf(piece);
  // the compiler's order: by time, then by voice (right hand first), then by pitch
  const order = (track: string) => hands.findIndex((h) => h.toLowerCase() === track);
  const notes = piece.notes
    .map((n) => ({
      tick: tickOf(piece, n.bar, n.start), dur: LENGTH_TICKS[n.length], midi: soundingMidi(n),
      spelling: { step: n.step, alter: n.alter, octave: n.octave }, track: n.hand.toLowerCase(), voice: 1, bar: n.bar,
      // a tie the ABC writes (the same test as abc.ts): the staff draws it, so the editor shows the tie
      ...(tieWritten(piece, n) ? { tieNext: true } : {}),
      // the author's finger, drawn below the note (ft_1_02d.AC4)
      ...(n.finger === undefined ? {} : { finger: n.finger }),
      ...(n.dynamic === undefined ? {} : { dynamic: n.dynamic }),
    }))
    .sort((a, b) => a.tick - b.tick || order(a.track) - order(b.track) || a.midi - b.midi);
  const rests = hands
    .flatMap((hand) => restsFor(piece, hand).map((r) => ({
      tick: tickOf(piece, r.bar, r.start), dur: r.length === 'bar' ? barTicks(piece) : LENGTH_TICKS[r.length], track: hand.toLowerCase(), voice: 1, bar: r.bar,
    })))
    .sort((a, b) => a.tick - b.tick || order(a.track) - order(b.track));
  // the slurs, from the first note's start to the last one's, in their hand (core_09.AC30)
  const slurs = slursOf(piece).map((s) => ({ track: s.hand.toLowerCase(), voice: 1, startTick: tickOf(piece, s.from.bar, s.from.start), endTick: tickOf(piece, s.to.bar, s.to.start) }));
  // the pre-notes the ABC writes (the same rule as abc.ts), on the start of their note, in the compiler's order (core_09.AC35)
  const graces = piece.notes
    .filter((n) => graceWritten(piece, n))
    .map((n) => ({
      track: n.hand.toLowerCase(), voice: 1, tick: tickOf(piece, n.bar, n.start),
      pitch: { midi: soundingMidi(n.grace!), spelling: { step: n.grace!.step, alter: n.grace!.alter, octave: n.grace!.octave } }, slash: n.grace!.slash,
    }))
    .sort((a, b) => a.tick - b.tick || order(a.track) - order(b.track));
  const midis = notes.map((n) => n.midi);
  const meterMap = [{ tick: 0, num: piece.beats, den: 4 }];
  return chartSchema.parse({
    schemaVersion: 2,
    id: options.id,
    contentVersion: options.contentVersion ?? 1,
    title: cleanTitle(piece.title),
    level: options.level ?? 1,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: bpmOf(piece) }],
    meterMap,
    keyMap: [{ tick: 0, fifths: piece.fifths, mode: piece.mode }],
    tracks: hands.map((hand) => ({ id: hand.toLowerCase(), role: 'play', hand, clef: hand === 'RH' ? 'treble' : 'bass' })),
    notes,
    rests,
    // a pick-up is a short bar 0 and the last bar holds the rest (core_09.AC30), as the compiler makes them
    bars: Array.from({ length: piece.bars }, (_, index) => ({ index, startTick: barStartTick(piece, index), endTick: barStartTick(piece, index) + barLength(piece, index) })),
    phrases: [],
    ...(repeatsOf(piece).length > 0 ? { repeats: repeatsOf(piece) } : {}),
    ...(slurs.length > 0 ? { slurs } : {}),
    ...(graces.length > 0 ? { graces } : {}),
    // an empty piece has no range yet: middle C stands in, so the staff can still be drawn
    range: midis.length > 0 ? { low: Math.min(...midis), high: Math.max(...midis) } : { low: 60, high: 60 },
  });
}
