---
id: "ft_0_06"
title: "MIDI io and mock keyboard"
scope: "Web MIDI wrapper, virtual EZ-220, on-screen and computer keyboards, virtual and replay players"
effort: "done"
status: "done; key lights wait for ft_0_01"
completeness: 100
---
# ft_0_06: MIDI io and mock keyboard

Index: [FEATURES.md](FEATURES.md). Real key lighting waits for ft_0_01.

Everything needed to develop and test without the EZ-220 (`docs/testing.md` section 7).

## Rules

- `src/io/midi`: raw Web MIDI input and output behind an interface (`KeyboardInput`, `KeyLightOutput`), device selection, hot-plug.
- `src/io/mock`:
  - **Virtual EZ-220:** a fake `MIDIAccess` (input and output ports, hot-plug, raw MIDI with realistic traits: note-on velocity 0 as note-off, channel 1, 61 keys MIDI 36 to 96, optional active-sensing noise). The real wrapper runs unchanged against it. Installed in dev with `?device=virtual` and in tests.
  - **On-screen keyboard** (61 keys, mouse and touch, shows lit keys from key-light output) and **QWERTY mapping** with octave shift reaching all 61 keys.
  - **Virtual player:** plays a chart through the virtual device with configurable tempo, jitter, latency, velocity and scripted mistakes (wrong octave, neighbour key, wrong letter, skipped note, chord press order). Used by e2e tests, demos and the preview tool.
  - **Replay player:** feeds a recorded or synthetic event log (`tests/replays/`) through the same interface.
  - Optional simulated latency and jitter, off by default.
- One shared contract test suite: the real wrapper against the virtual device, mock and replay pass the same behaviour tests.

## Acceptance criteria

- **ft_0_06.AC1** The game can be fully driven by the mock, the virtual device and the virtual player with no hardware attached.
- **ft_0_06.AC2** Message parsing is unit-tested (note on with velocity 0 is note off).
- **ft_0_06.AC3** Hot-plug mid-piece is handled, in a test.
- **ft_0_06.AC4** Key-light output is implemented as far as ft_0_01 verified it (until then only to the on-screen keyboard, labelled an assumption).
- **ft_0_06.AC5** Any class-compliant USB-MIDI keyboard plays the game with no change above `src/io/keyboard.ts`: input is the same `NoteEvent` for every keyboard, every key it has arrives (the 88 of a YDP-166 as well as the 61 of the EZ-220), and pieces keep to the keys every supported keyboard has (C2 to C7, `PIECE_LOW` to `PIECE_HIGH`). What differs per keyboard stays in `src/io/midi/keyboardProfiles.ts`, told by its port name: the channel the game's own notes go out on (channel 2 on a keyboard that may light keys, AX-0) and the voice picked, if any. Known: the EZ-220 and the YDP-166 (88 keys, no lights: channel 1, the panel's voice); any other keyboard is played as unknown (channel 2, no voice sent). The YDP-166's port name and its sound on channel 1 are assumptions until a person runs the spike on one [human].
