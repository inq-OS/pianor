import { playbackLengthMs, playbackNotes } from '../../core/chart';
import type { ActorId, ItemId } from '../../core/contracts';
import type { SceneData } from '../../core/scene/scene';
import type { Script } from '../../core/scene/script';
import {
  pressScript, readingMs, scriptView, skipScript, startScript, stepScript,
  type ScriptEvent, type ScriptStep, type ScriptTiming, type ScriptView,
} from '../../core/scene/scriptRunner';
import { strings, t, type StringKey } from '../../core/text/strings';
import type { GameAudio } from '../../io/audio';
import type { PieceCatalogue } from '../pieceCatalogue';
import { ChartPlayer } from '../preview/ChartPlayer';

/** How fast an actor walks or a boat sails, fine pixels a second. AX-3 provisional. */
const WALK_PX_PER_SECOND = 40;
/** `ChartPlayer`'s lead-in before a phrase's first note. */
const PHRASE_LEAD_IN_MS = 200;
/**
 * A frame longer than this (a hidden tab, a pause) counts as this long, so a script never jumps ahead. A slow machine's
 * frames (a software GPU at a few frames a second) count in full, so the script keeps time with its tune.
 */
const LONGEST_FRAME_MS = 1000;

/** The words of a line: its string, or the key itself when the game does not have it (content is checked in its test). */
export function lineText(key: string): string {
  return key in strings ? t(key as StringKey) : key;
}

/**
 * A script running in an `AdventureScene` (ft_1_24.AC6, WP-07): steps the pure interpreter by the frames' time and carries
 * out its events, a phrase through the audio output (not judged) and an item given. Holds no rules of its own.
 */
export class SceneScript {
  private step: ScriptStep;
  private last: number | null = null;
  private readonly player: ChartPlayer;
  /** The items the script gave, in order. */
  readonly given: ItemId[] = [];

  /** `onGive` hands each item to the scene as it is given, which keeps it in the player's world (WP-08). */
  constructor(readonly script: Script, scene: SceneData, private readonly pieces: PieceCatalogue, audio: GameAudio, private readonly onGive: (item: ItemId) => void = () => undefined) {
    this.player = new ChartPlayer(audio.piano, audio.clock);
    const timing: ScriptTiming = {
      walkPxPerSecond: WALK_PX_PER_SECOND,
      sayMs: (line) => readingMs(lineText(line)),
      phraseMs: (piece) => {
        const chart = pieces.find(piece)?.chart;
        return chart ? playbackLengthMs(chart) + PHRASE_LEAD_IN_MS : 0;
      },
    };
    this.step = startScript(script, scene.places, timing);
    this.carryOut(this.step.events);
  }

  get done(): boolean {
    return this.step.run.done;
  }

  /** Every actor the script puts on the stage, in the order it names them. */
  actors(): ActorId[] {
    const ids = this.script.commands.flatMap((c) => ('enter' in c ? [c.enter] : 'walkTo' in c ? [c.walkTo] : []));
    return [...new Set(ids)];
  }

  view(): ScriptView {
    return scriptView(this.step.run);
  }

  /** One frame at `time` (the scene's clock, milliseconds). */
  tick(time: number): void {
    const ms = this.last === null ? 0 : Math.min(LONGEST_FRAME_MS, Math.max(0, time - this.last));
    this.last = time;
    this.apply(stepScript(this.step.run, ms));
  }

  /** A press: ends the line being said. */
  press(): void {
    this.apply(pressScript(this.step.run));
  }

  /** Skips the rest when the script allows it; false when it does not. */
  skip(): boolean {
    if (this.done || !this.script.skippable) return false;
    this.player.stop();
    this.apply(skipScript(this.step.run));
    return true;
  }

  /** The scene closes: silence a phrase still sounding. */
  stop(): void {
    this.player.stop();
  }

  private apply(step: ScriptStep): void {
    this.step = { run: step.run, events: step.events };
    this.carryOut(step.events);
  }

  private carryOut(events: readonly ScriptEvent[]): void {
    for (const event of events) {
      if (event.kind === 'give') {
        this.given.push(event.item);
        this.onGive(event.item);
      }
      if (event.kind === 'playPhrase') {
        const chart = this.pieces.find(event.piece)?.chart;
        if (chart) this.player.start(playbackNotes(chart), playbackLengthMs(chart));
      }
    }
  }
}
