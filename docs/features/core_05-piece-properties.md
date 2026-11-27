---
id: "core_05"
title: "Piece properties"
scope: "Hover card: styles, stars, derived features"
effort: "simple"
status: "slices built: derived features, the info card and the closed style list; menu filter, piece stats and class mapping open"
completeness: 60
---

# core_05: Piece properties and hover card

What a piece is, shown on an info card in the menu (an "i" button on a piece card, for mouse and touch alike). Index: [FEATURES.md](FEATURES.md).

## Rules

1. **Styles:** `styles` in the meta file, from the closed list `content/pieces/styles.json` (`schemaVersion` 1, provisional): `folk`, `classical`, `exercise` (drills and generated studies), `original` (tunes written for Pianor), named through string keys ("Folk song", "Classical", "Exercise", "Pianor tune"). A piece may have several. Old meta files and own pieces still load (d066). `piece:lint` rule `style` (`src/core/piece/lintRules.ts`) checks it. The editor writes no style. Free `tags` stay for technique and provenance (`c-position`, `generated`) and are not styles; the card shows "Style:" and not the tags.
2. **Complexity:** `complexityOf` (`complexity.ts`) turns the piece's points (the meta file's confirmed half stars times two, else core_08's proposal) into its grade, Beginner to Master, and the grade's five stars filled partly, four points a star ([d157](../decisions/game.md#d157)). Pieces without one (the editor's, hand-written dev samples) show none.
3. **Features:** `pieceFeatures` (`src/core/properties/features.ts`) derives them from the chart. "Hands apart" means the lowest right-hand note is above the highest left-hand note; the fastest note is the shortest the student plays, named from its length (no plain name says "Fast special notes"); an odd meter is anything outside 2/4, 3/4, 4/4, 2/2, 3/8, 6/8, 9/8, 12/8. `pieceInfo` (`info.ts`) puts stars, tags and features together; the card is `src/game/menu/PieceInfoCard.ts`, opened from `MenuScene.ts`.
4. Tags have names through string keys (`tag.<id>`, `tagLabel`).
5. Tests: unit and property tests beside the code, `tests/content/pieceFeatures.test.ts` on the real pieces, `tests/e2e/pieceInfo.spec.ts`.
6. Not built: the player's stats on the card (needs core_04), menu filter by style.
7. Not verified (a person): how the card reads for a young student ("How hard", "In this piece:", "Fastest: quarter notes"), whether an "i" is understood, the card on a tablet with a finger (the button is 11 art pixels, 44 screen pixels at 4x), screenshot baselines (none).

## Acceptance criteria

- **core_05.AC1** The features of a piece come from a tested pure function of the chart (`pieceFeatures` in `core/properties`): two hands, hands apart, black keys, rests, the fastest note value, a key, meter or tempo change and an odd meter, counting only what the student plays; 3/4 is not unconventional. The difficulty stars and the tags are put together with them by `pieceInfo`.
- **core_05.AC2** The function gives sensible answers on the real pieces of `content/pieces/` (two hands only where a piece has both hands, rests and eighth notes where a piece is about them).
- **core_05.AC3** In the menu every piece card has an "i" button that opens an info card with the piece's difficulty stars, its tags and its feature list; Close or a tap outside closes it and a tap outside does not press what is behind it. All text comes through string keys. The card also shows the piece's own BPM (`ft_1_02d.AC6`).
- **core_05.AC5** A piece's styles come from the closed list in `content/pieces/styles.json` (`parseStyleList` in `core/properties/styles.ts`; each style has a name through a string key): `piece:lint` makes a style that is not on the list an error and a committed piece with no style a warning (an own piece in `private/pieces/` needs none), and the info card shows "Style:" with the names of the piece's styles and not its free tags.
- **core_05.AC4** The card fits and reads well at 1366x768, 1024x600 and 960x540 (the smallest layout). [human]

