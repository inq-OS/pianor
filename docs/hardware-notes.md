# Hardware notes (EZ-220)

Filled in by the ft_0_01 spike, run by a human on the real keyboard: `npm run spike`, the steps in `docs/hardware-test-checklist.md`, then paste the page's summary below. Agents do not write results here that they did not observe. Everything below is an **assumption** until marked **verified** with date, OS, browser and keyboard setup.

What Yamaha's manuals say about the keyboard (MIDI messages, key lights, Local Control, voices, drum map) is in `docs/hardware/ez-220-reference.md`, marked per manual and unverified until it is confirmed here.

## Facts (verified on hardware)

### Hardware spike (sections 1 to 6)

Run on the reference laptop (Windows), in Chrome, Yamaha EZ-220 on USB. The page summary of the run:

- Browser: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/<version> Safari/537.36`

Seen by the page:

- Input: Digital Keyboard (Yamaha Corp.), connected
- Output: Digital Keyboard (Yamaha Corp.), connected
- Key presses: 158, releases: 158, on channel 1
- Key releases arrive as note-on with velocity 0 (158 of 158)
- Velocity: 20 to 72
- Keys played: MIDI 52 to 81
- Active sensing: 2964 messages, about every 200 ms
- Other messages: 4 (clock: 26548)
- Browser delivery delay (page received minus MIDI timestamp), median: 28 ms

Answered by the person at the keyboard:

- Keys light up when the computer sends notes: yes (ch 1)
- The keyboard also sounds the notes the computer sends: yes
- Local Control: local control off = no keyboard sound but key is sent, echo back sounds key
- Unplug and plug back in works without reloading: yes

Tap test (spike section 6; "after the click" is the key's MIDI timestamp minus the click's scheduled output time on the browser's clock):

| Run | Median | Spread | Clicks matched | Range |
|---|---|---|---|---|
| 1 | 76.6 ms | 14.9 ms | 12 | 43.6 to 117.6 ms |
| 2 | 128.9 ms | 15.4 ms | 14 | 84.9 to 181.9 ms |
| 3 | 89.7 ms | 7.9 ms | 14 | 58.2 to 110.2 ms |
| 4 | 83.8 ms | 12.0 ms | 14 | 67.7 to 128.7 ms |

What this settles (read from the numbers above):

- **One port each way**, both named "Digital Keyboard", maker "Yamaha Corp." in Chrome (Windows lists two port entries, "[0]" and "[1]"; Chrome showed one input and one output).
- **Key presses go out on MIDI channel 1**, and **no press or release was lost**: 158 presses and 158 releases. **No stuck keys.**
- **Releases are note-on with velocity 0**, never note-off (0x80), as the manual says. The parser already treats that as a release (ft_0_06.AC2).
- **Velocity seen: 20 to 72.** Whether the keys were pressed as hard as possible is not recorded; the full range (and the keyboard's Touch setting) is untested. Anything that ever uses velocity should be relative to this range, not to 1 to 127.
- **Active sensing about every 200 ms**, and **a MIDI timing clock (0xF8) all the time**: 26548 clocks during the session (about 9 minutes of clock at 120 BPM, against about 10 minutes of active sensing: a clock running for most of the run); what the 4 other messages were is not in the summary. Whether the keyboard's metronome or a style was on is not recorded, so "the clock is always sent" is not yet known (section 10). The parser drops both (`src/io/midi/parse.ts`, tested), so the game ignores them.
- **Key lights work from the computer on channel 1**, and **the lit note also sounds** on the keyboard. Channels 2 to 4, velocity and length (section 4 steps 2 and 3) are not recorded.
- **Local Control (CC 122) works as the manual says:** off, the keyboard is silent but still sends the key; echoing the key back sounds it. Whether the echo felt late is not recorded.
- **Hot-plug works without a reload.**
- **Browser delivery delay, median 28 ms:** a message reaches the page about 28 ms after its own MIDI timestamp. The game judges on the timestamp (`MIDIMessageEvent.timeStamp`, mapped to the audio clock in `src/io/midi/WebMidiKeyboard.ts`), so this delay does not count against the student; code that used the arrival time instead would add it.
- **Tap test: steady inside a run (spread 8 to 15 ms), not between runs (median 77 to 129 ms).** The number is everything between "the browser schedules the click" and "the key's timestamp": the computer's audio output delay (Chrome reported about 40 ms in an earlier browser-pane check, d016, not on this laptop), the person's anticipation and reaction, and the USB-MIDI path. It cannot be split into those parts from this test.

Not done in this run: the lowest and highest keys (C2, C7), the sustain pedal (section 2 step 4), switching the keyboard off and on with the page open (section 3 steps 2 and 3), section 4 steps 2 and 3, the other browser (section 7, Edge), the recordings for replay fixtures (section 8), the keyboard's metronome (section 10), sounds from the computer (section 11, needs human).

### First check

Windows, EZ-220 on USB straight into the reference laptop. Only a first check: the game was played, nothing was measured and the spike page sections were not worked through yet.

- **Windows sees the keyboard as a class-compliant USB-MIDI device, no Yamaha driver installed.** Device Manager lists it as "Digital Keyboard" (USB vendor id `0499`, Yamaha), status OK, with two MIDI port entries, "Digital Keyboard [0]" and "Digital Keyboard [1]" (read from Windows by the agent while the keyboard was plugged in).
- **The game is playable on the real keyboard** in Chrome or Edge at `npm run dev`: key presses reach the game and pieces can be played.
- **The Claude desktop app's built-in browser pane cannot use the keyboard:** the spike page there shows Web MIDI as present but access refused ("Permission to use Web MIDI API was not granted"), without a prompt. Open the pages in Chrome or Edge itself. Agents testing through that pane only ever reach the virtual EZ-220.

## The reference screen

A **1920x1080** screen at **125%** display scaling, the common laptop setting on Windows. Chrome then reports 1536x864 CSS pixels with `devicePixelRatio` 1.25; the game draws its canvas in physical pixels (1920x1080), so the pixel art is 5 screen pixels per art pixel and the staff is drawn at full resolution. How sharp it looks to the student on the real screen: **needs human**.

## Assumptions (unverified)

- The keys at the ends of the range (MIDI 36 and 96) arrive like the others (only MIDI 52 to 81 were played).
- The sustain pedal (CC 64) arrives over USB (manual: yes; not tried).
- Edge behaves like Chrome (not tried).
- **Channel 2 sounds without lighting keys**: remembered from the run, not written down at the time. The game's own notes go out on channel 2 when the admin Pages screen's piano switch is on "EZ-220" (ft_0_07.AC4), so confirm it: with that setting, play a piece preview and check that the keys stay dark and the notes sound, and whether they come late. Needs human.
- Notes the game sends at a channel volume of 0 (CC 7, which the manual lists as accepted) would light keys without sounding. Untried; it matters for key-light hints (ft_Y_06), see below.

## What the results mean for the design

- **Key-light hints sound the note (ft_Y_06).** A lit key also plays its note on the keyboard, so a hint would tell the student the answer by ear as well as by light (AX-0: the student should read the staff). Before ft_Y_06 is built, try silencing channel 1 (CC 7 = 0, or a silent voice) and check the light still comes on; needs human.
- **Tempo mode needs latency calibration, and it may need it per session, not once per device (core_01 slice d).** The offset (77 to 129 ms) is larger than the provisional perfect window (60 ms either side, d038), so an uncalibrated Tempo mode would grade presses that sound on time as late. The four runs differ by up to 52 ms, more than the 10 ms the checklist calls steady, while each run is steady in itself; so a short tap-along before a Tempo session (or a re-check) fits the numbers better than one stored value. Window sizes stay provisional until slice d. Wait mode is not affected.
- **Durations need no calibration** (core_01 slice f): press and release take the same path, confirmed by the matching press and release counts.

## Metronome of the keyboard (core_02): **open, unverified**

Whether the EZ-220's own metronome can be switched, set or read over USB-MIDI is **not known**. Do not assume it. The questions (does a note, a system-exclusive message or the Start and Stop messages start it; does the keyboard send a MIDI clock) are in section 10 of `docs/hardware-test-checklist.md` and need a person with the keyboard. The run saw a MIDI clock all session long (26548 clocks), with the state of the keyboard's metronome not recorded, so the first question is half answered: the keyboard does send a clock over USB, but whether it follows its own metronome is still open. Yamaha's published MIDI data format is summarised in `docs/hardware/ez-220-reference.md` (per manual, unverified): the keyboard's metronome can only follow an external clock after External Clock is switched on at the keyboard, and no message to start it is documented. Until this is answered the browser click (Web Audio, on the audio clock) is the only metronome the game uses.

## Latency numbers

Measured on the reference laptop in Chrome (tap test, four runs, table above): **median 77 to 129 ms, spread 8 to 15 ms per run**; browser delivery delay after the MIDI timestamp, median 28 ms (not part of the judged time). Not yet measured: Edge, the tablet, the delay of sounds sent to the keyboard (section 11), whether the echo with Local Control off feels late.

## Go / no-go for the browser stack

**Proposed: go for Wait mode; the maintainer decides.** Against the proposal in `docs/hardware-test-checklist.md`: Chrome on the reference laptop sees the keyboard (met), every press and release arrives with velocity (met, 158 of 158), it recovers from unplugging without a reload (met), the tap test is steady inside each run (met, spread under 20 ms), and the median is under about 100 ms in three of four runs (one run 129 ms). Edge is not tried. Tempo mode needs calibration (above) before its timing counts.

