/**
 * The string keys shown while the student plays (d312): on or by the staff in practice, learning, the tug, teaching, the
 * trainers and the theory lessons. Each is a mark or a number, never a sentence, in every language; most of what play
 * shows is built from the marks in `marks.ts` and needs no key at all. Character talk between rounds, tooltips, menus and
 * teacher pages are not here: they may be words. Pure: no DOM, no engine.
 */
import type { StringKey } from './strings';

export const IN_PLAY_KEYS: readonly StringKey[] = [
  // the trainers' round result: "9/15  +90 XP"
  'trainerResult.withXp',
  // a lesson step's line and its count, the try and the pitfall marks
  'lessons.line.playAlong',
  'lessons.line.done',
  'lessons.halfStep.try',
  'lessons.halfStep.pitfall',
  'lessons.wholeStep.try',
  'lessons.wholeStep.pitfall',
  'lessons.majorScale.try',
  'lessons.majorScale.pitfall',
  // practice: the section and start marks on the staff, the tempo percent and the latest pass
  'practice.markStart',
  'practice.markEnd',
  'practice.markFrom',
  'practice.percent',
  'practice.paneLatest',
  // the ear trainer's note length
  'ear.length',
];

const DYNAMICS = 'shown with the note-name hints, the word teaches the sign beside it (core_09.AC15)';
const PICKING = 'picking a section is a tool, not play';

/**
 * The words still shown in play, each for its reason. AX-3 provisional: kept until a mark says the same as plainly;
 * TODO(architect) in ft_1_20, ft_1_39 and core_09.
 */
export const IN_PLAY_WORDS: Readonly<Partial<Record<StringKey, string>>> = {
  'lessons.mark.half': 'the step that teaches the term names it',
  'lessons.mark.whole': 'the step that teaches the term names it',
  'staff.dyn.pp': DYNAMICS,
  'staff.dyn.p': DYNAMICS,
  'staff.dyn.mp': DYNAMICS,
  'staff.dyn.mf': DYNAMICS,
  'staff.dyn.f': DYNAMICS,
  'staff.dyn.ff': DYNAMICS,
  'staff.legato': 'shown with the note-name hints over a slur (core_09.AC27)',
  'practice.bubbleHint': 'the one-time tip that the music has more tools',
  'marks.octaveTip': 'the one-time tip that names the 8 the first time a player sees it',
  'marks.halfTip': 'the one-time tip that names the ½ the first time a player sees it',
  'practice.pickStart': PICKING,
  'practice.pickEnd': PICKING,
  'practice.sectionEmpty': PICKING,
  'practice.badBar': PICKING,
};

/** The words of a shown text: runs of two letters or more, its placeholders left out (a singular-or-plural choice reads as its first word). */
export function wordsOf(text: string): string[] {
  return text.replace(/\{\w+\|([^|{}]*)\|[^|{}]*\}/g, ' $1 ').replace(/\{\w+\}/g, ' ').match(/\p{L}{2,}/gu) ?? [];
}

/** A text is a sentence when it has more than one word of letters ("XP" alone is a unit, not a sentence). */
export function isSentence(text: string): boolean {
  return wordsOf(text).length > 1;
}
