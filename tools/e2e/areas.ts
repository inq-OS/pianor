/**
 * The end-to-end tests in areas (docs/testing.md section 10). Each area is a Playwright project, so
 * `npm run test:e2e -- --project=editor` runs one area, and `npm run test:e2e:affected` runs the areas a change touches.
 *
 * A path pattern is a folder (ends in `/`), a file, or `*.ext` (any file with that ending). `areas.test.ts` checks that
 * every spec file is in exactly one area and that every pattern still names something, so a rename shows up at once.
 */

export interface E2eArea {
  /** Playwright project name. */
  name: string;
  /** Spec files in tests/e2e without `.spec.ts`; each spec belongs to exactly one area. */
  specs: string[];
  /** Paths whose change runs this area again. A path may belong to several areas. */
  sources: string[];
}

export const E2E_AREAS: E2eArea[] = [
  {
    name: 'practice',
    specs: ['practice', 'practice-tools', 'onscreen-keyboard', 'tempo', 'play-loop', 'analyze', 'kiur-door', 'learn', 'learn-stats'],
    sources: [
      'src/game/PracticeScene.ts', 'src/game/KiurDoorScene.ts', 'src/game/AnalyzeScene.ts', 'src/core/analysis/', 'src/game/ResultsScene.ts', 'src/game/practice/',
      'src/game/ui/staff/', 'src/core/judge/', 'src/core/scoring/', 'src/core/transport/', 'src/core/layout/',
    ],
  },
  {
    name: 'staff',
    specs: ['twohands', 'settings', 'grace-notes'],
    sources: ['src/game/SettingsScene.ts', 'src/game/StaffDemoScene.ts', 'src/game/ui/staff/', 'src/core/layout/'],
  },
  {
    name: 'menu',
    specs: ['progress', 'player-screens', 'icon-buttons', 'room', 'pieces', 'pieceInfo', 'piece-stats', 'keyboard-navigation', 'adventure-script', 'teacher-arrival', 'intro', 'hotspots', 'talk', 'fisherman', 'tug', 'teach', 'estonian', 'note-trainer', 'ear-trainer', 'shape-trainer', 'chord-trainer'],
    sources: [
      'src/game/MenuScene.ts', 'src/game/KeriMapScene.ts', 'src/game/adventure/', 'content/scenes/', 'content/actors/', 'content/scripts/', 'content/characters/', 'content/conversations/', 'content/challenge/', 'content/items/', 'src/core/item/', 'src/core/dialogue/', 'src/core/exchange/', 'src/core/scene/', 'src/game/visit/', 'src/core/visit/', 'src/game/room/', 'src/core/world/', 'src/core/campaign/', 'content/world/', 'src/game/PiecesScene.ts', 'src/game/CreditsScene.ts', 'src/game/menu/', 'src/game/profile/',
      'src/game/ProfilesScene.ts', 'src/game/ProfileDashboardScene.ts', 'src/game/IntroScene.ts', 'src/game/intro/', 'src/core/intro/', 'content/intro/', 'src/game/NoteTrainerScene.ts', 'src/game/ShapeTrainerScene.ts', 'src/game/ChordTrainerScene.ts', 'src/core/trainer/', 'content/trainer/', 'src/game/AdminScene.ts', 'src/game/NameScene.ts',
      'src/game/pieceList.ts', 'src/profileSetup.ts', 'src/core/progression/', 'src/core/properties/', 'content/curriculum/',
    ],
  },
  {
    name: 'editor',
    specs: ['editor', 'circle-of-fifths'],
    sources: ['src/game/EditorScene.ts', 'src/game/editor/', 'src/core/editor/', 'src/game/CircleOfFifthsScene.ts', 'src/core/layout/circleOfFifths.ts', 'src/core/trainer/scaleChart.ts'],
  },
  {
    name: 'preview',
    specs: ['preview', 'analyse'],
    sources: ['src/game/PreviewScene.ts', 'src/game/preview/', 'tools/piece/', 'tools/vite-pieces.ts', 'src/core/import/'],
  },
  {
    name: 'dev',
    specs: ['autoplay', 'spike', 'debug-log'],
    sources: ['src/dev/', 'content/dev/', 'src/spike/', 'spike.html', 'src/debugSetup.ts', 'src/core/debug/'],
  },
  {
    // Screenshot tests; they skip without a baseline for the platform (on CI and in cloud sessions), so they cost little.
    name: 'visual',
    specs: ['visual', 'button-fit', 'toolbar', 'band', 'bubble', 'screen-guard'],
    sources: ['src/game/'],
  },
];

/** A change here can break any screen: every area runs. Checked before the areas' own paths, so `src/io/` here wins. */
export const SHARED_PATHS: string[] = [
  'src/main.ts', 'src/appConfig.ts', 'src/config.ts', 'src/compose.ts', 'src/virtual-pieces.d.ts', 'src/virtual-keri.d.ts', 'src/vite-env.d.ts', 'tools/vite-keri.ts',
  'src/game/BootScene.ts', 'src/game/context.ts', 'src/game/content.ts', 'src/game/ui/pixel/',
  'src/core/chart/', 'src/core/text/', 'src/core/random.ts', 'src/io/', 'content/pieces/', 'public/', 'index.html',
  'tests/e2e/helpers.ts', 'tests/e2e/targetView.ts', 'tools/e2e/', 'playwright.config.ts', 'vite.config.ts', 'tsconfig.json', 'package.json',
  'package-lock.json', '.github/',
];

/** A change here needs no end-to-end test (docs, unit tests and their fixtures, tools the game does not load). */
export const NO_E2E_PATHS: string[] = [
  'docs/', '*.md', '*.test.ts', 'tests/fixtures/', 'tests/golden/', 'tests/replays/', 'tests/helpers/', 'tests/contracts/',
  'tests/e2e/.gitkeep', 'tools/docs/', 'tools/generate/', '.claude/', '.githooks/', 'LICENSE', '.gitattributes', '.gitignore',
  'eslint.config.js',
];
