// Covers ft_1_22.AC1 (the conversation over the scene: a line, then the choices, a press a step).
import { describe, expect, it } from 'vitest';
import type { Conversation } from './conversation';
import type { TalkFacts } from './talk';
import { chooseInTalk, openTalk, pressInTalk, type TalkFlow } from './talkFlow';

const facts: TalkFacts = { flags: [], items: [], met: [], taught: [], knowledge: false };
const conv = {
  schemaVersion: 1,
  id: 'test',
  start: 'hello',
  nodes: {
    hello: { speaker: 'character', line: 'talk.puuvaim.hello', next: 'menu', effects: [{ setFlag: 'met-test' }] },
    menu: {
      speaker: 'character',
      line: 'talk.puuvaim.menu',
      choices: [
        { text: 'talk.puuvaim.askTie', next: 'tie' },
        { text: 'talk.puuvaim.askLater', next: 'bye' },
      ],
    },
    tie: { speaker: 'character', line: 'character.puuvaim.music', next: 'menu' },
    bye: { speaker: 'character', line: 'talk.puuvaim.bye', effects: [{ leave: true }] },
  },
} as unknown as Conversation;

/** Every line in this test is two pages long, except the choices' (one page). */
const pages = (key: string): number => (key.startsWith('talk.puuvaim.ask') ? 1 : 2);

function step(flow: TalkFlow | null): TalkFlow {
  if (flow === null) throw new Error('the talk ended');
  return flow;
}

describe('the conversation as it is shown (ft_1_22.AC1)', () => {
  it('ft_1_22.AC1 opens on the first line\'s first page, and a press turns the page, then goes on to the next node', () => {
    let flow = step(openTalk(conv, facts, pages));
    expect(flow).toMatchObject({ showing: 'line', page: 0, pages: 2 });
    expect(flow.step.node).toBe('hello');
    expect(flow.newEffects).toEqual([{ setFlag: 'met-test' }]);
    flow = step(pressInTalk(conv, flow, pages));
    expect(flow).toMatchObject({ showing: 'line', page: 1 });
    expect(flow.newEffects).toEqual([]);
    flow = step(pressInTalk(conv, flow, pages));
    expect(flow.step.node).toBe('menu');
    expect(flow.showing).toBe('line');
  });

  it('ft_1_22.AC1 after the last page of a line with choices the choices show; a press does not skip them', () => {
    let flow = step(openTalk(conv, facts, pages));
    for (let i = 0; i < 4; i++) flow = step(pressInTalk(conv, flow, pages));
    expect(flow).toMatchObject({ showing: 'choices' });
    expect(flow.step.choices.map((c) => c.text)).toEqual(['talk.puuvaim.askTie', 'talk.puuvaim.askLater']);
    expect(step(pressInTalk(conv, flow, pages))).toBe(flow);
  });

  it('ft_1_22.AC1 a choice is said by the student, then the talk goes on where it leads', () => {
    let flow = step(openTalk(conv, facts, pages));
    for (let i = 0; i < 4; i++) flow = step(pressInTalk(conv, flow, pages));
    flow = step(chooseInTalk(flow, 0, pages));
    expect(flow).toMatchObject({ showing: 'student', said: 'talk.puuvaim.askTie', page: 0, pages: 1 });
    flow = step(pressInTalk(conv, flow, pages));
    expect(flow.step.node).toBe('tie');
    expect(flow.showing).toBe('line');
  });

  it('ft_1_22.AC1 leaving ends the talk after its last line, with the outcome for the scene', () => {
    let flow = step(openTalk(conv, facts, pages));
    for (let i = 0; i < 4; i++) flow = step(pressInTalk(conv, flow, pages));
    flow = step(chooseInTalk(flow, 1, pages));
    flow = step(pressInTalk(conv, flow, pages));
    expect(flow.step.node).toBe('bye');
    expect(flow.newEffects).toEqual([{ leave: true }]);
    flow = step(pressInTalk(conv, flow, pages));
    const end = pressInTalk(conv, flow, pages);
    expect(end).toBeNull();
    expect(flow.step.outcome).toEqual({ leave: true });
  });

  it('a choice can only be picked while the choices show, and only one that is there', () => {
    const flow = step(openTalk(conv, facts, pages));
    expect(() => chooseInTalk(flow, 0, pages)).toThrow(RangeError);
    let at = flow;
    for (let i = 0; i < 4; i++) at = step(pressInTalk(conv, at, pages));
    expect(() => chooseInTalk(at, 2, pages)).toThrow(RangeError);
  });

  it('a conversation with nothing to say opens nothing', () => {
    const silent = { ...conv, start: 'quiet', nodes: { ...conv.nodes, quiet: { speaker: 'character', line: 'talk.puuvaim.hello', when: { flag: 'never' } } } } as unknown as Conversation;
    expect(openTalk(silent, facts, pages)).toBeNull();
  });
});
