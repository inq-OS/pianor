// Covers ft_1_32.AC6, ft_1_11.AC1, ft_0_10.AC6, ft_1_02c.AC1, ft_1_02c.AC3, ft_1_02c.AC4.
import { describe, expect, it } from 'vitest';
import progressionJson from '../../content/curriculum/progression.json';
import type { PieceResult } from '../../src/core/judge';
import { ProfileRepository, parseProgressionConfig, type BarPlay, type KeyValueStore } from '../../src/core/progression';
import { ProfileService } from '../../src/game/profile/ProfileService';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const config = parseProgressionConfig(progressionJson);
const CATALOGUE = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

const result = (chartId: string, accuracy = 1): PieceResult => ({
  chartId, contentVersion: 1, notes: 10, firstTryCorrect: Math.round(accuracy * 10), mistakes: 0, accuracy, rhythmErrorMs: null,
  hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
});

async function setup(store: KeyValueStore = new MemoryStore()) {
  let tick = 0;
  const repository = new ProfileRepository(store, config, {
    now: () => new Date(Date.UTC(1998, 9, 5, 10, tick++)),
    idFactory: (() => { let n = 0; return () => `id-${++n}`; })(),
  });
  const service = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, now: () => new Date('1998-10-05T12:00:00.000Z') });
  return { service, store, repository };
}

