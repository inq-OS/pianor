---
covers: ["src/core/"]
---
# Futureproofing: what to lock now, what to keep open

Goal: build only the MVP, but make sure no desired later feature requires rewriting the foundations. Each section lists the future feature, the early decision that protects it, and what we deliberately do not build yet.

## 1. Decisions that are expensive to change (lock these in the MVP)

### 1.1 Chart schema carries more than the MVP uses

The MVP plays simple single-hand pieces, but the schema must already express what later features need:

- `schemaVersion` on every format, with a migration path. Every format and its current version: [schemas](architecture/schemas.md) (generated from the code).
- **Spelled pitch**, not only MIDI numbers: `{ midi, step, alter, octave }`. MIDI 61 is C# or Db depending on context and the staff needs the spelling; retrofitting this later breaks every piece.
- Tempo map and meter map (lists with ticks), key signature map, even if pieces use one entry each.
- `tracks[]` with a `role`: `play`, `accompaniment`, `click`; each with clef and hand. This allows backing tracks, two-hand pieces, bass clef and "the computer plays the other part" later.
- Voices, ties, chords, and per-note optional `finger`, `dynamic`, `articulation`, `text`.
- Stable piece IDs and a `contentVersion`, so saves and progress survive piece edits.

Build now: the schema and the validator. Build later: renderer and judge support for features the MVP does not use (the schema simply allows them).

### 1.2 The judge consumes abstract events and has pluggable play modes

- Input is `NoteEvent { kind, midi, velocity, timeMs, source }` (`src/core/judge/types.ts`; `timeMs` is on the song/audio clock), never a Web MIDI object. The same events can come from the EZ-220, the mock keyboard, a recorded replay, a different keyboard, or later an audio pitch detector.
- Play mode is a strategy behind one interface (`PlayMode`): **Wait** and **Tempo** (core_01) built, with looping play (ft_1_12) over either; **Echo/call-and-response** later. The tug calls a mode, it does not reimplement judging.
- The judge outputs domain events (section 1.3), not UI instructions.

### 1.3 Domain events are the seam between systems

The core emits `NoteJudged`, `BarCompleted`, `PhraseCompleted`, `PieceCompleted` (with accuracy, timing, hints used). Progression listens to them now. The tug, achievements, a parent dashboard and analytics can listen to the same stream later without touching the judge. Keep the event types versioned and documented.

### 1.4 Rendering is split: layout, view, state

- A **pure layout function** turns chart plus viewport into positioned glyphs (testable, no Phaser).
- A **view** draws those glyphs. The staff view is the main one; a keyboard view or the tug's overlay are other views over the same chart and the same play state.
- A **play state** object (cursor, per-note status) is the only thing views read. Views never decide correctness.

This is what keeps other views cheap, and stops Phaser from leaking into rules.

### 1.5 Persistence is versioned, profile-scoped and exportable

