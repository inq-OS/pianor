/**
 * The practice screen's PC-keyboard shortcuts (ft_Y_13): a table from key to action, the letter shown in
 * brackets on each button, and the state machine of the section-repeat chord (R, the first bar, the last bar). Pure, so the
 * scene only forwards keys and acts on the result.
 *
 * Keys are physical (`KeyboardEvent.code`). The computer-keyboard piano (`QWERTY_OFFSETS`) is always listening and uses most
 * letters, R among them (F4 one octave down), so R as a plain key must stay a note: the section key is Shift+R. A and F are
 * not piano keys and work plain. The click is Shift+M for the same reason (M is a piano key). Its speed is Shift+= (the "+" key) and
 * Shift+-: the plain +/- keys are no piano keys, but they would read as the tempo percent buttons, which are marked + and - too.
 * The space bar starts the play over from the first bar (`reset`); it has no button (the clean-screen rule).
 */

import { t } from '../../core/text/strings';

export type HotkeyAction = 'section' | 'noteNames' | 'fingers' | 'click' | 'clickFaster' | 'clickSlower' | 'reset';

/** Key code and the letter shown in brackets, by action. */
export const HOTKEYS: Readonly<Record<HotkeyAction, { code: string; letter: string; shift?: boolean }>> = {
  section: { code: 'KeyR', letter: 'Shift+R', shift: true },
  noteNames: { code: 'KeyA', letter: 'A' },
  fingers: { code: 'KeyF', letter: 'F' },
  click: { code: 'KeyM', letter: 'Shift+M', shift: true },
  clickFaster: { code: 'Equal', letter: 'Shift++', shift: true },
  clickSlower: { code: 'Minus', letter: 'Shift+-', shift: true },
  /** The space bar starts the piece (or section) over from its first bar; no piano key uses it. */
  reset: { code: 'Space', letter: 'Space' },
};

/** Whether a key starts the play over from the first bar (practice): the space bar, plain. */
export function isResetKey(e: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return actionForCode(e.code, e.shiftKey) === 'reset' && !e.ctrlKey && !e.metaKey && !e.altKey;
}

/** The action a key code triggers, or null. */
export function actionForCode(code: string, shift = false): HotkeyAction | null {
  for (const action of Object.keys(HOTKEYS) as HotkeyAction[]) {
    if (HOTKEYS[action].code === code && (HOTKEYS[action].shift === true) === shift) return action;
  }
  return null;
}

/** A button label with its hotkey in brackets: `Section [Shift+R]`. */
export function hotkeyLabel(label: string, action: HotkeyAction): string {
  return t('practice.hotkey', { label, key: HOTKEYS[action].letter });
}

/** The first candidate (longest first) that is at most `room` art pixels wide in a button, `measure` being the text width; the last one if none fits. */
export function firstFitting(candidates: readonly string[], room: number, measure: (text: string) => number, padding = 10): string {
  return candidates.find((c) => measure(c) + padding <= room) ?? candidates[candidates.length - 1]!;
}

/** The digit a key code stands for (top row or number pad), or null. */
export function digitForCode(code: string): string | null {
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  return match ? match[1]! : null;
}

/** Where the chord is: not started, waiting for the first bar, or for the last bar (the first is 0-based). `digits` is typed so far. */
export type Chord =
  | { phase: 'idle' }
  | { phase: 'first'; digits: string }
  | { phase: 'last'; first: number; digits: string };

export const IDLE: Chord = { phase: 'idle' };

export type ChordInput = { kind: 'key'; code: string } | { kind: 'timeout' };

export type ChordEffect =
  | { kind: 'none' }
  /** The chord started: the scene shows the prompt for the first bar. */
  | { kind: 'picking' }
  /** The first bar is known: the scene shows the prompt for the last bar. */
  | { kind: 'first-picked' }
  /** The picking was cancelled with R. */
  | { kind: 'cancel' }
  /** R while a section is set: back to the whole piece. */
  | { kind: 'whole' }
  /** The section to start, bars 0-based and inclusive, first <= last. */
  | { kind: 'section'; first: number; last: number }
  /** A bar number that is not in the piece; the typed digits are dropped. */
  | { kind: 'rejected' };

export interface ChordContext {
  /** Bars of the whole piece. */
  barCount: number;
  /** A section is being practised (so R goes back to the whole piece). */
  inSection: boolean;
  /** The piece's first printed bar number: 0 when it starts with a pick-up, else 1 (the default; core_09.AC25). */
  firstPrinted?: 0 | 1;
}

/** The printed numbers a player can type: from the first bar's (0 for a pick-up) to the last bar's. */
export function typedBarRange(ctx: ChordContext): { first: number; last: number } {
  const first = ctx.firstPrinted ?? 1;
  return { first, last: ctx.barCount - 1 + first };
}

export interface ChordStep {
  chord: Chord;
  effect: ChordEffect;
}

const MAX_DIGITS = 3;
const none = (chord: Chord): ChordStep => ({ chord, effect: { kind: 'none' } });

/** Take the typed number (bars numbered as on the staff: from 1, a pick-up 0) and move on. */
function commit(chord: Extract<Chord, { phase: 'first' | 'last' }>, ctx: ChordContext): ChordStep {
  if (chord.digits === '') return none(chord);
  const n = Number(chord.digits);
  const range = typedBarRange(ctx);
  if (n < range.first || n > range.last) return { chord: { ...chord, digits: '' }, effect: { kind: 'rejected' } };
  if (chord.phase === 'first') return { chord: { phase: 'last', first: n - range.first, digits: '' }, effect: { kind: 'first-picked' } };
  const a = chord.first;
  const b = n - range.first;
  return { chord: IDLE, effect: { kind: 'section', first: Math.min(a, b), last: Math.max(a, b) } };
}

/**
 * One key (or the end of the typing pause) in. R starts picking, or cancels it, or goes back to the whole piece; digits make
 * a bar number, which is taken at once when no longer number could follow, otherwise on Enter or after the pause (`timeout`);
 * Backspace drops a digit. A reversed pair of bars is put in order. Escape is the scene's own (it cancels and resets).
 */
export function chordStep(chord: Chord, input: ChordInput, ctx: ChordContext): ChordStep {
  if (input.kind === 'timeout') return chord.phase === 'idle' ? none(chord) : commit(chord, ctx);
  const { code } = input;
  if (code === HOTKEYS.section.code) {
    if (chord.phase === 'idle') {
      return ctx.inSection ? { chord, effect: { kind: 'whole' } } : { chord: { phase: 'first', digits: '' }, effect: { kind: 'picking' } };
    }
    return chord.digits === '' ? { chord: IDLE, effect: { kind: 'cancel' } } : none(chord);
  }
  if (chord.phase === 'idle') return none(chord);
  if (code === 'Enter' || code === 'NumpadEnter') return commit(chord, ctx);
  if (code === 'Backspace') return none({ ...chord, digits: chord.digits.slice(0, -1) });
  const digit = digitForCode(code);
  if (digit === null || chord.digits.length >= MAX_DIGITS) return none(chord);
  const next = { ...chord, digits: chord.digits + digit };
  const n = Number(next.digits);
  // no longer number can follow: a bar number times ten is already past the last bar
  return n >= 1 && n * 10 > typedBarRange(ctx).last ? commit(next, ctx) : none(next);
}
