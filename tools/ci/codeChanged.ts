/**
 * Whether a change needs the code steps of the CI `check` job (typecheck, lint, tests, build) or only the docs steps:
 * `files` is what a pull request changed, null for a run with no pull request (the daily check of `main`, a manual run),
 * which always checks the code. A file under `docs/` or any Markdown file is docs. Node built-ins only: the job runs it
 * with `node --experimental-strip-types` before `npm ci` (d090).
 */
export function codeChanged(files: readonly string[] | null): boolean {
  if (files === null) return true;
  return files.some((file) => !/^docs[\\/]|\.md$/.test(file));
}