describe('ProfileService', () => {
  it('ft_1_07.AC1: a new install makes no player, and nothing is written until the first name is given', async () => {
    const store = new MemoryStore();
    const repository = new ProfileRepository(store, config, { idFactory: (() => { let n = 0; return () => `id-${++n}`; })() });
    const service = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, askFirstPlayer: true });
    expect(service.needsFirstPlayer).toBe(true);
    expect(service.profiles).toEqual([]);
    // a change before the name holds in memory only: the stand-in never becomes a saved player
    expect(await service.updateStaffSettings({ lines: 1 })).toBe(false);
    expect(await service.setPieceOn('a', false)).toMatchObject({ saved: false });
    expect(await service.saveWorld(service.profile.id, { flags: ['intro.started'], items: [], met: {}, teacherVisits: [] })).toBe(false);
    expect(await store.keys('')).toEqual([]);
    expect(await service.createPlayer('ANNA')).toBe('ok');
    expect(service.needsFirstPlayer).toBe(false);
    expect(service.profile.name).toBe('ANNA');
    expect(service.profiles.map((p) => p.name)).toEqual(['ANNA']);
    // the next start finds that one player and asks nothing
    const again = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, askFirstPlayer: true });
    expect(again.needsFirstPlayer).toBe(false);
    expect(again.profile.name).toBe('ANNA');
  });

  it('ft_1_07.AC1: a start whose only saves cannot be read makes no player either: it asks for a name and keeps the damaged save', async () => {
    const store = new MemoryStore();
    await store.set('pianor/v1/player/old/profile', '{ not json');
    const repository = new ProfileRepository(store, config, { idFactory: (() => { let n = 0; return () => `id-${++n}`; })() });
    const service = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, askFirstPlayer: true });
    expect(service.needsFirstPlayer).toBe(true);
    expect(service.profiles).toEqual([]);
    expect(service.damaged.map((d) => d.id)).toEqual(['old']);
    expect((await store.keys('pianor/v1/player/')).filter((k) => !k.startsWith('pianor/v1/player/old/'))).toEqual([]);
  });

  it('starts with a fresh "Player 1" at level 1 with nothing finished', async () => {
    const { service } = await setup();
    expect(service.profile.name).toBe('Player 1');
    expect(service.progress).toMatchObject({ totalXp: 0, level: { level: 1 } });
    expect(service.recordFor('a')).toBeUndefined();
    expect(service.profiles.map((p) => p.name)).toEqual(['Player 1']);
  });

  it('a second "New player" tap while the first is still saving makes no second player', async () => {
    const { service } = await setup();
    await Promise.all([service.createPlayer(), service.createPlayer()]);
    expect(service.profiles.map((p) => p.name)).toEqual(['Player 1', 'Player 2']);
  });

  it('ft_1_13.AC2: finishing a piece earns the piece XP, not the player, keeps the record and reports the events', async () => {
    const { service } = await setup();
    const outcome = await service.completePiece(result('a'));
    expect(outcome.saved).toBe(true);
    expect(outcome.events.map((e) => e.type)).toEqual(['XpAwarded']);
    expect(outcome.after.totalXp).toBe(0);
    expect(service.progress.totalXp).toBe(0);
    expect(service.recordFor('a')).toMatchObject({ completions: 1, bestStars: 3, xp: 70 });
  });

  it('ft_1_13.AC3: practice never levels the player up, so it announces no level and no piece', async () => {
    const { service } = await setup();
    await service.completePiece(result('a'));
    const outcome = await service.completePiece(result('b'));
    expect(outcome.events.map((e) => e.type)).toEqual(['XpAwarded']);
    expect(service.progress.level.level).toBe(1);
  });

  it('progress survives a restart on the same storage', async () => {
    const store = new MemoryStore();
    const first = (await setup(store)).service;
    await first.completePiece(result('a', 0.8));
    const second = (await setup(store)).service;
    expect(second.profile.id).toBe(first.profile.id);
    expect(second.recordFor('a')?.xp).toBe(64);
    expect(second.recordFor('a')?.bestStars).toBe(2);
  });

  it('keeps the attempt for this session and says so when the save fails', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    store.set = () => Promise.reject(new Error('QuotaExceededError'));
    const outcome = await service.completePiece(result('a'));
    expect(outcome.saved).toBe(false);
    expect(service.recordFor('a')?.xp).toBe(70);
  });

  it('adds players, switches between them, and keeps their progress apart', async () => {
    const { service } = await setup();
    await service.completePiece(result('a'));
    await service.createPlayer();
    expect(service.profile.name).toBe('Player 2');
    expect(service.progress.totalXp).toBe(0);
    expect(service.profiles.map((p) => p.name)).toEqual(['Player 1', 'Player 2']);
    await service.completePiece(result('b'));

    await service.switchToNext();
    expect(service.profile.name).toBe('Player 1');
    expect(service.recordFor('a')?.xp).toBe(70);
    await service.switchToNext();
    expect(service.profile.name).toBe('Player 2');
    expect(service.recordFor('b')?.xp).toBe(70);
    expect(service.recordFor('a')).toBeUndefined();
  });

  it('switching with one player does nothing, and switching to a missing player fails quietly', async () => {
    const { service } = await setup();
    await service.switchToNext();
    expect(service.profile.name).toBe('Player 1');
    expect(await service.switchTo('nope')).toBe('unreadable');
    expect(service.profile.name).toBe('Player 1');
  });

  it('the active player is remembered across restarts', async () => {
    const store = new MemoryStore();
    const first = (await setup(store)).service;
    await first.createPlayer('Sam');
    const second = (await setup(store)).service;
    expect(second.profile.name).toBe('Sam');
  });

  it('exports the active player and imports it as a new or replacing player', async () => {
    const { service } = await setup();
    await service.completePiece(result('a'));
    const text = await service.exportActive();

    const other = (await setup()).service; // another device
    expect(await other.importPlayer(text, 'new')).toEqual({ ok: true });
    expect(other.recordFor('a')?.xp).toBe(70);
    expect(other.profiles).toHaveLength(2);

    await other.completePiece(result('b'));
    expect(await other.importPlayer(text, 'replace')).toEqual({ ok: true });
    expect(other.recordFor('a')?.xp).toBe(70);
    expect(other.recordFor('b')).toBeUndefined();
  });

  it('a new player starts with the default staff settings: two lines, bars chosen automatically', async () => {
    const { service } = await setup();
    expect(service.staffSettings).toEqual({ lines: 2, barsPerLine: 'auto' });
  });

  it('changed staff settings are saved, survive a restart, and belong to the player who changed them', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    expect(await service.updateStaffSettings({ lines: 2 })).toBe(true);
    expect(await service.updateStaffSettings({ barsPerLine: 4 })).toBe(true);
    expect(service.staffSettings).toEqual({ lines: 2, barsPerLine: 4 });

    await service.createPlayer();
    expect(service.staffSettings).toEqual({ lines: 2, barsPerLine: 'auto' });
    await service.updateStaffSettings({ lines: 'all' });

    const restarted = (await setup(store)).service; // the second player is active
    expect(restarted.staffSettings).toEqual({ lines: 'all', barsPerLine: 'auto' });
    await restarted.switchToNext();
    expect(restarted.profile.name).toBe('Player 1');
    expect(restarted.staffSettings).toEqual({ lines: 2, barsPerLine: 4 });
  });

  it('ft_Y_12.AC3: the on-screen keyboard is shown for a new player, a hidden one is saved, survives a restart, and belongs to its player', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    expect(service.keyboardSettings).toEqual({ onScreen: true });
    expect(await service.updateKeyboardSettings({ onScreen: false })).toBe(true);
    expect(service.keyboardSettings).toEqual({ onScreen: false });

    await service.createPlayer();
    expect(service.keyboardSettings).toEqual({ onScreen: true });

    const restarted = (await setup(store)).service; // the second player is active
    expect(restarted.keyboardSettings).toEqual({ onScreen: true });
    await restarted.switchToNext();
    expect(restarted.profile.name).toBe('Player 1');
    expect(restarted.keyboardSettings).toEqual({ onScreen: false });
  });

  it('tells its listeners when the keyboard choice may have changed: a new choice, a new player, another player', async () => {
    const { service } = await setup(new MemoryStore());
    const seen: boolean[] = [];
    service.onKeyboardSettings(() => seen.push(service.keyboardSettings.onScreen));
    await service.updateKeyboardSettings({ onScreen: false });
    await service.createPlayer();
    await service.switchToNext();
    expect(seen).toEqual([false, true, false]);
  });

  it('ft_Y_12.AC3: the keyboard choice is kept for this session when the save fails, and an invalid one is refused', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    const set = store.set.bind(store);
    store.set = () => Promise.reject(new Error('QuotaExceededError'));
    expect(await service.updateKeyboardSettings({ onScreen: false })).toBe(false);
    expect(service.keyboardSettings).toEqual({ onScreen: false });
    store.set = set;
    await expect(service.updateKeyboardSettings({ onScreen: 'no' as never })).rejects.toThrow();
    expect(service.keyboardSettings).toEqual({ onScreen: false });
  });

  it('keeps changed settings for this session and says so when the save fails, and never saves invalid ones', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    const set = store.set.bind(store);
    store.set = () => Promise.reject(new Error('QuotaExceededError'));
    expect(await service.updateStaffSettings({ lines: 2 })).toBe(false);
    expect(service.staffSettings.lines).toBe(2);
    store.set = set;
    await expect(service.updateStaffSettings({ lines: 3 as never })).rejects.toThrow();
    expect(service.staffSettings.lines).toBe(2);
  });

  it('play mode and bar numbers are saved per player, survive a restart, and an invalid choice is refused', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    expect(service.playSettings).toEqual({ mode: 'wait', scoreView: 'colour' });
    expect(service.barNumberSettings).toEqual({ mode: 'off' });
    expect(await service.updatePlaySettings({ mode: 'tempo' })).toBe(true);
    expect(await service.updateBarNumberSettings({ mode: 'every2' })).toBe(true);
    await expect(service.updatePlaySettings({ mode: 'fast' as never })).rejects.toThrow();
    await expect(service.updateBarNumberSettings({ mode: 'every3' as never })).rejects.toThrow();
    expect(service.playSettings).toEqual({ mode: 'tempo', scoreView: 'colour' }); // a partial change keeps the rest

    const restarted = (await setup(store)).service;
    expect(restarted.playSettings.mode).toBe('tempo');
    expect(restarted.barNumberSettings).toEqual({ mode: 'every2' });
    await restarted.createPlayer();
    expect(restarted.playSettings.mode).toBe('wait');
    expect(restarted.barNumberSettings).toEqual({ mode: 'off' });
  });

  it('finger numbers: off, top or all is saved per player and survives a restart; an older save with only chordFingers reads as off', async () => {
    const store = new MemoryStore();
    const { service, repository } = await setup(store);
    expect(service.fingerNumbers).toBe('off');
    expect(service.showFingers).toBe(false);
    await service.updateFingerNumbers('top');
    expect(service.fingerNumbers).toBe('top');
    expect(service.showFingers).toBe(true);
    expect(service.chordFingers).toBe(false);
    await service.updateFingerNumbers('all');
    expect(service.fingerNumbers).toBe('all');
    expect(service.chordFingers).toBe(true);
    await service.updateFingerNumbers('off');
    expect(service.fingerNumbers).toBe('off');
    await service.updateFingerNumbers('all');
    const restarted = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, now: () => new Date('1998-10-05T12:00:00.000Z') });
    expect(restarted.fingerNumbers).toBe('all');
    await restarted.createPlayer();
    expect(restarted.fingerNumbers).toBe('off');
  });

  it('finger numbers: an older save with only chordFingers true reads as OFF on the gear screen', async () => {
    const { service, repository } = await setup();
    const loaded = await repository.load(service.profile.id);
    if (!loaded.ok) throw new Error('the new player should load');
    const older = { ...loaded.profile, settings: { ...loaded.profile.settings, chordFingers: true } };
    delete (older.settings as { showFingers?: boolean }).showFingers;
    await repository.save(older);
    const restarted = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, now: () => new Date('1998-10-05T12:00:00.000Z') });
    expect(restarted.chordFingers).toBe(true);
    expect(restarted.fingerNumbers).toBe('off');
    expect(restarted.showFingers).toBe(false);
  });

  it('ft_1_32.AC8 saves the learning progress without its measured runs when those do not parse: the step is never lost', async () => {
    const { service } = await setup();
    const kept = { step: 2, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: ['gold' as const, 'gold' as const], lastDay: '1998-11-22' };
    const tests = [{ day: '1998-11-22', step: 1, bpm: 60, sd: Number.NaN, mad: 0, drift: 0, halts: 0, steady: true }];
    expect(await service.saveLearnProgress('a', { ...kept, tests })).toBe(true);
    expect(service.learnProgressOf('a')).toEqual(kept);
  });

  it('learning a piece (ft_1_32): progress per piece and the learning settings survive a restart; an older save reads as nothing started', async () => {
    const { service, repository } = await setup();
    expect(service.learnSettings).toEqual({ stepBars: 1, markers: true, markersFrom: 2 });
    expect(service.learnProgressOf('a')).toEqual({ step: 0, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: [], lastDay: null });
    const progress = { step: 3, wholeStreak: 0, recall: false, confirm: true, misses: 1, medals: ['gold', 'silver', 'gold'] as const, lastDay: '1998-11-22', bpm: [60, 72], unsteady: 1,
      tests: [{ day: '1998-11-22', step: 2, bpm: 60, sd: 12, mad: 9, drift: -4, halts: 0, steady: true }] };
    expect(await service.saveLearnProgress('a', { ...progress, medals: [...progress.medals] })).toBe(true);
    expect(await service.updateLearnSettings({ stepBars: 2, markersFrom: 1 })).toBe(true);
    const restarted = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, now: () => new Date('1998-10-05T12:00:00.000Z') });
    expect(restarted.learnProgressOf('a')).toEqual(progress);
    expect(restarted.learnProgressOf('b').step).toBe(0);
    expect(restarted.learnSettings).toEqual({ stepBars: 2, markers: true, markersFrom: 1 });
    await expect(restarted.updateLearnSettings({ markersFrom: 9 })).rejects.toThrow();
    // a save from before ft_1_32 has neither field
    const loaded = await repository.load(restarted.profile.id);
    if (!loaded.ok) throw new Error('the player should load');
    const older = { ...loaded.profile, settings: { ...loaded.profile.settings } };
    delete (older as { learning?: unknown }).learning;
    delete (older.settings as { learn?: unknown }).learn;
    await repository.save(older);
    const oldSave = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, now: () => new Date('1998-10-05T12:00:00.000Z') });
    expect(oldSave.learnProgressOf('a').step).toBe(0);
    expect(oldSave.learnSettings.stepBars).toBe(1);
  });

  it('saves the gap between the staves per player; a new player starts with the short gap', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    expect(service.staffGap).toBe('short');
    expect(await service.updateStaffGap('wide')).toBe(true);
    await expect(service.updateStaffGap('tall' as never)).rejects.toThrow();
    expect(service.staffGap).toBe('wide');
    const restarted = (await setup(store)).service;
    expect(restarted.staffGap).toBe('wide');
    await restarted.createPlayer();
    expect(restarted.staffGap).toBe('short');
  });

  it('ft_1_11.AC1: the note duration helper is off in both hands for a new player and an old save, is saved per hand and player, and survives a restart', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    expect(service.durationHelp).toEqual({ RH: 'off', LH: 'off' });
    // a save written before the helper existed has no field: it still loads, as off (no version bump, d069.3)
    expect('durationHelp' in service.profile.settings).toBe(false);
    expect(await service.updateDurationHelp({ LH: 'band' })).toBe(true);
    expect(await service.updateDurationHelp({ RH: 'ghost' })).toBe(true);
    await expect(service.updateDurationHelp({ LH: 'feet' as never })).rejects.toThrow();
    expect(service.durationHelp).toEqual({ RH: 'ghost', LH: 'band' });
    const restarted = (await setup(store)).service;
    expect(restarted.durationHelp).toEqual({ RH: 'ghost', LH: 'band' });
    await restarted.createPlayer();
    expect(restarted.durationHelp).toEqual({ RH: 'off', LH: 'off' });
  });

  it('a finished battle adds its XP, is saved, and shows in progress after a restart', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    const outcome = await service.completeBattle({ monsterId: 'wobble', pieceId: 'a', won: false, hpTaken: 10, maxHp: 20, potentialXp: 30, rounds: 1, playerHpLeft: 0, playerMaxHp: 100, xp: 8 });
    expect(outcome.saved).toBe(true);
    expect(outcome.events.map((e) => e.type)).toEqual(['BattleFinished']);
    expect(service.progress.totalXp).toBe(8);
    const restarted = (await setup(store)).service;
    expect(restarted.progress.totalXp).toBe(8);
    expect(restarted.profile.battles).toHaveLength(1);
  });

  it('reports why an import failed and leaves the active player alone', async () => {
    const { service } = await setup();
    const failed = await service.importPlayer('not json', 'new');
    expect(failed.ok).toBe(false);
    expect(service.profile.name).toBe('Player 1');
  });

  it('ft_1_02c.AC1: every piece starts on; one turned off is saved, survives a restart, and belongs to the player who turned it off', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    expect(CATALOGUE.map((p) => service.isPieceOn(p.id))).toEqual([true, true, true]);
    expect(await service.setPieceOn('b', false)).toEqual({ changed: true, saved: true });
    expect(CATALOGUE.map((p) => service.isPieceOn(p.id))).toEqual([true, false, true]);

    await service.createPlayer();
    expect(CATALOGUE.map((p) => service.isPieceOn(p.id))).toEqual([true, true, true]);
    await service.setPieceOn('c', false);

    const restarted = (await setup(store)).service; // the second player is active
    expect(restarted.hiddenPieces).toEqual(['c']);
    await restarted.switchToNext();
    expect(restarted.profile.name).toBe('Player 1');
    expect(restarted.hiddenPieces).toEqual(['b']);
    expect(await restarted.setPieceOn('b', true)).toEqual({ changed: true, saved: true });
    expect(restarted.hiddenPieces).toEqual([]);
  });

  it('ft_1_02c.AC4: turning a piece off keeps its stars and XP, and turning it on shows them again', async () => {
    const { service } = await setup();
    await service.completePiece(result('a', 0.8));
    const before = { record: service.recordFor('a'), xp: service.progress.totalXp, attempts: service.profile.attempts.length };
    await service.setPieceOn('a', false);
    expect(service.recordFor('a')).toEqual(before.record);
    expect(service.progress.totalXp).toBe(before.xp);
    await service.setPieceOn('a', true);
    expect(service.recordFor('a')).toEqual(before.record);
    expect(service.profile.attempts).toHaveLength(before.attempts);
  });

  it('ft_1_02c.AC3: the last piece that is on cannot be turned off, and a piece id that no longer exists is ignored', async () => {
    const { service } = await setup(new MemoryStore());
    await service.setPieceOn('a', false);
    await service.setPieceOn('b', false);
    expect(service.canTurnOff('c')).toBe(false);
    expect(await service.setPieceOn('c', false)).toEqual({ changed: false, saved: true });
    expect(service.isPieceOn('c')).toBe(true);
    expect(service.canTurnOff('a')).toBe(true);

    const stale = (await setup(new MemoryStore())).service;
    await stale.setPieceOn('gone', false); // not a piece on offer: remembered, harmless
    expect(CATALOGUE.map((p) => stale.isPieceOn(p.id))).toEqual([true, true, true]);
    expect(stale.canTurnOff('a')).toBe(true);
  });

  it('ft_1_02c.AC3: the last piece that is on cannot be turned off (no piece is locked by level, ft_1_13.AC3)', async () => {
    const { service } = await setup();
    expect(await service.setPieceOn('a', false)).toEqual({ changed: true, saved: true });
    expect(await service.setPieceOn('b', false)).toEqual({ changed: true, saved: true });
    expect(service.canTurnOff('c')).toBe(false);
    expect(await service.setPieceOn('c', false)).toEqual({ changed: false, saved: true });
    expect(service.isPieceOn('c')).toBe(true);
  });

  it('keeps the change for this session and says so when saving it fails', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    store.set = () => Promise.reject(new Error('QuotaExceededError'));
    expect(await service.setPieceOn('a', false)).toEqual({ changed: true, saved: false });
    expect(service.isPieceOn('a')).toBe(false);
  });

});

