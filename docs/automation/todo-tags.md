# Work tags in the docs

How agents keep track of work without GitHub issues (d116). GitHub issues are for people: the maintainer files bugs, features and change requests there. Everything the agents note for themselves or for each other lives **once**, as a tag in the doc the work belongs to, so nothing is kept in sync in two places.

## The tags

One line each, at the start of a list item or paragraph:

```
TAG(<who>[, <release>]): <what to do, in one or two sentences>. <why, or a link>
```

| Tag | Meaning | Taken |
|---|---|---|
| `ASAP` | Breaks something now (main is red, the student is stuck, a wrong rule spreads) | Before anything else of that project, issues included |
| `TODO` | Planned work: a slice of a feature, a bug, a chore, a follow-up | In release order, after the project's issues of the same release |
| `NEEDS-HUMAN` | Waits on the maintainer: the real EZ-220, a verdict on a picture, a product answer the axioms do not settle | Never by an agent; the maintainer answers in a chat or an issue |
| `IDEA` | Not planned; worth keeping | Only after the architect or the maintainer turns it into a `TODO` |

- `<who>` is `builder` (code, content, tools, CI), `painter` (how a screen looks), `architect` (direction, docs); `NEEDS-HUMAN: ...` names no one, since only the maintainer answers it (d153).
- `<release>` is the roadmap tag: `R1` to `R5` or `Later`, the same releases as the issue milestones ([roadmap.md](../architect/roadmap.md)). Write it on every `TODO` so one grep lists a release's work; left out, the item takes the release of the feature or doc it sits in.
- Two older tags keep their meaning: `KERI-TODO` (a fact about Keri only the maintainer can tell; never invent it) and `AX-3 provisional:` (a choice made under AX-3, to be reviewed; [axioms.md](../axioms.md)).


Examples:

```
- TODO(builder, R2): the following clock's waits kept per bar in the practice log.
- ASAP(builder): `tests/e2e/autoplay.spec.ts` "clean tempo" times out on main in cloud sessions.
- NEEDS-HUMAN: does a key lit with channel volume 0 stay silent on the EZ-220? Spike button: `npm run spike`.
```

## Where a tag lives

In exactly one Markdown file under `docs/`, the one closest to the work, so whoever reads about the thing also sees what is left:

1. **A feature's work:** its file in `docs/features/`, under a `## TODO` heading (or next to the acceptance criterion it is about). Scope and acceptance criteria stay in their own sections; the TODO says what is not built yet.
2. **A bug or chore in an area:** the doc of that area (`docs/architecture.md`, `docs/testing.md`, `docs/art-direction.md`, `docs/keri/<picture>.md`, a decision's consequence line, ...), under `## TODO`.
3. **Anything else the architect finds:** the doc closest to it, or [roadmap.md](../architect/roadmap.md).
4. **A project's own notes and plans:** `projects/<project>/` is that project's own folder and may hold its tags (the painter's `notes/`, any project's `plans/`).

Not in code comments (a comment may point to the doc), not in an issue, not in a pull request body only.

## Finding work

From the repository root on the current `main`:

```
git grep -n -E "\b(ASAP|TODO|IDEA)\(|\bNEEDS-HUMAN:" -- docs projects   # every tag
git grep -n -E "\b(ASAP|TODO)\(builder" -- docs projects            # one project's work
git grep -n -E "\bASAP\(" -- docs projects                          # what is burning
git grep -n -E "\b(ASAP|TODO)\([^)]*\bR2\)" -- docs projects   # one release
```

`git grep` searches the files git tracks (like `grep -r`, but it skips `node_modules/` and build output); `-E` turns on the `( | )` pattern syntax, `-n` prints line numbers.

Each project, at the start of a session: the week's goal at the top of [roadmap.md](../architect/roadmap.md), its `ASAP` tags, the maintainer's open issues (the builder), then its `TODO` tags in release order.

## When it is done

The pull request that does the work **deletes the tag line** and updates what the doc says is built: a feature's `status`, `completeness` and acceptance criteria. Never strike a done item through or leave a "done" note.

## Issues still have a place

- The maintainer files issues; the builder takes them directly (the painter those about how a screen looks). The building project writes its plan into the docs (a feature file or a `TODO` there), never into issue comments, and the pull request says `Closes #N`.
- An agent opens an issue only when the maintainer says so, or for a bug it found whose fix is not trivial and cannot be done in the work at hand ([file-issue skill](../../.claude/skills/file-issue/SKILL.md)). Everything else is a tag.
- The builder and the painter talk through a tag in the feature file or a line in the pull request; there are no mailboxes (d153).

## TODO

- TODO(builder, R2): a `todo` script in `package.json` (`npm run` plus `todo [project]`) that lists the tags by project and release, and a `docs:check` rule that every tag has a known `<who>` and release. Changes `package.json`, so the maintainer merges it.
