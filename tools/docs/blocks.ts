/**
 * Generated blocks inside a markdown file: `<!-- docs:NAME ARGS -->` ... `<!-- /docs:NAME -->`. Everything between the
 * two lines is replaced by what the renderer for NAME returns; the text around them is written by hand.
 */

const OPEN = /^<!-- docs:([a-z-]+)((?: [^>]*?)?) -->$/;

export type BlockRenderer = (name: string, args: string[]) => string | { error: string };

export interface Expanded {
  text: string;
  errors: string[];
}

const argsOf = (raw: string): string[] => raw.split(/\s+/).filter(Boolean);

/** Expands every block in the text. `file` is only used in error messages. Line endings are kept as they are. */
export function expandBlocks(raw: string, file: string, render: BlockRenderer): Expanded {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  const errors: string[] = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const open = fenced ? null : OPEN.exec(line);
    if (!open) {
      out.push(line);
      continue;
    }
    const name = open[1] as string;
    const close = `<!-- /docs:${name} -->`;
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j] === close) {
        end = j;
        break;
      }
      if (OPEN.test(lines[j] as string)) break;
    }
    if (end === -1) {
      errors.push(`${file}:${i + 1}: block "${name}" has no closing ${close}`);
      out.push(line);
      continue;
    }
    const result = render(name, argsOf(open[2] as string));
    if (typeof result !== 'string') {
      errors.push(`${file}:${i + 1}: ${result.error}`);
      out.push(...lines.slice(i, end + 1));
    } else {
      out.push(line, ...result.split('\n'), close);
    }
    i = end;
  }
  return { text: out.join('\n').replace(/\n/g, eol), errors };
}

/** The names and arguments of the blocks in a text (for checking that every index has its block). */
export function listBlocks(text: string): { name: string; args: string[] }[] {
  const found: { name: string; args: string[] }[] = [];
  let fenced = false;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const open = fenced ? null : OPEN.exec(line);
    if (open) found.push({ name: open[1] as string, args: argsOf(open[2] as string) });
  }
  return found;
}
