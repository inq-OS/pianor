import { describe, expect, it } from 'vitest';
import { inkBounds, inkCount, type Bitmap } from '../bitmap';
import { C } from '../palette';
import { KIUR_DOOR, KIUR_DOOR_WING_ROW, MASCOT, MASCOT_SIZE } from '../sprites';
import { KIUR_FLIGHT, KIUR_MOODS, KIUR_PERCHED, KIUR_TURN, kiurAsleep } from './kiurFrames';
import { KIUR_SIZE, kiurCapEdge, paintKiur } from './kiurModel';

const count = (b: Bitmap, colour: number): number => b.pixels.reduce((n, p) => n + (p === colour ? 1 : 0), 0);
const same = (a: Bitmap, b: Bitmap): boolean => a.width === b.width && a.pixels.every((p, i) => p === b.pixels[i]);

/** The colours of a tree pipit (d114) and of his face: nothing else is on him, in any pose. */
const FEATHERS: ReadonlySet<number> = new Set([
  C.clear, C.featherInk, C.featherStreak, C.umberDeep, C.umberDark, C.umber, C.umberLight, C.buffDeep, C.buffDark, C.buff, C.buffLight,
  C.downShade, C.down, C.downLight, C.legDark, C.leg, C.legLight, C.cream, C.ink, C.white, C.red, C.pink, C.gold,
]);

const EVERY_FRAME: readonly (readonly [string, Bitmap])[] = [
  ...Object.entries(KIUR_MOODS),
  ...KIUR_TURN.map((frame, i) => [`turn ${i}`, frame] as const),
  ['perched', KIUR_PERCHED],
  ...kiurAsleep().map((frame, i) => [`asleep ${i}`, frame] as const),
  ...KIUR_FLIGHT.map((frame, i) => [`flight ${i}`, frame] as const),
  ['door', KIUR_DOOR],
];

describe('Kiur, the model of a tree pipit (d114)', () => {
  it('paints the same pose to the same pixels every time, 48 x 40 on the fine grid unless the pose says otherwise', () => {
    const once = paintKiur({ yaw: 24, headYaw: -24 });
    expect([once.width, once.height]).toEqual([KIUR_SIZE.w, KIUR_SIZE.h]);
    expect(same(once, paintKiur({ yaw: 24, headYaw: -24 }))).toBe(true);
    expect([KIUR_FLIGHT[0]!.width, KIUR_FLIGHT[0]!.height]).toEqual([64, 48]);
  });

  it('is drawn in his own colours only, in every pose', () => {
    for (const [name, frame] of EVERY_FRAME) {
      for (const colour of new Set(frame.pixels)) expect(FEATHERS.has(colour), `${name}: colour ${colour}`).toBe(true);
    }
  });

  it('is brown and streaked above, buff with dark drops on the breast, white below, on pink legs', () => {
    const front = KIUR_TURN[0]!, back = KIUR_TURN[4]!;
    for (const colour of [C.umber, C.buff, C.down, C.leg, C.featherStreak, C.cream]) expect(count(front, colour), String(colour)).toBeGreaterThan(3);
    // from behind he is all back: of the breast and the white belly only an edge shows, and the streaks are still there
    expect(count(back, C.buff) + count(back, C.down)).toBeLessThan((count(front, C.buff) + count(front, C.down)) / 10);
    expect(count(back, C.featherStreak)).toBeGreaterThan(20);
  });

  it('is one bird from every side: two eyes from the front, one from the side, none from behind, and he stands on one line', () => {
    const eyes = KIUR_TURN.map((frame) => count(frame, C.ink));
    expect(eyes[0]).toBeGreaterThan(eyes[2]!);
    expect(eyes[2]).toBeGreaterThan(0);
    expect(eyes[4]).toBe(0);
    expect(new Set(KIUR_TURN.map((frame) => inkBounds(frame)!.bottom)).size).toBe(1);
  });

  it('never frowns: the cap over his eyebrow is highest over the bill and only falls away toward the back', () => {
    for (let azimuth = 0; azimuth < 180; azimuth += 5) {
      expect(kiurCapEdge(azimuth + 5), `at ${azimuth}`).toBeLessThanOrEqual(kiurCapEdge(azimuth));
      expect(kiurCapEdge(-azimuth)).toBe(kiurCapEdge(azimuth));
    }
  });

  it('has a line round him, darker on the shade side, that a painted picture can leave away', () => {
    const lined = paintKiur({ yaw: 45 }), bare = paintKiur({ yaw: 45, bare: true });
    expect(count(bare, C.featherInk)).toBe(0);
    expect(count(lined, C.featherInk)).toBeGreaterThan(20);
    // the line only adds pixels: where the bare bird is drawn, both are the same
    expect(bare.pixels.every((p, i) => p === 0 || p === lined.pixels[i])).toBe(true);
    expect(inkCount(lined)).toBeGreaterThan(inkCount(bare));
  });
});

