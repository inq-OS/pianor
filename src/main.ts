import Phaser from 'phaser';
import { appConfig } from './appConfig';
import { ArtDemoScene } from './game/ArtDemoScene';
import { KiurDoorScene } from './game/KiurDoorScene';
import { LearnResumeScene } from './game/LearnResumeScene';
import { EditorLeaveScene } from './game/EditorLeaveScene';
import { IntroScene } from './game/IntroScene';
import { CircleOfFifthsScene } from './game/CircleOfFifthsScene';
import { BootScene } from './game/BootScene';
import { CONTEXT_KEY, MIDI_CHANGED, type GameContext } from './game/context';
import { setSceneryStill } from './game/motion';
import { MenuScene } from './game/MenuScene';
import { PracticeScene } from './game/PracticeScene';
import { ResultsScene } from './game/ResultsScene';
import { AnalyzeScene } from './game/AnalyzeScene';
import { LearnStatsScene } from './game/LearnStatsScene';
import { StaffDemoScene } from './game/StaffDemoScene';
import { CreditsScene } from './game/CreditsScene';
import { KeriMapScene } from './game/KeriMapScene';
import { adventureScenes } from './game/adventure/adventureScenes';
import { ProfilesScene } from './game/ProfilesScene';
import { ProfileDashboardScene } from './game/ProfileDashboardScene';
import { NoteTrainerScene } from './game/NoteTrainerScene';
import { EarTrainerScene } from './game/EarTrainerScene';
import { ShapeTrainerScene } from './game/ShapeTrainerScene';
import { ChordTrainerScene } from './game/ChordTrainerScene';
import { LessonBookScene } from './game/LessonBookScene';
import { LessonScene } from './game/LessonScene';
import { AdminScene } from './game/AdminScene';
import { NameScene } from './game/NameScene';
import { SongScene } from './game/SongScene';
import { SongsScene } from './game/SongsScene';
import { PiecesScene } from './game/PiecesScene';
import { SettingsScene } from './game/SettingsScene';
import { BeatLanesScene } from './game/BeatLanesScene';
import { createSoundAndInput } from './compose';
import { startDebug } from './debugSetup';
import { chooseStore, createMemoryProfileService, createProfileService } from './profileSetup';
import { MemoryStore } from './io/storage/MemoryStore';
import { OwnPieces } from './game/editor/OwnPieces';
import { OwnSongs } from './game/OwnSongs';
import { bundledPieceSources, bundledSongFiles } from './game/content';
import { PieceCatalogue } from './game/pieceCatalogue';
import { SongCatalogue } from './game/songCatalogue';
import { browserTextFiles } from './io/files/textFiles';
import { EditorScene } from './game/EditorScene';
import { AdminGateScene } from './game/AdminGateScene';
import { AdminPagesScene } from './game/AdminPagesScene';
import { AdminDeleteScene } from './game/AdminDeleteScene';
import { AdminPasswordScene } from './game/AdminPasswordScene';
import { TeacherGateScene } from './game/TeacherGateScene';
import { TeacherPasswordScene } from './game/TeacherPasswordScene';
import { TeacherScene } from './game/TeacherScene';
import { TeacherPieceScene } from './game/TeacherPieceScene';
import { TeacherTestsScene } from './game/TeacherTestsScene';
import { TeacherCastScene } from './game/TeacherCastScene';
import { createTeacherDesk } from './io/teacher/teacherDesk';
import { createAdminAccess } from './io/admin/adminAccess';
import { canvasSize } from './core/layout/canvasSize';
import { frameFits } from './core/layout/frame';
import { displayText, setLanguage } from './core/text/language';
import { t } from './core/text/strings';
import { C, css } from './game/ui/pixel/palette';
import { loadStaffFont } from './game/ui/staff/staffFont';
import { gameLoopConfig } from './game/gameLoop';

