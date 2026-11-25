import type Phaser from 'phaser';
import { C, css } from './pixel/palette';

/** Where the field lies, in art pixels of the scene's root, and how the root sits on the canvas. */
export interface FieldPlace {
  scene: Phaser.Scene;
  root: { x: number; y: number };
  /** Screen pixels per art pixel. */
  scale: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextFieldOptions {
  value: string;
  /** Read out by a screen reader, and shown while the field is empty. */
  label: string;
  maxLength: number;
  /** Enter: the text typed (trimmed). The field is taken away first. */
  onDone: (value: string) => void;
  /** Esc, or the screen leaving: nothing is kept. */
  onCancel: () => void;
}

/**
 * A text field for a title or a name (a song's, a part's, ft_1_36 rule 12), laid over the place it names in the game's
 * ink on paper, focused at once with its text selected so typing replaces it. Enter keeps what was typed, Esc keeps
 * nothing; the field goes when the scene shuts down. Returns a function that takes the field away.
 */
export function openTextField(place: FieldPlace, options: TextFieldOptions): () => void {
  const { scene } = place;
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'text-field';
  input.maxLength = options.maxLength;
  input.value = options.value;
  input.placeholder = options.label;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', options.label);
  input.setAttribute('enterkeyhint', 'done');
  const lay = () => {
    const rect = scene.game.canvas.getBoundingClientRect();
    const zoom = rect.width / scene.scale.width;
    const at = (v: number, origin: number) => (origin + v * place.scale) * zoom;
    const height = place.h * place.scale * zoom;
    // 16px at least, so a tablet does not zoom in on focus
    input.style.cssText = `position:absolute;left:${rect.left + window.scrollX + at(place.x, place.root.x)}px;top:${rect.top + window.scrollY + at(place.y, place.root.y)}px;`
      + `width:${place.w * place.scale * zoom}px;height:${height}px;box-sizing:border-box;font:${Math.max(16, Math.min(28, Math.round(height * 0.6)))}px monospace;`
      + `border:2px solid ${css(C.redDark)};border-radius:3px;background:${css(C.white)};color:${css(C.ink)};padding:0 6px;z-index:5`;
  };
  lay();
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    window.removeEventListener('resize', lay);
    input.remove();
  };
  input.addEventListener('keydown', (e) => {
    // the field's own keys: no key reaches the screen or the computer-keyboard piano while it is open
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value.trim().replace(/\s+/g, ' ');
      close();
      options.onDone(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
      options.onCancel();
    }
  });
  window.addEventListener('resize', lay);
  scene.events.once('shutdown', () => {
    if (open) {
      close();
      options.onCancel();
    }
  });
  document.body.append(input);
  input.focus({ preventScroll: true });
  input.select();
  return close;
}
