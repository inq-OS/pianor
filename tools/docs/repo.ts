import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the docs tools know about the repository, read once. Everything the checks need is in here, so they are pure
 * functions of this object and can be tested with a small hand-made one.
 */
export interface Repo {
  /** Absolute path of the repository root (the folder the paths below are relative to). */
  root: string;
  /** Markdown files (repo-relative, forward slashes) and their text. */
  docs: Map<string, string>;
  /** Code and config files whose text is scanned for feature ids and acceptance-criteria tags (not tools/docs, whose tests use made-up ids). */
  sources: Map<string, string>;
  /** Every file and folder that exists, repo-relative. */
  paths: Set<string>;
  /** The scripts in package.json. */
  scripts: Set<string>;
  /** The files a block may include (read on demand by path). */
  read: (path: string) => string | null;
  /** A file's bytes, for the metadata of pictures and sounds (d165). */
  readBytes?: (path: string) => Uint8Array | null;
  /** Whether git ignores a path (never committed: run logs, local files); absent outside a git checkout. */
  ignored?: (path: string) => boolean;
  /** Every file git tracks or would add (`git ls-files --cached --others --exclude-standard`), whatever folder it is in; absent outside a git checkout. */
  committed?: string[];
}

/** The files git tracks or would add, so the privacy check also reads a tracked file inside a folder the walk skips. */
function gitFiles(root: string): string[] | undefined {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(Boolean);
  } catch {
    return undefined;
  }
}

/** The paths git ignores in this checkout, as a test on a repo-relative path; undefined when git cannot say. */
function gitIgnored(root: string): ((path: string) => boolean) | undefined {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const entries = out.split('\0').filter(Boolean);
    const files = new Set(entries.filter((e) => !e.endsWith('/')));
    const dirs = entries.filter((e) => e.endsWith('/'));
    return (path) => files.has(path) || dirs.some((d) => path === d.slice(0, -1) || path.startsWith(d));
  } catch {
    return undefined;
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test-results', 'playwright-report', 'private']);
const SOURCE_DIRS = ['src', 'tools', 'tests'];
const SOURCE_FILES = ['eslint.config.js', 'vite.config.ts', 'playwright.config.ts'];

function walk(root: string, dir: string, out: string[], dirs: string[]): void {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      dirs.push(path);
      walk(root, path, out, dirs);
    } else out.push(path);
  }
}

export function loadRepo(root: string): Repo {
  const files: string[] = [];
  const dirs: string[] = [];
  walk(root, '', files, dirs);
  const read = (path: string): string | null => {
    try {
      const stat = lstatSync(join(root, path));
      // a symbolic link is read as the path it points to, never followed (it could point anywhere on the machine)
      if (stat.isSymbolicLink()) return readlinkSync(join(root, path), 'utf8');
      return stat.isFile() ? readFileSync(join(root, path), 'utf8') : null;
    } catch {
      return null;
    }
  };
  const docs = new Map<string, string>();
  const sources = new Map<string, string>();
  for (const path of files) {
    const inDocs = path.startsWith('docs/') || path === 'README.md' || path === 'CLAUDE.md';
    if (path.endsWith('.md') && inDocs) docs.set(path, read(path) ?? '');
    else if (path === '.github/workflows/ci.yml') sources.set(path, read(path) ?? '');
    else if (!path.startsWith('tools/docs/') && /\.(ts|js)$/.test(path) && (SOURCE_DIRS.some((d) => path.startsWith(d + '/')) || SOURCE_FILES.includes(path))) {
      sources.set(path, read(path) ?? '');
    }
  }
  const ignored = gitIgnored(root);
  const committed = gitFiles(root);
  const pkg = JSON.parse(read('package.json') ?? '{}') as { scripts?: Record<string, string> };
  return {
    root,
    docs,
    sources,
    paths: new Set([...files, ...dirs]),
    scripts: new Set(Object.keys(pkg.scripts ?? {})),
    read,
    readBytes: (path) => {
      try {
        const full = join(root, path);
        return lstatSync(full).isSymbolicLink() ? new TextEncoder().encode(readlinkSync(full, 'utf8')) : readFileSync(full);
      } catch {
        return null;
      }
    },
    ...(ignored ? { ignored } : {}),
    ...(committed ? { committed } : {}),
  };
}
