import type { StringKey } from '../../core/text/strings';
import type { Bitmap } from '../ui/pixel/bitmap';
import { listeningEar, noteInSight } from '../ui/pixel/standArt';

/**
 * What the stand in the room opens (ft_1_08.AC11; all non-piano trainers and minigames are reached
 * through the stand; clicking it gives a choice of all available options, as pictures, not text): one entry per
 * trainer the player can open, its picture and the name its bubble shows. A new trainer or minigame is one more entry
 * here with its picture, and no code in the room.
 */
export interface StandChoice {
  readonly id: string;
  /** The scene the picture opens. */
  readonly scene: 'noteTrainer' | 'earTrainer';
  /** The trainer's name, shown in the delayed bubble of its picture and never written under it. */
  readonly name: StringKey;
  /** Its picture on the fine grid, `STAND_ART` in size. */
  readonly picture: () => Bitmap;
}

export const STAND_CHOICES: readonly StandChoice[] = [
  // the note-name trainer (ft_0_17): a note in a spyglass's cross hairs
  { id: 'notes', scene: 'noteTrainer', name: 'room.theory', picture: noteInSight },
  // the ear trainer (ft_1_10): an ear listening sharply
  { id: 'ear', scene: 'earTrainer', name: 'room.ear', picture: listeningEar },
];
