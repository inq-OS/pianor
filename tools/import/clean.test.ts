import { encode as encodePng } from 'fast-png';
import { encode as encodeJpeg } from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import {
  TARGET_INTERLINE,
  blank,
  cleanImageFile,
  cleanSheet,
  decodeJpegGray,
  decodePngGray,
  evenLight,
  exifOrientation,
  findStaves,
  grayOf,
  implausible,
  inkLevel,
  inkOnly,
  photoLayout,
  mapPoint,
  solveHomography,
  staffCorners,
  stavesAt,
  straighten,
  traceLine,
  upright,
  warp,
  type Gray,
  type Point,
} from './clean';

/** A synthetic picture: black where `ink(x, y)` holds. */
function paint(width: number, height: number, ink: (x: number, y: number) => boolean): Gray {
  const img = blank(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (ink(x + 0.5, y + 0.5)) img.data[y * width + x] = 0;
  return img;
}

/**
 * A synthetic sheet in its own flat coordinates: staves of five lines `space` apart from x 40 to 560, bar lines at
 * 40, 300 and 560 joining each pair of staves, a note head on the middle line of each staff.
 */
function sheetInk(staffTops: readonly number[], space: number): (x: number, y: number) => boolean {
  return (x, y) => {
    if (x < 40 || x > 560) return false;
    for (const top of staffTops) {
      for (let l = 0; l < 5; l++) if (Math.abs(y - (top + l * space)) < 1.2) return true;
      if (Math.hypot((x - 200) / 1.3, y - (top + 2 * space)) < space / 2) return true;
    }
    for (let s = 0; s + 1 < staffTops.length; s += 2) {
      const top = staffTops[s] ?? 0;
      const bottom = (staffTops[s + 1] ?? 0) + 4 * space;
      if (y >= top && y <= bottom && [40, 300, 560].some((b) => Math.abs(x - b) < 1.5)) return true;
    }
    return false;
  };
}

describe('photo cleaning (ft_Y_04.AC15)', () => {
  it('turns colour and grey samples of any depth into grey', () => {
    expect([...grayOf(2, 1, [255, 0, 0, 255, 0, 0, 255, 255], 4).data]).toEqual([76, 29]);
    expect([...grayOf(2, 1, [65535, 0], 1, 65535).data]).toEqual([255, 0]);
    // see-through black is paper
    expect([...grayOf(2, 1, [0, 0, 0, 255], 2).data]).toEqual([255, 0]);
    expect([...grayOf(1, 1, [0, 0, 0, 0], 4).data]).toEqual([255]);
  });

  it('decodes PNG files of 1, 8 and 16 bits and with a palette', () => {
    const one = decodePngGray(encodePng({ width: 10, height: 2, data: new Uint8Array([0b10100000, 0b01000000, 0xff, 0xc0]), channels: 1, depth: 1 }));
    expect([...one.data.subarray(0, 4)]).toEqual([255, 0, 255, 0]);
    expect([...one.data.subarray(10, 13)]).toEqual([255, 255, 255]);
    const sixteen = decodePngGray(encodePng({ width: 1, height: 1, data: new Uint16Array([65535]), channels: 1, depth: 16 }));
    expect([...sixteen.data]).toEqual([255]);
    const palette = decodePngGray(encodePng({ width: 2, height: 1, data: new Uint8Array([0, 1]), channels: 1, depth: 8, palette: [[255, 255, 255], [0, 0, 0]] }));
    expect([...palette.data]).toEqual([255, 0]);
  });

  it('reads the EXIF orientation of a JPEG and turns the picture upright', () => {
    const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0];
    const app1 = [0xff, 0xe1, 0, 2 + 6 + tiff.length, ...[...'Exif'].map((c) => c.charCodeAt(0)), 0, 0, ...tiff];
    expect(exifOrientation(new Uint8Array([0xff, 0xd8, ...app1, 0xff, 0xda, 0, 2]))).toBe(6);
    expect(exifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(1);
    const img: Gray = { width: 2, height: 1, data: new Uint8Array([10, 20]) };
    expect(upright(img, 1)).toBe(img);
    expect([...upright(img, 3).data]).toEqual([20, 10]);
    expect(upright(img, 6)).toMatchObject({ width: 1, height: 2, data: new Uint8Array([10, 20]) });
    expect(upright(img, 8)).toMatchObject({ width: 1, height: 2, data: new Uint8Array([20, 10]) });
  });

  it('decodes a JPEG to grey', () => {
    const rgba = new Uint8Array(16 * 16 * 4).fill(255);
    const jpeg = encodeJpeg({ width: 16, height: 16, data: rgba }, 90).data;
    const img = decodeJpegGray(new Uint8Array(jpeg));
    expect(img.width).toBe(16);
    expect(Math.min(...img.data)).toBeGreaterThan(240);
  });

  it('evens the light, so ink keeps its darkness against dim paper and pencil drops out', () => {
    // paper falling from white on the left to half grey on the right, an ink dot and a pencil dot in the dim half
    const img = blank(200, 100);
    for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) img.data[y * 200 + x] = Math.round(255 - x * 0.64);
    img.data[50 * 200 + 150] = 10;
    img.data[50 * 200 + 160] = 70;
    const even = evenLight(img, 16);
    expect(even.data[50 * 200 + 120]).toBeGreaterThan(225);
    const ink = inkOnly(even);
    expect(ink.data[50 * 200 + 150]).toBe(0);
    expect(ink.data[50 * 200 + 160]).toBe(255);
    expect(ink.data[10 * 200 + 10]).toBe(255);
  });

  it('finds the five lines of each staff and not the note heads', () => {
    const img = paint(600, 300, sheetInk([60, 160], 10));
    const staves = stavesAt(img, 120);
    expect(staves.map((s) => s.lines.map(Math.round))).toEqual([[60, 70, 80, 90, 100], [160, 170, 180, 190, 200]]);
    expect(staves[0]?.interline).toBeCloseTo(10, 0);
    expect(stavesAt(img, 20)).toEqual([]);
  });

  it('follows a tilted staff line through a note head to its ends', () => {
    const img = paint(600, 120, (x, y) => (x > 40 && x < 560 && Math.abs(y - (40 + x * 0.03)) < 1.2) || Math.hypot(x - 300, y - 49) < 5);
    const right = traceLine(img, 100, 43, 1, 10);
    const left = traceLine(img, 100, 43, -1, 10);
    expect(right.at(-1)?.x).toBeGreaterThan(555);
    expect(right.at(-1)?.y).toBeCloseTo(40 + 559 * 0.03, 0);
    expect(left.at(-1)?.x).toBeLessThan(45);
  });

  it('solves the homography of four points and maps through it', () => {
    const from: Point[] = [{ x: 10, y: 20 }, { x: 300, y: 5 }, { x: 320, y: 220 }, { x: 0, y: 200 }];
    const to: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];
    const h = solveHomography(from, to);
    for (let i = 0; i < 4; i++) {
      const p = mapPoint(h, from[i] ?? { x: 0, y: 0 });
      expect(p.x).toBeCloseTo(to[i]?.x ?? 0, 6);
      expect(p.y).toBeCloseTo(to[i]?.y ?? 0, 6);
    }
    expect(() => solveHomography([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], to)).toThrow();
  });

  it('warps through a mapping, white outside the source', () => {
    const img = paint(4, 4, (x) => x < 2);
    const same = warp(img, [1, 0, 0, 0, 1, 0, 0, 0, 1], 6, 4);
    expect(same.data[0]).toBeLessThan(128);
    expect(same.data[3]).toBe(255);
    expect(same.data[5]).toBe(255);
  });

  it('straightens a sheet photographed at an angle: level staves, even spacing, upright bar lines, a staff space of 24', () => {
    // the flat sheet seen through a perspective: the right edge nearer (bigger) and the page turned a little
    const flat = sheetInk([100, 190, 330, 420], 12);
    const flatCorners: Point[] = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }, { x: 0, y: 600 }];
    const photoCorners: Point[] = [{ x: 30, y: 40 }, { x: 760, y: 10 }, { x: 790, y: 760 }, { x: 10, y: 700 }];
    const toFlat = solveHomography(photoCorners, flatCorners);
    const photo = paint(800, 800, (x, y) => {
      const p = mapPoint(toFlat, { x, y });
      return flat(p.x, p.y);
    });
    const traced = findStaves(photo);
    expect(traced).toHaveLength(4);
    expect(staffCorners(traced)).toHaveLength(4);
    const { image, note } = straighten(photo);
    expect(note).toContain('4 staves found');
    const again = findStaves(image);
    expect(again).toHaveLength(4);
    for (const t of again) {
      expect(t.staff.interline).toBeGreaterThan(TARGET_INTERLINE - 1.5);
      expect(t.staff.interline).toBeLessThan(TARGET_INTERLINE + 1.5);
      const first = t.top[0];
      const last = t.top.at(-1);
      expect(Math.abs((first?.y ?? 0) - (last?.y ?? 99))).toBeLessThan(3);
      // the left ends of all staves in one column: the bar lines upright
      expect(Math.abs((first?.x ?? 0) - (again[0]?.top[0]?.x ?? 99))).toBeLessThan(3);
    }
  });

  it('says when it found no staff, and then the photo is not replaced', () => {
    const { note, straightened } = cleanSheet(blank(100, 80, 200));
    expect(note).toContain('no staff found');
    expect(straightened).toBe(false);
  });

  it('keeps a faint print whole: the ink level follows the darkest ink when there is no black', () => {
    const faint = paint(600, 300, sheetInk([60, 160], 10));
    for (let i = 0; i < faint.data.length; i++) if (faint.data[i] === 0) faint.data[i] = 120;
    const cleaned = cleanSheet(faint);
    expect(cleaned.straightened).toBe(true);
    expect(cleaned.image.data.reduce((a, b) => Math.min(a, b), 255)).toBeLessThan(64);
    expect(inkLevel(paint(100, 100, (x) => x < 10))).toBe(0.38);
    expect(inkLevel(faint)).toBeCloseTo((120 + 255) / 2 / 255, 2);
  });

  it('keeps a staff whose lines are broken as one staff', () => {
    const whole = sheetInk([60, 160], 10);
    // a break of a staff space and a half is followed across; a longer one still leaves one staff, not two
    expect(findStaves(paint(600, 300, (x, y) => whole(x, y) && !(x > 230 && x < 290)))).toHaveLength(2);
    const img = paint(600, 300, (x, y) => whole(x, y) && !(x > 230 && x < 245));
    const found = findStaves(img);
    expect(found).toHaveLength(2);
    expect(found[0]?.top[0]?.x).toBeLessThan(45);
    expect(found[0]?.top.at(-1)?.x).toBeGreaterThan(555);
    expect(found[0]?.top).toHaveLength((found[0]?.top.at(-1)?.x ?? 0) - (found[0]?.top[0]?.x ?? 0) + 1);
  });

  it('finds and straightens a page turned 10 degrees', () => {
    const flat = sheetInk([100, 190, 330, 420], 12);
    const turn = (10 * Math.PI) / 180;
    const photo = paint(800, 800, (x, y) => {
      const dx = x - 400;
      const dy = y - 400;
      return flat(300 + dx * Math.cos(turn) + dy * Math.sin(turn), 300 - dx * Math.sin(turn) + dy * Math.cos(turn));
    });
    const { image, straightened } = cleanSheet(photo);
    expect(straightened).toBe(true);
    const again = findStaves(image);
    expect(again).toHaveLength(4);
    for (const t of again) expect(Math.abs((t.top[0]?.y ?? 0) - (t.top.at(-1)?.y ?? 99))).toBeLessThan(3);
  });

  it('refuses corners that cannot be a page of staves', () => {
    const square: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    expect(implausible(square, 1, 1e4)).toBeUndefined();
    expect(implausible([{ x: Number.NaN, y: 0 }, ...square.slice(1)], 1, 1e4)).toContain('did not meet');
    expect(implausible([square[0], square[2], square[1], square[3]] as Point[], 1, 1e4)).toContain('four-sided');
    expect(implausible([{ x: 0, y: 0 }, { x: 100, y: 40 }, { x: 100, y: 140 }, { x: 0, y: 100 }], 1, 1e4)).toContain('turned');
    expect(implausible(square, 5, 1e4)).toContain('staff space');
    expect(implausible(square, 1, 5e7)).toContain('too big');
  });

  it('cleans PNG and JPEG files and leaves other files to Audiveris', () => {
    const png = encodePng({ width: 8, height: 8, data: new Uint8Array(64).fill(255), channels: 1, depth: 8 });
    expect(cleanImageFile('sheet.PNG', png)).toMatchObject({ note: expect.stringContaining('no staff found') as unknown });
    expect(cleanImageFile('sheet.PNG', png)?.png).toBeUndefined();
    const jpeg = encodeJpeg({ width: 8, height: 8, data: new Uint8Array(256).fill(255) }, 90).data;
    expect(cleanImageFile('sheet.jpeg', new Uint8Array(jpeg))?.png).toBeUndefined();
    const sheet = paint(600, 300, sheetInk([60, 160], 10));
    expect(cleanImageFile('sheet.png', encodePng({ width: 600, height: 300, data: sheet.data, channels: 1, depth: 8 }))?.png).toBeInstanceOf(Uint8Array);
    expect(cleanImageFile('sheet.pdf', new Uint8Array())).toBeUndefined();
  });
});

