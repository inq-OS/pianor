import { contextOf } from './context';
import { PasswordChangeScene } from './PasswordChangeScene';
import { startScene } from './scenes';
import { guardTeacher } from './adminGuard';

/** Change the teacher's own password (ft_1_26.AC1, d140); back to her screen, also once it is changed. */
export class TeacherPasswordScene extends PasswordChangeScene {
  /** An administrative screen, no gameplay: the toolbar, no band. */
  protected override keepsToolbar = true;
  /** Written in her register, as her other screens are (WP-14, d145). */
  protected override inRegister = true;
  protected readonly titleKey = 'teacherPassword.title';

  constructor() {
    super('teacherPassword');
  }

  protected lock() {
    return contextOf(this).teacher.lock;
  }

  protected guard(): void {
    guardTeacher(this);
  }

  protected override back(): void {
    startScene(this, 'teacher');
  }
}
