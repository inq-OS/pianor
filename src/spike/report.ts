/**
 * The text the hardware spike page offers for `docs/hardware-notes.md`: what the page measured (facts it saw), and what only
 * a person can see (do the keys light up?) as that person's answers. Pure. A run on the simulated keyboard says so.
 */
import type { LogSummary, PortInfo } from './midiLog';
import type { TapAnalysis } from './tapTest';

type YesNo = 'yes' | 'no' | 'partly' | null;

export interface ReportInput {
  date: string;
  source: 'real' | 'virtual';
  userAgent: string;
  secureContext: boolean;
  audio: { sampleRate: number; baseLatencyMs: number | null; outputLatencyMs: number | null } | null;
  ports: PortInfo[];
  summary: LogSummary;
  taps: TapAnalysis[];
  answers: {
    lights: YesNo;
    lightsHow: string;
    /** Did the keyboard also sound the notes the computer sent? */
    soundedWhenSent: YesNo;
    localControl: string;
    /** Did unplugging and plugging back in work without reloading the page? */
    hotplug: YesNo;
    notes: string;
  };
}

const answer = (value: YesNo, detail = '') => (value === null ? 'not checked' : detail.trim() ? `${value} (${detail.trim()})` : value);
const ms = (value: number | null) => (value === null ? 'not reported' : `${value} ms`);

export function hardwareReport(r: ReportInput): string {
  const s = r.summary;
  const lines: string[] = [];
  lines.push(`### ${r.date}: hardware spike${r.source === 'virtual' ? ' (simulated keyboard)' : ''}`);
  if (r.source === 'virtual') lines.push('- **Simulated keyboard: this checks the page, it is not a hardware result.**');
  lines.push(`- Browser: ${r.userAgent}${r.secureContext ? '' : ' (not a secure context: Web MIDI may be refused)'}`);

  lines.push('', 'Seen by the page:');
  if (r.ports.length === 0) lines.push('- No MIDI ports.');
  for (const p of r.ports) lines.push(`- ${p.type === 'input' ? 'Input' : 'Output'}: ${p.name} (${p.manufacturer || 'no manufacturer'}), ${p.state}`);
  lines.push(`- Key presses: ${s.notesOn}, releases: ${s.notesOff}${s.channels.length ? `, on channel ${s.channels.join(', ')}` : ''}`);
  if (s.notesOff > 0) {
    const style = s.releaseStyles.velocity0 >= s.releaseStyles.noteOff ? 'note-on with velocity 0' : 'note-off';
    lines.push(`- Key releases arrive as ${style} (${Math.max(s.releaseStyles.velocity0, s.releaseStyles.noteOff)} of ${s.notesOff})`);
  }
  if (s.velocity) lines.push(`- Velocity: ${s.velocity.min} to ${s.velocity.max}`);
  if (s.keyRange) lines.push(`- Keys played: MIDI ${s.keyRange.low} to ${s.keyRange.high}`);
  const sensing = s.activeSensing;
  const every = sensing.medianIntervalMs === null ? '' : `, about every ${sensing.medianIntervalMs} ms`;
  lines.push(`- Active sensing: ${sensing.count === 0 ? 'none seen' : `${sensing.count} ${sensing.count === 1 ? 'message' : 'messages'}${every}`}`);
  if (s.other > 0 || s.clock > 0) lines.push(`- Other messages: ${s.other} (clock: ${s.clock})`);
  if (s.deliveryMs !== null) lines.push(`- Browser delivery delay (page received minus MIDI timestamp), median: ${s.deliveryMs} ms`);
  if (r.audio) lines.push(`- Audio: ${r.audio.sampleRate} Hz, base latency ${ms(r.audio.baseLatencyMs)}, output latency ${ms(r.audio.outputLatencyMs)} (as the browser reports them)`);
  if (r.taps.length === 0) lines.push('- Tap test: not run');
  r.taps.forEach((t, i) => {
    lines.push(t.medianMs === null
      ? `- Tap test ${i + 1}: no taps matched the clicks`
      : `- Tap test ${i + 1}: median ${t.medianMs} ms after the click (spread ${t.spreadMs} ms, ${t.matched} of ${t.clicks - Math.min(2, t.clicks)} clicks matched, from ${t.minMs} to ${t.maxMs} ms)`);
  });

  lines.push('', 'Answered by the person at the keyboard:');
  lines.push(`- Keys light up when the computer sends notes: ${answer(r.answers.lights, r.answers.lightsHow)}`);
  lines.push(`- The keyboard also sounds the notes the computer sends: ${answer(r.answers.soundedWhenSent)}`);
  lines.push(`- Local Control: ${r.answers.localControl.trim() || 'not checked'}`);
  lines.push(`- Unplug and plug back in works without reloading: ${answer(r.answers.hotplug)}`);
  if (r.answers.notes.trim()) lines.push(`- Notes: ${r.answers.notes.trim()}`);
  return `${lines.join('\n')}\n`;
}
