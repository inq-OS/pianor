import { describe, expect, it } from 'vitest';
import { pieceMetaSchema } from '../chart/schema';
import { conversationSchema } from '../dialogue/conversation';
import { continueTalk, lintConversation, startTalk, type TalkFacts } from '../dialogue/talk';
import { headsUpKey } from '../island/presenceRules';
import { strings } from '../text/strings';
import { characterDefSchema, knownFlag, prizeFor } from './character';

const characters = import.meta.glob<unknown>('../../../content/characters/*.json', { eager: true, import: 'default' });
const conversations = import.meta.glob<unknown>('../../../content/conversations/*.json', { eager: true, import: 'default' });
const metas = import.meta.glob<unknown>('../../../content/pieces/*/piece.meta.json', { eager: true, import: 'default' });

const fileId = (path: string) => path.split('/').pop()!.replace(/\.json$/, '');
const pieces = new Map(Object.values(metas).map((m) => pieceMetaSchema.parse(m)).map((m) => [m.id, m]));
const conversationIds = new Set(Object.values(conversations).map((c) => conversationSchema.parse(c).id));

describe('every character in content/characters (ft_1_22.AC2)', () => {
  it('parses, is named by its file, and every reference resolves: keys, its conversation, its phrases', () => {
    expect(Object.keys(characters).length).toBeGreaterThan(0);
    for (const [path, raw] of Object.entries(characters)) {
      const c = characterDefSchema.parse(raw);
      expect(c.id, path).toBe(fileId(path));
      // ft_1_25.AC5: Kiur's heads-up about it, one per scene it may be in
      const keys = [c.musicTie, ...(c.name.kind === 'generated' ? [] : [c.name.name]), ...c.scenes.map((scene) => headsUpKey(c.id, scene))];
      for (const key of keys) expect(key in strings, `${c.id}: ${key}`).toBe(true);
      expect(conversationIds.has(c.conversation), `${c.id}: conversation ${c.conversation}`).toBe(true);
      for (const [level, ids] of Object.entries(c.phrases)) {
        for (const id of ids ?? []) {
          const meta = pieces.get(id);
          expect(meta, `${c.id}: phrase ${id}`).toBeDefined();
          // A phrase's difficulty is its tug level (d138), its style the character's (WP-02 section 3),
          // unless it is an original piece the maintainer approved for the game (d272).
          expect(meta!.difficulty, `${id} difficulty`).toBe(Number(level));
          const approvedOriginal = meta!.status === 'approved' && meta!.styles.includes('original');
          if (!approvedOriginal) expect(meta!.styles.some((s) => (c.styles as readonly string[]).includes(s)), `${id} style`).toBe(true);
        }
      }
    }
  });
});

/**
 * The character rules (d169, d263), held by a test so a new character cannot miss one; the rules a test
 * cannot judge (a folklore name, a tune that fits, true facts) are the checklist in docs/architect/cast-and-phrases.md.
 */
describe('every character keeps the character rules (ft_1_22.AC10)', () => {
  const convs = new Map(Object.values(conversations).map((raw) => conversationSchema.parse(raw)).map((c) => [c.id, c]));

  it('ft_1_22.AC10 is "???" until the student picks a choice that asks who they are: no talk names them on the way', () => {
    for (const raw of Object.values(characters)) {
      const c = characterDefSchema.parse(raw);
      const conv = convs.get(c.conversation)!;
      const naming = Object.entries(conv.nodes).filter(([, n]) => (n.effects ?? []).some((e) => 'setFlag' in e && e.setFlag === knownFlag(c.id)));
      expect(naming.length, `${c.id}: a node that sets ${knownFlag(c.id)}`).toBeGreaterThan(0);
      for (const [id] of naming) {
        expect(id, `${c.id}: the talk opens on its naming node`).not.toBe(conv.start);
        // reached only by a choice the student picks, never by walking on (talking and leaving is not enough)
        const walkedInto = Object.entries(conv.nodes).filter(([, n]) => n.next === id).map(([from]) => from);
        expect(walkedInto, `${c.id}: ${id} is reached without a choice`).toEqual([]);
        expect(Object.values(conv.nodes).some((n) => (n.choices ?? []).some((ch) => ch.next === id)), `${c.id}: a choice leads to ${id}`).toBe(true);
      }
      expect(lintConversation(conv, { hasKey: (k) => k in strings }), `${c.id}: the AX-0 test`).toEqual([]);
    }
  });

  it('plays only pieces with an open licence and a named source, and tells about each one it teaches', () => {
    for (const raw of Object.values(characters)) {
      const c = characterDefSchema.parse(raw);
      for (const id of Object.values(c.phrases).flat()) {
        const meta = pieces.get(id)!;
        // a draft until the maintainer approves it in the piece preview (d025)
        expect(['draft', 'approved'], `${id} status`).toContain(meta.status);
        expect(['public-domain', 'CC0-1.0'], `${id} licence`).toContain(meta.license);
        expect(meta.source.trim().length, `${id} source`).toBeGreaterThan(0);
        expect(`piece.${id}.about` in strings, `${id}: the string piece.${id}.about, what the character tells about it`).toBe(true);
      }
      // the node that teaches a piece says its about line first
      for (const [node, n] of Object.entries(convs.get(c.conversation)!.nodes)) {
        for (const e of n.effects ?? []) if ('teach' in e) expect(n.line, `${c.id}: ${node} teaches ${e.teach}`).toBe(`piece.${e.teach}.about`);
      }
    }
  });
});

