/**
 * The editor's output: the ABC text and the meta file a person would write for the same piece, so an own piece takes the
 * same path as every other one (compiler, linter, the game's loader). Pure.
 */
import { abcBarLine, repeatsOf } from './repeats';
import { tieWritten } from './ties';
import { graceWritten } from './graces';
import { slursOf } from './slurRules';
import { abcPitch } from '../chart/pitch';
import { OWN_PIECE_LICENSE } from '../chart/schema';
import type { Alter } from '../chart/key';
import { bpmOf, handsOf, keyAlterOf, restsFor, soundingMidi, type EditorHand, type EditorLength, type EditorPiece } from './model';
import { abcKey } from './key';

/** ABC lengths with `L:1/8`: an eighth is the unit. */
const ABC_LENGTH: Readonly<Record<EditorLength, string>> = { sixteenth: '/2', eighth: '', dottedEighth: '3/2', quarter: '2', dottedQuarter: '3', half: '4', dottedHalf: '6', whole: '8' };

/** A title as ABC can carry it: one line, no comment sign. */
export function cleanTitle(title: string): string {
  return title.replace(/[%\r\n]/g, ' ').replace(/\s+/g, ' ').trim() || 'My piece';
}

/**
 * The accidental a note is written with (core_09.AC8): nothing when the key already gives its alter and no earlier accidental
 * in the bar holds another one for the pitch; otherwise ^ (sharp), _ (flat) or = (natural). The ABC compiler keeps an
 * accidental to the bar line, so this follows the same rule (the bar starts again from the key).
 */
function accidentalOf(alter: Alter, keyAlter: Alter, held: Alter | undefined): string {
  if (alter === (held ?? keyAlter)) return '';
  return alter === 1 ? '^' : alter === -1 ? '_' : '=';
}

function voice(piece: EditorPiece, hand: EditorHand): string {
  const bars: string[] = [];
  const rests = restsFor(piece, hand);
  // the slurs of this hand, by the onset each starts and ends on: a chord is slurred as a whole (core_09.AC30)
  const written = slursOf(piece).filter((s) => s.hand === hand);
  const opens = new Set(written.map((s) => `${s.from.bar}:${s.from.start}`));
  const closes = new Set(written.map((s) => `${s.to.bar}:${s.to.start}`));
  for (let b = 0; b < piece.bars; b++) {
    const inBar = piece.notes.filter((n) => n.hand === hand && n.bar === b);
    // the accidentals of this bar, by pitch: a written one holds until the bar line
    const held = new Map<string, Alter>();
    // notes sharing a start (and so a length) are one chord: `[CEG]2`, lowest pitch first
    const chords = [...new Set(inBar.map((n) => n.start))].map((start) => {
      const chord = inBar.filter((n) => n.start === start).sort((x, y) => soundingMidi(x) - soundingMidi(y));
      const pitches = chord.map((n) => {
        // a pre-note goes first, in braces, with its own accidental: it holds to the bar line like any other (core_09.AC35)
        let grace = '';
        if (n.grace && graceWritten(piece, n)) {
          const g = n.grace;
          const graceKey = `${g.step}${g.octave}`;
          const graceMark = accidentalOf(g.alter, keyAlterOf(piece, g.step), held.get(graceKey));
          held.set(graceKey, g.alter);
          grace = `{${g.slash ? '/' : ''}${graceMark}${abcPitch(g.step, g.octave)}}`;
        }
        const key = `${n.step}${n.octave}`;
        const mark = accidentalOf(n.alter, keyAlterOf(piece, n.step), held.get(key));
        held.set(key, n.alter);
        // the author's finger, as the standard ABC fingering decoration before the note (ft_1_02d.AC4)
        const fingering = n.finger === undefined ? '' : `!${n.finger}!`;
        return grace + fingering + mark + abcPitch(n.step, n.octave);
      });
      // a tied chord carries the tie mark after its length, when every head has its target (core_09.AC13)
      // a dynamic mark goes before the note or chord it is on (core_09.AC16)
      const tie = tieWritten(piece, chord[0]!) ? '-' : '';
      const dynamic = chord.find((n) => n.dynamic !== undefined)?.dynamic;
      const prefix = dynamic === undefined ? '' : `!${dynamic}!`;
      // a slur's ( goes right before the chord and its ) right after it (core_09.AC30)
      const open = opens.has(`${b}:${start}`) ? '(' : '';
      const close = closes.has(`${b}:${start}`) ? ')' : '';
      return { start, text: prefix + open + (pitches.length > 1 ? `[${pitches.join('')}]` : pitches[0]!) + ABC_LENGTH[chord[0]!.length] + tie + close };
    });
    const events = [
      ...chords,
      ...rests.filter((r) => r.bar === b).map((r) => ({ start: r.start, text: r.length === 'bar' ? 'Z' : `z${ABC_LENGTH[r.length]}` })),
    ].sort((x, y) => x.start - y.start);
    bars.push(events.map((e) => e.text).join(' '));
  }
  // bar lines with the repeat signs (core_09.AC20)
  const repeats = repeatsOf(piece);
  return bars.map((text, b) => `${abcBarLine(repeats, b, piece.bars)} ${text} `).join('').trim() + ' ' + abcBarLine(repeats, piece.bars, piece.bars);
}

export function toAbc(piece: EditorPiece, tempo = bpmOf(piece)): string {
  const hands = handsOf(piece);
  const lines = ['X:1', `T:${cleanTitle(piece.title)}`, `M:${piece.beats}/4`, 'L:1/8', `Q:1/4=${tempo}`, `K:${abcKey(piece.fifths, piece.mode)}`];
  for (const hand of hands) lines.push(`V:${hand} clef=${hand === 'RH' ? 'treble' : 'bass'}`);
  for (const hand of hands) lines.push(`V:${hand}`, voice(piece, hand));
  return `${lines.join('\n')}\n`;
}

export interface OwnMetaOptions {
  id: string;
  /** The curriculum level it is checked against. */
  level: number;
  /** Who wrote it (the player's name). */
  author: string;
  contentVersion?: number;
}

/**
 * The meta file of a piece written in the editor: playable at once (unlock level 1), approved by the
 * person who saves it, licence "NaN" (own pieces may be songs typed in for private use), and marked as made in the editor.
 */
export function toMeta(piece: EditorPiece, options: OwnMetaOptions) {
  return {
    id: options.id,
    title: cleanTitle(piece.title),
    contentVersion: options.contentVersion ?? 1,
    level: options.level,
    unlockLevel: 1,
    status: 'approved' as const,
    hands: handsOf(piece),
    phrases: [] as { name: string; bars: [number, number] }[],
    tags: ['own'],
    source: `written in Pianor by ${options.author.trim() || 'a player'}`,
    license: OWN_PIECE_LICENSE,
    generator: { kind: 'editor' },
  };
}
