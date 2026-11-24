---
id: "ft_1_35"
title: "Autotrainer"
scope: "One tool that trains a whole piece to its tempo with no bar left behind: it plays the piece through in the clock that follows the student, sends a bar with a wrong note into a short loop until it is clean and then goes on from that bar, brings in the metronome and the beat helpers to walk the student through a bar that clearly loses the pace, raises the tempo only when every bar holds at the current one, and learns the piece bar by bar first when it is new; a practice tool, not part of the game"
effort: "large"
status: "designed, held until the maintainer starts it"
completeness: 0
depends_on: ["ft_1_32", "core_01", "core_02", "core_03", "core_08", "core_10", "core_13", "ft_Y_06"]
---
# ft_1_35: Autotrainer

Index: [FEATURES.md](FEATURES.md). Builds on what is there: learning bar by bar (ft_1_32), the clock that follows the student (core_01 slice h), the click (core_02), sections and the tempo ramp (core_03), the practice log (core_10), the measured difficulty of each bar for this player (core_08), the beat helpers (core_13) and key lights (ft_Y_06). It adds one thing: a director that decides, bar by bar, which of these the student needs next.

AX-0: every lap is read from the staff and played; a mistake is fixed at once, so it is never rehearsed. AX-1: a bar passes only by clean, even plays, and the tempo rises only when the whole piece holds. AX-2: what the student sees is a measured fact per bar (clean, even, the tempo it holds), never praise. It is a practice tool at the piano and on the practice screen, not a game step: it opens no door and earns nothing a character asks for (d278).

## Rules

