import { contextOf } from './context';
import { PasswordGateScene } from './PasswordGateScene';
import { startScene } from './scenes';

/** The gate to the admin page; the password is the admin's (`core/admin/adminRecord`). Back returns to the main menu. */
export class AdminGateScene extends PasswordGateScene {
  protected readonly titleKey = 'adminGate.title';
  protected readonly hintKey = 'adminGate.hint';

  constructor() {
    super('adminGate');
  }

  protected lock() {
    return contextOf(this).admin;
  }

  protected open(): void {
    startScene(this, 'admin');
  }

  protected override back(): void {
    startScene(this, 'profiles');
  }
}
