/**
 * The pieces in the drawers of a library's card catalogue (ft_1_02c.AC7: songs are organized by
 * first letter into drawers of 5 pieces each; when a drawer fills up, another drawer is added and the second letter
 * organizes them, as libraries do).
 *
 * Each first letter has drawers of its own, in the order of the Estonian alphabet; a title that does not start with a
 * letter goes in a `#` drawer after them. A letter with more than `DRAWER_SIZE` pieces is split by its second letter:
 * the groups of each second letter are packed, in order, into drawers of up to five, and each drawer is labelled with
 * the range it holds (`Ma-Mi`, a hyphen: the font has no dash), or with the two letters when it holds one group (`Ma`). A second letter that alone holds
 * more than a drawer goes on to the third letter, and so on; titles that are the same as far as they go are cut into
 * drawers of five. Pure: the screen only draws the drawers.
 */

/** How many pieces a drawer holds. */
export const DRAWER_SIZE = 5;

export interface DrawerPiece {
  readonly id: string;
  /** The title as the player sees it: the drawers sort by it. */
  readonly title: string;
}

export interface Drawer<P extends DrawerPiece = DrawerPiece> {
  /** The label on the drawer's front: a letter, a range of first letters (`Ma-Mi`, a hyphen: the font has no dash) or `#`. */
  readonly label: string;
  readonly pieces: readonly P[];
}

const collator = new Intl.Collator('et', { sensitivity: 'base', numeric: true });
/** The letters of a title, upper case, all else left out: what the drawers sort and split by. */
const keyOf = (title: string): string => [...title].filter((ch) => /\p{L}/u.test(ch)).join('').toLocaleUpperCase('et');
/** A key's first `depth` letters as a drawer shows them: the first a capital, the rest small. */
const shown = (key: string, depth: number): string => {
  const letters = [...key].slice(0, depth);
  return letters[0]! + letters.slice(1).join('').toLocaleLowerCase('et');
};

export function libraryDrawers<P extends DrawerPiece>(pieces: readonly P[]): Drawer<P>[] {
  const sorted = [...pieces].sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.id, b.id));
  const lettered = sorted.filter((p) => /^\p{L}/u.test(p.title.trimStart()));
  const others = sorted.filter((p) => !/^\p{L}/u.test(p.title.trimStart()));
  const drawers: Drawer<P>[] = [];
  for (const group of groupsBy(lettered, 1)) drawers.push(...split(group.pieces, 1));
  for (let i = 0; i < others.length; i += DRAWER_SIZE) drawers.push({ label: '#', pieces: others.slice(i, i + DRAWER_SIZE) });
  return drawers;
}

/** Consecutive runs of `pieces` (sorted) that share their first `depth` letters. */
function groupsBy<P extends DrawerPiece>(pieces: readonly P[], depth: number): { prefix: string; pieces: P[] }[] {
  const groups: { prefix: string; pieces: P[] }[] = [];
  for (const piece of pieces) {
    const prefix = [...keyOf(piece.title)].slice(0, depth).join('');
    const last = groups[groups.length - 1];
    if (last && last.prefix === prefix) last.pieces.push(piece);
    else groups.push({ prefix, pieces: [piece] });
  }
  return groups;
}

/** The drawers for one group of pieces that share their first `depth` letters. */
function split<P extends DrawerPiece>(pieces: readonly P[], depth: number): Drawer<P>[] {
  const key = keyOf(pieces[0]!.title);
  if (pieces.length <= DRAWER_SIZE) return [{ label: shown(key, depth), pieces }];
  // the same as far as they go: no letter left to split by, so drawers of five with the same label
  if (pieces.every((p) => [...keyOf(p.title)].length <= depth)) {
    const drawers: Drawer<P>[] = [];
    for (let i = 0; i < pieces.length; i += DRAWER_SIZE) drawers.push({ label: shown(key, depth), pieces: pieces.slice(i, i + DRAWER_SIZE) });
    return drawers;
  }
  // pack the next letter's groups, in order, into drawers of up to five; a group too big for one drawer goes a letter deeper
  const drawers: Drawer<P>[] = [];
  let open: { first: string; last: string; pieces: P[] } | null = null;
  const close = () => {
    if (!open) return;
    drawers.push({ label: open.first === open.last ? open.first : `${open.first}-${open.last}`, pieces: open.pieces });
    open = null;
  };
  for (const group of groupsBy(pieces, depth + 1)) {
    const label = shown(keyOf(group.pieces[0]!.title), depth + 1);
    if (group.pieces.length > DRAWER_SIZE) {
      close();
      drawers.push(...split(group.pieces, depth + 1));
      continue;
    }
    if (open && open.pieces.length + group.pieces.length > DRAWER_SIZE) close();
    if (!open) open = { first: label, last: label, pieces: [] };
    open.last = label;
    open.pieces.push(...group.pieces);
  }
  close();
  return drawers;
}

/** The cabinet's drawers across and down, and the room round them, in layout cells. */
export const CABINET = { columns: 6, rows: 4, gap: 3, side: 10, foot: 4, inset: 4 } as const;

export interface Box { x: number; y: number; w: number; h: number }

/**
 * Where the cabinet and its drawer fronts go in a main area `width` by `height` cells, the cabinet's top at `top`:
 * `CABINET.columns` by `CABINET.rows` fronts, left to right then down, in a carcass `CABINET.inset` cells larger.
 */
export function cabinetLayout(width: number, height: number, top: number): { cabinet: Box; fronts: Box[] } {
  const { columns, rows, gap, side, foot, inset } = CABINET;
  const cabinet: Box = { x: side, y: top, w: width - 2 * side, h: height - foot - top };
  const w = Math.floor((cabinet.w - 2 * inset - (columns - 1) * gap) / columns);
  const h = Math.floor((cabinet.h - 2 * inset - (rows - 1) * gap) / rows);
  const fronts: Box[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    fronts.push({ x: cabinet.x + inset + column * (w + gap), y: cabinet.y + inset + row * (h + gap), w, h });
  }
  return { cabinet, fronts };
}

/** Where an open drawer and its index cards go: the drawer from `top` down, `DRAWER_SIZE` cards in it one under another. */
export function openDrawerLayout(width: number, height: number, top: number): { drawer: Box; cards: Box[] } {
  const { side, foot } = CABINET;
  const drawer: Box = { x: side, y: top, w: width - 2 * side, h: height - foot - top };
  const pad = 6, gap = 2;
  const h = Math.floor((drawer.h - pad - 6 - (DRAWER_SIZE - 1) * gap) / DRAWER_SIZE);
  const cards = Array.from({ length: DRAWER_SIZE }, (_, i) => ({ x: drawer.x + pad + 4, y: drawer.y + pad + i * (h + gap), w: drawer.w - 2 * pad - 8, h }));
  return { drawer, cards };
}
