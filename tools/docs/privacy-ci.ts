// The privacy check of CI (d165), in its own job: Node built-ins only, run with `node --experimental-strip-types`, so no
// installed package's code runs where the private list secret is; CI runs the base commit's copy of it on the files of
// the current directory. Reads every committed file, and with a base ref the commit messages since it and the pull
// request's title and description (PR_TITLE, PR_BODY).
//   node --experimental-strip-types tools/docs/privacy-ci.ts [<base ref>]
// A missing list is an error, or a warning with ALLOW_MISSING_LIST=1 (a run in a fork, or a Dependabot pull request, which
// gets no secrets; the run on main checks it again).
import { execFileSync } from 'node:child_process';
import { brokenPatterns, checkMessages, lintPrivacy, missingWordList, PERSONAL_WORDS, personalWords } from './privacy.ts';
import { loadRepo } from './repo.ts';

const root = process.cwd();
const repo = loadRepo(root);
const words = personalWords(repo.read(PERSONAL_WORDS));
const missing = missingWordList(repo, words, process.env['ALLOW_MISSING_LIST'] !== '1');
const issues = [...(missing ? [missing] : []), ...[brokenPatterns(words)].filter((i) => i !== undefined), ...lintPrivacy(repo, words)];
const base = process.argv[2];
let messages = 0;
if (base) {
  const log = execFileSync('git', ['log', '--format=%H%x00%B%x00', `${base}..HEAD`], { encoding: 'utf8', cwd: root }).split('\0');
  const list: { name: string; text: string }[] = [];
  for (let i = 0; i + 1 < log.length; i += 2) list.push({ name: `commit ${(log[i] ?? '').trim().slice(0, 12)}`, text: log[i + 1] ?? '' });
  if (process.env['PR_TITLE']) list.push({ name: 'pull request title', text: process.env['PR_TITLE'] });
  if (process.env['PR_BODY']) list.push({ name: 'pull request description', text: process.env['PR_BODY'] });
  messages = list.length;
  issues.push(...checkMessages(list, words));
}
for (const i of issues) console.error(`${i.severity}: ${i.file}${i.line ? `:${i.line}` : ''}: ${i.message}`);
const errors = issues.filter((i) => i.severity === 'error').length;
console.log(errors === 0 ? `privacy check passed (${messages} message(s))` : `privacy check failed: ${errors} error(s)`);
process.exit(errors > 0 ? 1 : 0);
