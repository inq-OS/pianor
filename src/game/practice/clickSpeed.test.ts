import { describe, expect, it } from 'vitest';
import { CLICK_MAX, CLICK_MIN, clickBpm } from '../../core/transport';

describe('click speed', () => {
  it('keeps the click between CLICK_MIN and CLICK_MAX', () => {
    expect(clickBpm(100, 100, 0)).toBe(100);
    expect(clickBpm(100, 30, -50)).toBe(CLICK_MIN);
    expect(clickBpm(180, 150, 0)).toBe(270);
    expect(clickBpm(400, 150, 0)).toBe(CLICK_MAX);
  });
});
