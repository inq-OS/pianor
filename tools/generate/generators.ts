import type { Random } from '../../src/core/random.ts';
import { BadRequest, Rejected, type Draft, type Hand, type Setup, type Slot } from './model.ts';
import { allowedBeats, beatsPerBar, composeBar, composeCadence, fitRhythm, handNotes, NoFit, shiftDegrees, walkTo, type Rhythm } from './theory.ts';

export const GENERATOR_KINDS = ['five-finger', 'scale', 'reading-drill', 'echo', 'phrase'] as const;
export type GeneratorKind = (typeof GENERATOR_KINDS)[number];

export type FiveFingerPattern = 'runs' | 'skips' | 'pairs';

/** What a request may add to the level, hand, meter and bars. */
export interface GeneratorParams {
  /** For the echo game: `both` hands answer each other (levels with two hands), or one hand answers itself. */
  hand?: Hand | 'both';
  pattern?: FiveFingerPattern;
  /** The first bar of a phrase as degrees of the hand position, e.g. "0 1 2 1" (C D E D). */
  motif?: string;
}

export type Builder = (setup: Setup, random: Random, params: GeneratorParams) => Draft;

/**
 * Bars a generator makes when the request does not say, within the level's limits: about sixteen beats for an exercise
 * (four bars of 4/4, six of 3/4, eight of 2/4) and eight bars for a drill, an echo game or a tune.
 */
export function defaultBars(kind: GeneratorKind, min: number, max: number, beatsInBar: number): number {
  const wanted = kind === 'scale' || kind === 'five-finger' ? Math.ceil(16 / beatsInBar) : 8;
  return Math.max(min, Math.min(max, wanted));
}

// ---- shared pieces

const restBar = (beats: number): Slot[] => [{ midi: null, beats }];

/** A bar's slots: the rhythm with each note given its pitch from `degrees` (taken in order) of the note set. */
function pitched(rhythm: readonly Rhythm[], degrees: readonly number[], notes: readonly number[]): Slot[] {
  let k = 0;
  return rhythm.map((r) => (r.rest ? { midi: null, beats: r.beats } : { midi: notes[degrees[k++]!]!, beats: r.beats }));
}

const noteCount = (rhythm: readonly Rhythm[]) => rhythm.filter((r) => !r.rest).length;

/** Two phrases of at least two bars each. */
function splitPhrases(bars: number, names: [string, string]): Draft['phrases'] {
  const first = Math.max(2, Math.ceil(bars / 2));
  return [
    { name: names[0], bars: [1, first] },
    { name: names[1], bars: [first + 1, bars] },
  ];
}

const BPM = 66;

function positionNotes(setup: Setup, hand: Hand, span: 'position' | 'register' = 'position'): number[] {
  const notes = handNotes(setup.level, hand, span);
  if (notes.length < 3) throw new BadRequest(`level ${setup.level.level} gives the ${hand} fewer than three notes to play`);
  return notes;
}

/** Where a piece with several notes of rhythm per bar ends: bars of rhythm for every bar but the last, which is a cadence. */
function rhythmFor(random: Random, setup: Setup, options: { rests: boolean; halfWeight?: number; wholeWeight?: number }): Rhythm[][] {
  const beats = beatsPerBar(setup.meter);
  const allowed = allowedBeats(setup.level, beats);
  const bars: Rhythm[][] = [];
  for (let b = 0; b < setup.bars - 1; b++) {
    bars.push(composeBar(random, beats, allowed, { rests: options.rests && b < setup.bars - 2, ...(options.halfWeight === undefined ? {} : { halfWeight: options.halfWeight }), ...(options.wholeWeight === undefined ? {} : { wholeWeight: options.wholeWeight }) }));
  }
  bars.push(composeCadence(random, beats, allowed));
  return bars;
}

/** Cut one list of degrees into bars of the notes each bar's rhythm holds. */
function fillBars(rhythm: readonly Rhythm[][], degrees: readonly number[], notes: readonly number[]): Slot[][] {
  let at = 0;
  return rhythm.map((bar) => {
    const count = noteCount(bar);
    const slots = pitched(bar, degrees.slice(at, at + count), notes);
    at += count;
    return slots;
  });
}

// ---- five-finger patterns

