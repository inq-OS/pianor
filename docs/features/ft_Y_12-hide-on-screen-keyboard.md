---
id: "ft_Y_12"
title: "Hide the on-screen keyboard"
scope: "A per-player setting that hides the on-screen piano so the student reads from the staff only"
effort: "trivial"
status: "built: every visit starts with the keyboard hidden, a toolbar switch on the settings screen shows it for the visit (d099); real EZ-220 with it hidden open (Human)"
completeness: 95
depends_on: ["ft_0_16"]
---

# ft_Y_12: Hide the on-screen keyboard

The on-screen piano is hidden so the student reads from the staff and the screen is less busy (the staff is the main view). Index: [FEATURES.md](FEATURES.md).

## Rules

1. Every visit starts with the on-screen keyboard hidden, with or without a piano (d099). It is a developer's tool: `?keys=1` shows it from the start.
2. The switch (a keys picture, lit in a gold ring while shown, dim while hidden) is on the settings screen's toolbar only, at its right end where other screens have the settings gear (d088). Its choice lasts for the visit on every screen and is not saved.
3. Hidden means no screen draws the keyboard (`src/main.ts` sets `display: none` on the piano element) and the game takes its height, as when a piano is connected. The canvas also grows when a piano connects after the page loaded. The EZ-220, QWERTY keys and the virtual player keep working.
4. Without a piano the practice screen says "Use the computer keyboard" while the keys are hidden.
5. The saved setting `settings.keyboard = { onScreen }` (profile v9, default on, migration 8 to 9, d054) is still in the save but drives nothing. Open for the maintainer: remove it or keep it for a later rule.
6. Tests: `tests/e2e/onscreen-keyboard.spec.ts` (AC1 to AC4, AC2 at 1366x768, 1280x720, 1024x600), `tests/e2e/toolbar.spec.ts` (switch on the settings screen only, `?keys=1`), `src/core/layout/frame.test.ts`, migration and per-player unit tests (`migrate.test.ts`, `profile.test.ts`, `tests/progression/profile-service.test.ts`), a screenshot in `visual.spec.ts`.
7. Not verified (needs human): the real EZ-220 with the keyboard hidden and hotplug; the Windows baselines `practice-keyboard-hidden-1366x768-chromium.png` and the settings screenshot; how a student without the EZ-220 finds the keys again.

## Acceptance criteria

- **ft_Y_12.AC1** With the keyboard hidden no on-screen keyboard is drawn on any screen; shown, the screen is unchanged.
- **ft_Y_12.AC2** With the keyboard hidden the game takes its height: the staff fits, is no smaller than with the keyboard shown, and nothing overlaps at 1366x768, 1280x720 and 1024x600 (Off frees the space).
- **ft_Y_12.AC3** The switch's choice holds on every screen for the visit (d099); the saved setting survives a reload and is separate per player.
- **ft_Y_12.AC4** The virtual player still plays a piece to the results screen with the keyboard hidden.
