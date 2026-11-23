import { expect, test, type Page } from '@playwright/test';
import { TEST_PLAYER_NAMES } from '../../src/core/progression/repository';
import { QWERTY_OFFSETS } from '../../src/io/mock/QwertyKeyboard';
import { FIXTURE_TIME } from '../../tools/test/fixtureTime';
import { E2E_GPU } from './targetView';

/** The dev-only handles `src/main.ts` puts on `window`. Typed loosely: tests poke at private scene fields on purpose. */
/* eslint-disable @typescript-eslint/no-explicit-any */
interface PhaserScene {
  scene: { key: string };
  [field: string]: any;
}
declare global {
  interface Window {
    __game: {
      scene: { getScenes(active: boolean): PhaserScene[]; getScene(key: string): PhaserScene; start(key: string, data?: unknown): void; stop(key: string): void };
      registry: { get(key: string): any };
      loop: { frame: number };
      /** The game's own events, such as 'poststep' after every step of the game loop. */
      events: { on(event: string, listener: () => void): void };
      /** Paused while the window is smaller than the laptop's full screen (d105). */
      isPaused: boolean;
    };
    /** `timeStamp` is a DOM time (`performance.now()`), as on a real MIDI event; it defaults to now. */
    __virtualDevice: { press(midi: number, velocity?: number, timeStamp?: number): void; release(midi: number, timeStamp?: number): void } | null;
  }
}

/** The player every test plays as: the first of the test players `?players=test` makes, and the name screenshots show. */
export const E2E_PLAYER: string = TEST_PLAYER_NAMES[0];

/** A fixed moment for screenshot tests, so a picture never shows the day it was made (a date on the score graph). */
export const E2E_FIXED_TIME = FIXTURE_TIME;

/** Fail unless the player on the page is `E2E_PLAYER`, so a screenshot baseline never holds another name. */
export async function expectE2EPlayer(page: Page): Promise<void> {
  const name = await page.evaluate(() => (window.__game.registry.get('context').profiles.profile as { name: string }).name);
  expect(name).toBe(E2E_PLAYER);
}

/** Errors the page reports. Call `expectNoErrors` at the end of a test. */
export interface PageErrors {
  list: string[];
}

/**
 * Opens the game. Tests read the English text (ft_0_18), so the page gets `lang=en` unless `lang` says otherwise: `null`
 * leaves the switch out, so the game opens in its default language (Estonian).
 */
/** One line of music on the screen for the active player (the default is two), for tests about the one-line page. Call it before opening a piece. */
export async function useOneLine(page: Page): Promise<void> {
  await page.evaluate(() => window.__game.registry.get('context').profiles.updateStaffSettings({ lines: 1 }));
}

