---
id: "ft_Y_08"
title: "Confuser"
scope: "Optional boss-fight trick: random keys light up to disorient the player"
effort: "simple"
status: "on hold (d129): waits on the maintainer's answer on what carries over into challenges"
completeness: 0
depends_on: ["ft_Y_01","ft_Y_06"]
---
# ft_Y_08: Confuser

On hold (d129: no battles, challenges with characters instead). What carries over into the challenges of [ft_1_21](ft_1_21-challenges-with-characters.md) waits on the maintainer (see the section What must come from the maintainer in ft_1_21); do not build it until then. Index: [FEATURES.md](FEATURES.md).

An optional boss-fight trick: while the student fights a boss, random keys on the EZ-220 light up to disorient them, so the lit keys are no longer a hint but a distraction.

## Rules (planned)

1. A boss-fight rule in content (ft_Y_01): how often and how many keys light, for how long, never the right key twice in a row, and never on the first battles.
2. It uses the key-light output of ft_Y_06, so it needs the hardware spike (ft_0_01) to confirm that lighting a key from the computer works. On the virtual keyboard the on-screen keys light in the same way, so it is testable without the EZ-220.
3. A switch in the settings and in the difficulty modifiers (core_07): optional, and an extra XP or damage bonus when on (settled by AX-1). A seed makes the pattern repeatable in tests.
4. Student-friendly: a short, gentle flicker, a clear sign that this is the boss's trick, and a setting to turn it off.

## Acceptance criteria

With it on, random keys light in a boss fight (virtual and, when verified, real keyboard); with it off nothing changes; the pattern is seeded and tested.