describe('ft_1_07.AC6: rename and delete a player (admin)', () => {
  it('renames the player, trimmed, and refuses a blank name', async () => {
    const { service } = await setup();
    expect(await service.renamePlayer(service.profile.id, '  TUVI ')).toBe('ok');
    expect(service.profile.name).toBe('TUVI');
    expect(service.profiles.map((p) => p.name)).toEqual(['TUVI']);
    expect(await service.renamePlayer(service.profile.id, '   ')).toBe('blank');
    expect(service.profile.name).toBe('TUVI');
  });

  it('ft_1_07.AC10 refuses a name another player has, but a player may keep their own', async () => {
    const { service } = await setup();
    await service.createPlayer('VINT');
    expect(await service.renamePlayer(service.profile.id, 'player 1')).toBe('taken');
    expect(service.profile.name).toBe('VINT');
    expect(await service.renamePlayer(service.profile.id, 'vint')).toBe('ok');
    expect(service.profile.name).toBe('vint');
  });

  it('will not delete the last player', async () => {
    const { service } = await setup();
    expect(await service.deletePlayer(service.profile.id)).toBe(false);
    expect(service.profiles).toHaveLength(1);
  });

  it('deleting a player who is not active keeps the active one', async () => {
    const { service } = await setup();
    const first = service.profile.id;
    await service.createPlayer('Second');
    const second = service.profile.id;
    expect(await service.deletePlayer(first)).toBe(true);
    expect(service.profile.id).toBe(second);
    expect(service.profiles.map((p) => p.id)).toEqual([second]);
  });

  it('deleting the active player makes the first remaining player active', async () => {
    const { service } = await setup();
    const first = service.profile.id;
    await service.createPlayer('Second');
    expect(await service.deletePlayer(service.profile.id)).toBe(true);
    expect(service.profile.id).toBe(first);
    expect(service.profiles.map((p) => p.name)).toEqual(['Player 1']);
  });
  it('updateCampaign keeps the campaign state for the active player and reports it saved (ft_1_06 phase 1)', async () => {
    const { service } = await setup();
    const next = { ...service.campaign, phase: service.campaign.phase.map((p, i) => (i === 0 ? 'find-door' as const : p)) };
    expect(await service.updateCampaign(next)).toBe(true);
    expect(service.campaign).toEqual(next);
  });
});

