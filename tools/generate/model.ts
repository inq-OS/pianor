import type { LevelDefinition } from '../../src/core/chart/index.ts';

export type Hand = 'RH' | 'LH';

export interface Meter {
  num: number;
  den: number;
}

/** One note or rest of a voice. `midi` null is a rest. `beats` counts quarter notes (0.5 is an eighth). */
export interface Slot {
  midi: number | null;
  beats: number;
}

/** What one hand plays: a list of bars, each a list of slots that fill the bar exactly. */
export interface DraftVoice {
  hand: Hand;
  bars: Slot[][];
}

/** A generated piece before it is written as ABC and a meta file. */
export interface Draft {
  title: string;
  /** One line for the comment at the top of the ABC file. */
  comment: string;
  meter: Meter;
  bpm: number;
  voices: DraftVoice[];
  /** Bars are 1-based and inclusive, like the meta file. */
  phrases: { name: string; bars: [number, number] }[];
  tags: string[];
}

/** What a generator knows about the piece it is asked for. */
export interface Setup {
  level: LevelDefinition;
  hand: Hand;
  meter: Meter;
  /** Bars wanted, within the level's limits. */
  bars: number;
  /** True when the request named the number of bars; otherwise `bars` is only the generator's usual size. */
  barsGiven: boolean;
}

/** A generator asks for another attempt with `Rejected`; any other error is a bug or a bad request. */
export class Rejected extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'Rejected';
  }
}

/** A request that cannot be met (unknown level, a hand the level does not use, bars outside the level's limits). */
export class BadRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequest';
  }
}
