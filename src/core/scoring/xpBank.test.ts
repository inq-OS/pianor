import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { XpBank, baseBite } from './xpBank';

describe('baseBite', () => {
  it('is the bite percent of the base XP', () => {
    expect(baseBite(200, 1)).toBe(2);
    expect(baseBite(1000, 2)).toBe(20);
  });

  it('is 1 point when the base XP is under 100', () => {
    expect(baseBite(99, 1)).toBe(1);
    expect(baseBite(10, 3)).toBe(1);
  });
});

describe('XpBank', () => {
  it('escalates the bite per miss on the same note: 200 gives 200, 198, 196, 192 (example from WP-X)', () => {
    const bank = new XpBank(200, 1);
    expect(bank.bank).toBe(200);
    bank.miss(1); // first miss on note 1: 1 x 2
    expect(bank.bank).toBe(198);
    bank.miss(2); // first miss on note 2: 1 x 2
    expect(bank.bank).toBe(196);
    bank.miss(2); // second miss on note 2: 2 x 2
    expect(bank.bank).toBe(192);
  });

  it('restarts the miss count on each new note', () => {
    const bank = new XpBank(200, 1);
    bank.miss(1);
    bank.miss(1);
    expect(bank.bank).toBe(194); // 2 + 4
    bank.miss(2); // new note: count restarts, bite 2 again
    expect(bank.bank).toBe(192);
  });

  it('turns miss bites off once the bank is 10% or less of base', () => {
    const bank = new XpBank(200, 1);
    // 90 first-misses on distinct notes, 2 points each: 200 - 180 = 20, exactly 10%.
    for (let i = 0; i < 90; i++) bank.miss(i);
    expect(bank.bank).toBe(20);
    bank.miss(100); // at the floor: no bite
    expect(bank.bank).toBe(20);
    bank.miss(100);
    expect(bank.bank).toBe(20);
  });

  it('still bites above the floor just before it', () => {
    const bank = new XpBank(200, 1);
    for (let i = 0; i < 89; i++) bank.miss(i);
    expect(bank.bank).toBe(22);
    bank.miss(200); // 22 is above 20: bites 2
    expect(bank.bank).toBe(20);
  });

  it('bites a whole point for each miss when the base XP is under 100', () => {
    const bank = new XpBank(50, 1);
    bank.miss(0);
    expect(bank.bank).toBe(49);
    bank.miss(0);
    expect(bank.bank).toBe(47); // 2 x 1
  });

  it('idle clicks bite the base bite, and ignore the floor', () => {
    const bank = new XpBank(200, 1);
    for (let i = 0; i < 17; i++) bank.miss(i); // 17 first-misses: 200 - 34 = 166
    expect(bank.bank).toBe(166);
    for (let i = 0; i < 80; i++) bank.idleClick();
    expect(bank.bank).toBe(6); // 166 - 80 x 2: below the floor, idle still bites
  });

  it('stops at 0 and ignores further input', () => {
    const bank = new XpBank(10, 1);
    expect(bank.stopped).toBe(false);
    for (let i = 0; i < 20; i++) bank.idleClick();
    expect(bank.bank).toBe(0);
    expect(bank.stopped).toBe(true);
    bank.miss(0);
    bank.idleClick();
    expect(bank.bank).toBe(0);
  });

  it('reports the fraction of base XP left', () => {
    const bank = new XpBank(200, 1);
    bank.miss(0);
    expect(bank.fraction).toBeCloseTo(0.99);
  });

  it('rejects a base below 1 XP or a negative bite', () => {
    expect(() => new XpBank(0, 1)).toThrow(RangeError);
    expect(() => new XpBank(100, -1)).toThrow(RangeError);
  });

  it('never goes below 0 and never rises (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2000 }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.array(fc.oneof(fc.integer({ min: 0, max: 20 }).map((n) => ({ miss: n })), fc.constant({ idle: true as const }))),
        (base, percent, actions) => {
          const bank = new XpBank(base, percent);
          let last = bank.bank;
          for (const action of actions) {
            if ('miss' in action) bank.miss(action.miss);
            else bank.idleClick();
            expect(bank.bank).toBeGreaterThanOrEqual(0);
            expect(bank.bank).toBeLessThanOrEqual(last);
            expect(bank.fraction).toBeGreaterThanOrEqual(0);
            expect(bank.fraction).toBeLessThanOrEqual(1);
            last = bank.bank;
          }
        },
      ),
    );
  });
});
