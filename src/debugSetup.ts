import Phaser from 'phaser';
import { debugLog } from './core/debug/debugLog';
import { startDebugCapture } from './io/debug/debugCapture';
import { downloadTextFile } from './io/files/textFiles';
import type { KeyboardInput } from './io/keyboard';
import { C, css } from './game/ui/pixel/palette';

/** The screens that take typed text: a player's name or a password. Typed characters are logged as `*` while one is open. */
const TEXT_SCREENS = ['name', 'adminGate', 'adminPassword', 'teacherGate', 'teacherPassword'];

/**
 * The built-in debug log (ft_Y_15), for `?debug=1` only: called before the game starts so an error while it starts is in the
 * log, then `watch` follows the game's screens and keys. Without the switch nothing here runs: no listener, timer or button.
 */
export function startDebug() {
  let game: Phaser.Game | null = null;
  const capture = startDebugCapture({
    log: debugLog, target: window, storage: sessionStorageOrNull(),
    masking: () => game !== null && TEXT_SCREENS.some((key) => game!.scene.isActive(key)),
  });
  debugLog.log('page', `${window.location.href} ${import.meta.env.DEV ? 'dev server' : 'production build'} ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio} ${navigator.userAgent}`);
  addDownloadButton(() => capture.flush());
  return {
    /** Log each screen that starts (its key and the names of what it was given, never their values) and the keys played. */
    watch(started: Phaser.Game, keyboard: KeyboardInput): void {
      game = started;
      capture.follow(keyboard);
      const logStart = (scene: Phaser.Scene) => {
        const data = scene.sys.settings.data as Record<string, unknown> | undefined;
        const fields = data && typeof data === 'object' ? Object.keys(data) : [];
        debugLog.log('scene', `${scene.sys.settings.key}${fields.length ? ` {${fields.join(', ')}}` : ''}`);
      };
      // the scene manager starts the first screen on the same event, before this listener: that one is logged as running
      started.events.once(Phaser.Core.Events.READY, () => {
        for (const scene of started.scene.getScenes(false)) {
          if (scene.sys.isActive()) logStart(scene);
          scene.events.on(Phaser.Scenes.Events.START, () => logStart(scene));
        }
      });
    },
  };
}

function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** A small down-arrow button in the bottom-left corner, faded until the pointer is over it (clean UI rule: no text). */
function addDownloadButton(flush: () => void): void {
  const button = document.createElement('button');
  button.id = 'debug-log';
  button.type = 'button';
  button.setAttribute('aria-label', 'debug log');
  // a down arrow onto a line: "save"
  button.innerHTML = '<svg viewBox="0 0 8 8" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true"><path d="M3 0h2v3h2v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h2zM0 7h8v1h-8z" fill="currentColor"/></svg>';
  Object.assign(button.style, {
    position: 'fixed', left: '4px', bottom: '4px', zIndex: '9', width: '24px', height: '24px', padding: '3px', lineHeight: '0',
    border: `1px solid ${css(C.goldDark)}`, borderRadius: '2px', background: css(C.night), color: css(C.cream), opacity: '0.3', cursor: 'pointer',
  });
  button.addEventListener('pointerenter', () => (button.style.opacity = '1'));
  button.addEventListener('pointerleave', () => (button.style.opacity = '0.3'));
  button.addEventListener('click', () => {
    debugLog.log('download', 'debug log');
    flush();
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    downloadTextFile(`pianor-debug-${stamp}.txt`, `${debugLog.text()}\n`, 'text/plain');
  });
  document.body.appendChild(button);
}
