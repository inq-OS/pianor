// The privacy rules of d165 on what an agent or a person is about to commit. Modes:
//   (hook input on stdin) Claude Code PreToolUse (Write, Edit, MultiEdit, NotebookEdit): checks the text about to be
//     written and blocks the call (exit 2, why on stderr), so the words never reach the disk. PostToolUse: checks the
//     whole file after the write, where a match can span the edit's edges. Without the private word list it still runs
//     the generic rules and tells the agent that names went unchecked.
//   --changed: every changed or new file of the working tree and the messages of the commits not on origin/main. As
//     the Bash hook (the hook's input on stdin) it runs only after a command that commits or pushes.
//   --staged: the staged files as they are in the index (the git pre-commit hook, `.githooks/`).
//   --message <file>: a commit message (the git commit-msg hook), without the lines git strips (those that start with #).
//   <file>...: those files.
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { checkBinary, checkMessages, checkText, looksBinary, personalWords, PERSONAL_WORDS } from './privacy.ts';

const root = resolve(import.meta.dirname, '../..');
/** A file's text; a symbolic link is read as the path it points to, never followed. */
const read = (path: string): string | null => {
  try {
    return lstatSync(path).isSymbolicLink() ? readlinkSync(path, 'utf8') : readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};
const git = (...args: string[]): string | null => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
};
/** Paths from a `-z` git listing, split on NUL so names with any letter or a newline come through as they are. */
const paths = (text: string | null): string[] => (text ?? '').split('\0').filter(Boolean);

interface HookInput {
  hook_event_name?: string;
  tool_input?: { command?: string; file_path?: string; notebook_path?: string; content?: string; new_string?: string; new_source?: string; edits?: { new_string?: string }[] };
}

async function hookInput(): Promise<HookInput | null> {
  if (process.stdin.isTTY) return null;
  let text = '';
  for await (const chunk of process.stdin) text += String(chunk);
  try {
    return JSON.parse(text) as HookInput;
  } catch {
    return null;
  }
}

/** The repo-relative path, or null for a file outside the repo, in the private folder or ignored by git (`checkText` leaves the generic rules off the rules' own files). */
function committable(path: string): string | null {
  const rel = relative(root, resolve(root, path)).split('\\').join('/');
  if (rel.startsWith('..') || rel.startsWith('private/') || rel.startsWith('node_modules/')) return null;
  return spawnSync('git', ['check-ignore', '-q', '--', rel], { cwd: root }).status === 0 ? null : rel;
}

/** A file in the index as bytes, for a picture or a sound. */
const staged = (rel: string): Uint8Array | null => {
  const r = spawnSync('git', ['show', `:${rel}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
};
const binaries: { file: string; bytes: Uint8Array | null }[] = [];

const words = personalWords(read(resolve(root, PERSONAL_WORDS)));
const args = process.argv.slice(2);
const mode = args[0]?.startsWith('--') ? args[0] : args.length > 0 ? 'files' : 'hook';
const input = mode === 'hook' ? await hookInput() : null;
if (mode === '--changed') {
  // the Bash hook: only a command that commits or pushes is checked, so every other command stays fast
  const command = (await hookInput())?.tool_input?.command;
  if (command !== undefined && !/\bgit\b[^\n]*\b(?:commit|push)\b/.test(command)) process.exit(0);
}
const pre = input?.hook_event_name === 'PreToolUse';
const targets: { file: string; text: string }[] = [];
const messages: { name: string; text: string }[] = [];
const addFile = (path: string, text: (rel: string) => string | null): void => {
  const rel = committable(path);
  const body = rel === null ? null : text(rel);
  if (rel !== null && body !== null) targets.push({ file: rel, text: body });
};

if (mode === 'files') for (const path of args) addFile(path, (rel) => read(resolve(root, rel)));
else if (mode === '--changed') {
  for (const path of new Set([...paths(git('diff', '-z', '--name-only', 'HEAD')), ...paths(git('ls-files', '-z', '--others', '--exclude-standard'))])) addFile(path, (rel) => read(resolve(root, rel)));
  if (git('rev-parse', '-q', '--verify', 'origin/main') !== null) {
    const log = (git('log', '--format=%h%x00%B%x00', 'origin/main..HEAD') ?? '').split('\0');
    for (let i = 0; i + 1 < log.length; i += 2) messages.push({ name: `commit ${(log[i] ?? '').trim()}`, text: log[i + 1] ?? '' });
  }
} else if (mode === '--staged') {
  for (const path of paths(git('diff', '-z', '--cached', '--name-only', '--diff-filter=ACMR'))) {
    const rel = committable(path);
    const bytes = rel === null ? null : staged(rel);
    if (rel === null || bytes === null) continue;
    const text = Buffer.from(bytes).toString('utf8');
    if (looksBinary(text)) binaries.push({ file: rel, bytes });
    else targets.push({ file: rel, text });
  }
} else if (mode === '--message') {
  const text = (read(resolve(args[1] ?? '')) ?? '').split('\n').filter((l) => !l.startsWith('#')).join('\n');
  messages.push({ name: 'commit message', text });
} else if (input !== null) {
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (path) {
    const t = input.tool_input ?? {};
    addFile(path, (rel) => (pre ? [t.content, t.new_string, t.new_source, ...(t.edits ?? []).map((e) => e.new_string)].filter((x) => x !== undefined).join('\n') : read(resolve(root, rel))));
  }
}

const issues = [...targets.flatMap(({ file, text }) => checkText(file, text, words)), ...binaries.flatMap(({ file, bytes }) => checkBinary(file, bytes, words)), ...checkMessages(messages, words)];
for (const i of issues) console.error(`${i.file}${pre ? ' (the text being written)' : ''}:${i.line}: ${i.message}`);
if (issues.length > 0) process.exit(2);
if (input !== null && !pre && words.length === 0 && targets.length > 0) {
  // Shown to the agent: the generic rules ran, but no names were checked.
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `No ${PERSONAL_WORDS} on this machine: names and private words were not checked in what you wrote; keep them out by hand (d165).` } }));
}
process.exit(0);
