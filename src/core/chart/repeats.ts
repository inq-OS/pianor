import type { Chart, ChartGrace } from './schema.ts';

/** One stretch of written bars in play order: the written ticks `writtenStart` to `writtenEnd` played from `playStart`. */
export interface PlaySegment {
  firstBar: number;
  lastBar: number;
  writtenStart: number;
  writtenEnd: number;
  playStart: number;
  /** Index in the play chart's notes of this segment's first note. */
  firstNote: number;
}

/** The chart as it is played (repeats unrolled), and how it maps back to the written chart the staff draws (core_09.AC18). */
export interface PlayChart {
  chart: Chart;
  /** For each play note, the index of its written note. */
  writtenNote: number[];
  /** For each play bar, its written bar. */
  writtenBar: number[];
  segments: PlaySegment[];
}

/**
 * The written bar ranges in play order: each repeat `{ startBar, endBar }` is played twice; with endings the second pass
 * stops before the first ending and plays the second ending instead (core_09.AC46).
 */
function barRanges(chart: Chart): [number, number][] {
  const out: [number, number][] = [];
  let next = 0;
  for (const r of [...(chart.repeats ?? [])].sort((a, b) => a.startBar - b.startBar)) {
    const e = r.endings;
    if (e) {
      out.push([next, r.endBar], [r.startBar, e.first.startBar - 1], [e.second.startBar, e.second.endBar]);
      next = e.second.endBar + 1;
      continue;
    }
    out.push([next, r.endBar], [r.startBar, r.endBar]);
    next = r.endBar + 1;
  }
  if (next < chart.bars.length) out.push([next, chart.bars.length - 1]);
  return out.filter(([a, b]) => a <= b);
}

/** A tick map (tempo, meter, key) for the play chart: per segment the entry in effect at its start, then the ones inside. */
function unrollMap<T extends { tick: number }>(map: readonly T[], segments: readonly PlaySegment[]): T[] {
  const out: T[] = [];
  for (const s of segments) {
    const atStart = [...map].reverse().find((e) => e.tick <= s.writtenStart) ?? map[0]!;
    const entries = [atStart, ...map.filter((e) => e.tick > s.writtenStart && e.tick < s.writtenEnd)];
    for (const e of entries) {
      const tick = Math.max(e.tick, s.writtenStart) - s.writtenStart + s.playStart;
      const entry = { ...e, tick };
      const prev = out[out.length - 1];
      if (prev && prev.tick === tick) out[out.length - 1] = entry;
      else if (!prev || JSON.stringify({ ...prev, tick: 0 }) !== JSON.stringify({ ...entry, tick: 0 })) out.push(entry);
    }
  }
  return out;
}

/**
 * The flat chart the judge, the audio and the Tempo transport play: the written bars with each repeat played twice
 * (core_09.AC18), the second time through its second ending when it has endings (core_09.AC46). A chart without repeats comes back as it is. The staff keeps drawing the written chart.
 */