describe('ft_1_07.AC10: new players need a free name, at most 10 players', () => {
  it('ft_1_07.AC10 adds a player with the given name, trimmed, and makes them active', async () => {
    const { service } = await setup();
    expect(await service.createPlayer('  KAI ')).toBe('ok');
    expect(service.profile.name).toBe('KAI');
    expect(service.profiles.map((p) => p.name)).toEqual(['Player 1', 'KAI']);
  });

  it('ft_1_07.AC10 refuses a blank name or one another player has, and adds nobody', async () => {
    const { service } = await setup();
    const first = service.profile.id;
    expect(await service.createPlayer('   ')).toBe('blank');
    expect(await service.createPlayer('PLAYER 1')).toBe('taken');
    expect(service.profiles).toHaveLength(1);
    expect(service.profile.id).toBe(first);
  });

  it('ft_1_07.AC10 adds nobody once there are 10 players, by New player or by import', async () => {
    const { service } = await setup();
    for (let i = 2; i <= 10; i += 1) expect(await service.createPlayer(`P${i}`)).toBe('ok');
    expect(service.canAddPlayer).toBe(false);
    const backup = await service.exportActive();
    expect(await service.createPlayer('ELEVEN')).toBe('full');
    expect(await service.createPlayer()).toBe('full');
    const imported = await service.importPlayer(backup, 'new');
    expect(imported.ok).toBe(false);
    expect(imported.ok === false && imported.full).toBe(true);
    expect(service.profiles).toHaveLength(10);
  });
});

