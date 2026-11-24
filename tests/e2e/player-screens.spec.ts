// Covers ft_1_07.AC1, ft_1_07.AC2, ft_1_07.AC3, ft_1_07.AC4, ft_1_07.AC6, ft_1_07.AC8, ft_1_07.AC10.
// The main menu (who is playing, and free play), the player's room (the profile screen, with Settings and Quit), the book
// (song list) and the admin page with its name picker. progress.spec.ts covers the first checks; these tests add the
// buttons and the paths it did not reach.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { addPlayer, bandAction, clickButton, clickToolbar, expectNoErrors, goToMainMenu, menuButton, nameDone, openAdminPage, openGame, openPiece, pickUnderGear, playerName, profileButton, sceneButton, sceneTexts, typeName, waitForScene } from './helpers';

/** The main menu: from the piece list, the room's Quit goes there (`goToMainMenu`). */
const openProfiles = async (page: Page) => {
  await goToMainMenu(page);
};

/** Open a player's room (the profile screen) from the main menu. */
const openDashboard = async (page: Page, name: string) => {
  await openProfiles(page);
  await clickButton(page, 'profiles', await profileButton(page, name));
  await waitForScene(page, 'profile');
};

/** Open the admin page for the active player (its button sits on the main menu). */
const openAdmin = async (page: Page) => {
  await openProfiles(page);
  await openAdminPage(page);
};

const profileCount = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.profiles.length as number);

const buttonActive = (page: Page, key: string) =>
  page.evaluate((k) => (window.__game.scene.getScene(k).buttons as { active: boolean }[]).map((b) => b.active), key);

test.describe('a new install (ft_1_07.AC1)', () => {
  test('ft_1_07.AC1 makes no player: it opens on the name box with no Back, and the typed name is the only player', async ({ page }) => {
    // no `?players=test`: what a family's first start sees
    await page.goto('/?device=virtual&lang=en&intro=0&loop=timer');
    await page.waitForFunction(() => window.__game !== undefined);
    await waitForScene(page, 'name');
    const toolbarBack = () => page.evaluate(() => Boolean((window.__game.scene.getScene('name') as unknown as { toolbarButtons: { back?: unknown } }).toolbarButtons.back));
    expect(await toolbarBack()).toBe(false);
    expect(await profileCount(page)).toBe(0);
    await typeName(page, 'ANNA');
    await waitForScene(page, 'profile');
    expect(await playerName(page)).toBe('ANNA');
    expect(await page.evaluate(() => (window.__game.registry.get('context').profiles.profiles as { name: string }[]).map((p) => p.name))).toEqual(['ANNA']);
    // the next start asks nothing: the main menu with that one player
    await page.reload();
    await page.waitForFunction(() => window.__game !== undefined);
    await waitForScene(page, 'profiles');
    expect(await sceneTexts(page, 'profiles')).toContain('ANNA');
    expect(await profileCount(page)).toBe(1);
  });
});

