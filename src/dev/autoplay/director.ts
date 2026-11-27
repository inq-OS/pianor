/**
 * The autoplay director (ft_Y_09, dev only): drives the real flow through the real scenes. It opens a piece from the menu with
 * mouse events on the canvas at the button's place (what a finger would do), plays the piece through the virtual EZ-220 with the
 * virtual player, waits for the results screen, and, if the scenario says so, goes back to the menu for the next piece.
 * It holds no game rules: the scenes and the judge decide everything; this only presses what a person could press.
 * Scene fields are read through the narrow `SceneLike` view below (the same ones the end-to-end tests read).
 */
import type Phaser from 'phaser';
import type { Chart } from '../../core/chart';
import { t } from '../../core/text/strings';
import { contextOf } from '../../game/context';
import { CHARACTERS } from '../../game/adventure/scenesData';
import { newCurriculumPiece, withPiece } from '../../game/teacher/curriculumForm';
import { dayString } from '../../io/teacher/teacherDesk';
import { DEFAULT_TEACHER_PASSWORD } from '../../core/admin/teacherRecord';
import { piecesThatAreOn } from '../../game/pieceList';
import { playThroughDevice } from '../../io/mock/performance';
import type { VirtualEz220 } from '../../io/mock/VirtualEz220';
import { ClockScheduler, deviceOnClock, songToDomTime } from './clockScheduler';
import type { Scenario } from './scenario';
import { pastWeek } from './pastWeek';
import { scenarioPerformance } from './scenarioPerformance';
import { cardShowing, showsTitle } from './menuCard';

export type AutoplayPhase = 'starting' | 'menu' | 'playing' | 'results' | 'waiting' | 'teacher' | 'finished' | 'stopped' | 'error';

/** What a person (or a test) can read about the run. Kept on `window.__autoplay` in a dev build. */
export interface AutoplayStatus {
  scenario: string;
  phase: AutoplayPhase;
  /** Pieces played so far (the one being played counts). */
  run: number;
  pieceId: string | null;
  /** The results screen's numbers of the last piece. */
  last: { accuracy: number; mistakes: number; timingScore: number | null; missed: number | null } | null;
  error: string | null;
  log: string[];
}

export interface AutoplayHandle {
  readonly status: AutoplayStatus;
  /** Stop playing at the next step; what is on the screen stays. */
  stop(): void;
  /** Resolves when the run has ended (finished, stopped or failed). Never rejects. */
  readonly done: Promise<void>;
}

export interface AutoplayOptions {
  game: Phaser.Game;
  device: VirtualEz220;
  scenario: Scenario;
  /** How long the results stay on screen before the next piece (ms). */
  lingerMs?: number;
  /** Pause before the first note, so a viewer sees the practice screen (ms). */
  leadMs?: number;
}

interface ButtonLike {
  disabled: boolean;
  objects: { text?: string }[];
  screenCenter(): { x: number; y: number };
}
interface TransportLike {
  started: boolean;
  timeOfTick(tick: number): number | null;
}
interface SceneLike {
  scene: { key: string };
  buttons?: ButtonLike[];
  /** The play screens' `PlaySession`, with the Tempo-mode transport. */
  playSession?: { transport: TransportLike | null };
  result?: { accuracy: number; mistakes: number; timing?: { score: number; missed: number } };
}
/** An adventure scene as the challenge scenario drives it (`AdventureScene`'s hooks for the demo and the tests). */
interface ChallengeScene extends SceneLike {
  talkTo(id: string): Promise<boolean>;
  talkState: unknown;
  pressTalk(): void;
  chooseTug(outcome?: 'tug' | 'teach'): boolean;
  teachState: { who: 'character' | 'student' | null; outcome?: string; saying: string | null; closing: boolean } | null;
  teachPhrase: Chart | null;
  tugState: { who: 'character' | 'student' | null; turn: number; standing: number; outcome?: string; saying: string | null; closing: boolean } | null;
  tugPhrase: Chart | null;
  /** Tempo mode (levels 2 and 3): when the student's phrase plays. */
  tugTransport: TransportLike | null;
}

