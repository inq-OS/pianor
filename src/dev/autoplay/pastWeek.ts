/**
 * The demo week's past practice (ft_Y_09, ft_1_27.AC2; dev only, synthetic): one whole play of a piece in Wait mode on each
 * of the `days` days before `today`, at noon local time, a bar every two seconds. The first day has a bar played with a
 * mistake for each day still to come, the last day none, so the curriculum's trend rises towards the teacher's check-up.
 * Nothing here touches the DOM or Phaser.
 */
import type { Chart } from '../../core/chart';
import type { BarPlay } from '../../core/progression/practiceLog';

export function pastWeek(chart: Chart, today: Date, days: number): BarPlay[] {
  const plays: BarPlay[] = [];
  const count = chart.bars.length;
  for (let back = days; back >= 1; back--) {
    const noon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back, 12, 0, 0);
    // `back - 1` bars with a mistake: none on the day before today
    const wrong = new Set(Array.from({ length: Math.min(back - 1, count) }, (_, j) => (j * 3 + back) % count));
    chart.bars.forEach((_, bar) => {
      const notes = chart.notes.filter((n) => n.bar === bar).length;
      plays.push({
        at: new Date(noon.getTime() + bar * 2000).toISOString(), pieceId: chart.id, bar, notes,
        firstTry: wrong.has(bar) && notes > 0 ? notes - 1 : notes, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [],
      });
    });
  }
  return plays;
}
