---
id: "ft_Y_01"
title: "Battle and spellbook"
scope: "Turn-based battles; pieces and riffs as spells; a spellbook of active spells"
effort: "large"
status: "on hold (d129): waits on the maintainer's answer on what carries over into challenges. Was: idea"
completeness: 0
---
# ft_Y_01: Battle and spellbook

**On hold (d129: no battles, challenges with characters instead):** this was designed as part of a fight. What of it carries over into the challenges of [ft_1_21](ft_1_21-challenges-with-characters.md) waits on the maintainer (see the section What must come from the maintainer in ft_1_21); do not build it until then. The answer: it folds into challenges, health becomes ego, heal a boast, defence a comeback; it stays on hold until R4 is redesigned.

Phase: after the MVP. Status: idea; write a plan before starting. Index: [FEATURES.md](FEATURES.md).

Turn-based battles in which pieces and short riffs (2 to 4 bars) are spells with different abilities. The character keeps a spellbook and picks a limited number of active spells; turning pieces on and off in ft_1_02 is the first step. Bars power the attack, timing drives crits (needs Tempo mode, core_01), and playing both hands together multiplies power (`bothHandsMultiplier`, ft_0_15). Spells, enemies and classes are JSON.

From the original plan:
- Single enemy, turn-based: pick a spell (a 4-bar phrase), play it; the bars power the attack and tempo accuracy drives crits.
- One class (for instance "Classical") with three spells; enemy HP and rewards in JSON.
- The phrase is the RPG unit, a spell. The effect pipeline is `PhraseResult + ClassModifiers -> effects[]` (damage, buff, heal, combo, the two-hands multiplier); classes and spells are data, not code (`docs/architecture.md`, core data model).

Related: power and XP from difficulty (core_08), monster looks (ft_Y_02), classes and the overworld (ft_Y_03). See also ft_Y_10: defending a monster's power attack with a short riff, the first riff in a battle.

## Design update (step 1 of the RPG MVP)

The design page rpg-battle-mvp.md (R4) refines this file. Turn-based battles run on one mechanic, the **cast**: a bar range of a piece, played in Wait mode, paid per finished bar by its share of notes right the first time, and stopped by a rule (none, cracks, or first slip). A stopped cast keeps what it earned. Three classes each have one tilt and one special (wizard heals, ranger snipes, knight counters); a spellbook has six slots per class; tamed monster songs power an Elemental ability with four elements.

Built so far: the numbers in `content/battle/turns.json` (provisional, validated) and the pure rules in `src/core/battle/turns.ts` (cast pay-out and stop rules, combo ramp and windows, monster charge, power attack, slip damage, defence). Not built yet: the turn loop as a state machine, classes, the spellbook, the save and any screen.

Step 2: the three classes are built as data and pure rules: `content/battle/classes.json` (each with one tilt and one special, validated) and `src/core/battle/classes.ts` (the tilt-adjusted turn rules, the wizard's heal, the ranger's snipe and charge break, the knight's counter, cooldowns). The counter is offered only while the monster charges and replaces the defence minigame. Specials take the clean-bar count a cast reports, not judge events. Not built yet: the turn loop and the class pick screen.

Turn loop: `src/core/battle/turnBattle.ts` is the turn state machine over the cast rules. One action per student turn (base, power, combo or the class special), cooldowns from `content/battle/turns.json` (power and combo 4 turns) and the class (heal 4, snipe 3), the monster's charge beat, the power attack with the defence (minigame or the knight's counter), slips, win and loss, and the XP share. It reads only the bar results a cast reports. Not built yet: the crack weighting (the cast counts plain slips for now) and the Elemental ability.

Follow-up: a two-hand bar carries the judge's `bothHands` counts, so its pay gets the hands bonus (`bothHandsMultiplier`, up to +50 %, ft_0_15). Reading of the combo window (the most likely one, to confirm with the maintainer): a loop that finishes after its window counts for nothing and ends the combo, as the design's "counts only if it ends in time" says; a slip still pays the bars played up to it.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- IDEA(builder, R4): on hold (d129): class pick and spellbook (build order item 3 of docs/architect/rpg-battle-mvp.md): four slots Power 8, Combo 2, Special 4 or 2, Shield 4 bars from finished pieces, defaults on first pick, a slot whose own piece no longer fits asks for new bars; R4's one shared save bump (`rpg.classId`, `rpg.spellbooks`).
- IDEA(builder, R4): on hold (d129): the turn battle screen (item 4): four action buttons with turns-to-ready pips, casts through `PlaySession` on the stage with the cracking crystal, monster pips and the ft_Y_10 aura, the defence panel over the staff area; campaign phase 3 uses it when the player has a class; a `turn-battle` demo scenario. After the spellbook and `openOverlay` (ft_1_06).
- IDEA(builder, R4): on hold (d129): the song bag and elements (item 5): a beaten level 3 adds the monster's song to `rpg.songBag`; spell slots take bag songs plus the class's starter song; four elements in a cycle with weakness x1.5 and resistance x0.5; an element icon on the monster card (never colour alone). Same R4 save bump.
