// Covers ft_1_02d.AC21 (the time panel's keys).
import { describe, expect, it } from 'vitest';
import { TIME_PANEL_START, timePanelKey, type TimePanelAction, type TimePanelState } from './timePanelKeys';

/** Presses `codes` from the start (or `from`) and gives every action and the state. */
function press(codes: string[], from: TimePanelState = TIME_PANEL_START): { state: TimePanelState; actions: TimePanelAction[] } {
  let state = from;
  const actions: TimePanelAction[] = [];
  for (const code of codes) {
    const out = timePanelKey(state, code);
    state = out.state;
    actions.push(out.action);
  }
  return { state, actions };
}

describe('the time panel keys (ft_1_02d.AC21)', () => {
  it('ft_1_02d.AC21 a digit sets the time first: 2, 3 or 4 is that time, others do nothing', () => {
    expect(press(['Digit3']).actions).toEqual([{ kind: 'meter', beats: 3 }]);
    expect(press(['Numpad2']).actions).toEqual([{ kind: 'meter', beats: 2 }]);
    expect(press(['Digit7']).actions).toEqual([{ kind: 'none' }]);
  });

  it('ft_1_02d.AC21 left and right choose the time, pick-up or tempo, and up and down step the chosen one', () => {
    const { state, actions } = press(['ArrowRight', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']);
    expect(actions).toEqual([
      { kind: 'none' }, { kind: 'step', group: 'pickup', direction: 1 }, { kind: 'none' }, { kind: 'step', group: 'bpm', direction: -1 },
      { kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' },
    ]);
    expect(state.group).toBe('meter');
  });

  it('ft_1_02d.AC21 on the pick-up a digit is its beats; on the tempo digits are typed, set once no digit more fits', () => {
    expect(press(['ArrowRight', 'Digit1']).actions[1]).toEqual({ kind: 'pickup', beats: 1 });
    const tempo = press(['ArrowRight', 'ArrowRight', 'Digit1', 'Digit2', 'Digit0']);
    expect(tempo.actions.slice(2)).toEqual([{ kind: 'typed' }, { kind: 'typed' }, { kind: 'bpm', bpm: 120 }]);
    expect(tempo.state.typed).toBe('');
    // 90 takes no third digit (900 is past the fastest tempo)
    expect(press(['ArrowRight', 'ArrowRight', 'Digit9', 'Digit0']).actions.at(-1)).toEqual({ kind: 'bpm', bpm: 90 });
  });

  it('ft_1_02d.AC21 Enter sets a tempo typed so far and closes the panel; Esc closes it and drops what was typed', () => {
    const typed = press(['ArrowRight', 'ArrowRight', 'Digit4', 'Digit5']).state;
    expect(typed.typed).toBe('45');
    expect(timePanelKey(typed, 'Enter').action).toEqual({ kind: 'bpm', bpm: 45, close: true });
    expect(timePanelKey(typed, 'Escape')).toEqual({ state: { ...typed, typed: '' }, action: { kind: 'close' } });
    expect(timePanelKey(TIME_PANEL_START, 'NumpadEnter').action).toEqual({ kind: 'close' });
    // a tempo too slow to keep is dropped
    expect(timePanelKey({ group: 'bpm', typed: '2' }, 'Enter').action).toEqual({ kind: 'close' });
  });

  it('ft_1_02d.AC21 other keys are not the panel\'s', () => {
    expect(press(['KeyZ']).actions).toEqual([{ kind: 'pass' }]);
  });
});
