import { t } from '../text/strings';

/**
 * The tempo of a piece as text for the info card and the practice screen: its own BPM (`chart.tempoMap[0].bpm`), also
 * in Wait mode, and the effective BPM in brackets when the practice tempo percent is not 100. Pure.
 */
export function tempoLabel(bpm: number, percent = 100): string {
  const own = Math.round(bpm);
  if (percent === 100) return t('tempo.bpm', { bpm: own });
  return t('tempo.bpmEffective', { bpm: own, effective: Math.round((bpm * percent) / 100) });
}
