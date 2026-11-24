import { describe, expect, it } from 'vitest';
import wanderersJson from '../../../content/world/wanderers.json';
import itemsJson from '../../../content/items/items.json';
import type { Curriculum } from '../curriculum/curriculum';
import { curriculumDocument, worldDocument } from '../save/documents';
import { setCast } from './cast';
import {
  DEFAULT_WANDERER_RULES, giveKeepsake, keptToday, parseWandererRules, sendWanderer, wandererPiece, wandererVerdict, wanderersToday,
} from './wanderer';
import type { WorldState } from './worldState';

const rules = DEFAULT_WANDERER_RULES;
const plain: Curriculum = { base: 85, pieces: [], calendar: [] };
const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const open = ['knoll', 'port'];

describe('the wanderers as content', () => {
  it('content/world/wanderers.json holds the defaults, and every keepsake is an item', () => {
    expect(parseWandererRules(wanderersJson)).toEqual(DEFAULT_WANDERER_RULES);
    const items = new Set(itemsJson.items.map((i) => i.id));
    for (const id of rules.keepsakes) expect(items.has(id), id).toBe(true);
    expect(rules.wanderers.length).toBeGreaterThan(0);
  });
});

describe('a wanderer the teacher sends (ft_1_37)', () => {
  it('ft_1_37.AC6 stands in an open scene on the day it was sent, and on no other day', () => {
    const id = rules.wanderers[0]!.id;
    const sent = sendWanderer(plain, id, '1998-11-18');
    expect(wanderersToday(sent, '1998-11-17', open, rules)).toEqual({});
    const today = wanderersToday(sent, '1998-11-18', open, rules);
    expect(open).toContain(today[id]);
    expect(wanderersToday(sent, '1998-11-18', open, rules)).toEqual(today);
    expect(wanderersToday(sent, '1998-11-19', open, rules)).toEqual({});
    expect(wanderersToday(sent, '1998-11-18', [], rules)).toEqual({});
    expect(wanderersToday(setCast(sent, id, { on: false }), '1998-11-18', open, rules)).toEqual({});
  });

  it('sending it again the same day replaces the first, and the sending is kept in the curriculum document', () => {
    const id = rules.wanderers[0]!.id;
    const twice = sendWanderer(sendWanderer(plain, id, '1998-11-18'), id, '1998-11-18', 'twinkle');
    expect(twice.cast?.sent).toEqual([{ wanderer: id, day: '1998-11-18', piece: 'twinkle' }]);
    expect(curriculumDocument.parse(curriculumDocument.serialize(twice))).toEqual(twice);
  });

  it('ft_1_37.AC6 asks for the piece the teacher named, else a learned piece drawn for the day, else none', () => {
    const id = rules.wanderers[0]!.id;
    const named = sendWanderer(plain, id, '1998-11-18', 'twinkle');
    expect(wandererPiece(named, id, '1998-11-18', ['a', 'b'])).toBe('twinkle');
    const drawn = sendWanderer(plain, id, '1998-11-18');
    const piece = wandererPiece(drawn, id, '1998-11-18', ['b', 'a', 'c']);
    expect(['a', 'b', 'c']).toContain(piece);
    expect(wandererPiece(drawn, id, '1998-11-18', ['c', 'a', 'b'])).toBe(piece);
    expect(wandererPiece(drawn, id, '1998-11-18', [])).toBeUndefined();
    expect(wandererPiece(drawn, id, '1998-11-17', ['a'])).toBeUndefined();
  });

  it('ft_1_37.AC7 ft_1_37.AC8 keeps a keepsake when the play reaches the share its neediness needs, never takes anything', () => {
    const id = rules.wanderers[0]!.id;
    expect(wandererVerdict(plain, id, 0.8, rules)).toEqual({ needed: 0.8, kept: true });
    expect(wandererVerdict(plain, id, 0.79, rules)).toEqual({ needed: 0.8, kept: false });
    const needy = setCast(plain, id, { neediness: 5 });
    expect(wandererVerdict(needy, id, 0.95, rules)).toEqual({ needed: 1, kept: false });
    const easy = setCast(plain, id, { neediness: 1 });
    expect(wandererVerdict(easy, id, 0.6, rules)).toEqual({ needed: 0.6, kept: true });
  });

  it('ft_1_37.AC9 gives one keepsake a wanderer a day, kept in the world, several of a kind side by side', () => {
    const id = rules.wanderers[0]!.id;
    const one = giveKeepsake(empty, id, '1998-11-18', rules);
    expect(one.items).toHaveLength(1);
    expect(rules.keepsakes).toContain(one.items[0]);
    expect(keptToday(one, id, '1998-11-18')).toBe(true);
    expect(giveKeepsake(one, id, '1998-11-18', rules)).toBe(one);
    let world = one;
    for (const day of ['1998-11-19', '1998-11-20', '1998-11-21', '1998-11-22', '1998-11-23', '1998-11-24']) world = giveKeepsake(world, id, day, rules);
    expect(world.items).toHaveLength(7);
    expect(new Set(world.items).size).toBeLessThan(7);
    expect(worldDocument.parse(worldDocument.serialize(world))).toEqual(world);
    expect(worldDocument.parse(JSON.stringify({ schemaVersion: 1, ...empty })).wandererGifts).toBeUndefined();
  });
});
