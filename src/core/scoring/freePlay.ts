import type { NoteJudged, PieceResult, WrongReason } from '../judge/types';

/**
 * A Free play session: the piece played round after round for fun, with no XP and nothing saved. This is what the
 * rundown shows when the player leaves. Plain data (it is passed on when the practice scene starts the next round) and
 * never changed in place: every record returns a new session.
 */
export interface FreePlaySession {
  /** Accuracy (first-try correct over notes, 0 to 1) of every round played to the end, in order. */
  rounds: number[];
  /** Correct key presses, in finished rounds and in the round the player left. */
  notesRight: number;
  /** Wrong key presses by reason, likewise. */
  wrong: Record<WrongReason, number>;
  /** Clock time (ms) of the session's first key, or null before any. */
  startedAtMs: number | null;
}

export interface FreePlaySummary {
  /** Anything at all happened: a key was judged or a round finished. */
  played: boolean;
  rounds: number;
  roundAccuracy: number[];
  bestAccuracy: number | null;
  lastAccuracy: number | null;
  notesRight: number;
  wrong: Record<WrongReason, number> & { total: number };
  /** From the first key to now; 0 before any key. */
  playedMs: number;
}

export function emptyFreePlay(): FreePlaySession {
  return { rounds: [], notesRight: 0, wrong: { 'wrong-octave': 0, 'neighbour-key': 0, 'wrong-letter': 0 }, startedAtMs: null };
}

/** A key the judge has judged, at `nowMs` on the game's clock. */
export function recordFreePlayNote(session: FreePlaySession, event: NoteJudged, nowMs: number): FreePlaySession {
  const startedAtMs = session.startedAtMs ?? nowMs;
  if (event.verdict === 'correct') return { ...session, startedAtMs, notesRight: session.notesRight + 1 };
  return { ...session, startedAtMs, wrong: { ...session.wrong, [event.reason]: session.wrong[event.reason] + 1 } };
}

/** A round played to the end. */
export function recordFreePlayRound(session: FreePlaySession, result: PieceResult): FreePlaySession {
  return { ...session, rounds: [...session.rounds, result.accuracy] };
}

/** What the rundown shows, when the player leaves at `nowMs`. */
export function summarizeFreePlay(session: FreePlaySession, nowMs: number): FreePlaySummary {
  const { rounds, wrong } = session;
  const total = Object.values(wrong).reduce((sum, n) => sum + n, 0);
  return {
    played: session.startedAtMs !== null || rounds.length > 0,
    rounds: rounds.length,
    roundAccuracy: [...rounds],
    bestAccuracy: rounds.length === 0 ? null : Math.max(...rounds),
    lastAccuracy: rounds.length === 0 ? null : rounds[rounds.length - 1]!,
    notesRight: session.notesRight,
    wrong: { ...wrong, total },
    playedMs: session.startedAtMs === null ? 0 : Math.max(0, nowMs - session.startedAtMs),
  };
}
