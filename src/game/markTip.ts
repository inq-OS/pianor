/**
 * The one-time tips that name a mark (d312): the first time a player is shown the 8 of a wrong octave or the ½ of a key
 * next door, a tip says in words what it means; never again for that player. Kept per player in the browser as the
 * practice screen's first-run tip is; none where the intro is off (the end-to-end tests) or in a self-playing demo.
 */
import type Phaser from 'phaser';
import { MARK_TIP_KEYS, type TaughtMark } from '../core/text/marks';
import { t } from '../core/text/strings';
import { contextOf } from './context';

/** The tip's words when `mark` is shown to this player for the first time, else null; asking marks it as taught. */
export function markTipFor(scene: Phaser.Scene, mark: TaughtMark | null): string | null {
  if (mark === null) return null;
  try {
    const { flags, profiles } = contextOf(scene);
    if (flags.intro === 'off' || flags.autoplay) return null;
    const key = `pianor.markTip.${mark}.${profiles.profile.id}`;
    if (window.localStorage.getItem(key) === '1') return null;
    window.localStorage.setItem(key, '1');
    return t(MARK_TIP_KEYS[mark]);
  } catch {
    return null;
  }
}
