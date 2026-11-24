import type { Issue } from './lint.ts';
import type { Repo } from './repo.ts';
import { binaryMetadata } from './binaryMeta.ts';

/*
 * No committed line quotes a person, holds anything personal, or shows a day or time that someone worked (d165). This check reads the prose of every committed text file: Markdown lines (code spans, link targets
 * and file names left out), comments and test titles in code, and data files whole. Neighbouring prose lines are read as
 * one block, so a quote that wraps onto the next line is still found; an issue names the line the match starts on. Text is
 * read after Unicode normalisation (NFKC, no zero-width or soft-hyphen characters, Cyrillic and Greek look-alikes as
 * Latin letters), and the private list also against letters spaced out (`A B C D`). The rules here are generic; anything that names a person, a place or a thing of
 * someone's life lives only in the private word list (`PERSONAL_WORDS`), as a word or a pattern.
 */

const Q_OPEN = `["“'‘«]`;
const Q_BODY = `[^"“”'‘’«»\\n]{4,}`;

/** The maintainer named, then within the clause a colon, comma, bracket or verb of saying, then a quotation mark. */
export const MAINTAINER_QUOTE = new RegExp(
  `\\bmaintainer\\b[^"“«\\n]{0,120}?(?:[:,(]|\\b(?:said|says|wrote|writes|asked|asks|wants?|replied|answered))\\s*${Q_OPEN}${Q_BODY}`,
  'i',
);
/** A quotation followed by the maintainer as its source: `"..." (the maintainer)`. */
export const QUOTE_THEN_MAINTAINER = new RegExp(`${Q_OPEN}${Q_BODY}["”'’»]\\s*\\((?:the )?maintainer\\b`, 'i');

/** A person's age (`7-year-old`, `seven years old`): the repo says "the student", never how old anyone is. */
export const AGE = /\b(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[- ](?:year[- ]olds?|years? old|yo)\b/i;

/** A time of day (`17:31`, `9 PM`, `04h56`). */
export const TIME_OF_DAY = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9]) ?(?:[ap]\.?m\.?)(?![\p{L}])|\b(?:[01]?\d|2[0-3])h[0-5]\d\b/iu;

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const KUU = '(?:jaan(?:uar)?|veebr(?:uar)?|märts|apr(?:ill)?|mai|juuni|juuli|aug(?:ust)?|sept(?:ember)?|okt(?:oober)?|nov(?:ember)?|dets(?:ember)?)(?:il|ini|ist|is)?\\.?';
/** A calendar day (`2000-01-12`, `2000-01-12T10:00`, `12.01.2000`, `12 Nov`, `Nov 12th`, `12. nov`): the dNNN order says what is newer. */
export const DAY = new RegExp(
  `\\b(?:19|20)\\d\\d-[01]\\d-[0-3]\\d(?!\\d)|\\b[0-3]?\\d\\.[01]?\\d\\.(?:19|20)\\d\\d\\b|\\b[0-3]?\\d(?:st|nd|rd|th)?\\.? (?:${MONTH})(?![\\p{L}])|\\b(?:${MONTH}) [0-3]?\\d(?:st|nd|rd|th)?\\b(?![.:]?\\d)|\\b[0-3]?\\d\\. ?${KUU}(?![\\p{L}])`,
  'u',
);
/** A weekday named beside someone's doing (`on Monday the maintainer...`): checked only where the words are about a person. */
export const WEEKDAY = /\b(?:on|last|this|next|that|since|until) (?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b|\b(?:eelmisel|sel|järgmisel) (?:esmaspäeval|teisipäeval|kolmapäeval|neljapäeval|reedel|laupäeval|pühapäeval)/iu;

/**
 * A reference to the repository's history: an issue or pull request number (`#123`), a commit hash in prose, a working
 * branch name, or words that point the reader at what git keeps. Say what the thing is about instead.
 */
export const HISTORY_REF = /(?<![\p{L}\p{N}&#/.-])#\d{1,5}\b|(?<![\p{L}\p{N}_./-])(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}(?![\p{L}\p{N}_-])|(?<![\w./-])claude\/[\w-]+|\bgit history\b|\bhistory (?:is |stays )?in git\b|\bkept by git\b/iu;

/** In Markdown: code spans, link targets and file names are not prose. */
const NOT_PROSE = /`[^`]*`|\]\([^)]*\)|<https?:[^>]*>|https?:\/\/\S+|(?<![\w./-])[\w./-]*\b20\d\d-\d\d-\d\d[\w-]*\.(?:md|png|jpe?g|json|txt|ts)\b/g;

/** Text files whose words could reach a reader; the private folder, gitignored files and generated output are not read. */
const TEXT = /\.(md|ts|js|mjs|cjs|json|jsonc|txt|abc|ya?ml|py|ps1|cmd|bat|sh|html|svg|xml|musicxml|css|csv|toml|ini|cfg)$|(?:^|\/)\.(?:gitignore|gitattributes|npmrc|nvmrc|editorconfig|env\.example)$/;
const SKIP = /^(package-lock\.json$|tools\/docs\/privacy(?:\.test)?\.ts$)/;
/** Files the generic rules leave out (the lock file, the rules themselves with their examples); the private list still reads them. */
export const skipped = (file: string): boolean => SKIP.test(file);
const MARKDOWN = /\.md$/;
const HASH_COMMENTS = /\.(py|ps1|sh|ya?ml|toml|ini|cfg)$|(?:^|\/)\.(?:gitignore|gitattributes|npmrc|editorconfig|env\.example)$/;
/** Read whole, as prose: plain text, tunes, pictures and scores drawn as text, and files with no known extension. */
const DATA = /\.(txt|abc|svg|xml|musicxml|csv)$/;
const JSON_FILE = /\.jsonc?$/;
/** In JSON only free-text fields are prose for every rule; every other string value is read for quotes and ages. */
const JSON_PROSE = /"(?:note|notes|what|comment|comments|description|why|about|summary|todo|\/\/)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
const JSON_STRING = /"((?:\\.|[^"\\])*)"/g;
const STRING_LITERAL = /(['"`])((?:\\[\s\S]|(?!\1)[^\\])*)\1/g;
/** In code a day or time is checked only where the words are about a person's doing, since tests and fixtures use days as data. */
const ABOUT_SOMEONE = /\b(?:maintainer|asked|said|sent|picked|chose|approved|verdict|decided|wanted|playtest|tested|photograph(?:s|ed)?|wrote|reported)\b/i;

