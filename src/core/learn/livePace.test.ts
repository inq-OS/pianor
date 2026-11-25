// Covers core_13.AC5, core_13.AC6.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { WaitMode } from '../judge/wait';
import type { JudgeEvent } from '../judge/types';
import { learnPace, paceClick } from './livePace';

// two bars of quarter notes at 120 BPM: C D E F | G A B C
const midis = [60, 62, 64, 65, 67, 69, 71, 72];
const chart = chartWith(midis.map((midi, i) => ({ tick: i * 480, dur: 480, midi })), { tempoMap: [{ tick: 0, bpm: 120 }] });

function played(times: readonly number[]): JudgeEvent[] {
  const mode = new WaitMode(chart);
  return times.flatMap((timeMs, i) => mode.handle({ kind: 'on', midi: midis[i]!, velocity: 80, timeMs, source: 'test' }));
}

describe('learnPace', () => {
  it('has the last key\'s place in the bar but no pace before three keys and no baseline', () => {
    expect(learnPace(chart, [], null)).toEqual({ beats: 4, beatMs: null, press: null });
    const pace = learnPace(chart, played([1000, 2000]), null);
    expect(pace.beatMs).toBeNull();
    expect(pace.press).toMatchObject({ tick: 480, place: 1, atMs: 2000 });
  });

  it('core_13.AC5 takes the piece\'s baseline before the run has a pace of its own', () => {
    // a baseline of 60 BPM: a quarter a second; the second key came after 400 ms, 60% short: early, far off
    const pace = learnPace(chart, played([1000, 1400]), 60);
    expect(pace.beatMs).toBe(1000);
    expect(pace.press!.mark).toMatchObject({ side: 'early', far: true });
    expect(pace.press!.mark!.at).toBeCloseTo(0.4); // the hand was not yet halfway to the dot
  });

  it('core_13.AC5 follows the student\'s own pace once three keys are played, and marks a key late against it', () => {
    // a quarter a second, then a gap of 1300 ms: 30% late against the run's own pace of 60 BPM, not far off
    const pace = learnPace(chart, played([1000, 2000, 3000, 4000, 5300]), 120);
    expect(pace.beatMs).toBe(1000);
    expect(pace.press).toMatchObject({ place: 0, atMs: 5300, mark: { side: 'late', far: false } }); // the next bar's first beat
    expect(pace.press!.mark!.at).toBeCloseTo(0.3);
    expect(learnPace(chart, played([1000, 2000, 3000, 4000]), null).press!.mark).toMatchObject({ side: 'even', at: 3 });
  });

  it('keeps a mark of a long pause within one beat of its dot', () => {
    const pace = learnPace(chart, played([1000, 2000, 3000, 7000]), null);
    expect(pace.press!.mark).toMatchObject({ side: 'late', far: true });
    expect(pace.press!.mark!.at).toBeCloseTo(4); // place 3, one beat late at most
  });
});

describe('paceClick', () => {
  it('core_13.AC6 clicks on at the student\'s pace from the next beat after the key, on the bar\'s grid', () => {
    expect(paceClick(learnPace(chart, played([1000, 2000, 3000]), null))).toEqual({ bpm: 60, beatsPerBar: 4, startAtMs: 4000, firstBeat: 3 });
    expect(paceClick(learnPace(chart, played([1000, 2000, 3000, 4000]), null))).toMatchObject({ startAtMs: 5000, firstBeat: 0 });
  });

  it('core_13.AC6 has no click before a pace is known', () => {
    expect(paceClick(learnPace(chart, played([1000, 2000]), null))).toBeNull();
  });
});