test.describe('main menu (ft_1_07.AC2)', () => {
  test('one written line per player, the active one marked, then the outlined "+" for a new player, the bare piano, the academic hat and the gear with Credits and Admin under it; no heading and no Free play (ft_1_12.AC1)', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    const texts = await sceneTexts(page, 'profiles');
    expect(texts).toEqual(expect.arrayContaining(['Pianor', 'TUVI', 'VINT', 'KIUR', 'PÄÄSU']));
    // no "Who is playing?" (the choice is implied), and the "+", the piano and the gear are pictures
    for (const gone of ['Who is playing?', 'New player', 'Credits', 'Admin', 'Piece maker', 'Settings']) expect(texts).not.toContain(gone);
    // the four players come first, in order; TUVI is the active player of a new game and so the only marked line
    const active = await buttonActive(page, 'profiles');
    expect(active.slice(0, 4)).toEqual([true, false, false, false]);
    expect(await profileButton(page, 'New player')).toBe(4);
    expect(await profileButton(page, 'Piece maker')).toBe(5);
    // the academic hat between the piano and the gear opens the teacher's screen (ft_1_26.AC1, d145)
    expect(await profileButton(page, 'Teacher')).toBe(6);
    expect(await profileButton(page, 'Settings')).toBe(7);
    expect(await profileButton(page, 'Free play')).toBe(-1);
    // Credits and Admin are under the gear, and nothing else
    expect(await profileButton(page, 'Credits')).toBe(-1);
    await clickButton(page, 'profiles', 7);
    expect(await profileButton(page, 'Credits')).toBe(8);
    expect(await profileButton(page, 'Admin')).toBe(9);
    expect(await profileButton(page, 'Teacher')).toBe(6);
    expectNoErrors(errors);
  });

  test('ft_1_07.AC10 New player asks for a name, then adds the player and opens its room', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    const before = await profileCount(page);
    await addPlayer(page, 'KAI');
    expect(await profileCount(page)).toBe(before + 1);
    expect(await playerName(page)).toBe('KAI');
    await waitForScene(page, 'profile'); // the room: the name on the shield, the level in its card (ft_1_20.AC13)
    expectNoErrors(errors);
  });

  test('ft_1_07.AC10 a name another player has is refused on the name box, and Back adds nobody', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    const before = await profileCount(page);
    await clickButton(page, 'profiles', await profileButton(page, 'New player'));
    await typeName(page, 'VINT');
    await expect.poll(() => sceneTexts(page, 'name')).toContain('Another player has this name.');
    expect(await profileCount(page)).toBe(before);
    await clickToolbar(page, 'back'); // the door (ft_1_20)
    await waitForScene(page, 'profiles');
    expect(await profileCount(page)).toBe(before);
    expectNoErrors(errors);
  });

  test('ft_1_07.AC10 New player is gone once there are ten players', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await page.evaluate(async () => {
      const profiles = window.__game.registry.get('context').profiles;
      for (let i = profiles.profiles.length; i < 10; i += 1) await profiles.createPlayer(`P${i}`);
    });
    await clickButton(page, 'profiles', await profileButton(page, 'TUVI')); // redraw the menu by leaving and coming back
    await waitForScene(page, 'profile');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Back'));
    await waitForScene(page, 'profiles');
    expect(await profileCount(page)).toBe(10);
    expect(await profileButton(page, 'New player')).toBe(-1);
    expectNoErrors(errors);
  });
});

test.describe('saves that cannot be kept', () => {
  test('with no IndexedDB and no localStorage the main menu says progress cannot be saved, where a player is picked', async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.open = () => { throw new Error('blocked by the test'); };
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked by the test'); } });
    });
    await openGame(page, '?device=virtual', 'en', 'profiles');
    expect(await sceneTexts(page, 'profiles')).toContain('Progress cannot be saved on this device.');
  });

  test('a player whose save cannot be read stays on the main menu, greyed, and says why; a broken practice log costs only the bar history', async ({ page }) => {
    await openGame(page, '?device=virtual', 'en', 'profiles');
    // damage VINT's profile document and TUVI's practice log, as a failing disk or a hand edit would
    await page.evaluate(async () => {
      const profiles = window.__game.registry.get('context').profiles as { profiles: { id: string; name: string }[]; options: { repository: { store: { set(k: string, v: string): Promise<void> } } } };
      const id = (name: string) => profiles.profiles.find((p) => p.name === name)!.id;
      await profiles.options.repository.store.set(`pianor/v1/player/${id('VINT')}/profile`, '{"name":"VINT","settings":"x"}');
      await profiles.options.repository.store.set(`pianor/v1/player/${id('TUVI')}/practiceLog`, 'xx{');
    });
    await page.reload();
    await page.waitForFunction(() => window.__game?.scene.getScenes(true).some((s) => s.scene.key === 'profiles' && (s as unknown as { loading?: boolean }).loading !== true));
    const lines = await page.evaluate(() => (window.__game.scene.getScene('profiles').buttons as { options: { label: string; tooltip?: string }; disabled: boolean }[])
      .filter((b) => ['TUVI', 'VINT', 'KIUR', 'PÄÄSU'].includes(b.options.label)).map((b) => [b.options.label, b.disabled, b.options.tooltip ?? '']));
    expect(lines).toEqual([['TUVI', false, ''], ['KIUR', false, ''], ['PÄÄSU', false, ''], ['VINT', true, "This player's save cannot be read. A copy is kept."]]);
  });

  test('a player open in one window does not open in a second, so the two cannot write over each other; another player still opens (d159)', async ({ page, context }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
    await waitForScene(page, 'profile');
    const second = await context.newPage();
    const secondErrors = await openGame(second, '?device=virtual', 'en', 'profiles');
    await clickButton(second, 'profiles', await profileButton(second, 'TUVI'));
    await expect.poll(() => sceneTexts(second, 'profiles')).toContain('This player is open in another window.');
    expect(await second.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))).not.toContain('profile');
    await clickButton(second, 'profiles', await profileButton(second, 'KIUR'));
    await waitForScene(second, 'profile');
    expectNoErrors(errors);
    expectNoErrors(secondErrors);
  });

  test('with saves working the main menu has no such line', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    expect(await sceneTexts(page, 'profiles')).not.toContain('Progress cannot be saved on this device.');
    expectNoErrors(errors);
  });
});

