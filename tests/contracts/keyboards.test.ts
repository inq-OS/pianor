import { keyboardContract, type KeyboardHarness } from './keyboard.contract';
import { WebMidiKeyboard } from '../../src/io/midi/WebMidiKeyboard';
import { CompositeKeyboard } from '../../src/io/mock/CompositeKeyboard';
import { OnScreenKeyboard } from '../../src/io/mock/OnScreenKeyboard';
import { QwertyKeyboard, type KeyLike, type KeyTarget } from '../../src/io/mock/QwertyKeyboard';
import { ScriptedKeyboard } from '../../src/io/mock/ScriptedKeyboard';
import { VirtualEz220 } from '../../src/io/mock/VirtualEz220';
import { fakeDocument } from '../helpers/fakeDom';

keyboardContract('WebMidiKeyboard over the virtual EZ-220 (velocity-0 releases)', async (): Promise<KeyboardHarness> => {
  const device = new VirtualEz220();
  const keyboard = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(device.access) });
  return { keyboard, playMiddleC: () => { if (device.isConnected && device.input.onmidimessage) { device.press(60, 90, 1); device.release(60, 2); } } };
});

keyboardContract('WebMidiKeyboard over the virtual EZ-220 (real note-offs)', async (): Promise<KeyboardHarness> => {
  const device = new VirtualEz220({ noteOffStyle: 'note-off' });
  const keyboard = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(device.access) });
  return { keyboard, playMiddleC: () => { device.press(60, 90, 1); device.release(60, 2); } };
});

keyboardContract('QwertyKeyboard', (): KeyboardHarness => {
  const handlers = new Map<string, Set<(e: KeyLike) => void>>();
  const target: KeyTarget = {
    addEventListener: (type, l) => void handlers.set(type, (handlers.get(type) ?? new Set()).add(l)),
    removeEventListener: (type, l) => void handlers.get(type)?.delete(l),
  };
  const fire = (type: string, code: string) => handlers.get(type)?.forEach((h) => h({ code, repeat: false }));
  return { keyboard: new QwertyKeyboard(target), playMiddleC: () => { fire('keydown', 'KeyZ'); fire('keyup', 'KeyZ'); } };
});

keyboardContract('ScriptedKeyboard (replay)', (): KeyboardHarness => {
  const keyboard = new ScriptedKeyboard([
    { atMs: 0, kind: 'on', midi: 60, velocity: 90 },
    { atMs: 100, kind: 'off', midi: 60, velocity: 0 },
  ]);
  return { keyboard, playMiddleC: () => keyboard.flush() };
});

keyboardContract('CompositeKeyboard of the virtual EZ-220 and a replay', async (): Promise<KeyboardHarness> => {
  const device = new VirtualEz220();
  const midi = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(device.access) });
  const keyboard = new CompositeKeyboard([midi]);
  return { keyboard, playMiddleC: () => { if (device.input.onmidimessage) { device.press(60, 90, 1); device.release(60, 2); } } };
});

keyboardContract('OnScreenKeyboard', (): KeyboardHarness => {
  const parent = fakeDocument().createElement();
  const keyboard = new OnScreenKeyboard(parent as unknown as HTMLElement, { low: 60, high: 64, velocity: 90, now: () => 0 });
  const root = parent.children[0]!;
  const key = root.children.find((el) => el.getAttribute('data-midi') === '60')!;
  const fire = (type: string) => root.dispatch(type, { target: key, pointerId: 1, preventDefault: () => undefined });
  return { keyboard, playMiddleC: () => { fire('pointerdown'); fire('pointerup'); } };
});
