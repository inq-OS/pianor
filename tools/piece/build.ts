import { existsSync } from 'node:fs';
import { BUILD_USAGE, parseBuildArgs } from './cliArgs';
import { hasErrors, formatDiagnostic } from '../../src/core/piece/diagnostics';
import { buildPieces } from './files';

const args = parseBuildArgs(process.argv.slice(2));
if (args.kind === 'help') {
  console.log(BUILD_USAGE);
  process.exit(0);
}
if (args.kind === 'error') {
  console.error(`piece:build: ${args.message}\n${BUILD_USAGE}`);
  process.exit(2);
}
const { piecesDir, outDir } = args;
const report = buildPieces(piecesDir, outDir);

for (const d of report.diagnostics) console.log(formatDiagnostic(d));
if (report.pieces === 0) {
  console.log(`No pieces found in ${piecesDir} (${existsSync(piecesDir) ? 'each piece is a folder with piece.abc and piece.meta.json' : 'the folder does not exist'}).`);
} else {
  console.log(`Built ${report.built.length} of ${report.pieces} piece(s) into ${outDir}.`);
}
process.exit(hasErrors(report.diagnostics) ? 1 : 0);
