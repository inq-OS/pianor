import { describe, expect, it } from 'vitest';
import { appWindowArgs, browserCandidates, isPath, profileDir } from './browser';

describe('the browser of start:local (d105)', () => {
  it('opens the game as its own full-screen app window with its own profile', () => {
    expect(appWindowArgs('http://127.0.0.1:4173/', '/p')).toEqual([
      '--app=http://127.0.0.1:4173/', '--start-fullscreen', '--user-data-dir=/p', '--no-first-run', '--no-default-browser-check',
    ]);
  });

  it('keeps the profile in a fixed folder outside the repository', () => {
    expect(profileDir('win32', { LOCALAPPDATA: 'C:\\L' }, 'C:\\Users\\player')).toMatch(/^C:\\L.Pianor.browser$/);
    expect(profileDir('win32', {}, 'C:\\Users\\player')).toContain('AppData');
    expect(profileDir('linux', {}, '/home/player')).toBe('/home/player/.local/share/pianor/browser');
    expect(profileDir('linux', { XDG_DATA_HOME: '/x' }, '/home/player')).toBe('/x/pianor/browser');
  });

  it('tries Edge before Chrome in the Windows install folders, skipping folders the environment does not name', () => {
    const env = { PROGRAMFILES: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\player\\AppData\\Local' };
    expect(browserCandidates('win32', env)).toEqual([
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Users\\player\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Users\\player\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    ]);
  });

  it('uses the app bundles on macOS and names on the PATH on Linux, Edge first', () => {
    expect(browserCandidates('darwin', {})[0]).toBe('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
    expect(browserCandidates('darwin', {}).every(isPath)).toBe(true);
    const linux = browserCandidates('linux', {});
    expect(linux[0]).toBe('microsoft-edge');
    expect(linux.some(isPath)).toBe(false);
    expect(isPath('C:\\Program Files\\x.exe')).toBe(true);
  });
});
