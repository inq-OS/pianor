/**
 * File interface the game may depend on (`src/game` imports only this file from `src/io` for files): a text file out to
 * the player's device and one back in. The browser implementation is `io/files/textFiles.ts`.
 */
export interface TextFiles {
  /** Offer `text` as a download named `name`. */
  download(name: string, text: string, type?: string): void;
  /**
   * Let the player choose a text file and read it: its text, or null when nothing was chosen. Must be called straight
   * from a click (a browser opens the picker only then), so call it before any `await`. `id` marks the file input for tests.
   */
  pick(options: { accept: string; id: string }): Promise<string | null>;
  /** Like `pick`, for any file (a photo): its name and bytes, or null. */
  pickFile(options: { accept: string; id: string }): Promise<{ name: string; bytes: Uint8Array } | null>;
}