describe('core_10: the practice log in the profile service', () => {
  const barPlay = (pieceId: string, bar: number, section: { first: number; last: number } | null = null): BarPlay => ({
    at: '1998-10-05T12:00:00.000Z', pieceId, bar, notes: 4, firstTry: 3, timing: null, mode: 'wait', tempoPercent: 100, section,
    misses: [{ tick: 960, track: 'rh', midi: 64 }],
  });

  it('core_10.AC1: recorded bar plays are kept for their piece, survive a restart, and an empty list changes nothing', async () => {
    const store = new MemoryStore();
    const { service } = await setup(store);
    expect(await service.recordBarPlays([])).toBe(true);
    expect(service.profile.practice).toEqual({ bars: [] });

    expect(await service.recordBarPlays([barPlay('a', 0), barPlay('b', 0), barPlay('a', 1)])).toBe(true);
    expect(service.practiceFor('a')).toEqual([barPlay('a', 0), barPlay('a', 1)]);
    expect(service.practiceFor('b')).toEqual([barPlay('b', 0)]);
    expect(service.practiceFor('c')).toEqual([]);

    const restarted = (await setup(store)).service;
    expect(restarted.practiceFor('a')).toEqual([barPlay('a', 0), barPlay('a', 1)]);
  });

  it('core_10.AC2: section plays are kept in the log but do not change the stats of the piece', async () => {
    const { service } = await setup();
    await service.completePiece(result('a', 0.8));
    const statsBefore = service.statsFor('a');
    const attemptsBefore = service.profile.attempts.length;

    expect(await service.recordBarPlays([barPlay('a', 2, { first: 2, last: 3 })])).toBe(true);
    expect(service.practiceFor('a')).toEqual([barPlay('a', 2, { first: 2, last: 3 })]);
    expect(service.statsFor('a')).toEqual(statsBefore);
    expect(service.profile.attempts).toHaveLength(attemptsBefore);
  });
});