1. **One loop, four states.** The director (a new folder src/core/autotrain, pure, fed judge events and the transport's ticks) is in one of: **learn** (the piece is new), **pass** (the piece played through), **fix** (one bar with a wrong note, looped), **walk** (bars that lost the pace, looped with the click). It ends in **trained**. Every state is played with notes from the staff; no state plays the piece for the student.
2. **Learn first.** A piece the player has not learned (`pieceLearned`, ft_1_32) is learned bar by bar first, exactly as through Kiur's Learn; the autotrainer then starts its first pass at the learned baseline tempo (`baselinePercent`). A learned piece with no baseline starts at its last tempo percent (core_04). `AX-3 provisional:` learning cannot be skipped inside the autotrainer; a student who already plays the piece passes its steps quickly.
3. **The pass.** The piece is played from its first bar in the clock that follows the student (core_01 rule 20) at the pass tempo, with no count-in (it starts on the first note). Each bar gets a verdict when its last note is judged: **clean** (every step right the first time), **even** (no wait of the following clock in it, its own pace within `AUTOTRAIN_RULES.barPace` of the pass tempo, and its gaps' robust spread within `AUTOTRAIN_RULES.barSpread`, the measures of ft_1_32 rule 9 per bar), or not. Every bar of a pass is written to the practice log (core_10) as a whole-piece play.
4. **Fix: a wrong note.** The first wrong key in a bar stops the pass after that key; Kiur names the mistake and its bar. The bar is looped as a section (`sliceChart`) in the same clock and tempo until it is played clean `AUTOTRAIN_RULES.fixLaps` times in a row; a wrong key in a lap starts the count again, and loses nothing. Then the pass goes on **from the bar that failed** (not the next one), so the fixed bar is played once more in its place before the music moves on. `AX-3 provisional:` `fixLaps` 2 (AX-1: one more correct repetition than "until it is right once").
5. **Help inside a fix.** With key lights on for the player (ft_Y_06), the awaited key lights after that player's N wrong presses on the same note; a lap with a lit key does not count toward `fixLaps` (as a run with note names does not count in learning, ft_1_32 rule 3). Note names and finger numbers keep the player's setting.
6. **Walk: the pace lost.** A bar that is clean but not even is noted and the pass goes on (one uneven bar is a wobble, d281). The student **clearly struggles** when a wait of the following clock is a stop (three times the note's length, `TEMPO_RULES.haltFactor`) or when `AUTOTRAIN_RULES.struggleBars` uneven bars fall within the last four bars. Then the pass stops at the end of the bar and the director walks: the struggling bars (at most four; when more, the hardest for this player by the measured bar difficulty of core_08, which falls back to the estimate for a bar with few plays; the autotrainer keeps no difficulty of its own) become a section played in strict Tempo mode with the click and the beat helpers of core_13 shown, starting at the section's proposed tempo (`proposeStartPercent`, never above the pass tempo) and ramped by `rampAfterLap` on clean laps up to the pass tempo. A lap at the pass tempo that is clean (`cleanLap`) ends the walk; the click and the helpers hide again, and the pass goes on from the section's first bar in the following clock. `AX-3 provisional:` `struggleBars` 2.
7. **The helpers come and go.** The director shows the click and the beat helpers only during a walk, unless the player has switched one on for every play (core_13 settings); it never shows key lights outside a fix. Whatever the director brought in it takes away when the walk ends, so the student keeps practising the steady beat on their own.
8. **The tempo moves as one piece.** A bar is **held** at a tempo when it was clean and even in each of its last `AUTOTRAIN_RULES.holdPasses` passes at that tempo or faster (fix and walk laps never count). When every bar is held at the pass tempo, the next pass is `AUTOTRAIN_RULES.tempoStep` percent faster, up to the piece's own tempo (100%). No bar is left behind: the tempo never rises while one bar is not held. When a pass needed a walk in more than a third of its bars, the next pass is one step slower, never below the tempo the autotrainer started at; this is help, not a penalty (nothing earned is taken). `AX-3 provisional:` `holdPasses` 2, `tempoStep` 5.
9. **Trained.** The piece is trained when every bar is held at 100%. The last pass is then saved as a pass of the piece (XP and stats as any whole play, core_04, ft_1_13); fix and walk laps are sections and earn nothing, as in core_03.
10. **What the student sees.** A strip of the piece's bars under the staff, each bar tinted by the tempo it holds (grey not held, then lighter to darker up to 100%), the pass tempo in BPM, and one line from Kiur per change of state ("Bar 5 again, twice clean.", "Bar 9 with the click, from 60 BPM.", "Every bar holds 80 BPM. Next pass 84 BPM."). Measured facts only (AX-2.1). The strings go through `write-ui-text` with Estonian.
11. **Stop and come back.** The student can leave at any time; nothing is lost. The bar holds are read back from the practice log; the pass tempo is one optional save field per player and piece (d069.3, no save bump). `AX-3 provisional:` a new day starts one tempo step below the last pass tempo (warm-up), never below the start.
12. **Where it opens.** A button on the practice screen (a picture with its tooltip "Autotrainer", in the band's item model of ft_1_20) switches the piece into the autotrainer; the same button leaves it. Not in a draft preview, the teacher's check-up, a character's tug or under autoplay; with `?learn=0` the learn state is skipped. `AX-3 provisional:` the practice screen, not a new room object.
13. `AX-3 provisional:` every number above lives in one `AUTOTRAIN_RULES` in a new src/core/autotrain/rules.ts: `barPace` 0.15, `barSpread` 0.15, `fixLaps` 2, `struggleBars` 2, `holdPasses` 2, `tempoStep` 5.

## Slices

| Slice | What | Effort |
|---|---|---|
| 1 | Pure core: bar verdicts from judge events (clean, even, stop), the director's states and moves, bar holds and the tempo step, read back from the practice log; property tests with the virtual player (every lap ends in a state; the tempo never rises with a bar not held) | medium |
| 2 | Practice screen: the button, the pass in the following clock, the fix as a looped section and the resume from the failed bar, Kiur's lines, the bar strip, the saved pass tempo | large |
| 3 | The walk: strict clock, click, ramp and the core_13 helpers brought in and hidden again | medium |
| 4 | Learn first: hand a new piece to `LearnSession` and come back at its baseline | simple |
| 5 | Key lights inside a fix (after ft_Y_06's wiring) | simple |

## Acceptance criteria

- **ft_1_35.AC1** A bar's verdict in a pass is clean when every step was right the first time, and even when the following clock did not wait in it and its pace and spread are within the rules; the verdict is a pure function of the bar's judge events (slice 1).
- **ft_1_35.AC2** A wrong key in a pass loops that bar until it is played clean twice in a row, then the pass goes on from that same bar; a wrong key in a lap restarts the count and takes nothing away (slice 1 core, slice 2 screen).
- **ft_1_35.AC3** A stop, or two uneven bars within four, starts a walk: the bars are looped in strict Tempo mode with the click and the beat helpers, from a tempo no faster than the pass, ramped on clean laps; a clean lap at the pass tempo ends it, hides what it brought in and resumes the pass at the section's first bar (slice 1 core, slice 3 screen).
- **ft_1_35.AC4** The pass tempo rises by one step only when every bar is held at it (clean and even in its last two passes), never above the piece's tempo; fix and walk laps never count toward a hold (slice 1).
- **ft_1_35.AC5** A piece is trained when every bar is held at 100%; that pass is saved as a whole play, and no fix or walk lap earns XP or changes the piece stats (slice 1 core, slice 2 screen).
- **ft_1_35.AC6** A piece not yet learned is learned bar by bar first, and the first pass starts at the learned baseline tempo (slice 4).
- **ft_1_35.AC7** Leaving and opening the autotrainer again on the same piece keeps every bar's hold and the pass tempo (slice 2).
- **ft_1_35.AC8** Inside a fix, with key lights on, the awaited key lights after the player's N wrong presses, and a lap with a lit key does not count as clean (slice 5).
- **ft_1_35.AC9** The student plays the EZ-220 through the autotrainer and the walk's helpers can be followed by eye. [human]

## TODO

Building waits for the maintainer's word, given once the core features are polished; no slice starts before it.

- TODO(builder, Later): slice 1, the pure core (a new src/core/autotrain), test first.
- TODO(builder, Later): slices 2 to 5 in order, after slice 1; the button takes its place in the band with the band's item model (ft_1_20).
- TODO(architect, Later): set `AUTOTRAIN_RULES` from the student's first runs, with the learning numbers of ft_1_32.
- NEEDS-HUMAN: try the autotrainer on one learned piece on the real keyboard: does the fix feel short enough, and does the walk come in when it should?
