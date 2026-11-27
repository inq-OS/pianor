/**
 * Chord from its name (ft_1_29 slice B). A chord name stands large; the student plays it, in any inversion and any octave,
 * with all its notes held together; a key kept down from the last chord counts when it is in the next. A key outside the chord costs one of three lives and names itself; every right chord's
 * XP is kept when the round is lost. The chords and their steps are content (`content/trainer/chords.json`), validated here.
 * Pure: no DOM, no engine. Never saved.
 */
import { z } from 'zod';
import { midiToSpelling, STEP_SEMITONES, type Spelling, type Step } from '../chart/pitch';
import type { NoteEvent } from '../judge/types';
import { Random } from '../random';
import { noteLabel, type NoteNaming } from '../text/noteName';
import { strings, type StringKey } from '../text/strings';

export const CHORD_LIVES = 3;
/** AX-3 provisional: XP for each note of a right chord, as the other trainers give for one right note. */
export const CHORD_XP_PER_NOTE = 10;

const qualitySchema = z.object({
  id: z.string().min(1),
  /** What follows the root in a name: `m` for minor, `7`, `m7`, `maj7`, `6`, `m6`, `dim`, `m7b5`; empty for a major triad. */
  suffix: z.string(),
  intervals: z.array(z.number().int().min(0).max(11)).min(3),
});

/** A step's name is a string key, so the step button names it in the player's language. */
const stepSchema = z.object({ id: z.string().min(1), nameKey: z.string().min(1), chords: z.array(z.string().min(1)).min(1) });

export const CHORD_CONTENT_VERSION = 2;

const contentSchema = z
  .object({
    schemaVersion: z.literal(CHORD_CONTENT_VERSION),
    note: z.string().optional(),
    qualities: z.array(qualitySchema).min(1),
    steps: z.array(stepSchema).min(1),
  })
  .superRefine((content, ctx) => {
    content.steps.forEach((step, i) => {
      if (!(step.nameKey in strings)) ctx.addIssue({ code: 'custom', message: `"${step.nameKey}" is no string key in src/core/text/strings.ts`, path: ['steps', i, 'nameKey'] });
    });
  });

/** Version 1: a minor quality was written with a small root letter (`a`, `f#7`) and a step's name was English text. */
const v1Schema = z.object({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  qualities: z.array(z.object({ id: z.string(), minor: z.boolean(), suffix: z.string(), intervals: z.array(z.number()) })),
  steps: z.array(z.object({ id: z.string(), name: z.string(), chords: z.array(z.string()) })),
});

export type ChordContent = Omit<z.infer<typeof contentSchema>, 'steps'> & { steps: { id: string; nameKey: StringKey; chords: string[] }[] };

/**
 * A version 1 file as version 2 (frozen: never change a step once released). A minor quality's suffix gets an `m` in front
 * (`7` becomes `m7`, `7b5` becomes `m7b5`) except the diminished ones, which keep `dim`; a chord with a small root letter is
 * written with the capital and its quality's new suffix (`a` is `Am`, `f#` is `F#m`). A step is named by the key
 * `chords.step.<id>`. Anything else is passed on as it is.
 */