describe('Kiur\'s frames', () => {
  it('has three moods that differ: he sings with an open red bill and two gold notes, and looks up when he thinks', () => {
    expect(same(MASCOT.idle, MASCOT.cheer) || same(MASCOT.idle, MASCOT.hmm) || same(MASCOT.cheer, MASCOT.hmm)).toBe(false);
    expect(count(MASCOT.idle, C.red) + count(MASCOT.idle, C.gold)).toBe(0);
    expect(count(MASCOT.cheer, C.red)).toBeGreaterThan(3);
    expect(count(MASCOT.cheer, C.gold)).toBeGreaterThan(6);
    expect(count(MASCOT.hmm, C.red) + count(MASCOT.hmm, C.gold)).toBe(0);
  });

  it('takes 24 x 20 layout cells as the mascot, every mood the same size', () => {
    expect(MASCOT_SIZE).toEqual({ w: 24, h: 20 });
    for (const frame of Object.values(MASCOT)) expect([frame.width, frame.height]).toEqual([48, 40]);
  });

  it('sleeps with his eyes shut and his bill tucked away, a little bigger when he breathes in, sitting on the same line', () => {
    const [out, breathIn] = kiurAsleep();
    expect(count(out, C.ink) + count(breathIn, C.ink)).toBe(0);
    expect(inkCount(breathIn)).toBeGreaterThan(inkCount(out));
    expect(inkBounds(breathIn)!.bottom).toBe(inkBounds(out)!.bottom);
    expect(inkBounds(breathIn)!.top).toBeLessThan(inkBounds(out)!.top);
  });

  it('flies with his wings up, level and down: three different pictures, legs tucked in', () => {
    const [up, level, down] = KIUR_FLIGHT;
    expect(same(up!, level!) || same(level!, down!)).toBe(false);
    for (const frame of KIUR_FLIGHT) expect(count(frame, C.leg) + count(frame, C.legDark)).toBeLessThan(count(KIUR_TURN[2]!, C.leg) + count(KIUR_TURN[2]!, C.legDark));
  });

  it('ft_1_15 points at the door with one wing held out to the right, at the row the scene puts the door button on', () => {
    const body = inkBounds(KIUR_TURN[0]!)!;
    const door = inkBounds(KIUR_DOOR)!;
    expect(door.right - door.left).toBeGreaterThan(body.right - body.left + 12);
    // the wing's tip: the rightmost drawn column is drawn at the wing's row, and not at his feet or his crown
    const drawnAt = (y: number): boolean => KIUR_DOOR.pixels[y * KIUR_DOOR.width + door.right - 1] !== 0;
    expect(drawnAt(KIUR_DOOR_WING_ROW) || drawnAt(KIUR_DOOR_WING_ROW - 1) || drawnAt(KIUR_DOOR_WING_ROW + 1)).toBe(true);
    expect(drawnAt(door.top) || drawnAt(door.bottom - 1)).toBe(false);
    // he looks at the door: one eye shows
    expect(count(KIUR_DOOR, C.ink)).toBeLessThan(count(KIUR_TURN[0]!, C.ink));
  });
});
