import { parseLanguage, type Language } from './core/text/language';
import type { StaffDemoView } from './game/context';
import type { SkyPhase } from './core/sky/skyPhase';
import { windFrom, type Wind } from './core/sky/wind';

/** Single config object: feature flags and theme/scale settings. Views read this; nothing else. */
export interface AppConfig {
  readonly flags: {
    /** Dev-only sky switches (ft_1_14 AC6): `?sky=dawn|day|dusk|night` forces the phase, `?now=<ISO time>` sets the instant. */
    readonly sky: SkyFlag;
    /** The language the game shows: Estonian by default; `?lang=en` for the English catalog (ft_0_18). */
    readonly language: Language;
    /**
     * Show draft (unapproved) pieces. Dev only, and never in `npm run start` (Vite mode `start`): the student meets only approved
     * pieces there. The admin toggle that turns drafts on there is not built yet.
     */
    readonly showDraftContent: boolean;
    /** Use the virtual EZ-220 instead of real MIDI (wired up with the MIDI io). */
    readonly virtualDevice: boolean;
    /** Make real MIDI keys sound through the browser too (the EZ-220 normally sounds itself). Always on with the virtual device. */
    readonly monitorMidi: boolean;
    /** Show the beings in the scenes on Keri (ft_1_19.AC8). Off: the scenes stay clean until the beings are overhauled; `?beings=1` shows them. */
    readonly beings: boolean;
    /** Dev only (ft_1_24, WP-05): the demo cast (Kiur, a template villager and a placeholder box) stands in the adventure scenes, `?actors=1`. */
    readonly actors: boolean;
    /** Show the piece editor (preliminary): a Make mode in the menu. On; `?editor=0` hides it. */
    readonly editor: boolean;
    /**
     * A new piece is learned bar by bar before it is practised (ft_1_32). On; `?learn=0` opens every piece as before, for the
     * end-to-end tests that play whole pieces, and autoplay never learns (its director plays whole pieces).
     */
    readonly learn: boolean;
    /** Dev-only demo scene to open instead of the game, e.g. "staff". */
    readonly demo: string | null;
    /** How the staff demo lays out (`?piece=3&hints=nf&vw=1366&vh=768&zoom=1&cx=400&cy=200`). */
    readonly staffDemo: StaffDemoView;
    /**
     * Dev-only autoplay (ft_Y_09, `?autoplay=1`): a director plays a scenario through the real scenes with an in-memory player.
     * Always null in a production build. `scenario` is a scenario id (`?scenario=`); `overrides` are the optional `?piece=`,
     * `?speed=` and `?seed=` that replace the scenario's own values.
     */
    readonly autoplay: AutoplayFlag | null;
    /**
     * Dev only (`?anysize=1`, d105): play in a window of any size. Without it, a window too small for the tested layout
     * at 2x (under 768 x 432 physical pixels) shows only the line asking for a bigger window and F11.
     */
    readonly anySize: boolean;
    /**
     * Dev only (`?players=test`): a new install starts with the four test players (`TEST_PLAYER_NAMES`) instead of asking for
     * the first player's name (ft_1_07.AC1). The end-to-end tests use it.
     */
    readonly testPlayers: boolean;
    /**
     * Dev only (`?loop=timer`): the game's loop steps on a timer instead of on the browser's animation frames. The end-to-end
     * tests use it on machines without a GPU (cloud sessions, Linux CI): there Chrome copies every frame drawn on an animation
     * frame back from its software GPU before the page may go on, so each small save or load step waited a whole frame
     * (listing the players took 2 s instead of 6 ms). Stepped on a timer, the game draws as many frames and the page stays free.
     */
    readonly timerLoop: boolean;
    /**
     * `?debug=1` (ft_Y_15): keep the built-in debug log and show its download button. Not dev only: the bugs that matter happen in
     * `npm run start:local`, a production build.
     */
    readonly debug: boolean;
    /**
     * The first-run intro (ft_1_31): `?intro=1` plays it in the room whatever was played, `?intro=0` never (the end-to-end
     * tests, which start every page with a new player); else a new player gets it. Not dev only: the maintainer may show it again.
     */
    readonly intro: IntroMode;
  };
  readonly theme: {
    readonly uiScale: number;
    readonly reducedMotion: boolean;
  };
}