const fiveFinger: Builder = (setup, random, params) => {
  const { level, hand } = setup;
  const notes = positionNotes(setup, hand);
  const maxLeap = level.maxLeapSteps;
  const pattern = params.pattern ?? random.pick<FiveFingerPattern>(maxLeap >= 2 ? ['runs', 'skips', 'pairs'] : ['runs', 'pairs']);
  if (pattern === 'skips' && maxLeap < 2) throw new BadRequest(`level ${level.level} allows no skips of a third, so the "skips" pattern is not possible`);

  const rhythm = rhythmFor(random, setup, { rests: false, halfWeight: 1.2, wholeWeight: 0 });
  const count = rhythm.reduce((sum, bar) => sum + noteCount(bar), 0);
  if (count < 8) throw new Rejected('too few notes for an exercise');
  let degrees: number[];
  if (pattern === 'pairs') {
    // every note twice: C C D D E E ... ending on the tonic
    const pairNotes = Math.ceil(count / 2);
    const walk = walkTo(random, { size: notes.length, count: pairNotes, maxLeap, end: 0, repeat: 0, style: 'runs' });
    degrees = walk.flatMap((d) => [d, d]).slice(0, count);
  } else {
    degrees = walkTo(random, { size: notes.length, count, maxLeap, end: 0, repeat: 0, style: pattern });
  }
  const names = { runs: 'runs up and down', skips: 'skips of a third', pairs: 'each note twice' } as const;
  return {
    title: 'Finger Walk',
    comment: `Five-finger exercise: ${names[pattern]}. Generated, level ${level.level}, ${hand === 'RH' ? 'right' : 'left'} hand.`,
    meter: setup.meter, bpm: BPM,
    voices: [{ hand, bars: fillBars(rhythm, degrees, notes) }],
    phrases: splitPhrases(setup.bars, ['Walk', 'Home']),
    tags: ['generated', 'five-finger', pattern],
  };
};

// ---- scales

const scale: Builder = (setup, random) => {
  const { level, hand, meter } = setup;
  const notes = positionNotes(setup, hand, 'register');
  if (notes.length < 5) throw new BadRequest(`level ${level.level} gives the ${hand} fewer than five notes for a scale`);
  const beats = beatsPerBar(meter);
  const allowed = allowedBeats(level, beats);
  const up = notes.map((_, i) => i);
  const degrees = [...up, ...up.slice(0, -1).reverse()];
  const top = notes.length - 1;

  // The notes decide the bars: fewer beats than notes cannot be, and exactly as many would make every note the same
  // length, so start one beat above. A request that names the bars gets exactly those or an error.
  let durations: number[] | null = null;
  const first = setup.barsGiven ? setup.bars : Math.max(level.bars.min, Math.ceil((degrees.length + 1) / beats));
  const last = setup.barsGiven ? setup.bars : level.bars.max;
  let bars = first;
  for (; bars <= last && durations === null; bars++) {
    try {
      durations = fitRhythm(random, { notes: degrees.length, beats, bars, allowed, long: [top, degrees.length - 1] });
    } catch (e) {
      if (!(e instanceof NoFit)) throw e;
      durations = null;
    }
  }
  if (durations === null) throw new Rejected(`the ${degrees.length} notes of the scale do not fit ${setup.bars} to ${level.bars.max} bars`);

  const grid: Slot[][] = [];
  let current: Slot[] = [];
  let filled = 0;
  durations.forEach((d, i) => {
    current.push({ midi: notes[degrees[i]!]!, beats: d });
    filled += d;
    if (filled === beats) {
      grid.push(current);
      current = [];
      filled = 0;
    }
  });
  return {
    title: 'Scale Climb',
    comment: `A scale up and down: ${notes.length} notes. Generated, level ${level.level}, ${hand === 'RH' ? 'right' : 'left'} hand.`,
    meter, bpm: BPM,
    voices: [{ hand, bars: grid }],
    phrases: splitPhrases(grid.length, ['Up', 'Down']),
    tags: ['generated', 'scale'],
  };
};

// ---- note-reading drills

