import type Phaser from 'phaser';
import { startScene } from './scenes';
import type { SongData } from './SongScene';

/**
 * Where a play started from the songs list or a song page goes back to (ft_1_36): the songs list, or the song page it
 * came from. A play with none goes back to the piece book.
 */
export type SongReturn = SongData | 'songs';

export function goBackFrom(scene: Phaser.Scene, to: SongReturn | undefined): void {
  if (to === undefined) startScene(scene, 'menu');
  else if (to === 'songs') startScene(scene, 'songs');
  else startScene(scene, 'song', to);
}