async function startGame(): Promise<void> {
  const keyboardHost = document.getElementById('keyboard')!;
  const params = new URLSearchParams(window.location.search);
  // `?debug=1` (ft_Y_15): the debug log starts first, so an error while the game starts is in it; without it nothing runs
  const debug = appConfig.flags.debug ? startDebug() : null;
  setLanguage(appConfig.flags.language);
  setSceneryStill(appConfig.theme.reducedMotion);

  // Composition root: inputs exist at once (on-screen + computer keyboard); real MIDI joins when the browser allows it.
  const { audio, inputs } = createSoundAndInput(keyboardHost, { waitForSound: true });
  // Autoplay (ft_Y_09, dev only) plays with a player and pieces that live in memory only: nothing real is read or written.
  const autoplay = import.meta.env.DEV ? appConfig.flags.autoplay : null;
  const store = autoplay ? new MemoryStore() : (await chooseStore()).store;
  const ownPieces = await OwnPieces.load(store);
  const ownSongs = await OwnSongs.load(store);
  // Drafts: on in a dev server (not `npm run start`), and in `npm run start` only when the admin page turned them on.
  const admin = createAdminAccess(store);
  const adminSettings = await admin.settings();
  // the piano this computer plays (ft_0_07.AC3, AC4): full unless the admin pages chose light or the keyboard; no sample loads before this
  void audio.piano.setSound(adminSettings.pianoSound);
  const showDrafts = appConfig.flags.showDraftContent || (import.meta.env.DEV && (await admin.drafts()));
  // the songs (ft_1_36) find their pieces in the catalogue, and the catalogue finds a whole song by its chart id
  let songs: SongCatalogue | null = null;
  const pieces = new PieceCatalogue({ ...bundledPieceSources(), ownPieces: () => ownPieces.pieces(), showDrafts, songPiece: (id) => songs?.pieceFor(id) });
  const { service: profiles, persistent } = autoplay
    ? { service: await createMemoryProfileService(), persistent: false }
    : await createProfileService(pieces, appConfig.flags.testPlayers, () => songs?.pieceIds() ?? new Set());
  songs = new SongCatalogue({ files: bundledSongFiles(), showDrafts, piece: (id) => pieces.find(id), partsOff: (id) => profiles.songPartsOff(id), own: () => ownSongs.list() });
  const { actors, editor, learn, demo, staffDemo, sky } = appConfig.flags;
  // the keyboard switch's state, made before the context that hands it to the scenes (the switch rule is further down)
  let keysShown = params.get('keys') === '1';
  const switchListeners = new Set<() => void>();
  const context: GameContext = {
    keyboard: inputs.keyboard, lights: inputs.lights, midi: null, audio, profiles, flags: { actors, editor, learn, demo, staffDemo, sky, devTools: import.meta.env.DEV, autoplay: autoplay !== null, draftsShown: appConfig.flags.showDraftContent, pageBase: window.location.href, intro: appConfig.flags.intro }, pieces, songs, ownPieces, ownSongs, files: browserTextFiles, savesPersist: persistent, admin, teacher: createTeacherDesk(store), adminSettings,
    keyboardSwitch: {
      shown: () => keyboardHost.style.display !== 'none',
      toggle: () => toggleKeyboard(),
      enabled: () => true,
      onChange: (listener) => {
        switchListeners.add(listener);
        return () => switchListeners.delete(listener);
      },
    },
  };

  // the staff's font is in before the first text is drawn (d288)
  await loadStaffFont();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: css(C.night),
    pixelArt: true,
    // every step gets its real time, so the game's timers keep real time on a slow or unfocused machine (gameLoop.ts)
    fps: gameLoopConfig(appConfig.flags.timerLoop),
    // sized by `fitGame` below in physical pixels, not by Phaser's RESIZE mode (which uses CSS pixels)
    scale: { mode: Phaser.Scale.NONE },
    scene: [BootScene, MenuScene, ProfilesScene, ProfileDashboardScene, NoteTrainerScene, EarTrainerScene, ShapeTrainerScene, ChordTrainerScene, LessonBookScene, LessonScene, AdminScene, AdminGateScene, AdminPagesScene, AdminPasswordScene, AdminDeleteScene, TeacherScene, TeacherPieceScene, TeacherTestsScene, TeacherCastScene, TeacherGateScene, TeacherPasswordScene, NameScene, SongScene, SongsScene, CreditsScene, SettingsScene, BeatLanesScene, PiecesScene, AnalyzeScene, LearnStatsScene, PracticeScene, ResultsScene, EditorScene, StaffDemoScene, ArtDemoScene, KiurDoorScene, LearnResumeScene, EditorLeaveScene, IntroScene, CircleOfFifthsScene, KeriMapScene, ...adventureScenes()],
  });
  game.registry.set(CONTEXT_KEY, context);
  debug?.watch(game, inputs.keyboard);
  // Dev only: lets browser checks and e2e tests look at the running game and drive the virtual EZ-220.
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __virtualDevice: inputs.virtualDevice });

  // The on-screen keyboard is a developer's tool now: hidden at first, with or without a piano (the
  // computer keys still play), and `?keys=1` shows it from the start. The switch on the settings screen's toolbar shows or
  // hides it for this visit only (d099, ft_Y_12). Hidden, it takes no room: the game gets its height.
  function applyKeyboardVisibility(): void {
    keyboardHost.style.display = keysShown ? 'block' : 'none';
    switchListeners.forEach((listener) => listener());
  }
  function toggleKeyboard(): void {
    keysShown = !keysShown;
    updateKeyboard();
  }
  // The game fills what the page leaves it: measure the parent again, or Phaser keeps the old height. The canvas has
  // one pixel per screen pixel, so under Windows display scaling (125%, 150%) it stays sharp instead of being stretched.
  const fitGame = () => {
    game.scale.getParentBounds();
    const size = canvasSize(game.scale.parentSize.width, game.scale.parentSize.height, window.devicePixelRatio);
    game.scale.zoom = size.zoom;
    game.scale.resize(size.width, size.height);
    // Phaser leaves the old CSS size when the new one equals the canvas size (back to 100% scaling)
    game.canvas.style.width = `${size.width * size.zoom}px`;
    game.canvas.style.height = `${size.height * size.zoom}px`;
    // a page a few pixels short of the zoom (Chrome's F11 on a 1920x1080 screen gives 1910 x 1070): the canvas keeps its full size, centred,
    // and the page (#game, overflow hidden) trims its edges (d110)
    game.canvas.style.marginLeft = `${size.offsetX * size.zoom}px`;
    game.canvas.style.marginTop = `${size.offsetY * size.zoom}px`;
    game.scale.refresh();
  };
  window.addEventListener('resize', fitGame);
  // a change of the display's scaling alone (the window dragged to a screen of other scaling) fires no resize
  onPixelRatioChange(() => window.dispatchEvent(new Event('resize')));
  if (!appConfig.flags.anySize) guardScreenSize(game, (held) => inputs.hold(held));
  profiles.onKeyboardSettings(() => {
    const before = keyboardHost.style.display;
    applyKeyboardVisibility();
    if (keyboardHost.style.display !== before) fitGame();
  });
  const updateKeyboard = () => {
    applyKeyboardVisibility();
    fitGame();
    game.events.emit(MIDI_CHANGED);
  };
  void inputs.ready.then(() => {
    context.midi = inputs.midi;
    inputs.midi?.onStatus(updateKeyboard);
    updateKeyboard();
  });
  updateKeyboard();

  if (import.meta.env.DEV && autoplay && inputs.virtualDevice) {
    // Dev only: the director plays the scenario once the virtual keyboard is open (it is removed from a production build).
    const device = inputs.virtualDevice;
    void Promise.all([import('./dev/autoplay/scenario'), inputs.ready]).then(([{ DEFAULT_SCENARIO_ID, findScenario, withOverrides }]) => {
      const scenario = withOverrides(findScenario(autoplay.scenario ?? DEFAULT_SCENARIO_ID), autoplay.overrides);
      return import('./dev/autoplay/director').then(({ startAutoplay }) => {
        Object.assign(window, { __autoplay: startAutoplay({ game, device, scenario }) });
      });
    });
  }
}

