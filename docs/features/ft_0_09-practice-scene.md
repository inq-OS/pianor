---
id: "ft_0_09"
title: "Practice scene"
scope: "Practice screen, results and stars, end-to-end tests"
effort: "done"
status: "done; playtest open (Human)"
completeness: 100
---
# ft_0_09: Practice scene

Index: [FEATURES.md](FEATURES.md).

Pick a piece, play it in Wait mode with the staff on a mock or real keyboard, gentle feedback, a results screen with stars (combines ft_0_05 to ft_0_08). Built in two slices, ft_0_09a (thin slice: one chart, staff, Wait mode, no audio; d013) and ft_0_09b (audio, results, full flow; d017). The real-keyboard playtest is open.

## Acceptance criteria

- **ft_0_09.AC1** A Playwright test plays a whole piece with the mock keyboard and checks the results screen.
- **ft_0_09.AC2** A screenshot test covers the staff at two sizes.
- **ft_0_09.AC3** Hints (note names, finger numbers) toggle and are recorded in results.
- **ft_0_09.AC4** A real-keyboard session with the student, written up as a session file in `docs/playtests/`. [human]
