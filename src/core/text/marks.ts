/**
 * The marks the game shows while the student plays, in place of sentences (d312): a count is a number pair, a judgement a
 * mark (an octave off is 8, a next-door key ½, a wrong letter only its arrow, early ◀, late ▶), a lap ↻, a tempo ♩. They
 * are the same in every language, so they need no string key. Each character has a glyph in the pixel font. Where there
 * is a staff the judgement is drawn on it (the played key's ghost note); these are for the screens and lines without one,
 * and for the numbers by the staff. Pure: no DOM, no engine.
 */
import { midiToSpelling } from '../chart/pitch';
import type { WrongReason } from '../judge/types';
import { noteLabel, type NoteNaming } from './noteName';

export const MARK = {
  right: '✓',
  wrong: '✗',
  /** The played key was higher (▲) or lower (▼) than the awaited one; also a tempo that rose. */
  up: '▲',
  down: '▼',
  early: '◀',
  late: '▶',
  lap: '↻',
  tempo: '♩',
  octave: '8',
  half: '½',
  whole: '1',
  atLeast: '≥',
} as const;

/** A count against its total: "3/5". */
export function countMark(right: number, total: number): string {
  return `${right}/${total}`;
}

/** Why a key was wrong, as a mark: an octave off "8▲", the key next door "½▼", another letter only the arrow "▲". */
export function pitchMark(reason: WrongReason, direction: 'higher' | 'lower'): string {
  const arrow = direction === 'higher' ? MARK.up : MARK.down;
  if (reason === 'wrong-octave') return `${MARK.octave}${arrow}`;
  if (reason === 'neighbour-key') return `${MARK.half}${arrow}`;
  return arrow;
}

/** A wrong key as the judge gives it: the key played, the awaited key, the reason and which way the played key lay. */
export interface Miss {
  readonly midi: number;
  readonly expectedMidi: number;
  readonly reason: WrongReason;
  readonly direction: 'higher' | 'lower';
}

/**
 * A wrong key where there is no staff to draw it on (the ear trainer, the tug): the awaited note's name with ✓, the played
 * one's with ✗, then the reason's mark, so the arrow always says where the played key was against a named note:
 * "E✓ F✗ ½▲". An octave off names the letter once, as both keys have it: "C✓ 8▲".
 */
export function missMark(miss: Miss, naming: NoteNaming): string {
  const name = (midi: number) => noteLabel(midiToSpelling(midi), naming);
  const reason = pitchMark(miss.reason, miss.direction);
  if (miss.reason === 'wrong-octave') return `${name(miss.expectedMidi)}${MARK.right} ${reason}`;
  return `${name(miss.expectedMidi)}${MARK.right} ${name(miss.midi)}${MARK.wrong} ${reason}`;
}

/** A key played that the answer does not have: "C#✗". */
export function notInMark(note: string): string {
  return `${note}${MARK.wrong}`;
}

/** A lap of a section: "↻3". */
export function lapMark(n: number): string {
  return `${MARK.lap}${n}`;
}

/** A tempo in beats per minute: "♩72", with ▲ when it has just stepped up. */
export function tempoMark(bpm: number | string, rose = false): string {
  return `${MARK.tempo}${bpm}${rose ? MARK.up : ''}`;
}

/** What a section practised came to: its laps, its clean laps and the tempo from and to, "↻4 ✓2 ♩60▶66". */
export function sectionLogMark(log: { laps: number; clean: number; from: number; to: number }): string {
  return `${lapMark(log.laps)} ${MARK.right}${log.clean} ${MARK.tempo}${log.from}${MARK.late}${log.to}`;
}

/** A run of bars: "3-6". */
export function barsMark(first: number, last: number): string {
  return first === last ? String(first) : `${first}-${last}`;
}
