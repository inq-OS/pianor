import { parseFrontMatter } from './frontmatter.ts';

/** One line of a markdown file with its line number (counted in the file, front matter included). */
export interface Line {
  n: number;
  text: string;
  /** Inside a fenced code block. */
  fenced: boolean;
  /** The line says `docs:ignore`: examples and deliberate history, skipped by every rule. */
  ignored: boolean;
}

export function linesOf(raw: string): Line[] {
  const text = raw.replace(/\r\n/g, '\n');
  const fm = parseFrontMatter(text);
  const skipped = fm.kind === 'ok' || fm.kind === 'error' ? text.length - fm.body.length : 0;
  const offset = text.slice(0, skipped).split('\n').length - 1;
  const lines: Line[] = [];
  let fenced = false;
  for (const [i, line] of fm.body.split('\n').entries()) {
    const fence = /^\s*(```|~~~)/.test(line);
    lines.push({ n: offset + i + 1, text: line, fenced: fenced || fence, ignored: line.includes('docs:ignore') });
    if (fence) fenced = !fenced;
  }
  return lines;
}

/** The text of a line without its inline code spans (they hold commands and paths, not links or prose). */
export const withoutCode = (text: string): string => text.replace(/`[^`]*`/g, '');

export const codeSpans = (text: string): string[] => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);

/** The anchor GitHub gives a heading. */
export function slug(heading: string): string {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');
}

export function anchorsOf(raw: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const line of linesOf(raw)) {
    if (line.fenced) continue;
    const m = /^#{1,6}\s+(.+?)\s*#*$/.exec(line.text);
    if (!m) continue;
    const base = slug(m[1] as string);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}
