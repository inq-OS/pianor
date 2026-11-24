// Covers core_13.AC1, core_13.AC5, core_13.AC7.
import { describe, expect, it } from 'vitest';
import { clickRing, PACE_MARKS, paceMark, pressRing, RING_ROOM, ringBox, ringDots } from './beat';

describe('ringDots', () => {
  it('puts one dot a beat on a circle, the first at the top, going clockwise', () => {
    const dots = ringDots(4, 10);
    expect(dots).toHaveLength(4);
    expect(dots[0]!.x).toBeCloseTo(0);
    expect(dots[0]!.y).toBeCloseTo(-10); // the top (y grows down)
    expect(dots[1]!.x).toBeCloseTo(10); // a quarter turn on: the right
    expect(dots[2]!.y).toBeCloseTo(10);
    expect(dots[3]!.x).toBeCloseTo(-10);
  });
});

describe('clickRing', () => {
  const beat = { beatInBar: 2, atMs: 1000, intervalMs: 500 };

  it('core_13.AC1 lights the dot of the click just heard, fully at its moment and fading out by the next', () => {
    expect(clickRing(beat, 4, 1000)).toMatchObject({ beats: 4, lit: 2, glow: 1, hand: 2 });
    const half = clickRing(beat, 4, 1250);
    expect(half.glow).toBeCloseTo(0.5);
    expect(half.hand).toBeCloseTo(2.5); // the hand halfway to the next dot
  });

  it('core_13.AC1 reaches the next dot exactly when its click is due, and waits there', () => {
    expect(clickRing(beat, 4, 1500).hand).toBeCloseTo(3);
    expect(clickRing(beat, 4, 1900).hand).toBeCloseTo(3);
    // round past the first beat of the bar: the last beat's hand goes to the top
    expect(clickRing({ beatInBar: 3, atMs: 1000, intervalMs: 500 }, 4, 1500).hand).toBeCloseTo(0);
  });

  it('shows nothing before the first click is heard', () => {
    expect(clickRing(null, 4, 0)).toMatchObject({ lit: null, hand: null, mark: null });
    expect(clickRing(beat, 4, 900)).toMatchObject({ lit: null, hand: null });
  });
});

describe('paceMark', () => {
  it('core_13.AC5 a gap as long as the pace asks is even; one shorter is early, longer late, and past the far margin far', () => {
    expect(paceMark(0)).toEqual({ side: 'even', far: false });
    expect(paceMark(-PACE_MARKS.near / 2)).toEqual({ side: 'even', far: false });
    expect(paceMark(-0.3)).toEqual({ side: 'early', far: false });
    expect(paceMark(0.3)).toEqual({ side: 'late', far: false });
    expect(paceMark(-0.6)).toEqual({ side: 'early', far: true });
    expect(paceMark(0.9)).toEqual({ side: 'late', far: true });
  });
});

describe('pressRing', () => {
  const press = { place: 1, atMs: 2000, mark: { side: 'late' as const, far: false, at: 1.25 } };

  it('core_13.AC5 lights the dot of the key just played and keeps its mark where the hand was at the press', () => {
    expect(pressRing(press, 4, 500, 2000)).toMatchObject({ lit: 1, glow: 1, hand: 1, mark: { side: 'late', at: 1.25 } });
  });

  it('core_13.AC5 sweeps the hand on at the student\'s pace, so a pause shows the hand running past the next dot', () => {
    expect(pressRing(press, 4, 500, 2500).hand).toBeCloseTo(2);
    expect(pressRing(press, 4, 500, 3250).hand).toBeCloseTo(3.5);
    // it goes round once at most and stops there
    expect(pressRing(press, 4, 500, 9000).hand).toBeCloseTo(1);
  });

  it('has no hand before a pace is known, and no light on a key between two beats', () => {
    expect(pressRing(press, 4, null, 2200).hand).toBeNull();
    expect(pressRing({ ...press, place: 1.5 }, 4, 500, 2000).lit).toBeNull();
    expect(pressRing(null, 4, 500, 2000)).toMatchObject({ lit: null, hand: null, mark: null });
  });
});

describe('ringBox', () => {
  const area = { top: 100, width: 1900, height: 800 };

  it('core_13.AC7 stands the ring on the parchment in the room right of the staff, at the foot of the sheet, as wide as that room allows', () => {
    const box = ringBox(area, 40, RING_ROOM)!;
    // the room is RING_ROOM staff spaces wide at the right; the ring leaves half a space to the staff, a space to the sheet's edge
    expect(box.size).toBe((RING_ROOM - 1.5) * 40);
    expect(box.x + box.size).toBeLessThanOrEqual(1900 - 40);
    expect(box.x).toBeGreaterThanOrEqual(1900 - RING_ROOM * 40);
    expect(box.x + box.size).toBeLessThanOrEqual(1900);
    expect(box.y + box.size).toBeLessThanOrEqual(100 + 800);
    expect(box.y).toBeGreaterThan(100 + 800 / 2); // in the lower half, under the prizes of a learning run
  });

  it('core_13.AC7 is not drawn without room at the staff\'s right, or on a sheet too low for it', () => {
    expect(ringBox(area, 40, 0)).toBeNull();
    expect(ringBox({ ...area, height: 120 }, 40, RING_ROOM)).toBeNull();
  });
});
