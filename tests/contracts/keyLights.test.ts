import { keyLightContract } from './keyLight.contract';
import { nullKeyLights } from '../../src/io/midi/NullKeyLights';
import { OnScreenKeyboard } from '../../src/io/mock/OnScreenKeyboard';
import { fakeDocument } from '../helpers/fakeDom';

keyLightContract('the null output of the real keyboard', () => ({ lights: nullKeyLights, lit: () => null }));

keyLightContract('OnScreenKeyboard', () => {
  const parent = fakeDocument().createElement();
  const lights = new OnScreenKeyboard(parent as unknown as HTMLElement, { low: 60, high: 64 });
  const root = parent.children[0]!;
  const lit = () => root.children.filter((el) => el.getAttribute('data-lit') === 'true').map((el) => Number(el.getAttribute('data-midi'))).sort((a, b) => a - b);
  return { lights, lit };
});
