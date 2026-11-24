import type { Issue } from './lint.ts';
import type { Repo } from './repo.ts';

/**
 * The words of the game's old vision (d290): a current thing is never named with one, and what belongs to no current
 * feature is deleted. A word matches as a whole word in any case, also as a part of a camelCase name (`monsterId`,
 * `BattleScene`); `HP` and `RPG` match only in capitals.
 */
export const OLD_WORDS: readonly string[] = [
  'monster', 'beings', 'enemy', 'battle', 'fight', 'HP', 'health bar', 'loot', 'campaign', 'arena', 'overworld', 'find the key',
  'find the door', 'spellbook', 'spell power', 'RPG', 'equipment', 'special ability', 'power attack', 'counterattack', 'boss fight',
  'confuser',
];

/**
 * Where an old word may stand, and why: a frozen migration step and the old saves it reads (d064), a rule that keeps the
 * words off the screen, and the name of a third-party pack. A path ending in `/` covers its folder.
 */
export const OLD_WORDS_ALLOWED: readonly { path: string; why: string }[] = [
  { path: 'src/core/progression/migrate.ts', why: 'the frozen migration steps read the old save keys (d064)' },
  { path: 'src/core/progression/migrate.test.ts', why: 'the tests of those steps' },
  { path: 'src/core/progression/helpsRecord.test.ts', why: 'a migration test that reads an old save' },
  { path: 'src/core/progression/noteTiming.test.ts', why: 'a migration test that reads an old save' },
  { path: 'src/core/progression/profile.ts', why: 'the log of the old save versions' },
  { path: 'src/core/save/documents.ts', why: 'the frozen step from profile document version 1' },
  { path: 'tests/fixtures/saves/', why: 'old saves, kept as they were written' },
  { path: 'tests/progression/saveDocuments.test.ts', why: 'the golden test of the step from the old records' },
  { path: 'src/core/character/rules.ts', why: 'the label words a character never says' },
  { path: 'docs/features/ft_1_21-challenges-with-characters.md', why: 'the words the student never sees in a challenge' },
  { path: '.claude/skills/use-free-art-packs/SKILL.md', why: 'the name of a third-party icon pack' },
  { path: 'tools/docs/oldWords.ts', why: 'this list' },
  { path: 'tools/docs/oldWords.test.ts', why: 'its tests' },
];

const TEXT = /\.(?:ts|js|mjs|cjs|json|md|abc|py|ya?ml|html|css|txt)$/;
const CAPITALS = new Set(['HP', 'RPG']);

/** One pattern per word: a whole word with its plural or -ing form; a space in the word matches a space, a dash or an underscore. */
function patternOf(word: string): RegExp {
  const body = word.replace(/ /g, '[ _-]');
  return CAPITALS.has(word) ? new RegExp(`\\b${body}\\b`) : new RegExp(`\\b${body}(?:s|es|ing)?\\b`);
}

const PATTERNS = OLD_WORDS.map((word) => ({ word, re: patternOf(word) }));

function allowed(path: string): boolean {
  return OLD_WORDS_ALLOWED.some((a) => (a.path.endsWith('/') ? path.startsWith(a.path) : path === a.path));
}

/** The first old word on a line, or null. A camelCase name is read as its words (`monsterId` as "monster id"). */
export function oldWordIn(line: string): string | null {
  const split = line.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  const lower = split.toLowerCase();
  for (const { word, re } of PATTERNS) {
    if (re.test(CAPITALS.has(word) ? split : lower)) return word;
  }
  return null;
}

export function lintOldWords(repo: Repo): Issue[] {
  const issues: Issue[] = [];
  const files = repo.committed ?? [...repo.paths];
  for (const file of files) {
    if (!TEXT.test(file) || allowed(file) || file === 'package-lock.json') continue;
    const text = repo.read(file);
    if (text === null) continue;
    text.split('\n').forEach((line, n) => {
      const word = oldWordIn(line);
      if (word) issues.push({ severity: 'error', file, line: n + 1, message: `"${word}" is a word of the old vision; name the current thing (docs/glossary.md) or delete what nothing uses (d290)` });
    });
  }
  return issues;
}