/**
 * Binary files may be committed only where these patterns allow; anything else binary fails, since the check cannot
 * read it. Each kind here has a reader in `binaryMeta.ts` for the text it can carry; a new kind comes with its reader.
 */
export const BINARY_ALLOWED: readonly RegExp[] = [
  /^public\/audio\/[\w-]+\/[\w#-]+\.mp3$/,
  /^tests\/e2e\/[\w.-]+-snapshots\/[\w-]+\.png$/,
  /^(?:public|src|content)\/(?:[\w-]+\/)*[\w.-]+\.(?:png|webp)$/,
  /^public\/assets\/[\w-]+\/[\w.-]+\.woff2$/,
];

/** A third-party pack's own licence (`public/assets/<pack>/LICENSE`, d084): its version date is the licence's, not ours. */
const PACK_LICENCE = /^public\/assets\/[\w-]+\/LICENSE$/;

/** The private list of words and patterns that must never be committed, kept only in the gitignored private folder. */
export const PERSONAL_WORDS = 'private/personal-words.txt';

/** The entries of the private list and of the `PIANOR_PERSONAL_WORDS` CI secret (one per line, or words joined by commas), so CI checks them too. */
export function personalWords(text: string | null, env: string | undefined = process.env.PIANOR_PERSONAL_WORDS): string[] {
  return `${text ?? ''}\n${env ?? ''}`
    .split(/\r?\n/)
    .flatMap((line) => (line.trim().startsWith('/') ? [line] : line.split(',')))
    .map((w) => w.trim())
    .filter((w) => w !== '' && !w.startsWith('#'));
}


/** Text has no NUL byte; the first few thousand characters decide. */
export const looksBinary = (text: string): boolean => text.slice(0, 8000).includes('\u0000') || text.slice(0, 8000).includes('\uFFFD');

/** Split camelCase, snake_case and digits apart, so `fooBar_baz9` also reads as `foo Bar baz 9`. */
export const splitWords = (line: string): string =>
  line
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/(\p{L})(?=\p{N})/gu, '$1 ')
    .replace(/(\p{N})(?=\p{L})/gu, '$1 ')
    .replace(/_/g, ' ');

