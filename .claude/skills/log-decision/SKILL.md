---
name: log-decision
description: Use when pianor needs a decision file (a change to a seam in docs/futureproofing.md, an answer from the maintainer, or a choice a later reader would ask about), to add dNNN correctly and update the indexes.
---

# Log a decision

Rules: [DECISIONS.md](../../../docs/decisions/DECISIONS.md) (top), [d041](../../../docs/decisions/workflow.md#d041).

1. **Need one?** Yes for: anything listed in `docs/futureproofing.md`, the maintainer's answer to a product question, a choice a later reader would ask "why?" about. No for a plain implementation detail (that goes in the PR).
2. **Number:** `git fetch origin main` and take the next free `dNNN` from the ledgers in `docs/decisions/` on `origin/main` (`grep -ho '^## d[0-9]*' docs/decisions/*.md | sort | tail -1`) **and** open PRs (search PRs for `d0NN`); two PRs with the same number conflict.
3. **Entry** at the end of the ledger of its area in `docs/decisions/` (stack, saves, notation, play, game, art, workflow; d152):
   ```markdown
   ## dNNN

   **The decision in one sentence.** Features: ft_0_08 (or none). Supersedes dXXX.

   One to four sentences: the rule, the values a builder needs, the one-clause why. No story, no "given up" list, no quote of a person and nothing personal: an answer becomes a plain rule, with no date and no word on who asked for it (d165).
   ```
   The rule itself also goes into the doc of its area (feature file, architecture, art direction); the entry says why (the dNNN order says which is newer). A decision that changes an older one edits that entry to say what still holds and "Changed by dNNN." (or adds "Superseded by dNNN." / "Retired." to its first line).
4. **The maintainer's answer?** If it generalises (a `new rule`), add a `TODO(architect)` tag in `docs/axioms.md` to propose the corollary.
5. Update docs that the decision changes (CLAUDE.md "Stack", a feature file) and point them to `dNNN`.
6. `npm run docs:index` (never edit the index table by hand), then `npm run docs:check`.
