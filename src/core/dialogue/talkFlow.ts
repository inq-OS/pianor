/**
 * The conversation as it is shown (ft_1_22.AC1, WP-09): the steps of the dialogue engine (`talk.ts`) in the order the
 * student sees them, in the manner of MI2. A line is shown a page at a time and a press turns the page; after a line's
 * last page its choices show and only a choice goes on; the chosen choice is said by the student first; a node with no
 * choices goes on by a press. Pure: the scene draws `TalkFlow` and passes presses and choices in; `pages` says how many
 * pages a line's words take in the game's font (`talkArt.spokenPages`), so the layout stays out of here.
 */
import type { StringKey } from '../contracts';
import type { Conversation, Effect } from './conversation';
import { continueTalk, startTalk, type TalkFacts, type TalkStep } from './talk';

export interface TalkFlow {
  readonly step: TalkStep;
  /** What is on screen: a line of the node's speaker, the student saying the chosen choice, or the choices to pick from. */
  readonly showing: 'line' | 'student' | 'choices';
  /** The page of the line on screen, from 0, of `pages`. */
  readonly page: number;
  readonly pages: number;
  /** The choice the student says (`showing` is `student`), and its index among the step's choices. */
  readonly said?: StringKey;
  readonly chosen?: number;
  /** The effects of a node shown just now (once per node): the scene applies them to the world. */
  readonly newEffects: readonly Effect[];
}

type Pages = (line: StringKey) => number;

function lineOf(step: TalkStep, pages: Pages): TalkFlow {
  return { step, showing: 'line', page: 0, pages: Math.max(1, pages(step.line)), newEffects: step.effects };
}

/** The talk as it opens; null when the conversation has nothing to say with these facts. */
export function openTalk(conv: Conversation, facts: TalkFacts, pages: Pages): TalkFlow | null {
  const step = startTalk(conv, facts);
  return step ? lineOf(step, pages) : null;
}

/**
 * A press (a click anywhere, Space or Enter): the next page, or after a line's last page the choices or the next node.
 * While the choices show a press changes nothing. Null when the talk is over: the scene reads the last step's `outcome`.
 */
export function pressInTalk(conv: Conversation, flow: TalkFlow, pages: Pages): TalkFlow | null {
  if (flow.showing === 'choices') return flow;
  if (flow.page + 1 < flow.pages) return { ...flow, page: flow.page + 1, newEffects: [] };
  if (flow.showing === 'student') {
    const next = continueTalk(conv, flow.step, flow.chosen);
    return next ? lineOf(next, pages) : null;
  }
  if (flow.step.choices.length > 0) return { ...flow, showing: 'choices', page: 0, pages: 1, newEffects: [] };
  const next = continueTalk(conv, flow.step);
  return next ? lineOf(next, pages) : null;
}

/** The student picks choice `index` of the ones shown: they say it, a page at a time, and then the talk goes on. */
export function chooseInTalk(flow: TalkFlow, index: number, pages: Pages): TalkFlow {
  const choice = flow.showing === 'choices' ? flow.step.choices[index] : undefined;
  if (choice === undefined) throw new RangeError(flow.showing === 'choices' ? `pick one of ${flow.step.choices.length} choices, got ${index}` : 'no choices are shown');
  return { ...flow, showing: 'student', said: choice.text, chosen: index, page: 0, pages: Math.max(1, pages(choice.text)), newEffects: [] };
}
