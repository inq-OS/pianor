---
id: "ft_0_12"
title: "Generators and agent composing"
scope: "Five seeded generators, regeneration, the agent prompt"
effort: "done"
status: "done"
completeness: 100
---
# ft_0_12: Generators and AI-composition loop

Seeded generators in `tools/generate/` (five-finger, scale, reading-drill, echo, phrase) and a repeatable agent prompt for composing original pieces with the lint-fix loop (`docs/authoring/au06-generators.md`, `au07-agent-composing.md`). `npm run piece:generate`; regeneration is byte-identical; a generator refuses to repeat eight notes of any hand-written piece. Rhythm drills are not built. Eighth notes are used at level 5 only.

## Acceptance criteria

- **ft_0_12.AC1** The same seed gives identical output.
- **ft_0_12.AC2** Generated pieces pass `piece:lint`.
- **ft_0_12.AC3** No generator copies existing melodies.
