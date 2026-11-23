// Covers ft_1_32.AC5 (the markers the practice screen draws), ft_1_32.AC7 (the confirmation play is measured).
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { WaitMode } from '../../core/judge/wait';
import { DEFAULT_LEARN_SETTINGS, START_PROGRESS, type LearnProgress } from '../../core/learn/progress';
import type { BarPlay } from '../../core/progression/practiceLog';
import { LearnSession, markersFor, type LearnProfile } from './LearnSession';

const miss = { tick: 480, track: 'rh', midi: 62 };
const play = (bar: number, misses: BarPlay['misses']): BarPlay => ({
  at: '1998-11-22T10:00:00Z', pieceId: 'p', bar, notes: 2, firstTry: 2 - misses.length, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses,
});
// a section chart of one bar: bar 3 of the piece
const section = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }]);
const profile = (settings = DEFAULT_LEARN_SETTINGS, log = [play(3, [miss]), play(3, [miss])]) => ({ learnSettings: settings, practiceFor: () => log });

describe('markersFor', () => {
  it('finds the note of a section by the piece\'s bar', () => {
    expect([...markersFor(profile(), 'p', section, 3).keys()]).toEqual([1]);
    expect(markersFor(profile(), 'p', section, 0).size).toBe(0);
  });

  it('shows nothing with the markers off, and follows the player\'s threshold', () => {
    expect(markersFor(profile({ ...DEFAULT_LEARN_SETTINGS, markers: false }), 'p', section, 3).size).toBe(0);
    expect(markersFor(profile({ ...DEFAULT_LEARN_SETTINGS, markersFrom: 3 }), 'p', section, 3).size).toBe(0);
    expect(markersFor(profile({ ...DEFAULT_LEARN_SETTINGS, markersFrom: 1 }, [play(3, [miss])]), 'p', section, 3).size).toBe(1);
  });
});

