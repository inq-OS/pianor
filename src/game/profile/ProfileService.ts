import { earTrainerSettingsSchema, type EarTrainerSettings } from '../../core/trainer/earSettings';
import { DEFAULT_LEARN_SETTINGS, START_PROGRESS, learnProgressSchema, learnSettingsSchema, type LearnProgress, type LearnSettings } from '../../core/learn/progress';
import { t } from '../../core/text/strings';
import type { PlayerLock } from '../../core/progression/repository';
import type { PieceResult } from '../../core/judge';
import { playSettingsSchema, type PlaySettings } from '../../core/judge/playSettings';
import { barNumberSettingsSchema, type BarNumberSettings } from '../../core/layout/barNumbers';
import { keyboardSettingsSchema, type KeyboardSettings } from '../../core/layout/keyboardSettings';
import type { NoteNaming } from '../../core/text/noteName';
import type { Curriculum } from '../../core/curriculum/curriculum';
import type { WorldState } from '../../core/island/worldState';
import { staffSettingsSchema, type StaffSettings } from '../../core/layout/staffSettings';
import { DEFAULT_DURATION_HELP, durationHelpSchema, type DurationHelp } from '../../core/layout/durationHelp';
import {
  DEFAULT_PLAY_INFO, addEarPoints, addTrainerXp, canTurnOff, deriveProgress, profileSettingsSchema, isPieceOn, pieceHistory, pieceStats, recordAttempt, addTugRecord, setPieceOn, songPartsOff, startPercent, withSongPartsOff,
  type BarPlay, type PracticeLog, type TugInput, type HistoryPoint, type PieceStats, type PlayInfo, appendBarPlays, piecePlays,
  type PieceRecord, type ProfileData, type ProfileRepository, type ProfileSummary, type ProgressEvent, type ProgressionConfig,
  type ProgressSummary,
} from '../../core/progression';
import { MAX_PLAYERS, playerNameProblem, type PlayerNameProblem } from '../../core/progression/playerNames';

/** The blocks of a player's settings that the settings screen changes as a whole object. */
type SettingsBlock = 'staff' | 'play' | 'barNumbers' | 'keyboard' | 'earTrainer';

export interface CompletionOutcome {
  events: ProgressEvent[];
  before: ProgressSummary;
  after: ProgressSummary;
  /** False when writing the save failed (full or blocked storage): progress still counts for this session. */
  saved: boolean;
  /** After a piece (not a tug): what the history now says about it. */
  stats?: PieceStats;
}

/** What adding a player did: 'ok', or why nothing was added (a bad name, or the device already has MAX_PLAYERS). */
export type NewPlayerResult = 'ok' | PlayerNameProblem | 'full';

/** What renaming a player did: 'ok', or why nothing changed. */
export type RenameResult = 'ok' | PlayerNameProblem | 'missing';

export interface ProfileServiceOptions {
  repository: ProfileRepository;
  config: ProgressionConfig;
  /** The pieces on offer (by id), so turning pieces off always leaves one on. */
  catalogue: () => readonly { id: string }[];
  now?: () => Date;
  /**
   * One player in one window at a time (a second tab of the same player wrote its whole profile over the
   * first one's progress). Without it (tests, dev pages) every claim is granted. The browser's is `webPlayerLock`.
   */
  lock?: PlayerLock;
  /**
   * A new install makes no player (ft_1_07.AC1, d277): with no player whose save can be read, the service starts on an
   * unsaved stand-in and `needsFirstPlayer` is true until `createPlayer` makes the first one. Without it (tests, dev pages) the repository makes "Player 1" or its seeds.
   */
  askFirstPlayer?: boolean;
}


/** What opening a player did: opened, held by another window, or its save could not be read. */
export type SwitchResult = 'ok' | 'busy' | 'unreadable';

/** The finger numbers the player sees: none, on a chord's top note, or on every note of a chord. */
export type FingerNumbers = 'off' | 'top' | 'all';
/** What the hint label under a chord says (core_09.AC59). */
export type ChordLabels = 'notes' | 'name' | 'both';

