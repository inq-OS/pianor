import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { LITTLE_STEPS, buttonPoint, clickButton, expectNoErrors, letGameRun, openFromStand, openGame, pickUnderGear, playWithVirtualPiano, sceneButton, sceneTexts, waitForScene } from './helpers';

/**
 * The player room as a real room whose objects are the buttons (ft_1_08 slice 3). A name bubble's delay runs on the
 * game's clock, which runs slow when the frame rate drops (software WebGL in CI and cloud runs): the wait is generous.
 */

type Box = { x: number; y: number; width: number; height: number };

async function toRoom(page: Page, lang: 'en' | 'et' = 'en', more = '') {
  const errors = await openGame(page, `?device=virtual${more}`, lang === 'et' ? null : 'en', 'profiles');
  await clickButton(page, 'profiles', 0);
  await waitForScene(page, 'profile');
  return errors;
}

const tooltipOf = (page: Page, index: number) =>
  page.evaluate((i) => window.__game.scene.getScene('profile').buttons[i].tooltipShown as string | null, index);

const focused = (page: Page) =>
  page.evaluate(() => (window.__game.scene.getScene('profile').focusables() as { focused: boolean }[]).findIndex((b) => b.focused));

/** The bubble drawn for button `index` (the two objects the button adds while its name shows), in art pixels. */
const bubbleOf = (page: Page, index: number) =>
  page.evaluate((i) => {
    const button = window.__game.scene.getScene('profile').buttons[i] as unknown as { tip: Box[]; rect: Box };
    return { bubble: button.tip[0] ? { x: button.tip[0].x, y: button.tip[0].y, width: button.tip[0].width, height: button.tip[0].height } : null, rect: button.rect };
  }, index);

/** The source the Maa- ja Ruumiamet open data licence asks for (docs/keri.md section 1). */
const MAP_CREDIT = 'Map: Maa- ja Ruumiamet orthophoto and base map, 2026';

