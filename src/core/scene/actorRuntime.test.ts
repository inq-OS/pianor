import { describe, expect, it } from 'vitest';
import { actorDefSchema, type ActorDef } from './actor';
import { actorFrame, actorStateOf, placeActor } from './actorRuntime';

const kiur: ActorDef = {
  schemaVersion: 1, id: 'kiur', sheet: 'kiur', size: { w: 48, h: 40 }, anchor: { x: 24, y: 39 },
  states: { idle: { frames: 2, fps: 2, loop: true }, talk: { frames: 4, fps: 8, loop: true }, play: { frames: 3, fps: 10, loop: false } },
};

describe('ActorDef: a sheet or the template character (ft_1_24.AC3, d142)', () => {
  it('ft_1_24.AC3 takes exactly one of a sheet and a template', () => {
    expect(actorDefSchema.safeParse(kiur).success).toBe(true);
    const bare: Omit<ActorDef, 'sheet'> = { schemaVersion: 1, id: 'kiur', size: kiur.size, anchor: kiur.anchor, states: kiur.states };
    const templated = { ...bare, template: { features: { head: 'round', hair: 'generate' } } };
    expect(actorDefSchema.parse(templated).template?.features['hair']).toBe('generate');
    expect(actorDefSchema.safeParse(bare).success).toBe(false);
    expect(actorDefSchema.safeParse({ ...templated, sheet: 'kiur' }).success).toBe(false);
  });
});

describe('the actors runtime: state, frame and place (ft_1_24.AC3)', () => {
  it('ft_1_24.AC3 a missing state falls back to idle', () => {
    expect(actorStateOf(kiur, 'talk')).toBe('talk');
    expect(actorStateOf(kiur, 'walk')).toBe('idle');
    expect(actorStateOf(kiur, 'listen')).toBe('idle');
  });

  it('ft_1_24.AC3 steps the frames at the state\'s rate, looping or holding the last', () => {
    expect([0, 499, 500, 999, 1000].map((t) => actorFrame(kiur, 'idle', t))).toEqual([0, 0, 1, 1, 0]);
    expect([0, 125, 250, 375, 500].map((t) => actorFrame(kiur, 'talk', t))).toEqual([0, 1, 2, 3, 0]);
    expect([0, 100, 200, 300, 5000].map((t) => actorFrame(kiur, 'play', t))).toEqual([0, 1, 2, 2, 2]);
    // a state it does not have plays idle's frames
    expect(actorFrame(kiur, 'walk', 600)).toBe(1);
    // before the state began (a clock that went back) shows the first frame
    expect(actorFrame(kiur, 'idle', -50)).toBe(0);
  });

  it('ft_1_24.AC3 stands the feet on the place, scaled, mirrored when facing left, and z-ordered by the feet', () => {
    const right = placeActor(kiur, { id: 'p', x: 100, y: 200, facing: 'right' });
    expect(right).toEqual({ x: 76, y: 161, scale: 1, mirrored: false, depth: 200 });
    const left = placeActor(kiur, { id: 'p', x: 100, y: 200, facing: 'left', scale: 0.5 });
    expect(left).toEqual({ x: 88, y: 180.5, scale: 0.5, mirrored: true, depth: 200 });
    // facing front or back is drawn as the sheet stands
    expect(placeActor(kiur, { id: 'p', x: 10, y: 50, facing: 'front' }).mirrored).toBe(false);
  });
});