/**
 * The game's view of progress: the active profile, its XP and level, each piece's record, and the few things scenes
 * may do (finish a piece, switch or add a player, export or import). Rules live in `core/progression`; this only
 * connects them to storage and keeps the current state in memory.
 */
export class ProfileService {
  private active: ProfileData;
  private creating: Promise<NewPlayerResult> | null = null;
  private summaries: ProfileSummary[];
  /** The players whose save could not be read when the game started (copied aside; shown on the main menu, never played). */
  private readonly damagedSummaries: readonly { id: string; name: string }[];
  private derived: ProgressSummary;
  private readonly keyboardListeners: (() => void)[] = [];
  /** True while the active player is the unsaved stand-in of a new install (ft_1_07.AC1): nothing of it is ever written. */
  private standIn = false;

  private constructor(private readonly options: ProfileServiceOptions, active: ProfileData, summaries: ProfileSummary[], damaged: readonly { id: string; name: string }[]) {
    this.active = active;
    this.summaries = summaries;
    this.damagedSummaries = damaged;
    this.derived = deriveProgress(active, options.config);
  }

  static async create(options: ProfileServiceOptions): Promise<ProfileService> {
    // no player whose save can be read (a new install, or only damaged saves): ask for a name, never make a default player
    const fresh = options.askFirstPlayer === true && (await options.repository.listProfiles()).length === 0;
    const active = fresh ? options.repository.newProfile('') : await options.repository.loadActiveOrCreate();
    const service = new ProfileService(options, active, await options.repository.listProfiles(), await options.repository.damagedProfiles());
    service.standIn = fresh;
    // the player this window starts on is claimed at once, so a second window started later cannot take it (d159); when another
    // window has it, this one shows it but writes nothing until a player is picked on the main menu
    await service.claim(active.id);
    return service;
  }

  get profile(): ProfileData {
    return this.active;
  }

  /** A new install with no player yet (ft_1_07.AC1): the game asks for the first player's name before anything else. */
  get needsFirstPlayer(): boolean {
    return this.standIn;
  }

  get progress(): ProgressSummary {
    return this.derived;
  }

  get profiles(): readonly ProfileSummary[] {
    return this.summaries;
  }

  /** The players whose save could not be read at the start: their name (or empty) and id, for the main menu. */
  get damaged(): readonly { id: string; name: string }[] {
    return this.damagedSummaries;
  }

  /** Stars, completions and dates for a piece, or undefined when it was never finished. */
  recordFor(pieceId: string): PieceRecord | undefined {
    return this.derived.pieces[pieceId];
  }

  /** How the active player likes the staff (lines on the screen, bars on a line). */
  get staffSettings(): StaffSettings {
    return this.active.settings.staff;
  }

  /**
   * Change some of the active player's staff settings and save. Invalid values throw and change nothing. Returns false when
   * writing the save failed: the change still holds for this session.
   */
  async updateStaffSettings(change: Partial<StaffSettings>): Promise<boolean> {
    return this.updateSetting('staff', staffSettingsSchema, change);
  }

  /** The space between the two staves of a grand staff: short (middle C between them) or wide. */
  get staffGap(): ProfileData['settings']['staffGap'] {
    return this.active.settings.staffGap;
  }

  /** Change the active player's staff gap and save; like `updateStaffSettings`. */
  async updateStaffGap(staffGap: ProfileData['settings']['staffGap']): Promise<boolean> {
    const value = profileSettingsSchema.shape.staffGap.parse(staffGap);
    this.active = { ...this.active, settings: { ...this.active.settings, staffGap: value } };
    return this.persist();
  }

  /** The note duration helper's marks for each hand (ft_1_11); both off when the save has none. */
  get durationHelp(): DurationHelp {
    return this.active.settings.durationHelp ?? DEFAULT_DURATION_HELP;
  }

