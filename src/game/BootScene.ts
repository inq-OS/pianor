import Phaser from 'phaser';
import { contextOf } from './context';
import { firstPlayerBox } from './ProfilesScene';
import { startScene } from './scenes';

/**
 * Start scene: hands over to a dev demo scene, to the first player's name box on a new install (ft_1_07.AC1), or to the main
 * menu (who is playing). Autoplay (dev only, `?autoplay=1`)
 * starts on the piece list, where its director expects to find the game.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const demo = contextOf(this).flags.demo;
    const { autoplay } = contextOf(this).flags;
    if (!demo && !autoplay && contextOf(this).profiles.needsFirstPlayer) {
      startScene(this, 'name', firstPlayerBox());
      return;
    }
    startScene(this, demo === 'staff' ? 'staff-demo' : demo === 'art' ? 'art-demo' : autoplay ? 'menu' : 'profiles');
  }
}