test.describe('the room (ft_1_07.AC3, ft_1_07.AC4)', () => {
  test('Back on the room goes back to the main menu', async ({ page }) => {
    const errors = await openGame(page);
    await openDashboard(page, 'VINT');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Back'));
    await waitForScene(page, 'profiles');
    expectNoErrors(errors);
  });

  test('Settings from the room opens the settings for that player, and Back returns to the room', async ({ page }) => {
    const errors = await openGame(page);
    await openDashboard(page, 'VINT');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Settings'));
    await waitForScene(page, 'settings');
    expect(await playerName(page)).toBe('VINT');
    await clickButton(page, 'settings', await sceneButton(page, 'settings', 'Back'));
    await waitForScene(page, 'profile');
    expectNoErrors(errors);
  });

  test('the piano opens the piece list for practice, and its Back returns to the room', async ({ page }) => {
    const errors = await openGame(page);
    await openDashboard(page, 'VINT');
    await clickButton(page, 'profile', 0); // the piano
    await waitForScene(page, 'menu');
    await clickButton(page, 'menu', await menuButton(page, 'Back'));
    await waitForScene(page, 'profile');
    expectNoErrors(errors);
  });

  test('the room has no book: the piano alone opens the piece list (ft_1_12.AC1)', async ({ page }) => {
    const errors = await openGame(page);
    await openDashboard(page, 'VINT');
    expect(await sceneButton(page, 'profile', 'Book')).toBe(-1);
    await clickButton(page, 'profile', 0); // the piano
    await waitForScene(page, 'menu');
    await openPiece(page, 'Little Steps');
    expectNoErrors(errors);
  });
});

