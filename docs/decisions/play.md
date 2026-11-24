---
title: "Decisions: Playing and input"
---
# Decisions: Playing and input

The judge, play modes, practice, trainers, metronome, audio and MIDI. One entry per decision, oldest first. Index: [DECISIONS.md](DECISIONS.md).

## d011

**`PlayMode` is a small interface (`handle(NoteEvent) -> JudgeEvent[]`, `getState()`) and `WaitMode` is the first mode.** Features: ft_0_08.

A shared `ResultTracker` emits `BarCompleted`, `PhraseCompleted` and `PieceCompleted` (events carry `v: 1`). Every note-on is a press (velocity 0 is note-off), chords may be played in any order, and tied continuations need no press. A wrong note never advances or fails and carries a reason (`wrong-octave`, `neighbour-key`, `wrong-letter`) plus direction. Accuracy is firstTryCorrect / notes; rhythm error is recorded in ms (`rhythmErrorMs`) and never changes a verdict; hints are counted per correct note. Replay fixtures live in `tests/replays/*.replay.json`.

Check: `src/core/judge/wait.test.ts` "a wrong key does not advance, carries a reason, and is gentle"; `src/core/judge/wait.test.ts` "reports neighbour keys and wrong letters"; `src/core/judge/wait.test.ts` "a note-on with velocity 0 is a note-off"; `tests/replays/replay.test.ts` "gives the wrong-note verdicts the fixture expects"

## d012

**Input is `KeyboardInput` events merged by `CompositeKeyboard`, with a virtual EZ-220 for tests.** Features: ft_0_06.

`src/io/keyboard.ts` is the only io file `src/game` may import; `createKeyboardInputs` (`src/io/createInputs.ts`) is the composition root, and a missing MIDI device is a status, not an error. `WebMidiKeyboard` follows hot-plug and sends synthetic note-offs for keys held when the device vanishes. `VirtualEz220` speaks raw channel-1 bytes in MIDI 36 to 96; `composePerformance` makes a seeded virtual performance. The computer keyboard maps by `KeyboardEvent.code` (Z row = C4, Q row an octave up, arrows shift octaves). Key lights are `nullKeyLights` until hardware is verified; `?demo=keys` is the dev page.

Check: `src/io/createInputs.test.ts` "is playable at once with the on-screen and computer keyboards, before MIDI is ready"; `src/io/createInputs.test.ts` "without Web MIDI (as in Node) reports"; `src/io/midi/WebMidiKeyboard.test.ts` "hot-plug: goes disconnected, releases held keys, and reconnects"; `src/io/mock/VirtualEz220.test.ts` "sends note-on on channel 1 and releases as velocity 0 by default"; `src/io/mock/QwertyKeyboard.test.ts` "shifts octaves with the arrow keys, releasing held keys first, within the keyboard"

## d013

**The practice slice is a menu, a Practice scene and results, with scenes that only draw and forward.** Features: ft_0_09.

`PracticeController` (no Phaser) connects a `KeyboardInput` to `WaitMode` and is tested in `tests/practice/`; `src/main.ts` is the composition root and starts before MIDI permission is answered. The on-screen keyboard hides while a real piano is connected (`?keys=1` keeps it). Hints are two buttons (note names, fingers) toggled by mouse or touch only, counted per correct note. Stars depend on accuracy only (`core/scoring/stars.ts`): 3 from 95%, 2 from 75%, otherwise 1; finishing earns at least one. `window.__game` exists in dev builds only. A wrong note shows on the staff as the key that was played, with no sentence (ft_1_12.AC7).

Check: `src/core/scoring/stars.test.ts` "gives three stars for 95% and up, two for 75% and up, otherwise one"; `src/core/scoring/stars.test.ts` "always gives at least one star, even for zero accuracy"; `tests/practice/practice-controller.test.ts` "plays a whole piece from a keyboard: every note judged, progress updated, completed once"

## d016

**Audio is the Salamander Grand Piano samples on one `AudioContext` song clock.** Features: ft_0_07.

21 MP3 files (C2 to C7 every minor third, Salamander, Yamaha C5, Alexander Holm, CC BY 3.0, credited in the menu) are bundled unchanged in `public/audio/salamander/`; other keys are played by speed change of at most 1.5 semitones, one velocity layer, velocity as gain. Song time is `AudioContext` time in ms (`AudioSongClock`), and MIDI timestamps map onto it through `toSongTimeMs`. The metronome wakes every 25 ms and schedules clicks 120 ms ahead on the audio clock. The piano sounds for on-screen and computer keys always, and for real MIDI only with `?monitor=1`, because the EZ-220 sounds itself.

