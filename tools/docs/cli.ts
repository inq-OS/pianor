import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { reportCriteria } from './criteria.ts';
import { expandAll, readItems } from './generate.ts';
import { lintDocs } from './lint.ts';
import { withFrontMatter, parseFrontMatter } from './frontmatter.ts';
import { agentRun } from './verifyGuard.ts';
import { brokenPatterns, missingWordList, PERSONAL_WORDS, personalWords } from './privacy.ts';
import { loadRepo } from './repo.ts';
import { reportStale, staleDocs, trackedDocs } from './stale.ts';

const [command, ...flags] = process.argv.slice(2);
const root = process.cwd();
const repo = loadRepo(root);

if (command === 'index') {
  const { changed, errors } = expandAll(repo);
  for (const e of errors) console.error(e);
  for (const [path, text] of changed) {
    writeFileSync(`${root}/${path}`, text);
    console.log(`updated ${path}`);
  }
  if (changed.size === 0) console.log('docs are up to date');
  process.exit(errors.length > 0 ? 1 : 0);
}

if (command === 'check') {
  // The private list is required in the privacy workflow (.github/workflows/privacy.yml, tools/docs/privacy-ci.ts); here its absence is a warning.
  const words = personalWords(repo.read(PERSONAL_WORDS));
  const listIssues = [missingWordList(repo, words, false), brokenPatterns(words)].filter((i) => i !== undefined);
  const issues = [...listIssues, ...(await lintDocs(repo))];
  for (const i of issues) console.error(`${i.severity === 'error' ? 'error' : 'warning'}: ${i.file}${i.line ? `:${i.line}` : ''}: ${i.message}`);
  const errors = issues.filter((i) => i.severity === 'error').length;
  console.log(errors === 0 ? 'docs check passed' : `docs check failed: ${errors} error(s)`);
  process.exit(errors > 0 ? 1 : 0);
}

if (command === 'criteria') {
  console.log(reportCriteria(repo, readItems(repo)));
  process.exit(0);
}

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', cwd: root });

if (command === 'stale') {
  const tracked = trackedDocs(repo);
  const stale = staleDocs(tracked, (commit, covers) => [
    ...new Set(git('log', '--name-only', '--format=', `${commit}..HEAD`, '--', ...covers).split(/\r?\n/).filter(Boolean)),
  ]);
  console.log(reportStale(stale, tracked.length));
  process.exit(flags.includes('--strict') && stale.length > 0 ? 1 : 0);
}

if (command === 'verify') {
  // npm run docs:verify -- <doc> [--covers a,b]: a person has re-read the doc; stamp it with the current commit.
  if (agentRun(process.env)) {
    console.error('docs verify is run by a person who re-read the doc, never inside an agent session (d202)');
    process.exit(2);
  }
  const doc = flags.find((f) => !f.startsWith('--'));
  const coversFlag = flags.find((f) => f.startsWith('--covers='));
  const text = doc ? repo.docs.get(doc) : undefined;
  if (!doc || text === undefined) {
    console.error('usage: docs verify <doc.md> [--covers=path,path]  (the doc must be a markdown file under docs/)');
    process.exit(2);
  }
  const fm = parseFrontMatter(text);
  const data = fm.kind === 'ok' ? fm.data : {};
  if (coversFlag) data['covers'] = coversFlag.slice('--covers='.length).split(',');
  if (!Array.isArray(data['covers'])) {
    console.error(`${doc} has no covers list yet: pass --covers=src/core/,tools/ the first time`);
    process.exit(2);
  }
  data['verified_against'] = git('rev-parse', '--short', 'HEAD').trim();
  delete data['last_reviewed'];
  writeFileSync(`${root}/${doc}`, withFrontMatter(text, data));
  console.log(`${doc}: verified against ${String(data['verified_against'])}`);
  process.exit(0);
}

console.error('usage: docs <index | check | criteria | stale | verify> (touched: tools/docs/touched-cli.ts)');
process.exit(2);
