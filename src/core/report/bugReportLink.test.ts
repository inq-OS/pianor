import { describe, expect, it } from 'vitest';
import { BUG_REPORT_MAX_FIELD, browserName, bugReportBody, bugReportUrl, screenFacts, type BugReportContext } from './bugReportLink';

const context: BugReportContext = {
  screen: 'practice', pieceId: 'little-steps', section: { first: 3, last: 4 }, page: 'http://127.0.0.1:4173/?device=virtual', devServer: false, language: 'et',
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.55 Safari/537.36',
  window: { width: 1536, height: 864 },
};

describe('bug report link (ft_1_16)', () => {
  it('ft_1_16.AC1 opens a new issue on the repository with the title, the bug label and the screen filled in', () => {
    const url = new URL(bugReportUrl(context));
    expect(url.origin + url.pathname).toBe('https://github.com/inq-OS/pianor/issues/new');
    expect(url.searchParams.get('title')).toBe('Bug: practice (little-steps)');
    expect(url.searchParams.get('labels')).toBe('bug');
    const body = url.searchParams.get('body')!;
    expect(body).toBe(bugReportBody(context));
    for (const line of ['- Screen: `practice`', '- Piece: `little-steps`', '- Section: bars 3 to 4', '- Page: `http://127.0.0.1:4173/?device=virtual`', '- Build: production build', '- Language: et', '- Window: 1536 x 864', '- Browser: Chrome 141']) {
      expect(body).toContain(line);
    }
    expect(body).toContain('## What happened');
  });

  it('ft_1_16.AC2 names the browser and its major version only: no time of the press, no system, no full version', () => {
    const body = bugReportBody(context);
    expect(body).not.toContain('- Time:');
    expect(body).not.toContain('Windows');
    expect(body).not.toContain('7390');
    expect(browserName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.3537.71')).toBe('Edge 141');
    expect(browserName('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')).toBe('Firefox 140');
    expect(browserName('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 OPR/90.1.2')).toBe('Opera 90');
    expect(browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15')).toBe('Safari 18');
    expect(browserName('TestBrowser/1.0')).toBe('unknown');
  });

  it('ft_1_16.AC2 says only what the screen showed: no piece or section lines without them, and long values are cut', () => {
    const noPiece: BugReportContext = { ...context };
    delete noPiece.pieceId;
    delete noPiece.section;
    const bare = bugReportBody({ ...noPiece, devServer: true });
    expect(bare).not.toContain('- Piece:');
    expect(bare).not.toContain('- Section:');
    expect(bare).toContain('- Build: dev server');
    expect(new URL(bugReportUrl(noPiece)).searchParams.get('title')).toBe('Bug: practice');
    const long = bugReportBody({ ...context, page: 'x'.repeat(BUG_REPORT_MAX_FIELD + 50) });
    expect(long).toContain(`${'x'.repeat(BUG_REPORT_MAX_FIELD)}…`);
    expect(long).not.toContain('x'.repeat(BUG_REPORT_MAX_FIELD + 1));
  });

  it('ft_1_16.AC2 takes only a piece id and a section from the screen data, nothing else', () => {
    expect(screenFacts(undefined)).toEqual({});
    expect(screenFacts('practice')).toEqual({});
    expect(screenFacts({ chartId: 'a', section: { first: 1, last: 2 }, name: 'Mari', xp: 40 })).toEqual({ pieceId: 'a', section: { first: 1, last: 2 } });
    expect(screenFacts({ chart: { id: 'own-1', title: 'secret' } })).toEqual({ pieceId: 'own-1' });
    expect(screenFacts({ chart: null, section: { first: 1.5, last: 2 } })).toEqual({});
    expect(screenFacts({ chartId: 5, chart: { id: 3 } })).toEqual({});
  });

  it('uses another repository when given one', () => {
    expect(bugReportUrl(context, 'someone/else')).toMatch(/^https:\/\/github\.com\/someone\/else\/issues\/new\?/);
  });
});