test.describe('the player room', () => {
  test('ft_1_18.AC2 the credits screen names the map\'s source, as the orthophoto\'s licence asks', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await pickUnderGear(page, 'Credits');
    await waitForScene(page, 'credits');
    expect(await sceneTexts(page, 'credits')).toContain(MAP_CREDIT);
    expectNoErrors(errors);
  });

  test('ft_1_18.AC2 ft_1_18.AC4 the door opens the map of Keri, and the warden\'s house returns to the room', async ({ page }) => {
    const errors = await toRoom(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    // the island's name is painted into the picture; the map's source is named on the credits screen, not here
    expect(await sceneTexts(page, 'keriMap')).not.toContain(MAP_CREDIT);
    await clickButton(page, 'keriMap', await sceneButton(page, 'keriMap', "Warden's house"));
    await waitForScene(page, 'profile');
    expectNoErrors(errors);
  });

  test('ft_1_19.AC2 ft_1_19.AC9 the knoll on the map opens the scene with the bonfire place, its grass, clouds, embers and smoke moving, and Back returns to the map', async ({ page }) => {
    const errors = await toRoom(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    await clickButton(page, 'keriMap', await sceneButton(page, 'keriMap', 'Grassy knoll'));
    await waitForScene(page, 'knoll');
    // the grass and the sea (a gust in a loop of looks), the drifting clouds, the embers and the thread of smoke move
    const moving = await page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { animators: unknown[] }).animators.length);
    expect(moving).toBeGreaterThan(5);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'keriMap');
    expectNoErrors(errors);
  });

  test('ft_1_19.AC2 ft_1_19.AC5 the crossroads is shut on the map for a new player (level 2); opened, its grass, sea and clouds move and Back returns to the map', async ({ page }) => {
    const errors = await toRoom(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    // painted on the map, but no button until the student's level opens it (AX-3 provisional: level 2)
    expect(await sceneButton(page, 'keriMap', 'Crossroads')).toBe(-1);
    await page.evaluate(() => {
      window.__game.scene.stop('keriMap');
      window.__game.scene.start('crossroads');
    });
    await waitForScene(page, 'crossroads');
    // the grass and the sea (a gust in a loop of looks) and the drifting clouds move
    const moving = await page.evaluate(() => (window.__game.scene.getScene('crossroads') as unknown as { animators: unknown[] }).animators.length);
    expect(moving).toBeGreaterThan(3);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'keriMap');
    expectNoErrors(errors);
  });

  test('ft_1_19.AC2 ft_1_19.AC5 the docks are painted on the map but locked for a new player; opened, their sea, clouds and lamp move, and Back returns to the map', async ({ page }) => {
    const errors = await toRoom(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    // level 2 opens the docks: a new player at level 1 has no button for them
    expect(await sceneButton(page, 'keriMap', 'The jetty')).toBe(-1);
    await page.evaluate(() => { const g = window.__game; g.scene.stop('keriMap'); g.scene.start('docks'); });
    await waitForScene(page, 'docks');
    // the sea and the grass (a gust in a loop of looks), the drifting clouds, what stands before them and the lamp move
    const moving = await page.evaluate(() => (window.__game.scene.getScene('docks') as unknown as { animators: unknown[] }).animators.length);
    expect(moving).toBeGreaterThan(3);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'keriMap');
    expectNoErrors(errors);
  });

  test('ft_1_19.AC2 ft_1_19.AC5 the terrace is locked for a new player; opened, its clouds, lantern and pennant move, and Back returns to the map', async ({ page }) => {
    const errors = await toRoom(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    // level 2 opens the terrace: a new player at level 1 has no button for it
    expect(await sceneButton(page, 'keriMap', 'The terrace')).toBe(-1);
    await page.evaluate(() => { const g = window.__game; g.scene.stop('keriMap'); g.scene.start('terrace'); });
    await waitForScene(page, 'terrace');
    // the drifting clouds, what stands before them, the lantern and the pennant on the wind move
    const moving = await page.evaluate(() => (window.__game.scene.getScene('terrace') as unknown as { animators: unknown[] }).animators.length);
    expect(moving).toBeGreaterThan(3);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'keriMap');
    expectNoErrors(errors);
  });

  test('ft_1_19.AC2 ft_1_19.AC5 the village square is locked for a new player; opened, its clouds move, and Back returns to the map', async ({ page }) => {
    const errors = await toRoom(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    // level 2 opens the square: a new player at level 1 has no button for it
    expect(await sceneButton(page, 'keriMap', 'The village square')).toBe(-1);
    await page.evaluate(() => { const g = window.__game; g.scene.stop('keriMap'); g.scene.start('square'); });
    await waitForScene(page, 'square');
    // the drifting clouds and what stands before them move
    const moving = await page.evaluate(() => (window.__game.scene.getScene('square') as unknown as { animators: unknown[] }).animators.length);
    expect(moving).toBeGreaterThan(1);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'keriMap');
    expectNoErrors(errors);
  });

  test('ft_1_19.AC10 the harbour: a press on the water pans down to the reef under the quay, Back rises again, and Back once more returns to the map', async ({ page }) => {
    const errors = await toRoom(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    await page.evaluate(() => { const g = window.__game; g.scene.stop('keriMap'); g.scene.start('port'); });
    await waitForScene(page, 'port');
    const labelled = (text: string) => page.waitForFunction((t) => (window.__game.scene.getScene('port').buttons as { options: { label: string } }[]).some((b) => b.options.label === t), text);
    // the boats rock, the clouds drift, the sea and the lamp move
    const moving = await page.evaluate(() => (window.__game.scene.getScene('port') as unknown as { animators: unknown[] }).animators.length);
    expect(moving).toBeGreaterThan(4);
    await clickButton(page, 'port', await sceneButton(page, 'port', 'Dive in'));
    await labelled('Back up');
    expect(await sceneButton(page, 'port', 'Dive in')).toBe(-1);
    // down there Back rises first
    await page.keyboard.press('Escape');
    await labelled('Dive in');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'keriMap');
    expectNoErrors(errors);
  });

  test('ft_1_24.AC3 with ?actors=1 the knoll stands the demo cast on its places: Kiur, the template villager cast from its features, and the placeholder as its labelled box', async ({ page }) => {
    const errors = await toRoom(page, 'en', '&actors=1');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    await clickButton(page, 'keriMap', await sceneButton(page, 'keriMap', 'Grassy knoll'));
    await waitForScene(page, 'knoll');
    const cast = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('knoll') as unknown as { children: { list: unknown[] } };
      const names: string[] = [];
      const walk = (list: unknown[]): void => {
        for (const o of list as { name?: string; list?: unknown[] }[]) {
          if (o.name?.startsWith('actor:')) names.push(o.name);
          if (o.list) walk(o.list);
        }
      };
      walk(scene.children.list);
      return names;
    });
    // Kiur talks in two frames, the villager idles in four, the placeholder is one box
    expect(cast.filter((n) => n === 'actor:kiur')).toHaveLength(2);
    expect(cast.filter((n) => n === 'actor:villager')).toHaveLength(4);
    expect(cast.filter((n) => n === 'actor:placeholder')).toHaveLength(1);
    expect(await sceneTexts(page, 'knoll')).toContain('placeholder');
    expect(await sceneTexts(page, 'knoll')).not.toContain('villager');
    await page.screenshot({ path: 'test-logs/art/knoll-actors.png' });
    expectNoErrors(errors);
  });

  test('ft_1_18.AC2 ft_1_18.AC4 the map of Keri is one painted picture with the sea in two looks, a lamp, three clouds and its painted name; the house and the open scene are its buttons, on the picture', async ({ page }) => {
    // by day, so the map's gulls fly (they rest at night, ft_1_19.AC13); the real hour made this test depend on the clock
    const errors = await toRoom(page, 'en', '&sky=day');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    const seen = () =>
      page.evaluate(() => {
        const scene = window.__game.scene.getScene('keriMap') as unknown as {
          px: { width: number; height: number };
          animators: unknown[];
          buttons: { rect: { x: number; y: number; width: number; height: number }; options: { label: string } }[];
          toolbarButtons: { back: unknown; settings: unknown };
          root: { list: { type: string; visible: boolean; x: number; y: number; width: number; height: number; scaleX: number }[] };
        };
        const fine = scene.root.list.filter((o) => o.type === 'Image' && o.scaleX === 0.5);
        return {
          size: scene.px,
          // the whole map: as large as the main area, in fine pixels
          maps: fine.filter((o) => o.width === scene.px.width * 2 && o.height === scene.px.height * 2).map((o) => o.visible),
          // the clouds: wide, low pictures (under the band no toolbar beam stands above the map; a cloud's middle may lie above its top)
          clouds: fine.filter((o) => o.height < 70 && o.width > 80).map((o) => o.x),
          animators: scene.animators.length,
          // on the picture: not the door, the gear and the backpack over its corners (ft_1_20)
          buttons: scene.buttons.filter((b) => b !== scene.toolbarButtons.back && b !== scene.toolbarButtons.settings && b.options.label !== 'Backpack').map((b) => b.rect).filter((r) => r.y >= 0 && r.y < scene.px.height),
        };
      });
    const first = await seen();
    // the sea has two looks, which dissolve into each other: one or both show, by the moment
    expect(first.maps).toHaveLength(2);
    expect(first.maps).toContain(true);
    expect(first.clouds).toHaveLength(3);
    // the sea, the lamp, the gulls' flock (ft_1_19.AC13) and three clouds move
    expect(first.animators).toBe(6);
    // the warden's house and the knoll (ft_1_19.AC2: the one scene a new player has open)
    expect(first.buttons).toHaveLength(2);
    for (const b of first.buttons) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(first.size.width);
      expect(b.y + b.height).toBeLessThanOrEqual(first.size.height);
    }
    // a cloud drifts east
    await expect.poll(async () => (await seen()).clouds[2]!, { timeout: 20_000 }).toBeGreaterThan(first.clouds[2]!);
    expectNoErrors(errors);
  });

  test('ft_1_08.AC9 the room lives: the fire, its light, the sea, the steam, the metronome and Kiur change frame while the room is open', async ({ page }) => {
    const errors = await toRoom(page);
    // every moving thing is a stack of frames of which one shows; a frame changing means the scene's animators run
    const shown = () =>
      page.evaluate(() => {
        const scene = window.__game.scene.getScene('profile') as unknown as { animators: unknown[]; root: { list: { type: string; visible: boolean }[] } };
        return { animators: scene.animators.length, visible: scene.root.list.map((o) => (o.visible ? '1' : '0')).join('') };
      });
    const first = await shown();
    expect(first.animators).toBeGreaterThanOrEqual(6);
    await expect.poll(async () => (await shown()).visible, { timeout: 15_000 }).not.toBe(first.visible);
    expectNoErrors(errors);
  });

  test('ft_1_17.AC1 the window is no button: the room\'s objects are the piano, the door and the stand (d117, ft_1_08.AC6)', async ({ page }) => {
    const errors = await toRoom(page);
    expect(await sceneButton(page, 'profile', 'Go for a walk')).toBe(-1);
    for (const name of ['Piano', 'Door']) expect(await sceneButton(page, 'profile', name)).toBeGreaterThanOrEqual(0);
    expectNoErrors(errors);
  });

  test('ft_1_17.AC3 ft_1_17.AC4 left idle for two minutes the room visits the knoll by itself, and a key comes back (d117)', async ({ page }) => {
    const errors = await toRoom(page);
    // make the room believe its last input was long ago: the scene clock is the one `update` gets
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('profile') as unknown as { lastInput: number; time: { now: number } };
      scene.lastInput = scene.time.now - 121_000;
    });
    await waitForScene(page, 'knoll');
    expect(await page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { visiting: boolean }).visiting)).toBe(true);
    // a key does nothing in the scene but go home
    await letGameRun(page, 3, 50);
    await page.keyboard.press('KeyQ');
    await waitForScene(page, 'profile');
    expectNoErrors(errors);
  });

  test('ft_1_17.AC3 a tap ends a visit, and the knoll opened from the map is no visit: a key there does not go home (d117)', async ({ page }) => {
    const errors = await toRoom(page);
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('profile') as unknown as { lastInput: number; time: { now: number } };
      scene.lastInput = scene.time.now - 121_000;
    });
    await waitForScene(page, 'knoll');
    await letGameRun(page, 3, 50);
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
    await waitForScene(page, 'profile');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Door'));
    await waitForScene(page, 'keriMap');
    await clickButton(page, 'keriMap', await sceneButton(page, 'keriMap', 'Grassy knoll'));
    await waitForScene(page, 'knoll');
    expect(await page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { visiting: boolean }).visiting)).toBe(false);
    await page.keyboard.press('KeyQ');
    await letGameRun(page, 5, 50);
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))).toContain('knoll');
    expectNoErrors(errors);
  });

  test('ft_1_09.AC2 ft_1_09.AC3 the rank shield of the player\'s level hangs over the piano, and its card shows the level and XP (ft_1_20.AC13)', async ({ page }) => {
    const errors = await toRoom(page);
    const piano = await sceneButton(page, 'profile', 'Piano');
    const { shields, rect } = await page.evaluate((i) => {
      // the shield is drawn on the fine grid (48 x 48 at half size, d110), one picture for each rank, of which one shows
      const scene = window.__game.scene.getScene('profile') as unknown as {
        buttons: { rect: { x: number; y: number; width: number; height: number } }[];
        root: { list: { type: string; visible: boolean; x: number; y: number; width: number; height: number; scaleX: number }[] };
      };
      const all = scene.root.list.filter((o) => o.type === 'Image' && o.width === 48 && o.height === 48 && o.scaleX === 0.5);
      return { shields: all.map((o) => ({ shown: o.visible, x: o.x, y: o.y })), rect: scene.buttons[i]!.rect };
    }, piano);
    expect(shields).toHaveLength(20);
    const shown = shields.filter((s) => s.shown);
    expect(shown).toHaveLength(1);
    // a new player is level 1: the first shield, over the piano
    expect(shields[0]!.shown).toBe(true);
    expect(shown[0]!.y + 24).toBeLessThanOrEqual(rect.y + 2);
    expect(shown[0]!.x + 12).toBeGreaterThan(rect.x);
    expect(shown[0]!.x + 12).toBeLessThan(rect.x + rect.width);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Your card'));
    await expect.poll(() => sceneTexts(page, 'profile')).toContain('Level 1');
    expect((await sceneTexts(page, 'profile')).some((t) => /XP/.test(t))).toBe(true);
    expectNoErrors(errors);
  });

  test('ft_1_18.AC3 the room is a painted picture in the middle of the screen, and every object\'s button lies on the picture (ft_1_20)', async ({ page }) => {
    const errors = await toRoom(page);
    const { looks, sky, buttons, height } = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('profile') as unknown as {
        px: { width: number; height: number };
        buttons: { rect: { x: number; y: number; width: number; height: number }; options: { label: string } }[];
        toolbarButtons: { back: unknown; settings: unknown };
        root: { list: { type: string; visible: boolean; x: number; y: number; width: number; height: number; scaleX: number }[] };
      };
      const images = scene.root.list.filter((o) => o.type === 'Image');
      const looks = images.filter((o) => o.width === 640 && o.height === 248).map((o) => ({ shown: o.visible, x: o.x, y: o.y }));
      const sky = images.filter((o) => o.width === scene.px.width * 2 && o.height === scene.px.height * 2).length;
      // not the door, the gear and the backpack over the picture's corners (ft_1_20)
      const own = scene.buttons.filter((b) => b !== scene.toolbarButtons.back && b !== scene.toolbarButtons.settings && b.options.label !== 'Backpack').map((b) => b.rect);
      return { looks, sky, buttons: own.filter((r) => r.y >= 0 && r.y < scene.px.height), height: scene.px.height };
    });
    // the sky behind the whole screen, then one picture for each strength of the fire's light:
    // one of them shows, or two while the light dissolves from one strength into the next
    expect(sky).toBe(1);
    expect(looks).toHaveLength(3);
    const shown = looks.filter((l) => l.shown).length;
    expect(shown).toBeGreaterThanOrEqual(1);
    expect(shown).toBeLessThanOrEqual(2);
    const picture = { x: looks[0]!.x, y: looks[0]!.y, w: 320, h: 124 };
    // with no strip (nothing pinned, ft_1_20.AC21) the picture stands in the middle of the screen, the sky round it (d111)
    expect(picture.y).toBe(Math.floor((height - picture.h) / 2));
    // piano, door, stand, the shield, which opens the player's card (ft_1_20.AC13), Kiur the trainer (ft_1_21.AC14) and
    // the wall telephone (ft_1_34); the window is no button since d117
    expect(buttons).toHaveLength(6);
    for (const b of buttons) {
      expect(b.x).toBeGreaterThanOrEqual(picture.x);
      expect(b.y).toBeGreaterThanOrEqual(picture.y);
      expect(b.x + b.width).toBeLessThanOrEqual(picture.x + picture.w);
      expect(b.y + b.height).toBeLessThanOrEqual(picture.y + picture.h);
    }
    expectNoErrors(errors);
  });

  for (const [lang, names] of [['en', ['Piano', 'Door', 'Exercises']], ['et', ['Klaver', 'Uks', 'Harjutused']]] as const) {
    test(`ft_1_08.AC6 the piano, door and stand are the buttons (the book and the gramophone are gone), their names hidden at rest (${lang})`, async ({ page }) => {
      const errors = await toRoom(page, lang);
      expect(await Promise.all(names.map((n) => sceneButton(page, 'profile', n)))).toEqual([0, 1, 2]);
      expect(await sceneButton(page, 'profile', lang === 'en' ? 'Book' : 'Raamat')).toBe(-1);
      expect(await sceneButton(page, 'profile', lang === 'en' ? 'Ear training' : 'Kõrvaharjutus')).toBe(-1);
      const texts = await sceneTexts(page, 'profile');
      for (const n of names) expect(texts).not.toContain(n);
      expectNoErrors(errors);
    });
  }

  test('ft_1_08.AC7 an object\'s name shows in a bubble above it after the pointer rests on it, and goes when it leaves', async ({ page }) => {
    const errors = await toRoom(page);
    const piano = await sceneButton(page, 'profile', 'Piano');
    const c = await buttonPoint(page, 'profile', piano);
    await page.mouse.move(c.x, c.y);
    await expect.poll(() => tooltipOf(page, piano), { timeout: 10_000 }).toBe('Piano');
    const { bubble, rect } = await bubbleOf(page, piano);
    expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(rect.y);
    await page.mouse.move(2, 2);
    await expect.poll(() => tooltipOf(page, piano)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_20.AC15 an object wakes into its second look while the pointer is on it and rests again when it leaves; one object wakes at a time', async ({ page }) => {
    const errors = await toRoom(page);
    // each object's second look is a frame for each strength of the fire, clear (alpha 0) while the object rests; of an
    // awake object's frames the one of the fire's strength of the moment shows. Kiur woken on the bed is one more frame, clear while he sleeps; he can be woken only once a character is met (tug.spec)
    const awake = () =>
      page.evaluate(() => {
        const list = (window.__game.scene.getScene('profile') as unknown as { root: { list: { name: string; visible: boolean; alpha: number }[] } }).root.list;
        const frames = list.filter((o) => o.name.startsWith('awake:'));
        return { frames: frames.length, woken: [...new Set(frames.filter((o) => o.alpha === 1).map((o) => o.name.split(':')[1]))], seen: frames.filter((o) => o.alpha === 1 && o.visible).length };
      });
    expect(await awake()).toEqual({ frames: 10, woken: [], seen: 0 });
    for (const [label, thing] of [['Piano', 'piano'], ['Door', 'door'], ['Exercises', 'easel']] as const) {
      const c = await buttonPoint(page, 'profile', await sceneButton(page, 'profile', label));
      await page.mouse.move(c.x, c.y);
      await expect.poll(awake, thing).toEqual({ frames: 10, woken: [thing], seen: 1 });
    }
    await page.mouse.move(2, 2);
    await expect.poll(awake).toEqual({ frames: 10, woken: [], seen: 0 });
    expectNoErrors(errors);
  });

  test('ft_1_08.AC7 the arrow keys move between the objects, the chosen one shows its ring and name at once, Enter opens it', async ({ page }) => {
    const errors = await toRoom(page);
    await page.keyboard.press('ArrowRight');
    const seen = new Set<string>();
    for (let step = 0; step < 12 && !seen.has('Door'); step++) {
      const at = await focused(page);
      expect(at).toBeGreaterThanOrEqual(0);
      const name = await tooltipOf(page, at);
      expect(name).not.toBeNull();
      seen.add(name!);
      // the door is on the right wall (ft_1_18.AC3): rightward from the piano
      if (name !== 'Door') await page.keyboard.press('ArrowRight');
    }
    expect(seen).toContain('Door');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'keriMap'); // the door opens the map of Keri (ft_1_18.AC2)
    expectNoErrors(errors);
  });

  test('ft_1_08.AC6 ft_1_08.AC11 the stand opens its panel of trainers and the piano the piece list (ft_1_12)', async ({ page }) => {
    const errors = await toRoom(page);
    await openFromStand(page, 'Note names');
    await waitForScene(page, 'noteTrainer');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'profile');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Piano'));
    await waitForScene(page, 'menu');
    expectNoErrors(errors);
  });

  /** The stand's panel as drawn: whether it is open, its pictures' names, and the buttons the keyboard reaches. */
  const standState = (page: Page) =>
    page.evaluate(() => {
      const scene = window.__game.scene.getScene('profile') as unknown as {
        standOpen: boolean;
        focusables(): { options: { label: string } }[];
        root: { list: { name: string; type: string; visible: boolean }[] };
      };
      return {
        open: scene.standOpen,
        pictures: scene.root.list.filter((o) => o.name.startsWith('stand:')).map((o) => o.name),
        darkened: scene.root.list.some((o) => o.type === 'Rectangle' && (o as unknown as { fillAlpha: number }).fillAlpha > 0),
        reach: scene.focusables().map((b) => b.options.label),
      };
    });

  test('ft_1_08.AC11 the stand opens a panel over the room, not darkened, with one picture per trainer whose names are not written; the keyboard reaches only them', async ({ page }) => {
    const errors = await toRoom(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Exercises'));
    await expect.poll(() => standState(page)).toEqual({ open: true, pictures: ['stand:notes', 'stand:ear', 'stand:shapes', 'stand:chords'], darkened: false, reach: ['Note names', 'Ear training', 'Scales and chords', 'Chord from its name'] });
    // still the room, with no text under the pictures
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).map((x) => x.scene.key))).toContain('profile');
    const texts = await sceneTexts(page, 'profile');
    for (const name of ['Note names', 'Ear training']) expect(texts).not.toContain(name);
    // the name shows in the bubble after the pointer rests on the picture
    const ear = await sceneButton(page, 'profile', 'Ear training');
    const c = await buttonPoint(page, 'profile', ear);
    await page.mouse.move(c.x, c.y);
    await expect.poll(() => tooltipOf(page, ear), { timeout: 10_000 }).toBe('Ear training');
    await page.mouse.click(c.x, c.y);
    await waitForScene(page, 'earTrainer');
    expectNoErrors(errors);
  });

  test('ft_1_08.AC11 Esc or a press beside the panel closes it and leaves the player in the room', async ({ page }) => {
    const errors = await toRoom(page);
    const stand = async () => clickButton(page, 'profile', await sceneButton(page, 'profile', 'Exercises'));
    await stand();
    await expect.poll(async () => (await standState(page)).open).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await standState(page)).open).toBe(false);
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).map((x) => x.scene.key))).toContain('profile');
    await stand();
    await expect.poll(async () => (await standState(page)).open).toBe(true);
    // a press on the room beside the panel: the top-left corner of the main area
    const corner = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('profile') as unknown as { root: { x: number; y: number }; px: { scale: number } };
      return { x: scene.root.x + 4 * scene.px.scale, y: scene.root.y + 4 * scene.px.scale };
    });
    await page.mouse.click(corner.x, corner.y);
    await expect.poll(async () => (await standState(page)).open).toBe(false);
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).map((x) => x.scene.key))).toContain('profile');
    expectNoErrors(errors);
  });
});

