/**
 * `npm run piece:photo`: the photo import menu in the terminal (ft_Y_04 slice 3). Only wiring: the terminal (Node's
 * readline), the files and the Audiveris process; the flow is `photoMenu` in `photo.ts`, tested with fakes.
 * `npm run piece:photo -- <folder>` starts in another folder than `private/photo/in`.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { readMusicXmlFile } from '../analysis/scoreFile';
import { recognise } from './audiveris';
import { PHOTO_IN, PHOTO_OUT, photoMenu, type MenuIo } from './photo';

const terminal = createInterface({ input: process.stdin, output: process.stdout });
const lines = terminal[Symbol.asyncIterator]();
const folder = process.argv[2] ?? PHOTO_IN;
mkdirSync(folder, { recursive: true });
const io: MenuIo = {
  // read through the line iterator, so typed-ahead or piped answers are not lost; the end of input quits
  ask: async (q) => {
    process.stdout.write(q);
    const next = await lines.next();
    return next.done ? 'q' : next.value;
  },
  say: (line) => console.log(line),
  list: (dir) => (existsSync(dir) ? readdirSync(dir) : []),
  recognise: async (image, outDir) => {
    const run = await recognise(image, outDir);
    process.stdout.write('\n');
    return run;
  },
  readScore: readMusicXmlFile,
  write: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  },
};
await photoMenu(io, folder, PHOTO_OUT);
terminal.close();
