---
id: "ft_0_01"
title: "Hardware spike (Human)"
scope: "Spike page for the EZ-220: MIDI in and out, key lights, latency, event log; go/no-go for the browser stack"
effort: "simple"
status: "page done; spike run, go/no-go open (Human)"
completeness: 80
---
# ft_0_01: Hardware spike (Human)

Index: [FEATURES.md](FEATURES.md).

A standalone page, no game code (lint-enforced), for the EZ-220: MIDI in and out, key lights, latency, event log, and a go/no-go for the browser stack.

## Rules

- `spike.html` (`npm run spike`, also in the production build) shows the computer (browser, secure context, Web MIDI, audio latencies), the MIDI ports and every plug event (hot-plug), and a log of every raw message with its MIDI timestamp, how late the page got it and what it means. A summary counts presses, releases (note-on velocity 0 or note-off), velocities and active sensing.
- It sends notes on any channel with any velocity to test key lights (one note, held note, scale, all notes off), Local Control off and on (CC 122), and can echo keys back. The tap test plays Web Audio clicks and measures how long after each heard click the key press arrives.
- "Download the log" keeps everything plus a replay draft (marked synthetic for the simulated keyboard); "Make the summary" writes what the page saw and the person answered for `docs/hardware-notes.md`.
- `?device=virtual` runs it against the virtual EZ-220 of ft_0_06 with a small panel to drive it. Virtual runs prove the page works, never how the real keyboard behaves. Tests: 23 unit tests (`src/spike/`), 8 end-to-end (`tests/e2e/spike.spec.ts`).
- Steps for the person and a proposed go/no-go: `docs/hardware-test-checklist.md`. Decision: d033.
- Real results (a person on the real keyboard): the EZ-220 is a class-compliant device with no Yamaha driver and the game is playable on Windows; on the target laptop in Chrome: ports, presses and releases on channel 1, key lights on channel 1 (the lit note also sounds), Local Control, hot-plug and four tap tests (median 77 to 129 ms) are in `docs/hardware-notes.md`, which meets AC1.
- Needs human: Edge, recordings for replay fixtures, the keyboard's metronome (section 10), sounds from the computer (section 11) and the go/no-go (AC2).

## Acceptance criteria

- **ft_0_01.AC1** Results are written to `docs/hardware-notes.md` as facts vs assumptions: key lighting yes/no and how, working browsers and OS, latency numbers, driver notes (needs human: the person runs it on the real keyboard; the agent must not claim results it did not observe). [human]
- **ft_0_01.AC2** The go/no-go for the browser stack is stated explicitly (needs human). [human]
- **ft_0_01.AC3** The spike page logs and summarises raw MIDI, measures tap latency and writes the summary for `docs/hardware-notes.md`, and runs against the simulated EZ-220.