describe('LearnSession', () => {
  // one bar of four quarter notes: grow 1, then its confirmation play, which is the whole piece
  const midis = [60, 62, 64, 65];
  const piece = chartWith(midis.map((midi, i) => ({ tick: i * 480, dur: 480, midi })));

  function open(saved: LearnProgress = START_PROGRESS) {
    const kept = { progress: saved };
    const profileOf: LearnProfile = {
      learnSettings: DEFAULT_LEARN_SETTINGS, learnProgressOf: () => kept.progress, practiceFor: () => [], recordFor: () => undefined,
      saveLearnProgress: (_, progress) => { kept.progress = progress; return Promise.resolve(true); },
    };
    return { kept, session: () => LearnSession.open(profileOf, piece, '1998-11-22')! };
  }

  /** Play the run's notes at the times given through a Wait judge into the session. */
  function playRun(session: LearnSession, times: readonly number[]) {
    const mode = new WaitMode(session.chart);
    times.forEach((timeMs, i) => session.push(mode.handle({ kind: 'on', midi: midis[i]!, velocity: 80, timeMs, source: 'test' })));
    return session.outcomeOf(session.chart, false);
  }

  it('does not measure a growing step, measures the confirmation play, and asks an uneven one again', async () => {
    const { kept, session } = open();
    const grow = session();
    expect(grow.run.step.kind).toBe('grow');
    expect(playRun(grow, [0, 100, 2000, 2100])).toEqual({ outcome: 'perfect' });
    await grow.finish('perfect');

    const uneven = session();
    expect(uneven.run.step.kind).toBe('confirm');
    expect(uneven.wholePiece).toBe(true);
    const wobbled = playRun(uneven, [0, 300, 2300, 2600]);
    expect(wobbled).toEqual({ outcome: 'unsteady' });
    await uneven.finish(wobbled.outcome);
    expect(kept.progress).toMatchObject({ step: 1, misses: 0 });
    // the uneven run's measures are kept too, for the stats (ft_1_32.AC8)
    expect(kept.progress.tests).toEqual([expect.objectContaining({ day: '1998-11-22', step: 1, steady: false, halts: 1 })]);

    const even = session();
    const counted = playRun(even, [0, 1000, 2000, 3000]);
    expect(counted).toEqual({ outcome: 'perfect', bpm: 60 });
    await even.finish(counted.outcome, counted.bpm);
    expect(even.learned).toBe(false); // the whole piece is asked three times in a row
    expect(even.baseline).toBe(60);
    expect(kept.progress.tests).toHaveLength(2);
    expect(kept.progress.tests![1]).toEqual({ day: '1998-11-22', step: 1, bpm: 60, sd: 0, mad: 0, drift: 0, halts: 0, steady: true, kind: 'confirm', firstBar: 0, bars: [100] });
    for (let run = 2; run <= 3; run++) {
      const again = session();
      const played = playRun(again, [0, 1000, 2000, 3000]);
      await again.finish(played.outcome, played.bpm);
    }
    expect(kept.progress).toMatchObject({ step: 2, bpm: [60, 60, 60] });
    expect(session()).toBeNull();
  });

  it('counts nothing with note names shown', () => {
    expect(open().session().outcomeOf(piece, true)).toEqual({ outcome: 'hinted' });
  });

  it('ft_1_32.AC2 a piece in progress keeps its step size when the setting changes; a new piece takes the setting', async () => {
    const eight = chartWith(Array.from({ length: 8 }, (_, bar) => ({ tick: bar * 1920, dur: 480, midi: 60 + bar })));
    const kept = { progress: START_PROGRESS, settings: DEFAULT_LEARN_SETTINGS };
    const profileOf: LearnProfile = {
      get learnSettings() { return kept.settings; }, learnProgressOf: () => kept.progress, practiceFor: () => [], recordFor: () => undefined,
      saveLearnProgress: (_, progress) => { kept.progress = progress; return Promise.resolve(true); },
    };
    const first = LearnSession.open(profileOf, eight, '1998-11-22')!;
    await first.finish('perfect'); // bar 1 done: the next step is bars 1-2
    kept.settings = { ...DEFAULT_LEARN_SETTINGS, stepBars: 2 };
    const again = LearnSession.open(profileOf, eight, '1998-11-22')!;
    expect(again.run).toMatchObject({ firstBar: 0, lastBar: 1, step: { kind: 'grow' } });
    expect(kept.progress.stepBars).toBe(1);
    kept.progress = START_PROGRESS; // a piece not started takes the setting: its first step is two bars
    expect(LearnSession.open(profileOf, eight, '1998-11-22')!.run).toMatchObject({ firstBar: 0, lastBar: 1 });
  });

  it('ft_1_32.AC4 keeps when the piece was learned, and its learning runs never raise a bar to gold', async () => {
    const { kept, session } = open();
    const learning = session();
    await learning.finish('stopped');
    await learning.finish('perfect'); // grow: bar 1, silver for the stopped run
    const clock = new Date('1998-11-22T10:05:00Z');
    const last = LearnSession.open({
      learnSettings: DEFAULT_LEARN_SETTINGS, learnProgressOf: () => kept.progress, recordFor: () => undefined,
      practiceFor: () => [0, 1, 2].map((i) => ({ ...play(0, []), at: `1998-11-22T10:0${i}:00Z` })),
      saveLearnProgress: (_, progress) => { kept.progress = progress; return Promise.resolve(true); },
    }, piece, '1998-11-22', () => clock)!;
    await last.finish('perfect');
    await last.finish('perfect');
    await last.finish('perfect'); // the confirmation play, three times in a row: learned
    expect(kept.progress.learnedAt).toBe('1998-11-22T10:05:00.000Z');
    // the bar's three perfect plays were learning runs, before it was learned: they do not raise it to gold
    expect(last.rewards().piece).toBe('silver');
  });
});