Check: `src/io/audio/SongClock.test.ts` "maps DOM timestamps onto the audio clock using the context output timestamp"; `src/io/audio/SamplerPiano.test.ts` "loads all 21 samples and becomes ready"; `src/io/audio/monitor.test.ts` "stays quiet for real MIDI by default: the keyboard sounds itself"; `src/io/audio/monitor.test.ts` "sounds on-screen and computer keys"; `src/io/audio/Metronome.test.ts` "schedules ahead of time so a late timer does not move a beat"

## d032

**The staff shows one line at a time by default, with per-player settings in the save (profile v2).** Features: ft_0_16.

`layoutStaff` takes `barsPerLine` and `linesPerPage`, sizes for one page and keeps line positions identical across pages; the time signature is drawn on the first line only. "Auto" bars per line takes 2 or 4, whichever draws bigger notes, 4 when equal. A page turn fades in over 160 ms from 20% opacity with no movement, following the cursor. `settings.staff` holds `lines` (1, 2 or "all") and `barsPerLine` ("auto", 2 or 4); settings belong to a player, never the device, and `ProfileService.updateStaffSettings` validates with the schema.

Check: `src/core/layout/staffSettings.test.ts` "auto never draws smaller notes than either choice would"; `src/core/layout/staffSettings.test.ts` "a chosen number of lines and bars is used as it is"; `tests/progression/profile-service.test.ts` "changed staff settings are saved, survive a restart, and belong to the player who changed them"

## d033

**The hardware spike page `spike.html` is standalone raw Web MIDI and Web Audio, built into production too.** Features: ft_0_01, core_01.

`src/spike/` may not import game code, Phaser or core (lint rule) and shares only the simulated EZ-220 (`?device=virtual`). Its download (`pianor-midi-log`, version 1) keeps raw bytes with timestamps and a replay draft in the `tests/replays/*.replay.json` format, marked `synthetic` when simulated. The tap test measures each key press's MIDI timestamp minus the expected speaker time of its click (median and median distance), the delay Tempo mode must allow for. Go/no-go criteria are in `docs/hardware-test-checklist.md`; key lights and Local Control are not needed for go.

Check: `tests/e2e/spike.spec.ts` "logs key presses and releases with note, velocity and channel, and hides active sensing until asked"; `tests/e2e/spike.spec.ts` "sends notes for the key lights on the chosen channel, a scale, Local Control and all notes off"; `tests/e2e/spike.spec.ts` "follows unplugging and plugging back in without a reload"

## d038

**Tempo mode runs on a pure Transport class, with press windows that partition time and a missed note as its own event.** Features: core_01.

`core/transport` is told the clock's time; the first press starts it (one bar counted in) and is not a note. Each step's window is `windowMs` either side, cut to half the gap to its neighbours (provisional 60, 150, 400 ms until the hardware spike), so a press belongs to one step; presses outside every window are ignored. A miss emits `NoteMissed` (not a third `NoteJudged` verdict), scores 0 and lowers accuracy only; judge event version stays 1; `PlayMode.advance?` and `setHints?` are optional so Wait mode is unchanged.

Check: `src/core/judge/tempo.test.ts` "presses before the first window are ignored (the count-in is not a note)"; `src/core/judge/tempo.test.ts` "a mix of played and missed notes adds up: score is the mean with missed as 0"; `src/core/judge/tempo.test.ts` "core_03.AC4 the last note late window and the next lap first note early window split the gap between them"; `src/core/transport/transport.test.ts` "counts one bar before tick 0: at 70 bpm in 4/4 that is four beats of 857 ms"

## d039

**Tempo mode is a per-player setting, not a second screen; the save went to v4.** Features: core_01.

`settings.play = { mode: 'wait' | 'tempo', scoreView: 'off' | 'colour' | 'number' }`, default Wait and colours (save v4, migration from 3). In Tempo the scene builds a `Transport` and `TempoMode`, calls `controller.advance(clock.nowMs())` each frame and moves the playhead with the pure `playheadAt`; `StaffView.followPlayhead(true)` makes the playhead decide the page. Score colours (`core/layout/scoreColour.ts`): red missed, black to grey fine, yellow to orange mistimed; the 0 to 100 number is the colour-blind backup.

Check: `src/core/judge/playSettings.test.ts` "core_01.AC10 core_01.AC13 goes Wait, the following clock, Tempo with a count-in, Tempo from the first note, then Wait again"; `src/core/layout/scoreColour.test.ts` "core_01.AC8: an on-time note let go at once is orange"; `src/core/progression/migrate.test.ts` "migrates a v4 save to v5 (core_04)"

