import { binaryMetadata } from './binaryMeta.ts';
import { describe, expect, it } from 'vitest';
import { MAINTAINER_QUOTE, brokenPatterns, checkMessages, checkText, lintPrivacy, missingWordList, personalMatcher, personalWords, splitWords } from './privacy';
import { makeRepo } from './testRepo';

/** A PNG with the given chunks between its header and its end, as latin1 text for the test repo. */
const png = (chunks: string[]): string => {
  const chunk = (type: string, data = ''): string => `${String.fromCharCode(0, 0, 0, data.length)}${type}${data}\u0000\u0000\u0000\u0000`;
  return `\u0089PNG\r\n\u001a\n${chunk('IHDR', '\u0000'.repeat(13))}${chunks.map((c) => chunk(c, 'x')).join('')}${chunk('IEND')}`;
};
/** An MP3 that starts with an ID3v2.3 tag holding the given frames. */
const mp3 = (frames: [string, string][]): string => {
  const body = frames.map(([id, text]) => `${id}${String.fromCharCode(0, 0, 0, text.length + 1)}\u0000\u0000\u0000${text}`).join('');
  return `ID3\u0003\u0000\u0000${String.fromCharCode(0, 0, 0, body.length)}${body}\u00ff\u00fbaudio`;
};
const lines = (files: Record<string, string>, words?: string[]) => lintPrivacy(makeRepo(files), words).map((i) => `${i.file}:${i.line}`);
const at = (file: string, text: string, words: string[] = []) => checkText(file, text, words).map((i) => `${i.line} ${i.message.split(':')[0]}`);

describe('a quote of the maintainer (d165)', () => {
  it.each([
    'The maintainer: "make the moon blue"',
    'the maintainer said "x or y is better"',
    'the maintainer (ft_9_99, “the teapot should”)',
  ])('finds %s', (line) => expect(MAINTAINER_QUOTE.test(line)).toBe(true));

  it.each([
    'the maintainer runs the "Update screenshot baselines (Windows)" workflow',
    'a button labelled "KLAVER" that the maintainer picked',
  ])('leaves %s', (line) => expect(MAINTAINER_QUOTE.test(line)).toBe(false));

  it('finds a quote that wraps onto the next comment line, curly quotes, and a quote before its source', () => {
    expect(at('src/a.ts', "/**\n * the gulls (the maintainer,\n * 'cups and spoons?') fly\n */")).toEqual(["2 a person's words are quoted"]);
    expect(at('docs/a.md', 'the maintainer said ‘make it so now’')).toEqual(["1 a person's words are quoted"]);
    expect(at('docs/a.md', 'kept as "very nice indeed" (the maintainer)')).toEqual(["1 a person's words are quoted"]);
  });
});

describe('time of day and dates (d165)', () => {
  const issues = (files: Record<string, string>) => lintPrivacy(makeRepo(files), []).map((i) => `${i.file}:${i.line} ${i.message.split(':')[0]}`);
  it('finds a clock time or am/pm in markdown, not inside a code span', () => {
    expect(issues({ 'docs/a.md': 'sent at 17:31\nat 9 PM\nthe cron `0 3 * * 1` at `03:00`\na 4:3 picture is not a time? 4:30 is' })).toEqual(['docs/a.md:1 a time of day', 'docs/a.md:2 a time of day', 'docs/a.md:4 a time of day']);
  });
  it('reads code only on a line about someone', () => {
    expect(issues({ 'src/a.ts': "const t = '10:30';\n// the maintainer at 18:00: keep it" })).toEqual(['src/a.ts:2 a time of day']);
  });
  it('finds a day anywhere on a markdown line, file names and code spans too, and in any code comment, never in code data', () => {
    expect(issues({ 'docs/a.md': 'on 2000-01-12\nsee `2000-01-12`\nand photo-2000-01-11.png\nno day here', 'src/b.ts': "const d = '2000-01-22';\n// measured 2000-01-12" })).toEqual(['docs/a.md:1 a date', 'docs/a.md:2 a date', 'docs/a.md:3 a date', 'src/b.ts:2 a date']);
  });
  it('finds a date in a committed file name and reads dotfiles such as .gitignore', () => {
    expect(issues({ 'docs/perf-2000-01-12.md': 'ok', '.gitignore': '# kept from 2000-01-12\nprivate/' })).toEqual(['.gitignore:1 a date', 'docs/perf-2000-01-12.md:undefined a date in a committed file name']);
  });
  it('reads code comments and test titles, not code; finds ISO timestamps and dotted days', () => {
    expect(at('src/a.ts', "const when = '2000-01-22T10:00';\n// sent 2000-01-22T10:00\nit('keeps 12.01.2000', () => {});")).toEqual(['2 a date', '3 a date']);
  });
  it('reads hash comments in scripts and leaves Check lines alone', () => {
    expect(at('tools/a.py', "x = '2000-01-01'  # sent 2000-01-01")).toEqual(['1 a date']);
    expect(at('docs/decisions/a.md', 'Check: `src/a.test.ts` "night through 2000-01-01"')).toEqual([]);
  });
});

