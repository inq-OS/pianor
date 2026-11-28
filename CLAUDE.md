# Pianor

Piano learning for beginners of any age on a USB-MIDI keyboard (reference: Yamaha EZ-220, 61 keys): an early-1990s-style point-and-click adventure on Keri island, where characters trade phrases with the student (d129, d132), over a staff-reading and playing trainer with XP and levels.

**Read only what your change touches:** the feature's file in `docs/features/`, its area's ledger in `docs/decisions/`, and its guide: `docs/architecture.md` (code), `docs/authoring/AUTHORING.md` (pieces), `docs/testing.md`, `docs/sprites.md` (pixel art), `docs/art-direction.md` (places), `docs/futureproofing.md` (seams), `docs/commands.md`.

## Where things are

- **Screens:** `src/game/*Scene.ts` on `ui/pixel/PixelScene.ts` (draw in `draw()`, buttons via `this.button`); staff `ui/staff/StaffView.ts`.
- **Keri** (ft_1_18): facts in `docs/keri.md`, places in `content/world/keri.json` (d108), painters in `src/game/ui/pixel/paint/` and `keri/` (kit d124). Never invent a place, house or landmark the maintainer must tell: write `KERI-TODO` and ask.
- **Feature ids** (`ft_Y_XX`, Y the iteration, 0 the MVP; `core_XX`; d037) are authoritative; in code only as criteria tags (`ft_0_08.AC1` in a test, d041).
- **Roles** (`docs/automation/work-model.md`): the **builder** builds a feature top to bottom; the **painter** owns how screens look, never what they do; the **architect** keeps the roadmap barrel level (d283), guards the axioms, deletes what nobody used. Merge rules: `docs/architect/labels.md`. **Never work on, push to or merge an item labeled `architect:blocker`**; only the maintainer removes it.
- **Work items** are tags in their doc (`ASAP`, `TODO(role, release)`, `NEEDS-HUMAN`, `IDEA`; `docs/automation/todo-tags.md`). Open a GitHub issue only when told, or for a non-trivial bug the work at hand cannot fix (d116).
- **Process only when it hurts:** a new doc, step or tool only after the same thing broke twice, as a test where possible.

## Axioms (`docs/axioms.md`, d000): read before asking the maintainer anything

They rank above every decision, feature and design doc; in a conflict **AX-0 decides**.

- **AX-0 The Core:** learning piano and music is above everything; every detail must make the student read and play more, or better.
- **AX-1 The Grind:** in a gameplay question prefer the harder option (more correct repetitions for the same reward), never punishment.
- **AX-2 The Attraction:** just enough game to bring the student back; objective feedback, no unearned praise; stimulation may be added later, never removed.
- **AX-3 The Scaffold:** if the axioms do not decide, build the simplest modular version, mark it `AX-3 provisional:` with a `TODO(architect)` tag, and do not wait (except for a step that cannot be undone).

## Non-negotiable product rules

- **Staff notation is core:** the staff is the main view and the student reads every note from it.
- **Symbols over words (d312):** while the student plays (practice, learning, tug, teaching), feedback is symbols and numbers on or by the staff, never sentences; words only for character talk between rounds, tooltips and menus.
- **Young beginner first:** big readable notes, objective feedback (AX-2.1), no punishing fail state (a lost challenge still earns XP and never takes any away). Wait mode is the MVP play mode.
- **Pieces are custom or public domain,** never copyrighted music or copied charts; each meta file records `source` and `license`. Pieces written in the game's editor get `license: "NaN"` and stay private (browser storage or `private/`), never committed.
- **Pixel-art look:** free packs (CC0 first, CC BY with credit) over redrawing, each in `docs/assets.md`, fitted to palette and grid (d084). Places are painted like Monkey Island 2 as first released in 1991 (its approach, never its art; d111), with no shadow or vignette over a picture. Reference pictures stay local. Never copyrighted or franchise art, names or music.

## Stack (update this section if a decision changes)

TypeScript (strict; typechecked by the native TypeScript 7 compiler), Vite, Phaser 4, Vitest, raw Web MIDI, Web Audio with a sampled piano, saves in IndexedDB behind `KeyValueStore` (`src/io/storage/`; localStorage only as fallback, d080). Run on the player's own machine or network, never hosted (d068); FOSS-compatible licences only. Chrome/Edge; a modest 1920x1080 laptop, Android tablets later.

## Commands

All scripts (`docs:verify` among them) and the working notes on tests and long jobs: `docs/commands.md`. Daily: `npm run check` (typecheck, lint, the unit tests the branch touches, docs check: before saying done), `npm run check:ci` (what CI runs on every push; locally only to reproduce a red CI job), `npm run test:e2e:affected`, `npm run docs:index` (regenerates `<!-- docs:... -->` blocks; never edit inside them by hand).

## Architecture rules

