# Hardware test checklist (EZ-220)

For the person at the real keyboard (ft_0_01). It takes about 45 minutes. The spike page measures what it can see (MIDI); you answer what only you can see and hear (lights, sound). Then paste the page's summary into `docs/hardware-notes.md`. An agent can help tidy the notes but never writes a result nobody observed.

Done so far: sections 1 to 6 in Chrome (results in `docs/hardware-notes.md`; not tried there: C2 and C7, the pedal, power off and on with the page open, section 4 steps 2 and 3). Open: sections 7, 8, 10 and 11, and the go or no-go.

## Before you start

- The laptop with Chrome and Edge up to date, the EZ-220, its USB cable (USB-B to USB-A), and speakers or headphones on the computer.
- Start the page: `npm run spike` (it opens `http://localhost:5173/spike.html`). Use Chrome or Edge itself: the Claude desktop app's built-in browser pane refuses MIDI access. To see the page work without the keyboard first, add `?device=virtual` to the address.
- Keep the page's MIDI log open; "Download the log (JSON)" at any point keeps everything it saw.

## 1. Connect

1. Keyboard on, then plug in the USB cable. Reload the page and allow MIDI when the browser asks.
2. Under "MIDI ports": is there an input and an output? Write down their names and maker exactly as shown.
3. Unplug, switch the keyboard off, plug in, switch it on: does the port appear this way round too?

## 2. Keys in

1. Press single keys softly and hard; the lowest (C2) and the highest (C7); hold a key for a few seconds; a three-key chord; one key fast and repeatedly.
2. In the log: does every press and every release appear? What velocities (the summary line shows the range)? How do releases arrive (note-on with velocity 0 or note-off)? Any key that stays down in the log after you let go?
3. Leave it alone for 10 seconds with "Show active sensing and clock" ticked: what does the keyboard send by itself?
4. Sustain pedal (only if one is plugged into the keyboard; core_01 slice f): press and release it a few times. Does the log show "Sustain pedal = 127" and "= 0" (control change 64) for each? Write yes or no in `docs/hardware-notes.md`.

## 3. Unplug and plug back in

1. While the page is open, pull the USB cable: the port list and "plug events" should change. Plug it back in and press keys: do they show again without reloading?
2. Switch the keyboard off and on again with the page open. Note what happens.
3. If the keyboard switches itself off after a while (auto power-off), note after how long and what the page shows.

## 4. Key lights

1. Choose the output under "Send to". Channel 1, note 60 (C4), velocity 64, length 1000: "Send note". Does the C4 key light up? For how long? Does the keyboard also sound the note?
2. Try velocity 1 and 127. Try "Light C4 to C5".
3. Try channels 2, 3 and 4 (some keyboards light keys for a lesson part on another channel). Note which channel works, if any.
4. Silent key lights: channel 1, "Volume 0 (CC 7)", then "Send note". Write down whether the C4 key still lights and whether the keyboard sounds it. Then "Volume 100 (CC 7)" and send the note again to check the sound is back. (If the volume message does nothing, the keyboard may ignore CC 7 from the computer: write that down too.)
5. End with "All notes off".

## 5. Local Control

1. "Local Control off (CC 122)", then play keys: does the keyboard still sound its own keys? Do the keys still appear in the log?
2. If nothing changed, look for Local Control in the keyboard's function settings and try it there.
3. With Local Control off, tick "Echo every key back to the keyboard" and play: the keyboard should now sound the keys through the computer. Does it feel late?
4. Set Local Control back on (button or menu) and untick the echo.

## 6. Tap test

1. Use the computer's speakers or headphones, not the keyboard's sound.
2. "Start the tap test" and press any key exactly with each click. Run it three times.
3. Results within about 10 ms of each other are steady. Write all three down (the summary includes them).

## 7. The other browser

Repeat sections 1, 2 and 4 in Edge (or Chrome, whichever you did not use).

## 8. Recordings for the tests

1. "Clear" the log. Play Little Steps once cleanly: C D E F | G (long) F (long) | F E D C | C (very long). "Download the log (JSON)".
2. Clear again and play it once with a few mistakes (a wrong key, then the right one). Download again.
3. Give both files to the agent with a note of the mistakes you made: they become real replay fixtures in `tests/replays/` next to the synthetic ones.

## 9. Write it down

1. Answer the questions under "Results for docs/hardware-notes.md", then "Make the summary" and "Copy".
2. Paste it into `docs/hardware-notes.md` under "Facts", and move anything now confirmed out of "Assumptions".
3. State go or no-go for the browser stack (below).

## 10. The keyboard's own metronome (core_02, optional, after the sections above)

The browser has its own click (`docs/features/core_02-metronome.md`); this asks whether the keyboard's metronome could be used or followed instead. Nothing here is known yet, and the spike page cannot send most of it: it asks for MIDI access **without** system-exclusive permission and has no buttons for Start, Stop or system-exclusive messages, so the second and third questions need the spike page extended first (Yamaha's published MIDI data format is summarised in `docs/hardware/ez-220-reference.md`).

1. Switch the keyboard's own metronome on (its Metronome button) and tick "Show active sensing and clock" on the spike page. Does the keyboard send a MIDI clock (timing clock, 0xF8, 24 per quarter note) or Start and Stop messages (0xFA, 0xFC) while it clicks? Does the log show anything at all? Does the beat change when you change its tempo?
2. Can the keyboard's metronome be started or stopped from the computer? Try a MIDI Start (0xFA) and Stop (0xFC) to the output, and, once the page can ask for system-exclusive access, the messages from Yamaha's data format. Note what each did.
3. Can its tempo be set from the computer, or read from it?
4. Write down the answers under "Metronome of the keyboard" in `docs/hardware-notes.md`. If the answers are all no, the browser click stays the only one, which is also the only one that works with the on-screen and computer keyboards.

## 11. Sounds from the computer: drums and voices (needs human, optional)

Needs human: can the keyboard play sounds the game sends to it, so rhythm practice uses its drum kit and the game's sounds come out of the keyboard? The spike page has no buttons for this yet; until it does, any small MIDI tool that can send a note to the keyboard's output will do. Nothing here is known yet.

1. Send a note on MIDI channel 10 (where General MIDI keyboards usually put the drums), for example note 36 (bass drum) and 38 (snare). Does the keyboard play a drum sound? Does it light a key?
2. Send a note on channel 1 and on channel 2. Which voice plays? Does a program change (0xC0 to 0xCF) before it pick another voice?
3. Do sent notes still sound with Local Control off (section 5), and do they get mixed up with key lighting (section 4)?
4. Tap the same drum note from the computer in time with the metronome: does the delay feel like the tap test (section 6)?
5. Write down the answers under "Sounds from the computer" in `docs/hardware-notes.md`.

## Go or no-go (proposal: the maintainer decides)

- **Go** when Chrome or Edge on the laptop sees the keyboard, gets every key press and release with its velocity, recovers from unplugging (without a reload, or with one, noted), and the tap test is steady (spread under about 20 ms) with a median under about 100 ms. Wait mode does not need tight timing; Tempo mode later wants the delay measured and taken off.
- **Not needed for go:** key lights (a later hint, ft_Y_06) and Local Control.
- **No-go** when no browser gets the key presses, presses are lost, or keys stick. Next steps then: a Yamaha USB-MIDI driver, another cable or USB port, or a desktop wrapper such as Electron (`docs/architecture.md`, platform).