/**
 * A window too small to play in (d105: less than the tested art area at 2x, `frameFits`) gets a plain cover with one
 * centred line asking for a bigger window and F11, and the game underneath is paused (no state is lost); it comes back by
 * itself when the window is big enough. A normal browser window plays. The whole window counts, not the canvas, so the on-screen keyboard (a developer's tool) never sets it off.
 */
function guardScreenSize(game: Phaser.Game, holdInput: (held: boolean) => void): void {
  const cover = document.createElement('div');
  cover.id = 'screen-guard';
  // in capitals (make the window bigger, F11): one loud line, the only thing on the screen
  cover.textContent = displayText(t('screen.tooSmall'), 'upper');
  Object.assign(cover.style, {
    position: 'fixed', inset: '0', zIndex: '10', display: 'none', alignItems: 'center', justifyContent: 'center',
    background: css(C.night), color: css(C.cream), font: 'bold 48px monospace', textAlign: 'center',
  });
  document.body.appendChild(cover);
  let covered = false;
  // the hidden screen takes no key press while covered: the scenes' window keys (Esc would end a piece) and the computer
  // keyboard's piano; a release still goes through, so a key held when the cover came is let go. F11 still reaches the
  // browser, as nothing prevents its default. The scenes' window keys also listen in the capture phase, so this one
  // must be added first: it is, here at the start, before any scene has been created
  window.addEventListener('keydown', (e) => {
    if (covered) e.stopImmediatePropagation();
  }, { capture: true });
  const check = () => {
    const size = canvasSize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
    const fits = frameFits(size.width, size.height);
    covered = !fits;
    cover.style.display = fits ? 'none' : 'flex';
    holdInput(covered);
    if (fits) game.resume();
    else game.pause();
  };
  window.addEventListener('resize', check);
  check();
}

/** Calls back each time `devicePixelRatio` changes (a media query for the current ratio, made again after every change). */
function onPixelRatioChange(changed: () => void): void {
  const watch = () => {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', () => {
      changed();
      watch();
    }, { once: true });
  };
  watch();
}

// The dev pages: `demo` is always null in a production build (src/config.ts), and the `import.meta.env.DEV` test lets the
// build drop them and what they import (a dev sample chart) instead of shipping chunks nothing can open.
const demo = import.meta.env.DEV ? appConfig.flags.demo : null;
if (demo === 'keys') {
  // Dev page for the input stack: plain DOM, no Phaser game.
  void import('./dev/keysDemo').then((m) => m.startKeysDemo());
} else if (demo === 'audio') {
  // Dev page for sound, the song clock and the metronome: plain DOM.
  void import('./dev/audioDemo').then((m) => m.startAudioDemo());
} else if (demo === 'preview') {
  // Dev page for reviewing pieces: the piece list, lint output, the game's staff, playback and play-along.
  void import('./dev/previewDemo').then((m) => m.startPreview());
} else if (demo === 'analyse') {
  // Dev page to score MusicXML files for difficulty (ft_Y_04 slice 1, core_08): plain DOM.
  void import('./dev/analyseDemo').then((m) => m.startAnalyseDemo());
} else if (demo === 'profile') {
  // Dev page to export and import a player's progress as JSON: plain DOM.
  void import('./dev/profileDemo').then((m) => m.startProfileDemo());
} else {
  void startGame();
}
