import { describe, expect, it } from 'vitest';
import { DEBUG_TEXT_MAX, DebugLog, debugLog, formatEntry } from './debugLog';

const clock = () => {
  let t = Date.parse('1998-11-21T22:00:00.000Z');
  return () => (t += 10);
};

describe('debug log (ft_Y_15)', () => {
  it('ft_Y_15.AC1 records nothing while off, which the game log is until the page asks', () => {
    const log = new DebugLog(4, clock());
    log.log('scene', 'menu');
    expect(log.entries()).toEqual([]);
    expect(log.version).toBe(0);
    expect(debugLog.on).toBe(false);
  });

  it('ft_Y_15.AC1 gives the entries oldest first and keeps only the newest once the ring is full', () => {
    const log = new DebugLog(3, clock());
    log.enable();
    log.log('a', '1');
    log.log('b', '2');
    expect(log.entries().map((e) => e.text)).toEqual(['1', '2']);
    log.log('c', '3');
    log.log('d', '4');
    log.log('e', '5');
    expect(log.entries().map((e) => e.kind)).toEqual(['c', 'd', 'e']);
    expect(log.version).toBe(5);
  });

  it('writes one line per entry, a long detail cut and a stack indented under its line', () => {
    const log = new DebugLog(5, clock());
    log.enable();
    log.log('error', 'Boom\nat f (x.ts:1:2)');
    log.log('key', 'z'.repeat(DEBUG_TEXT_MAX + 10));
    const [error, key] = log.entries();
    expect(formatEntry(error!)).toBe('1998-11-21T22:00:00.010Z error Boom\n    at f (x.ts:1:2)');
    expect(key!.text).toHaveLength(DEBUG_TEXT_MAX + 3);
    expect(log.text()).toBe(log.pageText());
  });

  it('ft_Y_15.AC2 puts what an earlier page left, trimmed to the ring, above the reload line', () => {
    const log = new DebugLog(2, clock());
    log.enable();
    log.restore('old 1\nold 2\n\nold 3\n');
    log.log('scene', 'menu');
    expect(log.text()).toBe('old 2\nold 3\n--- page reloaded ---\n1998-11-21T22:00:00.010Z scene menu');
  });
});
