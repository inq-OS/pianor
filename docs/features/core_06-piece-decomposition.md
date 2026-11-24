---
id: "core_06"
title: "Piece decomposition"
scope: "A piece in logical parts, each practised and levelled; the whole levels up with them"
effort: "medium"
status: "slices A and B built in code and unit tests; part cards not yet looked at on a device"
completeness: 0
---
# core_06: Piece decomposition

R2. Index: [FEATURES.md](FEATURES.md).

## Rules

A piece is made of logical parts the student can practise and level up one by one. A part is a named bar range: the chart's `phrases[]`.

1. The meta file gets named parts (`phrases`: a name and 1-based bars). Parts may **nest** (a tricky 4 bars inside "A") but never **cross**, so every bar has one innermost part. The generators and the editor (ft_1_02) can fill them in later.
2. In the piece list (`MenuScene`; the song list of the room's book until [ft_1_12](ft_1_12-training-piano.md) merged the two), a piece with parts has a small parts button that opens its part cards (`PartsScene`), the whole piece first; choosing a part starts section practice on its bars (core_03). A tap on the card itself plays the whole piece.
3. Part stars and progress are in slice B (AC7, AC8). Part plays earn no XP.
4. Planned: the part cards become rows of the song screen ([ft_1_36](ft_1_36-songs.md)), one tree for a piece's parts and a song's pieces; the phrases stay in the meta file.

## Acceptance criteria

Slice A:

- **core_06.AC1** Parts that nest are valid; parts that cross are refused by the chart schema, with the two names in the message.
- **core_06.AC2** `partTree` gives every bar its innermost part, or none when no part covers it.
- **core_06.AC3** `piece:lint` reports crossing parts as an error with the two part names.
- **core_06.AC4** Choosing a piece with parts shows the whole piece first, then one card per part with its name and bars. Choosing a part starts section practice on those bars with the usual section rules.
- **core_06.AC5** A piece without parts behaves exactly as before.

Slice B:

- **core_06.AC7** A part's stars come from its full plays only: a play that went through every bar of the part, whole piece or section alike. Its accuracy is notes right first time over notes, rated by the five-star grade (`passStarsFor`); a complete play earns at least one star. Pure, from the practice log (core_10).
- **core_06.AC8** The part cards show the part's best stars (0 to 5, the empty ones dark). Part plays earn no XP and change no piece stats.

Needs core_03 and core_04.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R2): the front matter still says `idea` and 0 while slices A and B are built; set `status` and `completeness` by the rule in FEATURES.md. Then the part cards need the maintainer's look on a device.
