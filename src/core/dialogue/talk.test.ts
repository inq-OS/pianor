import { describe, expect, it } from 'vitest';
import placeholderConversation from '../../../tests/fixtures/contracts/placeholder.conversation.json';
import { strings } from '../text/strings';
import { conversationSchema, type Conversation, type ConversationNode } from './conversation';
import { conditionHolds, continueTalk, lintConversation, startTalk, type TalkFacts } from './talk';

const facts: TalkFacts = { flags: [], items: [], met: [], taught: [], level: 1, knowledge: false };

function conv(nodes: Record<string, ConversationNode>, start = Object.keys(nodes)[0]!): Conversation {
  return { schemaVersion: 1, id: 'test', start, nodes };
}

const say = (line: string, rest: Partial<ConversationNode> = {}): ConversationNode => ({ speaker: 'character', line, ...rest });

describe('conditionHolds (ft_1_22.AC1)', () => {
  const f: TalkFacts = { flags: ['a'], items: ['shell'], met: ['kiur'], taught: ['echo'], level: 3, knowledge: true };

  it('reads flags, items, met, taught, level and the knowledge switch', () => {
    expect(conditionHolds({ flag: 'a' }, f)).toBe(true);
    expect(conditionHolds({ flag: 'b' }, f)).toBe(false);
    expect(conditionHolds({ notFlag: 'b' }, f)).toBe(true);
    expect(conditionHolds({ hasItem: 'shell' }, f)).toBe(true);
    expect(conditionHolds({ met: 'kiur' }, f)).toBe(true);
    expect(conditionHolds({ met: 'other' }, f)).toBe(false);
    expect(conditionHolds({ taught: 'echo' }, f)).toBe(true);
    expect(conditionHolds({ levelAtLeast: 3 }, f)).toBe(true);
    expect(conditionHolds({ levelAtLeast: 4 }, f)).toBe(false);
    expect(conditionHolds({ knowledge: true }, f)).toBe(true);
    expect(conditionHolds({ knowledge: false }, f)).toBe(false);
  });

  it('all and any combine', () => {
    expect(conditionHolds({ all: [{ flag: 'a' }, { hasItem: 'shell' }] }, f)).toBe(true);
    expect(conditionHolds({ all: [{ flag: 'a' }, { flag: 'b' }] }, f)).toBe(false);
    expect(conditionHolds({ any: [{ flag: 'b' }, { flag: 'a' }] }, f)).toBe(true);
    expect(conditionHolds({ any: [{ flag: 'b' }, { flag: 'c' }] }, f)).toBe(false);
  });
});

