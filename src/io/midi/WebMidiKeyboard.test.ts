// Covers ft_0_06.AC3.
import { describe, expect, it, vi } from 'vitest';
import type { NoteEvent } from '../../core/judge/types';
import { VirtualEz220 } from '../mock/VirtualEz220';
import { MidiUnavailableError, WebMidiKeyboard } from './WebMidiKeyboard';

async function setup(device = new VirtualEz220({ now: () => 1000 }), extra = {}) {
  const keyboard = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(device.access), now: () => 1000, ...extra });
  const events: NoteEvent[] = [];
  keyboard.onNote((e) => events.push(e));
  return { device, keyboard, events };
}

describe('WebMidiKeyboard over the virtual EZ-220', () => {
  it('connects automatically and reports the device name', async () => {
    const { keyboard } = await setup();
    expect(keyboard.getStatus()).toEqual({ state: 'connected', name: 'Virtual EZ-220 (simulated)' });
  });

  it('turns raw bytes into note events with the device timestamp', async () => {
    const { device, events } = await setup();
    device.press(60, 90, 12.5);
    device.release(60, 40);
    expect(events).toEqual([
      { kind: 'on', midi: 60, velocity: 90, timeMs: 12.5, source: 'midi' },
      { kind: 'off', midi: 60, velocity: 0, timeMs: 40, source: 'midi' },
    ]);
  });

  it('never delivers a note-on with velocity 0', async () => {
    const { device, events } = await setup();
    device.press(64, 50, 1);
    device.release(64, 2); // sent as note-on velocity 0 by default
    expect(events.every((e) => e.kind === 'off' || e.velocity > 0)).toBe(true);
    expect(events.map((e) => e.kind)).toEqual(['on', 'off']);
  });

  it('ignores active sensing, control changes and other noise', async () => {
    const { device, events } = await setup();
    device.activeSensing();
    device.sendRaw([0xb0, 64, 127]);
    device.sendRaw([0xe0, 0, 64]);
    device.press(60, 70, 1);
    expect(events).toHaveLength(1);
  });

  it('maps device time onto the song clock', async () => {
    const { device, events } = await setup(undefined, { toSongTimeMs: (t: number) => t - 1000 });
    device.press(60, 70, 1500);
    expect(events[0]!.timeMs).toBe(500);
  });

  it('hot-plug: goes disconnected, releases held keys, and reconnects', async () => {
    const { device, keyboard, events } = await setup();
    const statuses: string[] = [];
    keyboard.onStatus((s) => statuses.push(s.state));
    device.press(60, 70, 1);
    device.press(64, 70, 2);
    device.disconnect();
    expect(keyboard.getStatus().state).toBe('disconnected');
    expect(events.slice(2).map((e) => [e.kind, e.midi])).toEqual([['off', 60], ['off', 64]]);
    expect(events.slice(2).every((e) => e.timeMs === 1000 && e.source === 'midi')).toBe(true);
    device.connect();
    expect(keyboard.getStatus()).toMatchObject({ state: 'connected' });
    device.press(62, 70, 3);
    expect(events.at(-1)).toMatchObject({ kind: 'on', midi: 62 });
    expect(statuses).toEqual(['disconnected', 'connected']);
  });

  it('ft_0_07.AC4 finds the output of the keyboard being played, and none while it is unplugged', async () => {
    const { device, keyboard } = await setup();
    expect(keyboard.output()).toBe(device.access.outputs.get('virtual-ez220-out'));
    device.disconnect();
    expect(keyboard.output()).toBeNull();
    device.connect();
    expect(keyboard.output()?.id).toBe('virtual-ez220-out');
  });

  it('ft_0_07.AC4 matches the output by a name holding the input name, else the preferred name, else none', async () => {
    const outputs = new Map<string, { id: string; name: string; state: string }>();
    const access = {
      inputs: new Map([['in', { id: 'in', name: 'Digital Keyboard', state: 'connected', onmidimessage: null }]]),
      outputs, onstatechange: null,
    } as unknown as MIDIAccess;
    const keyboard = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(access), preferName: /Yamaha/ });
    outputs.set('other', { id: 'other', name: 'Some Synth', state: 'connected' });
    expect(keyboard.output()).toBeNull();
    outputs.set('ya', { id: 'ya', name: 'Yamaha Port', state: 'connected' });
    expect(keyboard.output()?.id).toBe('ya');
    outputs.set('out2', { id: 'out2', name: 'MIDIOUT2 (Digital Keyboard)', state: 'connected' });
    expect(keyboard.output()?.id).toBe('out2');
    outputs.set('same', { id: 'same', name: 'Digital Keyboard', state: 'connected' });
    expect(keyboard.output()?.id).toBe('same');
  });

  it('starts disconnected when the keyboard is unplugged and connects when it appears', async () => {
    const device = new VirtualEz220({ connected: false });
    const { keyboard, events } = await setup(device);
    expect(keyboard.getStatus()).toEqual({ state: 'disconnected', name: null });
    device.connect();
    device.press(60, 70, 1);
    expect(keyboard.getStatus().state).toBe('connected');
    expect(events).toHaveLength(1);
  });

  it('lists inputs and lets you pick one or go back to automatic', async () => {
    const { keyboard } = await setup();
    expect(keyboard.listInputs()).toEqual([
      { id: 'virtual-ez220-in', name: 'Virtual EZ-220 (simulated)', manufacturer: 'Virtual', connected: true },
    ]);
    keyboard.selectInput('does-not-exist');
    expect(keyboard.getStatus().state).toBe('disconnected');
    keyboard.selectInput('virtual-ez220-in');
    expect(keyboard.getStatus().state).toBe('connected');
    keyboard.selectInput(null);
    expect(keyboard.getStatus().state).toBe('connected');
  });

  it('prefers an input whose name matches', async () => {
    const device = new VirtualEz220({ name: 'Yamaha EZ-220' });
    const { keyboard } = await setup(device, { preferName: /EZ-?220/ });
    expect(keyboard.getStatus().name).toBe('Yamaha EZ-220');
  });

  it('stops listening on dispose and is safe to dispose twice', async () => {
    const { device, keyboard, events } = await setup();
    device.press(60, 70, 1);
    keyboard.dispose();
    keyboard.dispose();
    expect(device.input.onmidimessage).toBeNull();
    expect(device.access.onstatechange).toBeNull();
    expect(events.map((e) => e.kind)).toEqual(['on', 'off']); // held key released on the way out
  });

  it('isolates a throwing listener from the others', async () => {
    const { device, keyboard } = await setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const good: NoteEvent[] = [];
    keyboard.onNote(() => {
      throw new Error('bad listener');
    });
    keyboard.onNote((e) => good.push(e));
    device.press(60, 70, 1);
    expect(good).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('ignores a message without data', async () => {
    const { device, events } = await setup();
    device.input.onmidimessage?.({ data: null, timeStamp: 1 } as unknown as MIDIMessageEvent);
    expect(events).toEqual([]);
  });
});

describe('WebMidiKeyboard.create failures', () => {
  it('reports unsupported browsers', async () => {
    await expect(WebMidiKeyboard.create()).rejects.toMatchObject({ name: 'Error', reason: 'unsupported' });
  });

  it('reports a denied permission', async () => {
    const denied = Object.assign(new Error('no'), { name: 'SecurityError' });
    await expect(WebMidiKeyboard.create({ requestAccess: () => Promise.reject(denied) })).rejects.toMatchObject({ reason: 'denied' });
  });

  it('reports other failures and keeps the cause', async () => {
    const boom = new Error('boom');
    const error = await WebMidiKeyboard.create({ requestAccess: () => Promise.reject(boom) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MidiUnavailableError);
    expect(error).toMatchObject({ reason: 'failed', cause: boom });
  });

  it('passes an unavailable error through unchanged', async () => {
    const original = new MidiUnavailableError('unsupported', 'x');
    await expect(WebMidiKeyboard.create({ requestAccess: () => Promise.reject(original) })).rejects.toBe(original);
  });
});
