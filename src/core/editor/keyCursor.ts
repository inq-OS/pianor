/**
 * The keyboard cursor of the piece maker (ft_1_02d.AC15): a place on one staff (hand, bar, start) and a
 * pitch, moved with the arrow keys so a piece can be written without the mouse. Left and right go from one note, chord or
 * rest start of the hand to the next; in free time they step by the selected length, so an empty bar of quarters is four
 * stops. Up and down go one staff step, so the cursor stops on each head of a chord. Pure.
 */
import { naturalAtPosition, type Clef, type Step } from '../chart/pitch';
import { barLength, handsOf, KEY_HIGH, KEY_LOW, LENGTH_TICKS, midiOf, placedRests, stepped, type EditorHand, type EditorLength, type EditorPiece, type NoteRef } from './model';

/** Where the cursor is: a note ref names a pitch on a place, whether a note is there or not. */
export type KeyCursor = NoteRef;

const CLEF: Readonly<Record<EditorHand, Clef>> = { RH: 'treble', LH: 'bass' };
/** The middle line of each staff: where the cursor starts on it (B4 in the treble, D3 in the bass). */
const MIDDLE_LINE = 4;

/** The cursor at the start of the piece, on the middle line of the first hand's staff. */
export function startKeyCursor(piece: EditorPiece): KeyCursor {
  const hand = handsOf(piece)[0]!;
  return { hand, bar: 0, start: 0, ...naturalAtPosition(MIDDLE_LINE, CLEF[hand]) };
}

/**
 * The starts the cursor stops at in one bar of a hand, earliest first: every note, chord and placed rest start, and in the
 * free time between them a stop every `length` (the selected length) from where the free time begins.
 */
export function timeStops(piece: EditorPiece, hand: EditorHand, bar: number, length: EditorLength): number[] {
  const spans = [
    ...piece.notes.filter((n) => n.hand === hand && n.bar === bar),
    ...placedRests(piece).filter((r) => r.hand === hand && r.bar === bar),
  ].map((e) => ({ start: e.start, end: e.start + LENGTH_TICKS[e.length] })).sort((a, b) => a.start - b.start);
  const stops = new Set<number>();
  const step = LENGTH_TICKS[length];
  let at = 0;
  const fill = (until: number) => {
    for (; at < until; at += step) stops.add(at);
  };
  for (const s of spans) {
    fill(s.start);
    stops.add(s.start);
    at = Math.max(at, s.end);
  }
  fill(barLength(piece, bar));
  return [...stops].sort((a, b) => a - b);
}

/** Left (-1) or right (1): the previous or next stop of the hand, across bar lines; at either end of the piece it stays. */
export function moveInTime(piece: EditorPiece, cursor: KeyCursor, direction: 1 | -1, length: EditorLength): KeyCursor {
  const here = timeStops(piece, cursor.hand, cursor.bar, length);
  const inBar = direction > 0 ? here.find((s) => s > cursor.start) : [...here].reverse().find((s) => s < cursor.start);
  if (inBar !== undefined) return { ...cursor, start: inBar };
  const bar = cursor.bar + direction;
  if (bar < 0 || bar >= piece.bars) return cursor;
  const there = timeStops(piece, cursor.hand, bar, length);
  return { ...cursor, bar, start: direction > 0 ? there[0]! : there[there.length - 1]! };
}

/** Ctrl + left or right: the start of the previous or next bar; left inside a bar goes to its own start first. */
export function moveBar(piece: EditorPiece, cursor: KeyCursor, direction: 1 | -1): KeyCursor {
  if (direction < 0 && cursor.start > 0) return { ...cursor, start: 0 };
  const bar = cursor.bar + direction;
  return bar < 0 || bar >= piece.bars ? cursor : { ...cursor, bar, start: 0 };
}

/** Up (1) or down (-1) one staff step; the cursor stays on the keys of the EZ-220. */
export function movePitch(cursor: KeyCursor, direction: 1 | -1): KeyCursor {
  const next = stepped(cursor, direction);
  const midi = midiOf(next.step, next.octave);
  return midi < KEY_LOW || midi > KEY_HIGH ? cursor : { ...cursor, ...next };
}

/**
 * The stops of Ctrl + up or down, low to high: on each staff the space between its two lowest lines and
 * the space between its two highest, so a jump never lands on a ledger line: A2 and G3 on the bass, F4 and E5 on the treble.
 */
const STAFF_STOPS: readonly { hand: EditorHand; position: number }[] = [
  { hand: 'LH', position: 1 },
  { hand: 'LH', position: 7 },
  { hand: 'RH', position: 1 },
  { hand: 'RH', position: 7 },
];

/**
 * Ctrl + up (1) or down (-1): the next stop above or below the cursor's pitch (`STAFF_STOPS`, only the staves the piece has),
 * past the last one round to the first (A2, G3, F4, E5, A2 going up). On the other staff it goes to the same time or, inside
 * a note there, to that note's start (the stop at or before it).
 */
export function otherStaff(piece: EditorPiece, cursor: KeyCursor, length: EditorLength, direction: 1 | -1 = 1): KeyCursor {
  const hands = handsOf(piece);
  const stops = STAFF_STOPS.filter((s) => hands.includes(s.hand)).map((s) => ({ hand: s.hand, ...naturalAtPosition(s.position, CLEF[s.hand]) }));
  const here = midiOf(cursor.step, cursor.octave);
  const pitchOf = (s: (typeof stops)[number]) => midiOf(s.step, s.octave);
  const stop = direction > 0 ? stops.find((s) => pitchOf(s) > here) ?? stops[0]! : [...stops].reverse().find((s) => pitchOf(s) < here) ?? stops[stops.length - 1]!;
  const start = stop.hand === cursor.hand ? cursor.start : timeStops(piece, stop.hand, cursor.bar, length).filter((s) => s <= cursor.start).pop() ?? 0;
  return { ...cursor, hand: stop.hand, start, step: stop.step, octave: stop.octave };
}

/** The cursor after the pitch it stands on changed (Shift + up or down moved the note under it). */
export function withPitch(cursor: KeyCursor, pitch: { step: Step; octave: number }): KeyCursor {
  return { ...cursor, step: pitch.step, octave: pitch.octave };
}
