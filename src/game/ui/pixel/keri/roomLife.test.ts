import { describe, expect, it } from 'vitest';
import { PORTRAIT_MAX, SHIELD_FINE } from '../../../../core/layout/room';
import { fromAscii, inkCount } from '../bitmap';
import { C } from '../palette';
import { RANK_COUNT } from '../rankArt';
import { KIUR_FRAMES, METRONOME_FRAMES, METRONOME_SIZE, NOTE_PLANT, PLANT_STAGES, PLANT_STAGE_COUNT, plantStage, KIUR_ZZZ, KIUR_ZZZ_FROM, ROOM_PORTRAIT, STEAM_SIZE, metronomeFrame, roomArt, steamTones } from './roomLife';

const count = (pixels: Uint8Array, colour: number) => pixels.filter((p) => p === colour).length;

describe('the living things of the room (ft_1_08.AC9)', () => {
  it('ft_1_08.AC9 the steam is not painted in frames: the mug carries only its two colours, on its mouth, for the game to draw the wisps in', () => {
    const tones = steamTones();
    expect([tones.width, tones.height]).toEqual([STEAM_SIZE.w, STEAM_SIZE.h]);
    const mid = Math.floor(STEAM_SIZE.w / 2);
    expect(tones.pixels[(STEAM_SIZE.h - 1) * STEAM_SIZE.w + mid]).toBe(C.white);
    expect(tones.pixels[(STEAM_SIZE.h - 2) * STEAM_SIZE.w + mid]).toBe(C.silver);
    expect(count(tones.pixels, C.clear)).toBe(tones.pixels.length - 2);
  });

  it('ft_1_08.AC9 the metronome swings left, middle, right, middle on the same body', () => {
    const frames = [...Array(METRONOME_FRAMES).keys()].map(metronomeFrame);
    for (const frame of frames) expect([frame.width, frame.height]).toEqual([METRONOME_SIZE.w, METRONOME_SIZE.h]);
    expect(frames[1]!.pixels).toEqual(frames[3]!.pixels);
    expect(frames[0]!.pixels).not.toEqual(frames[2]!.pixels);
    const goldAt = (b: { pixels: Uint8Array }) => [...b.pixels].findIndex((p) => p === C.gold) % METRONOME_SIZE.w;
    expect(goldAt(frames[0]!)).toBeLessThan(goldAt(frames[1]!));
    expect(goldAt(frames[2]!)).toBeGreaterThan(goldAt(frames[1]!));
    for (const frame of frames) expect(count(frame.pixels, C.ink)).toBe(count(frames[0]!.pixels, C.ink));
  });

  it('ft_1_08.AC9 the note plant uses the vine\'s leaf colours and a clay pot', () => {
    for (const colour of [C.leafLight, C.leaf, C.leafDark, C.orange]) expect(count(NOTE_PLANT.pixels, colour)).toBeGreaterThan(2);
  });

  it('ft_1_20.AC13 the note plant grows with the XP of the level: one size of frame, more of the plant and no smaller pot in each stage', () => {
    expect(PLANT_STAGES).toHaveLength(PLANT_STAGE_COUNT);
    const ink = (b: { pixels: Uint8Array | number[] }) => [...b.pixels].filter((v) => v !== 0).length;
    for (const stage of PLANT_STAGES) expect([stage.width, stage.height]).toEqual([NOTE_PLANT.width, NOTE_PLANT.height]);
    for (let i = 1; i < PLANT_STAGES.length; i++) expect(ink(PLANT_STAGES[i]!)).toBeGreaterThan(ink(PLANT_STAGES[i - 1]!));
    expect(PLANT_STAGES[PLANT_STAGES.length - 1]).toEqual(NOTE_PLANT);
    expect(count(PLANT_STAGES[0]!.pixels, C.orange)).toBe(count(NOTE_PLANT.pixels, C.orange));
    expect(plantStage(0)).toBe(0);
    expect(plantStage(0.49)).toBe(Math.floor(0.49 * (PLANT_STAGE_COUNT - 1)));
    expect(plantStage(1)).toBe(PLANT_STAGE_COUNT - 1);
    expect(plantStage(1.5)).toBe(PLANT_STAGE_COUNT - 1);
  });

  it('ft_1_08.AC9 ft_1_18.AC3 Kiur sleeps in two frames of one size: breathing in he is rounder and taller; the "z" is not in his frames, only its colours where it leaves his head', () => {
    const [out, breathIn] = KIUR_FRAMES;
    expect([breathIn.width, breathIn.height]).toEqual([out.width, out.height]);
    const feathers = (b: typeof out) => count(b.pixels, C.umber) + count(b.pixels, C.umberDark) + count(b.pixels, C.buff) + count(b.pixels, C.down);
    expect(feathers(breathIn)).toBeGreaterThan(feathers(out));
    for (const frame of KIUR_FRAMES) expect(count(frame.pixels, C.white) + count(frame.pixels, C.silver)).toBe(0);
    expect([KIUR_ZZZ.width, KIUR_ZZZ.height]).toEqual([out.width, out.height]);
    expect(KIUR_ZZZ.pixels[KIUR_ZZZ_FROM.y * KIUR_ZZZ.width + KIUR_ZZZ_FROM.x]).toBe(C.white);
    expect(KIUR_ZZZ.pixels[KIUR_ZZZ_FROM.y * KIUR_ZZZ.width + KIUR_ZZZ_FROM.x + 1]).toBe(C.silver);
    // Kiur sits at the bottom of both frames, on the same feet, with no line round him (nothing in the painted room has one)
    const lastRow = (b: typeof out) => b.pixels.subarray((b.height - 1) * b.width);
    expect(count(lastRow(out), C.clear)).toBeLessThan(out.width);
    expect(lastRow(breathIn)).toEqual(lastRow(out));
    for (const frame of KIUR_FRAMES) expect(count(frame.pixels, C.featherInk) + count(frame.pixels, C.ink)).toBe(0);
  });

  it('ft_1_08.AC10 ft_1_09.AC3 the room takes its art on the fine grid: the drawn portrait fits the wall, a private one replaces it, a shield for every rank', () => {
    const art = roomArt(null);
    expect(art.portrait.width).toBe(ROOM_PORTRAIT.width * 2);
    expect(art.portrait.width).toBeLessThanOrEqual(PORTRAIT_MAX.w);
    expect(art.portrait.height).toBeLessThanOrEqual(PORTRAIT_MAX.h);
    // a face and a beard inside a frame
    for (const colour of [C.skin, C.white, C.goldDark]) expect(count(ROOM_PORTRAIT.pixels, colour)).toBeGreaterThan(4);
    const own = fromAscii(['aaaa', 'aaaa'], { a: C.gold });
    expect(roomArt(own).portrait).toBe(own);
    expect(art.shields).toHaveLength(RANK_COUNT);
    for (const shield of art.shields) {
      expect(shield.width).toBeLessThanOrEqual(SHIELD_FINE);
      expect(shield.height).toBeLessThanOrEqual(SHIELD_FINE);
      expect(inkCount(shield)).toBeGreaterThan(200);
    }
    expect(new Set(art.shields.map((s) => s.pixels.join())).size).toBe(RANK_COUNT);
    expect([art.kiur.length, art.steam.length, art.metronome.length]).toEqual([2, 1, METRONOME_FRAMES]);
  });
});
