---
covers: ["src/core/", "src/io/", "src/game/"]
---
# Pianor: Prior Art, Architecture and Plan


Findings, proposals and the static analysis guide live in `docs/architecture/`: [static-analysis.md](architecture/static-analysis.md), [maintenance.md](architecture/maintenance.md), [magic-numbers.md](architecture/magic-numbers.md), [docs-review.md](architecture/docs-review.md), [architecture-review.md](architecture/architecture-review.md), [dev-friction.md](architecture/dev-friction.md). New to web development: [web-for-c-developers.md](web-for-c-developers.md).

## 1. Project summary

A piano-learning game for students using a Yamaha EZ-220 over USB-MIDI. MVP: tracks in musical notation (imported or hand-made), XP and levels, minimal pixel-art graphics. The game around it is a point-and-click adventure on Keri island, where characters teach the student phrases and challenge them to trade phrases (d129, d132).

The EZ-220 facts that matter:
- 61 velocity-sensitive keys with USB-to-host. It is a MIDI input device, with no MIDI DIN ports.
- It has lighted keys. Per the manual, notes sent from a computer on MIDI channel 1 light the matching keys. This is a possible "show the next note" feature, **needs hands-on verification**.
- Yamaha's USB-MIDI driver is mentioned for some OS versions; recent OSes should treat it as class-compliant. Verify on the actual machine.

## 1b. Decisions (updated)

- Player: designed for beginner students, children and adults alike; the reference keyboard is the Yamaha EZ-220.
- **Staff notation is core to the MVP.** The game's job is to teach reading, so the staff is the main view.
- **Falling notes (Guitar Hero style) are out of the MVP.** They are a Phase 4+ optional mode at most, because they let a student play without reading.
- Consequence: the notation renderer is the most important piece of the MVP, so it is designed first (section 4).

## 2. Prior art (what exists, what to borrow)

| Project | Stack / license | Useful for |
|---|---|---|
| Neothesia | Rust, GPL-3.0 | Best modern falling-notes reference; lighting and output handling. Reference only unless Pianor goes GPL |
| PianoBooster | C++/Qt, GPL | "Wait for the player" mode, left/right hand practice, MIDI-file-as-lesson model |
| Piano Hero / Synthesia legacy source | C++, MIT | Original note-matching and scoring ideas; permissive |
| madiers/piano-midi | Electron + TS | Closest to a lesson app: per-note feedback explaining why a note was wrong (wrong octave, neighbour key), staff-always design, raw Web MIDI (~200 lines, no dependency) |
| jts-nyc/MIDI-HERO | Browser | Concrete timing windows: ±35 ms Perfect, ±70 Great, ±120 Good; teacher "song pack" JSON; import a MIDI file and pick the part to play |
| Midiano | Browser | Falling notes + sheet music; lights keyboard keys by sending quiet notes ahead of time. Proves the light-up trick works over Web MIDI |
| malandrin/piano-hero, Belf186/falling-notes | Browser | Small, readable Web MIDI + Web Audio examples; own MIDI parser |
| OpenSheetMusicDisplay (OSMD) | TS, BSD-3 | MusicXML to notation in the browser, if real score rendering is wanted |
| abcjs | JS, MIT | ABC notation parser (parser-only mode) and renderer; candidate for parsing the authoring format. Note: old forks of it are GPL, use the main paulrosen/abcjs repo |
| Open-Web-Piano, smplr, @tonejs/midi | JS libs | Sampled piano sound, MIDI parsing. Checked (see `docs/decisions/workflow.md#d024`): smplr is MIT but ships other piano samples fetched online and is pre-1.0, so Pianor keeps its own small sampler; @tonejs/midi (MIT) is the MIDI parser to use when MIDI import is scheduled |
| huytd/sightread | TS/React, GPL-3.0 | Web piano trainer with a sheet-music mode. Reference only (GPL); it draws its own staff and parses MIDI with @tonejs/midi |
| VexFlow | TS, MIT (v5) | Renders notation to canvas or SVG: grand staff, ties, beams, accidentals, key signatures. The real alternative to a growing own renderer; see `docs/decisions/workflow.md#d024` |
| xml2abc (W. Vree) | Python, LGPL | MusicXML to ABC converter; a candidate external tool for the import step, not linkable code in an MIT project. Fingerings are not translated |
| musicjson | JS, MIT | MusicXML to JSON; last updated 2012, not a candidate |
| GodotGarden/piano-practice | Godot 4, Apache-2.0 | Early-stage; little to take |

