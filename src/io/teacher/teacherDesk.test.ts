import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../storage/MemoryStore';
import { TEACHER_RECORD_KEY } from '../../core/admin/teacherRecord';
import { createAdminAccess } from '../admin/adminAccess';
import { createTeacherDesk, dayString } from './teacherDesk';

describe("the teacher's own password (d140)", () => {
  it('ft_1_26.AC1 accepts the default pianor on a fresh device', async () => {
    const desk = createTeacherDesk(new MemoryStore());
    expect(await desk.lock.check('pianor')).toBe(true);
    expect(await desk.lock.check('teacher')).toBe(false);
  });

  it('ft_1_26.AC1 is separate from the admin password both ways, and changeable', async () => {
    const store = new MemoryStore();
    const desk = createTeacherDesk(store);
    const admin = createAdminAccess(store);
    expect(await desk.lock.changePassword('pianor', 'noot', 'noot')).toBe('ok');
    expect(await store.get(TEACHER_RECORD_KEY)).not.toContain('noot');
    expect(await desk.lock.check('noot')).toBe(true);
    expect(await desk.lock.check('pianor')).toBe(false);
    expect(await admin.check('pianor')).toBe(true);
    expect(await admin.check('noot')).toBe(false);
    expect(await admin.changePassword('pianor', 'viul', 'viul')).toBe('ok');
    expect(await desk.lock.check('noot')).toBe(true);
    expect(await desk.lock.check('viul')).toBe(false);
  });

  it('stays open 30 minutes after the password, and the lock closes it', async () => {
    let now = 1_000;
    const desk = createTeacherDesk(new MemoryStore(), () => now);
    expect(desk.lock.unlockedFor()).toBe(0);
    await desk.lock.check('pianor');
    now += 60_000;
    expect(desk.lock.unlockedFor()).toBe(29 * 60_000);
    desk.lock.lock();
    expect(desk.lock.unlockedFor()).toBe(0);
  });
});

describe('the local day', () => {
  it('writes a date as YYYY-MM-DD in local time', () => {
    expect(dayString(new Date(1998, 0, 5, 23, 30))).toBe('1998-01-05');
  });
});
