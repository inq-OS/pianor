/**
 * The wind over Keri: one number that every moving thing of the scenery reads, so the sea, the clouds, the grass
 * and the smoke always tell the same weather. 0 calm, 1 breeze, 2 wind, 3 storm.
 */
export type Wind = 0 | 1 | 2 | 3;

/** The sea's state at each wind: a calm sea, an occasional wave or two, a restless sea, a stormy sea. */
export const SEA_STATES = ['calm', 'waves', 'restless', 'stormy'] as const;
export type SeaState = (typeof SEA_STATES)[number];

export function seaState(wind: Wind): SeaState {
  return SEA_STATES[wind];
}

/** A wind from text (the dev switch `?wind=`): a number 0 to 3 or a sea state's name; null for anything else. */
export function windFrom(value: string | null): Wind | null {
  if (value === null) return null;
  const named = SEA_STATES.indexOf(value as SeaState);
  if (named >= 0) return named as Wind;
  return value === '0' || value === '1' || value === '2' || value === '3' ? (Number(value) as Wind) : null;
}

const DAY_MS = 86_400_000;
/** How many days in a hundred have each wind: mostly a breeze or calm, a storm now and then. */
const DAYS_IN_HUNDRED: readonly number[] = [28, 40, 24, 8];

/**
 * The day's wind until the real weather sets it (ft_Y_14). AX-3 provisional: every day (UTC) has one wind, picked from the
 * day's number, so the same day shows the same sea every time the game opens and different days differ.
 */
export function windOfDay(instant: number): Wind {
  const day = Math.floor(instant / DAY_MS);
  // a small integer hash of the day number, 0 to 99
  let n = (day * 2654435761) >>> 0;
  n = ((n ^ (n >>> 15)) * 2246822519) >>> 0;
  const roll = (n ^ (n >>> 13)) % 100;
  let upTo = 0;
  for (let wind = 0; wind < DAYS_IN_HUNDRED.length; wind++) {
    upTo += DAYS_IN_HUNDRED[wind]!;
    if (roll < upTo) return wind as Wind;
  }
  return 1;
}
