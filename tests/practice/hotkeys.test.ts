import { describe, expect, it } from 'vitest';
import { QWERTY_OFFSETS } from '../../src/io/mock/QwertyKeyboard';
import { hasGlyph, measure } from '../../src/game/ui/pixel/font';
import { HOTKEYS, firstFitting, IDLE, actionForCode, isResetKey, chordStep, digitForCode, hotkeyLabel, typedBarRange, type Chord, type ChordContext, type ChordEffect } from '../../src/game/practice/hotkeys';

const ctx = (barCount: number, inSection = false): ChordContext => ({ barCount, inSection });

/** Feed key codes in turn ('timeout' is the typing pause); returns the final chord and every effect that was not 'none'. */
function run(codes: string[], c: ChordContext, from: Chord = IDLE): { chord: Chord; effects: ChordEffect[] } {
  let chord = from;
  const effects: ChordEffect[] = [];
  for (const code of codes) {
    const step = chordStep(chord, code === 'timeout' ? { kind: 'timeout' } : { kind: 'key', code }, c);
    chord = step.chord;
    if (step.effect.kind !== 'none') effects.push(step.effect);
  }
  return { chord, effects };
}

describe('practice hotkeys', () => {
  it('writes every label with characters the pixel font can draw', () => {
    for (const action of Object.keys(HOTKEYS) as (keyof typeof HOTKEYS)[]) {
      for (const ch of hotkeyLabel('Section Note names Fingers Whole piece', action)) expect(hasGlyph(ch), `${action}: ${ch}`).toBe(true);
    }
  });

  it('takes the longest label that fits and the shortest when none does', () => {
    const labels = ['Whole piece [Shift+R]', 'Whole [Shift+R]', 'Whole piece', 'Whole'];
    expect(firstFitting(labels, 200, measure)).toBe(labels[0]);
    expect(firstFitting(labels, measure('Whole piece') + 10, measure)).toBe('Whole piece');
    expect(firstFitting(labels, 5, measure)).toBe('Whole');
  });

  it('shows the letter in brackets after the label', () => {
    expect(hotkeyLabel('Section', 'section')).toBe('Section [Shift+R]');
    expect(hotkeyLabel('Fingers', 'fingers')).toBe('Fingers [F]');
  });

  it('maps a key to its action and leaves M, plus and minus free for the click', () => {
    expect(actionForCode('KeyR', true)).toBe('section');
    expect(actionForCode('KeyR')).toBeNull(); // plain R is a note of the computer-keyboard piano
    expect(actionForCode('KeyA', true)).toBeNull();
    expect(actionForCode('KeyA')).toBe('noteNames');
    expect(actionForCode('KeyF')).toBe('fingers');
    for (const code of ['KeyM', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract']) expect(actionForCode(code)).toBeNull();
  });

  it('ft_1_12.AC8 the plain space bar starts the play over, and it is no key of the computer-keyboard piano', () => {
    const key = (code: string, mods: Partial<Record<'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) => ({ code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods });
    expect(actionForCode('Space')).toBe('reset');
    expect(isResetKey(key('Space'))).toBe(true);
    for (const mod of ['shiftKey', 'ctrlKey', 'metaKey', 'altKey'] as const) expect(isResetKey(key('Space', { [mod]: true }))).toBe(false);
    expect(isResetKey(key('Enter'))).toBe(false);
    expect(QWERTY_OFFSETS.Space).toBeUndefined();
  });

  it('takes a piano key of the computer keyboard only with Shift', () => {
    for (const { code, shift } of Object.values(HOTKEYS)) if (QWERTY_OFFSETS[code] !== undefined) expect(shift).toBe(true);
  });

  it('reads digits from the top row and the number pad', () => {
    expect(digitForCode('Digit7')).toBe('7');
    expect(digitForCode('Numpad0')).toBe('0');
    expect(digitForCode('KeyR')).toBeNull();
  });

  it('R, 1, 2 marks bars 1 and 2 of a piece of eight, 0-based', () => {
    const { chord, effects } = run(['KeyR', 'Digit1', 'Digit2'], ctx(8));
    expect(effects).toEqual([{ kind: 'picking' }, { kind: 'first-picked' }, { kind: 'section', first: 0, last: 1 }]);
    expect(chord).toEqual(IDLE);
  });

  it('puts reversed bars in order', () => {
    expect(run(['KeyR', 'Digit5', 'Digit2'], ctx(8)).effects.at(-1)).toEqual({ kind: 'section', first: 1, last: 4 });
  });

  it('allows the same bar twice as a one-bar section', () => {
    expect(run(['KeyR', 'Digit3', 'Digit3'], ctx(8)).effects.at(-1)).toEqual({ kind: 'section', first: 2, last: 2 });
  });

  it('rejects bar 0 and bars past the end, and lets the player type again', () => {
    const zero = run(['KeyR', 'Digit0', 'timeout'], ctx(8));
    expect(zero.effects.at(-1)).toEqual({ kind: 'rejected' });
    expect(zero.chord).toEqual({ phase: 'first', digits: '' });
    const past = run(['KeyR', 'Digit9'], ctx(8));
    expect(past.effects.at(-1)).toEqual({ kind: 'rejected' });
    expect(run(['Digit2'], ctx(8), past.chord).effects).toEqual([{ kind: 'first-picked' }]);
  });

  it('core_09.AC25 with a pick-up the typed numbers are the printed ones: 0 is the pick-up, 1 the first full bar', () => {
    const c: ChordContext = { barCount: 9, inSection: false, firstPrinted: 0 };
    expect(typedBarRange(c)).toEqual({ first: 0, last: 8 });
    expect(run(['KeyR', 'Digit1', 'Digit2'], c).effects.at(-1)).toEqual({ kind: 'section', first: 1, last: 2 });
    expect(run(['KeyR', 'Digit0', 'timeout', 'Digit8'], c).effects.at(-1)).toEqual({ kind: 'section', first: 0, last: 8 });
    expect(run(['KeyR', 'Digit9'], c).effects.at(-1)).toEqual({ kind: 'rejected' });
    expect(typedBarRange(ctx(8))).toEqual({ first: 1, last: 8 });
  });

  it('waits for Enter or the pause when a longer number is possible', () => {
    const c = ctx(24);
    const one = run(['KeyR', 'Digit1'], c);
    expect(one.chord).toEqual({ phase: 'first', digits: '1' }); // 1 and 10 to 19 are all bars
    expect(run(['Enter'], c, one.chord).effects).toEqual([{ kind: 'first-picked' }]);
    // 12 is taken at once (120 is past the last bar); a lone 2 can still grow to 20 to 24, so it waits for the pause
    const pair = run(['KeyR', 'Digit1', 'Digit2', 'Digit2'], c);
    expect(pair.chord).toEqual({ phase: 'last', first: 11, digits: '2' });
    expect(run(['timeout'], c, pair.chord).effects).toEqual([{ kind: 'section', first: 1, last: 11 }]);
  });

  it('Backspace drops a digit, Enter on nothing does nothing, a fourth digit is ignored', () => {
    const c = ctx(200);
    const typed = run(['KeyR', 'Digit1', 'Digit2'], c).chord;
    expect(typed).toEqual({ phase: 'first', digits: '12' });
    expect(run(['Backspace'], c, typed).chord).toEqual({ phase: 'first', digits: '1' });
    expect(run(['Enter'], c, { phase: 'first', digits: '' }).effects).toEqual([]);
    expect(run(['Digit4'], c, { phase: 'first', digits: '123' }).chord).toEqual({ phase: 'first', digits: '123' });
  });

  it('R again while picking with nothing typed cancels; with digits typed it is ignored', () => {
    expect(run(['KeyR', 'KeyR'], ctx(8)).effects).toEqual([{ kind: 'picking' }, { kind: 'cancel' }]);
    const mid = run(['KeyR', 'Digit1'], ctx(24));
    expect(run(['KeyR'], ctx(24), mid.chord).effects).toEqual([]);
  });

  it('R while a section is set goes back to the whole piece', () => {
    expect(run(['KeyR'], ctx(8, true)).effects).toEqual([{ kind: 'whole' }]);
  });

  it('ignores other keys, and digits when no chord was started', () => {
    expect(run(['Digit1', 'KeyQ', 'Enter', 'timeout'], ctx(8)).effects).toEqual([]);
    expect(run(['KeyQ', 'KeyZ'], ctx(8), { phase: 'first', digits: '' }).effects).toEqual([]);
  });
});
