/**
 * Whether the on-screen piano is shown on the practice screen (ft_Y_12). Off leaves the space the keys took empty; the keys
 * keep working (the EZ-220, the computer keyboard and the virtual player), only the drawing goes. Saved per player
 * (`core/progression`, profile version 9). On is the default, so nothing changes until the player chooses.
 */
import { z } from 'zod';

export const keyboardSettingsSchema = z.object({
  onScreen: z.boolean(),
});

export type KeyboardSettings = z.infer<typeof keyboardSettingsSchema>;

export const DEFAULT_KEYBOARD_SETTINGS: KeyboardSettings = { onScreen: true };
