import type { NoteEvent } from '../../core/judge/types';
import { Emitter } from '../emitter';
import { EZ220_HIGH, EZ220_LOW } from '../ez220';
import type { KeyboardInput, KeyboardStatus, KeyLightOutput, Unsubscribe } from '../keyboard';
import { keyboardLayout, midiName } from './keyboardLayout';

export interface OnScreenKeyboardOptions {
  low?: number;
  high?: number;
  velocity?: number;
  now?: () => number;
}

/**
 * A clickable 61-key piano made of plain DOM elements (mouse, touch and pen), and a `KeyLightOutput` that
 * shows lit keys. It needs no hardware, so the game is playable and testable anywhere.
 * Styling is inline so it works without a stylesheet; `data-midi`, `data-lit` and `data-down` attributes
 * let tests and e2e checks find and inspect keys.
 */
export class OnScreenKeyboard implements KeyboardInput, KeyLightOutput {
  readonly id = 'on-screen';
  readonly supported = true;

  readonly element: HTMLDivElement;
  private readonly notes = new Emitter<NoteEvent>();
  private readonly statuses = new Emitter<KeyboardStatus>();
  private readonly keyEls = new Map<number, HTMLElement>();
  private readonly pointers = new Map<number, number>(); // pointer id -> midi
  private readonly now: () => number;
  private readonly velocity: number;
  private lit = new Set<number>();
  private disposed = false;

  constructor(parent: HTMLElement, options: OnScreenKeyboardOptions = {}) {
    const low = options.low ?? EZ220_LOW;
    const high = options.high ?? EZ220_HIGH;
    this.now = options.now ?? (() => performance.now());
    this.velocity = options.velocity ?? 80;

    const geometry = keyboardLayout(low, high);
    const doc = parent.ownerDocument;
    this.element = doc.createElement('div');
    this.element.setAttribute('data-testid', 'on-screen-keyboard');
    Object.assign(this.element.style, {
      position: 'relative', width: '100%', height: '140px', userSelect: 'none', touchAction: 'none', background: '#222',
    });

    for (const key of geometry.keys) {
      const el = doc.createElement('div');
      el.setAttribute('data-midi', String(key.midi));
      el.setAttribute('data-black', String(key.black));
      Object.assign(el.style, {
        position: 'absolute', top: '0', boxSizing: 'border-box', cursor: 'pointer',
        left: `${(key.x / geometry.whiteCount) * 100}%`, width: `${(key.width / geometry.whiteCount) * 100}%`,
        height: key.black ? '62%' : '100%', zIndex: key.black ? '2' : '1',
        border: '1px solid #222', borderRadius: '0 0 4px 4px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        font: '10px sans-serif', color: key.black ? '#ddd' : '#555', paddingBottom: '3px',
      });
      if (!key.black && key.midi % 12 === 0) el.textContent = midiName(key.midi);
      this.keyEls.set(key.midi, el);
      this.element.appendChild(el);
      this.paint(key.midi);
    }

    this.element.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.element.addEventListener('pointerup', (e) => this.onPointerEnd(e));
    this.element.addEventListener('pointercancel', (e) => this.onPointerEnd(e));
    this.element.addEventListener('pointerleave', (e) => this.onPointerEnd(e));
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
    parent.appendChild(this.element);
  }

  getStatus(): KeyboardStatus {
    return { state: 'connected', name: 'On-screen keyboard' };
  }

  onNote(listener: (event: NoteEvent) => void): Unsubscribe {
    return this.notes.on(listener);
  }

  onStatus(listener: (status: KeyboardStatus) => void): Unsubscribe {
    return this.statuses.on(listener);
  }

  setLitKeys(midis: readonly number[]): void {
    const before = this.lit;
    this.lit = new Set(midis);
    for (const midi of new Set([...before, ...this.lit])) this.paint(midi);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const midi of new Set(this.pointers.values())) this.emit('off', midi);
    this.pointers.clear();
    this.element.remove();
    this.notes.clear();
    this.statuses.clear();
  }

  private midiAt(e: PointerEvent): number | null {
    const target = (e.target as HTMLElement | null)?.closest?.('[data-midi]');
    const value = target?.getAttribute('data-midi');
    return value === null || value === undefined ? null : Number(value);
  }

  private onPointerDown(e: PointerEvent): void {
    const midi = this.midiAt(e);
    if (midi === null || this.pointers.has(e.pointerId)) return;
    e.preventDefault();
    const held = this.isHeld(midi); // a second finger on a key already down is not a second press, as on a real key
    this.pointers.set(e.pointerId, midi);
    this.paint(midi);
    if (!held) this.emit('on', midi);
  }

  private onPointerEnd(e: PointerEvent): void {
    const midi = this.pointers.get(e.pointerId);
    if (midi === undefined) return;
    this.pointers.delete(e.pointerId);
    this.paint(midi);
    if (!this.isHeld(midi)) this.emit('off', midi);
  }

  private isHeld(midi: number): boolean {
    return [...this.pointers.values()].includes(midi);
  }

  private emit(kind: 'on' | 'off', midi: number): void {
    this.notes.emit({ kind, midi, velocity: kind === 'on' ? this.velocity : 0, timeMs: this.now(), source: 'on-screen' });
  }

  private paint(midi: number): void {
    const el = this.keyEls.get(midi);
    if (!el) return;
    const black = el.getAttribute('data-black') === 'true';
    const down = this.isHeld(midi);
    const lit = this.lit.has(midi);
    el.setAttribute('data-lit', String(lit));
    el.setAttribute('data-down', String(down));
    el.style.background = down ? '#6aa8ff' : lit ? '#ffd23f' : black ? '#111' : '#fdfdfd';
  }
}
