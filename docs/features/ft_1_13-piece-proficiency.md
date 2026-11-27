---
id: "ft_1_13"
title: "Piece proficiency"
scope: "Practice earns each piece its own XP and level per player instead of player XP; player XP and levels come only from the challenges with characters (ft_1_21); pieces are not locked by player level"
effort: "medium"
status: "built (piece XP and level, no player XP from practice, no piece locks); the try-out with the student is open"
completeness: 90
depends_on: ["ft_1_12", "core_04", "ft_0_10"]
---
# ft_1_13: Piece proficiency

Each piece has its own XP and level for the player; player XP and levels come only from the challenges with characters. Release R3 (the piano side is [ft_1_12](ft_1_12-training-piano.md)). Decision: [d098](../decisions/game.md#d098). Index: [FEATURES.md](FEATURES.md).

## Rules

1. **Piece XP and level.** Each pass earns that piece XP by the ft_0_10 rule (accuracy, stars, repeat discount, help costs); the level comes from its own curve in `content/curriculum/progression.json` (`pieceLevels`; AX-3 provisional). Both are derived from the attempt history in the save by `deriveProgress`, like the core_04 stats: no save-format bump.
2. **No player XP from practice.** A practice pass saves 0 player XP; XP earned before stays (AX-1.1). Player XP and levels come from the challenges with characters (ft_1_21).
3. **No piece locks.** Every piece the player has turned on can be played; player levels open scenes only (AX-0.3).
4. The piece card shows "Level N" once the piece was played, past its small buttons or else at the outer end of its title's line, well apart from the title so it never reads as part of it; the score screen shows the session's piece XP, the piece level and its bar. The room's door opens the map of Keri (ft_1_18), and a character met in a scene plays its tug on the student's piece (d095).

## Acceptance criteria

- **ft_1_13.AC1** Piece XP and piece level are pure functions of the history, with tests (`pieceLevel.test.ts`); a piece card shows its level.
- **ft_1_13.AC2** A practice pass leaves the player's XP unchanged; XP from before the change is kept.
- **ft_1_13.AC3** No piece in the list is locked by player level.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)).

- NEEDS-HUMAN: the try-out with the student of piece XP and levels.