describe('the bar map of a cleaned photo (ft_Y_04.AC16)', () => {
  it('ft_Y_04.AC16 finds the systems and their bars from the bar lines both staves share, not from stems', () => {
    // two systems of two staves; bar lines at 40, 300 and 560 join each pair; a stem of a staff's height at 150 is no bar line
    const flat = sheetInk([100, 190, 330, 420], 12);
    const img = paint(600, 600, (x, y) => flat(x, y) || (Math.abs(x - 150) < 1 && y >= 100 && y <= 148));
    const cleaned = cleanSheet(img);
    expect(cleaned.staves).toHaveLength(4);
    const layout = photoLayout(cleaned.image, cleaned.staves, 2);
    expect(layout.systems).toHaveLength(2);
    for (const system of layout.systems) {
      expect(system.staves).toHaveLength(2);
      expect(system.bars).toHaveLength(2);
      const [first, second] = system.bars;
      expect(Math.abs((first?.x2 ?? 0) - (second?.x1 ?? 0))).toBeLessThan(1);
      expect(((first?.x2 ?? 0) - (first?.x1 ?? 0)) / ((second?.x2 ?? 0) - (second?.x1 ?? 1))).toBeCloseTo(1, 1);
    }
    // one staff a system: four systems
    expect(photoLayout(cleaned.image, cleaned.staves, 1).systems).toHaveLength(4);
  });
});
