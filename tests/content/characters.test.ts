// Every character in content/characters keeps the character rules (d169), as pieces.test.ts holds every piece to
// piece:lint. A new character that breaks one fails CI with the rule it broke (`src/core/character/rules.ts`). A
// character still being made lists its known gaps here exactly, so the list can only shrink.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { characterDefSchema } from '../../src/core/character/character';
import { castProblems, characterProblems, type CharacterFacts } from '../../src/core/character/rules';
import { conversationSchema } from '../../src/core/dialogue/conversation';
import { parseItems } from '../../src/core/item/item';
import { strings, type StringKey } from '../../src/core/text/strings';
import { stringsEt } from '../../src/core/text/strings.et';
import { PRIZE_PICTURES } from '../../src/game/ui/pixel/prizeArt';
import { checkPieceFolder, listPieceFolders } from '../../tools/piece/folder';
import { loadLevelsFile } from '../../tools/piece/levels';

const root = join(__dirname, '../..');
const read = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
const piecesDir = join(root, 'content/pieces');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
const pieces = new Map(listPieceFolders(piecesDir).flatMap((folder) => {
  const compiled = checkPieceFolder(piecesDir, folder, levels).compiled;
  const chart = compiled?.chart, meta = compiled?.meta;
  return chart && meta ? [[chart.id, { bars: chart.bars.length, source: meta.source, license: meta.license, status: meta.status }] as const] : [];
}));
const conversations = new Map(readdirSync(join(root, 'content/conversations')).filter((f) => f.endsWith('.json')).map((f) => {
  const conv = conversationSchema.parse(read(`content/conversations/${f}`));
  return [conv.id, conv] as const;
}));
const items = parseItems(read('content/items/items.json'));
const characters = readdirSync(join(root, 'content/characters')).filter((f) => f.endsWith('.json'))
  .map((f) => characterDefSchema.parse(read(`content/characters/${f}`)));

const facts: CharacterFacts = {
  piece: (id) => pieces.get(id),
  conversation: (id) => conversations.get(id),
  item: (id) => items.get(id),
  text: (key) => (key in strings ? { et: stringsEt[key as StringKey], en: strings[key as StringKey] } : undefined),
  keys: Object.keys(strings),
  hasActor: (id) => existsSync(join(root, `content/actors/${id}.json`)),
  drawn: (picture) => picture in PRIZE_PICTURES,
};

describe('every character keeps the character rules (content/characters)', () => {
  it('there is at least one character to check', () => {
    expect(characters.length).toBeGreaterThan(0);
  });

  /** What a character still being made lacks (each a tag in its doc); a gap closed must come off this list. */
  const GAPS: Record<string, readonly string[]> = {
    // TODO(painter, R2) in ft_1_21: the fisherman's five prize pictures
    fisherman: ['net-float', 'net-needle', 'gull-feather', 'holed-stone', 'ships-bell'].map((id) => `fisherman: prize ${id} has no drawn picture`),
  };

  for (const def of characters) {
    it(`ft_1_21.AC18 ${def.id}: levels of 4 to 16 bars of a real public-domain song with its background told, a lesson on its specialty, its name ??? until known, a better prize for every level, Estonian sentence-case words with no label word, its art drawn`, () => {
      expect(characterProblems(def, facts)).toEqual(GAPS[def.id] ?? []);
    });
  }

  it('ft_1_21.AC18 no prize is on two characters\' ladders', () => {
    expect(castProblems(characters)).toEqual([]);
  });

  // The final tug of the whole song waits for the song levels: TODO(builder, R2) in ft_1_32 slice 4.
  it.todo('the final level is the whole song as a tug (ft_1_32 slice 4, not built yet)');
});