/** What `?sky=` and `?now=` ask for (see `AppConfig.flags.sky`); both null in a production build. */
export interface SkyFlag {
  readonly phase: SkyPhase | null;
  readonly now: number | null;
  /** `?wind=0..3` or a sea state (`calm`, `waves`, `restless`, `stormy`): the wind over the sea in the painted pictures. */
  readonly wind: Wind | null;
}

/** The dev-only sky switches, read from the page address. */
export function skyFlag(params: URLSearchParams, dev: boolean): SkyFlag {
  if (!dev) return { phase: null, now: null, wind: null };
  const phase = params.get('sky');
  const now = params.get('now');
  const instant = now ? Date.parse(now) : Number.NaN;
  return {
    phase: phase === 'dawn' || phase === 'day' || phase === 'dusk' || phase === 'night' ? phase : null,
    now: Number.isNaN(instant) ? null : instant,
    wind: windFrom(params.get('wind')),
  };
}

/** `?intro=` (see `AppConfig.flags.intro`). */
export type IntroMode = 'auto' | 'force' | 'off';

export function introMode(value: string | null): IntroMode {
  return value === '1' ? 'force' : value === '0' ? 'off' : 'auto';
}

/** What `?autoplay=1` asks for (see `AppConfig.flags.autoplay`). */
export interface AutoplayFlag {
  /** The scenario id of `?scenario=`; null when it was not given (the dev code then plays its default). */
  readonly scenario: string | null;
  readonly overrides: { readonly piece?: string; readonly speed?: number; readonly seed?: number };
}

/** `?autoplay=1` in a dev build, else null: the one place that decides whether autoplay exists. A number override that is not a number is left out. */
export function autoplayFlag(params: URLSearchParams, dev: boolean): AutoplayFlag | null {
  if (!dev || params.get('autoplay') !== '1') return null;
  const number = (name: string): number | undefined => {
    const raw = params.get(name);
    const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const piece = params.get('piece');
  const speed = number('speed');
  const seed = number('seed');
  return {
    scenario: params.get('scenario') || null,
    overrides: { ...(piece ? { piece } : {}), ...(speed === undefined ? {} : { speed }), ...(seed === undefined ? {} : { seed }) },
  };
}

/** The staff demo's view settings from the page address; a number that is missing, 0 or not a number is null. */
export function staffDemoView(params: URLSearchParams): StaffDemoView {
  const number = (name: string): number | null => Number(params.get(name)) || null;
  return { piece: number('piece'), hints: params.get('hints') ?? '', vw: number('vw'), vh: number('vh'), zoom: number('zoom'), cx: number('cx'), cy: number('cy') };
}

/**
 * `dev` is `import.meta.env.DEV` (false in a production build); `mode` is `import.meta.env.MODE` (`start` for `npm run start`).
 * Tests pass both to check that dev-only switches stay off.
 */
export function createConfig(search: string = '', dev: boolean = import.meta.env.DEV, mode: string = import.meta.env.MODE): AppConfig {
  const params = new URLSearchParams(search);
  const autoplay = autoplayFlag(params, dev);
  return {
    flags: {
      language: parseLanguage(params.get('lang')),
      showDraftContent: dev && mode !== 'start',
      virtualDevice: params.get('device') === 'virtual' || autoplay !== null,
      monitorMidi: params.get('device') === 'virtual' || autoplay !== null || params.get('monitor') === '1',
      beings: params.get('beings') === '1',
      actors: dev && params.get('actors') === '1',
      editor: params.get('editor') !== '0',
      learn: params.get('learn') !== '0' && autoplay === null,
      demo: dev ? params.get('demo') : null,
      staffDemo: staffDemoView(params),
      sky: skyFlag(params, dev),
      autoplay,
      anySize: dev && params.get('anysize') === '1',
      testPlayers: dev && params.get('players') === 'test',
      timerLoop: dev && params.get('loop') === 'timer',
      debug: params.get('debug') === '1',
      intro: introMode(params.get('intro')),
    },
    // the scenery moves unless asked not to; the operating system's setting is not read (d127)
    theme: { uiScale: 1, reducedMotion: params.get('motion') === 'still' },
  };
}
