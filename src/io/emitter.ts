import type { Unsubscribe } from './keyboard';

/** Tiny typed event emitter. Listener errors are isolated so one bad listener cannot break key input. */
export class Emitter<T> {
  private listeners = new Set<(value: T) => void>();

  on(listener: (value: T) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(value);
      } catch (error) {
        console.error('keyboard listener failed', error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
