// Covers core_02.AC2.
import { describe, expect, it } from 'vitest';
import littleSteps from '../fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../../src/core/chart';
import { CLICK_MAX, CLICK_MIN, CLICK_STEP, clickBpm, clickPlan, metronomeFor, stepClickOffset } from '../../src/core/transport';
import { stripBpmLabel } from '../../src/game/practice/clickSpeed';
import { metronomeAtCreate } from '../../src/game/practice/metronomeStart';
import { HOTKEYS, actionForCode, hotkeyLabel } from '../../src/game/practice/hotkeys';
import { QWERTY_OFFSETS } from '../../src/io/mock/QwertyKeyboard';

const chart = chartSchema.parse(littleSteps);

describe('the click speed', () => {
  it('is the tempo with the percent, plus the offset in steps of 5 BPM', () => {
    expect(CLICK_STEP).toBe(5);
    expect(clickBpm(100, 100, 0)).toBe(100);
    expect(clickBpm(100, 60, 0)).toBe(60);
    expect(clickBpm(100, 60, 10)).toBe(70);
    expect(clickBpm(100, 100, -15)).toBe(85);
  });

  it('a step moves the click by 5 and stops at the range', () => {
    expect(stepClickOffset(0, 1, 100, 100)).toBe(5);
    expect(stepClickOffset(5, -1, 100, 100)).toBe(0);
    let offset = 0;
    for (let i = 0; i < 100; i++) offset = stepClickOffset(offset, 1, 100, 100);
    expect(clickBpm(100, 100, offset)).toBe(CLICK_MAX);
    offset = 0;
    for (let i = 0; i < 100; i++) offset = stepClickOffset(offset, -1, 100, 100);
    expect(clickBpm(100, 100, offset)).toBe(CLICK_MIN);
  });

  it('clamps whatever the piece tempo and percent are, and a step can lead back into the range', () => {
    expect(clickBpm(400, 150, 0)).toBe(CLICK_MAX);
    expect(clickBpm(40, 30, 0)).toBe(CLICK_MIN);
    expect(stepClickOffset(0, 1, 40, 30)).toBe(CLICK_STEP);
  });

  it('the plan keeps the beats per bar and changes only the BPM', () => {
    const base = metronomeFor(chart, 80);
    const plan = clickPlan(chart, 80, 10);
    expect(plan.beatsPerBar).toBe(base.beatsPerBar);
    expect(plan.bpm).toBe(clickBpm(chart.tempoMap[0]!.bpm, 80, 10));
    expect(clickPlan(chart, 80, 0).bpm).toBe(Math.round(base.bpm));
  });

  it('the Wait mode start uses the offset, Tempo mode never starts it here', () => {
    expect(metronomeAtCreate('wait', true, chart, 100, 10)).toEqual(clickPlan(chart, 100, 10));
    expect(metronomeAtCreate('tempo', true, chart, 100, 10)).toBeNull();
    expect(metronomeAtCreate('wait', false, chart, 100, 10)).toBeNull();
  });
});

describe('the BPM label of the strip with the click speed', () => {
  it('stays the piece BPM in Wait mode until the click is on and moved, and follows the percent in Tempo mode', () => {
    expect(stripBpmLabel(70, { tempoMode: false, percent: 100, clickOn: false, offset: 0 })).toBe('70 BPM');
    expect(stripBpmLabel(70, { tempoMode: false, percent: 100, clickOn: true, offset: 0 })).toBe('70 BPM');
    expect(stripBpmLabel(70, { tempoMode: false, percent: 100, clickOn: false, offset: 10 })).toBe('70 BPM');
    expect(stripBpmLabel(70, { tempoMode: false, percent: 100, clickOn: true, offset: 10 })).toBe('70 BPM (80)');
    expect(stripBpmLabel(70, { tempoMode: true, percent: 50, clickOn: true, offset: 10 })).toBe('70 BPM (35)');
  });
});

describe('the click keys', () => {
  it('are Shift+M, Shift+= and Shift+-, because M is a piano key', () => {
    expect(QWERTY_OFFSETS.KeyM).toBeDefined();
    expect(actionForCode('KeyM')).toBeNull();
    expect(actionForCode('KeyM', true)).toBe('click');
    expect(actionForCode('Equal', true)).toBe('clickFaster');
    expect(actionForCode('Minus', true)).toBe('clickSlower');
    expect(actionForCode('Equal')).toBeNull();
    expect(actionForCode('Minus')).toBeNull();
    for (const { code, shift } of Object.values(HOTKEYS)) if (QWERTY_OFFSETS[code] !== undefined) expect(shift).toBe(true);
  });

  it('shows Shift+M on the Click button', () => {
    expect(hotkeyLabel('Click', 'click')).toBe('Click [Shift+M]');
  });
});
