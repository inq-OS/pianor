// Covers ft_0_01.AC3.
import { describe, expect, it } from 'vitest';
import { summarize } from './midiLog';
import { hardwareReport, type ReportInput } from './report';
import { analyseTaps, clickTimes } from './tapTest';

const clicks = clickTimes(1000, 100, 12);

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  date: '1998-10-09',
  source: 'real',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0',
  secureContext: true,
  audio: { sampleRate: 48000, baseLatencyMs: 10, outputLatencyMs: 40 },
  ports: [
    { type: 'input', name: 'Digital Keyboard', manufacturer: 'Yamaha', state: 'connected' },
    { type: 'output', name: 'Digital Keyboard', manufacturer: 'Yamaha', state: 'connected' },
  ],
  summary: summarize([
    { t: 0, received: 2, dir: 'in', port: 'Digital Keyboard', bytes: [0x90, 60, 70] },
    { t: 100, received: 101, dir: 'in', port: 'Digital Keyboard', bytes: [0x90, 60, 0] },
  ]),
  taps: [analyseTaps(clicks, clicks.map((c) => c + 35))],
  answers: { lights: 'yes', lightsHow: 'channel 1, any velocity', soundedWhenSent: 'no', localControl: '', hotplug: 'yes', notes: '' },
  ...over,
});

describe('hardwareReport', () => {
  it('writes what the page saw as observed facts, with date, browser and ports', () => {
    const text = hardwareReport(input());
    expect(text).toContain('1998-10-09');
    expect(text).toContain('Chrome/141.0');
    expect(text).toContain('Input: Digital Keyboard (Yamaha)');
    expect(text).toContain('Key releases arrive as note-on with velocity 0 (1 of 1)');
    expect(text).toContain('Velocity: 70 to 70');
    expect(text).toContain('Tap test 1: median 35 ms');
    expect(text).toContain('output latency 40 ms');
  });

  it('writes what only a person can see as their answers, and says what was not checked', () => {
    const text = hardwareReport(input({ answers: { lights: null, lightsHow: '', soundedWhenSent: null, localControl: '', hotplug: null, notes: 'cable was loose once' } }));
    expect(text).toContain('Keys light up when the computer sends notes: not checked');
    expect(text).toContain('cable was loose once');
    const answered = hardwareReport(input());
    expect(answered).toContain('Keys light up when the computer sends notes: yes (channel 1, any velocity)');
  });

  it('never presents a run on the simulated keyboard as a hardware result', () => {
    const text = hardwareReport(input({ source: 'virtual' }));
    expect(text).toMatch(/simulated/i);
    expect(text).toMatch(/not a hardware result/i);
  });

  it('says how often active sensing came, and counts a single one plainly', () => {
    const sensing = (times: number[]) => summarize(times.map((t) => ({ t, dir: 'in' as const, port: 'K', bytes: [0xfe] })));
    expect(hardwareReport(input({ summary: sensing([0, 300, 600]) }))).toContain('Active sensing: 3 messages, about every 300 ms');
    expect(hardwareReport(input({ summary: sensing([0]) }))).toContain('Active sensing: 1 message\n');
    expect(hardwareReport(input())).toContain('Active sensing: none seen');
  });

  it('copes with nothing measured', () => {
    const text = hardwareReport(input({ ports: [], summary: summarize([]), taps: [], audio: null }));
    expect(text).toContain('No MIDI ports');
    expect(text).toContain('Tap test: not run');
  });
});