Avoid as a code base: ekkx/notefall and forks (PolyForm Shield, source-available, not FOSS).

**Gap in the market:** nobody has combined a point-and-click adventure, whose characters challenge the student to trade musical phrases, with graded MIDI input. Everything above is either a trainer or a visualizer. The adventure is the novel part, so it is where the effort goes; the MIDI plumbing can be borrowed.

## 3. Key decision: platform

**Chosen: browser PWA, TypeScript, Vite, Phaser (version 4 since d007; the comparison below was written for Phaser 3 and still holds).**
- Web MIDI supports both input and output, and you need output to light keys. Godot supports MIDI input only, and Web MIDI needs Chrome or Edge (Safari and Firefox are not reliable).
- Runs on a laptop or an Android tablet with a USB OTG cable; no install, easy sharing with other students and parents.
- Phaser handles pixel-art scaling, sprites, tilemaps and scenes, How pixel art is drawn and handed to Phaser is in `docs/sprites.md`.

Alternatives: Godot 4 (nicer editor, but no MIDI out and more friction on the web); Electron (only worth it if browser MIDI proves flaky, as madiers/piano-midi shows it needs permission workarounds).

## 4. Architecture

Principle: a **pure-TypeScript core with no engine dependency**, so the rules are testable without a piano or a screen. Phaser is only a view.

```
src/
  main.ts, compose.ts    composition root: the Phaser game, sound and keyboards; profileSetup.ts the save store;
                         config.ts / appConfig.ts hold the URL switches (docs/url-switches.md), the only code that reads
                         the address; scenes get the flags and the PieceCatalogue through GameContext (game/context.ts)
  core/                  pure TS, unit-tested (no Phaser, DOM, Web MIDI or Web Audio)
    chart/               Chart model and zod schema, tick math (tempo map), pitch spelling, migrations, playback list;
                         the one home of music primitives (STEP_SEMITONES, isWhiteKey/isBlackKey, abcPitch, NOTE_TICKS,
                         noteLengthOf, ticksPerBar/buildBars, tieLinks/tieChain)
    judge/               Wait mode and Tempo mode (PlayMode), steps, wrong-note reasons, result tracker, timing windows, play settings
    transport/           Song time for Tempo mode: count-in, tempo percent, tick <-> clock
    layout/              Staff layout (pure), pages, pixel view, staff settings, playhead, score colours; the plans of the painted
                         screens (room.ts, keriMap.ts, knoll.ts: where things stand, in layout cells of 2 x 2 fine pixels, d110)
    world/               The world model of Keri (content/world/keri.json, d108): schema, loadWorld, geometry
    sky/                 The hour of the sky from the real sun (skyPhase, sceneLook, wind; ft_1_14, d097)
    scoring/             Stars, the two-hands bonus, the session lines of the looping play (ft_1_12)
    progression/         XP, levels, unlocks, profile (versioned save; the version history is the comment on PROFILE_SCHEMA_VERSION in profile.ts), migrations, repository
    editor/              Piece editor model: edits, history, ABC and chart output, hit testing (ft_1_02a)
    campaign/            The campaign state kept in the save (ft_1_06)
    properties/          What a piece asks of the player (note values, range, hands), for the piece card and difficulty
    random.ts, issues.ts Seeded random numbers; schema problems as readable lines
    upgrade.ts, median.ts The schemaVersion loop every saved format shares (charts, profiles); the median
    text/                String keys, wrong-note feedback wording, the Free play rundown lines
  io/                    hardware and browser APIs behind small interfaces
    midi/                Raw Web MIDI in, hot-plug, key-light output (a null one until ft_0_01 verifies it)
    audio/               Web Audio: sampled piano, metronome, the song clock
    storage/             localStorage and in-memory stores
    files/               Download and pick text files (piece files of the editor)
    mock/                Virtual EZ-220 (fake MIDIAccess), on-screen and QWERTY keyboards, scripted/virtual player (no-hardware dev and tests)
  game/                  Phaser scenes (draw only): Boot, Menu, Pieces, Practice, Results, Rundown, Settings,
                         Editor, Preview, Credits, the player's room (ProfileDashboard), KeriMap, Knoll,
                         the trainers, the admin pages, and the dev-only StaffDemo and ArtDemo; scenes.ts lists
                         every scene key with the data its init takes, and startScene checks both (Esc goes through back())
    ui/pixel/            The pixel-art kit: palette, font, sprites, PixelScene (base of every scene; topBar for the play screens), PixelObjects
    ui/pixel/paint/      Painting a picture from a set in metres: ray caster, painter (light, shadow, outline), materials,
                         noise, and bringing full colour down to a palette (d111). No Phaser, no DOM: it runs in Node at build time
    ui/pixel/keri/       Keri's painted pictures: the room (roomSet, roomPicture), the map (mapPicture), the knoll
                         (knollPicture), the shared palette (keriPalette), clouds (curlCloud), and their packing. Also Node-safe.
                         The look and its rules: docs/art-direction.md
    ui/staff/            StaffView: draws a StaffLayout and the play state
    results/             OutcomeScene: base of Results (XP line, level, what opened up)
    practice/, profile/, editor/, preview/, menu/   small helpers per scene (PracticeController, ProfileService, OwnPieces, ...)
    practice/PlaySession  what every screen where a piece is played shares (Practice, the tug):
                         the staff for the player's settings, the PracticeController (Wait or Tempo, hints, the per-frame
                         advance and playhead), Kiur's bubble with its timers and the wrong-note flash, and one destroy()
  dev/                   dev-only pages (?demo=keys, audio, profile, preview; staff and art are scenes) and the autoplay director (?autoplay=1, dev/autoplay/)
  spike/                 the hardware spike page (spike.html)
content/                 JSON/ABC data: pieces, curriculum, the tug's rules, characters, conversations, the world model of Keri (world/)
tools/                   CLI and build: piece compile/lint/build, generators, the Vite pieces plugin; vite-keri.ts paints
                         Keri's pictures when the game is built (module virtual:keri-pictures, one file per picture
                         and hour, loaded per scene, d143); art/ paints one to a PNG file
tests/                   cross-module tests: e2e (Playwright), fixtures, golden, replays, contracts, integration
```