describe("ProfileService and the teacher's screen (ft_1_26, WP-14)", () => {
  it("ft_1_26.AC3 saves a player's curriculum in its own document, kept over a reload, and reads another player's practice log", async () => {
    const { service, repository } = await setup();
    const first = service.profile.id;
    expect(await service.curriculumOf(first)).toEqual({ base: 85, pieces: [], calendar: [] });
    const curriculum = { base: 85, pieces: [{ piece: 'a', deadline: '1998-12-01', priority: 6 }], calendar: [] };
    expect(await service.saveCurriculum(first, curriculum)).toBe(true);
    await service.recordBarPlays([{ at: '1998-10-05T12:00:00.000Z', pieceId: 'a', bar: 0, notes: 4, firstTry: 4, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [] }]);
    await service.createPlayer('Second');
    expect(service.profile.id).not.toBe(first);
    expect((await service.practiceLogOf(first))?.bars).toHaveLength(1);
    expect((await service.practiceLogOf(service.profile.id))?.bars).toEqual([]);
    const again = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE });
    expect(await again.curriculumOf(first)).toEqual(curriculum);
  });

  it('says false when the curriculum cannot be saved, and null when it cannot be read', async () => {
    const { service, store } = await setup();
    const id = service.profile.id;
    const broken = store as MemoryStore & { set: KeyValueStore['set']; get: KeyValueStore['get'] };
    broken.set = () => Promise.reject(new Error('full'));
    expect(await service.saveCurriculum(id, { base: 85, pieces: [], calendar: [] })).toBe(false);
    broken.get = () => Promise.reject(new Error('gone'));
    expect(await service.curriculumOf(id)).toBeNull();
  });
});