test.describe('admin page (ft_1_07.AC6)', () => {
  test('export saves the active player as a file named for them', async ({ page }) => {
    const errors = await openGame(page);
    await openAdmin(page);
    await page.evaluate(() => {
      const files = window.__game.registry.get('context').files;
      files.download = (name: string, text: string) => ((window as unknown as { __exported: unknown }).__exported = { name, text });
    });
    await clickButton(page, 'admin', 0); // Export player
    await expect.poll(() => sceneTexts(page, 'admin')).toContain('Saved to a file.');
    const exported = await page.evaluate(() => (window as unknown as { __exported: { name: string; text: string } }).__exported);
    expect(exported.name).toBe('pianor-TUVI.json');
    expect(JSON.parse(exported.text)).toMatchObject({ format: 'pianor-profile', exportVersion: 2, documents: { profile: { name: 'TUVI' } } });
    expectNoErrors(errors);
  });

  test('import of a saved file adds a new player and opens its dashboard', async ({ page }) => {
    const errors = await openGame(page);
    await openAdmin(page);
    const exported = await page.evaluate(() => window.__game.registry.get('context').profiles.exportActive() as Promise<string>);
    await page.evaluate((text) => {
      window.__game.registry.get('context').files.pick = async () => text;
    }, exported);
    const before = await profileCount(page);
    await clickButton(page, 'admin', 1); // Import player
    await waitForScene(page, 'profile');
    expect(await profileCount(page)).toBe(before + 1);
    expectNoErrors(errors);
  });

  test('Back from the name picker returns to the admin page and renames nothing', async ({ page }) => {
    const errors = await openGame(page);
    await openAdmin(page);
    await clickButton(page, 'admin', 2); // Rename player
    await waitForScene(page, 'name');
    expect(await sceneTexts(page, 'name')).toEqual(expect.arrayContaining(['New name:']));
    // no instructions on the name box
    expect(await sceneTexts(page, 'name')).not.toContain('Tap the letters');
    await clickToolbar(page, 'back'); // the door (ft_1_20)
    await waitForScene(page, 'admin');
    expect(await sceneTexts(page, 'admin')).not.toContain('Renamed.');
    expect(await playerName(page)).toBe('TUVI');
    expectNoErrors(errors);
  });

  test('ft_1_07.AC6 the name box has no letter buttons: the name is typed on the computer keyboard and shown in its box', async ({ page }) => {
    const errors = await openGame(page);
    await openAdmin(page);
    await clickButton(page, 'admin', 2); // Rename player
    await waitForScene(page, 'name');
    const labels = () => page.evaluate(() => (window.__game.scene.getScene('name').buttons as { options: { label: string } }[]).map((b) => b.options.label));
    expect((await labels()).filter((l) => /^\p{Lu}$/u.test(l))).toEqual([]);
    await page.keyboard.type('MA1');
    // a key that is not a name letter is not taken
    await expect.poll(() => sceneTexts(page, 'name')).toContain('MA');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('ARI');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'admin');
    expect(await playerName(page)).toBe('MARI');
    expectNoErrors(errors);
  });

  test('a blank name is refused on the picker and the player keeps the old name', async ({ page }) => {
    const errors = await openGame(page);
    await openAdmin(page);
    await clickButton(page, 'admin', 2); // Rename player
    await waitForScene(page, 'name');
    await clickButton(page, 'name', await nameDone(page)); // Done, with nothing typed: the box stays open and says why
    await expect.poll(() => sceneTexts(page, 'name')).toContain('The name cannot be empty.');
    expect(await playerName(page)).toBe('TUVI');
    expectNoErrors(errors);
  });
});

/** The index of a button on a screen, by its label (the pixel buttons keep their text). */
const buttonIndex = (page: Page, sceneKey: string, label: string) =>
  page.evaluate(
    ({ key, text }) => (window.__game.scene.getScene(key).buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === text)),
    { key: sceneKey, text: label },
  );

