/** Dynamic marks a note can carry (core_09.AC14): soft to loud. A mark holds from the note it is written on. */
export const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const;

export type Dynamic = (typeof DYNAMICS)[number];

export const isDynamic = (value: string): value is Dynamic => (DYNAMICS as readonly string[]).includes(value);
