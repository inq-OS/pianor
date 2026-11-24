import type Phaser from 'phaser';
import keriJson from '../../../content/world/keri.json';
import { isTester, openScenes } from '../../core/world/openScenes';
import { t } from '../../core/text/strings';
import { VISIT, nextVisit } from '../../core/visit/islandVisit';
import { loadWorld, type World } from '../../core/world/world';
import { contextOf } from '../context';
import { startScene } from '../scenes';

/** The island as shipped (content/world/keri.json, d108), validated once. */
const KERI: World = loadWorld(keriJson);

/**
 * Every scene of the world model that has a screen, and its name: the map's buttons (ft_1_19.AC2) and the screensaver's
 * round (ft_1_17.AC4). A scene without one is painted on the map but is no button and is not visited.
 */
/** The scenes of Keri that have a screen, by their scene key. */
export type KeriScreen = 'knoll' | 'docks' | 'crossroads' | 'port' | 'terrace' | 'square';

export const SCENE_SCREENS: Readonly<Record<string, { scene: KeriScreen; label: () => string }>> = {
  knoll: { scene: 'knoll', label: () => t('map.scene.knoll') },
  docks: { scene: 'docks', label: () => t('map.scene.docks') },
  crossroads: { scene: 'crossroads', label: () => t('map.scene.crossroads') },
  port: { scene: 'port', label: () => t('map.scene.port') },
  terrace: { scene: 'terrace', label: () => t('map.scene.terrace') },
  square: { scene: 'square', label: () => t('map.scene.square') },
};

/** What a scene of Keri is started with: `visiting` when the screensaver shows it (ft_1_17.AC4). */
export interface VisitData {
  visiting?: boolean;
  /** Back from a wanderer's ask (ft_1_37.AC7): its scene hears the first whole play of `piece` after `since`. */
  wanderer?: { id: string; piece: string; since: string };
}

/** The scenes the student's level has opened that have a screen, in the world model's order. */
export function visitable(from: Phaser.Scene): string[] {
  const open = openScenes(KERI.scenes ?? [], contextOf(from).profiles.progress.level.level, isTester(contextOf(from).profiles.profile.name));
  return open.filter((id) => SCENE_SCREENS[id] !== undefined);
}

/**
 * The screensaver goes on to the open scene after `current` (null: its first), as a visitor (ft_1_17.AC4). False, and
 * nothing happens, when no scene is open.
 */
export function visitNext(from: Phaser.Scene, current: string | null): boolean {
  const id = nextVisit(visitable(from), current);
  if (id === null) return false;
  startScene(from, SCENE_SCREENS[id]!.scene, { visiting: true });
  return true;
}

/**
 * While the screensaver shows scene `id` (ft_1_17.AC3, AC4): any key, any note on the piano, a tap or a move of the
 * pointer goes back to the room, and after `VISIT.stayMs` the next open scene is shown. Call it before the scene's own
 * keyboard handling is set up, so a key only ends the visit and does nothing else.
 */
export function watchVisit(scene: Phaser.Scene, id: string): void {
  let done = false;
  const home = (event?: Event): void => {
    event?.stopImmediatePropagation();
    event?.preventDefault();
    if (done) return;
    done = true;
    startScene(scene, 'profile');
  };
  window.addEventListener('keydown', home, true);
  scene.events.once('shutdown', () => window.removeEventListener('keydown', home, true));
  scene.events.once('shutdown', contextOf(scene).keyboard.onNote(() => home()));
  scene.input.once('pointerdown', () => home());
  scene.input.once('pointermove', () => home());
  scene.time.delayedCall(VISIT.stayMs, () => {
    if (done) return;
    done = true;
    if (!visitNext(scene, id)) startScene(scene, 'profile');
  });
}