const readingDrill: Builder = (setup, random) => {
  const { level, hand } = setup;
  const notes = positionNotes(setup, hand);
  const maxLeap = level.maxLeapSteps;
  const rhythm = rhythmFor(random, setup, { rests: level.rests });
  const count = rhythm.reduce((sum, bar) => sum + noteCount(bar), 0);
  const degrees = walkTo(random, { size: notes.length, count, maxLeap, end: 0, repeat: 1 });
  // A drill is for reading, so it must visit most of the notes and not repeat a few of them.
  if (new Set(degrees).size < Math.min(notes.length, 4)) throw new Rejected('too few different notes for a reading drill');
  return {
    title: 'Note Hunt',
    comment: `Note-reading drill: find each note on the staff. Generated, level ${level.level}, ${hand === 'RH' ? 'right' : 'left'} hand.`,
    meter: setup.meter, bpm: BPM,
    voices: [{ hand, bars: fillBars(rhythm, degrees, notes) }],
    phrases: splitPhrases(setup.bars, ['Find', 'Home']),
    tags: ['generated', 'reading-drill'],
  };
};

// ---- echo phrases

/** The call bars of an echo game: a rhythm and notes for each, the last call ending on the tonic. */
function callBars(random: Random, setup: Setup, size: number, pairs: number): { rhythm: Rhythm[]; degrees: number[] }[] {
  const beats = beatsPerBar(setup.meter);
  const allowed = allowedBeats(setup.level, beats);
  const maxLeap = setup.level.maxLeapSteps;
  const calls: { rhythm: Rhythm[]; degrees: number[] }[] = [];
  let from: number | undefined;
  for (let p = 0; p < pairs; p++) {
    const rhythm = composeBar(random, beats, allowed, { rests: false, halfWeight: 1.2, wholeWeight: 0 });
    const last = p === pairs - 1;
    const ends = last ? [0] : random.shuffle(Array.from({ length: size }, (_, i) => i));
    let degrees: number[] | null = null;
    for (const end of ends) {
      try {
        degrees = walkTo(random, { size, count: rhythm.length, maxLeap, end, ...(from === undefined ? {} : { from }), repeat: 0.5 });
        break;
      } catch (e) {
        if (!(e instanceof NoFit)) throw e;
        degrees = null;
      }
    }
    if (degrees === null) throw new Rejected('no melody for a call bar');
    calls.push({ rhythm, degrees });
    from = degrees.at(-1)!;
  }
  return calls;
}

const echo: Builder = (setup, random, params) => {
  const { level, meter, bars } = setup;
  if (bars % 2 !== 0) throw new BadRequest('an echo game needs an even number of bars (a call and an echo)');
  const pairs = bars / 2;
  const beats = beatsPerBar(meter);
  const both = (params.hand ?? (level.hands.length > 1 ? 'both' : setup.hand)) === 'both';

  if (both) {
    if (!(level.hands.includes('RH') && level.hands.includes('LH'))) throw new BadRequest(`level ${level.level} does not use both hands`);
    const rh = positionNotes(setup, 'RH');
    const lh = positionNotes(setup, 'LH');
    if (rh.length !== lh.length) throw new BadRequest('the two hand positions have different numbers of notes');
    const calls = callBars(random, setup, rh.length, pairs);
    const rhBars: Slot[][] = [];
    const lhBars: Slot[][] = [];
    for (const call of calls) {
      rhBars.push(pitched(call.rhythm, call.degrees, rh), restBar(beats));
      lhBars.push(restBar(beats), pitched(call.rhythm, call.degrees, lh));
    }
    return {
      title: 'Echo Game',
      comment: `The right hand calls, the left hand answers an octave lower. Generated, level ${level.level}.`,
      meter, bpm: BPM,
      voices: [{ hand: 'RH', bars: rhBars }, { hand: 'LH', bars: lhBars }],
      phrases: splitPhrases(bars, ['Call', 'Answer']),
      tags: ['generated', 'echo', 'two-hands'],
    };
  }

  const hand = params.hand === 'RH' || params.hand === 'LH' ? params.hand : setup.hand;
  const notes = positionNotes(setup, hand);
  const maxLeap = level.maxLeapSteps;
  const calls = callBars(random, setup, notes.length, pairs);
  const out: Slot[][] = [];
  calls.forEach((call, p) => {
    out.push(pitched(call.rhythm, call.degrees, notes));
    // The echo plays the call's rhythm again, a step or two away; the last echo comes home to the tonic.
    const lastPair = p === pairs - 1;
    const ks = random.shuffle([1, -1, 2, -2]);
    let echoDegrees: number[] | null = null;
    for (const k of ks) {
      const shifted = shiftDegrees(call.degrees, k, notes.length);
      if (!shifted || Math.abs(shifted[0]! - call.degrees.at(-1)!) > maxLeap) continue;
      if (lastPair && shifted.at(-1) !== 0) continue;
      echoDegrees = shifted;
      break;
    }
    if (echoDegrees === null) {
      try {
        echoDegrees = walkTo(random, { size: notes.length, count: call.rhythm.length, maxLeap, end: lastPair ? 0 : random.int(0, notes.length - 1), from: call.degrees.at(-1)!, repeat: 0.5 });
      } catch (e) {
        if (!(e instanceof NoFit)) throw e;
        throw new Rejected('no echo for a call bar');
      }
    }
    out.push(pitched(call.rhythm, echoDegrees, notes));
  });
  return {
    title: 'Echo Game',
    comment: `Play the call, then echo it. Generated, level ${level.level}, ${hand === 'RH' ? 'right' : 'left'} hand.`,
    meter, bpm: BPM,
    voices: [{ hand, bars: out }],
    phrases: splitPhrases(bars, ['Call', 'Answer']),
    tags: ['generated', 'echo'],
  };
};

