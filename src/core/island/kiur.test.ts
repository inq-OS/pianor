import { describe, expect, it } from 'vitest';
import kiurJson from '../../../content/world/kiur.json';
import type { PieceStatus } from '../curriculum/play';
import { strings } from '../text/strings';
import { DEFAULT_KIUR_RULES, gapOf, kiurAdvice, kiurSays, parseKiurRules, type KiurAdvice, type KiurMoment } from './kiur';

const rules = DEFAULT_KIUR_RULES;

/** A status with a trend: predicted at the deadline, a band of ± spread. */
function status(piece: string, expected: number, predicted: number | null, over: Partial<PieceStatus> = {}): PieceStatus {
  const spread = 3;
  return {
    piece, plays: 10, level: predicted ?? 80, spread, histogram: [], retained: false, expected, predicted,
    band: predicted === null ? null : { low: predicted - spread, high: predicted + spread },
    delta: predicted === null ? null : expected - predicted, urgency: 0, colour: 'green', ...over,
  };
}
const unmeasured = (piece: string, plays: number): PieceStatus =>
  status(piece, 87, null, { plays, level: null, spread: null, colour: 'purple' });

const moment = (advice: KiurAdvice, over: Partial<KiurMoment> = {}): KiurMoment => ({
  occasion: 'room', advice, remindedToday: false, headsUps: [], minPlays: 3, ...over,
});

describe("Kiur's rules as content", () => {
  it('content/world/kiur.json holds the defaults', () => {
    expect(parseKiurRules(kiurJson)).toEqual(DEFAULT_KIUR_RULES);
    expect(() => parseKiurRules({ ...kiurJson, dailyFromGap: -1 })).toThrow();
  });
});

describe('the gap and the forced piece (ft_1_27.AC3, plan 4.5)', () => {
  it('the gap is expected − predicted, or expected − level before a trend, in whole points; none without a level', () => {
    expect(gapOf(status('a', 93, 88.4))).toEqual({ kind: 'trend', gap: 5 });
    expect(gapOf(status('a', 87, null, { level: 82 }))).toEqual({ kind: 'now', gap: 5 });
    expect(gapOf(unmeasured('a', 2))).toEqual({ kind: 'unmeasured', gap: 0 });
  });

  it("the worked example: the first owing piece in the urgency order is forced (B, priority 8, delta 5)", () => {
    // curriculumStatuses puts B first: priority 8 owes and comes before priority 2 (d139).
    const advice = kiurAdvice([status('b', 93, 88), status('a', 87, 85)], rules);
    expect(advice.forced).toEqual({ piece: 'b', kind: 'trend', gap: 5, plays: 10, often: 'daily' });
  });

  it('a piece that owes nothing is skipped; a piece with no level yet is forced, once a day', () => {
    expect(kiurAdvice([status('done', 90, 95), status('a', 87, 85)], rules).forced?.piece).toBe('a');
    expect(kiurAdvice([status('done', 90, 95), unmeasured('new', 1)], rules).forced).toEqual({ piece: 'new', kind: 'unmeasured', gap: 0, plays: 1, often: 'daily' });
    expect(kiurAdvice([status('done', 90, 95)], rules).forced).toBeNull();
    expect(kiurAdvice([], rules)).toEqual({ forced: null, shoulder: null });
  });

  it('ft_1_27.AC3 none at delta 0, once a day at 1 to 5, every visit above 5', () => {
    const often = (predicted: number) => kiurAdvice([status('a', 90, predicted)], rules).forced?.often ?? 'none';
    expect(often(90)).toBe('none');
    expect(often(89.6)).toBe('none'); // 0.4 rounds to 0
    expect(often(89)).toBe('daily');
    expect(often(85)).toBe('daily');
    expect(often(84)).toBe('everyVisit');
    expect(kiurAdvice([status('a', 90, 89)], { ...rules, dailyFromGap: 0 }).forced?.often).toBe('daily');
    expect(kiurAdvice([status('a', 90, 90)], { ...rules, dailyFromGap: 0 }).forced).toBeNull();
  });
});

