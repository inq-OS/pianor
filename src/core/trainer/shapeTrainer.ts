/**
 * Play a scale or a chord (ft_1_29 slice A). The student picks a key, a shape and a hand; the shape is drawn as a chart
 * and played in Wait mode, as a piece is: the cursor waits for the right key. Around Wait mode the trainer's rules of
 * ft_0_17: three lives, a wrong key costs one and says why, every right note's XP is kept when the round is lost.
 * Pure: no DOM, no engine. Never saved.
 */
import type { Chart, ChartNote } from '../chart/schema.ts';
import { spellingToMidi, type Spelling } from '../chart/pitch.ts';
import { PPQ } from '../chart/time.ts';
import type { KeyMode } from '../editor/key.ts';
import { WaitMode } from '../judge/wait.ts';
import type { NoteEvent, PlayState, WrongReason } from '../judge/types.ts';
import { scaleSpellings } from './scaleChart.ts';

export const SHAPE_LIVES = 3;
/** AX-3 provisional: XP for one right note, as the note trainer gives for one right name. Tune after playtests. */
export const SHAPE_XP_PER_NOTE = 10;

export type Shape = 'scale' | 'triad';
export type ShapeHand = 'RH' | 'LH';

export interface ShapeChoice {
  /** The key as sharps (positive) or flats (negative), -7 to 7. */
  fifths: number;
  mode: KeyMode;
  shape: Shape;
  hand: ShapeHand;
}

/** The widest signature either way: seven sharps or flats. */
const MOST_FIFTHS = 7;
const BEATS_PER_BAR = 4;
const BAR = BEATS_PER_BAR * PPQ;
/** The tonic's octave for the right hand: from middle C up, on the treble staff. */
const RH_OCTAVE = 4;
/**
 * AX-3 provisional: the left hand plays an octave and a bit lower, on the bass staff: a tonic from C to E in octave 3, from F
 * to B in octave 2, so no scale climbs more than a few ledger lines above the bass staff.
 */
const LH_LOW_TONICS = new Set(['F', 'G', 'A', 'B']);

/** The key a fifth up (`step` 1) or down (-1) around the circle of fifths; past seven sharps it comes round to seven flats. */
export function nextShapeKey(fifths: number, step: 1 | -1): number {
  const span = 2 * MOST_FIFTHS + 1;
  return ((((fifths + MOST_FIFTHS + step) % span) + span) % span) - MOST_FIFTHS;
}

function tonicOctave(choice: ShapeChoice): number {
  if (choice.hand === 'RH') return RH_OCTAVE;
  const tonic = scaleSpellings(choice.fifths, choice.mode)[0]!.step;
  return LH_LOW_TONICS.has(tonic) ? RH_OCTAVE - 2 : RH_OCTAVE - 1;
}

/**
 * The shape as a chart in 4/4 on one staff of the chosen hand. A scale: one octave up and down again in quarters, the last
 * tonic a half note (four bars). A triad: the tonic, third and fifth one by one, a rest, then the three together as a half
 * note (two bars). The major scale, and the natural minor for a minor key (`scaleSpellings`).
 */
export function shapeChart(choice: ShapeChoice): Chart {
  const scale = scaleSpellings(choice.fifths, choice.mode, tonicOctave(choice));
  const track = 'play';
  const note = (spelling: Spelling, tick: number, dur: number): ChartNote => ({ tick, dur, midi: spellingToMidi(spelling), spelling, track, voice: 1, bar: Math.floor(tick / BAR) });
  let notes: ChartNote[];
  let rests: Chart['rests'];
  if (choice.shape === 'scale') {
    const upAndDown = [...scale, ...scale.slice(0, -1).reverse()];
    notes = upAndDown.map((s, k) => note(s, k * PPQ, k === upAndDown.length - 1 ? 2 * PPQ : PPQ));
    rests = [];
  } else {
    const triad = [scale[0]!, scale[2]!, scale[4]!];
    notes = [...triad.map((s, k) => note(s, k * PPQ, PPQ)), ...triad.map((s) => note(s, BAR, 2 * PPQ))];
    rests = [{ tick: 3 * PPQ, dur: PPQ, track, voice: 1, bar: 0 }, { tick: BAR + 2 * PPQ, dur: 2 * PPQ, track, voice: 1, bar: 1 }];
  }
  const bars = Math.max(...notes.map((n) => n.bar), ...rests.map((r) => r.bar)) + 1;
  const midis = notes.map((n) => n.midi);
  return {
    schemaVersion: 2,
    id: 'shape-trainer',
    contentVersion: 1,
    title: choice.shape === 'scale' ? 'Scale' : 'Triad',
    level: 1,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: 80 }],
    meterMap: [{ tick: 0, num: BEATS_PER_BAR, den: 4 }],
    keyMap: [{ tick: 0, fifths: choice.fifths, mode: choice.mode }],
    tracks: [{ id: track, role: 'play', hand: choice.hand, clef: choice.hand === 'RH' ? 'treble' : 'bass' }],
    notes,
    rests,
    bars: Array.from({ length: bars }, (_, index) => ({ index, startTick: index * BAR, endTick: (index + 1) * BAR })),
    phrases: [{ name: choice.shape, startBar: 0, endBar: bars - 1 }],
    range: { low: Math.min(...midis), high: Math.max(...midis) },
  };
}

export type ShapeOutcome = 'playing' | 'won' | 'lost';

export interface ShapeRoundState {
  lives: number;
  xp: number;
  outcome: ShapeOutcome;
}

export type ShapePress =
  | { verdict: 'correct' }
  | { verdict: 'wrong'; reason: WrongReason; direction: 'higher' | 'lower' }
  /** A key let go, or a key of the chord pressed again: nothing is judged. */
  | { verdict: 'ignored' }
  | { verdict: 'over' };

/** One round of a shape: Wait mode with three lives. The same chart, the same round. */
export class ShapeRound {
  private readonly wait: WaitMode;
  private lives = SHAPE_LIVES;
  private xp = 0;
  private outcome: ShapeOutcome = 'playing';

  constructor(readonly chart: Chart) {
    this.wait = new WaitMode(chart);
  }

  press(event: NoteEvent): ShapePress {
    if (this.outcome !== 'playing') return { verdict: 'over' };
    let result: ShapePress = { verdict: 'ignored' };
    for (const judged of this.wait.handle(event)) {
      if (judged.type === 'PieceCompleted') this.outcome = 'won';
      if (judged.type !== 'NoteJudged') continue;
      if (judged.verdict === 'correct') {
        this.xp += SHAPE_XP_PER_NOTE;
        result = { verdict: 'correct' };
      } else {
        this.lives -= 1;
        if (this.lives === 0) this.outcome = 'lost';
        result = { verdict: 'wrong', reason: judged.reason, direction: judged.direction };
      }
    }
    return result;
  }

  /** The judge's state, for the staff: the notes played and the ones awaited. */
  play(): PlayState {
    return this.wait.getState();
  }

  state(): ShapeRoundState {
    return { lives: this.lives, xp: this.xp, outcome: this.outcome };
  }
}
