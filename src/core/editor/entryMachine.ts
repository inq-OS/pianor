/**
 * Writing a piece by playing keys (pure, no DOM, no clock): a key down starts a note or a rest at the cursor of its
 * staff, holding it grows it live, releasing it fixes its length, and keys pressed within `chordMs` of each other form a
 * chord. Every entry is an item, so backspace can take the last one back. Time comes in as `atMs`; nothing reads a clock.
 */
import {
  autoLength, findNote, LENGTH_TICKS, placeNote, placeRest, placedRests, removeNote, removeRest,
  type EditorHand, type EditorLength, type EditorPiece, type NoteRef,
} from './model';
import { cursorOf, ENTRY_CONFIG, ensureBars, lengthForHold, restLengthFor, spellKey, staffFor, type StaffMode } from './playEntry';

export interface EntryOptions { staff: StaffMode; shortTapEighth: boolean; rests: boolean }
/** A MIDI number, or 'space' for the held spacebar rest. */
export type EntryKey = number | 'space';
/** One undo-able entry: a note, a chord or a rest. Notes are empty for a rest. */
export interface EntryItem { hand: EditorHand; bar: number; start: number; rest: boolean; notes: NoteRef[] }
export interface EntryState {
  piece: EditorPiece;
  held: ReadonlyMap<EntryKey, { item: number; downMs: number }>;
  items: EntryItem[];
  chordOpen: { item: number; firstMs: number } | null;
  lastHand: EditorHand | null;
  cursors: Partial<Record<EditorHand, { bar: number; start: number }>>;
  /**
   * When the first key of each item went down, by item index. Beyond the spec's shape: a chord's length counts from its
   * first key, and that key may be up before the last one is.
   */
  itemFirstMs: ReadonlyMap<number, number>;
}

export function startEntry(piece: EditorPiece): EntryState {
  return { piece, held: new Map(), items: [], chordOpen: null, lastHand: null, cursors: {}, itemFirstMs: new Map() };
}

/** The length an item has on the piece now (the first note's, for a chord: all share one). */
function itemLength(piece: EditorPiece, item: EntryItem): EditorLength {
  if (item.rest) {
    return placedRests(piece).find((r) => r.hand === item.hand && r.bar === item.bar && r.start === item.start)?.length ?? 'quarter';
  }
  return findNote(piece, item.notes[0]!)?.length ?? 'quarter';
}

/**
 * Sets the length of an item to `selected`, or the longest that fits from its start to the next thing in its staff.
 * A chord is taken off and placed again together. Null when the piece refuses it (the item is left as it was).
 */
function relength(piece: EditorPiece, item: EntryItem, selected: EditorLength): EditorPiece | null {
  const { hand, bar, start } = item;
  if (item.rest) {
    const without = removeRest(piece, { hand, bar, start });
    if (!without.ok) return null;
    const placed = placeRest(without.piece, { hand, bar, start, length: restLengthFor(autoLength(without.piece, hand, bar, start, selected)) });
    return placed.ok ? placed.piece : null;
  }
  const members = piece.notes.filter((n) => n.hand === hand && n.bar === bar && n.start === start);
  if (members.length === 0) return null;
  const without = { ...piece, notes: piece.notes.filter((n) => !members.includes(n)) };
  const length = autoLength(without, hand, bar, start, selected);
  let next: EditorPiece = without;
  for (const member of members) {
    const edit = placeNote(next, { ...member, length });
    if (!edit.ok) return null;
    next = edit.piece;
  }
  return next;
}

/** Whether the first key of the item (the one that went down at `firstMs`) is still held. */
function firstKeyHeld(s: EntryState, item: number, firstMs: number): boolean {
  return [...s.held.values()].some((v) => v.item === item && v.downMs === firstMs);
}

