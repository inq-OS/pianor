import type Phaser from 'phaser';

/**
 * How the game's loop measures time (Phaser's `fps` config). The game's timers (a tooltip's delay, the teacher's arrival at
 * her hour, a tug's pause between turns) follow real time, so each step gets the real time since the last one: Phaser's
 * smoothing would hold a step to one target frame while the window is not focused or while it starts, and replace a step
 * longer than 200 ms, so on a slow machine (a software GPU, a busy tablet) a 3 s timer took 35 s.
 * A long pause of the page (a hidden tab) does not jump ahead: Phaser pauses the loop while the page is hidden.
 *
 * `timerLoop` (`?loop=timer`, src/config.ts): the end-to-end tests on a machine without a GPU step the loop on a timer.
 */
export function gameLoopConfig(timerLoop: boolean): Phaser.Types.Core.FPSConfig {
  return { smoothStep: false, ...(timerLoop ? { forceSetTimeOut: true, target: 60 } : {}) };
}