## d043

**A practice section is a chart cut from the piece; the tempo percent and click are toggles of the practice screen.** Features: core_02, core_03.

`sliceChart(chart, first, last)` cuts bars to tick 0 (id `piece#bars-2-3`) so staff, modes and transport work unchanged; a section never pays (no XP, results or stars) and loops with a lap counter; `barAtPoint` picks bars from the whole-piece staff. Tempo percent runs 30 to 150 in steps of 10 and restarts the scene. The click is off in Wait, on in Tempo; hotkeys in `src/game/practice/hotkeys.ts`: Shift+R section, Shift+M click, Shift+= and Shift+- click speed in 5 BPM steps from 30 to 200 (Wait only), because R and M are piano keys. The tools strip is 14 art pixels under the top bar.

Check: `src/core/chart/section.test.ts` "makes bars 2 to 3 a chart of two bars starting at tick 0, with its notes moved and renumbered"; `src/core/transport/practiceSpeed.test.ts` "the tempo percent is 30 to 150 in steps of ten, and a value outside is pulled back in"; `tests/practice/hotkeys.test.ts` "takes a piano key of the computer keyboard only with Shift"; `src/game/practice/clickSpeed.test.ts` "keeps the click between CLICK_MIN and CLICK_MAX"

## d044

**Piece stats are derived from the attempt history, not stored; save v5 records how each attempt was played.** Features: core_04, core_03.

Pure functions in `core/progression/stats.ts` fold the attempts; each attempt gets `play: { mode, tempoPercent }` and an optional `timing` block (migration gives old attempts Wait at 100 percent). "Played well" is data in `content/curriculum/progression.json` (`stats`): window 60 plays, at least 90 percent right first time, no hint, and in Tempo a timing score of at least 70 (provisional). Proficiency counts every play; speed is the highest tempo percent played well in Tempo; a piece starts at the last attempt's percent; sections are not recorded.

Check: `src/core/progression/stats.test.ts` "has the provisional numbers: the last 60 plays, 90 percent right, a timing score of 70, no hints"; `src/core/progression/stats.test.ts` "in Tempo mode also needs a good enough timing score, and a missing timing is not good"; `src/core/progression/migrate.test.ts` "migrates a v4 save to v5 (core_04)"

## d093

**Tempo mode grades how long each note is held.** Features: core_01.

A note's score is its press score times a hold factor: 1 when held at least `max(85% of the value, value - 80 ms)` (a tie chain is one value), falling linearly to 0.5 for a tap; the numbers live in one config object (provisional). Legato overlap, a lost note-off and a release under the sustain pedal never lower it, holding into a rest is not graded, and a note is never missed for its length. It is always on for players; the admin hub has a per-device "Grade note length" switch (default on, off restores the onset-only judge) in `pianor-admin/settings` (`schemaVersion` 1). Bar, phrase and piece results complete once every note starting in them has a hold result, so judge event version goes up (old read); the hold is an optional field beside `noteTimings` (no save bump). Wait mode is unchanged. Real EZ-220 pedal and feel need a human.

Check: `src/core/judge/tempo.hold.test.ts` "core_01.AC6: the press score is multiplied by the hold factor"; `src/core/judge/tempo.hold.test.ts` "core_01.AC6: a tie chain is one value"; `src/core/judge/tempo.hold.test.ts` "core_01.AC6: legato overlap is right playing"; `src/core/judge/tempo.hold.test.ts` "core_01.AC6: a lost note-off counts as held in full once the hold is due"

## d100

**The tug is played from memory with no staff, harder at each level.** Features: ft_1_21, core_01.

The tug never draws the staff; the piece was met on the staff earlier. Level 1 is Wait mode with `moveOnWrong` (`src/core/judge/wait.ts`: a wrong key is judged wrong with its reason, unpressed notes of the step are missed, the cursor moves on; no click, no count-in); level 2 is Tempo at 100 per cent with the click through count-in and piece; level 3 is Tempo at 100 per cent with only the count-in bar heard (`Transport.metronome({ countInOnly: true })`, `beats`). Each level's mode is in `content/challenge/rules.json`; a wrong key costs the exchange (d129).

Check: `src/core/judge/wait.test.ts` "a wrong key is judged wrong with its reason, the note is missed and the cursor moves on"; `src/core/judge/wait.test.ts` "a wrong key in a chord ends the chord: keys already pressed stay right, the rest are missed"; `src/core/transport/transport.test.ts` "the plan stops after the count-in beats"

## d168

