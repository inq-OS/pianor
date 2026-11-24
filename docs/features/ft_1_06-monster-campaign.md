---
id: "ft_1_06"
title: "Character campaign: learn, practise, show"
scope: "A sequence of characters (until d129 monsters), one unlocked at a time; each character is a game of three phases on a part of a piece (learn, practise, show; d135: the show is the tug of ft_1_21, opened by practice evidence) and three levels; free play stays open for every piece"
effort: "large"
status: "rules, ladder and save built; the practice gate in front of the tug (AC15) built with ft_1_21; the find-the-key and find-the-door screens removed (d135); the piece pick of AC9 not built; the ladder defaults not yet confirmed by the maintainer"
completeness: 55
depends_on: ["ft_1_21", "core_01"]
---
# ft_1_06: Character campaign: learn, practise, show

A sequence of characters, one unlocked at a time. Each is a game of three phases on a part of a piece: learn, practise, show. Free play stays open for every piece. Index: [FEATURES.md](FEATURES.md).

## Rules

Since d129 there are no battles or monsters: the monsters are characters (same ladder, ids, names, songs, unlock order) and phase 3 is the challenge of [ft_1_21](ft_1_21-challenges-with-characters.md); nothing is hurt. "Monster" and "battle" survive only as the words of the rules and the save (d129). Since [d135](../decisions/game.md#d135) the phases are:

1. **Learn:** the student learns the piece from the character ([ft_1_22](ft_1_22-conversations-and-phrase-book.md)) or picks their own (d095), by reading and playing it on the staff in the room.
2. **Practise:** in the room and the trainers, until the evaluation ([core_12](core_12-evaluation-and-curriculum.md)) says it is good enough (AC15).
3. **Show:** the tug of ft_1_21, played from memory with no staff (d100): level 1 checks only the keys and a wrong key moves on; level 2 is Tempo mode at the piece's tempo with the click; level 3 is Tempo mode with only the count-in heard. A loss can be retried after the cool-down of ft_1_21.AC13.

- **Find the key and find the door** are no longer a gate, a name or a screen (AC2, AC3, AC10 retired; ft_1_21 removed the two screens). Their rules were deleted (d135, d151); only `doorShareFromTempo` (`findDoor.ts`, the share of notes on time in Tempo mode) lives on as the tug's measure. The saved campaign keeps its `phase` and `doorOpen` fields (no save bump).
- **The piece is the player's** (d095, AX-0.3): a level sets only the difficulty. Level 1 plays the first half of the piece, levels 2 and 3 the whole piece. Each character also has its own song (docs/architect/rpg-battle-mvp.md), 8, 16, 24 and 32 bars for 1 to 4, used by the demo: `pebble-hop`, `cave-rumble`, `mist-waltz`, `echo-giant` (original, drafts until a person approves them). Names are church modes (Locria, Doria, Lydia, Phrygia).
- **Ladder (content):** characters in order, each with a piece id and three levels, each naming a bar range. Validated content with a `schemaVersion` (`content/campaign/ladder.json`, `src/core/campaign/content.ts`). A content test (`tests/content/campaignLadder.test.ts`) fails when a ladder piece is missing or has fewer bars than a level's range; `placeholder-` ids are skipped.
- **Unlock:** beating level 3 unlocks the next character; levels 1 and 2 are stars. A beaten level can be replayed any time; a repeat win gives no new progress. Only the first character is playable at the start, the other three are locked placeholders.
- **Costs:** phases before the show pay no XP and take nothing away. The show pays by ft_1_21. No XP is ever taken away.
- **Save:** the campaign state (unlocked, levels beaten) is in the profile (version 14), with a tested migration.
- **Wording:** gentle; no screen says "failed".
- **Meetings:** the trail is gone (d117). A character is met in a scene on Keri ([ft_1_19](ft_1_19-scenes-of-beings.md)) and talked to (ft_1_22); its tug opens from that talk once the practice gate is open (AC15, ft_1_21). The find-the-key and find-the-door screens, the piece list's campaign mode and the monsters' meetings that opened them were removed (d135, ft_1_21); their pure rules were deleted with the battle helpers (`levelChart`) and the Tempo door's frame (`tempoFrame.ts`). Not built in the new flow: picking any piece of the list for a character's level (AC9); the tug plays the piece the character taught.

Not in this feature: piece decomposition beyond bar ranges (core_06), more characters (ft_Y_02), the spellbook (ft_Y_01), art beyond placeholders (ft_Y_11), piece import (ft_Y_04).

## Acceptance criteria

- **ft_1_06.AC1** Only the first monster is playable at the start; the other three are locked placeholders with no gameplay under them. Where a monster is met is a scene on Keri ([ft_1_19](ft_1_19-scenes-of-beings.md)); the side-scrolling trail that did this first is removed (d117).
- **ft_1_06.AC2** Retired (d135): find the key is no longer a gate; practice evidence is (AC15).
- **ft_1_06.AC3** Retired (d135): find the door is no longer a gate; its Tempo share lives on as the measure of AC15.
- **ft_1_06.AC4** Phase 3 is the challenge of ft_1_21, the student's phrases played with no staff (d100): level 1 judges only the keys and a wrong key moves on, level 2 is Tempo mode with the click, level 3 Tempo mode with only the count-in heard; a loss is never followed by a new practice gate, only by the cool-down of ft_1_21.AC13.
- **ft_1_06.AC5** Beating level 3 unlocks the next monster; beating levels 1 and 2 does not.
- **ft_1_06.AC6** Every piece stays playable in free play, and the campaign saves nothing from free play.
- **ft_1_06.AC7** The campaign state has a `schemaVersion` and a tested migration, and a profile of the previous version keeps its progress.
- **ft_1_06.AC9** The player picks any piece of their list for a character's level (d095), or the piece the character taught (d135); level 1 plays its first half and levels 2 and 3 the whole piece, and the practice gate (AC15) and the show use the same piece.
- **ft_1_06.AC12** AX-3 provisional: one wind for the whole scenery (weather effects must be consistent over all scenery details). `sceneLook` carries a `wind` from 0 (calm) to 3 (storm), and everything that moves in a picture of Keri reads that one number (in the knoll: the grass, the sea and the smoke; ft_1_19.AC5). Until the real weather sets it ([ft_Y_14](ft_Y_14-seasonal-and-holiday-looks.md)), each day has its own wind from the day's number; the dev switch `?wind=0..3` (or `calm`, `waves`, `restless`, `stormy`) shows any strength. Decoration only, nothing saved (`src/core/sky/wind.ts`).
- **ft_1_06.AC14** AX-3 provisional (d135): **learn.** A character's level names its piece: the one it teaches (ft_1_22.AC3, the whole piece or its phrases) or one the student picks from their list (AC9). Learning is reading and playing it on the staff in the room; nothing in the campaign plays it for the student. [human]
- **ft_1_06.AC15** AX-3 provisional (d135, AX-1): **practise, then show.** The show (the tug) opens for a level only when that piece's level in core_12 (the median of its last 10 room plays, d139), counted in the mode the level's show uses (Wait for level 1, Tempo for 2 and 3), reaches the level's share (60, 80, 95 per cent, the tug's level shares in `src/core/exchange/tug.ts`); under 3 plays it never opens. A pure core query answers it from the practice log; there is no timed screen in front of the tug. Until the gate opens, the character says in one line what practice it waits for (AX-2.1), never a number it made up.
- **ft_1_06.AC8** The student understands learn, practise, show (what the character waits for, and why the tug opens), and losing stays gentle. [human]

## TODO

- TODO(builder, R3): AC9's piece pick in the new flow: the student picks any piece of their list for a character's level (d095) instead of the piece it taught; today the tug plays `CharacterDef.phrases` of its level. The piece list's old campaign mode went with find the key (d135).
- TODO(architect, R2): AC5 (beating level 3 unlocks the next monster) lives only in `battleResult` (`src/core/campaign/campaign.ts`), which no screen calls since the battle went (d129, d135), and the saved `phase` and `doorOpen` name the retired find-the-key and find-the-door phases. Decide whether the tug's won level 3 unlocks the next character through the campaign state, then wire it or drop the phase machine with a save bump (`save-format-bump` skill).
- The route's rewrite for d135 (AC14, AC15, the removal of the two screens) was done in [ft_1_21](ft_1_21-challenges-with-characters.md).

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R3): `SceneResult` and `openOverlay(key, data)` in `src/game/scenes.ts` (d070): launch the overlay, pause the caller, resolve with the typed result or `cancelled` (Esc and Back), unit tested; its first user is the "the key broke" dialog in find the key, replacing the timed message (the rule stays in `src/core/campaign`; gentle wording through string keys). A scripted `npm run demo` campaign still reaches the map after a broken key.
