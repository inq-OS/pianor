/** The rules for player names and how many players a device keeps (ft_1_07.AC10). Pure. */

/** The most players one device keeps; New player is not offered beyond it, and an import as a new player is refused. */
export const MAX_PLAYERS = 10;

/** Why a name cannot be used: empty, or another player already has it. */
export type PlayerNameProblem = 'blank' | 'taken';

/** The form two names are compared in: no outer spaces, one case. */
function nameKey(name: string): string {
  return name.trim().toLocaleUpperCase();
}

/** Why `name` cannot be a player's name next to `others` (the other players' names), or null when it can. */
export function playerNameProblem(name: string, others: readonly string[]): PlayerNameProblem | null {
  const key = nameKey(name);
  if (key === '') return 'blank';
  return others.some((other) => nameKey(other) === key) ? 'taken' : null;
}