test.describe('admin gate, pages and password', () => {
  test('a wrong password stays on the gate and the right one opens the admin page', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await pickUnderGear(page, 'Admin');
    await waitForScene(page, 'adminGate');
    // the letters typed are the password's: the computer-keyboard piano (Z X C ... are its keys) plays none of them
    await page.evaluate(() => {
      const w = window as unknown as { typedNotes: number[] };
      w.typedNotes = [];
      (window.__game.registry.get('context') as { keyboard: { onNote(listener: (e: { midi: number }) => void): void } }).keyboard.onNote((e) => w.typedNotes.push(e.midi));
    });
    await page.keyboard.type('zxc');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('nope');
    await page.keyboard.press('Enter');
    await expect.poll(() => sceneTexts(page, 'adminGate')).toContain('Wrong password. Try again.');
    expect(await page.evaluate(() => (window as unknown as { typedNotes: number[] }).typedNotes)).toEqual([]);
    await page.keyboard.type('pianor');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'admin');
    expectNoErrors(errors);
  });

  test('the Pages screen offers the hardware test, and no draft switch in a dev server', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await openAdminPage(page);
    await clickButton(page, 'admin', await buttonIndex(page, 'admin', 'Pages'));
    await waitForScene(page, 'adminPages');
    const texts = await sceneTexts(page, 'adminPages');
    expect(texts).toEqual(expect.arrayContaining(['Pages', 'Hardware test', 'Change password']));
    expect(texts.some((t) => t.startsWith('Drafts:'))).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_0_07.AC3 the piano switch on the Pages screen turns the light piano on and off while the game runs, and is kept on this device', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await openAdminPage(page);
    await clickButton(page, 'admin', await buttonIndex(page, 'admin', 'Pages'));
    await waitForScene(page, 'adminPages');
    const sound = () => page.evaluate(() => (window.__game.registry.get('context') as { audio: { piano: { sound: string } } }).audio.piano.sound);
    expect(await sound()).toBe('full');
    await clickButton(page, 'adminPages', await buttonIndex(page, 'adminPages', 'Piano: full'));
    await expect.poll(() => sceneTexts(page, 'adminPages')).toContain('Piano: light');
    expect(await sound()).toBe('light');
    // kept: a reload starts with the light piano
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.__game?.registry.get('context'))), { timeout: 20_000 }).toBe(true);
    await expect.poll(sound).toBe('light');
    expectNoErrors(errors);
  });

  test('ft_0_07.AC4 the piano switch on EZ-220 plays the notes of the game on the attached keyboard, on channel 2', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await openAdminPage(page);
    await clickButton(page, 'admin', await buttonIndex(page, 'admin', 'Pages'));
    await waitForScene(page, 'adminPages');
    await clickButton(page, 'adminPages', await buttonIndex(page, 'adminPages', 'Piano: full'));
    await expect.poll(() => sceneTexts(page, 'adminPages')).toContain('Piano: light');
    await clickButton(page, 'adminPages', await buttonIndex(page, 'adminPages', 'Piano: light'));
    await expect.poll(() => sceneTexts(page, 'adminPages')).toContain('Piano: keyboard');
    // the virtual EZ-220 is attached: a note the game plays goes to it on channel 2 (0x91), and none on channel 1
    const sent = await page.evaluate(() => {
      const w = window as unknown as { __virtualDevice: { output: { sent: { data: number[] }[] } }; __game: { registry: { get(k: string): { audio: { piano: { noteOn(m: number, v: number): void; noteOff(m: number): void; playsOnKeyboard: boolean } } } } } };
      const piano = w.__game.registry.get('context').audio.piano;
      const before = w.__virtualDevice.output.sent.length;
      piano.noteOn(67, 80);
      piano.noteOff(67);
      return { onKeyboard: piano.playsOnKeyboard, data: w.__virtualDevice.output.sent.slice(before).map((m) => m.data) };
    });
    expect(sent).toEqual({ onKeyboard: true, data: [[0x91, 67, 80], [0x81, 67, 0]] });
    await clickButton(page, 'adminPages', await buttonIndex(page, 'adminPages', 'Piano: keyboard'));
    await expect.poll(() => sceneTexts(page, 'adminPages')).toContain('Piano: full');
    expectNoErrors(errors);
  });

  test('changing the password refuses a wrong old one, then the new one opens the admin page', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await openAdminPage(page);
    await clickButton(page, 'admin', await buttonIndex(page, 'admin', 'Pages'));
    await waitForScene(page, 'adminPages');
    await clickButton(page, 'adminPages', await buttonIndex(page, 'adminPages', 'Change password'));
    await waitForScene(page, 'adminPassword');
    // a wrong old password: refused, nothing changed
    await page.keyboard.type('vale');
    await page.keyboard.press('Tab');
    await page.keyboard.type('uus');
    await page.keyboard.press('Tab');
    await page.keyboard.type('uus');
    await page.keyboard.press('Enter');
    await expect.poll(() => sceneTexts(page, 'adminPassword')).toContain('The old password is wrong.');
    // the right old password, a new one, and its repeat
    await page.keyboard.type('pianor');
    await page.keyboard.press('Tab');
    await page.keyboard.type('uus');
    await page.keyboard.press('Tab');
    await page.keyboard.type('uus');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'adminPages');
    // a few frames for the screen just started (a click in its first frame was sometimes lost under load)
    const frame = await page.evaluate(() => window.__game.loop.frame);
    await page.waitForFunction((f) => window.__game.loop.frame >= f + 5, frame);
    // lock, then back to the gate: the old password is refused, the new one opens the admin page
    await clickButton(page, 'adminPages', await buttonIndex(page, 'adminPages', 'Back'));
    await waitForScene(page, 'admin');
    await clickButton(page, 'admin', await buttonIndex(page, 'admin', 'Lock'));
    await waitForScene(page, 'profiles');
    await pickUnderGear(page, 'Admin');
    await waitForScene(page, 'adminGate');
    await page.keyboard.type('pianor');
    await page.keyboard.press('Enter');
    await expect.poll(() => sceneTexts(page, 'adminGate')).toContain('Wrong password. Try again.');
    await page.keyboard.type('uus');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'admin');
    expectNoErrors(errors);
  });
});

