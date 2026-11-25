import type { AdminSettings } from '../core/admin/adminSettings';
import type { GameAudio } from '../io/audio';
import type { AdminAccess } from '../io/admin/adminAccess';
import type { TeacherDesk } from '../io/teacher/teacherDesk';
import type { TextFiles } from '../io/files';
import type { KeyboardInput, KeyLightOutput } from '../io/keyboard';
import type { OwnPieces } from './editor/OwnPieces';
import type { OwnSongs } from './OwnSongs';
import type { PieceCatalogue } from './pieceCatalogue';
import type { SongCatalogue } from './songCatalogue';
import type { ProfileService } from './profile/ProfileService';
import type { SkyPhase } from '../core/sky/skyPhase';
import type { Wind } from '../core/sky/wind';

/** How the dev staff demo (`?demo=staff`) lays out: a number left out is null and the scene uses its own. */
export interface StaffDemoView {
  /** 1-based sample to open first. */
  piece: number | null;
  /** Hints to show: `n` note names, `f` fingers. */
  hints: string;
  /** The virtual screen to lay out for, the zoom and the point to look at. */
  vw: number | null;
  vh: number | null;
  zoom: number | null;
  cx: number | null;
  cy: number | null;
}

/** The page settings scenes act on, read once from the URL by `src/config.ts`: scenes never read the URL themselves. */
export interface GameFlags {
  /** Dev only: the demo cast stands in the adventure scenes (`?actors=1`, ft_1_24). */
  actors: boolean;
  /** Offer the piece editor (a Make mode in the menu). */
  editor: boolean;
  /** A new piece is learned bar by bar before it is practised (ft_1_32); `?learn=0` turns it off. */
  learn: boolean;
  /** Dev-only demo scene to open instead of the menu, e.g. "staff"; null in a production build. */
  demo: string | null;
  /** The staff demo's view settings. */
  staffDemo: StaffDemoView;
  /** Dev-only sky switches (ft_1_14 AC6): a forced phase and an instant; both null in a production build. */
  sky: { phase: SkyPhase | null; now: number | null; wind: Wind | null };
  /** True in a dev server: the admin Pages list the dev pages and the draft switch. False in a production build. */
  devTools: boolean;
  /** Dev-only autoplay (`?autoplay=1`): the game starts on the piece list, where the director expects it. False in a production build. */
  autoplay: boolean;
  /** Draft pieces show here without the admin switch (a plain dev server). False in `npm run start`, where the switch decides. */
  draftsShown: boolean;
  /** The address of this page (`index.html`), so a page link can be made from it (the admin Pages). */
  pageBase: string;
  /** The first-run intro (`?intro=`, ft_1_31): `auto` for a new player, `force` always, `off` never. */
  intro: 'auto' | 'force' | 'off';
}

/** The on-screen keyboard switch (ft_Y_12, d088, d099): the page owns the keyboard, the settings screen's toolbar shows it. */
export interface KeyboardSwitch {
  /** True while the on-screen keyboard is shown. */
  shown(): boolean;
  /** What a press on the switch does (this visit only, with a piano connected). */
  toggle(): void;
  /** False with no MIDI input: the on-screen keys are then the only piano, so the switch is locked. */
  enabled(): boolean;
  /** Called after every change of `shown`; returns the unsubscribe. */
  onChange(listener: () => void): () => void;
}

/** What scenes get from the composition root (`src/main.ts`): interfaces only, never implementations. */
export interface GameContext {
  /** Every way to play, merged. */
  keyboard: KeyboardInput;
  /** Where "show the next key" goes. */
  lights: KeyLightOutput;
  /** The real piano's connection, once MIDI is open; null before that or when there is none. */
  midi: KeyboardInput | null;
  /** Sound and the song clock. */
  audio: GameAudio;
  /** Players, XP, levels and unlocked pieces. */
  profiles: ProfileService;
  /** The page settings scenes act on. */
  flags: GameFlags;
  /** The pieces the game offers (with the player's own), built once for the page. */
  pieces: PieceCatalogue;
  /** The songs made of pieces (ft_1_36), with each player's parts on and off. */
  songs: SongCatalogue;
  /** Pieces written in the editor on this device. */
  ownPieces: OwnPieces;
  /** Songs made on this device (ft_1_36 rule 12). */
  ownSongs: OwnSongs;
  /** Checks the admin password; scenes never read the stored record. */
  admin: AdminAccess;
  /** The teacher's desk behind the academic hat (ft_1_26, d140): her own password, the curricula and their statuses. */
  teacher: TeacherDesk;
  /** The device's admin settings, read once at start; the admin hub updates it when it saves a change. */
  adminSettings: AdminSettings;
  /** Text files to and from the player's device (piece files in the editor). */
  files: TextFiles;
  /** False when the browser blocks storage, so progress is lost when the page closes. */
  savesPersist: boolean;
  /** The on-screen keyboard switch on the settings screen's toolbar (d099). */
  keyboardSwitch: KeyboardSwitch;
}

/** Key of the context in the Phaser registry. */
export const CONTEXT_KEY = 'context';
/** Game event emitted when `context.midi` changed. */
export const MIDI_CHANGED = 'midi-changed';

/** The context a scene (or the game) was given by the composition root: the one place that reads it from the registry. */
export function contextOf(holder: { registry: { get(key: string): unknown } }): GameContext {
  return holder.registry.get(CONTEXT_KEY) as GameContext;
}