describe('an age (d165)', () => {
  it('finds a person\'s age, not seven metres or seven letters', () => {
    expect(at('docs/a.md', 'for a 7-year-old\n\nshe is seven years old\n\nabout seven metres ahead, seven letters wide')).toEqual(['1 an age', '3 an age']);
  });
});

describe('the private list (d165)', () => {
  it('reads entries from the file and the secret, ignoring blank and # lines, commas inside a pattern kept', () => {
    expect(personalWords('# names\nAlpha\n\n  Beta  \r\n', '')).toEqual(['Alpha', 'Beta']);
    expect(personalWords(null, '')).toEqual([]);
    expect(personalWords('Alpha', 'Gamma, Delta')).toEqual(['Alpha', 'Gamma', 'Delta']);
    expect(personalWords('/a{1,2}b/i', '')).toEqual(['/a{1,2}b/i']);
  });

  it('splits camelCase, snake_case and digits into words', () => {
    expect(splitWords('playerAlphaName_two3x')).toBe('player Alpha Name two 3 x');
    expect(splitWords('HTMLParser')).toBe('HTML Parser');
  });

  it('matches a word in any case with any ending from four letters on, a short or =word exactly, and a word inside an identifier', () => {
    const m = personalMatcher(['Zorbal', 'qix', '=Vantor'])!;
    expect(['ZORBAL here', 'the zorbals', "Zorbal's", 'zorbalile', 'const playerZorbal = 1', 'zorbal_name', 'qix'].map(m)).toEqual([true, true, true, true, true, true, true]);
    expect(['qixes', 'aqix', 'unzorbal', 'Vantors', 'none here'].map(m)).toEqual([false, false, false, false, false]);
    expect(m('Vantor')).toBe(true);
  });

  it('reads /pattern/flags entries as regular expressions and names a broken one by its number only', () => {
    const m = personalMatcher(['/blue\\s+teapots?/i', '/[unclosed/'])!;
    expect([m('Blue  Teapot'), m('a red teapot'), m('the /[unclosed/ thing')]).toEqual([true, false, false]);
    expect(personalMatcher([])).toBeNull();
    expect(brokenPatterns(['Alpha', '/[unclosed/'])?.message).toBe('entries 2 are patterns that do not compile: fix them (d165)');
    expect(brokenPatterns(['Alpha'])).toBeUndefined();
  });

  it('reports an entry in any committed file without printing it', () => {
    const issues = lintPrivacy(makeRepo({ 'docs/a.md': 'Zorbal was here\nnothing', 'content/b.json': '{"n":"ZORBALS"}', 'docs/c.svg': '<text>zorbal</text>' }), ['Zorbal']);
    expect(issues.map((i) => `${i.file}:${i.line}`)).toEqual(['content/b.json:1', 'docs/a.md:1', 'docs/c.svg:1']);
    expect(issues.every((i) => !i.message.toLowerCase().includes('zorbal'))).toBe(true);
  });

  it('is an error in CI when missing, a warning elsewhere, and nothing when given', () => {
    expect(missingWordList(makeRepo({}), [], true)?.severity).toBe('error');
    expect(missingWordList(makeRepo({}), [], false)?.severity).toBe('warning');
    expect(missingWordList(makeRepo({}), ['Alpha'], true)).toBeUndefined();
  });
});

