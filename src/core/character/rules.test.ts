// Covers the character rules (d169, d263): every character keeps them, ft_1_21.AC18 among them.
import { describe, expect, it } from 'vitest';
import type { Conversation } from '../dialogue/conversation';
import type { CharacterDef } from './character';
import { castProblems, characterProblems, type CharacterFacts } from './rules';

const def: CharacterDef = {
  schemaVersion: 1, id: 'tree', kind: 'spirit', name: { kind: 'generic', name: 'character.tree.name' }, styles: ['classical'],
  musicTie: 'character.tree.music', actor: 'tree', conversation: 'tree',
  phrases: { 1: ['tree-1'], 2: ['tree-2'] }, prizes: ['leaf', 'seed'], meet: { practiceMinutes: 30, cooldownCleanPlays: 3 }, scenes: ['knoll'],
  lessons: ['character.tree.lesson'],
};
const conv: Conversation = {
  schemaVersion: 1, id: 'tree', start: 'hello',
  nodes: {
    hello: { speaker: 'character', line: 'talk.tree.hello', next: 'menu' },
    menu: { speaker: 'character', line: 'talk.tree.menu', choices: [{ text: 'talk.tree.ask', next: 'who' }, { text: 'talk.tree.teach', next: 'teach' }, { text: 'talk.tree.bye', next: 'bye' }] },
    who: { speaker: 'character', line: 'character.tree.lesson', effects: [{ setFlag: 'known-tree' }], next: 'menu' },
    teach: { speaker: 'character', line: 'piece.tree-1.about', effects: [{ teach: 'tree-1' }] },
    bye: { speaker: 'character', line: 'talk.tree.bye', effects: [{ leave: true }] },
  },
};
const text: Record<string, string> = {
  'character.tree.name': 'Puu', 'character.tree.music': 'Aeglased read.', 'piece.tree-1.about': 'See on vana viis.', 'piece.tree-2.about': 'See on teine viis.',
  'character.tree.lesson': 'Rida lõpeb kodus.', 'talk.tree.hello': 'Tere!', 'talk.tree.menu': 'Ma kuulan.', 'item.leaf': 'Leht', 'item.seed': 'Seeme',
};
const facts = (over: Partial<CharacterFacts> = {}): CharacterFacts => ({
  piece: (piece) => {
    const bars = ({ 'tree-1': 4, 'tree-2': 8 } as Record<string, number>)[piece];
    return bars === undefined ? undefined : { bars, source: 'Folk song, Kuusalu parish', license: 'public-domain' };
  },
  conversation: (id) => (id === 'tree' ? conv : undefined),
  item: (id) => (id === 'leaf' || id === 'seed' ? { name: `item.${id}`, picture: id } : undefined),
  text: (key) => (key in text ? { et: text[key]!, en: `${text[key]!} (en)` } : undefined),
  keys: Object.keys(text),
  hasActor: (id) => id === 'tree',
  drawn: () => true,
  ...over,
});