describe('every conversation in content/conversations (ft_1_22.AC2)', () => {
  it('teaches and checks only pieces that exist', () => {
    for (const raw of Object.values(conversations)) {
      const conv = conversationSchema.parse(raw);
      for (const effect of Object.values(conv.nodes).flatMap((n) => n.effects ?? [])) {
        const id = 'teach' in effect ? effect.teach : 'checkup' in effect ? effect.checkup : undefined;
        if (id !== undefined) expect(pieces.has(id), `${conv.id}: piece ${id}`).toBe(true);
      }
    }
  });
});

describe('the prize ladder (ft_1_21.AC18)', () => {
  it('ft_1_21.AC18 a won tug at level N gives rung N, the first for level 1; past the top or with no ladder, nothing', () => {
    const def = { prizes: ['leaf', 'acorn', 'gold'] };
    expect([1, 2, 3].map((level) => prizeFor(def, level))).toEqual(['leaf', 'acorn', 'gold']);
    expect([0, 4, 1.5].map((level) => prizeFor(def, level))).toEqual([undefined, undefined, undefined]);
    expect(prizeFor({}, 1)).toBeUndefined();
    expect(() => characterDefSchema.parse({ ...(Object.values(characters)[0] as object), prizes: [] })).toThrow();
  });

  it('ft_1_21.AC18 Puuvaim\'s ladder climbs from a plain oak leaf at level 1 to the seed of life, five rungs, one per level', () => {
    const puuvaim = characterDefSchema.parse(Object.entries(characters).find(([p]) => fileId(p) === 'puuvaim')![1]);
    expect(puuvaim.prizes).toEqual(['oak-leaf', 'acorn', 'golden-leaf', 'singing-branch', 'seed-of-life']);
  });
});

describe("Puuvaim, the first character (WP-11)", () => {
  it('is a folk spirit on the knoll whose conversation teaches its level 1 phrase and passes the AX-0 test (ft_1_22.AC1)', () => {
    const raw = Object.entries(characters).find(([p]) => fileId(p) === 'puuvaim')![1];
    const puuvaim = characterDefSchema.parse(raw);
    expect(puuvaim).toMatchObject({ kind: 'spirit', styles: ['folk'], scenes: ['knoll'] });
    const conv = conversationSchema.parse(Object.entries(conversations).find(([p]) => fileId(p) === 'puuvaim')![1]);
    expect(lintConversation(conv, { hasKey: (k) => k in strings })).toEqual([]);
    const teaches = Object.values(conv.nodes).flatMap((n) => n.effects ?? []).filter((e) => 'teach' in e);
    expect(teaches).toEqual([{ teach: puuvaim.phrases[1]![0] }]);
    for (const id of Object.values(puuvaim.phrases).flat()) expect(['draft', 'approved'], id).toContain(pieces.get(id)!.status);
  });

  it('plays its first talk, a later talk, the invitation to the tug and the talk after teaching as cast-and-phrases.md section 5 drafts them', () => {
    const conv = conversationSchema.parse(Object.entries(conversations).find(([p]) => fileId(p) === 'puuvaim')![1]);
    const facts: TalkFacts = { flags: [], items: [], met: [], taught: [], level: 1, knowledge: false };
    const lines = (step: ReturnType<typeof startTalk>, picks: number[]): string[] => {
      const seen: string[] = [];
      let s = step;
      while (s !== null) {
        seen.push(s.line);
        s = s.end ? null : continueTalk(conv, s, s.choices.length > 0 ? picks.shift() : undefined);
      }
      return seen;
    };
    const first = startTalk(conv, facts)!;
    // the first talk: his greeting and his music tie, then his menu: who he is, teach or leave; no tug before he taught (ft_1_22.AC1, AC10)
    expect(lines(first, [1])).toEqual(['talk.puuvaim.hello', 'character.puuvaim.music', 'talk.puuvaim.menu', 'piece.both-hands.about']);
    // asked who he is, he answers and offers his menu again
    expect(lines(startTalk(conv, facts), [0, 0])).toEqual(['talk.puuvaim.hello', 'character.puuvaim.music', 'talk.puuvaim.menu', 'talk.puuvaim.who', 'piece.both-hands.about']);
    expect(lines(startTalk(conv, { ...facts, flags: ['met-puuvaim', 'known-puuvaim'] }), [1])).toEqual(['talk.puuvaim.menu', 'talk.puuvaim.bye']);
    // the first talk after teaching: his taught line, and he leaves
    const after = startTalk(conv, { ...facts, flags: ['met-puuvaim'], taught: ['both-hands'] })!;
    expect(after.line).toBe('talk.puuvaim.taught');
    expect(after.outcome).toEqual({ leave: true });
    // a later talk: the menu offers the tug, the invitation
    const tug = continueTalk(conv, startTalk(conv, { ...after.facts, flags: [...after.facts.flags, 'known-puuvaim'] })!, 1)!;
    expect(tug.line).toBe('talk.puuvaim.tug');
    expect(tug.outcome).toEqual({ tug: 1 });
  });
});
