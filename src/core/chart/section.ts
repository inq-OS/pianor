import { chartSchema, type Chart } from './schema.ts';
import { printedBar } from './time.ts';

/** Keep the map entries that apply from `offset` to `end`: the one in force at `offset` becomes tick 0, later ones move back. */
function shiftMap<T extends { tick: number }>(map: readonly T[], offset: number, end: number): T[] {
  let current = map[0]!;
  for (const entry of map) if (entry.tick <= offset) current = entry;
  const later = map.filter((entry) => entry.tick > offset && entry.tick < end);
  return [{ ...current, tick: 0 }, ...later.map((entry) => ({ ...entry, tick: entry.tick - offset }))];
}

/**
 * A section of a chart (`firstBar` to `lastBar`, 0-based and inclusive) as a chart of its own, starting at tick 0, so practice,
 * the staff and the judges treat it like any piece. A note tied into the next bar after the section ends with the section.
 * Its id says which bars it is, and it is never the piece itself: the game gives no XP for it (`docs/features/core_03-section-repeat-and-tempo-percent.md`).
 */
export function sliceChart(chart: Chart, firstBar: number, lastBar: number): Chart {
  if (!Number.isInteger(firstBar) || !Number.isInteger(lastBar) || firstBar < 0 || lastBar >= chart.bars.length || firstBar > lastBar) {
    throw new Error(`a section is bars ${firstBar} to ${lastBar} of 0 to ${chart.bars.length - 1}`);
  }
  const offset = chart.bars[firstBar]!.startTick;
  const end = chart.bars[lastBar]!.endTick;
  const inside = (bar: number) => bar >= firstBar && bar <= lastBar;

  const notes = chart.notes.filter((n) => inside(n.bar)).map((n) => {
    const { tieNext, ...rest } = n;
    const tiedOut = tieNext === true && n.tick + n.dur >= end; // its continuation is not in the section
    return { ...rest, tick: n.tick - offset, bar: n.bar - firstBar, ...(tieNext && !tiedOut ? { tieNext } : {}) };
  });
  const midis = notes.map((n) => n.midi);
  const phrases = chart.phrases
    .filter((p) => p.endBar >= firstBar && p.startBar <= lastBar)
    .map((p) => ({ name: p.name, startBar: Math.max(p.startBar, firstBar) - firstBar, endBar: Math.min(p.endBar, lastBar) - firstBar }));

  return chartSchema.parse({
    ...chart,
    id: `${chart.id}#bars-${firstBar + 1}-${lastBar + 1}`,
    // the id keeps its index-based name (it is a key); the title numbers bars as printed, a pick-up 0 (core_09.AC25)
    title: firstBar === lastBar ? `${chart.title} (bar ${printedBar(chart, firstBar)})` : `${chart.title} (bars ${printedBar(chart, firstBar)} to ${printedBar(chart, lastBar)})`,
    tempoMap: shiftMap(chart.tempoMap, offset, end),
    meterMap: shiftMap(chart.meterMap, offset, end),
    keyMap: shiftMap(chart.keyMap, offset, end),
    notes,
    rests: chart.rests.filter((r) => inside(r.bar)).map((r) => ({ ...r, tick: r.tick - offset, bar: r.bar - firstBar })),
    bars: chart.bars.slice(firstBar, lastBar + 1).map((b, i) => ({ index: i, startTick: b.startTick - offset, endTick: b.endTick - offset })),
    phrases,
    // a repeat the section holds whole, its endings too, stays; one it cuts is played once (core_09.AC20, core_09.AC48)
    repeats: chart.repeats?.filter((r) => r.startBar >= firstBar && (r.endings?.second.endBar ?? r.endBar) <= lastBar).map((r) => {
      const span = (b: { startBar: number; endBar: number }) => ({ startBar: b.startBar - firstBar, endBar: b.endBar - firstBar });
      return { ...span(r), ...(r.endings ? { endings: { first: span(r.endings.first), second: span(r.endings.second) } } : {}) };
    }),
    // a slur the section holds whole is kept and moved; one it cuts is left out, as its ends must be notes (core_09.AC26)
    ...(chart.slurs ? { slurs: chart.slurs.filter((s) => s.startTick >= offset && s.endTick < end).map((s) => ({ ...s, startTick: s.startTick - offset, endTick: s.endTick - offset })) } : {}),
    // a grace goes with its main note: kept and moved when that note is in the section (core_09.AC32)
    ...(chart.graces ? { graces: chart.graces.filter((g) => g.tick >= offset && g.tick < end).map((g) => ({ ...g, tick: g.tick - offset })) } : {}),
    // a tuplet lies inside one bar (core_09.AC49): kept and moved when its bar is in the section
    ...(chart.tuplets ? { tuplets: chart.tuplets.filter((t) => t.startTick >= offset && t.endTick < end).map((t) => ({ ...t, startTick: t.startTick - offset, endTick: t.endTick - offset })) } : {}),
    range: midis.length > 0 ? { low: Math.min(...midis), high: Math.max(...midis) } : chart.range,
  });
}

/** True for the chart `sliceChart` made. */
export const isSection = (chart: Chart): boolean => chart.id.includes('#bars-');

/**
 * True when bars `firstBar` to `lastBar` hold at least one note the player presses (a note of a play track). A section without
 * one would never finish, so the practice screen refuses it: rests only, or only the accompaniment.
 */
export function sectionHasNotes(chart: Chart, firstBar: number, lastBar: number): boolean {
  const played = new Set(chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
  return chart.notes.some((n) => played.has(n.track) && n.bar >= firstBar && n.bar <= lastBar);
}