- `src/core/` is **pure TypeScript: no Phaser, DOM, Web MIDI or Web Audio imports.** All game rules (chart, clock, judge, scoring, progression, challenges) live there, unit-tested.
- `src/io/` wraps hardware and browser APIs; `src/io/mock/` has a virtual EZ-220 and players. No feature is testable only with the real keyboard.
- `src/game/` holds Phaser scenes and the own staff renderer; scenes read from `core/` and hold no game rules. Layout is a pure function that views only draw; views never decide correctness.
- Pictures are painted at build time in Node (`paint/`, `keri/`, `src/core/layout/`: no Phaser or DOM); each is listed in `tools/art/pictures.ts` and held to the art rules (d111).
- Content is JSON/ABC in `content/`, validated by zod; adding content needs no engine change.
- Time is audio-clock ticks (480 per quarter) in the core, never frames; the core takes an injectable clock.
- Every persisted or loaded format has a `schemaVersion` and a tested migration. Pitches are stored spelled (`step`, `alter`, `octave`) and as MIDI.
- The judge takes `NoteEvent`s and emits domain events (`NoteJudged`, `BarCompleted`, ...); play modes are strategies behind one interface; nothing reaches into judge internals.
- **No silent tool action (d286):** every tool previews its result as a picture before it commits.
- All UI text goes through string keys (`write-ui-text` skill); save data is profile-scoped; no text in art or scenes.
- Build only features with a file in `docs/features/`; keep only the seams in `docs/futureproofing.md` (changing one needs a ledger entry). Docs hold only what is, what is planned or partly built, and ideas still wanted; the rest is deleted with no trace (d151).

## Music conventions

MIDI 60 is middle C (C4); the EZ-220 spans MIDI 36 (C2) to 96 (C7); pieces stay in the player's level range. Judge pitch first, rhythm gently in the MVP; a wrong note carries a reason (wrong octave, neighbour key, wrong letter).

## Working agreements for agents

- Touching more than 2 files: write a short plan first and check it against the feature's file. One feature at a time; small, focused commits.
- A new feature, decision or piece guide follows its index (`FEATURES.md`, `DECISIONS.md`, `AUTHORING.md`), then `npm run docs:index`.
- The Stop hook lets you stop on its second failure; say plainly when a failure is not yours.
- Long runs (end-to-end, full check) go out as one background task; never poll.
- A change to controls or usage (input, keys, buttons, menus, where an action sits) gets an ergonomics review by a fresh, word-bounded reviewer agent before merge, and the PR says what changed (d293).
- Every Agent call sets `model` and `effort`: Haiku, low for mechanical jobs (run a test file, collect logs, search, a simple screenshot check); Sonnet, medium for testing, bug hunting and reviews; Opus, high for fixes across many files and art reviews, at most four Opus agents at once; an agent file's own model and effort win.
- Every code PR gets a fresh `reviewer` agent on its head and its findings fixed; the thread then merges it, a `[save]` one after green end-to-end tests too (`docs/architect/labels.md`, d166).
- **No quotes, dates or personal facts (d165)** in a committed file, commit message or PR (the gitignored `private/` at most); `docs:check`, CI and the hooks enforce it. Ledger entry format: `docs/decisions/DECISIONS.md`; an entry says only what holds, and one that no longer holds is deleted.
- **Requirements live in the repo (d165):** whatever the maintainer decides becomes, in the same session, a plain one- or two-line rule (a ledger entry, or a tag in its doc, plus a check when testable), in the work's PR or a doc-only one merged at once. Pull main and read the ledgers before designing. A rule in memory the repo lacks is written in; in a contradiction the latest word wins.
- **Authority comes from where a rule lives (d165):** every ledger entry binds, and the repo says "the maintainer", never who. Change a ledger entry only when the maintainer asked in that session; the PR then says `Ledger: asked by the maintainer in this session.`, and a reviewer rejects a ledger change without it.
- New rules have tests; for `core` and `tools` write the failing test first. A bug found by a human gets a regression test before the fix, named for the behaviour, never an issue number, as does a GitHub issue that changes behaviour; a tagged item's test names its criterion (`docs/testing.md` section 9).
- **Do not invent hardware behaviour:** key lighting, latency and drivers are unverified until the spike (`docs/hardware-notes.md`); verify with the virtual device, label synthetic fixtures `synthetic`, report real-hardware checks as "needs human".
- Generated pieces start `status: "draft"` and pass `piece:lint`; only the maintainer approves one (preview tool or pick board, d262), and only a person runs `docs:verify`.
- Prefer the platform to a new dependency; one that is added is MIT/BSD/Apache and recorded in `docs/dependencies.md`.
- Product questions are decided from the axioms, else by AX-3, not by waiting.
- **Bugs and surprises you find:** fix them on the way or write a `TODO` tag in their doc; never put child data in an issue or a doc.

## Skills

Load the fitting skill in `.claude/skills/` first (d211): `write-ui-text` (player text), `use-free-art-packs` (icons, sprites), `paint-a-scene`, `artists-notes` (shared things), `art-review` (painter PRs), `study-a-picture`, `axiom-call` (product questions), `log-decision`, `save-format-bump` (saves), `before-pr`, `file-issue`.

## Definition of done (any task)

The feature's criteria are met, tests and checks pass, touched docs are updated, and a note says what was done and what was not verified.
