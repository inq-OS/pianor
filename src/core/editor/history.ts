/** Undo and redo over immutable values: the editor keeps every piece it was, up to a limit. Pure. */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

/** How many steps back undo can go. */
export const UNDO_LIMIT = 200;

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** A new present; what was undone before can no longer be redone. */
export function push<T>(history: History<T>, next: T): History<T> {
  const past = [...history.past, history.present];
  return { past: past.length > UNDO_LIMIT ? past.slice(past.length - UNDO_LIMIT) : past, present: next, future: [] };
}

export const canUndo = <T>(history: History<T>): boolean => history.past.length > 0;
export const canRedo = <T>(history: History<T>): boolean => history.future.length > 0;

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1]!, future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;
  return { past: [...history.past, history.present], present: history.future[0]!, future: history.future.slice(1) };
}
