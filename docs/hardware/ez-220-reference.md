---
title: "Yamaha EZ-220 reference: MIDI, key lights, voices and drum kits"
---
# Yamaha EZ-220 reference

The facts about the keyboard that the game depends on, in one place, so features stop working from memory. Summarised in our own words from Yamaha's two public documents (read; the PDFs are not committed, because they are Yamaha's copyright):

- **OM**: EZ-220 Owner's Manual, English: <https://usa.yamaha.com/files/download/other_assets/5/326995/ez220_en_om_a0.pdf>
- **MR**: EZ-220 MIDI Reference, English, version 1.0: <https://usa.yamaha.com/files/download/other_assets/4/326994/ez220_en_mr_a0.pdf>

Page numbers below are the printed page numbers of those files (OM p. 41, MR p. 2).

**Status of every fact here: per manual, unverified on hardware**, unless a row says **verified** and points to `docs/hardware-notes.md`. Only the hardware spike (ft_0_01, `docs/hardware-test-checklist.md`) and the tests by hand for the sounds from the computer turn a fact into a verified one; when that happens, record it in `docs/hardware-notes.md` and change the status here. Where the manual is silent, this file says "not documented" instead of guessing (CLAUDE.md: do not invent hardware behaviour).

How it was read: the agent's container could not download from yamaha.com, so the PDFs were read through a web reader, and the drum key map (OM p. 49 to 51) through a text copy of the manual whose table columns were scrambled. Rows marked "(?)" in the drum map are the ones that could not be aligned with confidence; a person should check them against OM p. 49 before code relies on them.

## Note names: Yamaha counts octaves one lower

Yamaha's manuals call MIDI note 60 **C3**; this project calls it **C4** (CLAUDE.md, Music conventions). Proof in OM p. 15 and 39: the split point range 0 to 127 is printed as "C-2 to G8", and its default 54 is printed as F#2. Add one to every octave number you read in the manual. MIDI numbers are the same in both.

## Keyboard and sound engine

