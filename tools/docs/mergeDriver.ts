/**
 * A git merge driver for the docs with generated blocks (`<!-- docs:NAME -->` ... `<!-- /docs:NAME -->`, `blocks.ts`).
 * Two branches that each change a feature's front matter both change the same rows of FEATURES.md, and git calls that a
 * conflict although `npm run docs:index` would write the right table from the merged files. So the driver merges only
 * the hand-written text: it empties every generated block on all three sides, merges what is left, and puts our side's
 * block bodies back in. The post-merge hook then runs `npm run docs:index`, which writes the blocks from the merged files.
 */

const OPEN = /^<!-- docs:([a-z-]+)((?: [^>]*?)?) -->$/;

/** The blocks of a text in order, each as its opening line and its body. */
function walk(text: string, body: (open: string, lines: string[]) => string[]): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const open = OPEN.exec(line);
    const end = open ? lines.indexOf(`<!-- /docs:${open[1] as string} -->`, i + 1) : -1;
    if (!open || end === -1) {
      out.push(line);
      continue;
    }
    out.push(line, ...body(line, lines.slice(i + 1, end)), lines[end] as string);
    i = end;
  }
  return out.join('\n');
}

/** The text with every generated block's body taken out (the opening and closing lines stay). */
export const emptyBlocks = (text: string): string => walk(text, () => []);

/** `merged`'s empty blocks filled with the bodies of the same blocks in `ours` (matched by the opening line, in order). */
export function refillBlocks(merged: string, ours: string): string {
  const bodies = new Map<string, string[][]>();
  walk(ours, (open, lines) => {
    bodies.set(open, [...(bodies.get(open) ?? []), lines]);
    return lines;
  });
  return walk(merged, (open, lines) => bodies.get(open)?.shift() ?? lines);
}

export type ThreeWayMerge = (base: string, ours: string, theirs: string) => { text: string; conflicts: boolean };

/** The three sides merged with the generated blocks left out of the merge, and our blocks put back. */
export function mergeGenerated(base: string, ours: string, theirs: string, merge: ThreeWayMerge): { text: string; conflicts: boolean } {
  const result = merge(emptyBlocks(base), emptyBlocks(ours), emptyBlocks(theirs));
  return { text: refillBlocks(result.text, ours), conflicts: result.conflicts };
}
