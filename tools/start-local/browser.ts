import { posix, win32 } from 'node:path';

/**
 * Which browser `npm run start:local` opens, and how (d105): Pianor as its own window, with no tabs or bookmarks.
 * Edge first (it is on every Windows PC), else Chrome (both have Web MIDI), in app mode and full screen, with a browser
 * profile of its own, so the game never opens inside the normal browser profile. The saves live in that profile.
 */

/** The browser's own flags: app mode on the game's address, full screen, and Pianor's own profile folder. */
export function appWindowArgs(url: string, profileDir: string): string[] {
  return [`--app=${url}`, '--start-fullscreen', `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check'];
}

/**
 * Pianor's own browser profile: a fixed folder outside the repository (a clean checkout or a new clone keeps the saves),
 * `%LOCALAPPDATA%\Pianor\browser` on Windows and `~/.local/share/pianor/browser` elsewhere.
 */
export function profileDir(platform: string, env: Record<string, string | undefined>, home: string): string {
  // joined by the target platform's rules, not the host's: the same answer on the Windows CI runner as on Linux
  if (platform === 'win32') return win32.join(env.LOCALAPPDATA ?? win32.join(home, 'AppData', 'Local'), 'Pianor', 'browser');
  return posix.join(env.XDG_DATA_HOME ?? posix.join(home, '.local', 'share'), 'pianor', 'browser');
}

/**
 * The programs to try, in order: full paths where the browser has a fixed place (Windows, macOS), names on the PATH on
 * Linux. `env` is the process environment (Windows keeps the install folders in it).
 */
export function browserCandidates(platform: string, env: Record<string, string | undefined>): string[] {
  if (platform === 'win32') {
    const roots = [env['PROGRAMFILES(X86)'], env.PROGRAMFILES, env.LOCALAPPDATA].filter((r): r is string => !!r);
    const apps = ['Microsoft\\Edge\\Application\\msedge.exe', 'Google\\Chrome\\Application\\chrome.exe'];
    return apps.flatMap((app) => roots.map((root) => `${root}\\${app}`));
  }
  if (platform === 'darwin') {
    return ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  }
  return ['microsoft-edge', 'microsoft-edge-stable', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
}

/** Whether a candidate is a full path (checked on disk before it is started) rather than a name looked up on the PATH. */
export function isPath(candidate: string): boolean {
  return candidate.includes('/') || candidate.includes('\\');
}
