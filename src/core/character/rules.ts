/**
 * The rules every character in `content/characters/` must keep ([d169](../../../docs/decisions/game.md#d169)), checked over
 * every character by `tests/content/characters.test.ts` in CI, as `piece:lint` checks pieces:
 * - its levels run from 1 with none skipped (up to 3), each teaching 4 to 16 bars of a real public-domain song, or a line written
 *   in the manner of a named folk tradition (d263);
 * - each level's piece has its background, one line (`piece.<id>.about`), said in its talk where the talk teaches it,
 *   and the talk teaches something of its specialty (`lessons`);
 * - its name shows as "???" until its known flag (`knownFlag`) is set, and only a node reached through a choice (asking
 *   who it is) sets it: opening and closing a talk is not enough;
 * - every level beaten gives a new, drawn rung of its prize ladder (ft_1_21.AC18), no rung shared with another character;
 * - its words are Estonian (shown in capitals, d170) with no label word such as VÄLJAKUTSE (Q5 to Q7), its figure exists.
 * Pure: the test hands it what the content holds.
 */
import type { Conversation } from '../dialogue/conversation';
import type { ItemId, PieceId } from '../contracts';
import { knownFlag, type CharacterDef } from './character';

/** What the content holds, as the check needs it. */
export interface CharacterFacts {
  /** A piece's bar count and its meta's source and licence, or undefined when no such piece compiles. */
  readonly piece: (piece: PieceId) => { readonly bars: number; readonly source: string; readonly license: string } | undefined;
  /** A conversation, or undefined when there is no such conversation. */
  readonly conversation: (id: string) => Conversation | undefined;
  /** An item's name key and picture key, or undefined when it is not in `content/items/items.json`. */
  readonly item: (id: ItemId) => { readonly name: string; readonly picture?: string } | undefined;
  /** The Estonian and English text of a key, or undefined when the catalog lacks it. */
  readonly text: (key: string) => { readonly et: string; readonly en: string } | undefined;
  /** Every string key the catalog has. */
  readonly keys: readonly string[];
  /** The actor exists in `content/actors/`. */
  readonly hasActor: (id: string) => boolean;
  /** The prize picture key is drawn (`prizeArt.ts`). */
  readonly drawn: (picture: string) => boolean;
}

/** A level teaches a piece of this many bars (ft_1_32 rule 2: one chunk of 4 up to about 16). */
export const LEVEL_BARS = { min: 4, max: 16 } as const;

/** Stems of words that name a thing instead of letting a character speak (Q5 to Q7: no label word on screen). Lower case. */
export const LABEL_STEMS = ['väljakutse', 'tegelas', 'tegelane', 'lahing', 'võitlus', 'koletis', 'vastas', 'boss'] as const;

/** A source that says the piece was made for the game, not found in the world. */
const MADE_HERE = /\boriginal\b|\bcomposed by\b|\bgenerated\b|\bwritten for pianor\b/i;
/** A source that says the piece was written in the manner of a folk tradition it names (d263): open licence, not a copy. */
const IN_THE_MANNER = /\bin the manner of an? [\p{L} ]*\b(?:folk|runo|regilaul|traditional)\b/iu;
const OPEN_LICENCES: readonly string[] = ['public-domain', 'CC0-1.0'];

type Say = (line: string) => void;

/** Every rule the character breaks, one line each; empty when it keeps them all. */
export function characterProblems(def: CharacterDef, facts: CharacterFacts): string[] {
  const out: string[] = [];
  const say: Say = (line) => out.push(`${def.id}: ${line}`);
  const checkText = (key: string, what: string) => textProblems(facts, key, what, say);
  const levels = levelProblems(def, facts, say);
  talkProblems(def, facts, say, checkText);
  prizeProblems(def, levels.length, facts, say, checkText);
  // its figure
  if (!facts.hasActor(def.actor)) say(`actor ${def.actor} is not in content/actors`);
  // its words: its name, its tie to music and every line of its talk
  if (def.name.kind !== 'generated') checkText(def.name.name, 'its name');
  checkText(def.musicTie, 'its music tie');
  const lines = facts.keys.filter((key) => key.startsWith(`talk.${def.id}.`));
  if (lines.length === 0) say(`has no lines (talk.${def.id}.*)`);
  for (const key of lines) checkText(key, key);
  return out;
}

/** The levels: 1, 2, 3 with none skipped, each teaching 4 to 16 bars of a real public-domain song. Gives the levels. */
function levelProblems(def: CharacterDef, facts: CharacterFacts, say: Say): number[] {
  const levels = Object.keys(def.phrases).map(Number).sort((a, b) => a - b);
  if (levels.length === 0) say('teaches no level');
  levels.forEach((level, i) => { if (level !== i + 1) say(`level ${level} comes with no level ${i + 1} before it`); });
  for (const level of levels) {
    const pieces = def.phrases[level as 1 | 2 | 3] ?? [];
    if (pieces.length === 0) say(`level ${level} teaches no piece`);
    for (const piece of pieces) {
      const meta = facts.piece(piece);
      if (meta === undefined) { say(`level ${level}: piece ${piece} does not exist or does not compile`); continue; }
      if (meta.bars < LEVEL_BARS.min || meta.bars > LEVEL_BARS.max) say(`level ${level}: piece ${piece} has ${meta.bars} bars, not ${LEVEL_BARS.min} to ${LEVEL_BARS.max}`);
      const real = meta.license === 'public-domain' && !MADE_HERE.test(meta.source);
      const manner = OPEN_LICENCES.includes(meta.license) && IN_THE_MANNER.test(meta.source);
      if (!real && !manner) say(`level ${level}: piece ${piece} is not a real public-domain piece (source "${meta.source}", licence ${meta.license})`);
    }
  }
  return levels;
}

