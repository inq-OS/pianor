/** Just enough of the DOM for unit tests of DOM-built inputs (the on-screen keyboard), so they run in Node without jsdom. */
export class FakeElement {
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, ((e: unknown) => void)[]>();
  parent: FakeElement | null = null;
  textContent = '';
  constructor(readonly ownerDocument: { createElement: () => FakeElement }) {}
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  appendChild(child: FakeElement) { child.parent = this; this.children.push(child); return child; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  addEventListener(type: string, listener: (e: unknown) => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  closest(selector: string): FakeElement | null {
    const name = /^\[(.+)\]$/.exec(selector)?.[1]; // only "[attribute]" selectors
    if (name === undefined) return null;
    return this.attributes.has(name) ? this : (this.parent?.closest(selector) ?? null);
  }

  /** Call the listeners of `type` on this element with `event`. */
  dispatch(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

export function fakeDocument(): { createElement: () => FakeElement } {
  const doc = { createElement: (): FakeElement => new FakeElement(doc) };
  return doc;
}
