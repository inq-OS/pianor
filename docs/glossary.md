# Glossary

The words of the game (d290). Code, content, tests and docs use these words and none of the banned words below; the one
exception is code that reads an old save to migrate it.

## Words

| Word | What it names |
| --- | --- |
| character | someone the student meets in a scene of Keri and talks to: Puuvaim, the fisherman (ft_1_22); each has its own `content/characters/` file |
| challenge | a character asks the student to trade the phrases of a piece (ft_1_21) |
| tug | the challenge as played: the character plays a phrase, the student answers with the next (ft_1_21) |
| exchange | one phrase answered in a tug, won or lost |
| standing | where the tug stands, three steps each way; the student wins at +3 |
| learn, practise, show | the three steps of a character's piece, the student's route with that character; the show is the tug (d135) |
| practice gate | the practice evidence that opens the show (ft_1_06.AC15) |
| tug record | one finished tug as the save keeps it: character, piece, won or lost, XP |
| prize, prize ladder | the item a won tug gives, by level (ft_1_21.AC18) |
| item, backpack | what the student carries, shown in the backpack (d282) |
| scene | one painted place on Keri (ft_1_19) |
| map | the map of Keri, where an open scene is pressed (ft_1_19) |
| level | the student's level from total XP, and a tug's level 1 to 3 |
| hearts | a trainer's lives (note, shape and chord trainers) |

## Banned words

monster, beings, enemy, battle, fight, HP, health bar, damage, loot, campaign, arena, overworld, find the key, find the
door, spellbook, spell, RPG, equipment, special ability, power attack, counterattack, boss fight, confuser.

TODO(architect, R2): a CI check that fails on a banned word in code, content, tests or docs, with an allow-list for the
migration that reads an old save (d290).