test.describe('the admin unlock window (ft_1_07.AC8)', () => {
  test('ft_1_07.AC8 after the password, Admin opens without it until the lock is pressed', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await openAdminPage(page);
    await clickButton(page, 'admin', await buttonIndex(page, 'admin', 'Back'));
    await waitForScene(page, 'profiles');
    await pickUnderGear(page, 'Admin');
    await waitForScene(page, 'admin'); // still open: no gate
    await clickButton(page, 'admin', await buttonIndex(page, 'admin', 'Lock'));
    await waitForScene(page, 'profiles');
    await pickUnderGear(page, 'Admin');
    await waitForScene(page, 'adminGate');
    expectNoErrors(errors);
  });

  test('ft_1_07.AC8 an admin screen goes to the gate once the admin features lock', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await openAdminPage(page);
    // the 30 minutes run out: lock behind the screen's back and start it again, as its timer would
    await page.evaluate(() => {
      window.__game.registry.get('context').admin.lock();
      window.__game.scene.start('admin');
    });
    await waitForScene(page, 'adminGate');
    expectNoErrors(errors);
  });
});

/** The indices of every button of a scene labelled `label`, in drawing order (the step buttons repeat on each line). */
const sceneButtonsLabelled = (page: Page, key: string, label: string) => page.evaluate(
  ({ k, text }) => (window.__game.scene.getScene(k).buttons as { options: { label: string } }[]).flatMap((b, i) => (b.options.label === text ? [i] : [])),
  { k: key, text: label },
);

