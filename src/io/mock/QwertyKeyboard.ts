import type { NoteEvent } from '../../core/judge/types';
import { Emitter } from '../emitter';
import type { KeyboardInput, KeyboardStatus, Unsubscribe } from '../keyboard';
import { EZ220_HIGH, EZ220_LOW } from '../ez220';

/** Offsets in semitones above the base key, by physical key (`KeyboardEvent.code`), so it works on any layout. */
export const QWERTY_OFFSETS: Readonly<Record<string, number>> = {
  // lower row: white keys z x c v b n m, black keys s d g h j
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
  Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
  // upper row: an octave higher
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23,
  KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
};

export interface KeyLike {
  code: string;
  repeat: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: unknown;
  preventDefault?(): void;
}

/** What `QwertyKeyboard` needs from `window`: tests pass a fake. */
export interface KeyTarget {
  addEventListener(type: string, listener: (event: KeyLike) => void): void;
  removeEventListener(type: string, listener: (event: KeyLike) => void): void;
}

export interface QwertyOptions {
  /** MIDI note of the Z key. Default 60 (middle C), so Z..B plays C4..G4. */
  baseMidi?: number;
  now?: () => number;
}

function isTypingTarget(target: unknown): boolean {
  const t = target as { tagName?: string; isContentEditable?: boolean } | null | undefined;
  const tag = t?.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable === true;
}

/**
 * The computer keyboard as a piano: two rows (Z.. and Q..), Left/Right arrows shift an octave.
 * Auto-repeat is filtered (a held key is one press, as the judge expects). Keys held when the octave shifts
 * or the window loses focus are released properly.
 */
export class QwertyKeyboard implements KeyboardInput {
  readonly id = 'qwerty';

  private readonly notes = new Emitter<NoteEvent>();
  private readonly statuses = new Emitter<KeyboardStatus>();
  private readonly down = new Map<string, number>(); // key code -> midi it started
  private baseMidi: number;
  private readonly now: () => number;

  private readonly onKeyDown = (e: KeyLike) => this.keyDown(e);
  private readonly onKeyUp = (e: KeyLike) => this.keyUp(e);
  private readonly onBlur = () => this.releaseAll();

  constructor(private readonly target: KeyTarget, options: QwertyOptions = {}) {
    this.baseMidi = options.baseMidi ?? 60;
    this.now = options.now ?? (() => performance.now());
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  get base(): number {
    return this.baseMidi;
  }

  getStatus(): KeyboardStatus {
    return { state: 'connected', name: 'Computer keyboard' };
  }

  onNote(listener: (event: NoteEvent) => void): Unsubscribe {
    return this.notes.on(listener);
  }

  onStatus(listener: (status: KeyboardStatus) => void): Unsubscribe {
    return this.statuses.on(listener);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.releaseAll();
    this.notes.clear();
    this.statuses.clear();
  }

  private emit(kind: 'on' | 'off', midi: number): void {
    this.notes.emit({ kind, midi, velocity: kind === 'on' ? 80 : 0, timeMs: this.now(), source: 'qwerty' });
  }

  private keyDown(e: KeyLike): void {
    if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      if (!e.repeat) this.shiftOctave(e.code === 'ArrowRight' ? 12 : -12);
      e.preventDefault?.();
      return;
    }
    const offset = QWERTY_OFFSETS[e.code];
    if (offset === undefined) return;
    e.preventDefault?.();
    if (e.repeat || this.down.has(e.code)) return;
    const midi = this.baseMidi + offset;
    if (midi < EZ220_LOW || midi > EZ220_HIGH) return;
    this.down.set(e.code, midi);
    this.emit('on', midi);
  }

  private keyUp(e: KeyLike): void {
    const midi = this.down.get(e.code);
    if (midi === undefined) return;
    this.down.delete(e.code);
    this.emit('off', midi);
  }

  private shiftOctave(delta: number): void {
    const next = this.baseMidi + delta;
    // Keep Z inside the keyboard and the top of the upper row (base + 28) at most one octave past the top.
    if (next < EZ220_LOW || next > EZ220_HIGH - 12) return;
    this.releaseAll();
    this.baseMidi = next;
  }

  private releaseAll(): void {
    for (const [code, midi] of [...this.down]) {
      this.down.delete(code);
      this.emit('off', midi);
    }
  }
}
