import { contextOf } from './context';
import { PasswordGateScene } from './PasswordGateScene';
import { startScene } from './scenes';

/**
 * The gate behind the academic hat (ft_1_26.AC1, d140): the teacher's own password, separate from the admin page's, default
 * `pianor` in a record of its own. The screen says it is a child lock. Back returns to the main menu.
 */
export class TeacherGateScene extends PasswordGateScene {
  /** An administrative screen, no gameplay: the toolbar, no band. */
  protected override keepsToolbar = true;
  /** Written in her register, as her other screens are (WP-14, d145). */
  protected override inRegister = true;
  protected readonly titleKey = 'teacherGate.title';
  protected readonly hintKey = 'teacherGate.hint';

  constructor() {
    super('teacherGate');
  }

  protected lock() {
    return contextOf(this).teacher.lock;
  }

  protected open(): void {
    startScene(this, 'teacher');
  }

  protected override back(): void {
    startScene(this, 'profiles');
  }
}
