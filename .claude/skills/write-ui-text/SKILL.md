---
name: write-ui-text
description: Use whenever you add or change any text the player sees in pianor (labels, buttons, feedback, results, hints), so it goes through string keys, has Estonian, and keeps objective wording.
---

# Write UI text

Rules: CLAUDE.md (string keys), [d081](../../../docs/decisions/game.md#d081), [d086](../../../docs/decisions/art.md#d086), [AX-2.1](../../../docs/axioms.md).

1. **Never a literal in a scene or in art.** Add a key to `src/core/text/strings.ts` (English, the source of keys) and call `t('area.name', { param })`. Placeholders are `{name}`; a word that follows a count is `{name|one|other}` ("1 note", "3 notes"; in Estonian too: "1 noot", "3 nooti"). English is in US spelling (practice, color, harbor; `strings.test.ts` checks the common ones); keys and code names may stay as they are.
2. **Add the Estonian** in `src/core/text/strings.et.ts` in the same change; it is typed `Record<StringKey, string>`, so a missing key fails the typecheck. Estonian is the default language. If you are unsure of a word, write your best plain Estonian and say so in the PR; never leave the English there.
3. **Case:** write sentence case in both catalogs. `displayText` at the render boundary (`PixelText`) turns Estonian into small capitals (d086); do not type capitals yourself. `keepCase` needs a reason in code.
4. **Wording for a young student (AX-2.1, d312):** while the student plays (practice, learning, tug, teaching) write no sentence: a count is `3/4`, a judgement is a mark on the note (octave, neighbour, letter, early, late), a turn or a start is motion or an icon. Elsewhere say what happened, short and concrete; a symbol beats a word wherever one reads at a glance. No praise without a basis in what was played, no shaming words. A bigger moment only for a real milestone.
5. **Fit:** labels are drawn in the pixel font on a canvas of 320 x 180 layout cells (640 x 360 fine pixels, d110); check the longer of the two languages fits (Estonian is often longer). Prefer an icon plus a short word over a long label.
6. **Tests** run in English (`tools/test/englishText.ts`); a test of Estonian text sets the language itself. A screen change moves screenshot baselines: make them again and say so in the PR.
