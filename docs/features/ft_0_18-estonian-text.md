---
id: "ft_0_18"
title: "Estonian text in capitals"
scope: "Every word the student sees is Estonian and in capitals: a catalog per language, the letter case applied at the render boundary, the Estonian capitals Õ Ä Ö Ü Š Ž in the pixel font, Estonian piece titles where given; the English game stays behind a URL switch for the tests"
effort: "medium"
status: "in progress: built, human checks and content names open"
completeness: 50
---
# ft_0_18: Estonian text in capitals

The whole game is in Estonian and in capitals, because the game is made for Estonian players and a beginning reader reads block capitals first. Decisions: [d081](../decisions/game.md#d081), [d086](../decisions/art.md#d086) (small capitals). Index: [FEATURES.md](FEATURES.md).

## Rules

1. Catalogs keep normal sentence case (`src/core/text/strings.et.ts`, typed, every English key has an Estonian entry with the same placeholders). The case is applied once where text is drawn (`displayText`, `PixelText`): a capital is a full capital, every other letter a small capital (d086).
2. Language: `?lang=en` gives the English game (default Estonian, `src/core/text/language.ts`); end-to-end tests open with it (`tests/e2e/helpers.ts`).
3. Õ Ä Ö Ü Š Ž have their marks inside the capital height in the pixel font (`src/game/ui/pixel/font.ts`).
4. Estonian piece titles: optional `titles.et` in piece meta and chart (`src/core/text/pieceTitle.ts`; 27 pieces; generated pieces get one too). Content names are not done yet.
5. A new Estonian player defaults to letter naming `H` (`defaultNoteNaming`).
6. Note-name hints, finger numbers and section marks are not words and are never changed.
7. Label fit is measured (`labelFit`, `tests/e2e/button-fit.spec.ts`) over menu, settings, pieces, profiles, room, admin, campaign, credits, editor, practice, battle and the stats screen with no saved play; results, battle results, rundown and the stats numbers need saved play and are not checked.
8. Labels changed for the student to check: settings `1. takt`, editor `Tühista` (undo) and `Uuesti` (redo).

## Acceptance criteria

- **ft_0_18.AC1** With no URL switch, every screen the student reaches shows Estonian in capitals (small capitals for the letters that are lowercase in the text, d086). The English catalog and the test switch are covered by AC5.
- **ft_0_18.AC2** Every key of the English catalog has an Estonian entry (a typed catalog, `src/core/text/strings.et.ts`), with the same placeholders, and every Estonian string, as drawn, has no missing-glyph block.
- **ft_0_18.AC3** Õ Ä Ö Ü Š Ž draw as small capitals with their marks inside the capital height, with no clipping, so a label with a mark is as tall as one without (d086). [human] the font sheet is checked by a native reader.
- **ft_0_18.AC4** Piece titles and displayed content names show in Estonian where given, and fall back to the English field where not.
- **ft_0_18.AC5** `?lang=en` gives the English game; the end-to-end tests open with it (`tests/e2e/helpers.ts`).
- **ft_0_18.AC6** No text overflows its button or panel in Estonian capitals. [human] checked on screenshots.
- **ft_0_18.AC7** Note-name hints, finger numbers and section marks are unchanged. [human]

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)).

- NEEDS-HUMAN: the visual check of the screens (AC6), the native-speaker check of the wording and the font sheet (AC3), and the changed labels in rule 8.
- TODO(builder, R2): content names in Estonian (AC4).
- TODO(builder, R2): per-player text settings: capitals or normal text, Estonian or English (`settings.text: { letterCase, language }`, defaults upper and et), two rows on Settings each drawn in its own case and language, lowercase õ ä ö ü š ž in the pixel font, boot and player switch set the language; joins the next shared save bump with fixed migration values (d064, d069).