describe('startTalk and continueTalk (ft_1_22.AC1)', () => {
  it('shows the start node with its visible choices and steps by the chosen one', () => {
    const c = conv({
      hi: say('l.hi', { choices: [{ text: 'c.play', next: 'play' }, { text: 'c.secret', next: 'bye', when: { flag: 'x' } }, { text: 'c.bye', next: 'bye' }] }),
      play: say('l.play', { effects: [{ teach: 'echo' }] }),
      bye: say('l.bye', { effects: [{ leave: true }] }),
    });
    const first = startTalk(c, facts)!;
    expect(first.node).toBe('hi');
    expect(first.line).toBe('l.hi');
    expect(first.choices.map((ch) => ch.text)).toEqual(['c.play', 'c.bye']);
    expect(first.end).toBe(false);
    const second = continueTalk(c, first, 1)!;
    expect(second.node).toBe('bye');
    expect(second.outcome).toEqual({ leave: true });
    expect(second.end).toBe(true);
    expect(continueTalk(c, second)).toBeNull();
  });

  it('applies flag and item effects when a node is shown, so later conditions see them, and lists every effect', () => {
    const c = conv({
      a: say('l.a', { effects: [{ setFlag: 'met-x' }, { give: 'shell' }], next: 'b' }),
      b: say('l.b', { when: { all: [{ flag: 'met-x' }, { hasItem: 'shell' }] }, effects: [{ clearFlag: 'met-x' }, { take: 'shell' }], next: 'c' }),
      c: say('l.c', { effects: [{ tug: 2 }] }),
    });
    const a = startTalk(c, facts)!;
    expect(a.effects).toEqual([{ setFlag: 'met-x' }, { give: 'shell' }]);
    expect(a.facts.flags).toEqual(['met-x']);
    expect(a.facts.items).toEqual(['shell']);
    const b = continueTalk(c, a)!;
    expect(b.node).toBe('b');
    expect(b.facts.flags).toEqual([]);
    expect(b.facts.items).toEqual([]);
    const end = continueTalk(c, b)!;
    expect(end.outcome).toEqual({ tug: 2 });
    expect(facts.flags).toEqual([]);
  });

  it('skips a node whose condition fails to its next, and ends the talk when a skipped node has none', () => {
    const c = conv({
      a: say('l.a', { when: { flag: 'no' }, next: 'b' }),
      b: say('l.b', { effects: [{ checkup: 'p' }] }),
    });
    expect(startTalk(c, facts)!.node).toBe('b');
    expect(startTalk(conv({ a: say('l.a', { when: { flag: 'no' } }) }), facts)).toBeNull();
  });

  it('a node with no next and no choices ends the talk', () => {
    const step = startTalk(conv({ a: say('l.a') }), facts)!;
    expect(step.end).toBe(true);
    expect(step.outcome).toBeUndefined();
    expect(continueTalk(conv({ a: say('l.a') }), step)).toBeNull();
  });

  it('a node whose choices are all hidden ends the talk (the linter refuses a node whose every choice has a condition)', () => {
    const c = conv({ a: say('l.a', { choices: [{ text: 'c', next: 'b', when: { flag: 'no' } }] }), b: say('l.b', { effects: [{ leave: true }] }) });
    const a = startTalk(c, facts)!;
    expect(a.choices).toEqual([]);
    expect(a.end).toBe(true);
    expect(continueTalk(c, a)).toBeNull();
  });

  it('refuses a missing or out-of-range choice, and a choice where there are none', () => {
    const c = conv({ a: say('l.a', { choices: [{ text: 'c', next: 'b' }] }), b: say('l.b', { next: 'a' }) });
    const a = startTalk(c, facts)!;
    expect(() => continueTalk(c, a)).toThrow(RangeError);
    expect(() => continueTalk(c, a, 1)).toThrow(RangeError);
    const b = continueTalk(c, a, 0)!;
    expect(() => continueTalk(c, b, 0)).toThrow(RangeError);
  });

  it('ends instead of looping when skipped nodes go round', () => {
    const c = conv({ a: say('l.a', { when: { flag: 'no' }, next: 'b' }), b: say('l.b', { when: { flag: 'no' }, next: 'a' }) });
    expect(startTalk(c, facts)).toBeNull();
  });
});