class Stopped extends Error {}

/** The days of practice the demo week has before its deadline day. */
const PAST_DAYS = 6;

/** A button's label: the first text among its objects (an icon, when it has one, comes before it). */
const label = (button: ButtonLike): string => button.objects.find((o) => typeof o.text === 'string')?.text ?? '';
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Start the director. It returns at once; `done` says when it is over. */
export function startAutoplay(options: AutoplayOptions): AutoplayHandle {
  const { game, device, scenario } = options;
  const lingerMs = options.lingerMs ?? 3000;
  const leadMs = options.leadMs ?? 1200;
  const context = contextOf(game);
  const clock = context.audio.clock;
  const status: AutoplayStatus = { scenario: scenario.id, phase: 'starting', run: 0, pieceId: null, last: null, error: null, log: [] };
  let stopped = false;
  let scheduler: ClockScheduler | null = null;

  const say = (phase: AutoplayPhase, message: string) => {
    status.phase = phase;
    status.log.push(message);
    console.info(`[autoplay ${scenario.id}] ${message}`);
  };
  const check = () => {
    if (stopped) throw new Stopped();
  };
  const scenes = () => game.scene.getScenes(true) as unknown as SceneLike[];
  const scene = (key: string): SceneLike | undefined => scenes().find((s) => s.scene.key === key);

  /** A closing line pressed a page at a time, each page read for a while, until `open` says it has closed. */
  async function pressThrough(open: () => boolean, press: () => void): Promise<void> {
    for (let page = 0; open(); page++) {
      if (page > 10) throw new Error('The closing line did not close');
      if (page > 0) await sleep(lingerMs);
      press();
      await sleep(100);
    }
  }

  async function waitUntil<T>(what: string, find: () => T | undefined | false | null, timeoutMs = 20000): Promise<T> {
    const until = performance.now() + timeoutMs;
    for (;;) {
      check();
      const found = find();
      if (found) return found;
      if (performance.now() > until) throw new Error(`Timed out waiting for ${what}`);
      await sleep(20);
    }
  }

  /** Press a button the way a finger does: the pointer arrives, goes down and comes up on the button, on the canvas. */
  async function click(button: ButtonLike): Promise<void> {
    if (button.disabled) throw new Error(`The button "${label(button)}" is disabled`);
    const canvas = game.canvas;
    const rect = canvas.getBoundingClientRect();
    const centre = button.screenCenter();
    const point = { clientX: rect.left + (centre.x / canvas.width) * rect.width, clientY: rect.top + (centre.y / canvas.height) * rect.height };
    const send = (type: string, buttons: number) => canvas.dispatchEvent(new MouseEvent(type, { ...point, button: 0, buttons, bubbles: true, cancelable: true, view: window }));
    send('mousemove', 0);
    await sleep(60);
    send('mousedown', 1);
    await sleep(60);
    send('mouseup', 0);
    await sleep(60);
  }

  /** Press a button of the menu and wait for the menu to be drawn again (every menu button redraws it). */
  async function clickInMenu(button: ButtonLike): Promise<SceneLike> {
    const menu = scene('menu')!;
    const before = menu.buttons;
    await click(button);
    return waitUntil('the menu to be drawn again', () => {
      const now = scene('menu');
      return now && now.buttons !== before && now.buttons && now.buttons.length > 0 ? now : undefined;
    });
  }

  const offeredIds = () => piecesThatAreOn(context.pieces.list(), context.profiles.hiddenPieces).map((p) => p.chart.id);
  const titleOf = (id: string): string => {
    const piece = context.pieces.find(id);
    if (!piece) throw new Error(`Unknown piece "${id}"`);
    return piece.chart.title;
  };
  const pieceTitles = () => new Set(piecesThatAreOn(context.pieces.list(), context.profiles.hiddenPieces).map((p) => p.chart.title));

  /** The menu in the scenario's mode, on its first page. */
  async function readyMenu(): Promise<SceneLike> {
    let menu = await waitUntil('the menu', () => {
      const m = scene('menu');
      return m && m.buttons && m.buttons.length > 0 ? m : undefined;
    });
    for (let turn = 0; turn < 50; turn++) {
      const previous = menu.buttons!.find((b) => label(b) === t('menu.previous'));
      if (!previous || previous.disabled) break;
      menu = await clickInMenu(previous);
    }
    return menu;
  }

  /** Open the piece with this id from the menu, turning pages as needed. With no id: the first card that can be opened. */
  async function openFromMenu(pieceId: string | undefined): Promise<string> {
    let menu = await readyMenu();
    const titles = pieceTitles();
    const wanted = pieceId === undefined ? undefined : titleOf(pieceId);
    for (let turn = 0; turn < 50; turn++) {
      // a curriculum piece's title is cut short beside its hat and days left, so a card is found by the start of its title too
      const buttons = menu.buttons!;
      const card = wanted === undefined
        ? buttons.find((b) => !b.disabled && [...titles].some((title) => showsTitle(label(b), title)))
        : buttons[cardShowing(buttons.map(label), wanted)];
      if (card) {
        const id = pieceId ?? offeredIds().find((candidate) => showsTitle(label(card), titleOf(candidate)));
        if (!id) throw new Error(`No piece called "${label(card)}"`);
        await click(card);
        return id;
      }
      const next = menu.buttons!.find((b) => label(b) === t('menu.next'));
      if (!next || next.disabled) break;
      menu = await clickInMenu(next);
    }
    throw new Error(wanted === undefined ? 'The menu offers no piece' : `"${wanted}" is not in the menu`);
  }

  const toDom = songToDomTime(clock);

  /**
   * Play the scenario's performance of `chart` with its first note at song time `startMs`, at `speed` times its tempo;
   * resolves when the last key has gone.
   */
  async function perform(chart: Chart, startMs: number, speed = scenario.speed): Promise<void> {
    const { events } = scenarioPerformance(chart, { ...scenario, speed }, { startMs });
    scheduler = new ClockScheduler(() => clock.nowMs());
    playThroughDevice(deviceOnClock(device, toDom), events, scheduler);
    await scheduler.idle();
  }

  /**
   * Tempo mode: after the lead-in, the first key only starts the count-in and is not a note; then every note of `chart`
   * goes where the transport says it is, at the piece's own tempo (a screen that plays at its own tempo runs at it whatever `?speed=` says).
   */
  async function performInTempo(chart: Chart, transport: () => TransportLike | null | undefined): Promise<void> {
    await sleep(leadMs);
    check();
    const first = chart.notes[0]!.midi;
    device.press(first, 80);
    device.release(first);
    await waitUntil('the count-in to start', () => (transport()?.started ? true : undefined));
    await perform(chart, transport()!.timeOfTick(0)!, 1);
  }

  const resultsKey = 'results';
  const playKey = 'practice';

  async function playPiece(pieceId: string): Promise<void> {
    const chart = context.pieces.find(pieceId)!.chart;
    const play = await waitUntil(`the ${playKey} screen`, () => {
      const s = scene(playKey);
      return s && s.playSession && s.buttons && s.buttons.length > 0 ? s : undefined;
    });
    say('playing', `${chart.title}: ${scenario.mode} mode, ${scenario.player.style} player, seed ${scenario.seed}`);
    if (scenario.mode === 'tempo') {
      await performInTempo(chart, () => play.playSession?.transport);
    } else {
      // Wait mode: the same performance from a moment after the screen came up
      await perform(chart, clock.nowMs() + leadMs);
    }
    // practice loops (ft_1_12): once the pass's score shows past the last bar, leave as a player would, to the score screen
    const passed = await waitUntil('the pass score', () => {
      if (scene(resultsKey)) return true;
      const s = scene(playKey) as (SceneLike & { pendingPass?: unknown; leave?: () => void }) | undefined;
      return s && s.pendingPass ? s : undefined;
    }, 40000);
    if (passed !== true) passed.leave?.();
  }

  /** A script (ft_1_24.AC6, WP-07): the scene opened with it, watched until it ends; the player plays nothing. */
  async function playScript(): Promise<void> {
    say('playing', `The script ${scenario.script!} in ${scenario.scene!}`);
    game.scene.start(scenario.scene!, { script: scenario.script });
    status.run = 1;
    await waitUntil('the script to end', () => {
      const s = scene(scenario.scene!) as (SceneLike & { scriptState?: { done: boolean } | null }) | undefined;
      return s?.scriptState?.done ? true : undefined;
    }, 180000); // the boat's script plays about 45 s in a cloud session; a slow runner takes more than a minute
    say('results', `The script ${scenario.script!} ended`);
  }

  async function run(): Promise<void> {
    await context.profiles.updatePlaySettings({ mode: scenario.mode, scoreView: scenario.scoreView, tempoClock: 'strict' });
    await Promise.race([context.audio.piano.ready, sleep(8000)]);
    if (scenario.activity === 'script') return playScript();
    if (scenario.activity === 'teacher') await putOnCurriculum(scenario.piece!);
    if (scenario.activity === 'week') await setUpWeek(scenario.piece!);
    // a challenge practises the character's phrase in the room first, so its gate opens (ft_1_21.AC19)
    const order = offeredIds();
    let pieceId: string | undefined = scenario.piece;
    for (let run = 1; run <= scenario.maxRuns; run++) {
      check();
      say('menu', `Run ${run}: opening ${pieceId ?? 'the first piece'} from the menu`);
      pieceId = await openFromMenu(pieceId);
      status.run = run;
      status.pieceId = pieceId;
      await playPiece(pieceId);
      const results = await waitUntil('the results', () => scene(resultsKey), 40000);
      const r = results.result;
      status.last = r ? { accuracy: r.accuracy, mistakes: r.mistakes, timingScore: r.timing?.score ?? null, missed: r.timing?.missed ?? null } : null;
      say('results', `Results: ${JSON.stringify(status.last)}`);
      if (scenario.after === 'stop' || run === scenario.maxRuns) break;
      say('waiting', 'Looking at the results');
      await sleep(lingerMs);
      check();
      const back = await waitUntil('the results buttons', () => scene(resultsKey)?.buttons?.find((b) => label(b) === t('results.pieces')));
      await click(back);
      if (scenario.after === 'next-piece') pieceId = order[(order.indexOf(pieceId) + 1) % order.length];
    }
  }

  /** The teacher scenario (ft_1_26): the piece on the active player's curriculum, due in two weeks, priority 7. */
  async function putOnCurriculum(pieceId: string): Promise<void> {
    const player = context.profiles.profile.id;
    const today = dayString(new Date());
    const curriculum = await context.profiles.curriculumOf(player);
    if (curriculum === null) throw new Error("The player's curriculum cannot be read");
    if (!(await context.profiles.saveCurriculum(player, withPiece(curriculum, { ...newCurriculumPiece(pieceId, today), priority: 7 })))) throw new Error("The player's curriculum was not saved");
  }

  /**
   * The demo week (ft_1_27.AC2): the piece on the curriculum, due today, the teacher coming on that day only, and a play of it
   * on each of the days before (synthetic, `pastWeek`); the runs today are the scenario's.
   */
  async function setUpWeek(pieceId: string): Promise<void> {
    const player = context.profiles.profile.id;
    const now = new Date();
    const today = dayString(now);
    const curriculum = await context.profiles.curriculumOf(player);
    if (curriculum === null) throw new Error("The player's curriculum cannot be read");
    const week = { ...withPiece(curriculum, { ...newCurriculumPiece(pieceId, today), deadline: today, priority: 7 }), testWeekdays: [] };
    if (!(await context.profiles.saveCurriculum(player, week))) throw new Error("The player's curriculum was not saved");
    say('waiting', `${PAST_DAYS} days of practice before today`);
    if (!(await context.profiles.recordBarPlays(pastWeek(context.pieces.find(pieceId)!.chart, now, PAST_DAYS)))) throw new Error('The past days were not saved');
  }

  /**
   * After the runs, the room on the deadline day (ft_1_27.AC2): what Kiur and the teacher say is read a page at a time, her
   * line opens the piano with her piece, the scenario's player plays it once, and back in the room her verdict is read.
   */
  async function playCheckup(): Promise<void> {
    await sleep(lingerMs);
    check();
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    game.scene.start('profile');
    type Room = SceneLike & { talkState: { who: string; text: string } | null; pressTalk(): void };
    const room = () => scene('profile') as Room | undefined;
    const read = async (until: () => boolean): Promise<string[]> => {
      const heard: string[] = [];
      await waitUntil('the room to speak', () => room()?.talkState ?? undefined);
      for (let presses = 0; !until(); presses++) {
        if (presses > 20) throw new Error('The talk in the room did not end');
        const said = room()?.talkState;
        if (said && heard[heard.length - 1] !== `${said.who}: ${said.text}`) {
          heard.push(`${said.who}: ${said.text}`);
          say('teacher', heard[heard.length - 1]!);
        }
        await sleep(leadMs);
        check();
        room()?.pressTalk();
        await sleep(50);
      }
      return heard;
    };
    const arrival = await read(() => scene(playKey) !== undefined);
    if (!arrival.some((line) => line.startsWith('teacher:'))) throw new Error('The teacher did not come for the check-up');
    status.run += 1;
    await playPiece(scenario.piece!);
    await waitUntil('the room', () => room());
    const verdict = await read(() => room()?.talkState === null);
    say('results', `The check-up: ${verdict.join(' ')}`);
  }

  /** After the runs, the teacher's screen through her gate's default password, as she would open it (ft_1_26.AC1, AC2). */
  async function showTeacher(): Promise<void> {
    await sleep(lingerMs);
    check();
    say('teacher', "The teacher's screen with the piece's measured status");
    if (!(await context.teacher.lock.check(DEFAULT_TEACHER_PASSWORD))) throw new Error("The teacher's default password did not open her screen");
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    game.scene.start('teacher', { player: context.profiles.profile.id });
    await waitUntil("the teacher's list", () => (scene('teacher') as (SceneLike & { statuses?: unknown }) | undefined)?.statuses ?? undefined);
  }

  /**
   * The challenge (ft_1_21.AC10): after the runs in the room, the scene where the character stands, its talk opened, the
   * tug picked from its choices and played to the end: the character's phrases heard, the student's played by the
   * scenario's player; then its closing line pressed away.
   */
  async function playChallenge(): Promise<void> {
    await sleep(lingerMs);
    check();
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    game.scene.start(scenario.scene!);
    const place = await waitUntil(`the ${scenario.scene!}`, () => {
      const s = scene(scenario.scene!) as ChallengeScene | undefined;
      return s && s.buttons && s.buttons.length > 0 ? s : undefined;
    });
    const character = [...CHARACTERS.values()].find((c) => c.scenes.includes(scenario.scene!) && Object.values(c.phrases).some((p) => p.includes(scenario.piece!)));
    if (!character) throw new Error(`No character in ${scenario.scene!} plays ${scenario.piece!}`);
    say('playing', `Meeting ${character.id} in ${scenario.scene!}`);
    // the character stands once the scene's picture is painted: try until its talk opens
    const opened = async (): Promise<boolean> => {
      for (let i = 0; i < 100; i++) {
        check();
        if (await place.talkTo(character.id)) return true;
        await sleep(100);
      }
      return false;
    };
    if (!(await opened())) throw new Error(`${character.id} has nothing to say`);
    // learn, then show (d135): it teaches its piece first; the next talk sends the student to practise, and the one after
    // that offers the tug
    for (let presses = 0; !place.chooseTug('teach'); presses++) {
      if (presses > 20 || place.talkState === null) throw new Error(`${character.id} offered no teaching`);
      await sleep(leadMs / 2);
      check();
      place.pressTalk();
    }
    await waitUntil('the teaching', () => {
      if (place.teachState) return true;
      place.pressTalk();
      return undefined;
    });
    for (;;) {
      check();
      const teach = place.teachState;
      if (!teach) break;
      if (teach.closing) {
        if (teach.outcome !== 'heard') throw new Error(`The phrase was not learned: ${teach.saying ?? ''}`);
        say('results', `Taught: ${teach.saying ?? ''}`);
        await sleep(lingerMs);
        await pressThrough(() => place.teachState !== null, () => place.pressTalk());
        break;
      }
      const phrase = place.teachPhrase;
      if (phrase) {
        say('playing', `Learning ${character.id}'s phrase from the staff`);
        await perform(phrase, clock.nowMs() + leadMs);
        await waitUntil('the try judged', () => (place.teachPhrase === phrase ? undefined : true), 20000);
      } else await sleep(100);
    }
    // the talk after teaching: the character sends the student to practise
    if (!(await opened())) throw new Error(`${character.id} has nothing to say after teaching`);
    await waitUntil('the talk after teaching', () => {
      if (place.talkState === null) return true;
      place.pressTalk();
      return undefined;
    });
    if (!(await opened())) throw new Error(`${character.id} has nothing to say`);
    // its lines a press at a time, until the tug's choice shows; then its invitation until the tug starts
    for (let presses = 0; !place.chooseTug(); presses++) {
      if (presses > 20 || place.talkState === null) throw new Error(`${character.id} offered no tug`);
      await sleep(leadMs / 2);
      check();
      place.pressTalk();
    }
    await waitUntil('the tug', () => {
      if (place.tugState) return true;
      place.pressTalk();
      return undefined;
    });
    status.run = 1;
    for (;;) {
      check();
      const tug = place.tugState;
      if (!tug) break;
      if (tug.closing) {
        if (tug.outcome === undefined) throw new Error(`The tug did not start: ${tug.saying ?? ''}`);
        say('results', `The tug is ${tug.outcome}: ${tug.saying ?? ''}`);
        await sleep(lingerMs);
        await pressThrough(() => place.tugState !== null, () => place.pressTalk());
        break;
      }
      const phrase = place.tugPhrase;
      if (phrase) {
        say('playing', `The student's phrase, turn ${tug.turn + 1}, standing ${tug.standing}`);
        // Tempo mode: the phrase goes on the beat after the character's, on the tug's own clock, at the piece's tempo
        const transport = place.tugTransport;
        const firstMs = transport?.timeOfTick(0) ?? null;
        await (firstMs !== null ? perform(phrase, firstMs, 1) : perform(phrase, clock.nowMs() + leadMs));
        await waitUntil('the next turn', () => (place.tugPhrase === phrase ? undefined : true), 20000);
      } else await sleep(100);
    }
  }

  const done = run().then(async () => {
    if (scenario.activity === 'teacher') await showTeacher();
    if (scenario.activity === 'challenge') await playChallenge();
    if (scenario.activity === 'week') await playCheckup();
    say('finished', 'Finished');
  }).catch(
    (error: unknown) => {
      if (error instanceof Stopped) {
        say('stopped', 'Stopped');
        return;
      }
      status.error = error instanceof Error ? error.message : String(error);
      say('error', `Failed: ${status.error}`);
      console.error(`[autoplay ${scenario.id}] ${status.error}`);
    },
  );
  return {
    status,
    stop() {
      stopped = true;
      scheduler?.cancel();
    },
    done,
  };
}