// ---- phrase builder

/** Rhythms for a last bar: one long note, or a short run into a long one. */
function cadenceRhythm(random: Random, beats: number, allowed: readonly number[]): Rhythm[] {
  const options: number[][] = [];
  if (beats === 4) options.push([4], [1, 1, 2], [2, 2]);
  else if (beats === 3) options.push([1, 2], [1, 1, 1]);
  else options.push([2], [1, 1]);
  const usable = options.filter((o) => o.every((d) => allowed.includes(d)));
  const chosen = usable.length > 0 ? random.pick(usable) : [beats];
  return chosen.map((d) => ({ beats: d, rest: false }));
}

const sameRhythm = (a: readonly Rhythm[], b: readonly Rhythm[]) => a.length === b.length && a.every((r, i) => r.beats === b[i]!.beats);

interface Motif {
  degrees: number[];
  rhythm: Rhythm[];
}

interface Phrase {
  bars: Slot[][];
  lastDegree: number;
  /** The first bar, so the next phrase can be built from the same motif. */
  motif: Motif;
}

/** A four-bar phrase: the motif, the motif varied, a contrasting bar, and a cadence on `ending` (null: the tonic). */
function buildPhrase(random: Random, setup: Setup, notes: readonly number[], options: { motif?: Motif; from?: number; ending: number | 'tonic' }): Phrase {
  const { level, meter } = setup;
  const beats = beatsPerBar(meter);
  const allowed = allowedBeats(level, beats);
  const maxLeap = level.maxLeapSteps;
  const size = notes.length;
  const walk = (count: number, from: number | undefined, end: number | readonly number[]) => {
    const ends = typeof end === 'number' ? [end] : random.shuffle(end);
    for (const e of ends) {
      try {
        return walkTo(random, { size, count, maxLeap, end: e, ...(from === undefined ? {} : { from }), repeat: 0.6 });
      } catch (e) {
        if (!(e instanceof NoFit)) throw e;
      }
    }
    throw new Rejected('no melody for this bar');
  };
  const all = Array.from({ length: size }, (_, i) => i);

  // bar 1: the motif (given, or new); after an earlier phrase it starts within a leap of where that phrase stopped
  let rhythmA = options.motif?.rhythm ?? composeBar(random, beats, allowed, { rests: false, halfWeight: 1.2, wholeWeight: 0 });
  let motif = options.motif?.degrees ?? walk(rhythmA.length, options.from, all);
  if (options.motif && options.from !== undefined) {
    const near = [0, 1, -1, 2, -2].map((k) => shiftDegrees(motif, k, size)).find((m) => m !== null && Math.abs(m[0]! - options.from!) <= maxLeap);
    if (!near) throw new Rejected('the motif does not start near where the last phrase ended');
    motif = near;
  }
  rhythmA = [...rhythmA];

  // bar 2: the motif a step or two away
  let varied: number[] | null = null;
  for (const k of random.shuffle([1, -1, 2, -2])) {
    const shifted = shiftDegrees(motif, k, size);
    if (shifted && Math.abs(shifted[0]! - motif.at(-1)!) <= maxLeap) {
      varied = shifted;
      break;
    }
  }
  if (varied === null) throw new Rejected('the motif cannot be varied');

  // bar 3: a different rhythm and new notes
  let rhythmB = composeBar(random, beats, allowed, { rests: false, halfWeight: 2.2, wholeWeight: 0 });
  for (let tries = 0; tries < 12 && sameRhythm(rhythmA, rhythmB); tries++) rhythmB = composeBar(random, beats, allowed, { rests: false, halfWeight: 3, wholeWeight: 0 });
  if (sameRhythm(rhythmA, rhythmB)) throw new Rejected('no contrasting rhythm');
  const rhythmC = cadenceRhythm(random, beats, allowed);
  const ending = options.ending === 'tonic' ? 0 : options.ending;
  // the notes of bar 3 must end within a leap of where the cadence starts, which is within reach of the ending
  const contrast = walk(rhythmB.length, varied.at(-1), all.filter((e) => Math.abs(e - ending) <= maxLeap * rhythmC.length));
  const cadence = walk(rhythmC.length, contrast.at(-1), ending);

  return {
    bars: [pitched(rhythmA, motif, notes), pitched(rhythmA, varied, notes), pitched(rhythmB, contrast, notes), pitched(rhythmC, cadence, notes)],
    lastDegree: cadence.at(-1)!,
    motif: { degrees: motif, rhythm: rhythmA },
  };
}

