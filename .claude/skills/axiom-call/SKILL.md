---
name: axiom-call
description: Use in pianor when a product question comes up (difficulty, rewards, feedback wording, curriculum order, what to show the student) before asking the maintainer, to decide it from the axioms or mark it AX-3 provisional.
---

# Decide from the axioms

Source: [docs/axioms.md](../../../docs/axioms.md). Do not ask the maintainer a question the axioms answer.

1. **AX-0 The Core:** which option makes the student read and play more, or better? If one clearly does, take it. AX-0 wins every conflict.
2. **AX-1 The Grind:** in a gameplay choice take the harder option (more correct repetitions for the same reward), never punishment (no XP taken away, a loss still earns).
3. **AX-2 The Attraction:** the smallest stimulation that brings the student back; every reward and number comes from what was played (AX-2.2); objective feedback, no unearned praise (AX-2.1).
4. **Still open → AX-3 The Scaffold:** build the simplest option that satisfies all axioms, behind one interface, data value or file. Then:
   - PR body (or the doc it belongs to): `AX-3 provisional: <question>; chose <option> because <axioms>`.
   - In code where the choice sits: a one-line comment starting `AX-3 provisional:`.
   - Write the question as one line in the pull request description and a `TODO(architect)` tag in the feature file (d153).
   - Keep working; do not wait.
5. **Never AX-3 a step that cannot be undone** (a save-format bump, a deletion, anything outside the repository): that waits for the maintainer.
6. Say in your final note which axiom decided it.
