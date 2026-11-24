# Characters, the teacher and the curriculum: parts and contracts

The plan for characters, the teacher and the curriculum (d129, d132, d135, d139). Its parts are named by their features (d275) and taken when their area is the shortest stave (d283) ([roadmap.md](roadmap.md)). The contracts in the appendix are the source of the shared types.

## Rules that stay

- **Contracts before code.** A part needing a contract change writes a `TODO(architect)` tag and goes on with an `AX-3 provisional:` stub behind the existing contract.
- **One save round per stage** (d069 per document).
- **Placeholders keep work moving.** Code never waits for art: an actor without its sprite is a labelled box; a character without its phrases plays a generated draft.
- **The demo is the integration test.** A part that lands adds or extends an `npm run demo` scenario.
- **Figures on one template** (d142). A new hand-made figure needs the architect's OK.

## 1. Features in the programme

| Feature | What | Stage |
|---|---|---|
| [core_11](../features/core_11-save-documents.md) | The saved player as documents | 1 |
| [core_12](../features/core_12-evaluation-and-curriculum.md) | Evaluation of plays and the curriculum model | 1 |
| [ft_1_24](../features/ft_1_24-scene-runtime-and-map-walkers.md) | Scenes as data, actors, characters walking the map, scripts, loading per scene | 1 |
| [ft_1_25](../features/ft_1_25-world-state-and-presence.md) | World state and who is where today | 1 |
| [ft_1_21](../features/ft_1_21-challenges-with-characters.md) | The tug of reputation (the musical exchange) | 1 (core), 2 (in a scene) |
| [ft_1_22](../features/ft_1_22-conversations-and-phrase-book.md) | Conversations, teaching, the phrase book | 1 (engine), 2 (characters) |
| [ft_1_26](../features/ft_1_26-teachers-screen.md) | The teacher's screen behind the academic hat | 2 |
| [ft_1_27](../features/ft_1_27-the-teacher-and-reminders.md) | The teacher as a character, Kiur's reminders | 2 |
| [ft_1_23](../features/ft_1_23-age-and-text-levels.md) | Age from a birth month, text levels | 3 |
| [ft_1_20](../features/ft_1_20-action-and-inventory-strip.md) | The band: its first items (a tug's prize) | 2 |

## 2. Contracts

The shared seams, written as types and schemas in this page's appendix and built as code in `src/core/` (A.13, `src/core/contracts.ts`). A contract changes only through a `TODO(architect)` tag.

| Contract | Used by | Shape (summary) |
|---|---|---|
| `SaveDocument` | core_11, everyone saving | name, `schemaVersion`, migrate steps, read and write through `KeyValueStore` |
| `SceneData` | ft_1_24, painter, ft_1_25 | id, picture per hour, hotspots, standing places (id, x, y, facing), exits, music tie |
| `ActorDef` | ft_1_24, painter, ft_1_22 | id, sprite sheet, states (idle, talk, play, walk), anchor, size |
| `CharacterDef` | ft_1_22, ft_1_25, ft_1_21 | id, kind, style tags, music tie, actor, conversation id, phrases by level, prize ladder, practice threshold |
| `Conversation` | ft_1_22, ft_1_27 | nodes (line key, choices up to 3), conditions, effects (`flag`, `item`, `teach`, `tug`, `checkup`, `topic`, `leave`) |
| `Script` | ft_1_24, ft_1_27 | commands (`walkTo`, `face`, `say`, `wait`, `playPhrase`, `give`, `fade`) |
| `WorldState` | ft_1_25, ft_1_21, ft_1_22 | flags, items, met (with taught phrases), cool-down starts, teacher visits |
| `Presence` | ft_1_25, ft_1_24, ft_1_27 | per character: scene or map path, `arriving` or `present` or `leaving` |
| `TurnPlan` and `ExchangeResult` | ft_1_21, ft_1_22, ft_1_27 | turns (whose, bars, judged or not, mode), per-turn result (per hand), outcome |
| `PlayResult` and `PieceStatus` | core_12, ft_1_26, ft_1_27 | measured parts per hand, play score; level, spread, trend, expected, predicted, delta, colour, medal |
| `Curriculum` | core_12, ft_1_26, ft_1_25 | pieces (id, deadline, priority, overrides), calendar entries, notes |

Decisions filed with the contracts: the save as documents (core_11, a futureproofing seam), scenes on a world base scene, one difficulty scale 1 to 10, the curriculum model (game.md#d139), the teacher's role and gate.

## 3. Parts

The parts of the programme are named by their features; what is done is in each feature file's status. Three parts are held, each a tag in its feature file: the characters walking the map ([ft_1_24](../features/ft_1_24-scene-runtime-and-map-walkers.md)), the border guard, the third character ([ft_1_22](../features/ft_1_22-conversations-and-phrase-book.md)), and the teacher's statistics, calendar and requests ([ft_1_26](../features/ft_1_26-teachers-screen.md)).

- TODO(builder, R2): drop the old `WP-nn` names from code comments, test titles and content notes (`git grep "WP-"`; `WP-X` and `WP-G1` to `WP-G3` too) in one pull request with no behaviour change; a feature id stays only where it is an acceptance-criteria tag (d041, d275).

## Appendix: contracts

Written by the architect. This appendix is the source: the code in `src/core/` follows it, and a contract changes only through the architect (a `TODO(architect)` tag). The names, fields and meanings are binding; file paths, helper functions and the zod spelling are the builder's. Decisions: [d136](../decisions/saves.md#d136) (the save as documents), [d137](../decisions/stack.md#d137) (scenes as data, walkers on the map), [d138](../decisions/game.md#d138) (the difficulty scale), [d139](../decisions/game.md#d139) (the curriculum model), [d140](../decisions/game.md#d140) (the teacher's role, gate and requests).

### A.1 Rules for every contract

- **Pure:** every type below lives in `src/core/` (no Phaser, DOM, Web MIDI or Web Audio) and every piece of content that uses one is validated by a zod schema with `schemaVersion: 1` (CLAUDE.md, "Every persisted or loaded format").
- **Musical time in ticks** (480 per quarter note) inside the core; wall-clock milliseconds only for screen things (a fade, a wait in a script, an animation's frame rate).
- **Text through string keys** (`StringKey`), never words in data; Estonian first, through the `write-ui-text` skill.
- **Ids** are lowercase kebab strings, unique in their kind; a reference to a missing id fails the content's linter, not the game.
- **Days** are the player's local calendar day, `YYYY-MM-DD` (`DayString`); the seeded daily random (`src/core/random.ts`) keys on it.
- **Positions** in a scene are fine-grid pixels of the 640 × 360 canvas (d110), origin top left; on the map, metres of the world model (d108).
- **Optional means optional:** a reader treats a missing optional field as its stated default, so content written before a field existed stays valid without a version bump.

```ts
// Shared
type StringKey = string;          // a key in the strings tables (write-ui-text)
type DayString = string;          // 'YYYY-MM-DD', the player's local day
type SceneId = string; type PlaceId = string; type ActorId = string; type CharacterId = string;
type ConversationId = string; type NodeId = string; type ScriptId = string; type ItemId = string;
type PieceId = string;            // a piece's id as today (content/pieces/<id>, own pieces too)
type StyleTag = 'classical' | 'jazz' | 'folk';   // grows by decision only
type Facing = 'left' | 'right' | 'front' | 'back';
type Hand = 'left' | 'right';
type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
```

### A.2 `SaveDocument` (core_11; d136)

One saved block of a player, versioned and migrated on its own. Read and written only through `KeyValueStore` (`src/core/progression/repository.ts`).

```ts
type SaveDocumentName = 'profile' | 'practiceLog' | 'world' | 'curriculum';

interface SaveDocument<T> {
  readonly name: SaveDocumentName;
  readonly schemaVersion: number;                 // this document's own version, starting at 1
  /** Steps from each older version to the next; frozen once released, each with a golden test. */
  readonly migrations: readonly { readonly from: number; migrate(old: unknown): unknown }[];
  /** A fresh player's value. */
  empty(): T;
  /** Any stored text of any released version (or null) to the current value; never throws on old data. */
  parse(text: string | null): T;
  serialize(value: T): string;                    // always writes { schemaVersion, ...value }
}
```

- The storage key of a player's document is the repository's to name (one key per profile and document, under the naming test in `repository.naming.test.ts`).
- `profile` holds what the profile holds today minus what moves out; `practiceLog` the practice log (d092) with the per-hand onset deviation of core_12; `world` is `WorldState` (A.8); `curriculum` is `Curriculum` (A.12).
- The one-time move from today's single profile record writes all four documents and keeps the old record until the next release (core_11's criteria).

### A.3 `SceneData` (ft_1_24; d137)

A scene as data, run by one `AdventureScene`. File: `content/scenes/<id>.json`, one per scene; its id is the world model's scene id (`content/world/keri.json`, `scenes[].id`).

```ts
interface SceneData {
  readonly schemaVersion: 1;
  readonly id: SceneId;
  readonly picture: string;                       // the painted picture's id in tools/art/pictures.ts; the hour comes from the sky (ft_1_14)
  readonly hotspots: readonly Hotspot[];
  readonly places: readonly StandingPlace[];      // where actors stand
  readonly exits: readonly Exit[];
  readonly musicTie?: StringKey;                  // what the place has to do with music (d132), shown on looking
}
interface Hotspot { readonly id: string; readonly area: Rect; readonly name: StringKey; readonly look: StringKey; readonly place?: PlaceId }
interface StandingPlace { readonly id: PlaceId; readonly x: number; readonly y: number; readonly facing: Facing; readonly scale?: number /* default 1 */ }
interface Exit { readonly id: string; readonly area: Rect; readonly to: SceneId | 'map' | 'room'; readonly name: StringKey }
```

- No walk area in the MVP (Q1 of the plan, "current MVP - C": nobody walks inside a scene); a later version adds `walkArea` as an optional field.
- An actor in a scene stands on a `StandingPlace`; a character's place for today comes from `Presence` (A.9).

### A.4 `ActorDef` (ft_1_24; painter)

How a figure is drawn and animated. File: `content/actors/<id>.json`; the sprite sheet is the painter's (`src/game/ui/pixel/`), named by `sheet`.

```ts
type ActorState = 'idle' | 'talk' | 'play' | 'listen' | 'walk';

interface ActorDef {
  readonly schemaVersion: 1;
  readonly id: ActorId;
  readonly sheet?: string;                        // a hand-made figure's sprite sheet id
  readonly template?: { readonly features: Readonly<Record<string, string>> }; // the template character (d142) with its chosen layers (head, hair, top, bottom, held, palette ramps); `generate` in the content means drawn from the feature set with the seeded daily random
  // exactly one of `sheet` and `template`; neither drawable yet: a labelled box of `size`
  readonly size: { readonly w: number; readonly h: number };        // one frame, fine-grid pixels
  readonly anchor: { readonly x: number; readonly y: number };      // the feet, inside the frame
  readonly states: Readonly<Partial<Record<ActorState, { readonly frames: number; readonly fps: number; readonly loop: boolean }>>>;
  readonly mapFigure?: string;                    // the small figure that walks the map (ft_1_24), a sheet id
}
```

- `idle` is required; any other missing state falls back to `idle`. Facing left is the right-facing frames mirrored unless the sheet has its own.

### A.5 `CharacterDef` (ft_1_22, ft_1_25, ft_1_21)

Who a character is. File: `content/characters/<id>.json`.

```ts
type CharacterKind = 'spirit' | 'visitor' | 'ghost' | 'teacher';

type CharacterName =
  | { readonly kind: 'named'; readonly name: StringKey }            // "Vana Toomas"
  | { readonly kind: 'generic'; readonly name: StringKey }          // "Vanamees" (an old man)
  | { readonly kind: 'generated'; readonly pool: 'et-given-family' }; // "Ats Kala", drawn once per player from the seeded random and kept in WorldState

interface CharacterDef {
  readonly schemaVersion: 1;
  readonly id: CharacterId;
  readonly kind: CharacterKind;
  readonly name: CharacterName;
  readonly styles: readonly StyleTag[];
  readonly musicTie: StringKey;                   // how it ties to music (d132)
  readonly actor: ActorId;
  readonly conversation: ConversationId;
  readonly phrases: Readonly<Partial<Record<1 | 2 | 3, readonly PieceId[]>>>;  // by tug level; ids of phrase pieces (difficulty 1 to 3, d138)
  readonly prizes?: readonly ItemId[];            // the prize ladder: a won tug at level N gives rung N (d132, ft_1_21.AC18)
  readonly meet: { readonly practiceMinutes: number; readonly cooldownCleanPlays: number }; // d132: meeting counted in practice minutes, the cool-down after a lost tug in clean plays of that piece (3; ft_1_21.AC13, ft_1_25.AC3), never in hours
  readonly scenes: readonly SceneId[];            // where it may be present
}
```

- No real person and nothing from a copyrighted novel (ft_1_21); a name on screen is the character's own, never a label word such as TEGELANE (Q6).

### A.6 `Conversation` (ft_1_22, ft_1_27)

A talk as data, stepped by a pure interpreter. File: `content/conversations/<id>.json`.

```ts
type Speaker = 'character' | 'student' | 'kiur';

interface Conversation {
  readonly schemaVersion: 1;
  readonly id: ConversationId;
  readonly start: NodeId;
  readonly nodes: Readonly<Record<NodeId, ConversationNode>>;
}
interface ConversationNode {
  readonly speaker: Speaker;
  readonly line: StringKey;
  readonly when?: Condition;                      // a node whose condition fails is skipped to `next`
  readonly choices?: readonly Choice[];           // at most 3; the student's lines
  readonly next?: NodeId;                         // without choices; none ends the talk
  readonly effects?: readonly Effect[];           // applied when the node is shown
}
interface Choice { readonly text: StringKey; readonly next: NodeId; readonly when?: Condition }

type Condition =
  | { readonly flag: string } | { readonly notFlag: string }
  | { readonly hasItem: ItemId } | { readonly met: CharacterId }
  | { readonly taught: PieceId } | { readonly levelAtLeast: number }
  | { readonly knowledge: boolean }               // the per-player knowledge switch (d132)
  | { readonly all: readonly Condition[] } | { readonly any: readonly Condition[] };

type Effect =
  | { readonly setFlag: string } | { readonly clearFlag: string }
  | { readonly give: ItemId } | { readonly take: ItemId }
  | { readonly teach: PieceId }                   // starts a teaching exchange (A.10)
  | { readonly tug: 1 | 2 | 3 }                   // starts the tug at that level (the show, d135)
  | { readonly checkup: PieceId }                 // the teacher's check-up (ft_1_27)
  | { readonly topic: string }                    // opens a knowledge topic
  | { readonly leave: true };
```

- The linter (ft_1_22) fails a conversation where any node is unreachable, a key is missing, or **a branch does not reach playing (`teach`, `tug` or `checkup`) or `leave` within 4 presses** (the AX-0 test).

### A.7 `Script` (ft_1_24, ft_1_27)

A short scripted moment. File: `content/scripts/<id>.json`; run by the scene, stepped by a pure interpreter.

```ts
type ScriptCommand =
  | { readonly walkTo: ActorId; readonly place: PlaceId }
  | { readonly face: ActorId; readonly facing: Facing }
  | { readonly say: ActorId; readonly line: StringKey }
  | { readonly wait: number }                     // milliseconds (screen time)
  | { readonly playPhrase: ActorId; readonly piece: PieceId }   // through the audio output, not judged
  | { readonly give: ItemId }
  | { readonly fade: 'out' | 'in'; readonly ms: number }
  | { readonly enter: ActorId; readonly place: PlaceId } | { readonly exit: ActorId };

interface Script { readonly schemaVersion: 1; readonly id: ScriptId; readonly commands: readonly ScriptCommand[]; readonly skippable: boolean /* default true */ }
```

### A.8 `WorldState` (ft_1_25; the `world` document)

What happened in a player's world. Anything that can be derived from the practice log is derived, not stored (d092).

```ts
interface WorldState {
  readonly flags: readonly string[];
  readonly items: readonly ItemId[];
  readonly met: Readonly<Record<CharacterId, MetRecord>>;
  readonly teacherVisits: readonly { readonly day: DayString; readonly piece: PieceId; readonly result: 'passed' | 'notYet' }[];
  readonly wandererGifts?: readonly { readonly day: DayString; readonly wanderer: string; readonly item: ItemId }[];  // ft_1_37, d298: one keepsake a wanderer a day
}
interface MetRecord {
  readonly firstDay: DayString;
  readonly lastDay: DayString;
  readonly generatedName?: string;                // for a `generated` name, drawn once
  readonly taught: readonly PieceId[];            // the phrase book is these, over all characters
  readonly taughtOn?: Readonly<Record<PieceId, DayString>>;  // the day each was taught: heard becomes mine on a later day (proposed, see below)
  readonly tugs: { readonly won: number; readonly lost: number; readonly bestLevel: 0 | 1 | 2 | 3 };
  readonly lastLostTug?: { readonly piece: PieceId; readonly at: string };  // the last lost tug's piece and ISO time: the cool-down counts clean plays of that piece from here
}
```

- Proposed (the builder; a scaffold with the architect's review on its pull request): `taughtOn`, optional, so saves from before it load unchanged and the `world` document stays version 1 (d069.3); a phrase without a day counts from the character's `lastDay` (AX-1: no clean play from before its teaching counts).
- Changed (the architect, answering a question in ft_1_25): the cool-down is counted in clean plays of the tug's piece, as ft_1_21.AC13 and ft_1_25.AC3 say, not in practice minutes (`lastTugPracticeMinutes` and `cooldownPracticeMinutes` are gone). AX-1: a correct repetition, not time at the piano, earns the next try. No saved document can hold the old field yet (no tug is played in a scene before WP-13), so whether this needs a version step is the dev team's call (save-format-bump skill).

### A.9 `Presence` (ft_1_25, ft_1_24, ft_1_27)

Who is where today: one pure function, the same answer for the same day.

```ts
interface PresenceInput {
  readonly day: DayString;
  readonly practiceMinutes: number;               // total, from the practice log
  readonly practiceMinutesToday: number;
  readonly cleanPlaysSinceLostTug: Readonly<Record<CharacterId, number>>;  // from the practice log: clean plays of `lastLostTug.piece` after `lastLostTug.at`, per character with one
  readonly characters: readonly CharacterDef[];
  readonly world: WorldState;
  readonly curriculum: Curriculum;
  readonly statuses: readonly PieceStatus[];      // A.11, for the teacher's schedule and Kiur
}
type Whereabouts =
  | { readonly at: 'scene'; readonly scene: SceneId; readonly place: PlaceId }
  | { readonly at: 'map'; readonly path: readonly string[] }   // world-model path ids, walked in order
  | { readonly at: 'away' };

interface Presence {
  readonly day: DayString;
  readonly characters: Readonly<Record<CharacterId, { readonly where: Whereabouts; readonly phase: 'arriving' | 'present' | 'leaving' }>>;
  readonly teacherBoat: { readonly progress: number } | null;   // 0 far out to 1 landed, from the nearest deadline
  readonly headsUps: readonly { readonly character: CharacterId; readonly line: StringKey }[];  // Kiur's hints
}
```

### A.10 `TurnPlan` and `ExchangeResult` (ft_1_21, ft_1_22, ft_1_27)

One shape for every musical exchange: teaching, the tug, the practice tug with Kiur, the teacher's check-up.

```ts
type ExchangeKind = 'teach' | 'tug' | 'practiceTug' | 'checkup';

interface TurnPlan {
  readonly kind: ExchangeKind;
  readonly piece: PieceId;
  readonly level: 1 | 2 | 3;
  readonly turns: readonly Turn[];
}
interface Turn {
  readonly who: 'character' | 'student';
  readonly bars: { readonly from: number; readonly to: number };   // bar numbers as the chart counts them (a pick-up is bar 0, d120)
  readonly judged: boolean;                       // a character's turn is never judged
  readonly mode: 'wait' | 'tempo';
  readonly hands: Hand | 'both';
  readonly staff: boolean;                        // whether the staff is shown in this turn
}
interface TurnResult {
  readonly turn: number;                          // index into turns
  readonly hands: Readonly<Partial<Record<Hand, HandMeasure>>>;
  readonly share: number;                         // 0 to 1: notes right first try (Wait) or on time (Tempo)
  readonly passed: boolean;
  readonly reasons: readonly string[];            // miss reasons as the judge gives them (AX-0.2)
}
interface ExchangeResult {
  readonly plan: TurnPlan;
  readonly turns: readonly TurnResult[];
  readonly outcome: 'won' | 'lost' | 'learned' | 'notYet' | 'left';
  readonly standing?: number;                     // the tug's marker at the end, -3 to 3
}
```

### A.11 `PlayResult` and `PieceStatus` (core_12; d139)

```ts
interface HandMeasure {
  readonly notes: number;
  readonly firstTry: number;
  readonly onTime?: number;                       // Tempo mode
  readonly onsetMeanTicks?: number;               // Tempo mode: signed mean deviation
  readonly onsetSpreadTicks?: number;             // Tempo mode: standard deviation
}
interface PlayResult {
  readonly piece: PieceId;
  readonly day: DayString;
  readonly at: number;                            // epoch ms, for ordering only
  readonly mode: 'wait' | 'tempo';
  readonly tempoPercent: number;
  readonly bars?: { readonly from: number; readonly to: number };   // a section's play; absent for the whole piece
  readonly hands: Readonly<Partial<Record<Hand, HandMeasure>>>;
  readonly score: number;                         // 0 to 100 (d139)
}

type StatusColour = 'purple' | 'green' | 'strongGreen';
type Medal = 'bronze' | 'silver' | 'gold';

interface PieceStatus {
  readonly piece: PieceId;
  readonly plays: number;                         // in the window the teacher chose
  readonly level: number | null;                  // median of the last X play scores; null under 3 plays
  readonly spread: number | null;                 // standard deviation of the same
  readonly histogram: readonly number[];          // counts of play scores in 10-point bins, 0 to 100
  readonly retained: boolean;                     // the consistency rule (d139)
  readonly expected: number;                      // base + priority
  readonly predicted: number | null;              // at the deadline, Theil-Sen, capped at 100; null under 3 practice days
  readonly band: { readonly low: number; readonly high: number } | null;
  readonly delta: number | null;                  // expected − predicted
  readonly urgency: number;                       // d139; 0 when nothing is owed
  readonly colour: StatusColour;
  readonly greenStrength?: number;                // 0 to 1 for 'green'
  readonly medal?: Medal;
}
```

### A.12 `Curriculum` (core_12, ft_1_26, ft_1_25; the `curriculum` document)

```ts
interface Curriculum {
  readonly base: number;                          // the expected level before priority, default 85
  readonly pieces: readonly CurriculumPiece[];
  readonly calendar: readonly CalendarEntry[];
  readonly cast?: {                               // ft_1_37, d298: the teacher's settings of the cast; absent, every character as before
    readonly characters?: Readonly<Record<CharacterId, { readonly on?: boolean; readonly weekdays?: readonly number[]; readonly chance?: number; readonly piece?: PieceId; readonly neediness?: number }>>;
    readonly sent?: readonly { readonly wanderer: string; readonly day: DayString; readonly piece?: PieceId }[];
  };
}
interface CurriculumPiece {
  readonly piece: PieceId;
  readonly deadline: DayString;
  readonly priority: number;                      // 1 to 10
  readonly overrides?: {
    readonly base?: number;
    readonly lastPlays?: number;                  // X, default 10
    readonly retain?: { readonly atLeast: number; readonly belowAtMost: number; readonly byAtMost: number }; // Y, Z, B (d139)
  };
}
interface CalendarEntry {
  readonly day: DayString;
  readonly kind: 'deadline' | 'lesson' | 'test' | 'note';
  readonly text?: string;                         // the teacher's own words; private to the device, never in the repository
  readonly piece?: PieceId;
}
```

### A.13 Where the code goes (the builder may adjust inside `src/core/`)

| Contract | Module | Content |
|---|---|---|
| `SaveDocument` | `src/core/save/` | none (planned) |
| `SceneData`, `ActorDef`, `Script` | `src/core/scene/` | `content/scenes/`, `content/actors/`, `content/scripts/` (planned) |
| `CharacterDef`, `Conversation` | `src/core/character/`, `src/core/dialogue/` | `content/characters/`, `content/conversations/` (planned) |
| `WorldState`, `Presence` | `src/core/island/` (the map model stays in `src/core/world/`) | none (planned) |
| `TurnPlan`, `ExchangeResult` | `src/core/exchange/` | none (planned) |
| `PlayResult`, `PieceStatus`, `Curriculum` | `src/core/curriculum/` | none (planned) |

the contracts's code part delivers: these types, their zod schemas for the five content kinds, one valid fixture file per content kind (the knoll's `SceneData`, Kiur's `ActorDef`, a placeholder character and its two-node conversation, the boat's script), and a test that every fixture parses. No behaviour: every function beyond `parse` is a later WP's.
