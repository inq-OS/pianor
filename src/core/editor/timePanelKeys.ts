/**
 * The keys of the piece maker's time panel (ft_1_02d.AC21) while it is open: left and right choose the time, the pick-up
 * or the tempo; up and down (or + and -) step the chosen one; a digit sets the time (2, 3, 4) or the pick-up's beats, and on
 * the tempo digits are typed, set once no digit more fits (or on Enter); Enter and Esc close the panel. Pure: the scene
 * does the action. AX-3 provisional: the keys of the panel.
 */
import { BPM_MAX, BPM_MIN } from './model';

export type TimeGroup = 'meter' | 'pickup' | 'bpm';
const GROUPS: readonly TimeGroup[] = ['meter', 'pickup', 'bpm'];

export interface TimePanelState {
  readonly group: TimeGroup;
  /** The digits of a tempo typed so far. */
  readonly typed: string;
}

export const TIME_PANEL_START: TimePanelState = { group: 'meter', typed: '' };

export type TimePanelAction =
  | { kind: 'step'; group: TimeGroup; direction: 1 | -1 }
  | { kind: 'meter'; beats: 2 | 3 | 4 }
  | { kind: 'pickup'; beats: number }
  | { kind: 'bpm'; bpm: number; close?: true }
  /** a digit of a tempo was typed: the panel shows it */
  | { kind: 'typed' }
  | { kind: 'close' }
  /** the panel's key, doing nothing here */
  | { kind: 'none' }
  /** not the panel's key */
  | { kind: 'pass' };

const STEP_KEYS: Readonly<Record<string, 1 | -1>> = { ArrowUp: 1, ArrowDown: -1, Equal: 1, Minus: -1, NumpadAdd: 1, NumpadSubtract: -1 };

export function timePanelKey(state: TimePanelState, code: string): { state: TimePanelState; action: TimePanelAction } {
  const at = GROUPS.indexOf(state.group);
  const keep = (action: TimePanelAction) => ({ state, action });
  if (code === 'Escape') return { state: { ...state, typed: '' }, action: { kind: 'close' } };
  if (code === 'Enter' || code === 'NumpadEnter') {
    const bpm = Number(state.typed);
    const fresh = { ...state, typed: '' };
    return { state: fresh, action: state.typed && bpm >= BPM_MIN && bpm <= BPM_MAX ? { kind: 'bpm', bpm, close: true } : { kind: 'close' } };
  }
  if (code === 'ArrowLeft' || code === 'ArrowRight') {
    const group = GROUPS[Math.max(0, Math.min(GROUPS.length - 1, at + (code === 'ArrowRight' ? 1 : -1)))]!;
    return { state: { group, typed: '' }, action: { kind: 'none' } };
  }
  const direction = STEP_KEYS[code];
  if (direction) return { state: { ...state, typed: '' }, action: { kind: 'step', group: state.group, direction } };
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  const digit = match ? Number(match[1]) : null;
  if (digit === null) return keep({ kind: 'pass' });
  if (state.group === 'meter') return keep(digit >= 2 && digit <= 4 ? { kind: 'meter', beats: digit as 2 | 3 | 4 } : { kind: 'none' });
  if (state.group === 'pickup') return keep(digit <= 3 ? { kind: 'pickup', beats: digit } : { kind: 'none' });
  if (state.typed === '' && digit === 0) return keep({ kind: 'none' });
  const typed = state.typed + String(digit);
  const bpm = Number(typed);
  // a digit more would go past the fastest tempo: the tempo is typed
  if (bpm * 10 > BPM_MAX) return { state: { ...state, typed: '' }, action: bpm >= BPM_MIN && bpm <= BPM_MAX ? { kind: 'bpm', bpm } : { kind: 'none' } };
  return { state: { ...state, typed }, action: { kind: 'typed' } };
}
