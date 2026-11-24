import { describe, expect, it } from 'vitest';
import { jsLiteral } from './vite-keri.ts';

describe('the picture loaders table', () => {
  it('writes a name as a JavaScript string that cannot end a script tag or a line', () => {
    const text = 'virtual:keri-pictures/room-day</script>\u2028"';
    const out = jsLiteral(text);
    expect(out).not.toMatch(/[<>/\u2028\u2029]/);
    expect(JSON.parse(out)).toBe(text);
  });
});
