/**
 * The first step of the CI `check` and `art rules` jobs (d090): with `PR_BASE` set (a pull request), compares the head
 * with `origin/<PR_BASE>`; prints whether code changed and writes `CODE=true|false` to the file `GITHUB_ENV` names, so
 * the later steps can skip. Node built-ins only and no shell syntax, so it runs the same on any runner
 * and on Linux.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { codeChanged } from './codeChanged.ts';

const base = process.env['PR_BASE'];
const files = base ? execFileSync('git', ['diff', '--name-only', `origin/${base}...HEAD`], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean) : null;
const code = codeChanged(files);
console.log(`code=${code}`);
const env = process.env['GITHUB_ENV'];
if (env) appendFileSync(env, `CODE=${code}\n`);
