/**
 * Moving a text file in and out of the browser: the download of a file the game made, and the picker for a file the
 * player chooses. The only place that touches Blob, object URLs and file inputs (own piece files, ft_1_02b).
 */
import type { TextFiles } from '../files';

/** Offer `text` as a download named `name`. */
export function downloadTextFile(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The picker: a hidden file input clicked; what `read` makes of the chosen file, or null when nothing was chosen or it cannot be read. */
function pickWith<T>(options: { accept: string; id: string }, read: (file: File) => Promise<T>): Promise<T | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = options.id;
    input.accept = options.accept;
    input.style.display = 'none';
    const done = (value: T | null) => {
      input.remove();
      resolve(value);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      read(file).then(done).catch(() => done(null));
    });
    input.addEventListener('cancel', () => done(null));
    document.body.append(input);
    input.click();
  });
}

/**
 * Let the player choose a text file and read it: its text, or null when nothing was chosen. Must be called straight from a
 * click (a browser opens the picker only then), so call it before any `await`. `id` marks the file input for tests, which
 * can then hand it a file.
 */
export function pickTextFile(options: { accept: string; id: string }): Promise<string | null> {
  return pickWith(options, (file) => file.text());
}

/** Like `pickTextFile`, for any file: its name and bytes (a photo of a sheet for the piece maker, ft_Y_04 slice 4). */
export function pickAnyFile(options: { accept: string; id: string }): Promise<{ name: string; bytes: Uint8Array } | null> {
  return pickWith(options, async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }));
}

/** The browser's file download and picker, as the game's `TextFiles`. Names are typed in the game's own picker, not here. */
export const browserTextFiles: TextFiles = { download: downloadTextFile, pick: pickTextFile, pickFile: pickAnyFile };
