/**
 * `npm run piece:board`: the review board page for the draft pieces (ft_0_11.AC3). Only wiring: the arguments, the files and
 * the terminal; the board itself is `board.ts`, tested on its own.
 *
 *   npm run piece:board                       write test-logs/board/index.html (the page a thread publishes)
 *   npm run piece:board -- --out <file>       write it elsewhere
 *   npm run piece:board -- --apply <picks>    record the maintainer's picks (a JSON file read from the board)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadLevelsFile } from '../piece/levels';
import { applyPicks, boardPieces, parsePicks, renderBoard } from './board';

const PIECES = 'content/pieces';
const LEVELS = 'content/curriculum/levels.json';
const USAGE = 'usage: npm run piece:board [-- --out <file.html>] | [-- --apply <picks.json>]';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.includes('--help')) {
  console.log(USAGE);
} else if (args.includes('--apply')) {
  const file = flag('--apply');
  if (!file) {
    console.error(USAGE);
    process.exitCode = 2;
  } else {
    const results = applyPicks(PIECES, LEVELS, parsePicks(readFileSync(file, 'utf-8')));
    for (const r of results) {
      if (r.outcome === 'approved') console.log(`approved   ${r.id}${r.warnings ? ` (${r.warnings} warning(s) read on the board)` : ''}`);
      else if (r.outcome === 'kept-draft') console.log(`not yet    ${r.id}${r.note ? `: ${r.note}` : ''}`);
      else console.log(`refused    ${r.id}: ${r.reason}`);
    }
    if (results.some((r) => r.outcome === 'refused')) process.exitCode = 1;
  }
} else {
  const out = flag('--out') ?? 'test-logs/board/index.html';
  const { levels, diagnostics } = loadLevelsFile(LEVELS);
  if (levels.length === 0) {
    for (const d of diagnostics) console.error(d.message);
    process.exitCode = 1;
  } else {
    const content = boardPieces(PIECES, levels);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderBoard(content, new Date().toISOString().slice(0, 10)));
    console.log(`${out}: ${content.pieces.length} draft(s) on the board, ${content.refused.length} left out with errors.`);
    for (const r of content.refused) console.log(`  left out ${r.id}: ${r.reason}`);
  }
}