  /** Change the note duration helper of one hand or both and save; like `updateStaffSettings`. */
  async updateDurationHelp(change: Partial<DurationHelp>): Promise<boolean> {
    const value = durationHelpSchema.parse({ ...this.durationHelp, ...change });
    this.active = { ...this.active, settings: { ...this.active.settings, durationHelp: value } };
    return this.persist();
  }

  /** Whether a chord shows the finger of every head; absent in older saves reads as off. */
  get chordFingers(): boolean {
    return this.active.settings.chordFingers ?? false;
  }

  /** What the hint label under a chord says: its notes (absent in older saves), its name, or both (core_09.AC59). */
  get chordLabels(): ChordLabels {
    return this.active.settings.chordLabels ?? 'notes';
  }

  /** Change what the hint label under a chord says, and save. */
  async updateChordLabels(mode: ChordLabels): Promise<boolean> {
    const value = profileSettingsSchema.shape.chordLabels.parse(mode);
    this.active = { ...this.active, settings: { ...this.active.settings, chordLabels: value } };
    return this.persist();
  }

  /** The finger numbers setting: off; on the top note of a chord; or on every note of a chord. */
  get fingerNumbers(): FingerNumbers {
    if (!(this.active.settings.showFingers ?? false)) return 'off';
    return this.active.settings.chordFingers ?? false ? 'all' : 'top';
  }

  /** Whether the practice screen shows finger numbers from the start. */
  get showFingers(): boolean {
    return this.fingerNumbers !== 'off';
  }

  /** Change the finger numbers setting and save: off turns both off, top shows the top note's finger, all every note's. */
  async updateFingerNumbers(mode: FingerNumbers): Promise<boolean> {
    this.active = { ...this.active, settings: { ...this.active.settings, showFingers: mode !== 'off', chordFingers: mode === 'all' } };
    return this.persist();
  }

  /** Save the XP of right names in the note-name trainer (ft_0_17.AC3): whole XP that only grows, and it counts towards the level. */
  async addTrainerXp(xp: number): Promise<boolean> {
    const outcome = addTrainerXp(this.active, xp, this.options.config);
    this.active = outcome.profile;
    this.derived = outcome.after;
    return this.persist();
  }

  /** The pitch trainer by ear's points (ft_1_10, version 16): whole points that only grow; not XP. */
  get earPoints(): number {
    return this.active.earPoints;
  }

  /** Add the points of one ear question and save (ft_1_10 AC5). */
  async addEarPoints(points: number): Promise<boolean> {
    this.active = addEarPoints(this.active, points);
    return this.persist();
  }

  /** The pitch trainer by ear's length and repeat (ft_1_10 AC6). */
  get earTrainerSettings(): EarTrainerSettings {
    return this.active.settings.earTrainer;
  }

  /** Change some of the pitch trainer by ear's settings and save; like `updateStaffSettings`. */
  async updateEarTrainer(change: Partial<EarTrainerSettings>): Promise<boolean> {
    return this.updateSetting('earTrainer', earTrainerSettingsSchema, change);
  }

  /** Change the active player's letter naming (B or H, ft_0_17.AC4) and save; like `updateStaffGap`. */
  async updateNoteNaming(noteNaming: NoteNaming): Promise<boolean> {
    const value = profileSettingsSchema.shape.noteNaming.parse(noteNaming);
    this.active = { ...this.active, settings: { ...this.active.settings, noteNaming: value } };
    return this.persist();
  }

  /** How the active player learns a piece bar by bar (ft_1_32): the step size and the mistake markers. */
  get learnSettings(): LearnSettings {
    return this.active.settings.learn ?? DEFAULT_LEARN_SETTINGS;
  }

  /** Change some of the learning settings and save; invalid values throw and change nothing. */
  async updateLearnSettings(change: Partial<LearnSettings>): Promise<boolean> {
    const learn = learnSettingsSchema.parse({ ...this.learnSettings, ...change });
    this.active = { ...this.active, settings: { ...this.active.settings, learn } };
    return this.persist();
  }

