import { describe, expect, it } from 'vitest';
import { canvasSize, staffSpaceLimits } from './canvasSize';
import { frameView } from './frame';

describe('canvasSize', () => {
  it('draws the canvas in physical pixels: 1536x864 CSS pixels at 125% is the 1920x1080 screen', () => {
    expect(canvasSize(1536, 864, 1.25)).toEqual({ width: 1920, height: 1080, zoom: 0.8, offsetX: 0, offsetY: 0 });
    expect(canvasSize(1280, 720, 1.5)).toEqual({ width: 1920, height: 1080, zoom: 1 / 1.5, offsetX: 0, offsetY: 0 });
  });

  it('changes nothing without display scaling', () => {
    expect(canvasSize(1366, 768, 1)).toEqual({ width: 1366, height: 768, zoom: 1, offsetX: 0, offsetY: 0 });
  });

  it('rounds a fractional page size to whole physical pixels', () => {
    const size = canvasSize(1536, 760.8, 1.25);
    expect(size).toMatchObject({ width: 1920, height: 951 });
  });

  it('treats a missing or broken ratio as 1', () => {
    for (const ratio of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(canvasSize(1366, 768, ratio)).toEqual({ width: 1366, height: 768, zoom: 1, offsetX: 0, offsetY: 0 });
  });

  it('never makes an empty canvas', () => {
    expect(canvasSize(0, 0, 1.5)).toMatchObject({ width: 1, height: 1 });
  });

  it('keeps 3x on a 1920x1080 screen when the browser gives a full screen of only 1910 x 1070: the canvas stays 1920 x 1080, centred, and the edges are trimmed (d110)', () => {
    const size = canvasSize(1910, 1070, 1);
    expect(size).toEqual({ width: 1920, height: 1080, zoom: 1, offsetX: -5, offsetY: -5 });
    expect(frameView(size.width, size.height)).toMatchObject({ fine: 3, scale: 6 });
    // the same page at 125% scaling
    expect(canvasSize(1528, 856, 1.25)).toMatchObject({ width: 1920, height: 1080, offsetX: -5, offsetY: -5 });
    // one or two pixels short, at either edge
    expect(canvasSize(1918, 1080, 1)).toMatchObject({ width: 1920, height: 1080, offsetX: -1, offsetY: 0 });
  });

  it('trims at most two fine pixels a side; a page shorter than that falls to the next zoom, untrimmed (d110)', () => {
    expect(canvasSize(1908, 1068, 1)).toMatchObject({ width: 1920, height: 1080, offsetX: -6, offsetY: -6 });
    for (const [w, h] of [[1907, 1080], [1920, 1067], [1920, 925]] as const) {
      const size = canvasSize(w, h, 1);
      expect(size, `${w}x${h}`).toMatchObject({ width: w, height: h, offsetX: 0, offsetY: 0 });
      expect(frameView(size.width, size.height).fine, `${w}x${h}`).toBe(2);
    }
  });

  it('never trims a page that holds its zoom, nor a page too small to play (d110)', () => {
    for (const [w, h] of [[2560, 1440], [1366, 768], [3840, 2160], [600, 300]] as const) expect(canvasSize(w, h, 1)).toMatchObject({ width: w, height: h, offsetX: 0, offsetY: 0 });
    // just under 4x: trimmed up to it
    expect(canvasSize(2552, 1440, 1)).toMatchObject({ width: 2560, offsetX: -4 });
  });

  it('gives whole physical pixels per art pixel: 3x per fine pixel, 6x per cell on a 1920x1080 screen at 125%, 150% and 100% alike (d110)', () => {
    for (const [w, h, ratio] of [[1536, 864, 1.25], [1280, 720, 1.5], [1920, 1080, 1]] as const) {
      const size = canvasSize(w, h, ratio);
      expect(frameView(size.width, size.height)).toMatchObject({ fine: 3, scale: 6 });
    }
  });
});

describe('staffSpaceLimits', () => {
  it('keeps the staff as big on the screen as before: the 8 to 32 px range counts CSS pixels', () => {
    expect(staffSpaceLimits(1)).toEqual({ minStaffSpace: 8, maxStaffSpace: 32 });
    expect(staffSpaceLimits(0.8)).toEqual({ minStaffSpace: 10, maxStaffSpace: 40 });
  });

  it('treats a broken zoom as 1', () => {
    for (const zoom of [0, -1, Number.NaN]) expect(staffSpaceLimits(zoom)).toEqual({ minStaffSpace: 8, maxStaffSpace: 32 });
  });
});