/** Its talk: each piece's background told, a lesson on its specialty, its name learned only by asking. */
function talkProblems(def: CharacterDef, facts: CharacterFacts, say: Say, checkText: (key: string, what: string) => void): void {
  const conv = facts.conversation(def.conversation);
  if (conv === undefined) say(`conversation ${def.conversation} does not exist`);
  const nodes = Object.values(conv?.nodes ?? {});
  const spoken = new Set(nodes.map((node) => node.line));
  const taughtHere = new Set(nodes.flatMap((node) => node.effects?.flatMap((e) => ('teach' in e ? [e.teach] : [])) ?? []));
  for (const piece of Object.values(def.phrases).flat()) {
    const about = `piece.${piece}.about`;
    checkText(about, `piece ${piece}'s background`);
    if (taughtHere.has(piece) && !spoken.has(about)) say(`piece ${piece}'s background (${about}) is never said in its talk`);
  }
  if (!def.lessons?.length) say('teaches no lesson about its specialty (lessons)');
  for (const lesson of def.lessons ?? []) {
    checkText(lesson, `lesson ${lesson}`);
    if (!spoken.has(lesson)) say(`lesson ${lesson} is never said in its talk`);
  }
  if (conv && !knownThroughChoice(conv, knownFlag(def.id))) say(`its known flag ${knownFlag(def.id)} is not set only after a choice (asking who it is)`);
}

/** The prize ladder (ft_1_21.AC18): a rung for every level, each a different item, each named and drawn. */
function prizeProblems(def: CharacterDef, levels: number, facts: CharacterFacts, say: Say, checkText: (key: string, what: string) => void): void {
  const prizes = def.prizes ?? [];
  if (prizes.length < levels) say(`the prize ladder has ${prizes.length} rungs for ${levels} levels`);
  if (new Set(prizes).size !== prizes.length) say('a rung of the prize ladder repeats an earlier one, so beating a level gives nothing better');
  for (const id of prizes) {
    const item = facts.item(id);
    if (!item) { say(`prize ${id} is not an item`); continue; }
    checkText(item.name, `prize ${id}'s name`);
    if (item.picture === undefined || !facts.drawn(item.picture)) say(`prize ${id} has no drawn picture`);
  }
}

/** A line the student sees: there, in Estonian (not left in English), with no label word. */
function textProblems(facts: CharacterFacts, key: string, what: string, say: Say): void {
  const text = facts.text(key);
  if (!text) { say(`${what}: no text for ${key}`); return; }
  if (text.et.trim() === '') say(`${what}: no Estonian`);
  // a sentence left in English: more than one word and the same in both catalogs (a name may be the same)
  else if (text.et === text.en && /\s/.test(text.et.trim())) say(`${what}: the Estonian is the English`);
  const words = text.et.toLowerCase().split(/[^\p{L}]+/u);
  for (const stem of LABEL_STEMS) if (words.some((word) => word.startsWith(stem))) say(`${what}: the label word "${stem.toUpperCase()}" on screen`);
}

/** Problems across the cast: a prize on two ladders would show the wrong rung in the backpack (`backpackInventory`). */
export function castProblems(defs: readonly Pick<CharacterDef, 'id' | 'prizes'>[]): string[] {
  const owner = new Map<ItemId, string>();
  const out: string[] = [];
  for (const def of defs) {
    for (const id of def.prizes ?? []) {
      const first = owner.get(id);
      if (first !== undefined && first !== def.id) out.push(`prize ${id} is on the ladders of ${first} and ${def.id}`);
      else owner.set(id, def.id);
    }
  }
  return out;
}

/**
 * Whether `flag` is set only after the student chose something: some node sets it, and no node on the way from the start
 * without a choice sets it, so opening and closing a talk never sets it.
 */
function knownThroughChoice(conv: Conversation, flag: string): boolean {
  const sets = (id: string) => conv.nodes[id]?.effects?.some((e) => 'setFlag' in e && e.setFlag === flag) ?? false;
  // the nodes reached from the start by `next` alone, before any choice
  const free = new Set<string>();
  for (let id: string | undefined = conv.start; id !== undefined && !free.has(id); id = conv.nodes[id]?.next) free.add(id);
  if ([...free].some(sets)) return false;
  const seen = new Set<string>();
  const queue = Object.values(conv.nodes).flatMap((node) => node.choices?.map((c) => c.next) ?? []);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id) || !conv.nodes[id]) continue;
    seen.add(id);
    if (sets(id)) return true;
    const node = conv.nodes[id];
    if (node.next !== undefined) queue.push(node.next);
    for (const c of node.choices ?? []) queue.push(c.next);
  }
  return false;
}