/**
 * One matcher for the private list. An entry `/pattern/flags` is a regular expression; a word matches as a whole word in
 * any case, with any ending when it is four letters or longer (`=word` asks for the word alone), in plain text and in
 * split identifiers (`theWordHere`, `the_word_here`). The 1-based number of every pattern that does not compile is
 * pushed to `broken`, so it can be reported without printing it. Keep patterns simple: they run on every line.
 */
export function personalMatcher(entries: readonly string[], broken: number[] = []): ((line: string) => boolean) | null {
  const patterns: RegExp[] = [];
  const words: string[] = [];
  for (const [index, e] of entries.entries()) {
    const re = /^\/(.+)\/([a-z]*)$/.exec(e);
    if (re) {
      try {
        patterns.push(new RegExp(re[1] as string, (re[2] as string).replace(/[gy]/g, '') || 'iu'));
        continue;
      } catch {
        broken.push(index + 1);
        continue;
      }
    }
    const exact = e.startsWith('=');
    const word = exact ? e.slice(1) : e;
    // a word of four letters or more takes any ending; a shorter one only a plural or possessive, so it stays a name
    if (word !== '') words.push(`${escape(word)}${exact ? '' : [...word].length >= 4 ? '[\\p{L}]*' : "(?:s|['’]s)?"}`);
  }
  const wordRe = words.length > 0 ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.join('|')})(?![\\p{L}\\p{N}])`, 'iu') : null;
  if (wordRe === null && patterns.length === 0) return null;
  return (raw) => {
    const line = normalise(raw);
    const spaced = unspaced(line);
    return (wordRe !== null && [line, splitWords(line), spaced].some((v) => wordRe.test(v))) || patterns.some((p) => p.test(line) || p.test(spaced));
  };
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cyrillic and Greek letters that look like Latin ones, read as the Latin letter. */
const LOOK_ALIKES: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ԛ: 'q', ԝ: 'w',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', І: 'I', Ј: 'J', Ѕ: 'S',
  α: 'a', ο: 'o', ρ: 'p', ν: 'v', ι: 'i', κ: 'k', τ: 't', υ: 'u', χ: 'x', Α: 'A', Β: 'B', Ε: 'E', Η: 'H', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Υ: 'Y', Χ: 'X', Ζ: 'Z',
};
const LOOK_ALIKE = new RegExp(`[${Object.keys(LOOK_ALIKES).join('')}]`, 'gu');
/** NFKC, without zero-width characters and soft hyphens, look-alike letters as Latin: what a reader sees. */
export const normalise = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .replace(LOOK_ALIKE, (c) => LOOK_ALIKES[c] ?? c);
/** Single letters spaced out or dotted apart (`A B C`, `A.B.C`, `A-B-C`) joined back into a word. */
export const unspaced = (line: string): string => line.replace(/(?<![\p{L}\p{N}])\p{L}(?:[ ._-]\p{L}(?![\p{L}\p{N}])){2,}/gu, (m) => m.replace(/[ ._-]/g, ''));

const TEST_TITLE = /\b(?:it|test|describe)(?:\.(?:each\([^)]*\)|skip|only|todo))?\(\s*(['"`])((?:\\[\s\S]|(?!\1)[^\\])*)\1/g;

