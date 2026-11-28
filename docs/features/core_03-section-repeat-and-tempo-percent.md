---
id: "core_03"
title: "Section repeat and tempo percent"
scope: "Loop from A to B; start tempo as percent of the original"
effort: "medium"
status: "built (section by two taps or Shift+R, loop without XP, tempo percent, tempo ramp); the percent is remembered per piece (core_04); the section and ramp are not"
completeness: 70
---
# core_03: Section repeat and tempo percent

Practising a hard part: loop part of a piece and start slowly, with an optional ramp that speeds up when the laps are clean. Decision: d043. Depends on core_01 for the tempo part; the repeat also works in Wait mode. Index: [FEATURES.md](FEATURES.md).

## Rules

1. **Marking a section.** The **Section** button (a picture "A | -> | B", lit while a section is set; a press then goes back to the whole piece), then the first bar, then the last bar. Shift+R, then the first bar, then the last bar, does it with the keyboard (bars counted from 1; an ambiguous number is taken on Enter or after a short pause; reversed bars are put in order; a bar outside the piece is refused with a message; Shift+R typing nothing, or Escape, cancels). Plain R is a piano key, so the key needs Shift. The first bar tapped gets a soft yellow background and **A**; the last gets **B** (`StaffView.setSectionMarks`; the tint `sectionFill` is a first guess).
2. **Section chart.** The section is a chart of its own made by pure `sliceChart` (`core/chart/section.ts`), so judges and Tempo mode need no change. A section with nothing to play is refused (`sectionHasNotes`): "No notes to play there! Tap another last bar.", the first bar stays marked.
3. **Staff size.** Marking keeps the player's own view and pages (`<` and `>`, arrow keys, Page Up and Down); the section is drawn at the whole piece's size by pure `layoutSection` (`core/layout/staffSettings.ts`, `keepBarWidth`). With bar numbers on (ft_0_16.AC7) the numbers are those of the whole piece, the section's first bar always with one.
4. **Looping, no XP.** A played-through section starts the next lap at once, its lap shown on the A mark (rule 7), with no line. A section gives no XP and no results screen; only the whole piece does: Back or Esc in a section goes straight back to where the piece was opened from, unless a whole pass was played before it. In Tempo mode the next lap's first bar begins exactly where the last ends (`Transport.endMs`, no count-in), the click keeps its beat grid (Wait mode's metronome is untouched), and the last note and next lap's first note split the gap between them for their windows (`TempoMode` option `loop`). A restart within the section does not carry the last wrap on.
5. **Tempo percent.** `-` and `+` change it in steps of ten from 30 to 150 (`TEMPO_PERCENT`, `src/core/transport/practiceSpeed.ts`); above 100 is faster. In Tempo mode it sets the line and count-in speed; in Wait mode the metronome. Changing it starts the scene over. A piece starts at the percent where the player last played it (core_04).
6. **Tempo ramp (AC5).** While a section is played a second strip under the tools shows one cycling button per value: step (`+0` off, then 1, 2, 3, 5, 10 BPM or 1, 2, 5, 10 %), its unit (switches BPM and %, keeping the value), `every N` laps (1 to 10), `Clean` (lit by default), target `to N` (100 to 200 % of the piece) with its unit. The mouse wheel over step, laps or target turns it by one (step 0 to 50, laps 1 to 99, target 30 to 200 %; `scrollRamp`). Pure rules in `src/core/transport/tempoRamp.ts` (`rampAfterLap`, `cleanLap`). After each lap the ramp may step the percent up, never past the target, and Kiur says "Lap N, faster: B BPM."; a ramp may go above the 150 % range, up to 200 %. A change applies from the next lap without restarting it. The strip shows only while a section is played. `AX-3 provisional:` the ramp is not saved (saving would bump the save format); in Wait mode Clean counts pitch only.
7. **Lap log.** The **A** mark carries tempo and lap as marks ("A ♩77▲ ↻2", ▲ when the ramp has just stepped up; d312). The marks stand over the beat lane's dots, never on them (on a line with no room above the dots they keep their place). Leaving a section, chips over the page's first line sum it up a while, a mark and a number each on a paper plate: "↻8" "✓5" "♩70→84" (`sectionLog`, `sectionLogChips`, `StaffView.setChips`, not saved). A start over from the settings shows ↻ at the first bar.
8. **Start from a bar.** While the piece plays (not while a section is being marked, in an A-B section, while the game plays the piece, or at the check-up) a tap on a bar starts the play over from that bar: a section from it to the piece's last bar, marked with **▶** instead of A and B (`practice.markFrom`), looping back to the mark with no XP like any section, and with the ramp strip. A tap on another bar moves the mark; a tap on the marked bar, the Section button or R take it away; with no mark a tap on the first bar starts the piece over (the space bar). Bars with nothing to play to the end are not taken. The arrow keys and the wheel turn the staff to other pages first (ft_0_16 rule 9). `AX-3 provisional:` the mark is not saved and lasts while the piece is open.
9. Buttons are pictures with tooltips of name and key: Click a metronome, Note names a note, Fingers a hand with numbers, Back a door; keys `Note names [A]`, `Fingers [F]`; A and F play no note on the practice screen. M and + / - are kept for the click; no hotkeys for the tempo percent.
10. Tests: `sliceChart` unit and property tests, `barAtPoint`, `tempoRamp.test.ts`, `tests/practice/hotkeys.test.ts`, and end-to-end tests in `tests/e2e/practice-tools.spec.ts` (strip, percent steps, section looping without XP, Escape, staff size ``, `layoutSection` ``, AC4, two AC5 tests).

## Acceptance criteria

- **core_03.AC1** A section of one or more bars loops, and is a valid chart with exactly the notes of its bars.
- **core_03.AC2** The tempo percent changes the speed of the cursor and the metronome, within its range.
- **core_03.AC3** A pure test covers section and percent handling.
- **core_03.AC5** While a section is played, a ramp strip sets a tempo step (BPM or %), the laps per step, Clean (only a lap with 100% pitch and, in Tempo mode, a timing score of 95 or more steps up, however many laps have passed) and a target (BPM or %, default the piece's own tempo, up to 200%) where the stepping stops and the looping goes on; each value is a cycling button and each unit a button that switches BPM and %.
- **core_03.AC6** A tap on a bar while the piece plays starts the play there under a start mark and loops from the mark to the end with no XP; a tap on the marked bar goes back to the whole piece (end-to-end).
- **core_03.AC4** A looped section wraps over to its first bar at once, without a pause: in Tempo mode on the beat with no new count-in, and the metronome click keeps ticking through the wrap.

## TODO

- TODO(builder, Later): remember the section per player and piece (core_04 stores the percent); the percent as a setting for the starting value.
- IDEA(builder, Later): the Analyze button with per-bar stats, the weakest sections and a proposed starting tempo; Kiur at the door when the student fools around.
- NEEDS-HUMAN: tune the section tint strength (`sectionFill`) on the real display.
