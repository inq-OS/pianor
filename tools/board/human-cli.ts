/**
 * `npm run human:board [-- --out <file.html>]`: write the board of what waits on the maintainer (`humanBoard.ts`) to
 * `test-logs/board/human.html`, the page a thread publishes as a private Artifact.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { collectItems, GROUPS, renderHumanBoard } from './humanBoard';

const args = process.argv.slice(2);
const i = args.indexOf('--out');
const out = i >= 0 && args[i + 1] ? args[i + 1]! : 'test-logs/board/human.html';
const items = collectItems('.');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderHumanBoard(items, 'https://github.com/inq-OS/pianor'));
for (const g of GROUPS) {
  const n = items.filter((it) => it.group === g.id).length;
  if (n > 0) console.log(`${String(n).padStart(3)}  ${g.title}`);
}
console.log(`wrote ${out}: ${items.length} item(s)`);