describe('ProfileService and the world on Keri (ft_1_22, WP-09 on WP-08)', () => {
  it('ft_1_22.AC1 a player\'s world starts empty, is saved in its own document, kept over a reload and belongs to that player', async () => {
    const { service, repository } = await setup();
    const first = service.profile.id;
    expect(await service.worldOf(first)).toEqual({ flags: [], items: [], met: {}, teacherVisits: [] });
    const world = { flags: ['met-puuvaim'], items: [], met: {}, teacherVisits: [] };
    expect(await service.saveWorld(first, world)).toBe(true);
    await service.createPlayer('Second');
    expect(await service.worldOf(service.profile.id)).toEqual({ flags: [], items: [], met: {}, teacherVisits: [] });
    const again = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE });
    expect(await again.worldOf(first)).toEqual(world);
  });

  it('says false when the world cannot be saved, and null when it cannot be read', async () => {
    const { service, store } = await setup();
    const id = service.profile.id;
    const broken = store as MemoryStore & { set: KeyValueStore['set']; get: KeyValueStore['get'] };
    broken.set = () => Promise.reject(new Error('full'));
    expect(await service.saveWorld(id, { flags: [], items: [], met: {}, teacherVisits: [] })).toBe(false);
    broken.get = () => Promise.reject(new Error('gone'));
    expect(await service.worldOf(id)).toBeNull();
  });
});

