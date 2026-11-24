---
id: "core_10"
title: "Practice analysis"
scope: "A per-bar practice log, the Analyze screen: bar heat gradient, progress graph, the 3 weakest sections with a start tempo and ramp"
effort: "large"
status: "built: log (v16), recorder, pure analysis, recording and the Analyze screen; numbers provisional"
completeness: 85
---
# core_10: Practice analysis

Release R2. Decision: [d092](../decisions/saves.md#d092). Next to core_03 and core_04. Code: `core/progression/practiceLog.ts`, `recordBars.ts`, `core/analysis/barHeat.ts`, `sectionPlan.ts`, `core/layout/analyzeLayout.ts`, `game/AnalyzeScene.ts` (the Analyze button beside Free play), `game/practice/BarRecorder.ts`, `ProfileService.recordBarPlays`.

The practice screen's **Analyze** button shows, for the piece being practised, where it goes wrong and what to do about it.

## Rules

1. **Bar heat:** a colour gradient over the staff, bar by bar, from how well each bar has been played. Warm reds with Kiur's friendly "!!!" for tricky spots; never a cross or a count of mistakes on the staff.
2. **Progress graph:** per bar, how it was played over time against the ideal. AX-3 provisional: the ideal is the piece's own tempo with every note right on the first try (no data in the piece maker; a hand-drawn curve may come later as an optional meta field).
3. **The 3 weakest sections:** highlighted, each with a proposed practice session: a section with a proposed starting tempo from how it was played (first-try accuracy and timing) and a tempo ramp (core_03.AC5) towards the piece's tempo.
4. **One store:** every bar of every play is logged (`profile.practice`, save v16). Section plays never count towards the piece stats. Heat decays with recent clean plays, so a spot cools down by itself. Part stars (core_06, slice B) read the same log.

## Acceptance criteria

- **core_10.AC1** A finished play (whole piece or section, Wait or Tempo mode) adds one entry per bar to the practice log, with the misses by musical address; the log survives a reload.
- **core_10.AC2** Section plays carry their bar range and never change the piece stats of core_04.
- **core_10.AC3** A v15 save migrates to v16 with an empty log (frozen step fixture), and a v16 save round-trips.
- **core_10.AC4** The log keeps at most `MAX_BAR_PLAYS_PER_PIECE` entries per piece, dropping the oldest.
- **core_10.AC5** Heat per bar is a pure function of the log; clean recent plays cool a bar down (unit and property tests).
- **core_10.AC6** The 3 weakest sections are a pure function of the heat; a piece played cleanly has none.
- **core_10.AC7** The proposed start tempo is a pure function of the section's plays, never above the piece's tempo.
- **core_10.AC8** The Analyze button opens the screen with the heat gradient, the graph and the weakest sections; a piece not played yet shows its plain staff with no line of text.

## TODO

- TODO(builder, R2): Analyze follow-ups: a long piece opens on the page of the chosen section with a "page N of M" label; Back keeps the section and tempo the student had set; the Estonian wording of the `analyze.*` strings goes to the maintainer through the `write-ui-text` skill.
