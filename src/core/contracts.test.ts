/**
 * WP-01: the contracts of the characters and teacher programme (docs/architect/program-characters-teacher.md, appendix A)
 * as code. Every content kind's fixture parses; the schemas refuse what the contracts forbid; the other contracts can be
 * imported and built (a value per contract, checked by the type checker).
 */
import { describe, expect, it } from 'vitest';
import knoll from '../../tests/fixtures/contracts/knoll.scene.json';
import kiur from '../../tests/fixtures/contracts/kiur.actor.json';
import placeholderCharacter from '../../tests/fixtures/contracts/placeholder.character.json';
import placeholderConversation from '../../tests/fixtures/contracts/placeholder.conversation.json';
import boatArrives from '../../tests/fixtures/contracts/boat-arrives.script.json';
import { sceneDataSchema } from './scene/scene';
import { actorDefSchema } from './scene/actor';
import { scriptSchema } from './scene/script';
import { characterDefSchema } from './character/character';
import { conversationSchema } from './dialogue/conversation';
import type { SaveDocument } from './save/document';
import type { WorldState } from './island/worldState';
import type { Presence, PresenceInput } from './island/presence';
import type { ExchangeResult, TurnPlan } from './exchange/exchange';
import type { PieceStatus, PlayResult } from './curriculum/play';
import type { Curriculum } from './curriculum/curriculum';

/** A copy of `value` without `key`: a content file written before the field existed, or one missing a required field. */
function without(value: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));
}

describe('WP-01 content contracts: every fixture parses', () => {
  it('parses the knoll SceneData (A.3)', () => {
    const scene = sceneDataSchema.parse(knoll);
    expect(scene.id).toBe('knoll');
    expect(scene.places.map((p) => p.id)).toEqual(['by-the-fire', 'path-top']);
    expect(scene.exits.map((e) => e.to)).toEqual(['map', 'room']);
  });

  it("parses Kiur's ActorDef (A.4)", () => {
    const actor = actorDefSchema.parse(kiur);
    expect(actor.states.idle).toEqual({ frames: 2, fps: 2, loop: true });
    expect(actor.mapFigure).toBeUndefined();
  });

  it('parses the placeholder CharacterDef (A.5)', () => {
    const character = characterDefSchema.parse(placeholderCharacter);
    expect(character.name).toEqual({ kind: 'generated', pool: 'et-given-family' });
    expect(character.phrases[1]).toEqual(['echo-giant']);
    expect(character.prizes).toBeUndefined();
  });

  it('parses the placeholder Conversation (A.6)', () => {
    const talk = conversationSchema.parse(placeholderConversation);
    expect(talk.nodes[talk.start]?.choices).toHaveLength(2);
    expect(talk.nodes['bye']?.effects).toEqual([{ leave: true }]);
  });

  it("parses the boat's Script (A.7)", () => {
    const script = scriptSchema.parse(boatArrives);
    expect(script.commands).toHaveLength(9);
    expect(script.skippable).toBe(true);
  });
});

describe('WP-01 content contracts: what the schemas refuse or default', () => {
  it('refuses a content file without schemaVersion 1', () => {
    expect(sceneDataSchema.safeParse({ ...knoll, schemaVersion: 2 }).success).toBe(false);
    expect(actorDefSchema.safeParse(without(kiur, 'schemaVersion')).success).toBe(false);
  });

  it('refuses an id that is not lowercase kebab (A.1)', () => {
    expect(sceneDataSchema.safeParse({ ...knoll, id: 'Knoll' }).success).toBe(false);
    expect(characterDefSchema.safeParse({ ...placeholderCharacter, actor: 'two  words' }).success).toBe(false);
    expect(scriptSchema.safeParse({ ...boatArrives, id: 'boat-' }).success).toBe(false);
  });

  it('refuses an unknown field, so a misspelt optional field is caught', () => {
    expect(sceneDataSchema.safeParse({ ...knoll, musicTi: 'x.y' }).success).toBe(false);
  });

  it('refuses an actor without the idle state (A.4: idle is required)', () => {
    expect(actorDefSchema.safeParse({ ...kiur, states: { talk: kiur.states.talk } }).success).toBe(false);
  });

  it('refuses more than 3 choices on a conversation node (A.6)', () => {
    const choice = { text: 'talk.x', next: 'hello' };
    const hello = { ...placeholderConversation.nodes.hello, choices: [choice, choice, choice, choice] };
    const talk = { ...placeholderConversation, nodes: { ...placeholderConversation.nodes, hello } };
    expect(conversationSchema.safeParse(talk).success).toBe(false);
  });

  it('refuses a mixed or unknown effect and condition (A.6)', () => {
    const withEffects = (effects: unknown[]) => ({
      ...placeholderConversation,
      nodes: { ...placeholderConversation.nodes, play: { ...placeholderConversation.nodes.play, effects } },
    });
    expect(conversationSchema.safeParse(withEffects([{ tug: 4 }])).success).toBe(false);
    expect(conversationSchema.safeParse(withEffects([{ setFlag: 'a', give: 'b' }])).success).toBe(false);
    expect(conversationSchema.safeParse(withEffects([{ leave: false }])).success).toBe(false);
    expect(conversationSchema.safeParse(withEffects([{ tug: 2 }, { checkup: 'echo-giant' }, { topic: 'scales' }])).success).toBe(true);
    const withWhen = (when: unknown) => ({
      ...placeholderConversation,
      nodes: { ...placeholderConversation.nodes, play: { ...placeholderConversation.nodes.play, when } },
    });
    expect(conversationSchema.safeParse(withWhen({ any: [{ hasItem: 'shell' }, { levelAtLeast: 2 }, { knowledge: true }] })).success).toBe(true);
    expect(conversationSchema.safeParse(withWhen({ weather: 'rain' })).success).toBe(false);
  });

  it('refuses a tug level outside 1 to 3 in the phrases (A.5)', () => {
    expect(characterDefSchema.safeParse({ ...placeholderCharacter, phrases: { 4: ['echo-giant'] } }).success).toBe(false);
  });

  it('refuses a style that no decision added (A.1 StyleTag)', () => {
    expect(characterDefSchema.safeParse({ ...placeholderCharacter, styles: ['rock'] }).success).toBe(false);
  });

  it('defaults a script to skippable when the field is missing (A.1: optional means its default)', () => {
    expect(scriptSchema.parse(without(boatArrives, 'skippable')).skippable).toBe(true);
  });

  it('refuses an unknown script command (A.7)', () => {
    expect(scriptSchema.safeParse({ ...boatArrives, commands: [{ dance: 'kiur' }] }).success).toBe(false);
  });
});

