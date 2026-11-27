---
id: "ft_1_09"
title: "Rank shield in the player room"
scope: "The player's level shown as a pixel-art rank shield on the wall above the piano, twenty ranks, and an XP table of twenty levels"
effort: "done"
status: "built: twenty shields, placement above the piano, XP table of twenty levels; the maintainer's look on the laptop (AC5) open"
completeness: 100
depends_on: ["ft_0_10", "ft_1_07", "ft_1_08"]
---
# ft_1_09: Rank shield in the player room

Index: [FEATURES.md](FEATURES.md). the look: a shield on the wall with no frame, 24 art pixels, twenty ranks.

The level is a number on the toolbar; the room shows it as something to earn and look at. First step of a bigger idea (trophies, medals, piano upgrades), which stays in the Later pool.

## Rules

- Not in scope: rank names, a level-up animation, trophies, medals, piano upgrades.

## Acceptance criteria

- **ft_1_09.AC1** The room shows the shield of the player's current level, from the XP table, on the wall above the piano. Levels 1 to 20 each have a different shield; a level above 20 shows the last one. The XP table has twenty levels: the first ten unchanged, then the step to the next level grows by 100 XP each level (800, 900, ... 1700; `content/curriculum/progression.json`, still provisional). (Built: `rankBadge` in `src/game/ui/pixel/rankArt.ts`, drawn by `ProfileDashboardScene`; unit tests in `rankArt.test.ts` and `src/core/progression/xp.test.ts`.)
- **ft_1_09.AC2** The shield carries the player's level in the room; the toolbar shows no name, level or XP bar (d282): the name is written into the shield and the shield opens the player's card with the level and the XP ([ft_1_20](ft_1_20-action-and-inventory-strip.md).AC13). AX-2: the shield only shows the level earned from XP, and XP is never taken away, so a rank never goes down.
- **ft_1_09.AC3** The shield is the button that opens the player's card (ft_1_20.AC13). In the painted warden's room ([ft_1_18](ft_1_18-keri-island.md).AC3, [d111](../decisions/art.md#d111)) it hangs on the back wall over the piano, right of the portrait, clear of the portrait and of both windows, drawn on the fine grid (48 x 48 fine pixels) in the room's light; the picture holds one shield for each rank and shows the player's. (Built: `shield` in `roomPlan`, unit test in `src/core/layout/room.test.ts`; e2e in `room.spec.ts`.)
- **ft_1_09.AC4** The shields are pixel art in palette colours with the ink outline: tiers of three after the progression of the Kenney Ranks pack (CC0, used as an idea only; every pixel is drawn here): bronze, silver, then gold chevrons (the gold ones under a star); silver, then gold stars; stars in a laurel; at 19 a crowned gold crest and at 20 the crest in a laurel. (Listed in `docs/assets.md`.)
- **ft_1_09.AC5** [human] The maintainer looks at the room on the laptop.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- IDEA(architect, Later): the room fills with earned trophies, statues and paintings, and the piano upgrades with rank (old upright, good upright, grand). Earned only and never taken away (AX-2); rewards that point at music, such as a composer's statue after their pieces (AX-0); awards as content derived from progress; free packs first. Needs the architect's design pass and the painter.
