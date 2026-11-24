/**
 * The board of what waits on the maintainer: every `NEEDS-HUMAN:` list item in `docs/` and `projects/`, grouped by what
 * it needs (outside access first, then the keyboard, a piece verdict, a student, a reader of Estonian, the tablet, the
 * laptop), as one page a thread publishes as a private Artifact (`docs/automation/todo-tags.md`). The docs stay the only
 * place a tag lives; the board is regenerated from them.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface HumanItem {
  /** The file, relative to the repository root, with `/` between folders. */
  file: string;
  line: number;
  text: string;
  group: GroupId;
}

export type GroupId = (typeof GROUPS)[number]['id'];

/** First match wins, so the order is the order of the board. */
export const GROUPS = [
  { id: 'outside', title: 'Waiting on outside access', needs: 'files, photographs or answers from outside the project', match: /\bCIPI\b|zenodo|photographs? of|request the/i },
  { id: 'keyboard', title: 'On the EZ-220', needs: 'the real keyboard attached', match: /EZ-220|real keyboard|on the keyboard/i },
  { id: 'pieces', title: 'Pieces to approve', needs: 'a verdict in the piece preview or on the review board', match: /\bapprove|"approved"/i },
  { id: 'student', title: 'With the student', needs: 'a try-out with the student', match: /\bstudent\b|playtest|try-out/i },
  { id: 'estonian', title: 'Estonian to read', needs: 'a native reader of Estonian', match: /Estonian|native/i },
  { id: 'tablet', title: 'On the tablet', needs: 'the Android tablet', match: /tablet/i },
  { id: 'laptop', title: 'On the laptop', needs: 'a look or a try on the target laptop', match: /Windows|laptop|\blook\b|mouse|baseline|real display/i },
  { id: 'other', title: 'Other answers', needs: 'a word from the maintainer', match: /[\s\S]/ },
] as const;

const TAG = /^\s*[-*]\s+NEEDS-HUMAN:\s*(.+)$/;

/** The group of one item's text. */
export function groupOf(text: string): GroupId {
  return GROUPS.find((g) => g.match.test(text))!.id;
}

/** The items of one Markdown file; only list items that start with the tag count, not a mention of it in prose or an example in a code fence. */
export function itemsOf(file: string, markdown: string): HumanItem[] {
  let fenced = false;
  return markdown.split('\n').flatMap((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const m = fenced ? null : TAG.exec(line);
    return m ? [{ file, line: i + 1, text: m[1]!.trim(), group: groupOf(m[1]!) }] : [];
  });
}

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

/** Every item under the given folders of the repository at `root`, in file and line order. */
export function collectItems(root: string, dirs: readonly string[] = ['docs', 'projects']): HumanItem[] {
  return dirs
    .flatMap((d) => markdownFiles(join(root, d)))
    .map((path) => relative(root, path).split('\\').join('/'))
    .sort()
    .flatMap((file) => itemsOf(file, readFileSync(join(root, file), 'utf-8')));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Inline code and links of a tag line, the rest as text. */
const inline = (s: string) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

/** The board page: a section per group that has items, each item with a link to its line on GitHub. */
export function renderHumanBoard(items: readonly HumanItem[], repoUrl: string, ref = 'main'): string {
  const sections = GROUPS.map((g) => ({ g, list: items.filter((i) => i.group === g.id) })).filter((s) => s.list.length > 0);
  const nav = sections.map(({ g, list }) => `<a class="chip" href="#${g.id}">${esc(g.title)} <b>${list.length}</b></a>`).join('');
  const body = sections
    .map(
      ({ g, list }) => `<section id="${g.id}">
  <h2>${esc(g.title)} <span class="count">${list.length}</span></h2>
  <p class="needs">Needs ${esc(g.needs)}.</p>
  <ul>${list
    .map(
      (i) => `
    <li><p>${inline(i.text)}</p><a class="src" href="${esc(`${repoUrl}/blob/${ref}/${i.file}#L${i.line}`)}" target="_blank" rel="noopener">${esc(i.file)}:${i.line}</a></li>`,
    )
    .join('')}
  </ul>
</section>`,
    )
    .join('\n');
  return `<title>Pianor waiting list</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* One column of groups, outside blockers first; a chip row to jump. */
:root { --bg: #f6f5f1; --card: #ffffff; --fg: #23241f; --muted: #6b6c63; --line: #dddcd3; --accent: #2f6b4f; --code: #eeede6; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #181a17; --card: #21241f; --fg: #e9e9e2; --muted: #a2a499; --line: #34372f; --accent: #7fc39f; --code: #2b2f28; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #181a17; --card: #21241f; --fg: #e9e9e2; --muted: #a2a499; --line: #34372f; --accent: #7fc39f; --code: #2b2f28; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; padding-block: 24px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 720px; margin: 0 auto; display: grid; gap: 28px; }
h1 { font-size: 1.5rem; margin: 0; text-wrap: balance; }
.lead { color: var(--muted); margin: 6px 0 0; }
nav { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; color: var(--fg); text-decoration: none; background: var(--card); font-size: 0.9rem; }
.chip b { color: var(--accent); font-variant-numeric: tabular-nums; }
h2 { font-size: 1.1rem; margin: 0; display: flex; gap: 8px; align-items: baseline; }
.count { color: var(--accent); font-variant-numeric: tabular-nums; }
.needs { color: var(--muted); margin: 2px 0 10px; font-size: 0.9rem; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; min-width: 0; }
li p { margin: 0 0 4px; overflow-wrap: anywhere; }
code { background: var(--code); border-radius: 4px; padding: 0 4px; font-size: 0.88em; }
.src { color: var(--muted); font-size: 0.8rem; font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
<main>
<header>
  <h1>Waiting on you</h1>
  <p class="lead">${items.length} item(s) only you can answer, from the NEEDS-HUMAN tags in the docs on ${esc(ref)}. Tell a thread when one is done; it removes the tag and the board shrinks.</p>
</header>
<nav>${nav}</nav>
${body}
</main>
`;
}