export function unrollRepeats(chart: Chart): PlayChart {
  const ranges = barRanges(chart);
  if (!chart.repeats?.length) {
    return { chart, writtenNote: chart.notes.map((_, i) => i), writtenBar: chart.bars.map((_, i) => i), segments: [{ firstBar: 0, lastBar: chart.bars.length - 1, writtenStart: 0, writtenEnd: chart.bars.at(-1)!.endTick, playStart: 0, firstNote: 0 }] };
  }
  const segments: PlaySegment[] = [];
  const bars: Chart['bars'] = [];
  const writtenBar: number[] = [];
  const notes: Chart['notes'] = [];
  const writtenNote: number[] = [];
  const rests: Chart['rests'] = [];
  const phrases: Chart['phrases'] = [];
  const slurs: NonNullable<Chart['slurs']> = [];
  const graces: ChartGrace[] = [];
  const tuplets: NonNullable<Chart['tuplets']> = [];
  let playStart = 0;
  for (const [firstBar, lastBar] of ranges) {
    const writtenStart = chart.bars[firstBar]!.startTick;
    const writtenEnd = chart.bars[lastBar]!.endTick;
    const shift = playStart - writtenStart;
    const barShift = bars.length - firstBar;
    segments.push({ firstBar, lastBar, writtenStart, writtenEnd, playStart, firstNote: notes.length });
    for (let b = firstBar; b <= lastBar; b++) {
      const bar = chart.bars[b]!;
      bars.push({ index: bars.length, startTick: bar.startTick + shift, endTick: bar.endTick + shift });
      writtenBar.push(b);
    }
    chart.notes.forEach((n, i) => {
      if (n.bar < firstBar || n.bar > lastBar) return;
      const { tieNext, ...rest } = n;
      const keepTie = tieNext === true && n.tick + n.dur < writtenEnd;
      notes.push({ ...rest, tick: n.tick + shift, bar: n.bar + barShift, ...(keepTie ? { tieNext } : {}) });
      writtenNote.push(i);
    });
    for (const r of chart.rests) if (r.bar >= firstBar && r.bar <= lastBar) rests.push({ ...r, tick: r.tick + shift, bar: r.bar + barShift });
    // A slur is copied into each stretch that holds all of it; one that reaches out of the stretch is dropped (core_09.AC26).
    for (const s of chart.slurs ?? []) {
      if (s.startTick >= writtenStart && s.endTick < writtenEnd) slurs.push({ ...s, startTick: s.startTick + shift, endTick: s.endTick + shift });
    }
    for (const g of chart.graces ?? []) if (g.tick >= writtenStart && g.tick < writtenEnd) graces.push({ ...g, tick: g.tick + shift });
    // A tuplet lies inside one bar (core_09.AC49), so each pass that plays its bar plays it.
    for (const t of chart.tuplets ?? []) {
      if (t.startTick >= writtenStart && t.endTick < writtenEnd) tuplets.push({ ...t, startTick: t.startTick + shift, endTick: t.endTick + shift });
    }
    for (const p of chart.phrases) {
      if (p.endBar < firstBar || p.startBar > lastBar) continue;
      phrases.push({ name: p.name, startBar: Math.max(p.startBar, firstBar) + barShift, endBar: Math.min(p.endBar, lastBar) + barShift });
    }
    playStart += writtenEnd - writtenStart;
  }
  const play: Chart = {
    ...chart,
    repeats: undefined,
    slurs: slurs.length > 0 ? slurs : undefined,
    tempoMap: unrollMap(chart.tempoMap, segments),
    meterMap: unrollMap(chart.meterMap, segments),
    keyMap: unrollMap(chart.keyMap, segments),
    bars,
    notes,
    rests,
    phrases,
    ...(chart.graces ? { graces } : {}),
    ...(chart.tuplets ? { tuplets } : {}),
  };
  return { chart: play, writtenNote, writtenBar, segments };
}

/** The segment the play position (a play note index) is in. */
function segmentAt(play: PlayChart, playNote: number): number {
  let s = 0;
  while (s + 1 < play.segments.length && play.segments[s + 1]!.firstNote <= playNote) s++;
  return s;
}

/**
 * Per written note, the play note the staff shows for it: the one of the latest pass that has begun. So at `:|` the
 * second pass starts from fresh (the greying of the repeated bars resets, core_09.AC18). `position` is the current play
 * note (the first awaited one, or the note count when done).
 */
export function writtenView(play: PlayChart, writtenCount: number, position: number): number[] {
  const current = segmentAt(play, position);
  const shown = Array.from({ length: writtenCount }, () => -1);
  play.writtenNote.forEach((w, p) => {
    if (shown[w] === -1 || segmentAt(play, p) <= current) shown[w] = p;
  });
  return shown;
}

/** A play tick as a written tick (the playhead on the staff). */
export function writtenTick(play: PlayChart, tick: number): number {
  const s = [...play.segments].reverse().find((seg) => seg.playStart <= tick) ?? play.segments[0]!;
  return tick - s.playStart + s.writtenStart;
}

/** Play note indices (what Kuula or the judge names) as the written notes the staff draws, each once. */
export function writtenNotes(play: PlayChart, playNotes: readonly number[]): number[] {
  return [...new Set(playNotes.map((p) => play.writtenNote[p]).filter((w) => w !== undefined))];
}
