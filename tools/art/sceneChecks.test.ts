import { describe, expect, it } from 'vitest';
import { bandedFindings, cloudFindings, cloudShape, coarseDither, idleRuns, limitsFor, runFindings, runsDeclared, runShare, SCENE_RULES, useFindings } from './sceneChecks';

/** A cloud bitmap from rows of text: '#' is cloud, '.' clear sky. */
function cloud(rows: string[]): { width: number; height: number; pixels: Uint8Array } {
  const width = rows[0]!.length;
  const pixels = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') pixels[y * width + x] = 2; }));
  return { width, height: rows.length, pixels };
}

describe('cloudShape', () => {
  it('measures length to height, head to tail and where the head sits, from the painted pixels', () => {
    // a thin tail on the left that rolls up into a fat head at the right end
    const s = cloudShape(cloud([
      '..............####..',
      '.............######.',
      '######......########',
      '####################',
      '..........##########',
      '.............######.',
    ]));
    expect(s.width).toBe(20);
    expect(s.height).toBe(6);
    expect(s.aspect).toBeCloseTo(20 / 6, 6);
    expect(s.headOverTail).toBeGreaterThanOrEqual(2);
    expect(s.headAt).toBeGreaterThan(0.75);
  });

  it('ignores clear rows and columns round the cloud', () => {
    const s = cloudShape(cloud(['......', '.###..', '......']));
    expect(s.width).toBe(3);
    expect(s.height).toBe(1);
  });

  it('refuses an empty bitmap', () => {
    expect(() => cloudShape(cloud(['...']))).toThrow(/no cloud/);
  });
});

describe('cloudFindings', () => {
  const headed = { width: 60, height: 20, aspect: 3, headOverTail: 4, headAt: 0.9 };

  it('passes a cloud with a head inside the measured ranges', () => {
    expect(cloudFindings([headed])).toEqual([]);
  });

  it('takes a streak (length 7 times its height or more) as its own class', () => {
    expect(cloudFindings([{ width: 70, height: 6, aspect: 11.7, headOverTail: 1.2, headAt: 0.5 }])).toEqual([]);
    expect(cloudFindings([{ width: 200, height: 6, aspect: 33, headOverTail: 1.2, headAt: 0.5 }])[0]).toMatch(/streak/);
  });

  it('flags a head in the middle of the stroke, a head too thin or too fat, and a cloud too round', () => {
    expect(cloudFindings([{ ...headed, headAt: 0.5 }])[0]).toMatch(/head sits at 0.50/);
    expect(cloudFindings([{ ...headed, headOverTail: 1.4 }])[0]).toMatch(/head is 1.4/);
    expect(cloudFindings([{ ...headed, headOverTail: 12 }])[0]).toMatch(/head is 12.0/);
    expect(cloudFindings([{ ...headed, aspect: 1.2 }])[0]).toMatch(/1.2:1/);
  });

  it('does not place the head of a fat heap (under 3 times as long as high): its bulk sits near the middle', () => {
    expect(cloudFindings([{ ...headed, aspect: 2.3, headAt: 0.38 }])).toEqual([]);
  });

  it('flags two clouds of one sky that share their proportions', () => {
    const twin = { ...headed, aspect: 3.1, headOverTail: 4.2 };
    expect(cloudFindings([headed, twin]).join(' ')).toMatch(/clouds 1 and 2/);
    expect(cloudFindings([headed, { ...headed, aspect: 4.5 }])).toEqual([]);
  });
});

describe('runFindings', () => {
  it('passes a long material run whose hue turns towards yellow as it lightens, saturated in the middle', () => {
    // red-brown to orange-tan, as the wood of Monkey Island 2
    const wood = [0x2a100c, 0x3c1610, 0x501e14, 0x642818, 0x78321c, 0x8c3e22, 0xa04c2a, 0xb05e38, 0xbc7448, 0xc88c60];
    expect(runFindings('wood', wood, 'material')).toEqual([]);
  });

  it(`flags a step over ${SCENE_RULES.maxStep} L*, a run that turns away from the light's hue, and a saturated light end`, () => {
    const posterised = [0x123a22, 0x4e9a3e, 0xc0e070];
    expect(runFindings('grass', posterised, 'material').join(' ')).toMatch(/step/);
    // blue-green light end turning away from yellow
    const wrongWay = [0x405a10, 0x3a7030, 0x349060, 0x30b0a0];
    expect(runFindings('grass', wrongWay, 'material').join(' ')).toMatch(/turns away/);
    const loudEnd = [0x403028, 0x706048, 0xa09060, 0xffe000];
    expect(runFindings('straw', loudEnd, 'material').join(' ')).toMatch(/most saturated/);
  });

  it('checks only the steps of a sky, and nothing of a grey run but its steps', () => {
    const sky = [0x3a78c8, 0x5294dc, 0x74b0ea, 0x9ccaf4, 0xc8e4fa];
    expect(runFindings('sky', sky, 'sky')).toEqual(['sky: step of 10.0 L* (colours 2 to 3); at most 8']);
    const stone = [0x2e2a32, 0x3a363e, 0x46424a, 0x524e56, 0x5e5a62];
    expect(runFindings('stone', stone, 'material')).toEqual([]);
  });

  it('allows half a unit of rounding over the step, and leaves the highlight of a near-grey run alone', () => {
    expect(runFindings('smoke', [0x8e8a8c, 0xa4a0a2], 'material')).toEqual([]); // a step of 8.4
    const shingle = [0x6e6a68, 0x8a847e, 0xa49e94, 0xbcb6aa, 0xd0caba, 0xe2dccc];
    expect(runFindings('shingle', shingle, 'material').join(' ')).not.toMatch(/most saturated/);
  });

  it('says nothing of a run of one colour', () => {
    expect(runFindings('ink', [0x100c16], 'material')).toEqual([]);
  });
});