describe('lintConversation (ft_1_22.AC1, the AX-0 test of WP-09)', () => {
  it('passes the contract fixture', () => {
    const fixture = conversationSchema.parse(placeholderConversation);
    expect(lintConversation(fixture)).toEqual([]);
  });

  it('every branch must reach playing or leaving within 4 presses', () => {
    const chain = (n: number) => {
      const nodes: Record<string, ConversationNode> = {};
      for (let i = 0; i < n; i++) nodes[`n${i}`] = say(`l.${i}`, { next: `n${i + 1}` });
      nodes[`n${n}`] = say('l.end', { effects: [{ teach: 'p' }] });
      return conv(nodes, 'n0');
    };
    expect(lintConversation(chain(4))).toEqual([]);
    const five = lintConversation(chain(5));
    expect(five).toHaveLength(1);
    expect(five[0]!.message).toMatch(/4 presses/);
    expect(five[0]!.message).toContain('n0 > n1 > n2 > n3 > n4');
  });

  it('a branch that just ends, a loop with no way out, and a skipped node with no next all fail the AX-0 test', () => {
    const ends = conv({ a: say('l.a', { choices: [{ text: 'c1', next: 'b' }, { text: 'c2', next: 'c' }] }), b: say('l.b', { effects: [{ leave: true }] }), c: say('l.c') });
    expect(lintConversation(ends).map((i) => `${i.node}: ${i.message}`)).toEqual(['c: can never reach playing or leaving', expect.stringMatching(/^a: .*a > c \(the talk ends\)/)]);
    const noWayOut = conv({ a: say('l.a', { choices: [{ text: 'c1', next: 'b' }, { text: 'c2', next: 'd' }] }), b: say('l.b', { next: 'c' }), c: say('l.c', { next: 'b' }), d: say('l.d', { effects: [{ leave: true }] }) });
    expect(lintConversation(noWayOut).map((i) => i.message)).toEqual(['can never reach playing or leaving', 'can never reach playing or leaving']);
    const skipped = conv({ a: say('l.a', { next: 'b' }), b: say('l.b', { when: { flag: 'x' }, effects: [{ leave: true }] }) });
    expect(lintConversation(skipped).map((i) => i.message)).toEqual(expect.arrayContaining([expect.stringMatching(/skipped by its condition/)]));
  });

  it('a branch may come back to the menu it came from (the music tie, then back), when the menu still plays within 4 presses', () => {
    const c = conv({
      hello: say('l.hello', { next: 'menu' }),
      menu: say('l.menu', { choices: [{ text: 'c.teach', next: 'teach' }, { text: 'c.tie', next: 'tie' }, { text: 'c.later', next: 'bye' }] }),
      tie: say('l.tie', { next: 'menu' }),
      teach: say('l.teach', { effects: [{ teach: 'p' }] }),
      bye: say('l.bye', { effects: [{ leave: true }] }),
    });
    expect(lintConversation(c)).toEqual([]);
    // Pushed one press deeper, the menu's own branch is too long.
    const deeper = conv({ ...c.nodes, hello: say('l.hello', { next: 'more' }), more: say('l.more', { next: 'again' }), again: say('l.again', { next: 'menu' }) }, 'hello');
    expect(lintConversation(deeper)[0]!.message).toMatch(/4 presses/);
  });

  it('ft_1_22.AC1, the AX-0 test: a loop whose only way out is behind a condition is refused (it could trap the student)', () => {
    const c = conv({
      menu: say('l.menu', { choices: [{ text: 'k.tie', next: 'tie' }, { text: 'k.teach', next: 'teach', when: { flag: 'ready' } }] }),
      tie: say('l.tie', { next: 'menu' }),
      teach: say('l.teach', { effects: [{ teach: 'p1' }] }),
    });
    expect(lintConversation(c).map((i) => `${i.node}: ${i.message}`)).toEqual(['menu: can never reach playing or leaving', 'tie: can never reach playing or leaving']);
    // A node that may be skipped does not count as the way out either.
    const skippable = conv({ a: say('l.a', { choices: [{ text: 'c', next: 'b' }] }), b: say('l.b', { when: { flag: 'x' }, effects: [{ leave: true }], next: 'a' }) });
    expect(lintConversation(skippable).map((i) => i.message)).toContain('can never reach playing or leaving');
  });

  it('a node whose every choice has a condition is refused: it could end the talk with nothing to pick', () => {
    const c = conv({ a: say('l.a', { choices: [{ text: 'c', next: 'b', when: { flag: 'x' } }] }), b: say('l.b', { effects: [{ leave: true }] }) });
    expect(lintConversation(c).map((i) => i.message)).toEqual(expect.arrayContaining([expect.stringMatching(/every choice has a condition/)]));
  });

  it('conditions do not hide a branch: a choice behind a flag is still checked', () => {
    const c = conv({ a: say('l.a', { choices: [{ text: 'c1', next: 'b' }, { text: 'c2', next: 'c', when: { flag: 'x' } }] }), b: say('l.b', { effects: [{ leave: true }] }), c: say('l.c') });
    expect(lintConversation(c).map((i) => i.node)).toEqual(['c', 'a']);
  });

  it('finds a missing start or target, an unreachable node, choices with a next, a line after the talk ends and two outcomes', () => {
    const bad = conv(
      {
        a: say('l.a', { choices: [{ text: 'c', next: 'b' }, { text: 'c2', next: 'ghost' }], next: 'b' }),
        b: say('l.b', { effects: [{ leave: true }, { teach: 'p' }] }),
        c: say('l.c', { effects: [{ tug: 1 }], next: 'b' }),
        d: say('l.d', { effects: [{ leave: true }], choices: [{ text: 'x', next: 'b' }] }),
      },
      'a',
    );
    const messages = lintConversation(bad).map((i) => `${i.node ?? ''}: ${i.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^a: .*ghost/),
        expect.stringMatching(/^a: .*both choices and next/),
        expect.stringMatching(/^b: .*more than one/),
        expect.stringMatching(/^c: .*never reached/),
        expect.stringMatching(/^c: .*ends the talk/),
        expect.stringMatching(/^d: .*ends the talk/),
      ]),
    );
    expect(lintConversation({ ...bad, start: 'nowhere' })[0]!.message).toMatch(/start/);
  });

  it('a node with a condition may carry next past an outcome, for when it is skipped', () => {
    const c = conv({ a: say('l.a', { when: { flag: 'x' }, effects: [{ tug: 1 }], next: 'b' }), b: say('l.b', { effects: [{ leave: true }] }) });
    expect(lintConversation(c)).toEqual([]);
  });

  it('checks every line and choice key when given the known keys', () => {
    const c = conv({ a: say('l.a', { choices: [{ text: 'c.ok', next: 'b' }, { text: 'c.missing', next: 'b' }] }), b: say('l.missing', { effects: [{ leave: true }] }) });
    const known = new Set(['l.a', 'c.ok']);
    const issues = lintConversation(c, { hasKey: (k) => known.has(k) });
    expect(issues.map((i) => i.message).sort()).toEqual(['missing string key c.missing', 'missing string key l.missing']);
  });
});

describe('every conversation in content/conversations (ft_1_22.AC1)', () => {
  it('parses and passes the linter, with every key in the strings table', () => {
    const files = import.meta.glob<unknown>('../../../content/conversations/*.json', { eager: true, import: 'default' });
    for (const [path, raw] of Object.entries(files)) {
      const c = conversationSchema.parse(raw);
      const file = path.split('/').pop()!;
      expect(`${file}: ${c.id}`).toBe(`${file}: ${file.replace(/\.json$/, '')}`);
      expect(lintConversation(c, { hasKey: (k) => k in strings }), file).toEqual([]);
    }
  });
});

describe('Puuvaim\'s conversation: learn before show (ft_1_22.AC3, d135)', async () => {
  const puuvaim = conversationSchema.parse((await import('../../../content/conversations/puuvaim.json')).default);
  const menuOf = (f: TalkFacts) => {
    let step = startTalk(puuvaim, f);
    for (let i = 0; i < 10 && step && step.choices.length === 0 && !step.end; i++) step = continueTalk(puuvaim, step);
    return step;
  };

  it('ft_1_22.AC3 until his phrase is taught he offers teaching and leaving, never the tug', () => {
    expect(menuOf({ ...facts, flags: ['met-puuvaim', 'known-puuvaim'] })!.choices.map((c) => c.text)).toEqual(['talk.puuvaim.askTeach', 'talk.puuvaim.askLater']);
  });

  it('ft_1_22.AC10 until the student asks who he is, his menu offers "Who are you?" first; his answer sets known-puuvaim and offers his menu', () => {
    const ask = menuOf({ ...facts, flags: ['met-puuvaim'] })!;
    expect(ask.choices.map((c) => c.text)).toEqual(['talk.puuvaim.askWho', 'talk.puuvaim.askTeach', 'talk.puuvaim.askLater']);
    const who = continueTalk(puuvaim, ask, 0)!;
    expect(who).toMatchObject({ node: 'who', line: 'talk.puuvaim.who', end: false });
    expect(who.facts.flags).toContain('known-puuvaim');
    expect(who.choices.map((c) => c.text)).toEqual(['talk.puuvaim.askTeach', 'talk.puuvaim.askLater']);
    // talking and leaving is not enough: picking Later leaves him unknown
    expect(continueTalk(puuvaim, ask, 2)!.facts.flags).not.toContain('known-puuvaim');
  });

  it('ft_1_22.AC3 the first talk after teaching sends the student to practise and ends; from the next one he offers the tug', () => {
    const taught = { ...facts, flags: ['met-puuvaim', 'known-puuvaim'], taught: ['puuvaim-1'] };
    const first = startTalk(puuvaim, taught)!;
    expect(first).toMatchObject({ node: 'taught', end: true, outcome: { leave: true } });
    expect(first.facts.flags).toContain('puuvaim-taught-said');
    expect(menuOf(first.facts)!.choices.map((c) => c.text)).toEqual(['talk.puuvaim.askTeach', 'talk.puuvaim.askTug', 'talk.puuvaim.askLater']);
  });
});
