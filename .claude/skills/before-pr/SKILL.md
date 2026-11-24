---
name: before-pr
description: Use before you push and open or update a pull request in pianor, or say a task is done, to run the right checks and fill the PR so it can merge on the first try.
---

# Before a pull request

Definition of done: CLAUDE.md. Details: [docs/testing.md](../../../docs/testing.md) sections 9 and 10, [labels.md](../../../docs/architect/labels.md).

1. **Up to date:** `git fetch origin main` and merge or rebase your own branch onto it.
2. **Fast checks:** `npm run check`. Do not run `npm run check:ci` first: CI runs it on the push in about 4 minutes and the merge waits for it anyway (d217); on a red CI job, run only that job's command locally while fixing it.
3. **End-to-end**, if the game changed: `npm run test:e2e:affected` as one background task (never at the same time as unit tests). Rerun a failing test alone before blaming the code.
4. **Tests that must exist:**
   - every acceptance criterion you built has a test naming it (`ft_0_08.AC1`); `npm run docs:criteria` lists gaps;
   - every issue that changed behaviour has a test whose title names the behaviour (never the issue number), seen failing first for a bug;
   - `core` and `tools` changes were test-first.
5. **Docs:** a change to `src/core`, `tools` or `content/curriculum` touches a doc, or the PR body says `docs: n/a` and why (`npm run docs:touched -- origin/main`). A feature's `status` and `completeness` move with what you built (`docs/features/FEATURES.md`), then `npm run docs:index`.
6. **Issue and tag status:** a title mention like `(#N)` does nothing on GitHub. In the PR body write `Closes #N` when the PR finishes the issue, otherwise `Part of #N`; what is left goes into the feature file as a `TODO` tag, not into an issue comment (d116). When the last part merges, close the issue. Delete every tag line (`TODO`, `ASAP`, ...) the PR does ([todo-tags.md](../../../docs/automation/todo-tags.md)).
7. **Checks for the maintainer:** anything you would ask the maintainer to look at or run (a changed screen, a `visual` run): run what you can yourself, put the result and screenshots in the PR, and list the rest under what was not verified.
8. **PR body:** follow `.github/pull_request_template.md`; say what was **not** verified (real EZ-220 = "needs human"; screenshot baselines when a screen changed); list any `AX-3 provisional:` choices; `[save]` in the title for a save bump. A change to a ledger entry (`docs/decisions/*.md`) carries the line `Ledger: asked by the maintainer in this session.`, and only when the maintainer did ask (d165).
9. **Surprises** found on the way: fix them, or a `TODO` tag in their doc; an issue only by the `file-issue` skill's rule.
10. **Review, then merge** by the rules in `docs/architect/labels.md` (Merging): start one fresh `reviewer` agent on the head of every code pull request and fix its findings; merge your own once it says `VERDICT: APPROVE` and CI is green on that head. `[save]` pull requests merge the same way, and only once the end-to-end tests (`ci:e2e`) are green too (d166); sensitive paths and pictures: the maintainer merges (`needs:maintainer`). Never touch an `architect:blocker` item.
