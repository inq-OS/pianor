import { runCli } from './run.ts';

process.exit(runCli(process.argv.slice(2), { out: (line) => console.log(line), err: (line) => console.error(line) }));
