import { describe, expect, it } from 'vitest';
import introJson from '../../../content/intro/intro.json';
import { strings } from '../text/strings';
import { AFTER_MAP, INTRO_DONE_FLAG, INTRO_STARTED_FLAG, afterPlay, afterRoom, introDue, introFlags, introLines, lessonBars, parseIntro, roomSteps, stepRuns } from './intro';

const intro = parseIntro(introJson);

describe('the first-run intro (ft_1_31)', () => {
  it('ft_1_31.AC1 is due for a new player, and for one who left it half way, until it is done or skipped', () => {
    expect(introDue({ flags: [], played: false, mode: 'auto' })).toBe(true);
    expect(introDue({ flags: [INTRO_STARTED_FLAG], played: true, mode: 'auto' })).toBe(true);
    expect(introDue({ flags: [INTRO_STARTED_FLAG, INTRO_DONE_FLAG], played: true, mode: 'auto' })).toBe(false);
    expect(introDue({ flags: [INTRO_DONE_FLAG], played: false, mode: 'auto' })).toBe(false);
  });

  it('ft_1_31.AC1 is not offered to a player from before the intro who has played', () => {
    expect(introDue({ flags: [], played: true, mode: 'auto' })).toBe(false);
  });

  it('the switch forces it on or off', () => {
    expect(introDue({ flags: [INTRO_DONE_FLAG], played: true, mode: 'force' })).toBe(true);
    expect(introDue({ flags: [], played: false, mode: 'off' })).toBe(false);
  });

  it('ft_1_31.AC4 ft_1_31.AC6 runs tour, map, knock, learn, practise, tug, end in that order', () => {
    expect(afterRoom(intro, 'tour', true)).toEqual({ kind: 'map' });
    expect(AFTER_MAP).toBe('knock');
    expect(afterRoom(intro, 'knock', true)).toEqual({ kind: 'room', stage: 'learn' });
    expect(afterRoom(intro, 'learn', true)).toEqual({ kind: 'play', stage: 'learn', passes: 1 });
    expect(afterPlay('learn', true)).toBe('practise');
    expect(afterRoom(intro, 'practise', true)).toEqual({ kind: 'play', stage: 'practise', passes: intro.practisePasses });
    expect(afterPlay('practise', true)).toBe('tug');
    expect(afterRoom(intro, 'tug', true)).toEqual({ kind: 'tug' });
    expect(afterRoom(intro, 'end', true)).toEqual({ kind: 'done' });
  });

  it('ft_1_31.AC4 practise asks for as many plays in all as the tug\'s gate (one to learn, the rest to practise)', () => {
    expect(1 + intro.practisePasses).toBe(3);
  });

  it('Back from a play returns to the same stage in the room', () => {
    expect(afterPlay('learn', false)).toBe('learn');
    expect(afterPlay('practise', false)).toBe('practise');
  });

  it('without the lesson\'s piece the teacher does not come: the tour ends with Kiur', () => {
    expect(afterRoom(intro, 'knock', false)).toEqual({ kind: 'room', stage: 'end' });
    expect(roomSteps(intro, 'knock', false).every((s) => s.who === 'kiur')).toBe(true);
    expect(roomSteps(intro, 'end', false).every((s) => s.who === 'kiur')).toBe(true);
    expect(roomSteps(intro, 'tour', false).every((s) => s.who === 'kiur')).toBe(true);
  });

  it('ft_1_31.AC2 the tour shows every object of the room under the spotlight', () => {
    const spots = intro.room.tour.flatMap((s) => (s.who === 'kiur' && s.spot ? [s.spot] : []));
    for (const thing of ['piano', 'door', 'stand', 'shield', 'kiur']) expect(spots).toContain(thing);
  });

  it('ft_1_31.AC3 the learn play shows the staff, the next note and Listen', () => {
    const spots = intro.practice.learn.map((s) => s.spot);
    expect(spots).toEqual(expect.arrayContaining(['staff', 'note', 'listen']));
  });

  it('every line is in the game\'s text', () => {
    for (const key of introLines(intro)) expect(key in strings, key).toBe(true);
  });

  it('the lesson is the first four bars of Twinkle', () => {
    expect(lessonBars(intro)).toEqual({ piece: 'twinkle-twinkle', first: 0, last: 3 });
  });

  it('ft_1_31.AC6 the map\'s tour shows a place and the way home', () => {
    expect(intro.map.map((s) => s.spot)).toEqual(expect.arrayContaining(['place', 'house']));
  });

  it('groups consecutive steps by speaker', () => {
    const runs = stepRuns(intro.room.knock);
    expect(runs.map((r) => r[0]!.who)).toEqual(['kiur', 'teacher']);
    expect(runs[0]).toHaveLength(2);
  });

  it('adds a flag once', () => {
    expect(introFlags([], 'started')).toEqual([INTRO_STARTED_FLAG]);
    expect(introFlags([INTRO_STARTED_FLAG], 'started')).toEqual([INTRO_STARTED_FLAG]);
    expect(introFlags([INTRO_STARTED_FLAG], 'done')).toEqual([INTRO_STARTED_FLAG, INTRO_DONE_FLAG]);
  });

  it('refuses a spot the screen does not have, and bars in the wrong order', () => {
    const bad = structuredClone(introJson) as { room: { tour: { spot: string }[] }; bars: number[] };
    bad.room.tour[1]!.spot = 'window';
    expect(() => parseIntro(bad)).toThrow();
    expect(() => parseIntro({ ...introJson, bars: [4, 1] })).toThrow();
  });
});
