import type { Focus, Measure } from '../learn/stats';
import { TEMPO_RULES } from '../learn/tempo';
import { t, type StringKey } from './strings';

/** One thing to work on as a sentence (ft_1_32.AC10); `printed` gives the printed number of a piece's bar. */
export function focusLine(focus: Focus, printed: (bar: number) => number): string {
  switch (focus.kind) {
    case 'stops':
      return focus.bar === null ? t('learnStats.focus.stops', { halts: focus.halts }) : t('learnStats.focus.stopsBar', { halts: focus.halts, bar: printed(focus.bar) });
    case 'slowBar':
      return t('learnStats.focus.slowBar', { bar: printed(focus.bar), percent: focus.pace });
    case 'rushing':
      return t('learnStats.focus.rushing', { drift: focus.drift });
    case 'slowing':
      return t('learnStats.focus.slowing', { drift: focus.drift });
    case 'hand':
      return t(focus.hand === 'LH' ? 'learnStats.focus.handLeft' : 'learnStats.focus.handRight', { spread: focus.spread, other: focus.other });
    case 'uneven':
      return t('learnStats.focus.uneven', { spread: focus.spread });
    case 'tempoVaries':
      return t('learnStats.focus.tempoVaries', { from: focus.from, to: focus.to });
    case 'steady':
      return t('learnStats.focus.steady', { bpm: focus.bpm });
  }
}

/** The pages that explain the numbers, after the page of what to work on: a few meanings a page, so each fits the screen. */
export const MEANING_PAGES: readonly (readonly StringKey[])[] = [
  ['learnStats.meaning.bpm', 'learnStats.meaning.sd'],
  ['learnStats.meaning.mad', 'learnStats.meaning.drift'],
  ['learnStats.meaning.halts', 'learnStats.meaning.hands'],
  ['learnStats.meaning.bars', 'learnStats.meaning.trend'],
];

/** A page's meaning of a number as a sentence, with the tempo rules' own numbers in it (a stop's length). */
export function meaningLine(key: StringKey): string {
  return t(key, { haltFactor: TEMPO_RULES.haltFactor });
}

/** A value of a measure as written: percent for the shares, a plain number for the tempo and the stops. */
export function measureValue(measure: Measure, value: number, signed = false): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = signed && rounded > 0 ? '+' : '';
  return `${sign}${rounded}${measure === 'bpm' || measure === 'halts' ? '' : '%'}`;
}