test.describe('the room window sky (ft_1_14.AC8)', () => {
  test('ft_1_14.AC8 ?sky=dusk gives the room window the dusk phase; the room decides it when it opens', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&sky=dusk', 'en', 'profiles');
    await page.evaluate(() => window.__game.scene.start('profile'));
    await waitForScene(page, 'profile');
    const phase = await page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { look: { phase: string } | null }).look?.phase);
    expect(phase).toBe('dusk');
    expectNoErrors(errors);
  });
});

interface RoomTalk { who: 'kiur' | 'teacher'; text: string; page: number; index: number }
const roomTalk = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { talkState: RoomTalk | null }).talkState);
const pressTalk = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { pressTalk(): void }).pressTalk());

/** Little Steps on the first player's curriculum, due `inDays` from today (the player's local day), priority 5. */
async function onCurriculum(page: Page, inDays: number): Promise<void> {
  await page.evaluate(async (days) => {
    const { profiles } = window.__game.registry.get('context');
    const d = new Date(Date.now() + days * 86_400_000);
    const deadline = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const id = profiles.profiles[0].id;
    const ok = await profiles.saveCurriculum(id, { base: 85, pieces: [{ piece: 'little-steps', deadline, priority: 5 }], calendar: [], testWeekdays: [] });
    if (!ok) throw new Error('the curriculum was not saved');
  }, inDays);
}