describe('one player in one window at a time (found 1998-11-21: a second tab overwrote the first one\'s progress)', () => {
  /** Two windows on one device: a claim on a player another window holds is refused. */
  function sharedLocks() {
    const owners = new Map<string, string>();
    return (window: string) => ({
      claim: (id: string) => {
        const owner = owners.get(id);
        if (owner !== undefined && owner !== window) return Promise.resolve(false);
        for (const [held, by] of owners) if (by === window) owners.delete(held);
        owners.set(id, window);
        return Promise.resolve(true);
      },
    });
  }

  async function twoWindows() {
    const store = new MemoryStore();
    let tick = 0;
    const repository = new ProfileRepository(store, config, { now: () => new Date(Date.UTC(1998, 9, 5, 10, tick++)), idFactory: (() => { let n = 0; return () => `id-${++n}`; })() });
    const first = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE });
    await first.createPlayer('SAM');
    const locks = sharedLocks();
    const a = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, lock: locks('a') });
    const b = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, lock: locks('b') });
    return { a, b, repository, locks, store };
  }

  it('a player open in one window cannot be opened in another, and nothing is written there', async () => {
    const { a, b, repository } = await twoWindows();
    const player1 = a.profiles.find((p) => p.name === 'Player 1')!.id;
    expect(await a.switchTo(player1)).toBe('ok');
    await a.completePiece(result('a'));
    expect(await b.switchTo(player1)).toBe('busy');
    const loaded = await repository.load(player1);
    expect(loaded.ok && loaded.profile.attempts.map((x) => x.pieceId)).toEqual(['a']);
  });

  it('a window that never claimed its player writes nothing over the window that has it', async () => {
    const { a, b, repository } = await twoWindows();
    const sam = a.profiles.find((p) => p.name === 'SAM')!.id;
    // both start with SAM active (the last one made); A opens SAM, B still shows SAM from its start and plays
    expect(await a.switchTo(sam)).toBe('ok');
    await a.completePiece(result('a'));
    const outcome = await b.completePiece(result('b'));
    expect(outcome.saved).toBe(false);
    const loaded = await repository.load(sam);
    expect(loaded.ok && loaded.profile.attempts.map((x) => x.pieceId)).toEqual(['a']);
  });

  it('the player a window starts on is claimed at once: a window started later cannot open it (review of d159)', async () => {
    const { a, b } = await twoWindows();
    const sam = a.profiles.find((p) => p.name === 'SAM')!.id;
    expect(a.profile.id).toBe(sam);
    expect(await b.switchTo(sam)).toBe('busy');
  });

  it('picking a player whose save cannot be read keeps the claim on the player still open (review of d159)', async () => {
    const { a, b, store } = await twoWindows();
    const sam = a.profiles.find((p) => p.name === 'SAM')!.id;
    const p1 = a.profiles.find((p) => p.name === 'Player 1')!.id;
    await store.set(`pianor/v1/player/${p1}/profile`, 'xx{');
    expect(await a.switchTo(p1)).toBe('unreadable');
    expect(a.profile.id).toBe(sam);
    expect(await b.switchTo(sam)).toBe('busy');
  });

  it('deleting the open player moves to one this window can have, and the deleted player is never written back (review of d159)', async () => {
    const { a, repository, locks } = await twoWindows();
    await a.createPlayer('KAI');
    const [p1, sam, kai] = ['Player 1', 'SAM', 'KAI'].map((n) => a.profiles.find((p) => p.name === n)!.id) as [string, string, string];
    // a third window holds Player 1; A has KAI open and deletes it
    const c = await ProfileService.create({ repository, config, catalogue: () => CATALOGUE, lock: locks('c') });
    expect(await c.switchTo(p1)).toBe('ok');
    expect(await a.deletePlayer(kai)).toBe(true);
    expect(a.profile.id).toBe(sam);
    await a.completePiece(result('a'));
    expect((await repository.load(kai)).ok).toBe(false);
    expect(a.profiles.map((p) => p.id)).not.toContain(kai);
  });

  it('deleting the open player is refused, changing nothing, when every other player is open in another window (review of d159)', async () => {
    const { a, b } = await twoWindows();
    const [p1, sam] = ['Player 1', 'SAM'].map((n) => a.profiles.find((p) => p.name === n)!.id) as [string, string];
    expect(await b.switchTo(p1)).toBe('ok');
    expect(await a.deletePlayer(sam)).toBe(false);
    expect(a.profile.id).toBe(sam);
    expect(a.profiles.map((p) => p.id)).toContain(sam);
  });

  it('a window that leaves a player frees it for the other', async () => {
    const { a, b } = await twoWindows();
    const [p1, sam] = ['Player 1', 'SAM'].map((n) => a.profiles.find((p) => p.name === n)!.id);
    expect(await a.switchTo(p1!)).toBe('ok');
    expect(await a.switchTo(sam!)).toBe('ok');
    expect(await b.switchTo(p1!)).toBe('ok');
  });
});
