---
id: "ft_0_13"
title: "Pixel art and menus"
scope: "Original pixel kit, whole-number zoom, menu, results, credits, eighth notes"
effort: "done"
status: "done; look not reviewed (Human)"
completeness: 100
---
# ft_0_13: Pixel-art pass and menus

Minimal art: one UI skin, one character, level and XP display, piece selection screen. Original assets only; sources in `docs/assets.md`. Index: [FEATURES.md](FEATURES.md).

## Rules

1. An original pixel-art kit (`src/game/ui/pixel/`), whole-number zoom (`pixelView`: 4x at 1366x768 and 1280x720, 3x at 1024x600).
2. The paged menu (six pieces and a pager, ft_0_11) shows Kiur, level and XP, two-column piece cards with stars and padlocks (the hand badges are gone; pieces are told apart by a light rule between them); plus the credits screen, results screen and practice bars (Kiur speaks in a bubble).
3. Eighth notes are drawn (beamed with their beat, a flag on a lone one, the eighth rest; sixteenths since core_09.AC40), as level 5 allows them; generators use them and `skipping-stones` shows them.
4. Not done: animation beyond Kiur's bob, mood and level-up sparkles, sound effects, a tileset or world map (RPG shell), a settings screen. Not verified: how the look reads to the student (human).

## Acceptance criteria

- **ft_0_13.AC1** Pixel scaling is consistent at common resolutions.
- **ft_0_13.AC2** All text is readable by a young student. [human]
- **ft_0_13.AC3** No third-party assets without a recorded licence (`docs/assets.md`). [human]
