import { blit, createBitmap, fromAscii, type Bitmap } from '../bitmap';
import { C } from '../palette';
import { KIUR_SIZE, paintKiur, type KiurPose } from './kiurModel';

/**
 * Kiur's pictures, each a pose of the one model (`kiurModel.ts`, d114): his three moods, the turn-around (front, sides,
 * back), perched, asleep, flying and pointing at the door. All on the fine grid (d110): draw one with
 * `PixelScene.fineImage`, or scale a `PixelImage` by `1 / ART_DETAIL`.
 */

/** He stands a little turned with his head to the student: livelier than square on. */
const STANDING: KiurPose = { yaw: 24, headYaw: -24 };

const NOTE_LEGEND = { n: C.gold } as const;
/** Two notes in gold over his bill, for the singing frame. */
const NOTES: readonly { rows: readonly string[]; x: number; y: number }[] = [
  { rows: ['.nn', '.n.', '.n.', 'nn.', 'nn.'], x: 38, y: 0 },
  { rows: ['n.', 'n.', 'nn'], x: 43, y: 7 },
];

function singing(): Bitmap {
  const out = createBitmap(KIUR_SIZE.w, KIUR_SIZE.h);
  blit(out, paintKiur({ ...STANDING, headLift: 1, fluff: 0.7, bill: 'sing' }), 0, 0);
  for (const note of NOTES) blit(out, fromAscii(note.rows, NOTE_LEGEND), note.x, note.y);
  return out;
}

/** The three moods of the mascot: at rest, singing (the cheer) and looking up and aside (thinking). 48 x 40 fine pixels. */
export const KIUR_MOODS = {
  idle: paintKiur(STANDING),
  cheer: singing(),
  hmm: paintKiur({ yaw: 24, headYaw: 14, headLift: 0.8, eyes: 'up' }),
} as const;

/** The turn-around, facing the screen's right where he has a side: front, front quarter, side, back quarter, back. */
export const KIUR_TURN: readonly Bitmap[] = [0, 45, 90, 135, 180].map((yaw) => paintKiur({ yaw }));

/** Sitting on his feet, as on a branch or a shoulder, looking back over his shoulder at the student. */
export const KIUR_PERCHED: Bitmap = paintKiur({ yaw: 60, headYaw: -35, legs: 'sit', oy: 26 });

const ASLEEP: KiurPose = { yaw: 62, headYaw: -128, headDrop: [0, -3.2, -2.5], legs: 'sit', bill: 'hidden', eyes: 'shut', oy: 26 };

/**
 * Asleep, fluffed up, the bill tucked into the back feathers: breathing out, and breathing in (rounder, the head a
 * little higher). `bare` leaves the line round him away, for a painted picture.
 */
export function kiurAsleep(bare = false): readonly [Bitmap, Bitmap] {
  return [paintKiur({ ...ASLEEP, fluff: 1.3, bare }), paintKiur({ ...ASLEEP, fluff: 1.9, headLift: 0.6, bare })];
}

/**
 * Woken where he slept: sitting on his feet and still a little fluffed, his head up out of his back feathers and turned to
 * the student, eyes open (ft_1_21.AC14, the room's second look of him). `bare` as for `kiurAsleep`.
 */
export function kiurWoken(bare = false): Bitmap {
  return paintKiur({ yaw: 62, headYaw: -70, headLift: 2, legs: 'sit', eyes: 'open', fluff: 1.1, oy: 26, bare });
}

const FLIGHT: KiurPose = { yaw: 90, pitch: 68, legs: 'tucked', headDrop: [0, 2, -1], w: 64, h: 48, ox: 30 };

/** Flying to the screen's right: wings up, level and down. 64 x 48 fine pixels. */
export const KIUR_FLIGHT: readonly Bitmap[] = [
  paintKiur({ ...FLIGHT, wings: 'up', oy: 30 }),
  paintKiur({ ...FLIGHT, wings: 'mid', oy: 26 }),
  paintKiur({ ...FLIGHT, wings: 'down', oy: 18 }),
];