  /** Where the active player is in learning a piece (ft_1_32); a piece never started is at its start. */
  learnProgressOf(pieceId: string): LearnProgress {
    return this.active.learning?.[pieceId] ?? START_PROGRESS;
  }

  /** Keep where the active player is in learning a piece, and save; false when the save failed (it still holds for this session). */
  async saveLearnProgress(pieceId: string, progress: LearnProgress): Promise<boolean> {
    // the measured runs are stats: if they do not parse, the progress is saved without them, never lost
    const whole = learnProgressSchema.safeParse(progress);
    const bare = { ...progress };
    delete bare.tests;
    const checked = whole.success ? whole.data : learnProgressSchema.parse(bare);
    this.active = { ...this.active, learning: { ...this.active.learning, [pieceId]: checked } };
    return this.persist();
  }

  /** How the active player likes to play: Wait or Tempo mode, and the Tempo-mode score view. */
  get playSettings(): PlaySettings {
    return this.active.settings.play;
  }

  /** Change some of the active player's play settings and save; like `updateStaffSettings`. */
  async updatePlaySettings(change: Partial<PlaySettings>): Promise<boolean> {
    return this.updateSetting('play', playSettingsSchema, change);
  }

  /** How a hint label names a note: B (Bb, B natural) or H (German H for B natural). */
  get noteNaming(): NoteNaming {
    return this.active.settings.noteNaming;
  }

  /** Which bars of the staff carry a number. */
  get barNumberSettings(): BarNumberSettings {
    return this.active.settings.barNumbers;
  }

  /** Change the active player's bar number setting and save; like `updateStaffSettings`. */
  async updateBarNumberSettings(change: Partial<BarNumberSettings>): Promise<boolean> {
    return this.updateSetting('barNumbers', barNumberSettingsSchema, change);
  }

  /** Whether the active player sees the on-screen piano on the practice screen (ft_Y_12). */
  get keyboardSettings(): KeyboardSettings {
    return this.active.settings.keyboard;
  }

  /**
   * Call `listener` whenever the keyboard settings in force may have changed: a new choice, or another active player. The page
   * shows or hides the on-screen piano by it on every screen (ft_Y_12).
   */
  onKeyboardSettings(listener: () => void): void {
    this.keyboardListeners.push(listener);
  }

  /** Change the active player's keyboard settings and save; like `updateStaffSettings`. */
  async updateKeyboardSettings(change: Partial<KeyboardSettings>): Promise<boolean> {
    const saving = this.updateSetting('keyboard', keyboardSettingsSchema, change);
    this.keyboardListeners.forEach((listener) => listener());
    return saving;
  }

  /** The ids of the pieces the active player has turned off (may include ids of pieces that no longer exist). */
  get hiddenPieces(): readonly string[] {
    return this.active.settings.pieces.hidden;
  }

  /** Whether a piece is on for the active player. Off pieces are hidden from the menu and the tugs but keep their stars. */
  isPieceOn(pieceId: string): boolean {
    return isPieceOn(this.active.settings.pieces, pieceId);
  }

  /** False for the last piece that is on: the player cannot turn off every piece. */
  canTurnOff(pieceId: string): boolean {
    return canTurnOff(this.active.settings.pieces, pieceId, this.offeredIds());
  }

  /**
   * Turn a piece on or off for the active player and save. `changed` is false when nothing changed (it already was so, or it
   * is the last piece on). `saved` is false when writing the save failed: the change still holds for this session.
   */
  async setPieceOn(pieceId: string, on: boolean): Promise<{ changed: boolean; saved: boolean }> {
    const pieces = setPieceOn(this.active.settings.pieces, pieceId, on, this.offeredIds());
    const before = this.hiddenPieces;
    if (pieces.hidden.length === before.length && pieces.hidden.every((id, i) => id === before[i])) return { changed: false, saved: true };
    this.active = { ...this.active, settings: { ...this.active.settings, pieces } };
    if (this.standIn) return { changed: true, saved: false };
    try {
      await this.options.repository.save(this.active);
      return { changed: true, saved: true };
    } catch {
      return { changed: true, saved: false };
    }
  }

