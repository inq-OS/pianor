// Covers ft_1_07.AC10.
import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, playerNameProblem } from './playerNames';

describe('player names and the player limit (ft_1_07.AC10)', () => {
  it('ft_1_07.AC10 allows at most 10 players on a device', () => {
    expect(MAX_PLAYERS).toBe(10);
  });

  it('ft_1_07.AC10 refuses a blank name', () => {
    expect(playerNameProblem('', [])).toBe('blank');
    expect(playerNameProblem('   ', ['TUVI'])).toBe('blank');
  });

  it('ft_1_07.AC10 refuses a name another player has, whatever its case or spaces', () => {
    expect(playerNameProblem('TUVI', ['TUVI', 'VINT'])).toBe('taken');
    expect(playerNameProblem(' tuvi ', ['TUVI'])).toBe('taken');
    expect(playerNameProblem('PÄÄSU', ['pääsu'])).toBe('taken');
  });

  it('ft_1_07.AC10 accepts a new name', () => {
    expect(playerNameProblem('KAI', ['TUVI', 'VINT'])).toBeNull();
    expect(playerNameProblem('TUVIS', ['TUVI'])).toBeNull();
  });
});
