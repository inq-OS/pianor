---
id: "ft_Y_09"
title: "Demo scenario (autoplay)"
scope: "A dev switch that plays the real flow from the menu through a piece by itself, in Wait or Tempo mode, with seeded mistakes"
effort: "simple"
status: "built (dev only); watching it in a normal browser with sound open (Human)"
completeness: 90
---

# ft_Y_09: Demo scenario (autoplay)

A dev switch that plays the real flow from the menu through a piece by itself, in Wait or Tempo mode, with seeded mistakes, so the maintainer and agents can see the core without playing. Also a smoke test and a timing stress run. Index: [FEATURES.md](FEATURES.md).

## Rules

Run `npm run demo` or open `/?autoplay=1` on the dev server. Overrides: `scenario=<id>` (default `clean-wait`), `piece=<id>`, `speed=<n>` (Wait mode only), `seed=<n>`.

1. **Dev only:** `flags.autoplay` in `src/config.ts` is null unless `import.meta.env.DEV` and `?autoplay=1`. `src/main.ts` loads the director by dynamic import behind `import.meta.env.DEV`, so a production build holds none of it (only the flag parser). It forces the virtual EZ-220 and its sound on. No on-screen "autoplay on" label.
2. **In-memory player:** `main.ts` builds the profile service on `MemoryStore` (`createMemoryProfileService`, every piece unlocked) and the own pieces on a second one; `localStorage` is never touched. The menu's "progress is not saved" line is true.
3. **The director** (`src/dev/autoplay/director.ts`) holds no game rules. It sets the play mode via `ProfileService.updatePlaySettings`, then presses what a finger could (mouse events on the canvas at button places) and reads scenes only through a narrow view (`buttons`, the practice scene's `transport`, `result`). Keys go in as the virtual EZ-220's MIDI bytes.
4. **Wait mode** plays the performance shortly after the screen comes up. **Tempo mode** presses one starting key, waits for the count-in and plays every note at `Transport.timeOfTick`, so timing results are real. `ClockScheduler` runs each key when the audio clock reaches it and stamps it with the moment meant, using the exact inverse of `SongClock.fromDomTime` (`songToDomTime`); mapping through `nowMs` made notes early by the output latency.
5. **A challenge** (ft_1_21.AC10) starts the scenario's scene, talks to the character whose phrases hold the piece, picks the tug on its menu and plays each of the student's phrases with the virtual player until the character's closing line, logging the outcome. It reads the scene's tug state and touches no tug rules. **A week** (ft_1_27.AC2) puts the piece on the curriculum due today (no weekly test days), writes one whole play of it on each of the six days before (synthetic, getting cleaner, `pastWeek.ts`), plays the scenario's runs, then opens the room: Kiur's and the teacher's lines are read a page at a time, her line opens the piano, the player plays her piece once and her verdict is read and logged.
6. **Scenarios** are `content/dev/scenarios.json` (`schemaVersion` 1, zod in `src/dev/autoplay/scenario.ts`): piece (or the first offered), mode, score view, activity (practice, teacher, script, challenge, week), player (`clean`, or `messy` with `wrongKeys`, `skips`, `jitterMs`), speed, seed, `after` the results (`stop`, `again`, `next-piece`), `maxRuns`. Built in: `clean-wait`, `clean-tempo`, `messy-tempo`, `tour` (every piece in turn), `teacher` (a curriculum piece three times, then the teacher's screen, ft_1_26), `challenge` (Puuvaim's piece practised clean in the room, then his tug in the knoll, won), `week` (Little Steps on six past days and twice today, then the teacher's check-up in the room, passed).
7. **The performance is a pure function** of chart and scenario (`scenarioPerformance.ts`): the seed picks wrong keys (and their kind), skipped steps (Tempo only), jitter and velocity. Same seed, same run. The shipped messy-tempo seed keeps every planned timing at least 20 ms from the on-time edge so clock noise cannot flip a verdict.
8. On the staff in Tempo mode the messy run shows grey (fine), yellow (early or late), red 0 (missed). A wrong key flashes the awaited note red 700 ms, so a late-played note can look red briefly.
9. Tests: `src/config.test.ts`, `scenario.test.ts`, `scenarioPerformance.test.ts`, `clockScheduler.test.ts`, and nine end-to-end tests in `tests/e2e/autoplay.spec.ts` (clean-wait is `@smoke`).
11. Not built: pause or step, recording to a file, a settings-screen scenario. Not verified: a normal browser with sound (the audio clock is suspended until the first click, then the clock jumps once; the scheduler follows it, untried by hand), a tablet.

## Acceptance criteria

- **ft_Y_09.AC1** The switch exists only in a dev build and only with `?autoplay=1`: off in a production build whatever the address says, and without it nothing plays by itself. The player is in memory: nothing is read from or written to the browser's saved progress.
- **ft_Y_09.AC2** Scenarios are data with a `schemaVersion`, checked by a schema: the built-in ones are valid, a bad file, duplicate ids and scenarios that could not play (skipped notes in Wait mode, Tempo mode at another speed) are refused.
- **ft_Y_09.AC3** A scenario is seeded and repeatable: the same seed gives the same performance (pure function, unit-tested) and, played, the same result up to a few ms of clock noise; the messy player makes exactly the planned wrong keys (of the planned kinds) and skips.
- **ft_Y_09.AC4** In Wait mode the game plays a scenario from the menu to the results screen without a key press.
- **ft_Y_09.AC5** In Tempo mode the same, on the game's clock: every note is played at the transport's time, and the results carry a real timing result (a clean run is on time, a messy run has early, late and missed notes).
- **ft_Y_09.AC6** A looping scenario goes back to the menu from the results and plays the next piece.
- **ft_Y_09.AC8** A person watches `npm run demo` in a normal browser, with sound, and finds it shows how the core looks and sounds. [human]