  /** The node ids of a song the active player turned off (ft_1_36 rule 5); ids the song no longer has are ignored where it is read. */
  songPartsOff(songId: string): readonly string[] {
    return songPartsOff(this.active.settings.pieces, songId);
  }

  /** Keep a song's parts that are off for the active player and save; false when the save failed (the change still holds for this session). */
  setSongPartsOff(songId: string, off: readonly string[]): Promise<boolean> {
    this.active = { ...this.active, settings: { ...this.active.settings, pieces: withSongPartsOff(this.active.settings.pieces, songId, off) } };
    return this.persist();
  }

  /** Whether the active player was told once what a song page's tick does (ft_1_36 rule 10). */
  get songTickTold(): boolean {
    return this.active.settings.pieces.songTickTold === true;
  }

  /** Marks the tick as told, so the song page does not say it again. */
  markSongTickTold(): Promise<boolean> {
    this.active = { ...this.active, settings: { ...this.active.settings, pieces: { ...this.active.settings.pieces, songTickTold: true } } };
    return this.persist();
  }

  /** The pieces on offer: no piece is locked by level (ft_1_13.AC3), so the guard "keep one piece on" counts them all. */
  private offeredIds(): string[] {
    return this.options.catalogue().map((p) => p.id);
  }

  /** Write the active player; false when the storage refused (full or blocked), or another window has the player: the change still holds for this session. */
  private async persist(): Promise<boolean> {
    if (this.standIn) return false;
    if (!(await this.claim(this.active.id))) return false;
    try {
      await this.options.repository.save(this.active);
      return true;
    } catch {
      return false;
    }
  }

  /** Replace one block of the active player's settings with `change` merged in, checked by its schema, and save. */
  private updateSetting<K extends SettingsBlock>(
    key: K, schema: { parse(value: unknown): ProfileData['settings'][K] }, change: Partial<ProfileData['settings'][K]>,
  ): Promise<boolean> {
    const value = schema.parse(Object.assign({}, this.active.settings[key], change));
    this.active = { ...this.active, settings: { ...this.active.settings, [key]: value } };
    return this.persist();
  }

  /** Take a finished piece's or tug's new profile, save it, and say what changed. */
  private async commit(outcome: { profile: ProfileData; events: ProgressEvent[]; before: ProgressSummary; after: ProgressSummary }): Promise<CompletionOutcome> {
    this.active = outcome.profile;
    this.derived = outcome.after;
    const saved = await this.persist();
    return { events: outcome.events, before: outcome.before, after: outcome.after, saved };
  }

  /** Save a finished piece: it earns the piece XP, not the player (ft_1_13). The attempt is kept in memory even if the save fails. */
  async completePiece(result: PieceResult, play: PlayInfo = DEFAULT_PLAY_INFO): Promise<CompletionOutcome> {
    const now = this.options.now?.() ?? new Date();
    const outcome = recordAttempt(this.active, result, this.options.config, now, play);
    return { ...(await this.commit(outcome)), stats: this.statsFor(result.chartId) };
  }

  /** What the history says about a piece: proficiency, accuracy, timing and speed (core_04). */
  statsFor(pieceId: string): PieceStats {
    return pieceStats(this.active.attempts, pieceId, this.options.config.stats);
  }

  /** The full plays of a piece, oldest first, for the graph on its stats page (core_04). */
  historyFor(pieceId: string): HistoryPoint[] {
    return pieceHistory(this.active.attempts, pieceId);
  }

  /** The tempo percent a piece starts at: where this player last played it (100 when never). */
  startPercent(pieceId: string): number {
    return startPercent(this.active.attempts, pieceId);
  }

