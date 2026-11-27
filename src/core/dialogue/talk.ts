/**
 * The dialogue engine (ft_1_22, WP-09; contract A.6): steps a `Conversation` over what the player's world knows, and its
 * linter with the AX-0 test (every branch reaches playing or leaving within 4 presses). Pure: the caller (the scene, WP-09's
 * 10x dev part) draws each step and hands the effects to the world state (WP-08) and the exchange (WP-10).
 */
import type { CharacterId, ItemId, NodeId, PieceId, StringKey } from '../contracts';
import type { Choice, Condition, Conversation, ConversationNode, Effect, Speaker } from './conversation';

/** What a conversation's conditions read: the player's world (WP-08's `WorldState` gives most of it) and settings. */
export interface TalkFacts {
  readonly flags: readonly string[];
  readonly items: readonly ItemId[];
  /** Characters the player has met. */
  readonly met: readonly CharacterId[];
  /** Phrases a character has taught the player. */
  readonly taught: readonly PieceId[];
  /** The per-player knowledge switch (d132). */
  readonly knowledge: boolean;
  /** The pieces the character may teach now (approved, or picked by the teacher); absent: every piece. A choice that leads straight to teaching another is not offered. */
  readonly teachable?: readonly PieceId[];
}

/** The effects that start playing (`teach`, `tug`, `checkup`) or leave: a node that has one ends the talk. */
export type Outcome = Extract<Effect, { teach: PieceId } | { tug: 1 | 2 | 3 } | { checkup: PieceId } | { leave: true }>;

/** One node as shown: the line, the choices the student may pick, and what showing it did. */
export interface TalkStep {
  readonly node: NodeId;
  readonly speaker: Speaker;
  readonly line: StringKey;
  /** The choices whose condition holds, in order; pass the index into this list to `continueTalk`. */
  readonly choices: readonly Choice[];
  /** Every effect of the node, in order; the caller applies them to the world. */
  readonly effects: readonly Effect[];
  /** The facts after the node's flag and item effects, which later conditions read. */
  readonly facts: TalkFacts;
  /** The node's outcome, if it has one: the caller starts playing or closes the talk. */
  readonly outcome?: Outcome;
  /** The talk is over after this node (an outcome, or nothing follows). */
  readonly end: boolean;
}

export function conditionHolds(c: Condition, f: TalkFacts): boolean {
  if ('flag' in c) return f.flags.includes(c.flag);
  if ('notFlag' in c) return !f.flags.includes(c.notFlag);
  if ('hasItem' in c) return f.items.includes(c.hasItem);
  if ('met' in c) return f.met.includes(c.met);
  if ('taught' in c) return f.taught.includes(c.taught);
  if ('knowledge' in c) return f.knowledge === c.knowledge;
  if ('all' in c) return c.all.every((x) => conditionHolds(x, f));
  return c.any.some((x) => conditionHolds(x, f));
}

function outcomeOf(e: Effect): e is Outcome {
  return 'teach' in e || 'tug' in e || 'checkup' in e || 'leave' in e;
}

function applyEffect(f: TalkFacts, e: Effect): TalkFacts {
  if ('setFlag' in e) return f.flags.includes(e.setFlag) ? f : { ...f, flags: [...f.flags, e.setFlag] };
  if ('clearFlag' in e) return { ...f, flags: f.flags.filter((x) => x !== e.clearFlag) };
  if ('give' in e) return f.items.includes(e.give) ? f : { ...f, items: [...f.items, e.give] };
  if ('take' in e) return { ...f, items: f.items.filter((x) => x !== e.take) };
  return f;
}

/** Whether the node a choice leads to teaches only pieces the character may teach now (`TalkFacts.teachable`). */
function teachesAllowed(node: ConversationNode | undefined, f: TalkFacts): boolean {
  const teachable = f.teachable;
  if (teachable === undefined || node === undefined) return true;
  return (node.effects ?? []).every((e) => !('teach' in e) || teachable.includes(e.teach));
}

