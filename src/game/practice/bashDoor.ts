import { KEY_BASH_LIMIT, KeyBashGuard } from '../../core/judge/keyBash';
import type { KeyboardInput } from '../../io/keyboard';
import { openOverlay } from '../scenes';

/**
 * Kiur at the door on a screen the student plays on besides the practice screen (ft_1_15.AC8): a trainer. More keys held at
 * once than two hands have fingers pause the screen under `KiurDoorScene`; Back goes on, the door calls `out`. The keys pass
 * to the screen as before (no key waits there; AX-3 provisional: the keys of a bash before the eleventh may be judged by
 * the trainer). Stops with the screen.
 */
export function watchKeyBash(scene: Phaser.Scene, keyboard: KeyboardInput, out: () => void): void {
  const guard = new KeyBashGuard({ passHeld: KEY_BASH_LIMIT });
  let atDoor = false;
  const unsubscribe = keyboard.onNote((event) => {
    if (!guard.handle(event).bash || atDoor || !scene.scene.isActive()) return;
    atDoor = true;
    void openOverlay(scene, 'kiurDoor').then((choice) => {
      atDoor = false;
      if (choice === 'door') out();
    });
  });
  scene.events.once('shutdown', unsubscribe);
}