describe('characterProblems: the rules every character keeps (d169)', () => {
  it('a character that keeps them all has no problem', () => {
    expect(characterProblems(def, facts())).toEqual([]);
  });

  it('each level teaches a piece of 4 to 16 bars, the levels run 1, 2, 3 with none skipped', () => {
    const sized = facts({ piece: (p) => ({ bars: p === 'tree-1' ? 2 : 17, source: 'Folk song', license: 'public-domain' }) });
    expect(characterProblems(def, sized)).toEqual(['tree: level 1: piece tree-1 has 2 bars, not 4 to 16', 'tree: level 2: piece tree-2 has 17 bars, not 4 to 16']);
    expect(characterProblems({ ...def, phrases: { 1: ['tree-1'], 3: ['gone'] } }, facts())).toEqual([
      'tree: level 3 comes with no level 2 before it', 'tree: level 3: piece gone does not exist or does not compile', "tree: piece gone's background: no text for piece.gone.about"]);
    expect(characterProblems({ ...def, phrases: {}, prizes: ['leaf'] }, facts())).toEqual(['tree: teaches no level']);
    expect(characterProblems({ ...def, phrases: { 1: [] }, prizes: ['leaf'] }, facts())).toEqual(['tree: level 1 teaches no piece']);
  });

  it('each piece is a real public-domain piece, not one made for the game unless approved', () => {
    const made = (source: string, license = 'public-domain') => facts({ piece: () => ({ bars: 4, source, license }) });
    expect(characterProblems(def, made('original', 'CC0-1.0'))).toEqual([
      'tree: level 1: piece tree-1 is not a real public-domain piece (source "original", licence CC0-1.0)',
      'tree: level 2: piece tree-2 is not a real public-domain piece (source "original", licence CC0-1.0)']);
    for (const source of ['Original', 'composed by an agent for Pianor; original', 'generated (phrase, seed 4)']) expect(characterProblems(def, made(source))).toHaveLength(2);
    expect(characterProblems(def, made('Beethoven, Symphony No. 9'))).toEqual([]);
    // a line written in the manner of a named folk tradition, under an open licence (d263)
    expect(characterProblems(def, made('in the manner of an Estonian runo song (regilaul); written for Pianor', 'CC0-1.0'))).toEqual([]);
    expect(characterProblems(def, made('in the manner of an Estonian runo song', 'CC-BY-4.0'))).toHaveLength(2);
  });

  it('an original piece the maintainer approved may be taught too, a draft one may not', () => {
    const original = (status: 'draft' | 'approved') => facts({ piece: () => ({ bars: 4, source: 'original', license: 'CC0-1.0', status }) });
    expect(characterProblems(def, original('approved'))).toEqual([]);
    expect(characterProblems(def, original('draft'))).toHaveLength(2);
  });

  it('each piece has its background in one line, said where the talk teaches it, and the talk teaches a lesson on its specialty', () => {
    expect(characterProblems({ ...def, lessons: undefined } as unknown as CharacterDef, facts())).toEqual(['tree: teaches no lesson about its specialty (lessons)']);
    const without = (key: string) => facts({ text: (k) => (k in text && k !== key ? { et: text[k]!, en: `${text[k]!} (en)` } : undefined) });
    expect(characterProblems(def, without('piece.tree-2.about'))).toEqual(["tree: piece tree-2's background: no text for piece.tree-2.about"]);
    const silent = facts({ conversation: () => ({ ...conv, nodes: { ...conv.nodes, teach: { ...conv.nodes['teach']!, line: 'talk.tree.menu' } } }) });
    expect(characterProblems(def, silent)).toEqual(["tree: piece tree-1's background (piece.tree-1.about) is never said in its talk"]);
    expect(characterProblems({ ...def, lessons: ['talk.tree.ask'] }, facts())).toEqual(['tree: lesson talk.tree.ask: no text for talk.tree.ask', 'tree: lesson talk.tree.ask is never said in its talk']);
    expect(characterProblems(def, facts({ conversation: () => undefined }))).toEqual(['tree: conversation tree does not exist', 'tree: lesson character.tree.lesson is never said in its talk']);
  });

  it('ft_1_22.AC10 its name shows as ??? until the student asks who it is: only a node reached through a choice sets its known flag', () => {
    const setOn = (node: string) => facts({ conversation: () => ({ ...conv, nodes: { ...conv.nodes, [node]: { ...conv.nodes[node]!, effects: [{ setFlag: 'known-tree' }] }, who: { ...conv.nodes['who']!, effects: [] } } }) });
    const message = 'tree: its known flag known-tree is not set only after a choice (asking who it is)';
    expect(characterProblems(def, setOn('hello'))).toEqual([message]);
    expect(characterProblems(def, setOn('menu'))).toEqual([message]);
    expect(characterProblems(def, setOn('bye'))).toEqual([]);
    // a flag shown on the way from the start, even once it taught, is not asking
    const gated = facts({ conversation: () => ({ ...conv, nodes: { ...conv.nodes, hello: { ...conv.nodes['hello']!, when: { taught: 'tree-1' }, effects: [{ setFlag: 'known-tree' }] } } }) });
    expect(characterProblems(def, gated)).toEqual([message]);
    // never set at all
    expect(characterProblems(def, facts({ conversation: () => ({ ...conv, nodes: { ...conv.nodes, who: { ...conv.nodes['who']!, effects: [] } } }) }))).toEqual([message]);
  });

  it('ft_1_21.AC18 the prize ladder has a new, named, drawn rung for every level', () => {
    expect(characterProblems({ ...def, prizes: ['leaf'] }, facts())).toEqual(['tree: the prize ladder has 1 rungs for 2 levels']);
    expect(characterProblems({ ...def, prizes: ['leaf', 'leaf'] }, facts())[0]).toMatch(/repeats an earlier one/);
    expect(characterProblems({ ...def, prizes: ['leaf', 'gem'] }, facts())).toEqual(['tree: prize gem is not an item']);
    expect(characterProblems(def, facts({ drawn: (p) => p !== 'seed' }))).toEqual(['tree: prize seed has no drawn picture']);
    expect(characterProblems({ ...def, prizes: undefined } as unknown as CharacterDef, facts())).toEqual(['tree: the prize ladder has 0 rungs for 2 levels']);
  });

  it('ft_1_21.AC18 no prize is on two characters\' ladders', () => {
    expect(castProblems([{ id: 'a', prizes: ['leaf', 'seed'] }, { id: 'b', prizes: ['float', 'seed'] }, { id: 'c' }])).toEqual(['prize seed is on the ladders of a and b']);
    expect(castProblems([{ id: 'a', prizes: ['leaf'] }, { id: 'b', prizes: ['float'] }])).toEqual([]);
  });

  // ft_1_21.AC1
  it('its figure exists, and its words are Estonian with no label word, in any form', () => {
    expect(characterProblems(def, facts({ hasActor: () => false }))).toEqual(['tree: actor tree is not in content/actors']);
    const said = (et: string, en = 'x') => facts({ text: (key) => (key in text ? { et: key === 'talk.tree.hello' ? et : text[key]!, en: key === 'talk.tree.hello' ? en : 'x' } : undefined) });
    expect(characterProblems(def, said('Väljakutse!'))).toEqual(['tree: talk.tree.hello: the label word "VÄLJAKUTSE" on screen']);
    expect(characterProblems(def, said('Tule lahingusse!'))).toEqual(['tree: talk.tree.hello: the label word "LAHING" on screen']);
    expect(characterProblems(def, said('MÄNGIME, {right} RIDA.'))).toEqual([]);
    expect(characterProblems(def, said(' '))).toEqual(['tree: talk.tree.hello: no Estonian']);
    expect(characterProblems(def, said('Come back later.', 'Come back later.'))).toEqual(['tree: talk.tree.hello: the Estonian is the English']);
    expect(characterProblems(def, said('Puu', 'Puu'))).toEqual([]);
    expect(characterProblems(def, facts({ keys: Object.keys(text).filter((k) => !k.startsWith('talk.')) }))).toEqual(['tree: has no lines (talk.tree.*)']);
    expect(characterProblems({ ...def, musicTie: 'character.tree.none' }, facts())).toEqual(['tree: its music tie: no text for character.tree.none']);
    expect(characterProblems({ ...def, name: { kind: 'generated', pool: 'et-given-family' } }, facts())).toEqual([]);
  });
});
