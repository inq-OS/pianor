/**
 * The hardware spike's MIDI log: raw messages as they came in or went out, a readable description of each, a summary of
 * what the keyboard did, and an export that keeps the raw bytes and offers the key presses in the replay-fixture format
 * (`tests/replays/*.replay.json`). Pure: no DOM, no Web MIDI.
 */
import { median } from './median';

export type Direction = 'in' | 'out';

export interface LogEntry {
  /** When the message happened: `MIDIMessageEvent.timeStamp` for input, the send time for output (ms, `performance.now()` clock). */
  t: number;
  /** When the page got it (`performance.now()`), for input: the gap to `t` is how late the browser delivered it. */
  received?: number;
  dir: Direction;
  port: string;
  bytes: number[];
}

export type MessageKind =
  | 'note-on' | 'note-off' | 'control' | 'program' | 'pitch-bend' | 'aftertouch'
  | 'active-sensing' | 'clock' | 'system' | 'sysex' | 'unknown';

export interface Described {
  kind: MessageKind;
  /** 1 to 16, for channel messages. */
  channel?: number;
  note?: number;
  noteName?: string;
  velocity?: number;
  controller?: number;
  value?: number;
  /** How a release arrived: as a note-on with velocity 0, or as a real note-off. */
  releaseStyle?: 'velocity0' | 'note-off';
  text: string;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI 60 is C4 (middle C). */
export function noteName(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

const hex = (bytes: readonly number[]) => bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

const CONTROLLERS: Record<number, string> = {
  1: 'Modulation', 7: 'Volume', 10: 'Pan', 11: 'Expression', 64: 'Sustain pedal', 120: 'All Sound Off', 121: 'Reset All Controllers',
  123: 'All Notes Off',
};

const SYSTEM: Record<number, string> = { 0xf8: 'Clock', 0xfa: 'Start', 0xfb: 'Continue', 0xfc: 'Stop', 0xfe: 'Active sensing', 0xff: 'Reset' };

/** A readable description of one raw message. Never throws: anything it cannot read is `unknown`, with its bytes. */
export function describeMidi(bytes: readonly number[]): Described {
  const unknown: Described = { kind: 'unknown', text: `Not understood: ${hex(bytes) || '(empty)'}` };
  const status = bytes[0];
  if (status === undefined || (status & 0x80) === 0) return unknown;
  if (status === 0xf0) return { kind: 'sysex', text: `System exclusive (${bytes.length} bytes): ${hex(bytes.slice(0, 8))}${bytes.length > 8 ? ' ...' : ''}` };
  if (status >= 0xf8) {
    const kind: MessageKind = status === 0xfe ? 'active-sensing' : status === 0xf8 ? 'clock' : 'system';
    return { kind, text: SYSTEM[status] ?? `System message ${hex([status])}` };
  }
  if (status >= 0xf0) return { kind: 'system', text: `System message ${hex(bytes)}` };

  const type = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  const needs = type === 0xc0 || type === 0xd0 ? 2 : 3;
  if (bytes.length < needs) return unknown;
  const d1 = bytes[1]! & 0x7f;
  const d2 = (bytes[2] ?? 0) & 0x7f;
  const ch = `channel ${channel}`;
  switch (type) {
    case 0x90:
      if (d2 === 0) return { kind: 'note-off', channel, note: d1, noteName: noteName(d1), velocity: 0, releaseStyle: 'velocity0', text: `Key up ${noteName(d1)} (sent as note-on with velocity 0), ${ch}` };
      return { kind: 'note-on', channel, note: d1, noteName: noteName(d1), velocity: d2, text: `Key down ${noteName(d1)}, velocity ${d2}, ${ch}` };
    case 0x80:
      return { kind: 'note-off', channel, note: d1, noteName: noteName(d1), velocity: d2, releaseStyle: 'note-off', text: `Key up ${noteName(d1)} (note-off, release velocity ${d2}), ${ch}` };
    case 0xb0: {
      const name = d1 === 122 ? `Local Control ${d2 >= 64 ? 'on' : 'off'}` : (CONTROLLERS[d1] ?? `Controller ${d1}`);
      return { kind: 'control', channel, controller: d1, value: d2, text: `${name} = ${d2}, ${ch}` };
    }
    case 0xc0:
      return { kind: 'program', channel, value: d1, text: `Program (voice) ${d1 + 1}, ${ch}` };
    case 0xe0:
      return { kind: 'pitch-bend', channel, value: (d2 << 7) | d1, text: `Pitch bend ${((d2 << 7) | d1) - 8192}, ${ch}` };
    case 0xa0:
      return { kind: 'aftertouch', channel, note: d1, value: d2, text: `Key pressure ${noteName(d1)} = ${d2}, ${ch}` };
    default: // 0xd0
      return { kind: 'aftertouch', channel, value: d1, text: `Channel pressure ${d1}, ${ch}` };
  }
}

export interface LogSummary {
  notesOn: number;
  notesOff: number;
  releaseStyles: { velocity0: number; noteOff: number };
  velocity: { min: number; max: number } | null;
  /** Channels the keyboard's notes came on. */
  channels: number[];
  keyRange: { low: number; high: number } | null;
  activeSensing: { count: number; medianIntervalMs: number | null };
  clock: number;
  /** Messages received that are neither notes nor active sensing nor clock. */
  other: number;
  /** Messages the page sent. */
  sent: number;
  /** How late the browser delivered input messages: the median of received minus timestamp. */
  deliveryMs: number | null;
}


export function summarize(entries: readonly LogEntry[]): LogSummary {
  const s: LogSummary = {
    notesOn: 0, notesOff: 0, releaseStyles: { velocity0: 0, noteOff: 0 }, velocity: null, channels: [], keyRange: null,
    activeSensing: { count: 0, medianIntervalMs: null }, clock: 0, other: 0, sent: 0, deliveryMs: null,
  };
  const sensing: number[] = [];
  const channels = new Set<number>();
  const delays: number[] = [];
  for (const e of entries) {
    if (e.dir === 'out') {
      s.sent++;
      continue;
    }
    if (e.received !== undefined) delays.push(e.received - e.t);
    const d = describeMidi(e.bytes);
    if (d.kind === 'note-on') {
      s.notesOn++;
      s.velocity = { min: Math.min(s.velocity?.min ?? 127, d.velocity!), max: Math.max(s.velocity?.max ?? 0, d.velocity!) };
      s.keyRange = { low: Math.min(s.keyRange?.low ?? 127, d.note!), high: Math.max(s.keyRange?.high ?? 0, d.note!) };
      channels.add(d.channel!);
    } else if (d.kind === 'note-off') {
      s.notesOff++;
      if (d.releaseStyle === 'velocity0') s.releaseStyles.velocity0++;
      else s.releaseStyles.noteOff++;
      channels.add(d.channel!);
    } else if (d.kind === 'active-sensing') sensing.push(e.t);
    else if (d.kind === 'clock') s.clock++;
    else s.other++;
  }
  s.channels = [...channels].sort((a, b) => a - b);
  s.activeSensing = { count: sensing.length, medianIntervalMs: median(sensing.slice(1).map((t, i) => t - sensing[i]!)) };
  const delivery = median(delays);
  s.deliveryMs = delivery === null ? null : Math.round(delivery * 10) / 10;
  return s;
}

export interface ReplayEvent {
  kind: 'on' | 'off';
  midi: number;
  velocity: number;
  timeMs: number;
}

/** Received key presses and releases in the replay-fixture format, timed from the first press (0.1 ms steps). */
export function toReplayEvents(entries: readonly LogEntry[], inputPort?: string): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  let start: number | null = null;
  for (const e of entries) {
    if (e.dir !== 'in' || (inputPort !== undefined && e.port !== inputPort)) continue;
    const d = describeMidi(e.bytes);
    if (d.kind === 'note-on') start ??= e.t;
    if (start === null || (d.kind !== 'note-on' && d.kind !== 'note-off')) continue;
    events.push({ kind: d.kind === 'note-on' ? 'on' : 'off', midi: d.note!, velocity: d.kind === 'note-on' ? d.velocity! : 0, timeMs: Math.round((e.t - start) * 10) / 10 });
  }
  return events;
}

export interface PortInfo {
  type: 'input' | 'output';
  name: string;
  manufacturer: string;
  state: string;
  id?: string;
  version?: string;
}

export interface ExportMeta {
  recordedAt: string;
  /** "real" for the Web MIDI of the browser, "virtual" for the simulated keyboard. */
  source: 'real' | 'virtual';
  userAgent: string;
  ports: PortInfo[];
  /** Anything else worth keeping: audio latencies, tap-test results, the person's answers. */
  notes?: Record<string, unknown>;
}

/**
 * The downloadable log: the raw entries, a summary, and a replay draft. To make a replay fixture, play a known piece while
 * recording, copy `replay` into `tests/replays/<name>.replay.json`, set `chart`, and add the `expect` block (see
 * `docs/hardware-test-checklist.md`).
 */
export function buildExport(entries: readonly LogEntry[], meta: ExportMeta) {
  const synthetic = meta.source === 'virtual';
  return {
    format: 'pianor-midi-log' as const,
    version: 1 as const,
    ...meta,
    summary: summarize(entries),
    entries: [...entries],
    replay: {
      synthetic,
      description: synthetic
        ? `Recorded from the simulated EZ-220 in the hardware spike page on ${meta.recordedAt}: tests the page, not the keyboard.`
        : `Recorded from a real keyboard in the hardware spike page on ${meta.recordedAt} (${meta.ports.filter((p) => p.type === 'input').map((p) => p.name).join(', ') || 'unknown port'}).`,
      chart: null as string | null,
      events: toReplayEvents(entries),
    },
  };
}
