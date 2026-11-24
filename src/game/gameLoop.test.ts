import { describe, expect, it } from 'vitest';
import { gameLoopConfig } from './gameLoop';

describe('the game loop', () => {
  it('gives every step its real time, so the game timers keep real time on a slow or unfocused machine', () => {
    expect(gameLoopConfig(false)).toEqual({ smoothStep: false });
  });

  it('steps on a timer with ?loop=timer, still with real time', () => {
    expect(gameLoopConfig(true)).toEqual({ smoothStep: false, forceSetTimeOut: true, target: 60 });
  });
});
