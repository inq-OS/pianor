// Covers ft_1_02d.AC6.
import { describe, expect, it } from 'vitest';
import { tempoLabel } from './tempoLabel';

describe('the tempo label', () => {
  it('shows the piece BPM alone at 100 percent (Wait mode too)', () => {
    expect(tempoLabel(80)).toBe('80 BPM');
    expect(tempoLabel(80, 100)).toBe('80 BPM');
  });
  it('adds the effective BPM when the tempo percent is not 100', () => {
    expect(tempoLabel(80, 50)).toBe('80 BPM (40)');
    expect(tempoLabel(90, 70)).toBe('90 BPM (63)');
  });
  it('rounds a fractional BPM', () => {
    expect(tempoLabel(79.6)).toBe('80 BPM');
  });
});