describe('WP-01 the other contracts can be imported and built', () => {
  it('builds one value of each (A.2, A.8 to A.12)', () => {
    const hands = { right: { notes: 8, firstTry: 7, onTime: 6, onsetMeanTicks: -12, onsetSpreadTicks: 30 } };
    const play: PlayResult = { piece: 'echo-giant', day: '1998-11-17', at: 0, mode: 'tempo', tempoPercent: 80, hands, score: 81 };
    const status: PieceStatus = {
      piece: 'echo-giant', plays: 3, level: 81, spread: 4, histogram: [0, 0, 0, 0, 0, 0, 0, 1, 2, 0], retained: false,
      expected: 90, predicted: 88, band: { low: 84, high: 92 }, delta: 2, urgency: 0.2, colour: 'green', greenStrength: 0.5,
    };
    const curriculum: Curriculum = {
      base: 85,
      pieces: [{ piece: 'echo-giant', deadline: '1998-12-01', priority: 5, overrides: { lastPlays: 10, retain: { atLeast: 90, belowAtMost: 2, byAtMost: 5 } } }],
      calendar: [{ day: '1998-12-01', kind: 'deadline', piece: 'echo-giant' }],
    };
    const world: WorldState = {
      flags: ['met-placeholder'], items: [],
      met: { placeholder: { firstDay: '1998-11-17', lastDay: '1998-11-17', taught: ['echo-giant'], tugs: { won: 0, lost: 1, bestLevel: 0 }, lastLostTug: { piece: 'echo-giant', at: '1998-11-17T16:00:00.000Z' } } },
      teacherVisits: [{ day: '1998-11-17', piece: 'echo-giant', result: 'notYet' }],
    };
    const character = characterDefSchema.parse(placeholderCharacter);
    const input: PresenceInput = { day: '1998-11-17', practiceMinutes: 120, practiceMinutesToday: 15, characters: [character], world, curriculum, statuses: [status], cleanPlaysSinceLostTug: { placeholder: 1 } };
    const presence: Presence = {
      day: input.day,
      characters: { placeholder: { where: { at: 'scene', scene: 'knoll', place: 'by-the-fire' }, phase: 'present' } },
      teacherBoat: { progress: 0.25 },
      headsUps: [{ character: 'placeholder', line: 'kiur.headsUp.placeholder' }],
    };
    const plan: TurnPlan = {
      kind: 'tug', piece: 'echo-giant', level: 1,
      turns: [
        { who: 'character', bars: { from: 1, to: 2 }, judged: false, mode: 'wait', hands: 'right', staff: true },
        { who: 'student', bars: { from: 1, to: 2 }, judged: true, mode: 'wait', hands: 'right', staff: true },
      ],
    };
    const exchange: ExchangeResult = {
      plan, outcome: 'won', standing: 2,
      turns: [{ turn: 1, hands, share: 7 / 8, passed: true, reasons: ['neighbour'] }],
    };
    const save: SaveDocument<WorldState> = {
      name: 'world', schemaVersion: 1, migrations: [],
      empty: () => ({ flags: [], items: [], met: {}, teacherVisits: [] }),
      parse: (text) => (text === null ? save.empty() : (JSON.parse(text) as WorldState)),
      serialize: (value) => JSON.stringify({ schemaVersion: 1, ...value }),
    };
    expect(save.parse(save.serialize(world))).toMatchObject(world);
    expect([play.score, presence.characters['placeholder']?.phase, exchange.turns[0]?.share, input.statuses[0]?.colour]).toEqual([81, 'present', 0.875, 'green']);
  });
});
