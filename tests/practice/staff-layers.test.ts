// Covers ft_1_11.AC5.
import { describe, expect, it } from 'vitest';
import { STAFF_LAYERS } from '../../src/game/ui/staff/layers';

describe('the staff draw order', () => {
  it('draws the paper, then the highlight boxes and the duration helper, then the staff lines, the notes and the playhead (ft_1_11.AC5)', () => {
    expect([...STAFF_LAYERS]).toEqual(['paper', 'highlight', 'duration', 'lines', 'notes', 'playhead']);
    expect(STAFF_LAYERS.indexOf('duration')).toBeLessThan(STAFF_LAYERS.indexOf('lines'));
    expect(STAFF_LAYERS.indexOf('highlight')).toBeLessThan(STAFF_LAYERS.indexOf('lines'));
  });
});
