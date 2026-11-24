import { describe, expect, it } from 'vitest';
import { lintOldWords, oldWordIn } from './oldWords';
import { makeRepo } from './testRepo';

describe('the words of the old vision (d290)', () => {
  it('finds an old word as a whole word, a plural, a camelCase or snake_case part, in any case', () => {
    expect(oldWordIn('the Battle starts')).toBe('battle');
    expect(oldWordIn('three monsters wait')).toBe('monster');
    expect(oldWordIn('const monsterId = 1;')).toBe('monster');
    expect(oldWordIn('class BattleResultsScene {}')).toBe('battle');
    expect(oldWordIn('MONSTER_COUNT')).toBe('monster');
    expect(oldWordIn('a find-the-door screen')).toBe('find the door');
  });

  it('leaves alone a word that only contains one, and HP or RPG in small letters', () => {
    expect(oldWordIn('a campfire on the knoll')).toBeNull();
    expect(oldWordIn('the brass hub of the helm')).toBeNull();
    expect(oldWordIn('const hp = hip / 2;')).toBeNull();
    expect(oldWordIn('a damaged save is copied aside')).toBeNull();
    expect(oldWordIn('the player HP bar')).toBe('HP');
  });

  it('fails a line in code, content, tests or docs, and skips the allowed files and other kinds of file', () => {
    const repo = makeRepo({
      'src/a.ts': '// the tug\n// the battle\n',
      'content/b.json': '{ "tag": "monster-song" }',
      'src/core/progression/migrate.ts': 'raw.battles',
      'tests/fixtures/saves/profile.v9.json': '{ "battles": [] }',
      'public/c.png': 'battle',
    });
    expect(lintOldWords(repo).map((i) => `${i.file}:${i.line}`)).toEqual(['src/a.ts:2', 'content/b.json:1']);
  });
});
