---
id: "ft_0_00"
title: "Scaffold"
scope: "Repo, toolchain, CI, boundary lint, config object, string keys"
effort: "done"
status: "done"
completeness: 100
---
# ft_0_00: Scaffold

Done. Index: [FEATURES.md](FEATURES.md).

## Rules

Create the repo: TypeScript strict, Vite, Phaser 3, Vitest, ESLint, zod, folder layout from `docs/architecture.md`, npm scripts from `CLAUDE.md` (stubs allowed for `piece:*`), CI running typecheck, lint and tests. Add `docs/dependencies.md` and `docs/hardware-notes.md` (empty templates). Verify current Phaser and Vite versions before pinning. Also create: a single config object (feature flags, theme and scale settings) and a string-key text module, so no UI text is hardcoded (see `docs/futureproofing.md`).
Set up Vitest, golden and replay folders, and the boundary lint rules (core may not import Phaser, DOM, Web MIDI or Web Audio). Property tests (fast-check) and the Playwright smoke test are added later (ft_0_02 and ft_0_09); **ask** before adding either and record licences in `docs/dependencies.md`.
## Acceptance criteria

- **ft_0_00.AC1** `npm run dev` shows an empty Phaser scene (and, later, the game). [human]
- **ft_0_00.AC2** All checks run in CI: typecheck, lint, tests, piece build and lint, build, end-to-end.
- **ft_0_00.AC3** A deliberate forbidden import in `src/core` fails lint.
- **ft_0_00.AC4** The layout matches the architecture doc, the licence file is present and the decision log exists. [human]
