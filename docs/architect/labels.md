# Labels and merge rules

Since d153: no dispatch labels, no triage, no release labels. The builder takes the maintainer's issues directly; milestones R1 to R5 and `Later pool` stay as the maintainer sets them ([roadmap.md](roadmap.md)).

## Labels

| Label | Meaning |
|---|---|
| `architect:blocker` | Stop: continuing would lock in something hard to undo; a comment says why. No agent works on, pushes to or merges the item until the **maintainer** removes the label |
| `needs:maintainer` | The pull request waits on the maintainer's look or answer; whoever added it takes it off after |
| `ci:e2e`, `ci:visual` | Run the Linux end-to-end tests or the Windows screenshot tests on the pull request |

## Merging

Waiting on the maintainer: [pull requests with `needs:maintainer`](https://github.com/inq-OS/pianor/pulls?q=is%3Aopen+label%3Aneeds%3Amaintainer) and the `NEEDS-HUMAN` tags (`git grep -n "NEEDS-HUMAN" -- docs projects`).


- **Docs only** (`docs/`, `projects/`; no code, content, `.github/`, `.claude/`, `CLAUDE.md` or package files): the agent driving it merges once `npm run docs:check` passes, and tells the maintainer in one line.
- **Code:** every code pull request gets a second reader: the builder starts one fresh `reviewer` agent (`.claude/agents/reviewer.md`) on its head and fixes what it finds (a new head gets a new run). It merges once the last run says `VERDICT: APPROVE`, CI is green on that head and no review thread is open.
- **Save changes** (`[save]` in the title, the `save-format-bump` skill): a student's saved progress is at stake, so it merges only after a fresh `reviewer` run says `VERDICT: APPROVE` and CI is green with the end-to-end tests (`ci:e2e`); then the thread merges it (d166).
- **Pictures** (a painter pull request): the maintainer merges; art is taste, a green check is not a verdict.
- **Sensitive paths** (`.github/`, `.claude/`, `CLAUDE.md`, `package.json`, `package-lock.json`): the maintainer merges.
