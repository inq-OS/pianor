---
id: "au07"
summary: "Composing with an agent: the prompt and the lint-fix loop"
---
# au07: Composing with an agent: a repeatable prompt and the lint-fix loop

Part of [piece authoring](AUTHORING.md).

Use this for a piece with more character than a generator makes. The agent works from the level table and the linter, never hears the piece, and never approves it: a person reviews it in the preview tool (`docs/authoring/au09-preview-tool.md`).

Prompt (fill in the brackets):

> You are composing one short original piece for a young piano beginner in the Pianor project.
>
> Level: [N]. Read its row in `content/curriculum/levels.json` and obey every limit in it: hands, clefs, range, note values, rests, meters, `maxLeapSteps`, bars and the fingerings (the hand position). The linter enforces them. Theme: [for instance rain on a window]. Length: [4 or 8] bars.
>
> Write `content/pieces/<id>/piece.abc` and `piece.meta.json` as described in `docs/authoring/au01-piece-files.md` and `docs/authoring/au02-abc-subset.md` (the subset: key of C, one meter, whole bars; whole, half and quarter notes, and eighths only where the level allows them, in pairs on a beat; fingerings as `!1!C`). The folder name is the piece id (lowercase words joined by dashes).
>
> Compose like this: a short motif of two to four notes; repeat it and vary it; mostly steps with a few skips only where the level allows; at most two identical bars in a row; some variety in the rhythm; two phrases of two to four bars; end on the tonic (C) with a long note. Do not imitate any existing melody, however simplified: no nursery rhymes, folk tunes or songs you know. Original only.
>
> Meta: `status` is `"draft"`; `hands`; `phrases` (1-based bars, two to eight bars each); `tags`; `source` is `"composed by an AI agent ([model name]) for Pianor; original"`; `license` is `"CC0-1.0"`; `generator` is `{ "kind": "ai", "params": { "model": "[model name]", "theme": "[theme]", "prompt": "docs/authoring/au07-agent-composing.md" } }`.
>
> Then loop: run `npm run piece:lint`. Every line has the form `file:line:column severity: message [rule]`. Fix every error, and every warning that is not musically right to keep, and run it again, until there are no errors. Then run `npm run piece:build`. Stop there. Never set `status` to `"approved"`, and never open or change other pieces. Report the piece id, the theme, and each remaining warning with a one-line reason.

The loop is the same for a person writing by hand. A few things the linter says that are easy to miss: a leap is counted in steps of the scale (a third is 2), the left hand's hand position is C3 to G3, a whole-bar rest is `Z`, and a voice ends on C or the `no-cadence` warning asks for a reason. Run `npm run piece:preview` to listen and play along before approving.