function parseMotif(text: string | undefined): number[] | undefined {
  if (text === undefined) return undefined;
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  const degrees = parts.map(Number);
  if (degrees.length === 0 || degrees.some((d) => !Number.isInteger(d))) throw new BadRequest(`the motif "${text}" must be whole numbers like "0 1 2 1"`);
  return degrees;
}

const phrase: Builder = (setup, random, params) => {
  const { level, hand, bars } = setup;
  if (bars !== 4 && bars !== 8) throw new BadRequest('the phrase builder makes 4 or 8 bars');
  const notes = positionNotes(setup, hand);
  const given = parseMotif(params.motif);
  const beats = beatsPerBar(setup.meter);
  if (given) {
    if (given.length !== beats) throw new BadRequest(`the motif needs ${beats} notes (one per beat) for ${setup.meter.num}/${setup.meter.den}`);
    if (given.some((d) => d < 0 || d >= notes.length)) throw new BadRequest(`the motif uses degrees 0 to ${notes.length - 1}`);
  }
  const motif: Motif | undefined = given ? { degrees: given, rhythm: given.map(() => ({ beats: 1, rest: false })) } : undefined;
  const first = buildPhrase(random, setup, notes, { ...(motif ? { motif } : {}), ending: bars === 8 ? random.pick([1, 4].filter((d) => d < notes.length)) : 'tonic' });
  const phraseBars = [...first.bars];
  if (bars === 8) {
    // the answer: the same motif, from where the question stopped, ending at home
    const answer = buildPhrase(random, setup, notes, { motif: first.motif, from: first.lastDegree, ending: 'tonic' });
    phraseBars.push(...answer.bars);
  }
  return {
    title: 'Little Tune',
    comment: `A ${bars}-bar tune built from one short motif. Generated, level ${level.level}, ${hand === 'RH' ? 'right' : 'left'} hand.`,
    meter: setup.meter, bpm: BPM,
    voices: [{ hand, bars: phraseBars }],
    phrases: bars === 8 ? [{ name: 'Question', bars: [1, 4] }, { name: 'Answer', bars: [5, 8] }] : [{ name: 'Motif', bars: [1, 2] }, { name: 'Home', bars: [3, 4] }],
    tags: ['generated', 'phrase'],
  };
};

export const builders: Record<GeneratorKind, Builder> = {
  'five-finger': fiveFinger,
  scale,
  'reading-drill': readingDrill,
  echo,
  phrase,
};