  /**
   * Add bar plays of a play to the active player's practice log and save (core_10). Nothing is written for an empty list.
   * Section plays are kept here but never change the piece stats (core_04). False when the save failed.
   */
  async recordBarPlays(plays: readonly BarPlay[]): Promise<boolean> {
    if (plays.length === 0) return true;
    this.active = { ...this.active, practice: appendBarPlays(this.active.practice, plays) };
    return this.persist();
  }

  /** The bar plays of one piece, oldest first, for the practice view (core_10). */
  practiceFor(pieceId: string): BarPlay[] {
    return piecePlays(this.active.practice, pieceId);
  }

  /**
   * Any player's practice log, read only (the teacher's screen, ft_1_26): the active player's from memory, another's from its
   * save; null when that save cannot be read.
   */
  async practiceLogOf(id: string): Promise<PracticeLog | null> {
    if (id === this.active.id) return this.active.practice;
    return (await this.loadOk(id))?.practice ?? null;
  }

  /** A player's curriculum (the teacher's screen, ft_1_26; the `curriculum` save document, d136); null when it cannot be read. */
  async curriculumOf(id: string): Promise<Curriculum | null> {
    const loaded = await this.options.repository.loadDocument(id, 'curriculum').catch(() => null);
    return loaded?.ok ? loaded.value : null;
  }

  /** A player's world (ft_1_25, WP-08; the `world` save document): what happened on Keri; null when it cannot be read. */
  async worldOf(id: string): Promise<WorldState | null> {
    const loaded = await this.options.repository.loadDocument(id, 'world').catch(() => null);
    return loaded?.ok ? loaded.value : null;
  }

  /** Saves a player's world alone, the other documents untouched (core_11.AC4); false when the save failed. */
  async saveWorld(id: string, world: WorldState): Promise<boolean> {
    if (this.standIn && id === this.active.id) return false;
    return this.options.repository.saveDocument(id, 'world', world).then(() => true).catch(() => false);
  }

  /** Saves a player's curriculum alone, the other documents untouched (core_11.AC4); false when the save failed. */
  async saveCurriculum(id: string, curriculum: Curriculum): Promise<boolean> {
    if (this.standIn && id === this.active.id) return false;
    return this.options.repository.saveDocument(id, 'curriculum', curriculum).then(() => true).catch(() => false);
  }

  /**
   * Record a finished tug and its XP and save (ft_1_21.AC9). Kept in memory even if the save fails.
   */
  async completeTug(input: TugInput): Promise<CompletionOutcome> {
    const now = this.options.now?.() ?? new Date();
    const outcome = addTugRecord(this.active, input, this.options.config, now);
    return this.commit(outcome);
  }

  /**
   * Add a player and switch to them (ft_1_07.AC10). A given name must not be blank or another player's; with no name the
   * default "Player N" is used (tests and the first start). Nothing is added once the device has MAX_PLAYERS. A call while
   * one is still saving joins it instead of adding a second player (a double tap made two players).
   */
  createPlayer(name?: string): Promise<NewPlayerResult> {
    if (this.creating) return this.creating;
    const add = async (): Promise<NewPlayerResult> => {
      if (this.summaries.length >= MAX_PLAYERS) return 'full';
      if (name !== undefined) {
        const problem = playerNameProblem(name, this.summaries.map((p) => p.name));
        if (problem) return problem;
      }
      const created = await this.options.repository.createProfile(name?.trim() ?? t('profile.defaultName', { n: this.summaries.length + 1 }));
      await this.claim(created.id);
      await this.options.repository.setActiveId(created.id);
      await this.adopt(created);
      return 'ok';
    };
    // cleared only once settled (a refusal settles at once, so it must not be cleared before it is stored)
    const creating = add().finally(() => {
      if (this.creating === creating) this.creating = null;
    });
    this.creating = creating;
    return creating;
  }

  /** True when the device has room for one more player (ft_1_07.AC10). */
  get canAddPlayer(): boolean {
    return this.summaries.length < MAX_PLAYERS;
  }