Roadmap: the phases (section 5) map onto the features in `docs/features/FEATURES.md`; feature ids are authoritative.

### Core data model (the part to get right early)

- **Chart**: the canonical definition is `docs/authoring/au03-chart-format.md` (spelled pitch, tracks, tempo/meter/key maps, bars, phrases). One format that ABC compilation, MIDI import and hand authoring all produce. Do not redefine it here.
- **Phrase**: a run of N bars (e.g. 4) inside a chart: the unit a character and the student trade in a tug (ft_1_21).
- **Judge output per note**: `{ expected, played, timingErrorMs, verdict }`, with verdicts like Perfect/Good/Early/Late/WrongNote/Missed. Keep the *reason* a note was wrong (as piano-midi does); it drives student-friendly feedback.
- **BarResult**: accuracy (0..1) and tempo score.
- **Hands**: results carry `bothHands { notes, together }` (notes in steps where the right and left hand play at once, and how many of those were pressed together first try). `bothHandsMultiplier` turns that into an XP multiplier (ft_0_15). It only adds, never penalises.

### Timing and input

- Timestamp MIDI events with the `MIDIMessageEvent` timestamp and map them onto the audio clock; judge in song time, not frame time.
- **MVP judges pitch first** (is it the right key?) and rhythm gently. Timing windows start much wider than MIDI-HERO's ±35/70/120 ms, which are for experienced players; tighten them as the student levels up. Tempo mode judges the onset and, since d093, how long the key is held (core_01 slice f); Wait mode judges onsets only.
- **MVP is Wait mode only:** the cursor stays on the current note until the right key is pressed, and a gentle metronome plus tempo bonus adds rhythm later. **Tempo mode** (cursor advances with the beat, timing counts) arrives after the student is comfortable reading.
- Measure end-to-end latency in the spike before choosing window sizes.

### Notation display