describe('files of every kind (d165)', () => {
  it('reads files with no extension and score files whole; docs:ignore silences none of these rules', () => {
    expect(lines({ LICENSE: 'Zorbal', 'tests/fixtures/a.musicxml': '<encoding-date>2000-01-12</encoding-date>', 'docs/a.md': 'on 2000-01-12 docs:ignore\nZorbal docs:ignore' }, ['Zorbal'])).toEqual(['LICENSE:1', 'docs/a.md:1', 'docs/a.md:2', 'tests/fixtures/a.musicxml:1']);
  });

  it('fails a binary file outside the allowed kinds, and leaves allowed ones alone', () => {
    const issues = lintPrivacy(makeRepo({ 'docs/photo.jpg': 'JFIF\u0000data', 'public/audio/piano/C4.mp3': mp3([['TSSE', 'LAME']]), 'tests/e2e/visual.spec.ts-snapshots/a-chromium-win32.png': png([]) }), []);
    expect(issues.map((i) => `${i.file} ${i.message.split(':')[0]}`)).toEqual(['docs/photo.jpg a binary file the check cannot read']);
  });

  it('skips what git ignores', () => {
    const repo = { ...makeRepo({ 'logs/run-2000-01-12/a.txt': 'sent 2000-01-12' }), ignored: (p: string) => p.startsWith('logs') };
    expect(lintPrivacy(repo, [])).toEqual([]);
  });
});

describe('commit messages and the pull request description (d165)', () => {
  it('reads each message whole and names it, not a file', () => {
    const issues = checkMessages([{ name: 'commit abc', text: 'Fix the menu\n\nsent at 17:31' }, { name: 'pull request description', text: 'Zorbal asked for it' }], ['Zorbal']);
    expect(issues.map((i) => `${i.file}:${i.line} ${i.message.split(':')[0]}`)).toEqual(['commit abc:3 a time of day', 'pull request description:1 an entry of private/personal-words.txt is in a committed file (d165)']);
  });
});

describe('the rules\' own files (d165)', () => {
  it('leave out the generic rules on the privacy files, never the private list', () => {
    expect(at('tools/docs/privacy.ts', '// a 7-year-old at 17:31 on 2000-01-12\n// Zorbal', ['Zorbal'])).toEqual(['2 an entry of private/personal-words.txt is in a committed file (d165)']);
  });
});