**Learning a piece is perfect runs: bar by bar in 4-bar chunks, each chunk tested, then the joins, then the whole piece.** Features: ft_1_32.

Mistakes must not be practised, so a run counts only when it is played without fault; the piece is revealed bar by bar in chunks of 4 bars, each chunk ends in a test, chunks are then joined, and a whole-piece test closes it.

Check: `src/core/learn/plan.test.ts` "grows bar by bar inside chunks of four, confirms each chunk, then plays the whole piece"; `src/core/learn/plan.test.ts` "joins chunks by doubling on longer pieces"; `src/core/learn/run.test.ts` "stops at the first wrong key and says what it was"

## d197

**An admin setting picks the piano sound: full, light or the EZ-220 itself; full stays the default until the maintainer has listened.** Features: none.

Light is 5-second mono samples (about 20 MB, the full set about 110 MB). EZ-220 sends the game's own notes as MIDI on channel 2 with the Grand Piano program and loads no samples, because channel 1 lights the keys and would give answers away (AX-0); that channel 2 stays dark is unverified until a person tries it on the real keyboard (`docs/hardware-notes.md`).

Check: `src/io/admin/adminAccess.test.ts` "ft_0_07.AC3 is the full piano on a fresh device, light once chosen, and leaves the note-length switch alone"; `src/io/audio/SamplerPiano.test.ts` "starts light when asked: every sample one channel, cut short"; `src/io/audio/lightSample.test.ts` "is one channel, the average of the"

## d236

**Time inside the core is song time on the audio clock in ticks, 480 to a quarter note, never frames, through an injectable clock, and no test uses real timers or sleeps.** Features: core_01.

The io layer maps MIDI timestamps onto the audio clock; the core is told the time (`docs/futureproofing.md` section 1.5b, `docs/testing.md` section 2).

Check: `src/core/piece/abc.test.ts` "reports a length that does not fit the 480 ticks per quarter"; `src/io/audio/SongClock.test.ts` "maps DOM timestamps onto the audio clock using the context output timestamp"; `src/core/transport/transport.test.ts` "maps a clock time to the tick under it"

## d237

**Real EZ-220 behaviour is never claimed from a virtual run: it stays needs human until a person tests it, and when the real keyboard contradicts the virtual one, the virtual device is fixed first, with a regression test, before the code.** Features: ft_0_01.

Key lighting, latency, driver quirks, sleep and reconnect are unverified until the hardware spike and are recorded in `docs/hardware-notes.md`; the rest is marked as assumptions (CLAUDE.md, `docs/testing.md` section 7, d005).

Check: untestable: a rule about what agents may claim; real hardware needs a human

## d281

**A learning run with every note right counts for its pace unless it was clearly uneven; a beginner's wobble passes, and an uneven run is asked again at most once.** Features: ft_1_32.

`TEMPO_RULES` in `src/core/learn/tempo.ts`: a gap is even within 50% of the run's own pace, a stop is a gap three times as long as written at that pace or longer, a run is even with no stop and at least 60% of its gaps even, and an uneven measured run is asked again at most once before the next run with every note right counts. Kiur's line for an uneven run asks for an even pace, not a slower one.

Check: `src/core/learn/tempo.test.ts` "ft_1_32.AC7 counts a slightly uneven run of a beginner as even: gaps a third off its pace, one pause of twice the gap"; `src/core/learn/progress.test.ts` "ft_1_32.AC7 asks an uneven run again once at most: the student is never held at a step for the pace"

## d299

**A beat lane shows the beat: a row of dots along the staff where a wave runs at the tempo, nudging each beat and note dot it passes; in a learning run each key's dot is coloured against the student's own pace; a click at that pace is a setting, off by default.** Features: core_13, ft_1_32.

The lane runs between the two staves or above the staff, as the player sets it (`learn.beatLane`, between by default, or off), with a ghost dot every sixteenth, a bigger dot on every beat and a dot under every note; a circle beside the staff does not fit the reading. In Tempo mode the wave runs with the piece's clock; in Wait mode it runs on from the latest right key at the click's tempo. Learning has no given tempo (ft_1_32 rule 8), so there the wave runs at the run's own pace (the baseline before three keys) and each key's dot turns green within 20% of the gap that pace asks, orange beyond, red beyond 50%, so the student sees a deviation as it happens. The learning click is off unless turned on (`learn.paceClick`). Both are optional fields with no save bump, each a picture on the settings' learning page.

Check: `src/core/layout/beatLane.test.ts` "core_13.AC5 colours a key green in step, orange a little off and red far off"; `tests/e2e/beat-lane.spec.ts` "core_13.AC2 turned off in the settings, the lane is not drawn"