export function entryDown(s: EntryState, key: EntryKey, atMs: number, o: EntryOptions): EntryState {
  if (s.held.has(key)) return s;
  const isRest = typeof key !== 'number' || o.rests;
  const hand: EditorHand = typeof key === 'number' ? staffFor(key, o.staff) : (s.lastHand ?? 'RH');
  const withKey = (item: number): ReadonlyMap<EntryKey, { item: number; downMs: number }> => new Map(s.held).set(key, { item, downMs: atMs });

  // a chord: a note key within the window joins the chord's item of its hand, or starts that hand's item in the chord
  const open = s.chordOpen;
  if (!isRest && typeof key === 'number' && open && atMs - open.firstMs <= ENTRY_CONFIG.chordMs && firstKeyHeld(s, open.item, open.firstMs)) {
    const joinIndex = s.items.findIndex((item, i) => i >= open.item && item.hand === hand && !item.rest);
    const join = joinIndex >= 0 ? s.items[joinIndex] : undefined;
    if (join) {
      const edit = placeNote(s.piece, { hand, bar: join.bar, start: join.start, length: itemLength(s.piece, join), ...spellKey(s.piece, key) });
      if (!edit.ok) return s;
      const ref: NoteRef = { hand, bar: join.bar, start: join.start, ...spellKey(s.piece, key) };
      const items = s.items.map((item, i) => (i === joinIndex ? { ...item, notes: [...item.notes, ref] } : item));
      return { ...s, piece: edit.piece, items, held: withKey(joinIndex), lastHand: hand };
    }
  }

  // a new item at the cursor of its staff; an override set by moveCursor is used once
  let piece = s.piece;
  const override = s.cursors[hand];
  let pos = override ?? cursorOf(piece, hand);
  if (pos && pos.bar >= piece.bars) piece = ensureBars(piece, pos.bar);
  if (!pos) {
    piece = ensureBars(piece, piece.bars);
    pos = cursorOf(piece, hand);
  }
  if (!pos) return s;
  const { bar, start } = pos;
  const length = autoLength(piece, hand, bar, start, 'quarter');
  let item: EntryItem;
  if (isRest) {
    const edit = placeRest(piece, { hand, bar, start, length: restLengthFor(length) });
    if (!edit.ok) return s;
    piece = edit.piece;
    item = { hand, bar, start, rest: true, notes: [] };
  } else {
    const spelled = spellKey(piece, key);
    const edit = placeNote(piece, { hand, bar, start, length, ...spelled });
    if (!edit.ok) return s;
    piece = edit.piece;
    item = { hand, bar, start, rest: false, notes: [{ hand, bar, start, step: spelled.step, octave: spelled.octave }] };
  }
  const index = s.items.length;
  const cursors = { ...s.cursors };
  delete cursors[hand];
  return {
    piece,
    held: withKey(index),
    items: [...s.items, item],
    chordOpen: isRest ? null : { item: index, firstMs: atMs },
    lastHand: hand,
    cursors,
    itemFirstMs: new Map(s.itemFirstMs).set(index, atMs),
  };
}

export function entryTick(s: EntryState, nowMs: number): EntryState {
  // growth needs no option: a live hold is never a short tap (that is decided on release)
  let piece = s.piece;
  const heldItems = [...new Set([...s.held.values()].map((v) => v.item))].sort((a, b) => a - b);
  for (const index of heldItems) {
    const item = s.items[index];
    const first = s.itemFirstMs.get(index);
    if (!item || first === undefined) continue;
    const wanted = lengthForHold(nowMs - first, false);
    const selected = item.rest ? restLengthFor(wanted) : wanted;
    const current = itemLength(piece, item);
    if (LENGTH_TICKS[selected] <= LENGTH_TICKS[current]) continue;
    const grown = relength(piece, item, selected);
    if (grown && LENGTH_TICKS[itemLength(grown, item)] > LENGTH_TICKS[current]) piece = grown;
  }
  return piece === s.piece ? s : { ...s, piece };
}

export function entryUp(s: EntryState, key: EntryKey, atMs: number, o: EntryOptions): EntryState {
  const entry = s.held.get(key);
  if (!entry) return s;
  const held = new Map(s.held);
  held.delete(key);
  if ([...held.values()].some((v) => v.item === entry.item)) return { ...s, held };
  // the item's last key is up: its length is fixed from the first key down, the shorter tap included, within the room
  const item = s.items[entry.item];
  if (!item) return { ...s, held };
  const heldMs = atMs - (s.itemFirstMs.get(entry.item) ?? entry.downMs);
  const wanted = lengthForHold(heldMs, o.shortTapEighth);
  const piece = relength(s.piece, item, item.rest ? restLengthFor(wanted) : wanted) ?? s.piece;
  return { ...s, piece, held };
}

/** Takes back the last entry of the hand last written (not one still held). */
export function entryBackspace(s: EntryState): EntryState {
  const hand = s.lastHand;
  if (hand === null) return s;
  let index = -1;
  for (let i = s.items.length - 1; i >= 0; i--) {
    if (s.items[i]!.hand === hand) { index = i; break; }
  }
  if (index < 0 || [...s.held.values()].some((v) => v.item === index)) return s;
  const item = s.items[index]!;
  let piece = s.piece;
  if (item.rest) {
    const edit = removeRest(piece, { hand: item.hand, bar: item.bar, start: item.start });
    if (!edit.ok) return s;
    piece = edit.piece;
  } else {
    for (const ref of item.notes) {
      const edit = removeNote(piece, ref);
      if (!edit.ok) return s;
      piece = edit.piece;
    }
  }
  // the items after it move down one place: the held keys, the open chord and the first-key times follow them
  const shift = (i: number) => (i > index ? i - 1 : i);
  const held = new Map<EntryKey, { item: number; downMs: number }>();
  for (const [key, v] of s.held) held.set(key, { item: shift(v.item), downMs: v.downMs });
  const itemFirstMs = new Map<number, number>();
  for (const [i, ms] of s.itemFirstMs) if (i !== index) itemFirstMs.set(shift(i), ms);
  const items = s.items.filter((_, i) => i !== index);
  const chordOpen = s.chordOpen === null || s.chordOpen.item === index
    ? null
    : { item: shift(s.chordOpen.item), firstMs: s.chordOpen.firstMs };
  return { ...s, piece, held, items, chordOpen, itemFirstMs, lastHand: items.length > 0 ? items[items.length - 1]!.hand : null };
}

/** Sets where the next entry of `hand` goes; used once, then the staff's own cursor is used again. */
export function moveCursor(s: EntryState, hand: EditorHand, bar: number, start: number): EntryState {
  return { ...s, cursors: { ...s.cursors, [hand]: { bar, start } } };
}
