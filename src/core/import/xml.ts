/**
 * A small XML reader for score files (ft_Y_04): elements, attributes, text, CDATA and the five named and numeric
 * entities; the prolog, comments, processing instructions and the DOCTYPE are skipped. No namespaces, no DTD entities, no
 * validation: enough for MusicXML, written by hand so the core needs neither the DOM nor a dependency. Pure.
 */

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export type XmlNode = XmlElement | string;

const NAMED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Replace entities; an unknown one is kept as written. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body] ?? whole;
  });
}

export class XmlError extends Error {}

const NAME_END = /[\s/>]/;
const ATTR = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

/** One pass over the text; each kind of markup has its own small reader. */
class XmlReader {
  private readonly stack: XmlElement[] = [];
  private root: XmlElement | null = null;
  private i = 0;

  constructor(private readonly text: string) {}

  private fail(message: string, pos: number): never {
    throw new XmlError(`${message} (line ${this.text.slice(0, pos).split('\n').length})`);
  }

  private get open(): XmlElement | undefined {
    return this.stack[this.stack.length - 1];
  }

  private skipPast(end: string, from: number): number {
    const at = this.text.indexOf(end, from);
    if (at < 0) this.fail(`no closing ${end}`, from);
    return at + end.length;
  }

  /** A DOCTYPE, with an internal subset in brackets when there is one. */
  private skipDeclaration(lt: number): number {
    let depth = 0;
    for (let j = lt + 2; j < this.text.length; j++) {
      const c = this.text[j];
      if (c === '[') depth++;
      else if (c === ']') depth--;
      else if (c === '>' && depth <= 0) return j + 1;
    }
    return this.fail('no closing > for <!', lt);
  }

  private cdata(lt: number): number {
    const end = this.text.indexOf(']]>', lt);
    if (end < 0) this.fail('no closing ]]>', lt);
    this.open?.children.push(this.text.slice(lt + 9, end));
    return end + 3;
  }

  private closeTag(lt: number): number {
    const gt = this.text.indexOf('>', lt);
    if (gt < 0) this.fail('no closing >', lt);
    const name = this.text.slice(lt + 2, gt).trim();
    const open = this.stack.pop();
    if (!open || open.name !== name) this.fail(`</${name}> closes ${open ? `<${open.name}>` : 'nothing'}`, lt);
    return gt + 1;
  }

  /** Where a start tag ends, outside quoted attribute values. */
  private tagEnd(lt: number): number {
    let quote = '';
    for (let j = lt + 1; j < this.text.length; j++) {
      const c = this.text[j]!;
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') return j;
    }
    return this.fail('no closing >', lt);
  }

  private startTag(lt: number): number {
    const j = this.tagEnd(lt);
    const selfClosing = this.text[j - 1] === '/';
    const inner = this.text.slice(lt + 1, selfClosing ? j - 1 : j);
    const nameEnd = inner.search(NAME_END);
    const name = nameEnd < 0 ? inner : inner.slice(0, nameEnd);
    if (!name) this.fail('a tag with no name', lt);
    const attrs: Record<string, string> = {};
    for (const m of inner.slice(name.length).matchAll(ATTR)) attrs[m[1]!] = decodeEntities(m[3] ?? m[4] ?? '');
    const element: XmlElement = { name, attrs, children: [] };
    if (this.open) this.open.children.push(element);
    else if (this.root) this.fail('a second root element', lt);
    else this.root = element;
    if (!selfClosing) this.stack.push(element);
    return j + 1;
  }

  private markup(lt: number): number {
    const t = this.text;
    if (t.startsWith('<!--', lt)) return this.skipPast('-->', lt + 4);
    if (t.startsWith('<![CDATA[', lt)) return this.cdata(lt);
    if (t.startsWith('<?', lt)) return this.skipPast('?>', lt + 2);
    if (t.startsWith('<!', lt)) return this.skipDeclaration(lt);
    if (t[lt + 1] === '/') return this.closeTag(lt);
    return this.startTag(lt);
  }

  read(): XmlElement {
    const t = this.text;
    while (this.i < t.length) {
      const lt = t.indexOf('<', this.i);
      const textEnd = lt < 0 ? t.length : lt;
      if (textEnd > this.i && this.open) {
        const raw = t.slice(this.i, textEnd);
        if (raw.trim() !== '') this.open.children.push(decodeEntities(raw));
      }
      if (lt < 0) break;
      this.i = this.markup(lt);
    }
    if (this.open) this.fail(`<${this.open.name}> is never closed`, t.length);
    if (!this.root) throw new XmlError('no root element');
    return this.root;
  }
}

/** Parse a document; the root element, or an `XmlError` saying where it broke. */
export function parseXml(text: string): XmlElement {
  return new XmlReader(text).read();
}

/** The student elements, all or by name. */
export function childrenOf(el: XmlElement, name?: string): XmlElement[] {
  return el.children.filter((c): c is XmlElement => typeof c !== 'string' && (name === undefined || c.name === name));
}

/** The first child element of that name. */
export function child(el: XmlElement | undefined, name: string): XmlElement | undefined {
  if (!el) return undefined;
  for (const c of el.children) if (typeof c !== 'string' && c.name === name) return c;
  return undefined;
}

/** The text inside, joined and trimmed. */
export function textOf(el: XmlElement | undefined): string {
  if (!el) return '';
  return el.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('').trim();
}

/** Follow a path of child names: `childAt(note, 'pitch', 'step')`. */
export function childAt(el: XmlElement | undefined, ...path: string[]): XmlElement | undefined {
  return path.reduce<XmlElement | undefined>((at, name) => child(at, name), el);
}

/** Every element of that name at any depth below. */
export function descendants(el: XmlElement, name: string): XmlElement[] {
  const out: XmlElement[] = [];
  const walk = (e: XmlElement) => {
    for (const c of e.children) {
      if (typeof c === 'string') continue;
      if (c.name === name) out.push(c);
      walk(c);
    }
  };
  walk(el);
  return out;
}
