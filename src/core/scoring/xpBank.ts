/**
 * The XP bank of a practice run (WP-X). A run starts with a bank equal to its base XP and the bank only goes down:
 * - a miss bites N x the base bite, where N counts the misses on the same note (restarts on each new note);
 * - miss bites switch off once the bank is at or below a floor (a share of the base XP);
 * - an idle click (the player does not press a key for more than a bar) bites the base bite and ignores the floor;
 * - at 0 the run is stopped.
 * The bank is pure data: the caller decides when a miss or an idle click happens.
 */

/** Points bitten by one step: a share of the base XP, or 1 point when the base is under 100. */
export function baseBite(baseXp: number, bitePercent: number): number {
  if (baseXp < 100) return 1;
  return Math.max(1, Math.round((baseXp * bitePercent) / 100));
}

/** Default share of the base XP at or below which miss bites switch off (content sets it in content/curriculum/xpBank.json). */
export const BANK_FLOOR_PERCENT = 10;

export class XpBank {
  readonly baseXp: number;
  readonly bite: number;
  private remaining: number;
  private lastNote: number | null = null;
  private missesOnNote = 0;
  private readonly floorPercent: number;

  constructor(baseXp: number, bitePercent: number, floorPercent = BANK_FLOOR_PERCENT) {
    if (!Number.isFinite(baseXp) || baseXp < 1) throw new RangeError(`base XP must be at least 1, got ${baseXp}`);
    if (!Number.isFinite(bitePercent) || bitePercent < 0) throw new RangeError(`bite percent must be 0 or more, got ${bitePercent}`);
    this.baseXp = baseXp;
    this.bite = baseBite(baseXp, bitePercent);
    this.floorPercent = floorPercent;
    this.remaining = baseXp;
  }

  /** XP left in the bank, from 0 to the base XP. */
  get bank(): number {
    return this.remaining;
  }

  /** The bank as a share of the base XP, 0 to 1. */
  get fraction(): number {
    return this.remaining / this.baseXp;
  }

  /** True once the bank is empty: the run is over. */
  get stopped(): boolean {
    return this.remaining === 0;
  }

  /** A wrong key on the note with this index. The Nth miss on the same note bites N x the base bite. */
  miss(noteIndex: number): void {
    if (this.stopped) return;
    if (noteIndex === this.lastNote) this.missesOnNote++;
    else {
      this.lastNote = noteIndex;
      this.missesOnNote = 1;
    }
    if (this.remaining <= this.floor) return;
    this.take(this.missesOnNote * this.bite);
  }

  /** One click of an idle player (more than a bar without a key press). Ignores the floor. */
  idleClick(): void {
    if (this.stopped) return;
    this.take(this.bite);
  }

  private get floor(): number {
    return (this.baseXp * this.floorPercent) / 100;
  }

  private take(points: number): void {
    this.remaining = Math.max(0, this.remaining - points);
  }
}
