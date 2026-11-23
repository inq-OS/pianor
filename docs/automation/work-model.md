# How we work (lean, d153)

The measure of every week is what the student plays, not what the process produces (AX-0).

## Three roles

| Who | Does | Never |
|---|---|---|
| **Builder** | Builds a feature top to bottom: core rules, content, screen, tests, in small pull requests on `main`. Takes the maintainer's issues directly. Owns the code, the tools and CI | Splits a feature with another project, writes plans for others |
| **Painter** | How every screen looks: pictures, the kit, sprites, panels; its own taste loop with the maintainer | Changes what a screen does |
| **Architect** (one thread a week) | Picks the week's goal, guards the axioms, answers design questions, deletes what nobody used | Writes work packages, process, routines or reviews nobody asked for |

## The week

1. **One goal, in play terms** ("the student can win a tug against Puuvaim"), written at the top of [roadmap.md](../architect/roadmap.md) by the architect. The builder and the painter work toward it.
2. **Playtest notes steer the next goal:** three lines, what worked, what bored, what broke, kept in the gitignored `private/playtests/` (never committed).
3. **Work items** are tags in the doc they belong to: `TODO(builder)`, `TODO(painter)`, `NEEDS-HUMAN` ([todo-tags.md](todo-tags.md)). The maintainer's issues are taken as they are; no triage, no dispatch labels. A part of a feature is named by its feature id and slice (d275).
4. **Builder and painter talk through the code**: a tag in the feature file, or a line in the pull request. No mailboxes.

## Rules that stay

The axioms, CLAUDE.md, a feature file with acceptance criteria for each feature, tests and CI, the decision ledgers (one short entry when something a later reader would ask "why?" about is decided), docs-only pull requests merged without asking, a fresh `reviewer` agent on every code pull request before it merges, save-format changes merged by the thread only after the reviewer approves and CI with the end-to-end tests is green (d166), sensitive paths (`.github/`, `.claude/`, `CLAUDE.md`, package files) merged by the maintainer ([labels.md](../architect/labels.md)).

## Process is added only when it hurts

A process step, doc, routine or label is added only after the same thing broke twice, and then as a test or a script when it can be. Once a month the architect deletes what nobody read or used in that month; git keeps it.
