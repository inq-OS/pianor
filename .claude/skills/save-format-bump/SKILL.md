---
name: save-format-bump
description: Use before changing anything pianor saves or loads (the player profile, settings, campaign, chart or piece meta format), to avoid a bump if possible, or bump schemaVersion with a frozen, golden-tested migration.
---

# Change a saved format

The player's save holds a student's real progress; a broken migration loses it. Rules: [d069](../../../docs/decisions/saves.md#d069) (one bump per round), [d064](../../../docs/decisions/saves.md#d064) (frozen values), CLAUDE.md (every format has `schemaVersion` and a tested migration).

1. **Avoid the bump first (d069.3).** A new optional field with a default that old saves read correctly needs no new version. Prefer that.
2. **Check the round.** Search open PRs for `[save]`. If one is open and its version has not reached any player's saves yet, add your fields to its version and migration step; do not take the next number.
3. **Bump:** raise `PROFILE_SCHEMA_VERSION` (`src/core/progression/profile.ts`, or the format's own constant), extend the zod schema, add one step in `migrate.ts`.
4. **Frozen values (d064):** the step writes literal values, never today's defaults or imported constants that can change later.
5. **Tests, written first:** a fixture `tests/fixtures/saves/profile.vN.json`, its expected output in `tests/fixtures/saves/steps/`, the golden test in `migrate.golden.test.ts`, and a round trip through `migrate.test.ts`. Never edit a released step's golden file; add a new version instead.
6. **Announce:** PR title starts `[save]`, the builder owns it, a fresh `reviewer` agent run on its head says `VERDICT: APPROVE` and CI is green with the end-to-end tests (`ci:e2e`), then the thread merges it (d166, `docs/architect/labels.md`). A change to a seam in `docs/futureproofing.md` also needs a decision (`log-decision` skill).
7. **Never** an AX-3 provisional choice here; a save change that is unclear gets `needs:maintainer` and waits for the maintainer.
