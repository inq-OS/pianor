// Covers core_04.AC1.
import { describe, expect, it } from 'vitest';
import progressionJson from '../../content/curriculum/progression.json';
import type { PieceResult } from '../../src/core/judge';
import { ProfileRepository, parseProgressionConfig } from '../../src/core/progression';
import { ProfileService } from '../../src/game/profile/ProfileService';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const config = parseProgressionConfig(progressionJson);
const CATALOGUE = [{ id: 'a', unlockLevel: 1 }];

const result = (accuracy = 1, timing?: number): PieceResult => ({
  chartId: 'a', contentVersion: 1, notes: 10, firstTryCorrect: Math.round(accuracy * 10), mistakes: 0, accuracy, rhythmErrorMs: null,
  hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
  ...(timing === undefined ? {} : { timing: { played: 10, onTime: 10, early: 0, late: 0, missed: 0, meanAbsErrorMs: 30, score: timing } }),
});

async function setup(store = new MemoryStore()) {
  const repository = new ProfileRepository(store, config, { now: () => new Date('1998-10-09T10:00:00.000Z'), idFactory: () => 'p1' });
  return ProfileService.create({ repository, config, catalogue: () => CATALOGUE, now: () => new Date('1998-10-09T12:00:00.000Z') });
}

describe('piece stats in the profile service (core_04)', () => {
  it('records how a piece was played, reports its stats at once, and keeps them after a reload', async () => {
    const store = new MemoryStore();
    const service = await setup(store);
    expect(service.statsFor('a')).toMatchObject({ plays: 0, proficiency: 0, speed: null });
    expect(service.startPercent('a')).toBe(100);

    const first = await service.completePiece(result(1), { mode: 'wait', tempoPercent: 100 });
    expect(first.stats).toMatchObject({ plays: 1, goodPlays: 1, proficiency: 100, speed: null });
    const second = await service.completePiece(result(0.95, 88), { mode: 'tempo', tempoPercent: 110 });
    expect(second.stats).toMatchObject({ plays: 2, goodPlays: 2, proficiency: 100, speed: 110, timing: 88 });
    await service.completePiece(result(0.5), { mode: 'wait', tempoPercent: 70 });
    expect(service.statsFor('a')).toMatchObject({ plays: 3, goodPlays: 2, proficiency: 67, speed: 110 });
    expect(service.startPercent('a')).toBe(70); // where it was last played

    const again = await setup(store); // a reload: the same numbers from the saved history
    expect(again.statsFor('a')).toEqual(service.statsFor('a'));
    expect(again.startPercent('a')).toBe(70);
    expect(again.profile.attempts.map((a) => a.play)).toEqual([
      { mode: 'wait', tempoPercent: 100 }, { mode: 'tempo', tempoPercent: 110 }, { mode: 'wait', tempoPercent: 70 },
    ]);
    expect(again.profile.attempts[1]!.result.timing).toMatchObject({ score: 88, played: 10 });
  });

  it('a play without play information is Wait mode at the written tempo', async () => {
    const service = await setup();
    await service.completePiece(result(1));
    expect(service.profile.attempts[0]!.play).toEqual({ mode: 'wait', tempoPercent: 100 });
  });
});
