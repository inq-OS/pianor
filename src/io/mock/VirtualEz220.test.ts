// Covers ft_0_06.AC3.
import { describe, expect, it, vi } from 'vitest';
import { VirtualEz220, installVirtualMidi } from './VirtualEz220';

function listen(device: VirtualEz220) {
  const received: { data: number[]; timeStamp: number }[] = [];
  device.input.onmidimessage = (e) => received.push({ data: [...e.data!], timeStamp: e.timeStamp });
  return received;
}

describe('VirtualEz220', () => {
  it('sends note-on on channel 1 and releases as velocity 0 by default', () => {
    const device = new VirtualEz220();
    const received = listen(device);
    device.press(60, 90, 10);
    device.release(60, 20);
    expect(received).toEqual([{ data: [0x90, 60, 90], timeStamp: 10 }, { data: [0x90, 60, 0], timeStamp: 20 }]);
  });

  it('can send real note-offs instead', () => {
    const device = new VirtualEz220({ noteOffStyle: 'note-off' });
    const received = listen(device);
    device.release(60, 1);
    expect(received[0]!.data[0]).toBe(0x80);
  });

  it('only has the 61 keys of the EZ-220 and valid velocities', () => {
    const device = new VirtualEz220();
    expect(() => device.press(35)).toThrow(RangeError);
    expect(() => device.press(97)).toThrow(RangeError);
    expect(() => device.press(60, 0)).toThrow(RangeError);
    expect(() => device.press(60.5)).toThrow(RangeError);
    expect(() => device.press(36)).not.toThrow();
    expect(() => device.press(96)).not.toThrow();
  });

  it('sends active sensing and raw bytes untouched', () => {
    const device = new VirtualEz220();
    const received = listen(device);
    device.activeSensing(3);
    device.sendRaw([0xb0, 64, 127], 4);
    expect(received.map((r) => r.data)).toEqual([[0xfe], [0xb0, 64, 127]]);
  });

  it('exposes a connected input and output through a MIDIAccess-shaped object', () => {
    const device = new VirtualEz220({ name: 'Test Piano' });
    expect(device.access.inputs.size).toBe(1);
    expect(device.access.outputs.size).toBe(1);
    expect(device.input.name).toBe('Test Piano');
    expect(device.isConnected).toBe(true);
  });

  it('hot-plugs: statechange fires, messages stop, sending throws', () => {
    const device = new VirtualEz220();
    const onChange = vi.fn();
    device.access.onstatechange = onChange;
    const received = listen(device);
    device.disconnect();
    expect(device.isConnected).toBe(false);
    expect(device.input.state).toBe('disconnected');
    expect(onChange).toHaveBeenCalledTimes(2); // input and output ports
    expect(() => device.press(60)).toThrow(/unplugged/);
    expect(() => device.output.send([0x90, 60, 1])).toThrow(/disconnected/);
    device.connect();
    device.press(60, 70, 1);
    expect(received).toHaveLength(1);
    device.connect(); // already connected: no extra event
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('can start unplugged', () => {
    const device = new VirtualEz220({ connected: false });
    expect(device.isConnected).toBe(false);
    expect(device.output.state).toBe('disconnected');
  });

  it('records what the game sends to the keyboard (e.g. key lights)', () => {
    const device = new VirtualEz220();
    device.output.send([0x90, 60, 100], 5);
    expect(device.output.sent).toEqual([{ data: [0x90, 60, 100], timeStamp: 5 }]);
  });

  it('opens and closes its ports', async () => {
    const device = new VirtualEz220();
    await device.input.open();
    await device.output.open();
    expect([device.input.connection, device.output.connection]).toEqual(['open', 'open']);
    await device.input.close();
    await device.output.close();
    expect(device.input.connection).toBe('closed');
  });

  it('uses the injected clock for default timestamps', () => {
    const device = new VirtualEz220({ now: () => 777 });
    const received = listen(device);
    device.press(60);
    expect(received[0]!.timeStamp).toBe(777);
  });

  it('can be installed as navigator.requestMIDIAccess', async () => {
    const device = new VirtualEz220();
    const nav: { requestMIDIAccess?: unknown } = {};
    installVirtualMidi(nav, device);
    await expect((nav.requestMIDIAccess as () => Promise<unknown>)()).resolves.toBe(device.access);
  });
});
