import type { StringKey } from '../../core/text/strings';
import type { Bitmap } from '../ui/pixel/bitmap';
import { chordBoard, lessonKeys, listeningEar, noteInSight, scaleSteps } from '../ui/pixel/standArt';

/**
 * What the stand in the room opens (ft_1_08.AC11; all non-piano trainers and minigames are reached
 * through the stand; clicking it gives a choice of all available options, as pictures, not text): one entry per
 * trainer the player can open, its picture and the name its bubble shows. A new trainer or minigame is one more entry
 * here with its picture, and no code in the room.
 */
export interface StandChoice {
  readonly id: string;
  /** The scene the picture opens. */
  readonly scene: 'noteTrainer' | 'earTrainer' | 'shapeTrainer' | 'chordTrainer' | 'lessonBook';
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
  // the scales and chords trainer (ft_1_29): a note on each of three steps going up
  { id: 'shapes', scene: 'shapeTrainer', name: 'room.shapes', picture: scaleSteps },
  // chord from its name (ft_1_29 slice B): three notes stacked on one stem, on a board
  { id: 'chords', scene: 'chordTrainer', name: 'room.chords', picture: chordBoard },
  // the lesson book (ft_1_39): a page with two keys side by side and a bracket over them, a half step
  { id: 'lessons', scene: 'lessonBook', name: 'room.lessons', picture: lessonKeys },
];