/** Show `id`, skipping nodes whose condition fails to their `next`; null when the talk ends on the way. */
function show(conv: Conversation, id: NodeId | undefined, facts: TalkFacts): TalkStep | null {
  const skipped = new Set<NodeId>();
  let current = id;
  while (current !== undefined) {
    const node: ConversationNode | undefined = conv.nodes[current];
    if (node === undefined || skipped.has(current)) return null;
    if (node.when !== undefined && !conditionHolds(node.when, facts)) {
      skipped.add(current);
      current = node.next;
      continue;
    }
    const effects = node.effects ?? [];
    const after = effects.reduce(applyEffect, facts);
    const outcome = effects.find(outcomeOf);
    const choices = (node.choices ?? []).filter((ch) => (ch.when === undefined || conditionHolds(ch.when, after)) && teachesAllowed(conv.nodes[ch.next], after));
    return {
      node: current,
      speaker: node.speaker,
      line: node.line,
      choices,
      effects,
      facts: after,
      ...(outcome !== undefined ? { outcome } : {}),
      end: outcome !== undefined || (choices.length === 0 && node.next === undefined),
    };
  }
  return null;
}

/** The first node shown when the talk opens; null if the conversation has nothing to say with these facts. */
export function startTalk(conv: Conversation, facts: TalkFacts): TalkStep | null {
  return show(conv, conv.start, facts);
}

/**
 * The next node after `step`: by the chosen choice (an index into `step.choices`) when there are choices, otherwise by the
 * node's `next`. Null when the talk is over.
 */
export function continueTalk(conv: Conversation, step: TalkStep, choice?: number): TalkStep | null {
  if (step.choices.length > 0) {
    const picked = choice === undefined ? undefined : step.choices[choice];
    if (picked === undefined) throw new RangeError(`pick one of ${step.choices.length} choices, got ${choice}`);
    return show(conv, picked.next, step.facts);
  }
  if (choice !== undefined) throw new RangeError(`node ${step.node} has no choices`);
  if (step.end) return null;
  return show(conv, conv.nodes[step.node]?.next, step.facts);
}

export interface TalkLintIssue {
  readonly node?: NodeId;
  readonly message: string;
}

/** Presses the student may need before a branch plays or leaves (the AX-0 test, A.6). */
const MAX_PRESSES = 4;

/**
 * Checks a conversation (WP-09's linter, A.6): the start and every target exist, every node is reachable, no node has both
 * choices and `next`, a node with an outcome has one and nothing after it (unless a condition can skip it), every key is
 * known (with `hasKey`), not every choice of a node has a condition, every node can reach playing or leaving by a way no condition hides,
 * and every
 * branch reaches playing or leaving within 4 presses, whatever the conditions say (the AX-0 test). A branch that comes
 * back to a node it passed (a menu offered again) ends there, since that node's other ways on are checked. Only the first
 * failing branch is reported.
 */
