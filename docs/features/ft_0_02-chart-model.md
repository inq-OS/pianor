---
id: "ft_0_02"
title: "Chart model and schemas"
scope: "Chart types and zod schemas, spelled pitch, tempo/meter/key maps, migrations"
effort: "done"
status: "done"
completeness: 100
---
# ft_0_02: Chart model and schemas (core)

Done. Index: [FEATURES.md](FEATURES.md).

## Rules

`src/core/chart/`: types and zod schemas for Chart, Bar, Phrase, Note (480 ppq), piece meta, level definition, following `docs/authoring/au03-chart-format.md` and `docs/futureproofing.md` 1.1: `schemaVersion`, spelled pitch plus MIDI, tempo/meter/key maps, `tracks[]` with roles, voices, ties, optional finger and text. Helper functions: tick/bar conversion, pitch to staff position (clef-aware), pitch naming. Include the migration mechanism and a fixture for version 1.
## Acceptance criteria

- **ft_0_02.AC1** The chart model is pure TypeScript with no DOM imports.
- **ft_0_02.AC2** Unit and property tests cover tick math and staff positions for treble and bass (middle C on the first ledger line below treble).
- **ft_0_02.AC3** The schema rejects malformed data, and C# and Db round-trip with different staff positions.
- **ft_0_02.AC4** A test loads a fixture with an older `schemaVersion` and migrates it.