test.describe("the teacher's screen behind the academic hat (ft_1_26, WP-14)", () => {
  test("ft_1_26.AC1 her own password opens it, pianor by default, and the gate says it is a child lock", async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await clickButton(page, 'profiles', await profileButton(page, 'Teacher'));
    await waitForScene(page, 'teacherGate');
    expect((await sceneTexts(page, 'teacherGate')).join(' ')).toContain('child lock');
    await page.keyboard.type('teacher');
    await page.keyboard.press('Enter');
    await expect.poll(() => sceneTexts(page, 'teacherGate')).toContain('Wrong password. Try again.');
    await page.keyboard.type('pianor');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'teacher');
    await expect.poll(() => sceneTexts(page, 'teacher')).toEqual(expect.arrayContaining(['Curriculum', 'No curriculum pieces yet.']));
    expectNoErrors(errors);
  });

  test("ft_1_26.AC2 the player's curriculum pieces show most urgent first, with colour, level and expected level", async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await clickButton(page, 'profiles', await profileButton(page, 'Teacher'));
    await waitForScene(page, 'teacherGate');
    await page.keyboard.type('pianor');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'teacher');
    await page.evaluate(async () => {
      const context = window.__game.registry.get('context');
      const id: string = context.profiles.profile.id;
      await context.profiles.saveCurriculum(id, {
        base: 85, calendar: [],
        pieces: [
          { piece: 'au-clair-de-la-lune', deadline: '1998-12-20', priority: 2 },
          { piece: 'zz-nope', deadline: '1998-12-01', priority: 9 },
        ],
      });
      window.__game.scene.start('teacher', { player: id });
    });
    await waitForScene(page, 'teacher');
    await expect.poll(async () => (await sceneTexts(page, 'teacher')).includes('zz-nope')).toBe(true);
    const texts = await sceneTexts(page, 'teacher');
    const first = texts.indexOf('zz-nope');
    expect(first).toBeGreaterThan(-1);
    // the more urgent (here: higher priority) piece first, then the other, each with its deadline, priority and expected level
    expect(texts.slice(first, first + 7)).toEqual(['zz-nope', '12-01', '9', '-', '94', '-', '-']);
    expect(texts.slice(first + 7, first + 14)).toEqual([expect.stringMatching(/^Au Clair/), '12-20', '2', '-', '87', '-', '-']);
    expect(texts).toEqual(expect.arrayContaining(['due', 'prio', 'level', 'goal', 'trend', 'delta']));
    expectNoErrors(errors);
  });

  test('ft_1_26.AC3 she adds a piece, sets its priority and the base under More, and takes it off again', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await clickButton(page, 'profiles', await profileButton(page, 'Teacher'));
    await waitForScene(page, 'teacherGate');
    await page.keyboard.type('pianor');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'teacher');
    await clickButton(page, 'teacher', await sceneButton(page, 'teacher', 'Add'));
    await waitForScene(page, 'teacherPiece');
    // the first piece offered (the toolbar's Back is button 0 or later; the pieces are written in her register, d145)
    const first = await page.evaluate(() => (window.__game.scene.getScene('teacherPiece').buttons as { options: { look?: string } }[]).findIndex((b) => b.options.look === 'ink'));
    await clickButton(page, 'teacherPiece', first);
    await expect.poll(() => sceneTexts(page, 'teacherPiece')).toContain('Priority (1 to 10)');
    const piece: string = await page.evaluate(() => (window.__game.scene.getScene('teacherPiece') as unknown as { draft: { piece: string } }).draft.piece);
    const title: string = await page.evaluate((id) => window.__game.registry.get('context').pieces.find(id).chart.title, piece);
    // priority 5 by default; one step up
    await clickButton(page, 'teacherPiece', (await sceneButtonsLabelled(page, 'teacherPiece', '+1'))[1]!);
    await clickButton(page, 'teacherPiece', await sceneButton(page, 'teacherPiece', 'More'));
    await expect.poll(() => sceneTexts(page, 'teacherPiece')).toContain('Base expectation');
    await clickButton(page, 'teacherPiece', (await sceneButtonsLabelled(page, 'teacherPiece', '-5'))[0]!);
    await clickButton(page, 'teacherPiece', await sceneButton(page, 'teacherPiece', 'Save'));
    await waitForScene(page, 'teacher');
    const curriculum = () => page.evaluate(async () => {
      const context = window.__game.registry.get('context');
      return (await context.profiles.curriculumOf(context.profiles.profile.id)).pieces;
    });
    expect(await curriculum()).toEqual([expect.objectContaining({ piece, priority: 6, overrides: { base: 80 } })]);
    // kept in the player's curriculum document over a reload of the page
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__game?.registry?.get('context')?.profiles));
    expect(await curriculum()).toEqual([expect.objectContaining({ piece, priority: 6, overrides: { base: 80 } })]);
    await page.evaluate(async () => {
      const context = window.__game.registry.get('context');
      await context.teacher.lock.check('pianor');
      for (const scene of window.__game.scene.getScenes(true)) window.__game.scene.stop(scene.scene.key);
      window.__game.scene.start('teacher');
    });
    await waitForScene(page, 'teacher');
    // the list shows it with its expected level, base 80 + priority 6
    await expect.poll(() => sceneTexts(page, 'teacher')).toContain('86');
    await clickButton(page, 'teacher', await page.evaluate((text) => (window.__game.scene.getScene('teacher').buttons as { options: { label: string } }[]).findIndex((b) => text.startsWith(b.options.label.replace(/\.$/, ''))), title));
    await waitForScene(page, 'teacherPiece');
    await clickButton(page, 'teacherPiece', await sceneButton(page, 'teacherPiece', 'Remove'));
    await waitForScene(page, 'teacher');
    expect(await curriculum()).toEqual([]);
    expectNoErrors(errors);
  });

  test('ft_1_26.AC9 she sets the test days and the time and orders a test for later, each saved in the curriculum at once', async ({ page }) => {
    const errors = await openGame(page);
    await openProfiles(page);
    await clickButton(page, 'profiles', await profileButton(page, 'Teacher'));
    await waitForScene(page, 'teacherGate');
    await page.keyboard.type('pianor');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'teacher');
    await expect.poll(() => sceneButton(page, 'teacher', 'Tests')).toBeGreaterThan(-1);
    await clickButton(page, 'teacher', await sceneButton(page, 'teacher', 'Tests'));
    await waitForScene(page, 'teacherTests');
    // the defaults: Sunday and Wednesday, from the start of the day, an order for an hour from now
    await expect.poll(() => sceneTexts(page, 'teacherTests')).toEqual(expect.arrayContaining(['Test days', 'We Su', 'From', '00:00', 'Test in', '1 h 0 min']));
    const saved = () => page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      return (await profiles.curriculumOf(profiles.profile.id)) as { testWeekdays?: number[]; testTime?: string; calendar: { kind: string; time?: string }[] };
    });
    await clickButton(page, 'teacherTests', await sceneButton(page, 'teacherTests', 'Mo'));
    await expect.poll(async () => (await saved()).testWeekdays).toEqual([0, 1, 3]);
    await clickButton(page, 'teacherTests', await sceneButton(page, 'teacherTests', 'We'));
    await expect.poll(async () => (await saved()).testWeekdays).toEqual([0, 1]);
    await clickButton(page, 'teacherTests', await sceneButton(page, 'teacherTests', '+1 h'));
    await expect.poll(async () => (await saved()).testTime).toBe('01:00');
    await clickButton(page, 'teacherTests', await sceneButton(page, 'teacherTests', 'Order test'));
    await expect.poll(async () => (await saved()).calendar.filter((c) => c.kind === 'test' && c.time !== undefined)).toHaveLength(1);
    await expect.poll(() => sceneTexts(page, 'teacherTests')).toContain('Ordered tests');
    expectNoErrors(errors);
  });

  test("ft_1_26.AC8 a curriculum piece has the teacher's hat on its title line in the piece book; the others have none", async ({ page }) => {
    const errors = await openGame(page);
    const title: string = await page.evaluate(async () => {
      const context = window.__game.registry.get('context');
      const piece = context.pieces.list()[0];
      await context.profiles.saveCurriculum(context.profiles.profile.id, { base: 85, calendar: [], pieces: [{ piece: piece.chart.id, deadline: '1998-12-20', priority: 5 }] });
      (window.__game.scene.getScene('menu') as unknown as { scene: { restart(): void } }).scene.restart();
      return piece.chart.title as string;
    });
    await waitForScene(page, 'menu');
    const hats = () => page.evaluate((label) => {
      const scene = window.__game.scene.getScene('menu') as unknown as { root: { list: { name: string; x: number; y: number }[] }; buttons: { options: { label: string }; rect: { x: number; y: number; width: number; height: number } }[] };
      const card = scene.buttons.find((b) => b.options.label === label)!.rect;
      return scene.root.list.filter((o) => o.name === 'curriculumHat').map((o) => o.x >= card.x + card.width && o.y >= card.y && o.y < card.y + card.height);
    }, title);
    // one hat, on the curriculum piece's title line right of its title, with the days left to its deadline beside it (nothing played yet)
    await expect.poll(hats).toEqual([true]);
    const days = await page.evaluate(() => (window.__game.scene.getScene('menu') as unknown as { root: { list: { name: string; text?: string }[] } }).root.list.filter((o) => o.name === 'curriculumDays').length);
    expect(days).toBe(1);
    expectNoErrors(errors);
  });

  test("ft_1_12.AC10 the band's filter hides the teacher's pieces and shows them again", async ({ page }) => {
    const errors = await openGame(page);
    const title: string = await page.evaluate(async () => {
      const context = window.__game.registry.get('context');
      const piece = context.pieces.list()[0];
      await context.profiles.saveCurriculum(context.profiles.profile.id, { base: 85, calendar: [], pieces: [{ piece: piece.chart.id, deadline: '1998-12-20', priority: 5 }] });
      (window.__game.scene.getScene('menu') as unknown as { scene: { restart(): void } }).scene.restart();
      return piece.chart.title as string;
    });
    await waitForScene(page, 'menu');
    await expect.poll(() => menuButton(page, title)).toBeGreaterThanOrEqual(0);
    // the band's switches: own, curriculum, character
    await clickButton(page, 'menu', await bandAction(page, 'menu', 1));
    await expect.poll(() => menuButton(page, title)).toBe(-1);
    await clickButton(page, 'menu', await bandAction(page, 'menu', 1));
    await expect.poll(() => menuButton(page, title)).toBeGreaterThanOrEqual(0);
    expectNoErrors(errors);
  });
});