export async function openGame(page: Page, query = '?device=virtual', lang: 'en' | 'et' | null = 'en', stopAt: 'menu' | 'profiles' = 'menu'): Promise<PageErrors> {
  const errors: PageErrors = { list: [] };
  // The whole browser console goes into the run log of a test that fails (tools/e2e/runLogReporter.ts).
  const info = test.info();
  const consoleLines: string[] = [];
  page.on('pageerror', (e) => {
    errors.list.push(`pageerror: ${e.message}`);
    consoleLines.push(`pageerror: ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.list.push(`console: ${m.text()}`);
    consoleLines.push(`${m.type()}: ${m.text().slice(0, 500)}`);
  });
  page.on('close', () => {
    if (info.status !== info.expectedStatus) void info.attach('console', { body: consoleLines.join('\n'), contentType: 'text/plain' });
  });
  const params = new URLSearchParams(query);
  if (lang !== null) params.set('lang', lang);
  // a new piece is learned bar by bar first (ft_1_32); the tests that play whole pieces open them as before, and a test of
  // the learning asks for it with `learn=1`
  if (!params.has('learn')) params.set('learn', '0');
  // Without a GPU, Chrome copies every frame the game draws on an animation frame back from its software GPU before the page
  // may run anything else, so each step of a save or a load waited a whole frame (about 80 ms; listing the players took 2 s).
  // Stepped on a timer the game draws as many frames and the page stays free between them (`?loop=timer`, src/config.ts).
  if (!E2E_GPU && !params.has('loop')) params.set('loop', 'timer');
  // every page starts with a new player, who would get the first-run intro (ft_1_31): only its own tests ask for it
  if (!params.has('intro')) params.set('intro', '0');
  // a new install asks for the first player's name (ft_1_07.AC1); the tests start on the four test players instead
  if (!params.has('players')) params.set('players', 'test');
  await page.goto(`/?${params.toString()}`);
  // Ready means the piano has loaded and, unless autoplay drives the game, the main menu (who is playing) is on screen. With
  // `?autoplay=1` the director may leave the menu before the piano has loaded, so waiting for both at one moment could hang.
  await page.waitForFunction(() => {
    const g = window.__game;
    if (!g || g.registry.get('context')?.audio?.piano?.loaded !== true) return false;
    return new URLSearchParams(location.search).get('autoplay') === '1'
      || g.scene.getScenes(true).some((s) => (s.scene.key === 'profiles' || s.scene.key === 'menu') && (s as unknown as { loading?: boolean }).loading !== true);
  });
  // The main menu is where a page starts now. Most tests want the piece list, so they get there through the player's room.
  if (stopAt === 'menu' && (await activeScenes(page)).includes('profiles')) await toPieceList(page);
  return errors;
}

/**
 * After the last note of a piece: the piece loops (ft_1_12), so wait until the pass's score shows past the last bar, then
 * leave with Escape as a player would and wait for the score screen. Returns at once when the score screen is already up.
 */
export async function toScoreScreen(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const g = window.__game;
    const active = g.scene.getScenes(true).map((s) => s.scene.key);
    if (active.includes('results')) return true;
    const practice = g.scene.getScene('practice') as unknown as { pendingPass: unknown };
    return active.includes('practice') && practice.pendingPass !== null;
  });
  if (!(await activeScenes(page)).includes('results')) await page.keyboard.press('Escape');
  await waitForScene(page, 'results');
}

/** From the main menu, through the first player's room, to the piano: the piece list. */
export async function toPieceList(page: Page): Promise<void> {
  await waitForScene(page, 'profiles');
  await clickButton(page, 'profiles', 0); // the first player
  await waitForScene(page, 'profile');
  await clickButton(page, 'profile', 0); // the piano
  await waitForScene(page, 'menu');
}

/**
 * The index of the button with this label on a scene shown now, or -1. A label that is not on the screen may be an option
 * of the bubble (ft_1_20, d282): the bubble is opened from More (as a player would press it) and its options are looked at too.
 */
export async function sceneButton(page: Page, sceneKey: string, label: string): Promise<number> {
  // a cell keeps its whole word in its tooltip too, so the label and tooltip count
  const find = () => page.evaluate(
    ({ key, text }) => (window.__game.scene.getScene(key).buttons as { objects: { text?: string }[]; options: { label: string; tooltip?: string } }[])
      .findIndex((b) => b.objects.some((o) => o.text === text) || b.options.label === text || b.options.tooltip === text),
    { key: sceneKey, text: label },
  );
  const found = await find();
  if (found >= 0) return found;
  const opened = await openBubbleFromMore(page, sceneKey);
  return opened ? find() : -1;
}

/** Press More on the scene's strip, as a player would, when it has one; true when the bubble opened. */
export async function openBubbleFromMore(page: Page, sceneKey: string): Promise<boolean> {
  const more = await page.evaluate(
    (key) => (window.__game.scene.getScene(key).buttons as { options: { label: string } }[]).findIndex((b) => b.options.label === 'More' || b.options.label === 'Veel'),
    sceneKey,
  );
  if (more < 0) return false;
  await clickButton(page, sceneKey, more);
  return page.evaluate((key) => (window.__game.scene.getScene(key) as unknown as { bubbleIsOpen: boolean }).bubbleIsOpen, sceneKey);
}

/**
 * In the player's room: press the stand, which opens its panel of trainers (ft_1_08.AC11), then the picture named `name`
 * ("Note names", "Ear training"), which opens its trainer.
 */
export async function openFromStand(page: Page, name: string): Promise<void> {
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Exercises'));
  await expect.poll(() => sceneButton(page, 'profile', name)).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', name));
}

/** From the piece list: the toolbar's Back goes to the player's room, and the room's Back to the main menu (d088). */
export async function goToMainMenu(page: Page): Promise<void> {
  await clickButton(page, 'menu', await menuButton(page, 'Back'));
  await waitForScene(page, 'profile');
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Back'));
  await waitForScene(page, 'profiles');
}

/** The key of the scene shown now (the first running one). */
export function activeScene(page: Page): Promise<string> {
  return page.evaluate(() => window.__game.scene.getScenes(true)[0]!.scene.key);
}

/** Press one of the toolbar's global buttons on the screen shown now (d088), with a real click. */
export async function clickToolbar(page: Page, which: 'back' | 'settings' | 'keys'): Promise<void> {
  const key = await activeScene(page);
  const index = await page.evaluate(({ k, w }) => {
    const scene = window.__game.scene.getScene(k) as unknown as { buttons: unknown[]; toolbarButtons: Record<string, unknown> };
    return scene.buttons.indexOf(scene.toolbarButtons[w]);
  }, { k: key, w: which });
  if (index < 0) throw new Error(`No ${which} on the toolbar of ${key}`);
  await clickButton(page, key, index);
}

/**
 * The index in `buttons` of the band's action `n` on scene `key` (ft_1_20: its cells in order, 0 the first): the score
 * screen's play again (0) and back to the pieces (1), a trainer's step or loop. The door and the gear are not actions.
 */
export async function bandAction(page: Page, key: string, n: number): Promise<number> {
  await page.waitForFunction(({ k, i }) => (window.__game.scene.getScene(k) as unknown as { toolbarButtons: { items: unknown[] } }).toolbarButtons.items.length > i, { k: key, i: n });
  return page.evaluate(({ k, i }) => {
    const scene = window.__game.scene.getScene(k) as unknown as { buttons: unknown[]; toolbarButtons: { items: unknown[] } };
    return scene.buttons.indexOf(scene.toolbarButtons.items[i]);
  }, { k: key, i: n });
}

/** Open the settings screen from the screen shown now with the toolbar's gear (it holds the on-screen keyboard's switch, d099). */
export async function openSettings(page: Page): Promise<void> {
  await clickToolbar(page, 'settings');
  await waitForScene(page, 'settings');
}

/** Chrome says this on machines whose audio device is busy or missing; it is not a fault of the game (see CLAUDE.md). */
const KNOWN_NOISE = /AudioContext encountered an error from the audio device/;

export function expectNoErrors(errors: PageErrors): void {
  const real = errors.list.filter((message) => !KNOWN_NOISE.test(message));
  expect(real, real.join('\n')).toEqual([]);
}

export async function activeScenes(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
}

/** Waits until the scene `key` runs and its painted picture has loaded (`loading`, d143): its buttons are then all there. */
export async function waitForScene(page: Page, key: string): Promise<void> {
  await page.waitForFunction((k) => window.__game.scene.getScenes(true).some((s) => s.scene.key === k && (s as unknown as { loading?: boolean }).loading !== true), key);
}

/**
 * All visible texts of a scene: how tests read the canvas without screenshots. Pixel-art texts (`PixelText`, which keep
 * their string in `text`) and plain Phaser texts, also inside containers such as the pixel scenes' root.
 */
export async function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    type Node = { type: string; text?: string; pixelText?: boolean; visible: boolean; list?: Node[] };
    const found: string[] = [];
    const visit = (nodes: Node[]) => {
      for (const o of nodes) {
        if (!o.visible) continue;
        if ((o.type === 'Text' || o.pixelText === true) && typeof o.text === 'string') found.push(o.text);
        if (o.type === 'Container' && o.list) visit(o.list);
      }
    };
    visit(window.__game.scene.getScene(k).children.list as Node[]);
    return found;
  }, key);
}

/**
 * What a scene says: its visible texts and, after them, every button's word and tooltip (a picture's word is hidden). Under the band (ft_1_20) a cell or item says
 * its state in its tooltip bubble (the piano's name, the BPM, the section), not in a line of text.
 */
export async function sceneWords(page: Page, key: string): Promise<string[]> {
  const tips = await page.evaluate((k) => (window.__game.scene.getScene(k).buttons as { options: { label: string; tooltip?: string } }[]).flatMap((b) => [b.options.label, ...(b.options.tooltip ? [b.options.tooltip] : [])]), key);
  return [...(await sceneTexts(page, key)), ...tips];
}

/**
 * Click a button of a scene (`buttons[index]`) with the real mouse, at its on-screen position. Phaser handles the click on
 * its next frame, so this waits two frames: whatever the test reads next already shows the click's effect.
 */
/** The middle of a scene's button on the page, for the real mouse: the canvas starts below the toolbar. */
export function buttonPoint(page: Page, sceneKey: string, index: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ key, i }) => {
      const scene = window.__game.scene.getScene(key);
      const center = scene.buttons[i].screenCenter() as { x: number; y: number };
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + (center.x / canvas.width) * rect.width, y: rect.top + (center.y / canvas.height) * rect.height };
    },
    { key: sceneKey, i: index },
  );
}

export async function clickButton(page: Page, sceneKey: string, index: number): Promise<void> {
  const point = await buttonPoint(page, sceneKey, index);
  const frame = await page.evaluate(() => window.__game.loop.frame);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction((f) => window.__game.loop.frame >= f + 2, frame);
}

/**
 * Click a button whose press saves something and then draws the screen again (a setting, the note naming), and wait until the screen
 * is drawn again. Such a screen redraws only once the save has finished, which can take longer than a couple of frames on a slow
 * machine (a cloud container, CI), so reading its buttons right after `clickButton` would find the old ones.
 */
export async function clickAndRedraw(page: Page, sceneKey: string, index: number): Promise<void> {
  await page.evaluate((k) => {
    for (const b of window.__game.scene.getScene(k).buttons as { beforeRedraw?: boolean }[]) b.beforeRedraw = true;
  }, sceneKey);
  await clickButton(page, sceneKey, index);
  await page.waitForFunction(
    (k) => (window.__game.scene.getScene(k).buttons as { beforeRedraw?: boolean }[]).every((b) => b.beforeRedraw !== true),
    sceneKey,
  );
}

/** The computer-keyboard key (physical code) that plays `midi` when the Z key is `base` (middle C by default). */
export function codeForMidi(midi: number, base = 60): string {
  const entry = Object.entries(QWERTY_OFFSETS).find(([, offset]) => base + offset === midi);
  if (!entry) throw new Error(`No computer key plays MIDI ${midi} with the base ${base}`);
  return entry[0];
}

/** Play notes with the computer keyboard (the mock keyboard). */
export async function playWithKeys(page: Page, midis: number[]): Promise<void> {
  for (const midi of midis) await page.keyboard.press(codeForMidi(midi));
}

/**
 * Play steps of a two-hand piece with the computer keyboard moved one octave down (Z = C3), so the left hand's
 * C3..G3 are on the lower row and the right hand's C4..G4 on the upper row. A step is the keys that go together.
 */
export async function playStepsWithKeys(page: Page, steps: number[][]): Promise<void> {
  await page.keyboard.press('ArrowLeft');
  for (const step of steps) {
    for (const midi of step) await page.keyboard.down(codeForMidi(midi, 48));
    for (const midi of step) await page.keyboard.up(codeForMidi(midi, 48));
  }
}

/**
 * Play steps through the virtual EZ-220's MIDI bytes. `gapMs` 0 presses all keys of a step at the same instant (hands
 * together); a gap longer than the judge's 300 ms window plays one key, waits, then the next (hands apart).
 */
export async function playStepsWithVirtualPiano(page: Page, steps: number[][], gapMs = 0): Promise<void> {
  const press = (keys: number[]) =>
    page.evaluate((notes) => {
      for (const m of notes) window.__virtualDevice!.press(m, 80);
      for (const m of notes) window.__virtualDevice!.release(m);
    }, keys);
  for (const step of steps) {
    if (gapMs === 0) await press(step);
    else {
      for (const [k, midi] of step.entries()) {
        if (k > 0) await page.waitForTimeout(gapMs);
        await press([midi]);
      }
    }
  }
}

/** Play notes through the virtual EZ-220's MIDI bytes and the real Web MIDI wrapper. */
export async function playWithVirtualPiano(page: Page, midis: number[]): Promise<void> {
  await page.evaluate((notes) => {
    for (const midi of notes) {
      window.__virtualDevice!.press(midi, 80);
      window.__virtualDevice!.release(midi);
    }
  }, midis);
}

/** Little Steps: C D E F | G F | F E D C | C */
export const LITTLE_STEPS = [60, 62, 64, 65, 67, 65, 65, 64, 62, 60, 60];

/** The index of a player's button on the profiles screen (ft_1_07, slice 2), by the name on it. */
/**
 * Opens the admin page from the profiles screen, through its password gate: types the default password. The gate
 * does not take the mouse, so the keys go to the page. Within 30 minutes of the password there is no gate (ft_1_07.AC8).
 */
export async function openAdminPage(page: Page, password = 'pianor'): Promise<void> {
  await pickUnderGear(page, 'Admin');
  await page.waitForFunction(() => window.__game.scene.getScenes(true).some((s) => s.scene.key === 'adminGate' || s.scene.key === 'admin'));
  if (await page.evaluate(() => window.__game.scene.getScenes(true).some((s) => s.scene.key === 'adminGate'))) {
    await waitForScene(page, 'adminGate');
    await page.keyboard.type(password);
    await page.keyboard.press('Enter');
  }
  await waitForScene(page, 'admin');
}

/** The name box's letters are buttons 0 to 29 in NAME_LETTERS order; Done is 31. */
const NAME_LETTER_ORDER = 'ABCDEFGHIJKLMNOPRSŠZŽTUVÕÄÖÜXY';
/** The name box's Done: a band action since ft_1_20 (after the 30 letters, the door and Delete). */
export const nameDone = (page: Page): Promise<number> => sceneButton(page, 'name', 'DONE');

/** Types `name` (capitals from the name box's letters) on the name box and presses Done. */
export async function typeName(page: Page, name: string): Promise<void> {
  await waitForScene(page, 'name');
  for (const letter of name) await clickButton(page, 'name', NAME_LETTER_ORDER.indexOf(letter));
  await clickButton(page, 'name', await nameDone(page));
}

/** On the main menu Credits and Admin are under the gear: opens the gear's menu and picks `label` from it. */
export async function pickUnderGear(page: Page, label: string): Promise<void> {
  await clickButton(page, 'profiles', await profileButton(page, 'Settings'));
  await clickButton(page, 'profiles', await profileButton(page, label));
}

/** From the profiles screen: New player (the outlined "+" in the next free place), a name typed on the name box (ft_1_07.AC10), and the new player's room. */
export async function addPlayer(page: Page, name: string): Promise<void> {
  await clickButton(page, 'profiles', await profileButton(page, 'New player'));
  await typeName(page, name);
  await waitForScene(page, 'profile');
}

/** The index of a player's button on the profiles screen (its label is the player's name). */
export async function profileButton(page: Page, name: string): Promise<number> {
  return page.evaluate(
    (t) => (window.__game.scene.getScene('profiles').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === t)),
    name,
  );
}

/** Choose a player on the main menu, then open their piano: the piece list. */
export async function pickProfile(page: Page, name: string): Promise<void> {
  await waitForScene(page, 'profiles');
  await clickButton(page, 'profiles', await profileButton(page, name));
  await waitForScene(page, 'profile');
  await clickButton(page, 'profile', 0); // the piano
  await waitForScene(page, 'menu');
}

/** The index of the menu button with this label on the page shown now, or -1. */
export async function menuButton(page: Page, label: string): Promise<number> {
  return page.evaluate(
    (t) => (window.__game.scene.getScene('menu').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === t)),
    label,
  );
}

/** The labels of the menu's buttons: Back and Settings, then the pieces of this page, then Previous and Next when paged. */
export async function menuLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => (window.__game.scene.getScene('menu').buttons as { objects: { text?: string }[] }[]).map((b) => b.objects[1]?.text ?? ''));
}

/** True for a piece card's label, false for the menu's own buttons (a picture button such as the Back door shows no text). */
export const isPieceLabel = (label: string) => label !== '' && !['Previous', 'Next', 'Back', 'Settings', '+ New piece'].includes(label);

/** Go back to the first page of the menu, clicking Previous as a player would. */
/** The menu's Previous or Next in either language (the band leaves fewer cards on a page, so Estonian runs turn pages too). */
async function pagerButton(page: Page, which: 'Previous' | 'Next'): Promise<number> {
  const words = which === 'Next' ? ['Next', 'Järgmine', 'JÄRGMINE'] : ['Previous', 'Eelmine', 'EELMINE'];
  for (const word of words) {
    const index = await menuButton(page, word);
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * Turn the menu's page with a real click on its Previous or Next and wait for the new page. A page turn restarts the menu
 * scene, which can take longer than the two frames `clickButton` waits on a busy machine, so reading the labels right after
 * the click could still find the old page (a piece list read twice, seen with three and four browsers at once).
 */
export async function turnMenuPage(page: Page, index: number): Promise<void> {
  await clickAndRedraw(page, 'menu', index);
  await waitForScene(page, 'menu');
}

async function rewindMenu(page: Page): Promise<void> {
  for (let turn = 0; turn < 20; turn++) {
    const previous = await pagerButton(page, 'Previous');
    if (previous < 0) return;
    const off = await page.evaluate((i) => (window.__game.scene.getScene('menu').buttons[i] as { disabled: boolean }).disabled, previous);
    if (off) return;
    await turnMenuPage(page, previous);
  }
}

/** Turn to the page of the menu that has a button with this label (from the first page, clicking Next) and return its index. */
export async function showMenuPageWith(page: Page, label: string): Promise<number> {
  await rewindMenu(page);
  for (let turn = 0; turn < 20; turn++) {
    const index = await menuButton(page, label);
    if (index >= 0) return index;
    const next = await pagerButton(page, 'Next');
    expect(next, `"${label}" is in the menu`).toBeGreaterThanOrEqual(0);
    // the last page's Next is disabled and redraws nothing: `turnMenuPage` would wait for the test's timeout
    if (await page.evaluate((i) => (window.__game.scene.getScene('menu').buttons[i] as { disabled: boolean }).disabled, next)) break;
    await turnMenuPage(page, next);
  }
  throw new Error(`"${label}" is not on any page of the menu`);
}

/** Open a piece from the menu with a real click, turning to the page it is on first. */
export async function openPiece(page: Page, title: string): Promise<void> {
  await clickButton(page, 'menu', await showMenuPageWith(page, title));
  await waitForScene(page, 'practice');
}

/** Every piece title in the menu, page by page, from the first page to the last. */
export async function allMenuTitles(page: Page): Promise<string[]> {
  await rewindMenu(page);
  const titles: string[] = [];
  for (let turn = 0; turn < 20; turn++) {
    titles.push(...(await menuLabels(page)).filter(isPieceLabel));
    const next = await pagerButton(page, 'Next');
    const off = next < 0 || (await page.evaluate((i) => (window.__game.scene.getScene('menu').buttons[i] as { disabled: boolean }).disabled, next));
    if (off) break;
    await turnMenuPage(page, next);
  }
  return titles;
}

export async function results(page: Page): Promise<{ accuracy: number; mistakes: number; notes: number; firstTryCorrect: number; hints: { noteNames: number; fingers: number } }> {
  return page.evaluate(() => window.__game.scene.getScene('results').result);
}

/**
 * Let the game run at least `frames` frames and `ms` milliseconds. For a check that something did not happen: a slow machine
 * runs fewer frames in the same time, so waiting on frames too keeps the check from passing before the game had a chance.
 */
export async function letGameRun(page: Page, frames: number, ms = 0): Promise<void> {
  const start = await page.evaluate(() => window.__game.loop.frame);
  const until = Date.now() + ms;
  await page.waitForFunction((f) => window.__game.loop.frame >= f, start + frames);
  const left = until - Date.now();
  if (left > 0) await page.waitForTimeout(left);
}

/** Click the practice screen's button with this label with the real mouse (a pinned action, or an option of the bubble). */
export async function pressPracticeButton(page: Page, label: string): Promise<void> {
  const index = await sceneButton(page, 'practice', label);
  expect(index, `a button ${label}`).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'practice', index);
}

/** The active player's total XP. */
export const totalXp = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.progress.totalXp as number);
/** A piece's own XP (ft_1_13), 0 before it was ever finished. */
export const pieceXp = (page: Page, pieceId: string) => page.evaluate((id) => (window.__game.registry.get('context').profiles.recordFor(id)?.xp ?? 0) as number, pieceId);

/** The active player's name. */
export const playerName = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.profile.name as string);
