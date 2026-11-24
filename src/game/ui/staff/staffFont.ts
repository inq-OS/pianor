/**
 * The font of the text on and around the staff (note names, fingers, dynamics, section letters, the piece maker's ghost
 * letter): JetBrains Mono Bold, shipped with the game (SIL OFL, `public/assets/jetbrains-mono/`), so no computer draws it in
 * a font of its own (d288). Every other text is the pixel font. `monospace` is only the fallback while nothing has loaded.
 */
export const STAFF_FONT = '"Pianor Mono", monospace';

const FAMILY = 'Pianor Mono';
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
// Š and Ž of Estonian and the rest of Latin Extended
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/** The font files and how each is used: upright and italic (the dynamics), each split into Latin and Latin Extended. */
export function staffFontFaces(base: string): { url: string; style: 'normal' | 'italic'; unicodeRange: string }[] {
  return (['normal', 'italic'] as const).flatMap((style) => [
    { url: `${base}assets/jetbrains-mono/jetbrains-mono-latin-700-${style}.woff2`, style, unicodeRange: LATIN },
    { url: `${base}assets/jetbrains-mono/jetbrains-mono-latin-ext-700-${style}.woff2`, style, unicodeRange: LATIN_EXT },
  ]);
}

/**
 * Load the staff font before the game draws anything, so no screen first shows the computer's own monospace font (a
 * Phaser text is drawn once, when it is made). A file that fails to load leaves the fallback and the game starts anyway.
 */
export async function loadStaffFont(base = import.meta.env.BASE_URL): Promise<void> {
  await Promise.all(
    staffFontFaces(base).map(async ({ url, style, unicodeRange }) => {
      try {
        const face = new FontFace(FAMILY, `url(${url}) format('woff2')`, { weight: '700', style, unicodeRange });
        document.fonts.add(await face.load());
      } catch (error) {
        console.warn(`staff font not loaded: ${url}`, error);
      }
    }),
  );
}