/** Everything said in the room now, pressed through; returns the lines read. */
async function readTalk(page: Page): Promise<RoomTalk[]> {
  const said: RoomTalk[] = [];
  for (let i = 0; i < 12; i++) {
    const now = await roomTalk(page);
    if (now === null) break;
    said.push(now);
    await pressTalk(page);
  }
  return said;
}

test.describe("Kiur and the teacher speak in the room (ft_1_27, WP-15)", () => {
  test('ft_1_27.AC3 on opening the game Kiur reminds of the curriculum piece, naming it and its plays; once a day at that gap', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await onCurriculum(page, 30);
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    await expect.poll(() => roomTalk(page)).not.toBeNull();
    const said = await readTalk(page);
    expect(said.map((l) => l.who)).toEqual(['kiur']);
    expect(said[0]!.text).toBe('Little Steps: 0 of 3 plays so far. Then we can see how it goes.');
    expect(await roomTalk(page)).toBeNull();
    // the room again the same day: the reminder was said today, and the boat is far away
    await page.evaluate(() => window.__game.scene.start('profile'));
    await waitForScene(page, 'profile');
    await letGameRun(page, 5, 300);
    expect(await roomTalk(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_27.AC2 on the deadline day the teacher asks for the piece, the student plays it once in Wait mode, and she says the measured result', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await onCurriculum(page, 0);
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    await expect.poll(() => roomTalk(page)).not.toBeNull();
    const said = await readTalk(page);
    // on opening the game Kiur reminds (the heads-ups are for later visits), then she speaks
    expect(said.map((l) => l.who)).toEqual(['kiur', 'teacher']);
    expect(said[1]!.text).toBe('The deadline is today. Play this for me: Little Steps.');
    // her line read to the end opens the piano with her piece, in Wait mode, with no section or tempo to pick
    await waitForScene(page, 'practice');
    expect(await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { transport: unknown }).transport)).toBeNull();
    await letGameRun(page, 5, 200);
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await waitForScene(page, 'profile');
    await expect.poll(() => roomTalk(page)).not.toBeNull();
    const verdict = await readTalk(page);
    expect(verdict.map((l) => l.who)).toEqual(['teacher', 'teacher']);
    expect(verdict[0]!.text).toBe('Score 100, I expected 90.');
    expect(verdict[1]!.text).toBe('The piece is learned.');
    const visits = await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      return ((await profiles.worldOf(profiles.profile.id)) as { teacherVisits: unknown[] }).teacherVisits;
    });
    expect(visits).toEqual([{ day: expect.any(String), piece: 'little-steps', result: 'passed' }]);
    // she passed it: on the next visit nobody speaks of it
    await page.evaluate(() => window.__game.scene.start('profile'));
    await waitForScene(page, 'profile');
    await letGameRun(page, 5, 300);
    expect(await roomTalk(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_26.AC9 a test ordered for a time: before it she is not there; at it she comes into the room while the student is there', async ({ page }) => {
    // a Monday, ten seconds before the test she ordered for the fixture's evening (the room's clock runs on from `now`):
    // Kiur's reminder must be over by then, or she comes on the next visit
    const errors = await openGame(page, '?device=virtual&now=1998-11-23T16:59:50', 'en', 'profiles');
    await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      const ok = await profiles.saveCurriculum(profiles.profiles[0].id, {
        base: 85, pieces: [{ piece: 'little-steps', deadline: '1998-12-20', priority: 5 }], calendar: [{ day: '1998-11-23', kind: 'test', time: '17:00' }], testWeekdays: [],
      });
      if (!ok) throw new Error('the curriculum was not saved');
    });
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    await expect.poll(() => roomTalk(page)).not.toBeNull();
    expect((await readTalk(page)).map((l) => l.who)).toEqual(['kiur']);
    expect(await roomTalk(page)).toBeNull();
    await expect.poll(() => roomTalk(page), { timeout: 20_000 }).not.toBeNull();
    const said = await readTalk(page);
    expect(said.map((l) => l.who)).toEqual(['kiur', 'teacher']);
    expect(said[0]!.text).toBe("The teacher's boat has landed. She is waiting for you at the piano.");
    expect(said[1]!.text).toBe('27 days to the deadline. Play this for me: Little Steps.');
    await waitForScene(page, 'practice');
    expectNoErrors(errors);
  });

  test('ft_1_27.AC2 Back while the check-up pass shows its score still brings the play to the teacher', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await onCurriculum(page, 0);
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    await expect.poll(() => roomTalk(page)).not.toBeNull();
    await readTalk(page);
    await waitForScene(page, 'practice');
    await letGameRun(page, 5, 200);
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await letGameRun(page, 3);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'profile');
    await expect.poll(() => roomTalk(page)).not.toBeNull();
    expect((await readTalk(page)).map((l) => l.text)).toEqual(['Score 100, I expected 90.', 'The piece is learned.']);
    expectNoErrors(errors);
  });

  test('ft_1_27.AC2 Back during the check-up returns to the room, where the teacher still waits', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await onCurriculum(page, 0);
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    await expect.poll(() => roomTalk(page)).not.toBeNull();
    await readTalk(page);
    await waitForScene(page, 'practice');
    await letGameRun(page, 5, 200);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'profile');
    await expect.poll(() => roomTalk(page)).not.toBeNull();
    const said = await readTalk(page);
    expect(said.at(-1)!.who).toBe('teacher');
    expectNoErrors(errors);
  });
});

