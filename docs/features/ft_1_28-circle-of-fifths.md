---
id: "ft_1_28"
title: "Circle of fifths"
scope: "An interactive circle of fifths as an overlay on the screens where the student plays or writes music: twelve major keys outside, their relative minors inside, the number of sharps or flats at each step, the current piece's key marked; a key chosen on it (click, arrows or its tonic on the piano) shows its signature and scale on a staff and plays the scale; plus a docs/theory reference folder"
effort: "simple"
status: "built (interactive); the wheel and icon painted as a ship's helm"
completeness: 95
depends_on: ["ft_1_02d", "ft_1_12"]
---
# ft_1_28: Circle of fifths

Release R2. Index: [FEATURES.md](FEATURES.md).

A theory helper the student opens while reading or writing a piece (easily accessible from any screen with playing or the piece maker; a simple overlay now, a proper feature later). It is interactive. AX-0: it shows why a key has its sharps or flats and which minor shares them, next to the music that uses them, and the student hears and sees the scale of any key on it.

## Rules

1. **Where.** A toolbar button (a small wheel) on the practice screen (ft_1_12), the note-name trainer (ft_0_17) and the piece maker (ft_1_02d) opens the overlay through `openOverlay` (d070). Esc, Back or a second press closes it; playing is paused while it is open (Wait mode waits anyway). AX-3 provisional: these three screens.
2. **What.** Twelve steps clockwise from C at the top: the major key outside, its relative minor inside, and the count of sharps or flats with its sign at each step (F sharp and G flat share the bottom step; AX-3 provisional: the spelling with six sharps first, both written). Note names follow the player's B or H setting (`settings.noteNaming`, d087).
3. **The current key** of the piece on screen (the chart's key in practice, `fifths` and `mode` in the piece maker) is marked on its step; the note-name trainer marks none.
4. **Pure layout.** Positions, labels and spelling are a pure function in `src/core/layout/` built on the key code in `src/core/editor/key.ts`, so a later trainer reuses it; the scene only draws it.
5. **Reference folder.** The docs/theory folder holds music theory the project builds on, for agents and the maintainer, not shown to the student: an index `THEORY.md` and one page per topic, the first `circle-of-fifths.md`, with front matter so `docs:check` passes.
6. No save change; text through string keys with Estonian.
7. **Interactive.** A click on a key's name (or its count) chooses it; the arrows go round the circle (left, right) and between the rings (up major, down minor); a key played on the piano chooses the key whose tonic it is, on the ring chosen. The chosen key's cell is gold, its name stands beside the wheel ("G major", "e minor"; "G-duur", "e-moll"), and its scale, one octave up from the tonic with the key signature, stands on a treble staff under it (`scaleChart`). A click or an arrow plays the scale with the cursor on each note; Listen or Enter plays it again; a key the student plays does not, so the game never plays over the student. Nothing is judged and nothing saved (the piece maker's key is set only by its tick, rule 8): playing scales for XP is ft_1_29's slice A. **Spelling:** on the bottom step a click on the upper name or the left count chooses F sharp, the lower name or the right count G flat; a second click on the chosen step, on the same ring (or up on the major ring, down on the minor ring again), switches a two-spelling step to its other spelling, so every one of the fifteen keys can be chosen and shown (C flat, G flat, C sharp; e flat, a flat, a sharp minor); a tonic played on the piano takes the spelling with fewer signs, or the piece's. AX-3 provisional: the spelling switching on a second press. AX-3 provisional: the natural minor for a minor key (it shows the signature's notes); the scale only upward, at about 100 a minute; the minor ring's bottom shows one name (d#, or eb for a piece in G flat), as two do not fit.

8. **Sets the piece maker's key.** In the piece maker the circle opens from the wheel action and from a press on the clef or key signature, opened to choose: on a row of their own under the key's name, Listen and Close (so no button covers the name; `circlePanelLayout`), a tick with the key signature (a plain tick for C major and a minor) sets the chosen key as the piece's, an edit Undo takes back, and closes the circle. A step with two spellings (5, 6 or 7 signs either way: B or C flat, F sharp or G flat, C sharp or D flat) has a tick for each, so all fifteen signatures can be set. Esc or Close leaves the key as it was. Practice and the note-name trainer open it only to show.

Not now: key signatures drawn on small staves at each step; a trainer on the circle (ft_1_29 takes the scales).

## Acceptance criteria

- **ft_1_28.AC1** The wheel button opens the circle on the practice screen, the note-name trainer and the piece maker, and Esc closes it back to the same place.
- **ft_1_28.AC2** The circle shows all twelve major keys and their relative minors with the right count of sharps or flats; the names follow the B or H setting.
- **ft_1_28.AC3** The key of the piece on screen is marked.
- **ft_1_28.AC4** The docs/theory folder exists with its index and a circle-of-fifths page, and `npm run docs:check` passes.
- **ft_1_28.AC5** A click on a key, the arrows or a tonic played on the piano choose a key; its name and its scale with its signature are shown, a click or an arrow plays the scale, a played key does not, and a key played under the circle is not judged by the screen below it.
- **ft_1_28.AC6** The scale's staff stands still: choosing another key changes the notes and the signature, never where the staff stands or how big it is (the size of the key whose signature takes the most room). `circleScaleLayout` in `src/core/trainer/staffFrame.ts`.
- **ft_1_28.AC7** In the piece maker the clef and the wheel open the circle; a tick sets the chosen key as the piece's (one tick per spelling where a step has two, so every one of the fifteen signatures can be set), Esc keeps the key (`src/core/layout/circleOfFifths.test.ts`, `tests/e2e/circle-of-fifths.spec.ts`).

## TODO

- The wheel is a ship's helm (picked of three sketches, with the difficulty of fitting all elements because of the rim's girth): the names' two rings on paper, and the ring of counts is the helm's rim itself, warm wood with each count on an upright brass plate (C's plate says 0), so the rim adds no girth; two-pixel wooden spokes, a brass boss in the hub, twelve turned handles past the rim. The piece's key: its plate polished pale and a red bow tied on the rim (a shape as well as a colour); the chosen key: its cell and its plate gold (a chosen minor lights the plate it shares with its major). Flats in the names are written with the flat sign (B♭, b♭) as on the staff. The icon is a small helm. The rings were rebalanced in `circleLayout`. (`paintWheel` in `src/game/ui/pixel/circleArt.ts`; `TOOL_ICONS.circle`; the flat glyph in `font.ts`.)
- TODO(builder, R2): on the scale's staff beside the wheel the key signature runs into the time signature (D major's two sharps over the 4/4, F major's flat on the top 4); the signature needs its width before the time signature, as on the practice staff.
- TODO(architect, R2): AX-3 provisional: a second click or arrow on the chosen two-spelling step switches its spelling (rule 7); keep it, or give each spelling its own place on the wheel.
- IDEA(architect, Later): key signatures drawn on a small staff at each step, and a trainer on the circle (later).
