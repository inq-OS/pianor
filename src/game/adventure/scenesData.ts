import { sceneDataSchema, type SceneData } from '../../core/scene/scene';
import { actorDefSchema, type ActorDef } from '../../core/scene/actor';
import { scriptSchema, type Script } from '../../core/scene/script';
import { characterDefSchema, type CharacterDef } from '../../core/character/character';
import { conversationSchema, type Conversation } from '../../core/dialogue/conversation';
import { parseTugRules, type TugRules } from '../../core/exchange/tug';
import tugRulesJson from '../../../content/challenge/rules.json';
import itemsJson from '../../../content/items/items.json';
import { parseItems, type ItemDef } from '../../core/item/item';

const sceneFiles = import.meta.glob<unknown>('../../../content/scenes/*.json', { eager: true, import: 'default' });
const actorFiles = import.meta.glob<unknown>('../../../content/actors/*.json', { eager: true, import: 'default' });

/** Every scene of `content/scenes/` by its id, validated once (ft_1_24.AC1). */
export const SCENES: ReadonlyMap<string, SceneData> = new Map(Object.values(sceneFiles).map((raw) => {
  const scene = sceneDataSchema.parse(raw);
  return [scene.id, scene];
}));

/** Every actor of `content/actors/` by its id, validated once (ft_1_24.AC3). */
export const ACTORS: ReadonlyMap<string, ActorDef> = new Map(Object.values(actorFiles).map((raw) => {
  const actor = actorDefSchema.parse(raw);
  return [actor.id, actor];
}));

const scriptFiles = import.meta.glob<unknown>('../../../content/scripts/*.json', { eager: true, import: 'default' });

/** Every script of `content/scripts/` by its id, validated once (ft_1_24.AC6). */
export const SCRIPTS: ReadonlyMap<string, Script> = new Map(Object.values(scriptFiles).map((raw) => {
  const script = scriptSchema.parse(raw);
  return [script.id, script];
}));

const characterFiles = import.meta.glob<unknown>('../../../content/characters/*.json', { eager: true, import: 'default' });
const conversationFiles = import.meta.glob<unknown>('../../../content/conversations/*.json', { eager: true, import: 'default' });

/** Every character of `content/characters/` by its id, validated once (ft_1_22.AC2). */
export const CHARACTERS: ReadonlyMap<string, CharacterDef> = new Map(Object.values(characterFiles).map((raw) => {
  const character = characterDefSchema.parse(raw);
  return [character.id, character];
}));

/** Every conversation of `content/conversations/` by its id, validated once (ft_1_22.AC1; the linter runs in a unit test). */
export const CONVERSATIONS: ReadonlyMap<string, Conversation> = new Map(Object.values(conversationFiles).map((raw) => {
  const conversation = conversationSchema.parse(raw);
  return [conversation.id, conversation];
}));

/** The tug's numbers (ft_1_21.AC5, content/challenge/rules.json), validated once. */
export const TUG_RULES: TugRules = parseTugRules(tugRulesJson);

/** Every item of `content/items/items.json` by its id, validated once (ft_1_20 item model, ft_1_21.AC15). */
export const ITEMS: ReadonlyMap<string, ItemDef> = parseItems(itemsJson);
