---
id: "ft_Y_03"
title: "RPG shell"
scope: "Overworld, inventory, classes mapped to musical styles"
effort: "large"
status: "on hold (d129): waits on the maintainer's answer on what carries over into challenges"
completeness: 0
---
# ft_Y_03: RPG shell

**On hold (d129: no battles, challenges with characters instead):** this was designed as part of a fight. What of it carries over into the challenges of [ft_1_21](ft_1_21-challenges-with-characters.md) waits on the maintainer (see the section What must come from the maintainer in ft_1_21); do not build it until then.

Write a plan before starting. Index: [FEATURES.md](FEATURES.md).

The world around the battles: an overworld scene (tile map, characters to meet, simple encounters), an inventory, and three classes mapped to musical styles with different modifiers (for instance Jazz: combo and swing bonus; Classical: precision crits; Pop: buffs). Classes are JSON data, so a style can be added without engine code (`docs/futureproofing.md` section 3).

ft_0_13 left the tileset and the world map to this feature. Battles themselves are ft_Y_01; key-light hints, from the same phase of the original plan, are ft_Y_06.