describe('how a picture uses its palette', () => {
  // place 0 is clear; a grey run of small steps at 1 to 4, a far pale tone at 5, a loose red at 6
  const palette = [0x000000, 0x404040, 0x4c4c4c, 0x585858, 0x646464, 0xf0f0f0, 0xc02020];
  const runs = { grey: [1, 2, 3, 4] };
  const picture = (width: number, rows: number[][]): { width: number; height: number; pixels: Uint8Array } => ({ width, height: rows.length, pixels: Uint8Array.from(rows.flat()) });

  it('the runs a picture names are sound: two colours or more, inside the palette, no colour twice, no place in two runs', () => {
    expect(runsDeclared(runs, palette)).toEqual([]);
    expect(runsDeclared({ one: [1] }, palette)).toEqual(['one: a run has two colours or more']);
    expect(runsDeclared({ out: [1, 9] }, palette)).toEqual(['out: a place outside the palette']);
    expect(runsDeclared({ clear: [0, 1] }, palette)).toEqual(['clear: a place outside the palette']);
    expect(runsDeclared({ twice: [1, 2] }, [0, 0x404040, 0x404040])).toEqual(['twice: the same colour twice']);
    expect(runsDeclared({ a: [1, 2], b: [2, 3] }, palette)).toEqual(['b: shares a place with a']);
  });

  it('the share painted from the runs counts painted pixels only', () => {
    expect(runShare(Uint8Array.from([1, 2, 3, 6]), runs)).toBe(0.75);
    expect(runShare(Uint8Array.from([0, 0, 1, 6]), runs)).toBe(0.5);
    expect(runShare(Uint8Array.from([0, 0]), runs)).toBe(0);
  });

  it('a checkerboard of two far tones is coarse dither; one of two near tones, a flat patch and stripes are not', () => {
    expect(coarseDither(picture(2, [[1, 5], [5, 1]]), palette)).toBe(1);
    expect(coarseDither(picture(2, [[1, 2], [2, 1]]), palette)).toBe(0);
    expect(coarseDither(picture(2, [[1, 1], [1, 1]]), palette)).toBe(0);
    expect(coarseDither(picture(2, [[1, 5], [1, 5]]), palette)).toBe(0);
    expect(coarseDither(picture(3, [[1, 5, 1], [5, 1, 1]]), palette)).toBe(0.5);
    expect(coarseDither(picture(1, [[1], [5]]), palette)).toBe(0);
  });

  it('a picture is painted mostly from its runs, without coarse dither, with a palette of one byte', () => {
    const flat = picture(4, [[1, 2, 3, 4], [2, 3, 4, 1], [1, 1, 2, 2], [3, 3, 4, 4]]);
    expect(useFindings(flat, palette, runs)).toEqual([]);
    const loose = picture(4, [[6, 6, 6, 6], [6, 6, 6, 6], [1, 1, 2, 2], [3, 3, 4, 4]]);
    expect(useFindings(loose, palette, runs)).toEqual([`50% of the picture is painted from its runs; at least ${100 * SCENE_RULES.runShare}%`]);
    const coarse = picture(2, [[1, 5], [5, 1]]);
    expect(useFindings(coarse, palette, { grey: [1, 2, 3, 4, 5] })).toEqual([`100.0% of the picture is a checkerboard of two far tones; at most ${100 * SCENE_RULES.coarseDither}% (make the run longer)`]);
    expect(useFindings(picture(2, [[1, 9], [1, 1]]), palette, runs)[0]).toBe('a pixel has a colour outside the palette');
    expect(useFindings(flat, Array.from({ length: 300 }, (_, i) => i * 0x010101), runs)[0]).toBe('the palette has 300 colours; a picture has 256 at most');
  });

  it('a banded picture (a lit set) is held to short runs and strong dither, and is told when its runs have all gone long', () => {
    expect(limitsFor(true)).toEqual({ step: SCENE_RULES.bandedStep, dither: SCENE_RULES.bandedDither });
    expect(limitsFor(undefined)).toEqual({ step: SCENE_RULES.maxStep, dither: SCENE_RULES.coarseDither });
    // greys 12 L* apart: too coarse for a painted picture, right for a banded one
    const coarse = [0x303030, 0x4c4c4c, 0x6a6a6a];
    expect(runFindings('grey', coarse, 'material')).toHaveLength(1);
    expect(runFindings('grey', coarse, 'material', SCENE_RULES.bandedStep)).toEqual([]);
    expect(runFindings('grey', [0x101010, 0x6a6a6a], 'material', SCENE_RULES.bandedStep)[0]).toContain(`at most ${SCENE_RULES.bandedStep}`);
    expect(bandedFindings([coarse, [0x404040, 0x4c4c4c]])).toEqual([]);
    expect(bandedFindings([[0x404040, 0x4c4c4c, 0x585858], [0x808080]])[0]).toContain('looks 3D');
    // the dither limit is the caller's: a checkerboard of far tones passes a limit of 1 and fails the default
    const board = picture(2, [[1, 5], [5, 1]]);
    expect(useFindings(board, palette, { grey: [1, 2, 3, 4, 5] }, 1)).toEqual([]);
  });

  it('a run of which too few colours are used is idle; one that is never used is idle whatever the share asked', () => {
    const two = { grey: [1, 2, 3, 4], pale: [5, 6] };
    expect(idleRuns(two, new Set([1, 2, 5]), 0.5)).toEqual([]);
    expect(idleRuns(two, new Set([1, 5]), 0.5)).toEqual(['grey: 1 of its 4 colours are used']);
    expect(idleRuns(two, new Set([1]), 0)).toEqual(['pale: 0 of its 2 colours are used']);
  });
});
