/**
 * How a player likes to play: Wait mode (the cursor waits for the right key) or Tempo mode (the piece runs on the clock),
 * and how Tempo mode shows the score of each note. Saved per player (`core/progression`, profile version 4).
 */
import { z } from 'zod';

export const playSettingsSchema = z.object({
  mode: z.union([z.literal('wait'), z.literal('tempo')]),
  /** Tempo mode: nothing, each note coloured by its timing, or coloured with its score number beside it. */
  scoreView: z.union([z.literal('off'), z.literal('colour'), z.literal('number')]),
  /**
   * Tempo mode: how a play starts (core_01.AC10): any key starts a one-bar count-in, or the first note itself starts the
   * piece with no count-in. Optional, no version bump (d069.3): absent reads as the count-in.
   */
  tempoStart: z.enum(['anyKey', 'firstNote']).optional(),
  /**
   * Tempo mode: two bars in a row with nothing played right start the piece over and wait for the start again (core_01.AC11).
   * Optional, no version bump (d069.3): absent reads as off.
   */
  autoReset: z.boolean().optional(),
  /**
   * Tempo mode: the clock runs on whatever is played (`strict`), or follows the player (`follow`, core_01.AC12): it waits
   * for a late note and leans toward the pace played. Optional, no version bump (d069.3): absent reads as strict.
   */
  tempoClock: z.enum(['strict', 'follow']).optional(),
});

export type PlaySettings = z.infer<typeof playSettingsSchema>;

/** Wait mode stays the way to play until the player chooses Tempo (the MVP play mode); the colours are on when they do. */
export const DEFAULT_PLAY_SETTINGS: PlaySettings = { mode: 'wait', scoreView: 'colour' };

/**
 * The practice screen's one cycling mode button (the clean-screen rule), from the most forgiving to the strictest:
 * Wait, the following clock (core_01.AC12, started by the first note), Tempo with a count-in, Tempo started by the first
 * note (core_01.AC10), then Wait again.
 */
export type PlayChoice = 'wait' | 'follow' | 'tempo' | 'tempoFirstNote';

type ChoiceSettings = Pick<PlaySettings, 'mode' | 'tempoStart' | 'tempoClock'>;

export function playChoiceOf(settings: ChoiceSettings): PlayChoice {
  if (settings.mode === 'wait') return 'wait';
  if (settings.tempoClock === 'follow') return 'follow';
  return settings.tempoStart === 'firstNote' ? 'tempoFirstNote' : 'tempo';
}

/** Tempo mode with the clock that follows the player (core_01.AC12). */
export function followsPlayer(settings: Pick<PlaySettings, 'mode' | 'tempoClock'>): boolean {
  return settings.mode === 'tempo' && settings.tempoClock === 'follow';
}

/** The choices in the order the button cycles them, as the mode menu lists them (ft_1_20, d282). */
export const PLAY_CHOICES: readonly PlayChoice[] = ['wait', 'follow', 'tempo', 'tempoFirstNote'];

/** The settings that read back as `choice`: what a pick in the mode menu saves. */
export function choiceSettings(choice: PlayChoice): Required<ChoiceSettings> {
  switch (choice) {
    case 'wait': return { mode: 'wait', tempoStart: 'firstNote', tempoClock: 'strict' };
    case 'follow': return { mode: 'tempo', tempoStart: 'firstNote', tempoClock: 'follow' };
    case 'tempo': return { mode: 'tempo', tempoStart: 'anyKey', tempoClock: 'strict' };
    case 'tempoFirstNote': return { mode: 'tempo', tempoStart: 'firstNote', tempoClock: 'strict' };
  }
}

/** The settings the button's next press saves. */
export function nextPlayChoice(settings: ChoiceSettings): Required<ChoiceSettings> {
  const at = PLAY_CHOICES.indexOf(playChoiceOf(settings));
  return choiceSettings(PLAY_CHOICES[(at + 1) % PLAY_CHOICES.length]!);
}
