import type { ActorState } from '../../../../core/scene/actor';
import type { Look, Pose } from './figureModel';

/**
 * The template character's states (ActorDef A.4): each a short loop of poses at a low frame rate, as the 1991 game's
 * people move. `idle` breathes and blinks; `talk` moves the mouth and the near hand; `listen` clasps the hands and
 * nods; `play` is for a person who holds an instrument (anyone else has none and falls back to idle); `walk` is for the
 * map (nobody walks inside a scene in the MVP). `reach` is the body's arm length, so a hand lands where it should.
 */
export interface TemplateState {
  readonly fps: number;
  readonly loop: boolean;
  readonly frames: (look: Look, reach: number) => Pose[];
}

export const TEMPLATE_STATES: Readonly<Record<ActorState, TemplateState>> = {
  idle: {
    fps: 3,
    loop: true,
    frames: () => [{}, { bob: -0.4 }, { bob: -0.4, eyes: 'shut' }, {}],
  },
  talk: {
    fps: 6,
    loop: true,
    frames: () => [
      { mouth: 'open', near: { at: [5, -9], bend: -1 } },
      { mouth: 'shut', near: { at: [6, -8], bend: -1 }, headFwd: 0.9 },
      { mouth: 'round', near: { at: [7, -6], bend: -1 } },
      { mouth: 'shut', near: { at: [5.5, -9], bend: -1 }, brows: 'up' },
    ],
  },
  listen: {
    fps: 2,
    loop: true,
    frames: () => [
      { headFwd: 1.3, headDy: -0.7, eyes: 'down', clasp: true },
      { headFwd: 1.6, headDy: -1.2, eyes: 'down', clasp: true },
      { headFwd: 1.3, headDy: -0.7, eyes: 'shut', clasp: true },
      { headFwd: 1.0, headDy: -0.2, eyes: 'open', brows: 'up', clasp: true },
    ],
  },
  play: {
    fps: 4,
    loop: true,
    frames: (look) =>
      look.held === 'sax'
        ? [
            { holding: 'play', lean: 0.2, sway: 0, eyes: 'shut' },
            { holding: 'play', lean: -0.6, bob: 0.4, sway: 0.6, eyes: 'shut', nearFoot: [4.6, 0], nearToe: 1.2 },
            { holding: 'play', lean: 0.2, sway: 0, eyes: 'shut' },
            { holding: 'play', lean: 1.0, bob: -0.4, sway: -0.5, eyes: 'shut', brows: 'up' },
          ]
        : [],
  },
  walk: {
    fps: 8,
    loop: true,
    frames: (_look, reach) =>
      Array.from({ length: 6 }, (_, i): Pose => {
        const t = (i / 6) * Math.PI * 2;
        const stride = 7;
        const nearUp = Math.max(0, -Math.cos(t)) * 2.6;
        const farUp = Math.max(0, Math.cos(t)) * 2.6;
        return {
          bob: -Math.abs(Math.sin(t)) * 1.2 + 0.6,
          lean: 1.6,
          headFwd: 1.0,
          nearFoot: [Math.sin(t) * stride + 1.2, nearUp],
          farFoot: [-Math.sin(t) * stride - 0.2, farUp],
          nearToe: nearUp > 0.5 ? -0.8 : 0,
          farToe: farUp > 0.5 ? -0.8 : 0,
          near: { at: [-Math.sin(t) * 4.5 + 2, -reach * 0.86], bend: -1 },
          far: { at: [Math.sin(t) * 4.5 + 1.5, -reach * 0.86], bend: -1 },
        };
      }),
  },
};