/** The prose of one line: what a reader would read as words, or '' for code and data the program uses. */
export function proseOf(file: string, line: string, state: { inBlock: boolean }, titles = true): string {
  // a ledger's Check line names test files and titles: data, not prose; an untestable reason is prose
  if (line.startsWith('Check: ')) return line.startsWith('Check: untestable:') ? line.slice('Check: untestable:'.length) : '';
  if (MARKDOWN.test(file)) return line.replace(NOT_PROSE, ' ');
  if (DATA.test(file) || !TEXT.test(file)) return line;
  if (JSON_FILE.test(file)) return [...line.matchAll(JSON_PROSE)].map((m) => m[1] as string).join(' ');
  const parts: string[] = [];
  let rest = line;
  if (state.inBlock) {
    const end = rest.indexOf('*/');
    parts.push(end === -1 ? rest : rest.slice(0, end));
    if (end === -1) return parts.join(' ');
    state.inBlock = false;
    rest = rest.slice(end + 2);
  }
  // comment marks are looked for outside string literals, so a glob such as '**/**' opens no comment
  const code = rest.replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, (m) => ' '.repeat(m.length));
  const hash = HASH_COMMENTS.test(file) ? code.search(/(?:^|\s)#/) : -1;
  if (hash !== -1) parts.push(rest.slice(hash));
  const slash = code.search(/(?:^|[^:\\])\/\//);
  if (slash !== -1) parts.push(rest.slice(slash));
  const open = code.indexOf('/*');
  if (open !== -1 && (slash === -1 || open < slash)) {
    const close = rest.indexOf('*/', open + 2);
    parts.push(close === -1 ? rest.slice(open) : rest.slice(open, close));
    if (close === -1) state.inBlock = true;
  }
  if (titles) for (const m of rest.matchAll(TEST_TITLE)) parts.push(m[2] as string);
  if (/\.html$/.test(file)) parts.push(rest.replace(/<[^>]*>/g, ' '));
  return parts.join(' ');
}

interface Block {
  text: string;
  /** For each block line, its 1-based line number and where it starts in `text`. */
  starts: { line: number; at: number }[];
}

/** Neighbouring prose lines as blocks; a blank line, a table row break or a non-prose line ends a block. */
function blocksOf(file: string, text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const state = { inBlock: false };
  text.split('\n').forEach((raw, i) => {
    const prose = proseOf(file, normalise(raw), state).trim();
    const row = MARKDOWN.test(file) && raw.trimStart().startsWith('|');
    if (prose === '' || row) current = null;
    if (prose === '') return;
    if (current === null) {
      current = { text: '', starts: [] };
      blocks.push(current);
    }
    current.starts.push({ line: i + 1, at: current.text.length });
    current.text += `${prose.replace(/^(?:\/\/+|\/\*+|\*+\/?|#+)\s*/, '')} `;
    if (row) current = null;
  });
  return blocks;
}

const lineAt = (block: Block, at: number): number => {
  let line = block.starts[0]?.line ?? 1;
  for (const s of block.starts) if (s.at <= at) line = s.line;
  return line;
};

const QUOTED = "a person's words are quoted: write the rule itself, without the quote (d165)";
const A_DATE = 'a date: leave it out, the dNNN order says what is newer (d165)';
const A_TIME = 'a time of day: leave it out (d165)';
const AN_AGE = 'an age: write "the student", never how old anyone is (d165)';
const A_HISTORY_REF = 'a reference to the history: an issue or pull request number, a commit, a branch or git history; say what it is about instead (d165)';
const RULES: { re: RegExp; message: string; gated?: boolean }[] = [
  { re: MAINTAINER_QUOTE, message: QUOTED },
  { re: QUOTE_THEN_MAINTAINER, message: QUOTED },
  { re: AGE, message: AN_AGE },
  { re: TIME_OF_DAY, message: A_TIME },
  { re: DAY, message: A_DATE },
  { re: WEEKDAY, message: 'a weekday beside someone\'s doing: leave it out (d165)', gated: true },
  { re: HISTORY_REF, message: A_HISTORY_REF },
];
/** The rules read in every string of code and data too, where a day or a number is data: quotes and ages. */
const STRING_RULES = RULES.filter((r) => r.message === QUOTED || r.message === AN_AGE);

/** Strings in a line of code or data, for the quote and age rules. */
function stringsOf(file: string, line: string): string[] {
  if (MARKDOWN.test(file) || DATA.test(file) || !TEXT.test(file)) return [];
  if (JSON_FILE.test(file)) return [...line.matchAll(JSON_STRING)].map((m) => m[1] as string);
  return [...line.matchAll(STRING_LITERAL)].map((m) => m[2] as string);
}

/**
 * Quotes, ages, days, times, history references and entries of the private list in one file's text, and its path: a
 * private word or a date in a file or folder name. A message (`named` false) has no path, and history references are
 * left to its own tools (GitHub names the pull request in a merged commit's title).
 */
export function checkText(file: string, text: string, words: string[], generic = !skipped(file), named = true): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const push = (line: number, message: string): void => {
    const key = `${line}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ severity: 'error', file, line, message });
  };
  const markdown = MARKDOWN.test(file);
  const code = !markdown && !DATA.test(file) && TEXT.test(file);
  const personal = personalMatcher(words);
  if (named && personal !== null && personal(file.replace(/[/.]/g, ' '))) push(0, `an entry of ${PERSONAL_WORDS} is in a committed file or folder name (d165)`);
  if (named && /(?:19|20)\d\d-[01]\d/.test(file)) push(0, 'a date in a committed file name: name it by what it holds (d165)');
  for (const block of generic ? blocksOf(file, text) : []) {
    for (const { re, message, gated } of RULES) {
      if (re === DAY && PACK_LICENCE.test(file)) continue;
      if (((code && (re === DAY || re === TIME_OF_DAY)) || gated) && !ABOUT_SOMEONE.test(block.text)) continue;
      if (re === HISTORY_REF && !named) continue;
      for (const m of block.text.matchAll(new RegExp(re.source, `${re.flags}g`))) push(lineAt(block, m.index), message);
    }
  }
  const comments = { inBlock: false };
  if (generic) text.split('\n').forEach((original, i) => {
    if (original.startsWith('Check: ')) return;
    const raw = normalise(original);
    // A day is a day in a file name, a link or a code span too: a dated folder says when someone worked.
    if (markdown && DAY.test(raw)) push(i + 1, A_DATE);
    // In code a comment is prose whoever it is about; test titles stay gated, since tests use days as data.
    if (code) {
      const said = proseOf(file, raw, comments, false);
      if (DAY.test(said)) push(i + 1, A_DATE);
      if (TIME_OF_DAY.test(said)) push(i + 1, A_TIME);
    }
    for (const str of stringsOf(file, raw)) for (const { re, message } of STRING_RULES) if (re.test(str)) push(i + 1, message);
  });
  // The private list is looked for in the whole text, code and data too. The entry itself is never printed.
  if (personal !== null) {
    text.split('\n').forEach((line, i) => {
      if (personal(line)) push(i + 1, `an entry of ${PERSONAL_WORDS} is in a committed file (d165)`);
    });
  }
  return issues.map((i): Issue => (i.line === 0 ? { severity: i.severity, file: i.file, message: i.message } : i)).sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

/**
 * When the private list is missing, nothing personal is checked: an error in CI (`ci` true), where the secret must be set,
 * and a warning on a machine without the list.
 */
export function missingWordList(repo: Repo, words: string[] = personalWords(repo.read(PERSONAL_WORDS)), ci = !!process.env.CI): Issue | undefined {
  if (words.length > 0) return undefined;
  return { severity: ci ? 'error' : 'warning', file: PERSONAL_WORDS, message: 'no private word list (the file, or the PIANOR_PERSONAL_WORDS secret in CI): nothing personal is checked (d165)' };
}

/** An error naming, by number only, each private-list pattern that does not compile (it would check nothing). */
export function brokenPatterns(words: readonly string[]): Issue | undefined {
  const broken: number[] = [];
  personalMatcher(words, broken);
  return broken.length === 0 ? undefined : { severity: 'error', file: PERSONAL_WORDS, message: `entries ${broken.join(', ')} are patterns that do not compile: fix them (d165)` };
}

/** Commit messages and a pull request's description, read whole as prose with the same rules as a committed file. */
export function checkMessages(messages: { name: string; text: string }[], words: string[]): Issue[] {
  return messages.flatMap(({ name, text }) => checkText(`${name}.txt`, text, words, true, false).map((i) => ({ ...i, file: name })));
}

/** A binary file: its name by the rules above, its kind against `BINARY_ALLOWED`, and the text inside it (`binaryMeta.ts`). */
export function checkBinary(file: string, bytes: Uint8Array | null, words: string[]): Issue[] {
  const issues = checkText(file, '', words);
  if (!BINARY_ALLOWED.some((re) => re.test(file))) return [...issues, { severity: 'error', file, message: 'a binary file the check cannot read: commit text, or allow its kind in BINARY_ALLOWED (d165)' }];
  const found = bytes === null ? null : binaryMetadata(file, bytes);
  return found === null ? issues : [...issues, { severity: 'error', file, message: `${found}: text inside a picture or a sound, which the check cannot read; strip it (d165)` }];
}

/** Every committed file: text read by the rules above, binary only where `BINARY_ALLOWED` lets it be. */
export function lintPrivacy(repo: Repo, words: string[] = personalWords(repo.read(PERSONAL_WORDS))): Issue[] {
  const issues: Issue[] = [];
  const committed = (repo.committed ?? [...repo.paths]).filter((f) => !f.startsWith('private/') && !f.startsWith('node_modules/') && !(repo.ignored?.(f) ?? false)).sort();
  for (const file of committed) {
    const text = file === 'package-lock.json' ? '' : (repo.docs.get(file) ?? repo.sources.get(file) ?? repo.read(file));
    if (text === null) continue;
    if (looksBinary(text)) {
      issues.push(...checkBinary(file, repo.readBytes?.(file) ?? null, words));
      continue;
    }
    issues.push(...checkText(file, text, words));
  }
  return issues;
}