- A player's save is a set of documents (`profile`, `practiceLog`, `world`, `curriculum`), each with its own `schemaVersion` and migrations ([d136](decisions/saves.md#d136), built in core_11).
- Save data has `schemaVersion`, a `profileId` (a second student, a sibling, a teacher test profile), and an event log of attempts (not only totals) so adaptive difficulty and progress charts are possible later.
- All access goes through an `io/storage` interface (`KeyValueStore`, defined in `core/progression`; implementations `IndexedDbStore` (the default, d080), `LocalStorageStore` (the fallback, and the source of the one-time move) and `MemoryStore` in `src/io/storage/`); a cloud or file-sync implementation can follow. The attempt log is the record; totals are derived from it, and each attempt stores the XP awarded then, so tuning the rules never rewrites history.
- Export and import as JSON from the start (backup, moving devices).
- Pieces written in the editor (ft_1_02a) are their own versioned records on the device (`pianor/v1/own-piece/<id>`, format version 2 (d073), the editor's piece with its key and note alters, plus its ABC and meta), apart from the per-player saves; export and import as files are one versioned JSON piece file (`src/core/editor/pieceFile.ts`, `docs/decisions/notation.md#d050`).
- Data stays local by default and there are no accounts. If cloud sync is ever added, treat it as a children's-data and privacy question first (consent, minimal data), not just a technical one.

### 1.5b Time and clock

One audio-clock-based song time inside the core, in ticks; the io layer converts MIDI timestamps. Injectable clock for tests. Changing this later would touch everything, so it is fixed from the first judge.

## 2. Keep open with interfaces, build only when needed

| Future feature | Early protection | Not built yet |
|---|---|---|
| Tempo mode, rhythm scoring | `PlayMode` strategy (`TempoMode` built, core_01); note events carry timing; tempo map in chart; timing windows and the song transport built | Rhythm scoring beyond the tug's Tempo levels |
| Challenges with characters (d129, d290) | Domain events; `PhraseResult`; the tug's rules and the characters are data with schemas and versions; one tug record per finished tug in the save (d290) | More characters and their tugs (ft_1_21, ft_1_22) |
| Key lighting, hints | `KeyLightOutput` interface; hints are an options object with a cost in results | Real EZ-220 lighting until ft_0_01 verifies it |
| Accompaniment / backing tracks | `tracks[]` with roles; audio engine plays non-played tracks | Accompaniment generation |
| Bass clef, grand staff, accidentals, key signatures | Spelled pitch, clef per track, key signature map; layout function written clef-aware | Grand staff in ft_0_15 (done); accidentals and key signatures later |
| Two-hand play and its bonus | `tracks[]` with `hand`; steps group notes across play tracks; results shared by bar, phrase and piece | Per-hand stats, `bothHandsMultiplier` and the together window (ft_0_10 and ft_0_15, done) |
| Other keyboards, Bluetooth MIDI, acoustic piano (microphone pitch detection) | `KeyboardInput` interface and `NoteEvent` | Audio input |
| MusicXML / MIDI import | The chart schema is source-independent and the linter takes a chart (a test proves it works without ABC positions); importers emit ABC plus a draft meta file through the same compiler, linter and approval gate; the compiler, linter and difficulty modules live in `src/core/piece/` ([d077](decisions/stack.md#d077)): they take text and return charts and diagnostics with no Node APIs and no content files (core's lint rules), so importers or an import page in the browser can reuse them, and only the CLIs and file access stay in `tools/piece/`; `generator.kind` and `params` record where a piece came from; `source` and `license` are required in the meta | Any importer (needs XML, zip and MIDI parsing: a dependency decision then) |
| Tablet / app-store packaging | Browser-API use isolated in `io/`; PWA first | Native wrapper (e.g. a webview shell) |
| Multiple profiles, parent or teacher dashboard | `profileId`, attempt event log | Dashboard UI |
| Languages | All UI text through string keys from day one; no text inside art; pieces have titles per locale optional | Translations |
| Content packs from teachers | Content loaded through a manifest with ids, versions, licence and status; the approval gate is data | Pack marketplace, sharing |
| Adaptive difficulty | Per-attempt logs and per-piece difficulty score | The algorithm |
| Accessibility (large UI, colour-blind safe, reduced motion) | Theme and scale settings object read by views; per-player settings in the save (`settings`; which profile version added which setting is in the comment on `PROFILE_SCHEMA_VERSION` in `src/core/progression/profile.ts` and in the d05x decisions) | Full audit, more settings |
| Scene looks by time, season, holiday | One pure `sceneLook(instant, options)` returns phase, season and holidays; layers in a fixed order over palette-index art (d097) | Seasons and holidays (ft_Y_14). The painted pictures (d111) are made when the game is built, one for each of the four hours of the sky: a season or a holiday there is another built picture or palette, not a layer at run time |
| Sound options (instrument sounds, effects) | Audio behind an interface; samples are content with licence metadata | Extra instruments |

## 3. Practices that protect the future

- **Thin engine, fat data:** characters, conversations, levels, prizes and the curriculum live in validated JSON, so game design can evolve without engine code changes.
- **Boundary enforcement in CI** (see `docs/testing.md`): core purity and io interfaces are lint-enforced, not just documented.
- **Migrations are tested:** each schema keeps fixtures of every older version. A migration step writes the values of its own version as literals, never today's defaults, and a golden test freezes its output (d064).
- **Feature flags** in one config object (dev tools, draft content, experimental modes), so unfinished features can ship dark; unfinished work merges early behind one, off by default, rather than waiting on a long branch (d147).
- **Decision log:** `docs/decisions/`, seven ledgers by area with one short entry per significant choice (d152), indexed in `DECISIONS.md`. Agents add a decision when they change something listed in this document.
- **YAGNI check:** if a seam is not on the table in section 2 or in a feature file (`docs/features/`), do not add abstractions for it.

## 4. Known risks to watch

- **Phaser lock-in:** mitigated by 1.4 and the import boundary; if Phaser becomes a problem, only `src/game` changes.
- **Web MIDI browser support:** limited to Chromium browsers; the `KeyboardInput` interface plus a packaged wrapper is the escape route if iPad or Safari support becomes important. Verify current support before relying on it.
- **Import is bounded by notation support, not by the format:** a real song needs a pick-up bar, accidentals, key signatures, ties and sometimes chords. The schema already allows varying bar lengths, ties, key maps and spelled accidentals, but the compiler and renderer assume one meter, equal bars, key of C and no accidentals, and say so with `UnsupportedNotationError` and linter rules. Growing the renderer and the compiler together is the real work behind import; the importer itself is small.
- **Staff renderer scope creep:** the schema allows more than the renderer supports; the linter rejects pieces using unsupported features at a given level.
- **Single-student assumption:** profile scoping from day one avoids a painful save-data migration.
- **Content quality:** custom pieces need review; the approval gate and the linter are the safeguards.