describe('long hostile lines (d165)', () => {
  it('reads an unclosed quote full of backslashes and a long word in linear time', () => {
    const start = performance.now();
    checkText('src/x.ts', `const s = '${'\\'.repeat(5000)}`, []);
    checkText('src/x.ts', `it('${'\\'.repeat(5000)}`, []);
    checkText('docs/x.md', 'a'.repeat(200_000), []);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('names, hidden letters and history (d165)', () => {
  it('checks file and folder names against the private list', () => {
    expect(lintPrivacy(makeRepo({ 'docs/zorbal/notes.md': 'nothing', 'src/zorbalPlace.ts': '' }), ['Zorbal']).map((i) => `${i.file}:${i.line}`)).toEqual(['docs/zorbal/notes.md:undefined', 'src/zorbalPlace.ts:undefined']);
  });

  it('reads through NFKC, zero-width characters, look-alike letters and spaced-out letters', () => {
    const m = personalMatcher(['Zorbal', 'qix'])!;
    expect(['Ｚｏｒｂａｌ', 'Zor\u200Bbal', 'Zоrbаl', 'Z o r b a l', 'Z.O.R.B.A.L', 'q i x'].map(m)).toEqual([true, true, true, true, true, true]);
    expect(at('docs/a.md', 'sent ２０００-０１-１２')).toEqual(['1 a date']);
  });

  it('lets a short word take a plural or a possessive, nothing else', () => {
    const m = personalMatcher(['qix'])!;
    expect(['qixs', "qix's", 'qix’s', 'qixes', 'aqix'].map(m)).toEqual([true, true, true, false, false]);
  });

  it('finds more forms of a day and a time, and a weekday only beside a person doing something', () => {
    expect(at('docs/a.md', 'on 12 Nov\non Nov 12th\non 12. nov\nat 04h56\nthe maintainer tested it on Monday\n\nlessons on Monday and Wednesday')).toEqual(['1 a date', '2 a date', '3 a date', '4 a time of day', '5 a weekday beside someone\'s doing']);
    expect(at('docs/a.md', 'May the notes ring; 12 bars in 3/4; the 2nd voice')).toEqual([]);
  });

  it('finds issue and pull request numbers, commit hashes, branch names and git history in prose, not in code, links or colours', () => {
    expect(at('docs/a.md', 'fixed in #123\nsince c9c046f\non claude/project-thread-abc\nthe git history keeps it\nC#4 and F#5, `#12`, [x](a.md#3-parts), 0xfff09a')).toEqual(['1 a reference to the history', '2 a reference to the history', '3 a reference to the history', '4 a reference to the history']);
    expect(at('src/a.ts', "const c = '#333'; // the grey of #415\nit('keeps abc1234 as data', () => {});")).toEqual(['1 a reference to the history', '2 a reference to the history']);
    expect(checkMessages([{ name: 'commit a', text: 'Fix the menu (#708)' }], [])).toEqual([]);
  });

  it('reads every string of code and data for a quote or an age', () => {
    expect(at('src/a.ts', "const s = 'the maintainer said \"make it blue\"';")).toEqual(["1 a person's words are quoted"]);
    expect(at('content/a.json', '{ "title": "for a 7-year-old", "date": "2000-01-12" }')).toEqual(['1 an age']);
  });

  it('fails text inside an allowed picture or sound, and leaves the tags of the encoder', () => {
    const issues = lintPrivacy(makeRepo({ 'public/a.png': png(['tEXt']), 'public/b.png': png(['eXIf']), 'public/c.png': png(['IDAT']), 'public/audio/p/C4.mp3': mp3([['TSSE', 'LAME'], ['TLEN', '100']]), 'public/audio/p/D4.mp3': mp3([['TIT2', 'a title']]) }), []);
    expect(issues.map((i) => `${i.file} ${i.message.split(':')[0]}`)).toEqual(['public/a.png the PNG chunk tEXt', 'public/audio/p/D4.mp3 the ID3 frame TIT2', 'public/b.png the PNG chunk eXIf']);
  });

  it('fails a picture or sound it cannot follow to the end: text after the end, unknown chunks, older tags, other kinds', () => {
    const bytes = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));
    const found = (file: string, text: string): string | null => binaryMetadata(file, bytes(text));
    expect(found('a.png', png([]))).toBeNull();
    expect(found('a.png', `${png([])}secret`)).toBe('bytes after the end of the PNG');
    expect(found('a.png', png(['prVt']))).toBe('the PNG chunk prVt');
    expect(found('a.png', png([]).slice(0, -12))).toBe('a PNG without its end');
    expect(found('a.webp', 'RIFF\u0000\u0000\u0000\u0000WEBPVP8 \u00f8\u00ff\u00ff\u00ff')).toBe('a WebP that ends inside a chunk');
    expect(found('a.webp', 'RIFF\u0000\u0000\u0000\u0000WEBPEXIF\u0001\u0000\u0000\u0000xx')).toBe('the WebP chunk EXIF');
    expect(found('a.mp3', 'ID3\u0002\u0000\u0000\u0000\u0000\u0000\u0010TT2\u0000\u0000\u0004a title')).toBe('an ID3v2.2 tag');
    expect(found('a.mp3', 'ID3\u0003\u0000\u0040\u0000\u0000\u0000\u0010')).toBe('an ID3 extended header');
    expect(found('a.mp3', `\u00ff\u00fbaudio3DI\u0004\u0000\u0000\u0000\u0000\u0000\u0000`)).toBe('an ID3 tag at the end');
    expect(found('a.ogg', 'OggS')).toBe('a ogg file, which the check cannot read');
    expect(lines({ 'public/audio/p/C4.ogg': 'OggS\u0000vorbis' })).toEqual(['public/audio/p/C4.ogg:undefined']);
  });
});
