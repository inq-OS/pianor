---
id: "core_07"
title: "Difficulty modifiers"
scope: "Turn helps off for an XP and damage bonus"
effort: "simple"
status: "factor table, XP function and save field built; nothing wired (no switches, no XP change yet)"
completeness: 25
---
# core_07: Difficulty modifiers

Release: after the MVP. Built, not wired: the factor table as validated content (`content/curriculum/modifiers.json`, loader and lookup in `src/core/progression/modifiers.ts`; values are proposals for the maintainer to tune, from the difficulty review: noteNames 0.6, fingerNumbers 0.8, litKey 0.6, onScreenKeyboard and metronome 0.95); the XP function `applyHelpFactors` in `src/core/progression/xp.ts` (XP times the factors, floored, at least 1 when it earned XP; 0 new XP when a key light appeared after wrong presses); save v13 records the helps in force with every attempt (`helps`, ids not factors, d060; `recordAttempt` takes them, the game passes none yet).

The player can turn helps off (or on) and gets a reward modifier for it.

1. The switches: metronome, note names, finger numbers, the lit-note highlight, the tempo tracking and score view (core_01), whether the staff stays visible, one line or all lines (ft_0_16), the EZ-220's **key lighting** (see below), and more later.
2. Each help costs or pays a factor on XP (and later damage, ft_Y_01): less help, more reward. The factors are content (a JSON file), not code, so they can be tuned.
3. The modifiers in force are saved with every play (core_04), so a stat is read together with how it was reached.
4. A help costs reward: its factor is below 1.0 and above 0, so a play with helps still earns XP but less (AX-1; matches `modifiers.json`). Nothing earned is ever taken away (AX-1.1).
5. **Key lighting:** the EZ-220 can light a key (notes on MIDI channel 1 light keys; **unverified** until ft_0_01, see `docs/hardware-notes.md`). Playing with the lighting disabled earns a **1.10x** XP modifier (a start value in the table). When it is on, it is the hint of ft_Y_06. The factor applies only when the keyboard is real and lighting would have been available.
6. **Confuser (optional, ft_Y_08):** in boss fights random keys light up to disorient the player. It is a switch of its own, off by default, and never changes the XP downward.

## Acceptance criteria

Every switch changes the XP of a play by the table; the table is validated content. The results screen shows the XP earned without a breakdown of why.
