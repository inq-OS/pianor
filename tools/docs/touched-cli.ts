/**
 * npm run docs:touched -- <base-ref>; the pull request description comes from the PR_BODY environment variable, or,
 * when that is not set, is read now from GitHub for the pull request `PR` of `GITHUB_REPOSITORY` with `GH_TOKEN`, so a
 * rerun after the description was fixed sees the new one. Its own entry point, apart from `cli.ts` (which loads remark),
 * with Node built-ins only and no shell or `gh` needed: a step of the CI `check` job runs it with
 * `node --experimental-strip-types` in CI (d090).
 */
import { execFileSync } from 'node:child_process';
import { checkDocsTouched } from './touched.ts';

/** The description: PR_BODY if set, else the current one from GitHub, else none. */
async function pullRequestBody(): Promise<string> {
  const given = process.env['PR_BODY'];
  if (given !== undefined) return given;
  const pr = process.env['PR'], repo = process.env['GITHUB_REPOSITORY'], token = process.env['GH_TOKEN'];
  if (!pr || !repo || !token) return '';
  const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`the description of pull request ${pr} could not be read: ${response.status}`);
  return ((await response.json()) as { body?: string | null }).body ?? '';
}

const base = process.argv[2];
if (!base) {
  console.error('usage: docs touched <base-ref>');
  process.exit(2);
}
const names = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const log = execFileSync('git', ['log', '--format=%B', `${base}..HEAD`], { encoding: 'utf8' });
const problem = checkDocsTouched(names, `${await pullRequestBody()}\n${log}`);
if (problem) console.error(`error: ${problem}`);
else console.log('docs touched, or not needed');
process.exit(problem ? 1 : 0);
