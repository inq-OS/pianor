import { describe, expect, it } from 'vitest';
import { lintTags } from './tags';
import { makeRepo } from './testRepo';

const run = (files: Record<string, string>) => lintTags(makeRepo(files)).map((i) => `${i.file}:${i.line}`);

describe('work tags (d214)', () => {
  it('takes a tag of the right form in a doc and an example in a code span or a fenced block', () => {
    expect(run({ 'docs/a.md': '- TODO(builder, R2): x\n- IDEA(painter): y\n- ASAP(architect): z\n`TODO(<project>, R2)`\n```\nTODO(who, when)\n```' })).toEqual([]);
  });

  it('fails a tag in a doc with no project or a made-up release', () => {
    expect(run({ 'docs/a.md': '- TODO(R2): x\n- TODO(builder, soon): y' })).toEqual(['docs/a.md:1', 'docs/a.md:2']);
  });

  it('lets code only point at the doc that holds the tag', () => {
    expect(run({ 'src/a.ts': '// first guesses (TODO(builder, R3) in ft_1_30)\n// (`TODO(painter)` in ft_1_31)\n// TODO(builder, R3): fit them' })).toEqual(['src/a.ts:3']);
  });
});
