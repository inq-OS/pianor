---
name: file-issue
description: Use in pianor when a person tells you to file an issue ("file it", "create an issue"), or you found a bug whose fix is not trivial and cannot be done in the work at hand; anything else you find becomes a TODO tag in the docs.
---

# File an issue

Issues are for people (d116). Open one only when a person tells you to ("file it", "create an issue"), or for a bug you found whose fix is not trivial and cannot be done in the work at hand. Everything else (small bugs, chores, follow-ups, ideas, questions for another project) is a tag in the doc it belongs to: `TODO(<project>, <release>): ...` and the others in [todo-tags.md](../../../docs/automation/todo-tags.md). Skip typos, lint noise, and failures you fixed in the same step.

When an issue is right, do this before you finish. In a Claude Code cloud session `gh issue` fails (GitHub GraphQL is blocked): use the GitHub tools or `gh api` (REST) for each step instead.

1. Search for an existing one first: `gh issue list --state all --search "<keywords>"`. If one matches, add your finding with `gh issue comment <n> --body "<finding>"` and do not open a duplicate.
2. Also search the docs: `git grep -n -E "\b(ASAP|TODO|IDEA)\(" -- docs projects`. If a tag already plans it, name its file in the issue and do not copy the plan. Otherwise create it: `gh issue create --title "<short description>" --body "<what found, desired>" --label <labels>`. The body has two parts: what you found (with repro steps and the virtual device or test used) and what you want instead. No plan: the project that builds it writes the plan into the feature file. Say when a finding is only observable on the real EZ-220 and mark it "needs human".
3. Release: add the milestone the roadmap gives its feature (`docs/architect/roadmap.md`; `--milestone "<title>"`, or `-F milestone=<number>` with `gh api`); if none fits, leave it out.
4. Labels: `bug` for broken behaviour, `accessibility` when a player cannot play or read something, `documentation` for misleading docs, `improvement` for a working but unintuitive design. Add more than one when two apply.
5. Never put child data in an issue: no profile names, saved progress, recordings or screenshots of a real player.
6. Give the issue number and link in your final message, and say which ones you filed and which you commented on.
