/**
 * The one screen every end-to-end test runs at (d105): the 1920x1080 full screen at Windows 125% scaling, which
 * Chrome sees as 1536x864 CSS pixels at `devicePixelRatio` 1.25. Smaller windows show only the size guard (one test).
 */
export const TARGET_VIEW = { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 } as const;

/**
 * Whether the test browser draws on a real GPU: on Windows outside CI, unless `E2E_GPU=0`. Elsewhere (cloud sessions, Linux
 * CI) Chrome draws WebGL in software (SwiftShader) and the tests open the game with `?loop=timer` (`openGame`, src/config.ts).
 */
export const E2E_GPU = process.platform === 'win32' && !process.env.CI && process.env.E2E_GPU !== '0';