- **MVP: own staff renderer in Phaser, drawn from the chart.** Reasons: full control over pixel-art style, big readable notes for a young student, per-note highlight, hit and miss animations, and a "current note" cursor. OSMD is heavy and its rendering is hard to animate or restyle (its own docs note notes can't be moved or placed quickly), so it is a poor fit for a game loop.
- Restrict the subset to what a beginner needs: treble clef first, then bass clef and grand staff; key of C; whole, half, quarter and (later) eighth notes and rests; bar lines; time signature. Ties, accidentals and key signatures come in later phases.
- Beginner aids, each toggleable and each "costing" something in game terms so they fade out: note-name label under the note, finger numbers, a highlighted target key on an on-screen keyboard, and (after the Phase 0 spike) lighting the key on the EZ-220.
- Principle borrowed from piano-midi: feedback must say why a note was wrong ("right letter, wrong octave", "neighbour key"), since the skill being trained is mapping a staff position to a key.
- Import: the chart format stays the single source of truth for the game, and ABC plus the meta file stays the source of truth for authoring. A MusicXML importer first and a MIDI importer later (a small own parser or a library, decided then) emit ABC and a draft meta file, so they use the same compiler, linter and approval gate (`docs/features/ft_Y_04-piece-import.md`), instead of rendering MusicXML directly.
- Range: the EZ-220 has 61 keys, so charts stay within that range; beginner pieces sit around middle C in five-finger positions.

### Piece authoring and generation

Pieces must be fully custom, so authoring is a first-class pipeline, not an afterthought (details in `docs/authoring/AUTHORING.md`):

- **Source of truth:** ABC notation (`piece.abc`) plus a sidecar `piece.meta.json` (level, phrases, tags, status, provenance), compiled to the chart JSON the game loads.
- **Linter** enforces the level definition: bar lengths, range, allowed note values, maximum leaps, fingering sanity, required source/license. It also outputs a difficulty score.
- **Three ways to create pieces:** by hand, deterministic seeded generators (patterns, scales, drills, phrases), and an AI-agent loop (compose ABC, lint, fix, build). All output starts as `draft`.
- **Human approval gate:** only a parent or teacher can set `approved`, after previewing the piece (staff plus audio plus play-along).

### Content and licensing

Use public-domain pieces and original or CC-licensed arrangements (e.g. piano-midi.de is CC BY-SA, so check compatibility with your chosen license). Store source and license in each chart. Keep game art original to avoid IP problems; "Pokémon style" should mean mechanics and feel, not assets or names.

## 5. Plan

The phased roadmap and every feature, with its scope and status, are in `docs/features/FEATURES.md` (Phase 0 is ft_0_01, Phase 1 the MVP, ft_0_00 to ft_0_17).

## 6. Risks and open questions

- Key-light behavior and USB-MIDI quirks on the EZ-220 (verify in the spike).
- Browser latency and audio-clock sync; Safari/Firefox not supported.
- Staff renderer scope: it is now the biggest MVP task; keep the supported notation subset small and grow it with a beginner's lessons.
- Which beginner method book or pieces should the curriculum follow? Matching the curriculum (and its order of introducing notes) makes the game reinforce lessons; check that using those pieces is legally fine, otherwise write original or public-domain equivalents.
- Target device (laptop vs Android tablet) and screen size, which sets staff and note sizes for a young student.
- Project license: settled as MIT (`LICENSE`), so GPL projects such as Neothesia and PianoBooster stay reference-only; GPL code may live only in the gitignored `private/` folder (`docs/decisions/workflow.md#d026`).
- Content sourcing: solved in principle by custom generation, but quality and musicality of generated pieces needs human review; the approval gate and linter exist for that.
- ABC covers the beginner subset well. Settled in ft_0_03: the project has its own strict ABC parser (`src/core/piece/abc.ts`) that handles fingerings and two-hand voices and refuses what it does not support.

## Sources

- https://github.com/PolyMeilex/Neothesia
- https://github.com/pianobooster/PianoBooster
- https://sourceforge.net/projects/pianohero/
- https://github.com/madiers/piano-midi
- https://github.com/jts-nyc/MIDI-HERO
- https://midiano.com/
- https://github.com/malandrin/piano-hero
- https://github.com/Belf186/falling-notes
- https://github.com/opensheetmusicdisplay/opensheetmusicdisplay
- https://github.com/iBundin/Open-Web-Piano
- https://github.com/paulrosen/abcjs
- https://github.com/GodotGarden/piano-practice
- https://docs.godotengine.org/en/4.3/classes/class_inputeventmidi.html
- https://www.bhphotovideo.com/lit_files/90227.pdf (EZ-220 owner's manual)
