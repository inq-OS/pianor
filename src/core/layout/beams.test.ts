// Covers core_09.AC40: which notes are beamed, the run's stem direction and the second beams of sixteenths.
import { describe, expect, it } from 'vitest';
import { beatTicksOf, planBeams, type BeamInput } from './beams';

const E = 240;
const S = 120;
const DE = 360;
const Q = 480;
const DQ = 720;
/** Notes one after another from tick 0 in 4/4 bars of 1920 ticks, all on the middle-line position unless given. */
function seq(durs: number[], positions: number[] = []): BeamInput[] {
  let tick = 0;
  return durs.map((dur, i) => {
    const input = { tick, dur, positions: [positions[i] ?? 2] };
    tick += dur;
    return input;
  });
}
const bars = (tick: number) => ({ index: Math.floor(tick / 1920), beatOrigin: Math.floor(tick / 1920) * 1920 });
const members = (inputs: BeamInput[]) => planBeams(inputs, beatTicksOf(4), bars).map((r) => r.members);

describe('beam runs (core_09.AC40)', () => {
  it('core_09.AC40 beams the eighths of each beat: four eighths in a row are two pairs', () => {
    expect(members(seq([E, E, E, E, Q, Q]))).toEqual([[0, 1], [2, 3]]);
  });

  it('core_09.AC40 beams four sixteenths, an eighth and two sixteenths, two sixteenths and an eighth, and a dotted eighth and a sixteenth', () => {
    expect(members(seq([S, S, S, S, E, S, S, S, S, E, DE, S]))).toEqual([[0, 1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11]]);
  });

  it('core_09.AC40 leaves an eighth alone after a dotted quarter, and an eighth off the beat after a quarter', () => {
    expect(members(seq([DQ, E, Q, Q]))).toEqual([]);
    // quarter, eighth, eighth: the second beat's two eighths are a pair
    expect(members(seq([Q, E, E, Q, Q]))).toEqual([[1, 2]]);
  });

  it('core_09.AC40 never beams across a rest, a bar line or a beat', () => {
    const withRest: BeamInput[] = [{ tick: 0, dur: E, positions: [2] }, { tick: 480 - S, dur: S, positions: [2] }]; // a sixteenth rest between
    expect(members(withRest)).toEqual([]);
    expect(members(seq([Q, Q, Q, E, E, E, E]))).toEqual([[3, 4], [5, 6]]); // last two eighths of bar 1 and first two of bar 2
    expect(members(seq([E, Q, E, Q, Q]))).toEqual([]); // syncopation: the eighths sit on either side of a quarter
  });

  it('core_09.AC40 counts the beats of a pick-up from the end of its bar', () => {
    // a one-and-a-half-beat pick-up in 4/4: eighth then quarter; the eighth is the "and" of beat 3, alone
    const pickup = (tick: number) => (tick < DQ ? { index: 0, beatOrigin: DQ - 1920 } : { index: 1 + Math.floor((tick - DQ) / 1920), beatOrigin: DQ + Math.floor((tick - DQ) / 1920) * 1920 });
    const inputs: BeamInput[] = [{ tick: 0, dur: E, positions: [2] }, { tick: E, dur: Q, positions: [2] }, { tick: DQ, dur: E, positions: [2] }, { tick: DQ + E, dur: E, positions: [2] }];
    expect(planBeams(inputs, beatTicksOf(4), pickup).map((r) => r.members)).toEqual([[2, 3]]);
  });

  it('core_09.AC40 gives the whole run one stem direction from the mean of its heads', () => {
    const [low] = planBeams(seq([E, E], [0, 6]), beatTicksOf(4), bars); // mean 3: below the middle line
    expect(low!.up).toBe(true);
    const [high] = planBeams(seq([S, S, S, S], [4, 4, 5, 3]), beatTicksOf(4), bars); // mean 4: on it, down
    expect(high!.up).toBe(false);
  });
});

describe('second beams of sixteenths (core_09.AC40)', () => {
  const second = (durs: number[]) => planBeams(seq(durs), beatTicksOf(4), bars)[0]!.secondary;

  it('core_09.AC40 joins neighbouring sixteenths with a second beam', () => {
    expect(second([S, S, S, S])).toEqual([{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }]);
    expect(second([E, S, S])).toEqual([{ from: 1, to: 2 }]);
    expect(second([S, S, E])).toEqual([{ from: 0, to: 1 }]);
  });

  it('core_09.AC40 gives a lone sixteenth a partial beam pointing into the beat', () => {
    expect(second([DE, S])).toEqual([{ at: 1, toward: 'left' }]);
    expect(second([S, DE])).toEqual([{ at: 0, toward: 'right' }]);
    expect(second([S, E, S])).toEqual([{ at: 0, toward: 'right' }, { at: 2, toward: 'left' }]);
  });
});

describe('triplets in the beam plan (core_09.AC50)', () => {
  const T = 160;
  /** An eighth triplet on beat 1 (written eighths, played 160 ticks), then what `rest` holds, from tick 480. */
  const triplet = (rest: { dur: number; written?: number; tuplet?: number }[]): BeamInput[] => {
    let tick = 0;
    return [{ dur: T, written: E, tuplet: 0 }, { dur: T, written: E, tuplet: 0 }, { dur: T, written: E, tuplet: 0 }, ...rest].map((n) => {
      const input = { tick, positions: [2], ...n };
      tick += n.dur;
      return input;
    });
  };

  it('core_09.AC50 an eighth triplet in one beat is one beamed run with no second beam', () => {
    const runs = planBeams(triplet([{ dur: Q }, { dur: Q }, { dur: Q }]), beatTicksOf(4), bars);
    expect(runs.map((r) => r.members)).toEqual([[0, 1, 2]]);
    expect(runs[0]!.secondary).toEqual([]);
  });

  it('core_09.AC50 two triplets in a row are two runs, and a triplet never joins plain eighths', () => {
    expect(members(triplet([{ dur: T, written: E, tuplet: 1 }, { dur: T, written: E, tuplet: 1 }, { dur: T, written: E, tuplet: 1 }, { dur: E }, { dur: E }, { dur: Q }]))).toEqual([[0, 1, 2], [3, 4, 5], [6, 7]]);
    // played lengths alone would not beam: 160 ticks is no eighth
    expect(members(seq([T, T, T, Q, Q, Q]))).toEqual([]);
  });

  it('core_09.AC50 a quarter triplet is not beamed', () => {
    const quarters: BeamInput[] = [0, 320, 640].map((tick) => ({ tick, dur: 320, written: Q, tuplet: 0, positions: [2] }));
    expect(members(quarters)).toEqual([]);
  });
});