export function lintConversation(conv: Conversation, opts: { hasKey?: (key: StringKey) => boolean } = {}): TalkLintIssue[] {
  if (conv.nodes[conv.start] === undefined) return [{ message: `the start node ${conv.start} does not exist` }];
  const issues: TalkLintIssue[] = [];
  const targets = (n: ConversationNode): NodeId[] => [...(n.choices ?? []).map((c) => c.next), ...(n.next !== undefined ? [n.next] : [])];

  for (const [id, node] of Object.entries(conv.nodes)) {
    for (const t of targets(node)) if (conv.nodes[t] === undefined) issues.push({ node: id, message: `goes to ${t}, which does not exist` });
    // a node with a condition may have both: `next` is where it is skipped to
    if (node.choices !== undefined && node.next !== undefined && node.when === undefined) issues.push({ node: id, message: 'has both choices and next' });
    if (node.choices !== undefined && node.choices.every((c) => c.when !== undefined)) {
      issues.push({ node: id, message: 'every choice has a condition: give one choice none, or the talk can end with nothing to pick' });
    }
    const outcomes = (node.effects ?? []).filter(outcomeOf);
    if (outcomes.length > 1) issues.push({ node: id, message: 'has more than one of teach, tug, checkup and leave' });
    if (outcomes.length > 0 && (node.choices !== undefined || (node.next !== undefined && node.when === undefined))) {
      issues.push({ node: id, message: 'ends the talk (teach, tug, checkup or leave) but has choices or a next after it' });
    }
    if (opts.hasKey) {
      for (const key of [node.line, ...(node.choices ?? []).map((c) => c.text)]) {
        if (!opts.hasKey(key)) issues.push({ node: id, message: `missing string key ${key}` });
      }
    }
  }

  const reached = new Set<NodeId>([conv.start]);
  const queue = [conv.start];
  while (queue.length > 0) {
    const node = conv.nodes[queue.pop()!];
    if (node === undefined) continue;
    for (const t of targets(node)) {
      if (!reached.has(t)) {
        reached.add(t);
        queue.push(t);
      }
    }
  }
  for (const id of Object.keys(conv.nodes)) if (!reached.has(id)) issues.push({ node: id, message: 'is never reached from the start' });

  for (const id of Object.keys(conv.nodes)) {
    if (!reachesOutcome(conv, id)) issues.push({ node: id, message: 'can never reach playing or leaving' });
  }

  const failing = failingBranch(conv, conv.start, MAX_PRESSES, new Set(), []);
  if (failing !== null) issues.push({ node: conv.start, message: `a branch does not reach playing or leaving within ${MAX_PRESSES} presses: ${failing}` });
  return issues;
}

/**
 * Some path from `id` reaches playing or leaving that no condition can hide: it follows `next` and only the choices
 * without a condition, and counts a node's outcome only when the node has no condition of its own (a skipped node's
 * outcome never happens). So a loop (the music tie, then the menu again) always has a way out.
 */
function reachesOutcome(conv: Conversation, id: NodeId): boolean {
  const seen = new Set<NodeId>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const node = conv.nodes[current];
    if (node === undefined) continue;
    if (node.when === undefined && (node.effects ?? []).some(outcomeOf)) return true;
    queue.push(...(node.choices ?? []).filter((c) => c.when === undefined).map((c) => c.next), ...(node.next !== undefined ? [node.next] : []));
  }
  return false;
}

/** The first branch from `id` that does not reach an outcome within `budget` presses, as text, or null. */
function failingBranch(conv: Conversation, id: NodeId, budget: number, skipped: ReadonlySet<NodeId>, path: readonly NodeId[]): string | null {
  const node = conv.nodes[id];
  if (node === undefined) return null; // reported as a missing target
  // Back at a node of this branch (the music tie, then the menu again): the student is where they were, and that node's
  // other ways on are checked from its first visit; a loop with no way out fails `reachesOutcome`.
  if (path.includes(id)) return null;
  const here = [...path, id];
  const trail = here.join(' > ');
  if (node.when !== undefined) {
    // A condition may skip the node to its next without a press.
    if (node.next === undefined) return `${trail} (skipped by its condition, the talk ends)`;
    if (skipped.has(id)) return `${trail} (skipped nodes go round)`;
    const viaSkip = failingBranch(conv, node.next, budget, new Set([...skipped, id]), here);
    if (viaSkip !== null) return viaSkip;
  }
  if ((node.effects ?? []).some(outcomeOf)) return null;
  const next = node.choices !== undefined ? node.choices.map((c) => c.next) : node.next !== undefined ? [node.next] : [];
  if (next.length === 0) return `${trail} (the talk ends)`;
  if (budget === 0) return `${trail} > ...`;
  for (const t of next) {
    const failed = failingBranch(conv, t, budget - 1, new Set(), here);
    if (failed !== null) return failed;
  }
  return null;
}
