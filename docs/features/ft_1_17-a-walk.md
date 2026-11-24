---
id: "ft_1_17"
title: "Visiting the island: the room's screensaver"
scope: "Left alone in the room, the game visits the scenes on Keri the student's level has opened, one after another, like someone who lives on the island; any key, note or tap returns to the room; nothing is earned or saved"
effort: "simple"
status: "built (d117): visits the open scenes (today the knoll); the maintainer's look on the laptop is open"
completeness: 85
depends_on: ["ft_1_08", "ft_1_14", "ft_1_19"]
---
# ft_1_17: Visiting the island: the room's screensaver

A screensaver of scenery, started by idling, so that the player feels like someone living on the island ([d117](../decisions/game.md#d117); the window is picture only). Index: [FEATURES.md](FEATURES.md).

AX-0: it never stands between the student and the piano: it starts only from the room, never from a screen where notes are read, and one key or note ends it. AX-2: attraction only, no reward.

## Acceptance criteria

All criteria are AX-3 provisional: the screensaver is wanted; the numbers and details are the agent's and wait for the maintainer's look.

- **ft_1_17.AC1** Retired (d117): the window is part of the painted room and is no button.
- **ft_1_17.AC2** The screensaver shows the scenes of Keri ([ft_1_19](ft_1_19-scenes-on-keri.md)) the student's level has opened and that have a screen, in the world model's order, each for 45 seconds, then the next; after the last it starts over, and with one open scene it stays there. A scene looks as it does when opened from the map (the sky of the hour, the wind). (Rules: `src/core/visit/islandVisit.ts`; the scenes' side: `src/game/visit/islandVisit.ts`.)
- **ft_1_17.AC3** Any key, any note on the piano, a tap or a move of the pointer on the scene, or Back on the toolbar, returns to the room; a key does nothing else in the scene.
- **ft_1_17.AC4** When nothing has been pressed, played or moved in the room for two minutes, the room starts the screensaver by itself. Only the room does this. Not in the self-playing demo (`?autoplay=1`), and not when the scenery is to stand still (`?motion=still`, d127). With no scene open the room stays.
- **ft_1_17.AC5** Nothing is earned, judged or saved on a visit: no XP, no stars, no progress, no record that it happened. [human]
- **ft_1_17.AC6** [human] The maintainer looks at the screensaver on the laptop and decides whether two minutes, and 45 seconds a scene, are right.

## Notes

- Later, each needs its own decision: quiet ambient sound, things that happen in a scene while it is visited (a bird, a far boat), whether the map of Keri is a stop of the round, and whether the screensaver may also start from the main menu.
- Not verified: the look on the laptop's real screen (needs human, AC6). No screenshot baseline is added.