| Fact | Value | Source | Status |
|---|---|---|---|
| Keys | 61, touch sensitive | OM p. 54 | per manual |
| Range sent with Keyboard Octave 0 | MIDI 36 to 96 (C2 to C7 our names, C1 to C6 Yamaha's) | the game's virtual EZ-220 and the 61-key count | assumption (not printed in the manual) |
| Keyboard Octave function | -2 to +2 octaves | OM p. 15 | per manual; whether it shifts the notes sent over USB is not documented |
| Transpose | -12 to +12 semitones | OM p. 15, 30 | per manual; effect on notes sent over USB not documented |
| Touch sensitivity | 4 settings, default 2 | OM p. 31 | per manual |
| Polyphony | 32 notes at most, shared with style and song playback | OM p. 45, 54 | per manual |
| Sound set | 392 voices: 1 stereo grand piano, 361 XGlite voices, 17 XGlite option voices, 12 drum kits, 1 sound effect kit; GM and XGlite compatible | OM p. 54 | per manual |
| Tone generator | 16-channel multi-timbral; incoming MIDI does not change the panel voice or panel settings, except master tuning and the reverb and chorus type messages | MR p. 3, note 1 | per manual |
| Metronome tempo | 11 to 280 | OM p. 54 | per manual |
| Connectors | USB TO HOST (type B), PHONES/OUTPUT, SUSTAIN pedal, DC IN 12 V | OM p. 8, 54 | per manual |

## USB-MIDI

| Fact | Value | Source | Status |
|---|---|---|---|
| Driver | class-compliant; Yamaha's own USB-MIDI driver is only suggested if the connection is unstable | OM p. 40 | **verified** on Windows without a Yamaha driver (`docs/hardware-notes.md`) |
| Ports | two MIDI ports, "Digital Keyboard [0]" and "[1]"; which one carries what is not documented | not in the manual | **verified** that both exist in Windows (`docs/hardware-notes.md`); Chrome shows one input and one output, both "Digital Keyboard" by "Yamaha Corp." |
| Cable | USB A to B, under 3 m | OM p. 40 | per manual |
| Order | connect the computer before powering the keyboard on; wait at least 6 s between power or USB on/off cycles | OM p. 40 | per manual; unplugging and plugging back in with the page open works without a reload, **verified** (`docs/hardware-notes.md`) |
| Power saving | leave the computer's sleep or suspend modes before connecting | OM p. 40 | per manual |

## Messages the keyboard sends and accepts

From the MIDI implementation chart (MR p. 2). "Sends" means the keyboard transmits it; "Accepts" means it acts on it.

| Message | Sends | Accepts | Notes |
|---|---|---|---|
| Channel | 1 to 16 | 1 to 16 | Mode 3 (omni off, poly), not changeable. The manual does not say which channel your own key presses go out on: they go out on **channel 1**, **verified** (`docs/hardware-notes.md`) |
| Note on | yes, velocity 1 to 127 | yes, velocity 1 to 127 | seen 20 to 72 (hardest press not recorded) |
| Note off (0x8n) | **no** | no | the keyboard ends a note with a note on of velocity 0 (0x9n, v = 0). The judge must treat that as a release. **verified** (`docs/hardware-notes.md`): 158 of 158 releases |
| Note numbers | 0 to 127 | 0 to 127 | |
| Aftertouch (key or channel) | no | no | |
| Pitch bend | no | yes | |
| Program change | yes, 0 to 127 | yes, 0 to 127 | when the keyboard sends one (presumably on a voice change) is not documented; see "Choosing a voice" |
| System exclusive | yes | yes | see "System exclusive" |
| Song position, song select, tune request | no | no | |
| Timing clock (0xF8) | yes | yes | sent over USB, 26548 clocks in one session, **verified** (`docs/hardware-notes.md`); see "Clock, start and stop" |
| Start, stop (0xFA, 0xFC) | yes | yes | |
| Active sensing (0xFE) | yes | yes | about every 200 ms, **verified** (`docs/hardware-notes.md`); the game must ignore it, not treat it as a key |
| All sound off (CC 120, also 126 and 127) | no | yes | |
| Reset all controllers (CC 121) | no | yes | |
| Local Control (CC 122) | no | yes | see "Local Control" |
| All notes off (CC 123, also 124 and 125) | no | yes | |
| System reset (0xFF) | no | no | |

### Control changes

| CC | Function | Sends | Accepts |
|---|---|---|---|
| 0 and 32 | bank select MSB, LSB | yes | yes |
| 1 | modulation | only during style or song playback or the harmony effect (MR note 2) | yes |
| 6 and 38 | data entry MSB, LSB | as CC 1 | yes |
| 7 | volume | yes | yes |
| 10 | pan | yes | yes |
| 11 | expression | as CC 1 | yes |
| 64 | sustain pedal | yes | yes |
| 71, 73, 74 | harmonic content, attack time, brightness | as CC 1 | yes |
| 72 | release time | yes | yes |
| 84 | portamento control | as CC 1 | yes |
| 91 and 93 | reverb depth, chorus depth | yes | yes |
| 96 and 97 | data increment, decrement | no | yes |
| 100 and 101 | RPN LSB, MSB | no | yes |

## Key lights

| Fact | Value | Source | Status |
|---|---|---|---|
| Hardware | every one of the 61 keys has its own light | OM p. 23 | per manual |
| Lighting from the computer | a note received on **MIDI channel 1** lights the matching key; meant for practising along with song data whose melody is on channel 1 | OM p. 41 | **verified** (`docs/hardware-notes.md`) in Chrome 157 |
| Other channels | not documented; the manual names channel 1 only | | open; spike section 4 step 3 tries channels 2 to 4 |
| Does a lit note also sound | not documented; a note on channel 1 goes to the tone generator like any received note, so it sounds unless the game sends it at a volume of 0 or on a silent voice | OM p. 41, MR note 1 | **yes, it sounds**, **verified** (`docs/hardware-notes.md`); silencing it (CC 7 = 0) is untried |
| Light Guide switch | the [LIGHT ON/OFF] button turns the lights on and off; on by default | OM p. 9, 23 | per manual; whether it also blocks lights from the computer is not documented |
| Velocity, duration | not documented (the light presumably follows note on and its matching velocity-0 note on) | | open; spike section 4 step 2 |
| Rest advice | Yamaha advises a ten-minute break after an hour of play with the lights on | OM p. 23 | per manual (product note, not a MIDI fact) |

The keyboard's own lesson modes (Listen and Learn, Timing, Waiting; OM p. 24 and 25) work only on its built-in songs and are not controllable over MIDI per the documents. In its own lessons the left-hand part uses a fixed split at MIDI 59 (B3 our names) and the left-hand chord part one at MIDI 54 (OM p. 25). Nothing in pianor uses them.

## Local Control

| Fact | Value | Source | Status |
|---|---|---|---|
| Messages | on: `Bn 7A 7F`; off: `Bn 7A 00` (CC 122); the channel n is ignored | MR p. 3, note 5 | **verified** (`docs/hardware-notes.md`) |
| Default | on | OM p. 41 | per manual |
| On | your keys and notes from the computer both sound the keyboard's voices | OM p. 41 | per manual |
| Off | your keys do not sound but are still sent to the computer; notes from the computer still sound | OM p. 41 | **verified** (`docs/hardware-notes.md`): no keyboard sound, keys still sent, the echo from the computer sounds |
| Panel | also settable in the keyboard's Function menu, item "Local" | OM p. 15, 41 | per manual |

So with Local Control off the game can decide what the keyboard plays (for example echo the key back, or play a drum on a hit), which is what the sounds from the computer and rhythm practice need.

## Clock, start and stop

| Fact | Value | Source | Status |
|---|---|---|---|
| Accompaniment start, stop | starting a style sends `FA`, stopping sends `FC` | MR p. 3, note 4 | per manual |
| Timing clock | listed as sent and accepted | MR p. 2 | sent over USB for most of a 10-minute session, **verified** (`docs/hardware-notes.md`); whether it is always sent or only while a style, song or the metronome runs is not documented and was not recorded |
| External Clock function | off by default. On: songs, styles **and the metronome** follow the clock from the computer and do not run without it. `FA` and `FC` from the computer are acted on only with External Clock on | OM p. 41, MR note 4 | per manual |
| Keyboard metronome over MIDI | no message to switch it on or set its time signature is documented; it can only be slaved to an external clock as above | OM p. 32, 33, 41 | per manual; spike section 10 |
| Initial Send | a Function menu action that sends the current panel settings to the computer | OM p. 41 | per manual |

This partly answers section 10 of `docs/hardware-test-checklist.md`: the keyboard's metronome could in principle follow a clock the game sends, but only after a person switches External Clock on at the keyboard. Until the spike confirms it, the browser click stays the game's metronome (core_02).

## System exclusive

All from MR p. 3, note 3; per manual. The browser must ask for MIDI access with system-exclusive permission to send them, which the game does not do today.

| Message | Bytes (hex) | What it does |
|---|---|---|
| GM System On | `F0 7E 7F 09 01 F7` | resets everything to the defaults, except master tuning |
| Master volume | `F0 7F 7F 04 01 ll mm F7` | volume of all channels; only `mm` is used, `ll` is ignored |
| Master tuning | `F0 43 1n 27 30 00 00 mm ll cc F7` | tuning of all channels; default `mm` = 08, `ll` = 00; `n` and `cc` may be anything. Also changes the panel voice |
| Reverb type | `F0 43 1n 4C 02 01 00 mm ll F7` | `mm`, `ll` = type MSB, LSB (MR effect map). Also changes the panel voice |
| Chorus type | `F0 43 1n 4C 02 01 20 mm ll F7` | as above for chorus |

Reverb type MSB: 1 Hall, 2 Room, 3 Stage, 4 Plate, anything else no effect. Chorus type MSB: 64 Thru, 65 and 66 Chorus, 67 Flanger, anything else no effect. The LSB picks the variant (Hall 1 to 3 and so on); an LSB with no variant falls back to the nearest one (MR p. 3).

## Choosing a voice

A voice is chosen with bank select and program change on a channel: `Bn 00 MSB`, `Bn 20 LSB`, `Cn PC-1`. The voice list numbers programs **1 to 128**, so the byte sent is one less (OM p. 45). Per manual; spike section 11 step 2 checks it.

Voice list categories (OM p. 45 to 48):

| Voice no. | Category |
|---|---|
| 001 to 005 | piano |
| 006 to 009 | electric piano |
| 010 to 014 | organ |
| 015 to 017 | accordion |
| 018 to 030 | strings |
| 031 to 038 | guitar |
| 039 to 046 | bass |
| 047 to 049 | choir |
| 050 to 054 | trumpet |
| 055 to 060 | brass |
| 061 to 068 | saxophone |
| 069 to 076 | flute |
| 077 to 087 | synth lead |
| 088 to 099 | synth pad |
| 100 to 115 | percussion |
| 116 to 124 | world |
| 125 to 132 | synth effects |
| 133 to 140 | sound effects |
| 141 to 153 | drum kits |
| 154 to 392 | XGlite voices (GM-style set; 352 to 392 are sound effects on bank MSB 64) |

Voices pianor is likely to use:

| Voice no. | Name | MSB | LSB | Program (1 to 128) |
|---|---|---|---|---|
| 001 | Grand Piano 1 (the panel default) | 0 | 112 | 1 |
| 002 | Bright Piano | 0 | 0 | 2 |

### Drum kits (voices 141 to 153)

| Voice no. | Kit | MSB | LSB | Program (1 to 128) |
|---|---|---|---|---|
| 141 | Standard Kit 1 | 127 | 0 | 1 |
| 142 | Standard Kit 2 | 127 | 0 | 2 |
| 143 | Room Kit | 127 | 0 | 9 |
| 144 | Rock Kit | 127 | 0 | 17 |
| 145 | Electronic Kit | 127 | 0 | 25 |
| 146 | Analog Kit | 127 | 0 | 26 |
| 147 | Dance Kit | 127 | 0 | 28 |
| 148 | Jazz Kit | 127 | 0 | 33 |
| 149 | Brush Kit | 127 | 0 | 41 |
| 150 | Symphony Kit | 127 | 0 | 49 |
| 151 | SFX Kit 1 | 126 | 0 | 1 |
| 152 | SFX Kit 2 | 126 | 0 | 2 |
| 153 | Sound Effect Kit | 126 | 0 | 113 |

**Channel 10.** Neither document says in words that channel 10 holds a drum kit, but the keyboard is GM compatible, and General MIDI puts drums on channel 10 after GM System On. Treat "drums on channel 10" as an assumption until spike section 11 step 1; a safer path is to select a kit on a free channel with the bank and program above.

### Drum key map, Standard Kit 1

Per OM p. 49. Use the **MIDI note** column when the game sends notes. The manual's own footnote says its "keyboard" note numbers are one octave above the MIDI ones, so when a person picks a drum kit on the panel, the key that sends note 48 plays the sound listed under MIDI 36 here; what the keyboard **sends** for that key is not documented (spike section 11).

From MIDI 35 up the layout is the General MIDI one. The other kits change some sounds (rock, room and electronic toms and snares, brush sounds) and keep the rest; their per-note differences are on OM p. 49 to 51 and are not copied here. Two more columns in the manual are not transcribed because they could not be aligned: which keys stop sounding on release (key off) and which sounds cut each other off (alternate groups, for example the open and closed hi-hats in General MIDI).

| MIDI note | Name (our octaves) | Sound |
|---|---|---|
| 13 | C#0 | Surdo Mute |
| 14 | D0 | Surdo Open |
| 15 | D#0 | Hi Q |
| 16 | E0 | Whip Slap |
| 17 | F0 | Scratch Push |
| 18 | F#0 | Scratch Pull |
| 19 | G0 | Finger Snap |
| 20 | G#0 | Click Noise |
| 21 | A0 | Metronome Click |
| 22 | A#0 | Metronome Bell |
| 23 | B0 | Seq Click L |
| 24 | C1 | Seq Click H |
| 25 | C#1 | Brush Tap |
| 26 | D1 | Brush Swirl |
| 27 | D#1 | Brush Slap |
| 28 | E1 | Brush Tap Swirl (?) |
| 29 | F1 | Snare Roll |
| 30 | F#1 | Castanet |
| 31 | G1 | Snare H Soft (?) |
| 32 | G#1 | Sticks |
| 33 | A1 | Bass Drum Soft |
| 34 | A#1 | Open Rim Shot |
| 35 | B1 | Bass Drum Hard |
| 36 | C2 | Bass Drum (?) |
| 37 | C#2 | Side Stick |
| 38 | D2 | Snare M |
| 39 | D#2 | Hand Clap |
| 40 | E2 | Snare H (?) |
| 41 | F2 | Floor Tom L |
| 42 | F#2 | Hi-Hat Closed |
| 43 | G2 | Floor Tom H |
| 44 | G#2 | Hi-Hat Pedal |
| 45 | A2 | Low Tom |
| 46 | A#2 | Hi-Hat Open |
| 47 | B2 | Mid Tom L |
| 48 | C3 | Mid Tom H |
| 49 | C#3 | Crash Cymbal 1 |
| 50 | D3 | High Tom |
| 51 | D#3 | Ride Cymbal 1 |
| 52 | E3 | Chinese Cymbal |
| 53 | F3 | Ride Cymbal Cup |
| 54 | F#3 | Tambourine |
| 55 | G3 | Splash Cymbal |
| 56 | G#3 | Cowbell |
| 57 | A3 | Crash Cymbal 2 |
| 58 | A#3 | Vibraslap |
| 59 | B3 | Ride Cymbal 2 |
| 60 | C4 | Bongo H |
| 61 | C#4 | Bongo L |
| 62 | D4 | Conga H Mute |
| 63 | D#4 | Conga H Open |
| 64 | E4 | Conga L |
| 65 | F4 | Timbale H |
| 66 | F#4 | Timbale L |
| 67 | G4 | Agogo H |
| 68 | G#4 | Agogo L |
| 69 | A4 | Cabasa |
| 70 | A#4 | Maracas |
| 71 | B4 | Samba Whistle H |
| 72 | C5 | Samba Whistle L |
| 73 | C#5 | Guiro Short |
| 74 | D5 | Guiro Long |
| 75 | D#5 | Claves |
| 76 | E5 | Wood Block H |
| 77 | F5 | Wood Block L |
| 78 | F#5 | Cuica Mute |
| 79 | G5 | Cuica Open |
| 80 | G#5 | Triangle Mute |
| 81 | A5 | Triangle Open |
| 82 | A#5 | Shaker |
| 83 | B5 | Jingle Bell |
| 84 | C6 | Bell Tree |

For rhythm practice the obvious picks are 36 (bass drum), 38 (snare), 42 (closed hi-hat), 37 (side stick) and 39 (hand clap); 21 and 22 (metronome click and bell) could serve as a keyboard-side click.

### Sound effect voices (bank MSB 64, LSB 0)

Possible gameplay sounds played by the keyboard, per OM p. 48. Each is a normal voice: select it on a channel, then play a note (which note sounds best is not documented).

| Voice no. | Program (1 to 128) | Name |
|---|---|---|
| 352 | 1 | Cutting Noise |
| 353 | 2 | Cutting Noise 2 |
| 354 | 4 | String Slap |
| 355 | 17 | Flute Key Click |
| 356 | 33 | Shower |
| 357 | 34 | Thunder |
| 358 | 35 | Wind |
| 359 | 36 | Stream |
| 360 | 37 | Bubble |
| 361 | 38 | Feed |
| 362 | 49 | Dog |
| 363 | 50 | Horse |
| 364 | 51 | Bird Tweet 2 |
| 365 | 56 | Maou |
| 366 | 65 | Phone Call |
| 367 | 66 | Door Squeak |
| 368 | 67 | Door Slam |
| 369 | 68 | Scratch Cut |
| 370 | 69 | Scratch Split |
| 371 | 70 | Wind Chime |
| 372 | 71 | Telephone Ring 2 |
| 373 | 81 | Car Engine Ignition |
| 374 | 82 | Car Tires Squeal |
| 375 | 83 | Car Passing |
| 376 | 84 | Car Crash |
| 377 | 85 | Siren |
| 378 | 86 | Train |
| 379 | 87 | Jet Plane |
| 380 | 88 | Starship |
| 381 | 89 | Burst |
| 382 | 90 | Roller Coaster |
| 383 | 91 | Submarine |
| 384 | 97 | Laugh |
| 385 | 98 | Scream |
| 386 | 99 | Punch |
| 387 | 100 | Heartbeat |
| 388 | 101 | Footsteps |
| 389 | 113 | Machine Gun |
| 390 | 114 | Laser Gun |
| 391 | 115 | Explosion |
| 392 | 116 | Firework |

(Machine gun and laser gun are listed for completeness; they do not fit a game for a young student.)

## What a person still has to check

On the real keyboard, with `docs/hardware-test-checklist.md`:

Done: channel 1 lights keys and the lit note sounds, CC 122 switches Local Control, presses go out on channel 1 (`docs/hardware-notes.md`).

- Section 4: whether other channels light keys; velocity and length of a light; what the Light Guide button does to lights from the computer; whether a note at channel volume 0 (CC 7) still lights.
- Section 10: whether the clock the keyboard sends depends on its metronome or a style running; External Clock with a clock from the game.
- Section 11: drums on channel 10 or on a channel set to a kit by bank and program; the sound effect voices; latency of sounds sent to the keyboard.
- Not in any section yet: which of the two USB ports ("[0]" and "[1]") carries the keys; what the keyboard sends with Keyboard Octave or Transpose set; the drum rows marked "(?)" above, against OM p. 49.

- IDEA(architect, Later): a research pass found three pieces of the EZ-220 support worth giving upstream to the open projects they came from or would help; the rest is not worth it now. Pick them up when the hardware spike (ft_0_01) has confirmed them.
