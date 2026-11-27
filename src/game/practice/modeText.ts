import type { PlayChoice } from '../../core/judge/playSettings';
import { t, type StringKey } from '../../core/text/strings';

/** The cycling mode button's name per choice (core_01.AC10). */
export const MODE_LABEL: Readonly<Record<PlayChoice, StringKey>> = {
  wait: 'settings.modeWait', follow: 'settings.modeFollow', tempo: 'settings.modeTempo', tempoFirstNote: 'settings.modeTempoFirstNote',
};

/** The mode button's tooltip: what each choice does, each its own; the start on the first note says its name. */
const MODE_TOOLTIP: Readonly<Record<PlayChoice, StringKey>> = {
  wait: 'settings.hintWait', follow: 'settings.hintFollow', tempo: 'settings.hintTempo', tempoFirstNote: 'settings.modeTempoFirstNote',
};

export const modeTooltip = (choice: PlayChoice): string => t(MODE_TOOLTIP[choice]);
