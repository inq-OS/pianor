---
id: "ft_0_07"
title: "Audio"
scope: "Salamander sampled piano, metronome, one audio clock"
effort: "done"
status: "done; sound check open (Human)"
completeness: 100
---
# ft_0_07: Audio

Sampled piano playback and metronome via Web Audio, using one audio clock for the whole game (d016). Sample source: Salamander Grand Piano (CC BY 3.0), recorded in `docs/assets.md`. The human sound check is in `docs/testing.md` section 8. Index: [FEATURES.md](FEATURES.md).

## Acceptance criteria

- **ft_0_07.AC1** Notes play with low latency on key press on the real device. [human]
- **ft_0_07.AC2** The metronome stays in sync with the song clock, in a test.
- **ft_0_07.AC3** The admin Pages screen switches the piano between the full recordings and the light ones (each sample cut to 5 seconds with a 1-second fade, mono: about a fifth of the memory once unpacked) while the game runs, without fetching the files again; the choice is kept in the device's admin settings and the full piano is the default. Built: `src/io/audio/lightSample.ts`, `SamplerPiano.setSound`, `pianoSound` in `src/core/admin/adminSettings.ts`, the button in `AdminPagesScene.ts`; tests beside each and in `tests/e2e/player-screens.spec.ts`. Not verified: how the light piano sounds on the laptop [human].
- **ft_0_07.AC4** A third place on the same switch, "Piano: keyboard", plays the game's own notes (piece preview, ear trainer, the count-in's grace note, on-screen keys) on the attached keyboard as MIDI notes on the channel of its profile (channel 2 on the EZ-220, ft_0_06.AC5), so no piano samples are fetched or held while it is attached; with no keyboard, or when it is unplugged, the full samples load and play. Notes placed ahead on the song clock keep their time as Web MIDI timestamps; on the EZ-220 the voice is Grand Piano 1 by bank select and program change; a keyboard whose bank numbers are not known keeps its panel's voice. Built: `src/io/midi/KeyboardPiano.ts`, `src/io/audio/RoutedPiano.ts`, `WebMidiKeyboard.output()`, `deferLoad` on `SamplerPiano`, wired in `src/compose.ts`; tests beside each and in `tests/e2e/player-screens.spec.ts` (virtual EZ-220). Not verified [human]: that channel 2 sounds without lighting keys (remembered from a run, not recorded), that the program change picks the grand piano, and how late a note sent to the keyboard sounds (`docs/hardware-notes.md`).

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- NEEDS-HUMAN: does the EZ-220 play notes it receives over MIDI on other channels (drums on channel 10), does a program change pick a voice, how does it mix with Local Control and key lights, and with what latency: `docs/hardware-test-checklist.md` section 11.
- TODO(builder, R3): a `SoundOutput` interface in `src/io/` with Web Audio (default) and EZ-220-over-MIDI implementations, for rhythm practice's drum clicks and gameplay sounds; the Web Audio path keeps working and tested with the virtual EZ-220. After the result above.
