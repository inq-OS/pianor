import type Phaser from 'phaser';
import type { EditorData } from './EditorScene';
import type { NameData } from './NameScene';
import type { SongData } from './SongScene';
import type { PracticeData } from './PracticeScene';
import type { PreviewData } from './PreviewScene';
import type { ResultsData } from './ResultsScene';
import type { SettingsData } from './SettingsScene';
import type { BeatLanesData } from './BeatLanesScene';
import type { PiecesData } from './PiecesScene';
import type { AnalyzeData } from './AnalyzeScene';
import type { LearnStatsData } from './LearnStatsScene';
import type { AdminData } from './AdminScene';
import type { CircleKey } from '../core/layout/circleOfFifths';
import type { TeacherData } from './TeacherScene';
import type { TeacherPieceData } from './TeacherPieceScene';
import type { TeacherTestsData } from './TeacherTestsScene';
import type { TeacherCastData } from './TeacherCastScene';
import type { CircleData } from './CircleOfFifthsScene';
import type { MenuData } from './MenuScene';
import type { VisitData } from './visit/islandVisit';
import type { RoomData } from './ProfileDashboardScene';
import type { IntroData } from './IntroScene';
import type { MapData } from './KeriMapScene';
import type { LessonBookData } from './LessonBookScene';
import type { LessonData } from './LessonScene';

/**
 * Every scene key and the data its `init` takes (`undefined`: none). `startScene` checks both, so a renamed key or a
 * changed `init` shows up as a type error at each caller instead of a blank screen.
 */
export interface SceneData {
  'boot': undefined;
  'profiles': undefined;
  'profile': RoomData | undefined;
  'noteTrainer': undefined;
  'earTrainer': undefined;
  'shapeTrainer': undefined;
  'chordTrainer': undefined;
  'lessonBook': LessonBookData | undefined;
  'lesson': LessonData;
  'admin': AdminData | undefined;
  'adminDelete': undefined;
  'adminGate': undefined;
  'adminPages': undefined;
  'adminPassword': undefined;
  'teacher': TeacherData | undefined;
  'teacherGate': undefined;
  'teacherPiece': TeacherPieceData;
  'teacherTests': TeacherTestsData;
  'teacherCast': TeacherCastData;
  'teacherPassword': undefined;
  'name': NameData;
  'song': SongData;
  'songs': undefined;
  'credits': undefined;
  'settings': SettingsData | undefined;
  'beat-lanes': BeatLanesData | undefined;
  'pieces': PiecesData | undefined;
  'menu': MenuData | undefined;
  'practice': PracticeData;
  'results': ResultsData;
  'analyze': AnalyzeData;
  'learn-stats': LearnStatsData;
  'editor': EditorData;
  'preview': PreviewData;
  'staff-demo': undefined;
  'art-demo': undefined;
  'kiurDoor': undefined;
  'learnResume': undefined;
  'intro': IntroData;
  'circle': CircleData | undefined;
  'keriMap': MapData | undefined;
  'knoll': VisitData | undefined;
  'crossroads': VisitData | undefined;
  'docks': VisitData | undefined;
  'port': VisitData | undefined;
  'terrace': VisitData | undefined;
}

export type SceneKey = keyof SceneData;

/**
 * Starts scene `key` (stopping the caller) with the data its `init` takes. A scene whose data may be left out (`undefined`
 * in `SceneData`, or a data type that includes it) can be started without any.
 */
export function startScene<K extends SceneKey>(from: Phaser.Scene, key: K, ...data: undefined extends SceneData[K] ? [SceneData[K]?] : [SceneData[K]]): void {
  // Phaser only queues the move: a second move asked before it happens (a click, then Esc at once) would start both
  // screens, so a screen on its way out ignores it, until it shuts down or is started anew.
  if (leaving.has(from)) return;
  leaving.add(from);
  const settled = (): void => {
    leaving.delete(from);
    from.events.off('shutdown', settled);
    from.events.off('start', settled);
  };
  from.events.once('shutdown', settled);
  from.events.once('start', settled);
  from.scene.start(key, freshData(data[0]));
}

/** The screens that asked `startScene` for a move that has not happened yet. */
const leaving = new WeakSet<Phaser.Scene>();

/**
 * The data a scene is started with, never `undefined`: Phaser keeps a scene's last data when it is started again without
 * any, so a scene would come back with an earlier start's piece list.
 */
export function freshData<T extends object>(data: T | undefined): T | Record<string, never> {
  return data ?? {};
}

/**
 * What each overlay returns when it closes (d070): an overlay is pushed on top of a screen, which is paused and keeps its
 * state, and hands back one of these, or `cancelled` (Esc). Deciding what a choice means stays with the caller and `core/`.
 */
export interface SceneResult {
  /** Kiur at the door after key bashing (ft_1_15): back to the piece, or out through the door. */
  'kiurDoor': 'back' | 'door';
  /** Reopening a half-learned piece (ft_1_32.AC16): go on where it stopped, or start over from the first bar. */
  'learnResume': 'continue' | 'over';
  /** The first-run intro's spotlight (ft_1_31): Kiur's steps were all read (Esc gives `cancelled`: skip the intro). */
  'intro': 'read' | 'skip';
  /** The circle of fifths (ft_1_28): it closed, or (opened to choose, from the piece maker) the key chosen. */
  'circle': 'closed' | CircleKey;
  /** Tuning the beat lanes over the practice screen (core_13 rule 10): it closed, whatever was kept is saved. */
  'beat-lanes': 'closed';
}

export type OverlayKey = keyof SceneResult;
export const CANCELLED = 'cancelled';
export type OverlayOutcome<K extends OverlayKey> = SceneResult[K] | typeof CANCELLED;

/** The overlays open now: who opened each, and how to hand the result back. */
const openOverlays = new Map<OverlayKey, { caller: string; resolve: (result: never) => void }>();

/**
 * Pushes overlay `key` on top of `from` (d070): launches it with its data, pauses `from` and resolves with what the
 * overlay returns (`closeOverlay`), or `cancelled` when it closes any other way. `from` is resumed before the promise resolves.
 */
export function openOverlay<K extends OverlayKey>(from: Phaser.Scene, key: K, ...data: undefined extends SceneData[K] ? [SceneData[K]?] : [SceneData[K]]): Promise<OverlayOutcome<K>> {
  return new Promise<OverlayOutcome<K>>((resolve) => {
    settleOverlay(key, CANCELLED); // an overlay is open once at a time
    openOverlays.set(key, { caller: from.scene.key, resolve });
    from.scene.launch(key, freshData(data[0]));
    from.scene.pause();
  });
}

/** The overlay closes itself with `result`: it stops, the screen under it is resumed, and `openOverlay` resolves. */
export function closeOverlay<K extends OverlayKey>(overlay: Phaser.Scene, key: K, result: OverlayOutcome<K>): void {
  const entry = openOverlays.get(key);
  openOverlays.delete(key);
  overlay.scene.stop();
  if (!entry) return;
  overlay.scene.resume(entry.caller);
  (entry.resolve as (r: OverlayOutcome<K>) => void)(result);
}

/** The overlay went away without a choice (its shutdown): `cancelled`, and the caller is resumed. Nothing when already closed. */
export function settleOverlay<K extends OverlayKey>(key: K, result: OverlayOutcome<K>, overlay?: Phaser.Scene): void {
  const entry = openOverlays.get(key);
  if (!entry) return;
  openOverlays.delete(key);
  overlay?.scene.resume(entry.caller);
  (entry.resolve as (r: OverlayOutcome<K>) => void)(result);
}
