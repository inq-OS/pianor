/**
 * The bug report button (ft_1_16, slice A): a link to GitHub's "new issue" page with the title and text filled in from
 * where the report was made. Nothing is sent by the game: the person reads the text in the browser, edits it and submits
 * it there, so no token lives in the game and no child data leaves the machine unseen (CLAUDE.md, d068).
 */

/** The repository the issue goes to; the person submits the issue there, signed in to GitHub. */
export const BUG_REPORT_REPOSITORY = 'inq-OS/pianor';

/** Kept under the browsers' safe URL length; the template's own text is far shorter, so only a long query is cut. */
export const BUG_REPORT_MAX_FIELD = 300;

/** Where the report was made: the screen and what it showed. No player name, no progress (child data stays local). */
export interface BugReportContext {
  /** The scene key the settings screen was opened from, such as `practice`. */
  screen: string;
  /** The piece on that screen, when it had one. */
  pieceId?: string;
  /** The bars of a practised section, when one was picked. */
  section?: { first: number; last: number };
  /** The page's address with its URL switches, such as `http://127.0.0.1:4173/?device=virtual` (the port tells the server). */
  page: string;
  /** True in a dev server (`npm run dev`, `npm run start`), false in a production build (`npm run start:local`). */
  devServer: boolean;
  /** The text language in use. */
  language: string;
  /** The browser (`navigator.userAgent`); the report keeps only its name and major version (`browserName`). */
  browser: string;
  /** Window size in CSS pixels. */
  window: { width: number; height: number };
}

/** Browser names in a user-agent string, the most specific first (Edge and Opera also say Chrome, Chrome also says Safari). */
const BROWSERS: readonly [name: string, token: RegExp][] = [
  ['Edge', /\bEdg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /\bOPR\/(\d+)/],
  ['Firefox', /\bFirefox\/(\d+)/],
  ['Chrome', /\b(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /\bVersion\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//],
];

/**
 * The browser's name and major version from a user-agent string, such as `Chrome 141`, and `unknown` for anything else:
 * the report names the browser, not the system, its build or the exact version.
 */
export function browserName(userAgent: string): string {
  for (const [name, token] of BROWSERS) {
    const match = token.exec(userAgent);
    if (match) return `${name} ${match[1]}`;
  }
  return 'unknown';
}

function cut(value: string): string {
  return value.length > BUG_REPORT_MAX_FIELD ? `${value.slice(0, BUG_REPORT_MAX_FIELD)}…` : value;
}

/**
 * The text of the issue. The questions are for the grown-up who submits it, so they are English like every issue; the
 * facts under "Where" come from the game. Reads `data` of the screen loosely, since every screen has its own.
 */
export function bugReportBody(context: BugReportContext): string {
  const where = [
    `- Screen: \`${cut(context.screen)}\``,
    ...(context.pieceId ? [`- Piece: \`${cut(context.pieceId)}\``] : []),
    ...(context.section ? [`- Section: bars ${context.section.first} to ${context.section.last}`] : []),
    `- Page: \`${cut(context.page)}\``,
    `- Build: ${context.devServer ? 'dev server' : 'production build'}`,
    `- Language: ${cut(context.language)}`,
    `- Window: ${context.window.width} x ${context.window.height}`,
    `- Browser: ${browserName(context.browser)}`,
  ];
  return [
    '## What happened',
    '',
    '',
    '## What should have happened',
    '',
    '',
    '## Steps (if known)',
    '',
    '1. ',
    '',
    '## Where (filled in by the game)',
    '',
    ...where,
    '',
    '_Reported from the game\'s bug button (ft_1_16). Check that no child data (names, progress) is in the text before submitting._',
  ].join('\n');
}

/** The "new issue" link for `context`: title, body and the `bug` label, all URL-encoded. */
export function bugReportUrl(context: BugReportContext, repository: string = BUG_REPORT_REPOSITORY): string {
  const params = new URLSearchParams({
    title: `Bug: ${cut(context.screen)}${context.pieceId ? ` (${cut(context.pieceId)})` : ''}`,
    body: bugReportBody(context),
    labels: 'bug',
  });
  return `https://github.com/${repository}/issues/new?${params.toString()}`;
}

/**
 * What the report can say about a screen from the data it was started with: a piece id (`chartId`, or the `id` of a
 * `chart`) and a section, when they have the expected shape. Anything else in the data is left out.
 */
export function screenFacts(data: unknown): Pick<BugReportContext, 'pieceId' | 'section'> {
  if (typeof data !== 'object' || data === null) return {};
  const record = data as Record<string, unknown>;
  const chart = record['chart'];
  const chartId = typeof record['chartId'] === 'string' ? record['chartId']
    : typeof chart === 'object' && chart !== null && typeof (chart as Record<string, unknown>)['id'] === 'string' ? (chart as Record<string, string>)['id'] : undefined;
  const section = record['section'];
  const isSection = typeof section === 'object' && section !== null
    && Number.isInteger((section as Record<string, unknown>)['first']) && Number.isInteger((section as Record<string, unknown>)['last']);
  return {
    ...(chartId ? { pieceId: chartId } : {}),
    ...(isSection ? { section: section as { first: number; last: number } } : {}),
  };
}
