## What and why

<!-- One or two sentences. Link the feature file (docs/features/<id>-name.md). -->

## Issue

<!-- Write `Closes #N` when this PR finishes the issue, or `Part of #N` when it does not. GitHub ignores a (#N) in the title. -->

## Checklist

- [ ] The feature file's acceptance criteria are met, and its status line says what was done and what was not verified
- [ ] Tests for new rules (core and tools: written first); `npm run typecheck && npm run lint && npm test` pass
- [ ] Docs touched by the change are updated, or this description says `docs: n/a` and why
- [ ] `npm run docs:index` run if a feature, decision, authoring or playtest file was added or its front matter changed
- [ ] A decision file (and its front matter) if this touches something in `docs/futureproofing.md`
- [ ] Anything about the EZ-220 is marked "needs human", not verified
