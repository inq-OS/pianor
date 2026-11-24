import { existsSync } from 'node:fs';
import { LINT_USAGE, parseLintArgs } from './cliArgs';
import { difficultySummary } from '../../src/core/piece/difficulty';
import { formatDiagnostic, hasErrors } from '../../src/core/piece/diagnostics';
import { lintPieces } from './lintFiles';
import { loadLevelsFile } from './levels';

const args = parseLintArgs(process.argv.slice(2));
if (args.kind === 'help') {
  console.log(LINT_USAGE);
  process.exit(0);
}
if (args.kind === 'error') {
  console.error(`piece:lint: ${args.message}\n${LINT_USAGE}`);
  process.exit(2);
}
const { piecesDir, levelsPath, strict } = args;

const { levels, diagnostics: levelProblems } = loadLevelsFile(levelsPath);
for (const d of levelProblems) console.log(formatDiagnostic(d));
if (hasErrors(levelProblems)) process.exit(1);

const report = lintPieces(piecesDir, levels);
if (report.pieces === 0) {
  console.log(`No pieces found in ${piecesDir} (${existsSync(piecesDir) ? 'each piece is a folder with piece.abc and piece.meta.json' : 'the folder does not exist'}).`);
  process.exit(0);
}

for (const piece of report.linted) {
  const d = piece.difficulty;
  const fits = piece.fitsLevels.length > 0 ? `fits levels ${piece.fitsLevels.join(', ')}` : 'fits no level';
  console.log(`${piece.id}: level ${piece.level}, ${difficultySummary(d, piece.confirmedDifficulty)}, ${fits}`);
  for (const e of piece.diagnostics.filter((x) => x.severity === 'error')) console.log(`  ${formatDiagnostic(e)}`);
  const warnings = piece.diagnostics.filter((x) => x.severity === 'warning');
  if (warnings.length > 0) console.log('  Warnings (for a human to review):');
  for (const w of warnings) console.log(`    ${formatDiagnostic(w)}`);
}
for (const d of report.diagnostics.filter((x) => !report.linted.some((p) => p.diagnostics.includes(x)))) console.log(formatDiagnostic(d));

const errors = report.diagnostics.filter((d) => d.severity === 'error').length;
const warnings = report.diagnostics.filter((d) => d.severity === 'warning').length;
console.log(`${report.pieces} piece(s), ${report.songs > 0 ? `${report.songs} song(s), ` : ""}${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 || (strict && warnings > 0) ? 1 : 0);
