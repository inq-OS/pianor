/**
 * `npm run piece:import -- <score>`: a MusicXML file to a draft game piece (ft_Y_04 slice 2). Only wiring: the arguments,
 * the files and the terminal; the flow is `importPiece` in `piece.ts`, tested with fakes.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readMusicXmlFile } from '../analysis/scoreFile';
import { loadLevelsFile } from '../piece/levels';
import { IMPORT_USAGE, importPiece, parseImportArgs } from './piece';

const args = parseImportArgs(process.argv.slice(2));
if (args.kind === 'help') console.log(IMPORT_USAGE);
else if (args.kind === 'error') {
  console.error(`${args.message}\n${IMPORT_USAGE}`);
  process.exitCode = 2;
} else {
  const { levels, diagnostics } = loadLevelsFile('content/curriculum/levels.json');
  if (levels.length === 0) {
    for (const d of diagnostics) console.error(d.message);
    process.exitCode = 1;
  } else {
    const ok = importPiece(args, {
      readScore: readMusicXmlFile,
      exists: existsSync,
      write: (path, text) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text);
      },
      levels,
      say: (line) => console.log(line),
    });
    if (!ok) process.exitCode = 1;
  }
}
