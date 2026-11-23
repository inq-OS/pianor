import type { StringKey } from '../text/strings';
import type { MouseAction } from './mouse';

/**
 * The piece maker's help as pictures (ft_1_33): each simple mouse action as a card, a small mouse with
 * what is pressed, the staff before and the staff after (every simple action: the mouse, what is pressed, what comes
 * of it), and the steps of Kiur's tour of the keys. Plain data; the scene draws it. Every card that
 * is a press names it, and a test holds it to `mouseAction`, so the pictures say what the buttons do.
 */

/** What the small mouse shows: a button lit, the wheel lit and turned up, or the left button held and dragged. */
export type MouseGesture = 'left' | 'middle' | 'right' | 'wheelUp' | 'drag';

/** A key held with it, drawn as a key cap. */
export type HeldKey = 'ctrl' | 'alt';

/** A note on a sketched staff: its bar (0 or 1), its place (0 the bottom line, each step a line or a space up), its length; `lit` when selected. */
export interface SketchNote {
  readonly bar: 0 | 1;
  readonly place: number;
  readonly length: 'quarter' | 'half';
  readonly lit?: boolean;
}

/** A few bars of staff, drawn small: the notes on it, where the pointer is (before the press), and a box round both bars (a lasso's selection). */
export interface StaffSketch {
  readonly notes: readonly SketchNote[];
  readonly pointer?: { readonly bar: 0 | 1; readonly place: number };
  readonly boxed?: boolean;
}

export interface HelpCard {
  readonly gesture: MouseGesture;
  readonly key?: HeldKey;
  readonly before: StaffSketch;
  readonly after: StaffSketch;
  /** The press it shows (a DOM `MouseEvent.button` with its keys) and what `mouseAction` makes of it; none for the wheel. */
  readonly press?: { readonly button: number; readonly altKey: boolean; readonly shiftKey: boolean; readonly action: MouseAction };
}

const B = 4; // the middle line
const quarter = (place = B, lit = false): SketchNote => ({ bar: 0, place, length: 'quarter', ...(lit ? { lit } : {}) });
const pointer = { bar: 0, place: B } as const;
const press = (button: number, action: MouseAction, altKey = false) => ({ button, altKey, shiftKey: false, action });

/** The cards, in reading order (two columns, row by row). */
export const HELP_CARDS: readonly HelpCard[] = [
  // the middle button on the staff writes a note; on a touchpad Alt + left does the same
  { gesture: 'middle', before: { notes: [], pointer }, after: { notes: [quarter()] }, press: press(1, 'place') },
  { gesture: 'left', key: 'alt', before: { notes: [], pointer }, after: { notes: [quarter()] }, press: press(0, 'place', true) },
  { gesture: 'left', before: { notes: [quarter()], pointer }, after: { notes: [quarter(B, true)] }, press: press(0, 'select') },
  // the right button on a note selects it and opens the bubble of what can be done with it (ft_1_20, d282)
  { gesture: 'right', before: { notes: [quarter()], pointer }, after: { notes: [quarter(B, true)] }, press: press(2, 'bubble') },
  // the wheel on a note moves it a step; with Ctrl it changes its length
  { gesture: 'wheelUp', before: { notes: [quarter()], pointer }, after: { notes: [quarter(B + 1)] } },
  { gesture: 'wheelUp', key: 'ctrl', before: { notes: [quarter()], pointer }, after: { notes: [{ ...quarter(), length: 'half' }] } },
  // the middle button on a note makes it longer
  { gesture: 'middle', before: { notes: [quarter()], pointer }, after: { notes: [{ ...quarter(), length: 'half' }] }, press: press(1, 'place') },
  // a left drag over bars selects them
  {
    gesture: 'drag',
    before: { notes: [quarter(), { bar: 1, place: B + 2, length: 'quarter' }], pointer },
    after: { notes: [quarter(), { bar: 1, place: B + 2, length: 'quarter' }], boxed: true },
    press: press(0, 'select'),
  },
];

/** The words on a held key's cap. */
export const KEY_CAP: Readonly<Record<HeldKey, StringKey>> = { ctrl: 'editor.help.key.ctrl', alt: 'editor.help.key.alt' };

/** What one step of the keys tour shows: the cursor on the staff, the cursor's bar, or the band of tools. */
export type KeyTourSpot = 'cursor' | 'bar' | 'band';

/** Kiur's tour of the keys (ft_1_33.AC3), in order. */
export const KEY_TOUR: readonly { readonly spot: KeyTourSpot; readonly line: StringKey }[] = [
  { spot: 'cursor', line: 'editor.tour.arrows' },
  { spot: 'cursor', line: 'editor.tour.enter' },
  { spot: 'cursor', line: 'editor.tour.shift' },
  { spot: 'bar', line: 'editor.tour.bars' },
  { spot: 'band', line: 'editor.tour.band' },
];
