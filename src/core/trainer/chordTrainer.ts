/**
 * Chord from its name (ft_1_29 slice B). A chord name stands large; the student plays it, in any inversion and any octave,
 * with all its notes held together. A key outside the chord costs one of three lives and names itself; every right chord's
 * XP is kept when the round is lost. The chords and their steps are content (`content/trainer/chords.json`), validated here.
 * Pure: no DOM, no engine. Never saved.
 */
import { z } from 'zod';
import { STEP_SEMITONES, type Spelling, type Step } from '../chart/pitch';
import type { NoteEvent } from '../judge/types';
import { Random } from '../random';
import { noteLabel, type NoteNaming } from '../text/noteName';

export const CHORD_LIVES = 3;
/** AX-3 provisional: XP for each note of a right chord, as the other trainers give for one right note. */
export const CHORD_XP_PER_NOTE = 10;

const qualitySchema = z.object({
  id: z.string().min(1),
  /** A minor quality is written with a small root letter (a, f#7), a major one with a capital (C, G7). */
  minor: z.boolean(),
  suffix: z.string(),
  intervals: z.array(z.number().int().min(0).max(11)).min(3),
});

const stepSchema = z.object({ id: z.string().min(1), name: z.string().min(1), chords: z.array(z.string().min(1)).min(1) });

const contentSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  qualities: z.array(qualitySchema).min(1),
  steps: z.array(stepSchema).min(1),
});

export type ChordContent = z.infer<typeof contentSchema>;

export interface Chord {
  /** The name as the content writes it: `C`, `a`, `Bb`, `G7`. */
  name: string;
  root: Spelling;
  quality: string;
  /** True when its root is written small. */
  minor: boolean;
  suffix: string;
  /** The pitch classes from the root up, in the order of the quality's intervals. */
  pitchClasses: number[];
}

const NAME = /^([A-Ga-g])(b|#)?(.*)$/;

/** The chord a name stands for in `content`'s dictionary; throws for a name it does not know. */
export function parseChord(content: Pick<ChordContent, 'qualities'>, name: string): Chord {
  const match = NAME.exec(name);
  const letter = match?.[1];
  const quality = letter === undefined ? undefined : content.qualities.find((q) => q.suffix === match![3] && q.minor === (letter === letter.toLowerCase()));
  if (!letter || !quality) throw new RangeError(`unknown chord name: ${name}`);
  const step = letter.toUpperCase() as Step;
  const alter = match[2] === 'b' ? -1 : match[2] === '#' ? 1 : 0;
  const root = (STEP_SEMITONES[step] + alter + 12) % 12;
  return {
    name,
    root: { step, alter, octave: 4 },
    quality: quality.id,
    minor: quality.minor,
    suffix: quality.suffix,
    pitchClasses: quality.intervals.map((i) => (root + i) % 12),
  };
}

/** Validate the chord file: its shape, and that every chord of every step is a name its dictionary knows. */
export function loadChordContent(json: unknown): ChordContent {
  const content = contentSchema.parse(json);
  for (const step of content.steps) for (const name of step.chords) parseChord(content, name);
  return content;
}

/** The chord's name on screen: the root in the letter naming with a flat sign, small for a minor chord, then its suffix. */
export function chordLabel(chord: Chord, naming: NoteNaming): string {
  // the letter is a capital, so the first small b is the flat sign (in H naming a B flat is already the letter B); the pixel
  // font has a flat sign and no sharp sign, so a sharp stays #
  const root = noteLabel(chord.root, naming).replace('b', '♭');
  const letter = chord.minor ? root.slice(0, 1).toLowerCase() + root.slice(1) : root;
  return letter + chord.suffix.replace('b', '♭');
}

export type ChordPress =
  | { verdict: 'held' }
  | { verdict: 'correct'; chord: Chord }
  | { verdict: 'wrong'; midi: number }
  /** A key let go, or one that changes nothing. */
  | { verdict: 'ignored' }
  | { verdict: 'over' };

export interface ChordRoundState {
  lives: number;
  xp: number;
  /** Chords played right this round. */
  solved: number;
  over: boolean;
}

/** One round on step `stepIndex` of `content`: chords drawn from the step by `seed`, never the same one twice in a row. */
export class ChordRound {
  private readonly chords: Chord[];
  private current: Chord;
  /** Keys pressed for the current chord and still down. */
  private readonly fresh = new Set<number>();
  private lives = CHORD_LIVES;
  private xp = 0;
  private solved = 0;

  constructor(content: ChordContent, stepIndex: number, private readonly seed: string) {
    const step = content.steps[stepIndex];
    if (!step) throw new RangeError(`no chord step ${stepIndex}`);
    this.chords = step.chords.map((name) => parseChord(content, name));
    this.current = this.pick(null);
  }

  target(): Chord {
    return this.current;
  }

  state(): ChordRoundState {
    return { lives: this.lives, xp: this.xp, solved: this.solved, over: this.lives === 0 };
  }

  press(event: NoteEvent): ChordPress {
    if (event.kind === 'off' || event.velocity === 0) {
      this.fresh.delete(event.midi);
      return { verdict: 'ignored' };
    }
    if (this.lives === 0) return { verdict: 'over' };
    const chord = this.current;
    if (!chord.pitchClasses.includes(event.midi % 12)) {
      this.lives -= 1;
      return { verdict: 'wrong', midi: event.midi };
    }
    this.fresh.add(event.midi);
    const held = new Set([...this.fresh].map((k) => k % 12));
    if (!chord.pitchClasses.every((pc) => held.has(pc))) return { verdict: 'held' };
    this.xp += chord.pitchClasses.length * CHORD_XP_PER_NOTE;
    this.solved += 1;
    // the keys still down belong to this chord: the next one counts only keys pressed for it
    this.fresh.clear();
    this.current = this.pick(chord);
    return { verdict: 'correct', chord };
  }

  private pick(previous: Chord | null): Chord {
    const random = Random.derive(this.seed, this.solved);
    const others = this.chords.filter((c) => c !== previous);
    return random.pick(others.length > 0 ? others : this.chords);
  }
}