  async switchTo(id: string): Promise<SwitchResult> {
    // loaded before the claim: a claim frees the player held before, which must stay held when this player cannot be read
    const loaded = await this.options.repository.load(id);
    if (!loaded.ok) return 'unreadable';
    if (!(await this.claim(id))) return 'busy';
    await this.options.repository.setActiveId(id);
    await this.adopt(loaded.profile);
    return 'ok';
  }

  /** Claim player `id` for this window (`ProfileServiceOptions.lock`); granted when there is no lock. */
  private claim(id: string): Promise<boolean> {
    return this.options.lock?.claim(id) ?? Promise.resolve(true);
  }

  /** The next player after the active one, wrapping round. The game uses the profiles screen (ft_1_07); this stays for tests and the on-screen keyboard spec. */
  async switchToNext(): Promise<void> {
    if (this.summaries.length < 2) return;
    const index = this.summaries.findIndex((p) => p.id === this.active.id);
    await this.switchTo(this.summaries[(index + 1) % this.summaries.length]!.id);
  }

  /**
   * Rename a player (ft_1_07, admin). A blank name, or one another player has (ft_1_07.AC10), is refused and changes nothing.
   */
  async renamePlayer(id: string, name: string): Promise<RenameResult> {
    const problem = playerNameProblem(name, this.summaries.filter((p) => p.id !== id).map((p) => p.name));
    if (problem) return problem;
    // the active player is renamed from memory, so progress not yet saved is kept
    const base = this.active.id === id ? this.active : await this.loadOk(id);
    if (!base) return 'missing';
    const renamed: ProfileData = { ...base, name: name.trim() };
    await this.options.repository.save(renamed);
    if (this.active.id === id) await this.adopt(renamed);
    else this.summaries = await this.options.repository.listProfiles();
    return 'ok';
  }

  private async loadOk(id: string): Promise<ProfileData | null> {
    const loaded = await this.options.repository.load(id);
    return loaded.ok ? loaded.profile : null;
  }

  /**
   * Delete a player's save (ft_1_07, admin). The last player cannot be deleted: returns false. When the active player is
   * deleted, the first remaining player this window can open becomes active; when every other player is open in another
   * window (d159) the delete is refused, returns false, and changes nothing.
   */
  async deletePlayer(id: string): Promise<boolean> {
    if (this.summaries.length < 2) return false;
    if (this.active.id === id && !(await this.switchToAnyBut(id))) return false;
    await this.options.repository.deleteProfile(id);
    await this.adopt(this.active);
    return true;
  }

  /** Opens the first other player this window can have; false when there is none. */
  private async switchToAnyBut(id: string): Promise<boolean> {
    for (const other of this.summaries) {
      if (other.id !== id && (await this.switchTo(other.id)) === 'ok') return true;
    }
    return false;
  }

  exportActive(): Promise<string> {
    return this.options.repository.exportProfile(this.active.id);
  }

  /** Import a backup. It becomes the active player. Returns readable errors when it cannot be read, and `full` when there is no room. */
  async importPlayer(text: string, mode: 'new' | 'replace'): Promise<{ ok: true } | { ok: false; errors: string[]; full?: true }> {
    // a new player needs room on the device (ft_1_07.AC10); replacing one does not
    if (mode === 'new' && !this.canAddPlayer) return { ok: false, errors: [`At most ${MAX_PLAYERS} players.`], full: true };
    const result = await this.options.repository.importProfile(text, mode);
    if (!result.ok) return result;
    await this.claim(result.profile.id);
    await this.options.repository.setActiveId(result.profile.id);
    await this.adopt(result.profile);
    return { ok: true };
  }

  private async adopt(profile: ProfileData): Promise<void> {
    this.active = profile;
    this.standIn = false;
    this.derived = deriveProgress(profile, this.options.config);
    this.summaries = await this.options.repository.listProfiles();
    this.keyboardListeners.forEach((listener) => listener());
  }
}
