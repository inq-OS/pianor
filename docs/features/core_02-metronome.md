---
id: "core_02"
title: "Metronome in practice"
scope: "A switchable click with count-in; asks whether the EZ-220's own metronome can be used"
effort: "trivial"
status: "built (practice screen click, hotkeys and click speed); EZ-220 own metronome question open, needs ft_0_01"
completeness: 75
---
# core_02: Metronome in practice

A click the student can switch on in practice, with a count-in that core_01 and core_03 reuse. Built, browser metronome only (d043). Index: [FEATURES.md](FEATURES.md).

## Rules

1. A **Click** button in the practice screen's tools strip switches the click. It is sounded by Web Audio on the audio clock, first beat of the bar accented. The setting is per scene, not per player (a difficulty modifier, core_07).
2. Wait mode: steady clicks at the piece's first tempo times the tempo percent (`metronomeFor`, `core/transport`). Tempo mode: on by default, clicks the count-in and the piece in step with the transport; switched on mid-piece it joins the beat grid (`Transport.nextClickMs`). Leaving the screen stops it.
3. Keys and click speed: Shift+M switches the click (plain M is a piano key). The button reads `Click [Shift+M]` only where the strip is about 360 to 390 art pixels wide or more; at 320 or 342 the Section button keeps its key and Click is bare. Shift+= and Shift+- change the click by 5 BPM, between 30 and 500. The BPM label shows it (`70 BPM (85)`) and Kiur's bubble. The speed is a BPM offset on the tempo percent (`clickBpm`, `src/core/transport/practiceSpeed.ts`), resets to 0 when the tempo percent changes, survives a restart. Wait mode only: in Tempo mode the keys say the click follows the music. Plain +/- stay free for the tempo percent buttons.
4. **EZ-220's own metronome:** whether it can be switched or read over USB-MIDI is not known; do not assume it. Questions are in section 10 of `docs/hardware-test-checklist.md` (MIDI, system-exclusive or start/stop messages; does the keyboard send a clock?); the answer goes in `docs/hardware-notes.md` (open entry). Yamaha's MIDI data format for the EZ-220 must be read first (not in this repository). Needs human. Until then the browser metronome is the only one, which also works with the on-screen and computer keyboards.
5. Tests: `tests/practice/click-speed.test.ts`; an end-to-end test that the button starts and stops the click and leaving stops it.

## Acceptance criteria

- **core_02.AC1** The metronome starts and stops from the practice screen, and leaving the screen stops it.
- **core_02.AC2** It keeps time against the audio clock: its clicks are scheduled from the transport and the piece's tempo times the tempo percent, with the click speed keys on top.
- **core_02.AC3** The question of the EZ-220's own metronome is answered (needs human) or marked open. [human]