describe('the shoulder (ft_1_27.AC4)', () => {
  it('ft_1_27.AC4 opens when the top of the band is below the expected level, on that piece', () => {
    expect(kiurAdvice([status('a', 90, 88)], rules).shoulder).toBeNull(); // band top 91
    expect(kiurAdvice([status('a', 90, 87)], rules).shoulder).toBeNull(); // band top 90, on the line
    expect(kiurAdvice([status('a', 90, 86)], rules).shoulder).toEqual({ piece: 'a', gap: 4 }); // band top 89
    expect(kiurAdvice([status('ok', 90, 89), status('a', 90, 80)], rules).shoulder).toEqual({ piece: 'a', gap: 10 });
    // the forced piece first when it is out of reach itself; else the first that is
    expect(kiurAdvice([status('b', 92, 90), status('a', 90, 80), status('c', 95, 85)], rules)).toMatchObject({ forced: { piece: 'b' }, shoulder: { piece: 'a' } });
    expect(kiurAdvice([status('a', 90, 80), status('c', 95, 80)], rules)).toMatchObject({ forced: { piece: 'a' }, shoulder: { piece: 'a', gap: 10 } });
    // a band of no spread under the goal by less than half a point is no gap: no shoulder
    expect(kiurAdvice([status('a', 90, 89.6, { band: { low: 89.6, high: 89.6 } })], rules).shoulder).toBeNull();
    expect(kiurAdvice([unmeasured('new', 0)], rules).shoulder).toBeNull();
  });

  it('ft_1_27.AC4 in a scene Kiur offers the piano with that piece open, and says nothing else there', () => {
    const advice = kiurAdvice([status('a', 90, 80)], rules);
    expect(kiurSays(moment(advice, { occasion: 'scene', headsUps: [{ character: 'puuvaim', line: 'kiur.headsUp.puuvaim.knoll' }] }))).toEqual([
      { line: 'kiur.shoulder', piece: 'a', params: { gap: 10 }, offerPiano: 'a' },
    ]);
    expect(kiurSays(moment(kiurAdvice([status('a', 90, 88)], rules), { occasion: 'scene' }))).toEqual([]);
  });
});

describe('what Kiur says on opening the game and in the room (ft_1_27.AC3, ft_1_25.AC5)', () => {
  const daily = kiurAdvice([status('a', 90, 87)], rules);
  const everyVisit = kiurAdvice([status('a', 90, 80)], rules);
  const heads = [
    { character: 'teacher', line: 'kiur.headsUp.teacher.boat' },
    { character: 'puuvaim', line: 'kiur.headsUp.puuvaim.knoll' },
  ];

  it('ft_1_27.AC3 every reminder names the piece and the gap', () => {
    expect(kiurSays(moment(daily, { occasion: 'open' }))).toEqual([{ line: 'kiur.remind.trend', piece: 'a', params: { gap: 3 } }]);
    expect(kiurSays(moment(kiurAdvice([status('a', 90, null, { level: 84 })], rules), { occasion: 'open' }))).toEqual([{ line: 'kiur.remind.now', piece: 'a', params: { gap: 6 } }]);
    expect(kiurSays(moment(kiurAdvice([unmeasured('a', 1)], rules), { occasion: 'open' }))).toEqual([{ line: 'kiur.remind.unmeasured', piece: 'a', params: { plays: 1, need: 3 } }]);
  });

  it('ft_1_27.AC3 a daily reminder once a day; above the every-visit gap on every visit', () => {
    expect(kiurSays(moment(daily, { occasion: 'open', remindedToday: true }))).toEqual([]);
    expect(kiurSays(moment(everyVisit, { occasion: 'open', remindedToday: true }))).toHaveLength(1);
    expect(kiurSays(moment(everyVisit, { occasion: 'room', remindedToday: true }))[0]!.line).toBe('kiur.remind.trend');
  });

  it('ft_1_25.AC5 one heads-up per visit to the room, the next one on each visit, after the reminder; none on opening', () => {
    expect(kiurSays(moment(daily, { headsUps: heads })).map((l) => l.line)).toEqual(['kiur.remind.trend', 'kiur.headsUp.teacher.boat']);
    expect(kiurSays(moment(daily, { headsUps: heads, remindedToday: true, visit: 1 })).map((l) => l.line)).toEqual(['kiur.headsUp.puuvaim.knoll']);
    expect(kiurSays(moment(daily, { headsUps: heads, remindedToday: true, visit: 2 })).map((l) => l.line)).toEqual(['kiur.headsUp.teacher.boat']);
    expect(kiurSays(moment(daily, { occasion: 'open', headsUps: heads, remindedToday: true }))).toEqual([]);
    expect(kiurSays(moment({ forced: null, shoulder: null }))).toEqual([]);
  });
});

describe("every line Kiur can say has text (write-ui-text)", () => {
  it('the reminder, shoulder and teacher heads-up keys are in the strings', () => {
    for (const key of ['kiur.remind.trend', 'kiur.remind.now', 'kiur.remind.unmeasured', 'kiur.shoulder', 'kiur.headsUp.teacher.boat', 'kiur.headsUp.teacher.landed']) {
      expect(key in strings, key).toBe(true);
    }
  });
});