test.describe('the telephone in the room (ft_1_34)', () => {
  test('ft_1_34.AC3 the telephone rings for the teacher\'s new piece, and a press opens it to be learned bar by bar', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&learn=1', 'en', 'profiles');
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    // quiet with no curriculum
    await expect.poll(() => sceneButton(page, 'profile', 'Telephone')).toBeGreaterThanOrEqual(0);
    // the teacher gives Little Steps; the room is opened again and reads it
    await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      await profiles.saveCurriculum(profiles.profile.id, { base: 85, calendar: [], testWeekdays: [], pieces: [{ piece: 'little-steps', deadline: '2999-12-20', priority: 5 }] });
      window.__game.scene.stop('profile');
      window.__game.scene.start('profile');
    });
    await waitForScene(page, 'profile');
    const ringing = 'The telephone rings: the teacher has a new piece';
    await expect.poll(() => sceneButton(page, 'profile', ringing), { timeout: 10_000 }).toBeGreaterThanOrEqual(0);
    // what Kiur says on the visit is read first
    const talking = () => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { talkState: unknown }).talkState !== null);
    for (let i = 0; i < 10 && (await talking()); i++) await page.keyboard.press('Space');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', ringing));
    await waitForScene(page, 'practice');
    const learning = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice') as unknown as { learn: { run: { firstBar: number } } | null; fullChart: { id: string } };
      return { piece: scene.fullChart.id, firstBar: scene.learn?.run.firstBar ?? null };
    });
    expect(learning).toEqual({ piece: 'little-steps', firstBar: 0 });
    expectNoErrors(errors);
  });
});
