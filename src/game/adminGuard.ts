import type Phaser from 'phaser';
import type { PasswordLock } from '../io/admin/passwordLock';
import { contextOf } from './context';
import { startScene } from './scenes';

/**
 * Keeps a locked screen behind its password (ft_1_07.AC8, d140): a locked one goes to its gate at once, an open one goes
 * there when its 30 minutes run out. Call it at the end of the screen's `create`.
 */
export function guardLocked(scene: Phaser.Scene, lock: PasswordLock, gate: 'adminGate' | 'teacherGate'): void {
  const left = lock.unlockedFor();
  if (left <= 0) {
    startScene(scene, gate);
    return;
  }
  scene.time.delayedCall(left, () => startScene(scene, gate));
}

/** Keeps an admin screen behind the admin password (ft_1_07.AC8). */
export function guardAdmin(scene: Phaser.Scene): void {
  guardLocked(scene, contextOf(scene).admin, 'adminGate');
}

/** Keeps a teacher's screen behind her own password (ft_1_26.AC1, d140). */
export function guardTeacher(scene: Phaser.Scene): void {
  guardLocked(scene, contextOf(scene).teacher.lock, 'teacherGate');
}

/** Where the Admin button goes: straight in while the admin features are open, else to the password gate. */
export function adminEntry(scene: Phaser.Scene): 'admin' | 'adminGate' {
  return contextOf(scene).admin.unlockedFor() > 0 ? 'admin' : 'adminGate';
}

/** Where the academic hat goes: straight to the teacher's screen while it is open, else to her gate (ft_1_26.AC1). */
export function teacherEntry(scene: Phaser.Scene): 'teacher' | 'teacherGate' {
  return contextOf(scene).teacher.lock.unlockedFor() > 0 ? 'teacher' : 'teacherGate';
}
