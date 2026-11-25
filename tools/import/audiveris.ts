/**
 * Running Audiveris on one sheet (ft_Y_04 slices 3 and 4): the photo cleaned first (`clean.ts`), the cleaned picture
 * kept beside the results, Audiveris started as a separate program (AGPL-3.0, installed by the person, never bundled)
 * with its output in `audiveris.log`. Used by the terminal menu (`photo-cli.ts`) and the game's photo import server
 * (`tools/vite-photo.ts`). Only wiring: the decisions are in `photo.ts` and `clean.ts`, tested there.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { cleanImageFile, type Cleaned } from './clean';
import { audiverisArgs, audiverisBookArgs, audiverisCandidates, audiverisHint, exportOf, exportsOf, pickAudiveris, staleScores, type Recognised } from './photo';

/** Where the lines about the run go: the terminal, or the server's log. */
type Say = (line: string) => void;

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** A photo cleaned for Audiveris (`clean.ts`), kept next to its results so a person can see what was read. */
function cleaned(image: string, outDir: string, say: Say): { file: string; result?: Cleaned } {
  let result: ReturnType<typeof cleanImageFile>;
  try {
    result = cleanImageFile(image, readFileSync(image));
  } catch (e) {
    say(`Could not clean the photo (${e instanceof Error ? e.message : String(e)}), so Audiveris reads it as it is.`);
    return { file: image };
  }
  if (!result) return { file: image };
  if (!result.png) {
    say(`Not cleaned: ${result.note}. Audiveris reads the photo as it is.`);
    return { file: image };
  }
  const path = join(outDir, `${basename(image, extname(image))}-${extname(image).slice(1).toLowerCase()}-cleaned.png`);
  writeFileSync(path, result.png);
  say(`Cleaned the photo: ${result.note}. Audiveris reads the cleaned picture: ${path}`);
  return { file: path, result: result.result };
}

/** Audiveris is installed where this runs: found by `AUDIVERIS`, the installer's folders or the PATH. */
export function audiverisFound(): { ok: true; exe: string } | { ok: false; reason: string } {
  return pickAudiveris(audiverisCandidates(process.platform, process.env), existsSync, process.env);
}

/** Cleans a photo and runs Audiveris on it, the results in `outDir`; `progress` is called while Audiveris works. */
export function recognise(original: string, outDir: string, say: Say = console.log, progress: () => void = () => process.stdout.write('.')): Promise<Recognised> {
  mkdirSync(outDir, { recursive: true });
  for (const old of staleScores(filesUnder(outDir))) rmSync(old);
  const clean = cleaned(original, outDir, say);
  const image = clean.file;
  const picked = audiverisFound();
  if (!picked.ok) return Promise.resolve(picked);
  const exe = picked.exe;
  return new Promise((resolve) => {
    // Audiveris on Windows is a windowed program whose console output is lost, so its output goes to a log file as well
    const log = join(outDir, 'audiveris.log');
    const out = createWriteStream(log);
    const child = spawn(exe, audiverisArgs(image, outDir), { stdio: ['ignore', 'pipe', 'pipe'] });
    const said: string[] = [];
    child.stdout.on('data', (d: Buffer) => { out.write(d); said.push(d.toString()); progress(); });
    child.stderr.on('data', (d: Buffer) => { out.write(d); said.push(d.toString()); });
    child.on('error', (e) => { out.end(); resolve({ ok: false, reason: `${exe} did not start (${e.message}). Install Audiveris, or set AUDIVERIS to its program file, Audiveris.exe on Windows.` }); });
    child.on('close', (code) => {
      out.end();
      const score = exportOf(image, filesUnder(outDir));
      if (score) resolve({ ok: true, score, ...(clean.result ? { cleaned: { file: image, result: clean.result } } : {}) });
      else {
        const hint = audiverisHint(said.join(''));
        resolve({ ok: false, reason: `no MusicXML was written (Audiveris ended with code ${code}); its log: ${log}${hint ? `\n${hint}` : ''}` });
      }
    });
  });
}


/** A book being read: its end (the MusicXML of each movement, or why none) and a way to stop it. */
export interface BookRun {
  readonly done: Promise<{ ok: true; scores: string[] } | { ok: false; reason: string }>;
  stop(): void;
}

/**
 * Runs Audiveris on the chosen sheets of a PDF as one book (ft_Y_04 slice 6), the results in `outDir`; each line of its
 * output goes to `line`, from which the server tells the person which page is being read.
 */
export function readBook(pdf: string, sheets: readonly number[], outDir: string, line: (text: string) => void): BookRun {
  mkdirSync(outDir, { recursive: true });
  for (const old of staleScores(filesUnder(outDir))) rmSync(old);
  const picked = audiverisFound();
  if (!picked.ok) return { done: Promise.resolve(picked), stop: () => undefined };
  const exe = picked.exe;
  const log = join(outDir, 'audiveris.log');
  const out = createWriteStream(log);
  const child = spawn(exe, audiverisBookArgs(pdf, outDir, sheets), { stdio: ['ignore', 'pipe', 'pipe'] });
  let stopped = false;
  const said: string[] = [];
  const take = (d: Buffer) => {
    out.write(d);
    const text = d.toString();
    said.push(text);
    for (const l of text.split(/\r?\n/)) if (l.trim()) line(l);
  };
  child.stdout.on('data', take);
  child.stderr.on('data', take);
  const done = new Promise<{ ok: true; scores: string[] } | { ok: false; reason: string }>((resolve) => {
    child.on('error', (e) => { out.end(); resolve({ ok: false, reason: `${exe} did not start (${e.message}). Install Audiveris, or set AUDIVERIS to its program file, Audiveris.exe on Windows.` }); });
    child.on('close', (code) => {
      out.end();
      if (stopped) return resolve({ ok: false, reason: 'stopped' });
      const scores = exportsOf(pdf, filesUnder(outDir));
      if (scores.length > 0) return resolve({ ok: true, scores });
      const hint = audiverisHint(said.join(''));
      resolve({ ok: false, reason: `no MusicXML was written (Audiveris ended with code ${code}); its log: ${log}${hint ? `\n${hint}` : ''}` });
    });
  });
  return { done, stop: () => { stopped = true; child.kill(); } };
}
