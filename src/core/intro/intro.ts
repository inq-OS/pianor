/**
 * The first-run intro (ft_1_31): Kiur shows a new player the room and the practice screen, one thing at a time under a
 * spotlight, then the teacher visits and walks the student through learn, practise and tug on the first bars of a piece.
 * What is said and pointed at is content (`content/intro/intro.json`), so a change in how a piece is learned is a content
 * change; the order of the stages and when the intro is due are these pure rules.
 */
import { z } from 'zod';
import type { PieceId, StringKey } from '../contracts';

/** The world flag kept once the intro was played to its end or skipped: it is never offered again by itself. */
export const INTRO_DONE_FLAG = 'intro.done';
/** The world flag kept when the intro begins, so a player who left it half way gets it again from the start. */
export const INTRO_STARTED_FLAG = 'intro.started';

/** What a spotlight can show in the room (the room's objects, the shield, Kiur on the bed) and on the practice screen. */
export const ROOM_SPOTS = ['piano', 'door', 'stand', 'shield', 'kiur'] as const;
export const PRACTICE_SPOTS = ['staff', 'note', 'listen', 'restart', 'back'] as const;
/** On the map: the warden's house (the way back to the room) and the first scene the student's level has opened. */
export const MAP_SPOTS = ['house', 'place'] as const;
export type MapSpot = (typeof MAP_SPOTS)[number];
export type RoomSpot = (typeof ROOM_SPOTS)[number];
export type PracticeSpot = (typeof PRACTICE_SPOTS)[number];

/** The stages said in the room, in order, and the plays on the practice screen. */
export const ROOM_STAGES = ['tour', 'knock', 'learn', 'practise', 'tug', 'end'] as const;
export type RoomStage = (typeof ROOM_STAGES)[number];
export type PlayStage = 'learn' | 'practise';

const line = z.string().min(1);
const kiurStep = <S extends readonly [string, ...string[]]>(spots: S) => z.strictObject({ who: z.literal('kiur'), spot: z.enum(spots).nullable(), line });
const roomStep = z.union([kiurStep(ROOM_SPOTS), z.strictObject({ who: z.literal('teacher'), line })]);

export const introSchema = z.strictObject({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  /** The piece the teacher's lesson is on, and its bars (1-based, inclusive). */
  piece: z.string().min(1),
  bars: z.tuple([z.int().min(1), z.int().min(1)]).refine(([first, last]) => first <= last, 'the first bar is not after the last'),
  /** Whole passes the practise stage asks for after the one of learn. */
  practisePasses: z.int().min(1).max(10),
  /** What is said in the room at each stage: Kiur under a spotlight, or the teacher in the doorway. */
  room: z.strictObject(Object.fromEntries(ROOM_STAGES.map((s) => [s, z.array(roomStep)])) as Record<RoomStage, z.ZodArray<typeof roomStep>>),
  /** What Kiur shows on the map of Keri, between the room's tour and the teacher's knock. */
  map: z.array(kiurStep(MAP_SPOTS)),
  /** What Kiur shows on the practice screen before the first pass of each play. */
  practice: z.strictObject({ learn: z.array(kiurStep(PRACTICE_SPOTS)), practise: z.array(kiurStep(PRACTICE_SPOTS)) }),
});

export type Intro = z.infer<typeof introSchema>;
export type RoomStep = Intro['room'][RoomStage][number];

export function parseIntro(raw: unknown): Intro {
  return introSchema.parse(raw);
}

/**
 * Whether the room opens the intro by itself (ft_1_31.AC1): `force` (the `?intro=1` switch) always, `off` (`?intro=0`,
 * the end-to-end tests) never; else for a player who has not finished or skipped it and who either has played nothing
 * yet (a new player) or began it and left half way. A player from before the intro, who has played, never gets it.
 */
export function introDue(input: { flags: readonly string[]; played: boolean; mode: 'auto' | 'force' | 'off' }): boolean {
  if (input.mode !== 'auto') return input.mode === 'force';
  if (input.flags.includes(INTRO_DONE_FLAG)) return false;
  return !input.played || input.flags.includes(INTRO_STARTED_FLAG);
}

/** What follows a room stage once its lines are said. */
export type AfterRoom =
  | { readonly kind: 'room'; readonly stage: RoomStage }
  | { readonly kind: 'map' }
  | { readonly kind: 'play'; readonly stage: PlayStage; readonly passes: number }
  | { readonly kind: 'tug' }
  | { readonly kind: 'done' };

/**
 * The stage after room stage `stage` (ft_1_31.AC4): the tour goes out to the map (`AFTER_MAP` brings it back), the knock
 * runs on into learn; learn and practise open the piano with the lesson's bars (one pass to learn it, `practisePasses` to
 * practise it); the tug is played over the room; the end closes the intro. Without the lesson's piece (a build without it)
 * the knock goes straight to the end.
 */
export function afterRoom(intro: Intro, stage: RoomStage, hasPiece: boolean): AfterRoom {
  switch (stage) {
    case 'tour': return { kind: 'map' };
    case 'knock': return { kind: 'room', stage: hasPiece ? 'learn' : 'end' };
    case 'learn': return { kind: 'play', stage: 'learn', passes: 1 };
    case 'practise': return { kind: 'play', stage: 'practise', passes: intro.practisePasses };
    case 'tug': return { kind: 'tug' };
    case 'end': return { kind: 'done' };
  }
}

/** The room stage the map's tour goes back to (ft_1_31.AC6). */
export const AFTER_MAP: RoomStage = 'knock';

/** The room stage a play goes back to: when its passes are played, the next one; when left with Back, its own again. */
export function afterPlay(stage: PlayStage, finished: boolean): RoomStage {
  if (!finished) return stage;
  return stage === 'learn' ? 'practise' : 'tug';
}

/** The steps of a room stage that can be said: without the lesson's piece the teacher does not come (`afterRoom`). */
export function roomSteps(intro: Intro, stage: RoomStage, hasPiece: boolean): readonly RoomStep[] {
  const steps = intro.room[stage];
  return hasPiece ? steps : steps.filter((s) => s.who === 'kiur');
}

/** Every string key the intro says, for the content test (each must be in the game's text). */
export function introLines(intro: Intro): StringKey[] {
  return [...ROOM_STAGES.flatMap((s) => intro.room[s].map((step) => step.line)), ...intro.map.map((s) => s.line), ...intro.practice.learn.map((s) => s.line), ...intro.practice.practise.map((s) => s.line)];
}

/** The lesson's bars as 0-based indexes, for slicing the piece. */
export function lessonBars(intro: Intro): { first: number; last: number; piece: PieceId } {
  return { piece: intro.piece, first: intro.bars[0] - 1, last: intro.bars[1] - 1 };
}

/** Consecutive steps said by the same speaker: Kiur's go under one spotlight overlay, the teacher's into one talk. */
export function stepRuns(steps: readonly RoomStep[]): RoomStep[][] {
  const runs: RoomStep[][] = [];
  for (const step of steps) {
    const last = runs[runs.length - 1];
    if (last && last[0]!.who === step.who) last.push(step);
    else runs.push([step]);
  }
  return runs;
}

/** The flags after the intro began or ended (skipped counts as ended): a flag is added once. */
export function introFlags(flags: readonly string[], event: 'started' | 'done'): string[] {
  const flag = event === 'started' ? INTRO_STARTED_FLAG : INTRO_DONE_FLAG;
  return flags.includes(flag) ? [...flags] : [...flags, flag];
}
