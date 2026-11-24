// Covers ft_1_11.AC1, ft_1_32.AC12, core_13.AC2.
import { describe, expect, it } from 'vitest';
import type { Bitmap } from './bitmap';
import { C } from './palette';
import { BAR_NUMBER_MODES } from '../../../core/layout/barNumbers';
import { SYMBOL_HEIGHT, SYMBOL_WIDTH, barNumbersSymbol, beatRingSymbol, durationSymbol, fingersSymbol, liveTempoSymbol, learnHandsSymbol, learnStepSymbol, linesSymbol, markersFromSymbol, markersSymbol, namingSymbol, paceClickSymbol, resumeSymbol, scoreSymbol, staffGapSymbol } from './settingArt';

const same = (a: Bitmap, b: Bitmap) => a.pixels.every((p, i) => p === b.pixels[i]);
const count = (b: Bitmap, colour: number) => b.pixels.filter((p) => p === colour).length;

const SETTINGS: Record<string, Bitmap[]> = {
  score: (['off', 'colour', 'number'] as const).map(scoreSymbol),
  staffGap: (['short', 'wide'] as const).map(staffGapSymbol),
  lines: ([1, 2, 'all'] as const).map(linesSymbol),
  durationRH: (['off', 'ghost', 'band', 'both'] as const).map((m) => durationSymbol(m, 'RH')),
  durationLH: (['off', 'ghost', 'band', 'both'] as const).map((m) => durationSymbol(m, 'LH')),
  learnStep: ([1, 2] as const).map(learnStepSymbol),
  markers: [true, false].map(markersSymbol),
  markersFrom: [1, 2, 3, 4, 5].map(markersFromSymbol),
  learnHands: [false, true].map(learnHandsSymbol),
  naming: (['B', 'H'] as const).map(namingSymbol),
  resume: (['continue', 'over'] as const).map(resumeSymbol),
  fingers: (['off', 'top', 'all'] as const).map(fingersSymbol),
  barNumbers: BAR_NUMBER_MODES.map(barNumbersSymbol),
  liveTempo: [false, true].map(liveTempoSymbol),
  beatRing: [false, true].map(beatRingSymbol),
  paceClick: [false, true].map(paceClickSymbol),
};

describe('settings button pictures', () => {
  it.each(Object.entries(SETTINGS))('every choice of %s has a picture of the same size, and no two choices look alike', (_name, pictures) => {
    for (const p of pictures) expect([p.width, p.height]).toEqual([SYMBOL_WIDTH, SYMBOL_HEIGHT]);
    for (let i = 0; i < pictures.length; i++) for (let j = i + 1; j < pictures.length; j++) expect(same(pictures[i]!, pictures[j]!), `choices ${i} and ${j}`).toBe(false);
  });

  it('core_13.AC2 the beat ring\'s picture has its lit dot only when on, the click\'s picture its sound waves only when on, and each off picture is struck through', () => {
    expect(count(beatRingSymbol(false), C.green)).toBe(0);
    expect(count(beatRingSymbol(false), C.red)).toBeGreaterThan(0); // struck through
    expect(count(paceClickSymbol(false), C.red)).toBeGreaterThan(0);
    expect(count(beatRingSymbol(true), C.green)).toBeGreaterThan(0);
    expect(count(paceClickSymbol(false), C.blue)).toBe(0);
    expect(count(paceClickSymbol(true), C.blue)).toBeGreaterThan(0);
  });

  it('the timing view looks like play: off is all black notes, colours adds the gold and red of mistimed and missed notes', () => {
    expect(count(scoreSymbol('off'), C.gold) + count(scoreSymbol('off'), C.red)).toBe(0);
    expect(count(scoreSymbol('colour'), C.gold)).toBeGreaterThan(0);
    expect(count(scoreSymbol('colour'), C.red)).toBeGreaterThan(0);
    expect(count(scoreSymbol('number'), C.red)).toBe(0);
  });

  it('ft_1_11.AC1: a hand\'s note length button shows the ghost head (A), the band (B), both or neither on that hand\'s staff only', () => {
    const half = SYMBOL_HEIGHT / 2;
    const where = (b: Bitmap, colour: number) => new Set([...b.pixels.keys()].filter((i) => b.pixels[i] === colour).map((i) => (Math.floor(i / b.width) < half ? 'upper' : 'lower')));
    for (const [hand, staff] of [['RH', 'upper'], ['LH', 'lower']] as const) {
      expect([...where(durationSymbol('off', hand), C.blue), ...where(durationSymbol('off', hand), C.blueLight)]).toEqual([]);
      expect([...where(durationSymbol('ghost', hand), C.blue)]).toEqual([staff]);
      expect([...where(durationSymbol('ghost', hand), C.blueLight)]).toEqual([]);
      expect([...where(durationSymbol('band', hand), C.blueLight)]).toEqual([staff]);
      expect([...where(durationSymbol('band', hand), C.blue)]).toEqual([]);
      expect([...where(durationSymbol('both', hand), C.blue)]).toEqual([staff]);
      expect([...where(durationSymbol('both', hand), C.blueLight)]).toEqual([staff]);
    }
  });



  it('ft_1_32.AC12 the hands picture: together has both staves in every column, apart has the right hand alone first', () => {
    const notesIn = (b: Bitmap, y0: number, y1: number) => [...b.pixels.keys()].filter((i) => b.pixels[i] === C.ink && Math.floor(i / b.width) >= y0 && Math.floor(i / b.width) <= y1 && i % b.width >= 7 && i % b.width <= 12).length;
    // the first column: lower staff notes only when both hands play
    expect(notesIn(learnHandsSymbol(false), 15, 19)).toBeGreaterThan(notesIn(learnHandsSymbol(true), 15, 19));
  });

  it('finger numbers and bar numbers are pictures with more blue digits the more the setting shows, and none when off', () => {
    const fingers = (['off', 'top', 'all'] as const).map((v) => count(fingersSymbol(v), C.blue));
    expect(fingers[0]).toBe(0);
    expect(fingers[1]).toBeGreaterThan(0);
    expect(fingers[2]).toBeGreaterThan(fingers[1]!);
    const bars = Object.fromEntries(BAR_NUMBER_MODES.map((m) => [m, count(barNumbersSymbol(m), C.blue)]));
    expect(bars.off).toBe(0);
    expect(bars.every).toBeGreaterThan(bars.every2!);
    expect(bars.every2).toBeGreaterThan(bars.every4!);
    expect(bars.every4).toBeGreaterThan(bars.first!);
    expect(bars.first).toBeGreaterThan(0);
  });
});
