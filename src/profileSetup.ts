import progressionJson from '../content/curriculum/progression.json';
import { ProfileRepository, TEST_PLAYER_NAMES, parseProgressionConfig } from './core/progression';
import type { PieceCatalogue } from './game/pieceCatalogue';
import { ProfileService } from './game/profile/ProfileService';
import { chooseSaveStore, type ChosenStore } from './io/storage/chooseSaveStore';
import { openIndexedDbStore } from './io/storage/IndexedDbStore';
import { LocalStorageStore } from './io/storage/LocalStorageStore';
import { MemoryStore } from './io/storage/MemoryStore';
import { webPlayerLock } from './io/storage/playerLock';

export const progressionConfig = parseProgressionConfig(progressionJson);

let chosen: Promise<ChosenStore> | null = null;

/**
 * Saves for the page, chosen once: IndexedDB, with saves from localStorage moved across the first time.
 * If IndexedDB will not open, localStorage; if that is blocked too, memory (progress then lasts only until the page closes).
 */
export function chooseStore(): Promise<ChosenStore> {
  return (chosen ??= chooseSaveStore({
    openIdb: () => openIndexedDbStore(indexedDB),
    local: localStoreIfAllowed(),
    onIdbOpened: () => void askToKeepSaves(),
  }));
}

function localStoreIfAllowed(): LocalStorageStore | null {
  try {
    const storage = window.localStorage;
    const probe = 'pianor/probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return new LocalStorageStore(storage);
  } catch {
    return null;
  }
}

/** Asks Chrome not to evict saves under disk pressure. Best effort: the answer only changes how long saves are kept. */
async function askToKeepSaves(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported or refused: saves still work, they are just not protected.
  }
}

/**
 * Composition root for saves: the profile service on top of the chosen store. `testPlayers` (dev only, `?players=test`): a new install gets the four test players; else it makes none and the game asks for
 * the first player's name (ft_1_07.AC1). `inSongs` names the pieces that belong to a song (ft_1_36 rule 13).
 */
export async function createProfileService(pieces: PieceCatalogue, testPlayers = false, inSongs: () => ReadonlySet<string> = () => new Set()): Promise<{ service: ProfileService; persistent: boolean }> {
  const { store, persistent } = await chooseStore();
  const service = await ProfileService.create({
    repository: new ProfileRepository(store, progressionConfig, { seedNames: testPlayers ? TEST_PLAYER_NAMES : [] }),
    askFirstPlayer: !testPlayers,
    config: progressionConfig,
    // a song's pieces are not in the piece book, so they never count as the piece that keeps it from going empty
    catalogue: () => pieces.list().filter((p) => !inSongs().has(p.chart.id)).map((p) => ({ id: p.chart.id })),
    // one player in one window at a time: a second tab cannot write over the first one's progress (d159)
    lock: webPlayerLock(),
  });
  return { service, persistent };
}

/** A player that lives only in memory, for dev pages that play pieces without touching anyone's saved progress. */
export async function createMemoryProfileService(): Promise<ProfileService> {
  return ProfileService.create({
    repository: new ProfileRepository(new MemoryStore(), progressionConfig),
    config: progressionConfig,
    catalogue: () => [],
  });
}