export function migrateChordContent(json: unknown): unknown {
  if ((json as { schemaVersion?: unknown } | null)?.schemaVersion !== 1) return json;
  const v1 = v1Schema.parse(json);
  const newSuffix = (q: { minor: boolean; suffix: string }) => (q.minor && !q.suffix.startsWith('dim') ? `m${q.suffix}` : q.suffix);
  const rename = (name: string) => {
    const match = /^([A-Ga-g])(b|#)?(.*)$/.exec(name);
    if (!match || match[1] === match[1]!.toUpperCase()) return name;
    const quality = v1.qualities.find((q) => q.minor && q.suffix === match[3]);
    return quality ? match[1]!.toUpperCase() + (match[2] ?? '') + newSuffix(quality) : name;
  };
  return {
    schemaVersion: 2,
    ...(v1.note === undefined ? {} : { note: v1.note }),
    qualities: v1.qualities.map((q) => ({ id: q.id, suffix: newSuffix(q), intervals: q.intervals })),
    steps: v1.steps.map((step) => ({ id: step.id, nameKey: `chords.step.${step.id}`, chords: step.chords.map(rename) })),
  };
}

export interface Chord {
  /** The name as the content writes it: `C`, `Am`, `Bb`, `G7`, `Bm7b5`. */
  name: string;
  root: Spelling;
  quality: string;
  /** True when its third is minor (three semitones over the root): it is spelled from the minor key of its root. */
  minor: boolean;
  suffix: string;
  /** The pitch classes from the root up, in the order of the quality's intervals. */
  pitchClasses: number[];
}

/** A capital root letter, an optional sign and the quality's suffix: a small letter is a note name, never a chord's. */
const NAME = /^([A-G])(b|#)?(.*)$/;

/** The chord a name stands for in `content`'s dictionary; throws for a name it does not know. */
export function parseChord(content: Pick<ChordContent, 'qualities'>, name: string): Chord {
  const match = NAME.exec(name);
  const letter = match?.[1];
  const quality = letter === undefined ? undefined : content.qualities.find((q) => q.suffix === match![3]);
  if (!letter || !quality) throw new RangeError(`unknown chord name: ${name}`);
  const step = letter as Step;
  const alter = match[2] === 'b' ? -1 : match[2] === '#' ? 1 : 0;
  const root = (STEP_SEMITONES[step] + alter + 12) % 12;
  return {
    name,
    root: { step, alter, octave: 4 },
    quality: quality.id,
    minor: quality.intervals.includes(3),
    suffix: quality.suffix,
    pitchClasses: quality.intervals.map((i) => (root + i) % 12),
  };
}

/**
 * Validate the chord file (a version 1 file is migrated first): its shape, that every step's name is a string key, and that
 * every chord of every step is a name its dictionary knows.
 */
export function loadChordContent(json: unknown): ChordContent {
  const content = contentSchema.parse(migrateChordContent(json)) as ChordContent;
  for (const step of content.steps) for (const name of step.chords) parseChord(content, name);
  return content;
}

/** The chord's name on screen: the root in the letter naming with a flat sign, then its suffix (`Am`, `B♭m`, `Bm7♭5`). */
export function chordLabel(chord: Chord, naming: NoteNaming): string {
  // the letter is a capital, so the first small b is the flat sign (in H naming a B flat is already the letter B); the pixel
  // font has a flat sign and no sharp sign, so a sharp stays #
  return noteLabel(chord.root, naming).replace('b', '♭') + chord.suffix.replace('b', '♭');
}

/** Each letter's place on the circle of fifths, C at 0: its major key's sharps, or flats when below 0. */
const LETTER_FIFTHS: Readonly<Record<Step, number>> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

/**
 * A wrong key spelled on the side of the chord's key (ft_1_29.AC2): the key signature of the chord's root as a major key
 * (a major quality) or a minor key (a minor one). Flats for a key with flats (F, Bb, Cm, Dm), sharps otherwise (G, Em, and C
 * and Am, which have neither), so the key between C and D reads Db against F and C# against G.
 */
export function wrongKeySpelling(chord: Chord, midi: number): Spelling {
  const fifths = LETTER_FIFTHS[chord.root.step] + 7 * chord.root.alter - (chord.minor ? 3 : 0);
  return midiToSpelling(midi, fifths < 0);
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
  /** Keys pressed for the current chord, or kept down from the last one and in this one, and still down. */
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
    this.current = this.pick(chord);
    // a key still down that is in the next chord counts for it too: keeping a common tone is good technique; the others
    // count for nothing and cost nothing until they are let go and pressed again
    for (const key of [...this.fresh]) if (!this.current.pitchClasses.includes(key % 12)) this.fresh.delete(key);
    return { verdict: 'correct', chord };
  }

  private pick(previous: Chord | null): Chord {
    const random = Random.derive(this.seed, this.solved);
    const others = this.chords.filter((c) => c !== previous);
    return random.pick(others.length > 0 ? others : this.chords);
  }
}
