import { contextOf } from './context';
import { PasswordChangeScene } from './PasswordChangeScene';
import { startScene } from './scenes';
import { guardAdmin } from './adminGuard';

/** Change the admin password; back to the admin Pages, also once it is changed. */
export class AdminPasswordScene extends PasswordChangeScene {
  protected readonly titleKey = 'adminPassword.title';

  constructor() {
    super('adminPassword');
  }

  protected lock() {
    return contextOf(this).admin;
  }

  protected guard(): void {
    guardAdmin(this);
  }

  protected override back(): void {
    startScene(this, 'adminPages');
  }
}
