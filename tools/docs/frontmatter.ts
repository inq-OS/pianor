/**
 * Front matter for the docs: a block of `key: value` lines between two `---` lines at the top of a markdown file.
 * Every value is JSON (a quoted string, a number, or a flow array of them), so the block is also valid YAML and renders
 * as a table on GitHub, but no YAML parser is needed (see docs/decisions/workflow.md#d041).
 */

export type FrontMatter =
  | { kind: 'none'; body: string }
  | { kind: 'ok'; data: Record<string, unknown>; body: string }
  | { kind: 'error'; message: string; body: string };

const FENCE = '---';

/** The line ending the text uses, so a rewrite keeps the file's style (Windows checkouts are CRLF). */
export function detectEol(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function parseFrontMatter(raw: string): FrontMatter {
  const text = normalizeEol(raw);
  if (!text.startsWith(FENCE + '\n')) return { kind: 'none', body: text };
  const end = text.indexOf('\n' + FENCE + '\n', FENCE.length);
  if (end === -1) return { kind: 'error', message: 'front matter is not closed by a --- line', body: text };
  const block = text.slice(FENCE.length + 1, end);
  const body = text.slice(end + FENCE.length + 2);
  const data: Record<string, unknown> = {};
  for (const [index, line] of block.split('\n').entries()) {
    if (line.trim() === '') continue;
    const match = /^([a-z_]+): (.+)$/.exec(line);
    if (!match) return { kind: 'error', message: `front matter line ${index + 1} is not "key: value": ${line}`, body };
    const key = match[1] as string;
    if (key in data) return { kind: 'error', message: `front matter key "${key}" appears twice`, body };
    try {
      data[key] = JSON.parse(match[2] as string);
    } catch {
      return { kind: 'error', message: `front matter value of "${key}" is not JSON (quote strings with ")`, body };
    }
  }
  return { kind: 'ok', data, body };
}

export function serializeFrontMatter(data: Record<string, unknown>): string {
  const lines = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return [FENCE, ...lines, FENCE, ''].join('\n');
}

/** The text with its front matter replaced (or added); the body and the line ending stay as they were. */
export function withFrontMatter(raw: string, data: Record<string, unknown>): string {
  const eol = detectEol(raw);
  const { body } = parseFrontMatter(raw);
  const text = serializeFrontMatter(data) + body;
  return eol === '\n' ? text : text.replace(/\n/g, eol);
}
