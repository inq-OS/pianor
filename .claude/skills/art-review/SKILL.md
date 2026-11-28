---
name: art-review
description: Use in pianor before showing the maintainer a painted pass and when a painter pull request is opened or updated (or when the maintainer asks for an art review), to have a fresh reviewer gauge the pictures against the MI2 atlas and the art direction and post one advisory review.
---

# Art review

Code gets a review from someone who did not write it; so do pictures. Art reviews are held like code reviews and use the atlas. The format is **advisory**, a fresh reviewer, one review comment on the pull request; only the copy guard can stop a merge.

The reviewer is the `art-reviewer` agent (`.claude/agents/art-reviewer.md`). It did not paint the pictures and is not told what the painter thinks of them. The measuring is study-a-picture's atlas (`refcat.py`, section 9 of that skill); the taste is the art direction, written in `docs/art-direction.md` and the painter's memory (about 70 percent MI2, never realistic, quirk is good, Keri's real layout kept).

## When

- Before a pass is shown to the maintainer (`paint-a-scene` section 4): the review goes beside the pictures, so the maintainer sees what the numbers and a second pair of eyes say.
- When a painter pull request is opened, and again when a push changes its pictures.
- When the maintainer asks for one, in any painter thread (an art review of a numbered pull request).

Not for: a mock-up of one small thing, a pull request that changes no picture.

## 1. Pictures

One PNG per picture and hour, in a local review folder (never in git, because the sheets carry MI2 pictures):

```
private/painter/<scene>/review-<n>/
```

- Painted Keri pictures: `npm run art:render -- <picture> <hour> <file> 2` for each hour the picture has.
- The picture in the game: one screenshot per hour as the pass already makes them (the scene's shoot script), so the band and the pointer are judged too.
- A screen that is not a place picture (a list, a staff screen): a screenshot of it; the gauge then counts for little, say `indoor` in its tags.

Write a `request.md` in the folder: the pull request (number and head SHA) or "pass <n>, no PR", the Keri place, where the reference photographs of it are, the scene's file under `docs/keri/`, and **what has been decided about this scene, as plain rules with no date** (from the thread, the scene's file under `docs/keri/`, art-direction section 8). These decisions are facts about Keri and the art direction: a tower that was decided is on Keri even when no photograph shows it, and without them the reviewer flags decided things as inventions (the trial review of the docks did). **Nothing about what you think of the pictures.**

## 1b. The light review: a small change

For a small change (`paint-a-scene` section 0: one thing in a picture already shown, `art:diff` under a quarter of the picture at every hour), the review looks only at the change:

- The folder holds the `art:diff` sheet (`test-logs/art/<picture>-diff.png`, copied in) and `request.md` with the pull request or pass, the picture, the thing changed and its artist's note, what `art:diff` printed, and the decided rules about that thing. No renders of the whole picture, no screenshots.
- Start the reviewer with `model: "sonnet"`, `effort: "medium"` and the prompt "light review: read request.md". It reads the note and the rules it names, opens only the diff sheet, and writes a `review.md` of at most 20 lines.
- **The gauge and the copy guard still run** (`review.py`, section 3, by the thread before starting the reviewer): the script is cheap and keeps d122 whole, also for a drift of many small changes. The reviewer reads `gauge.md`'s numbers and opens no `beside-*.png`; those sheets go to the maintainer (d228).
- The review still gives one of the three verdicts and the five headings (d122), a heading with nothing to note saying so in one line.

A light review costs about a tenth of a full one: a Sonnet run that opens one sheet of a few hundred tokens and reads two pages and the gauge's table, against an Opus run that reads the art direction, the atlas notes and the photographs and opens every hour at full size.

## 2. Start the reviewer

Agent tool, `subagent_type: "art-reviewer"`, in the background. The prompt is the review folder's path and "read request.md".

It runs the gauge and the copy guard itself (section 3), looks at every picture, and writes `review.md` in the folder.

## 3. The gauge and the copy guard

```
python3 .claude/skills/art-review/review.py <review folder> <picture>[=tag,tag] ...
```

For each picture: the atlas gauge against the MI2 rooms of its setting and hour (tags from the file name when none are given: `outdoor` plus the hour), the traits outside the MI2 range, the 3 nearest rooms, and `beside-<name>.png` (ours over those rooms, with the gauge). Writes `gauge.md` (the table for the comment) and `gauge.json`.

**Copy guard:** `refcat.py check` dHash distance from each picture to every MI2 picture in the library and every other game picture in the catalogue (catalogue kind `game-1990s`). `near` (10 or less) or `exact` **blocks the merge**, and the script exits 2. `loose` (11 to 18) is noted for the reviewer to look at side by side; a loose hit on a different subject is chance.

Until the maintainer answers the calibration sheet, the score is uncalibrated: MI2 rooms read about 100, our passes 48 to 80. Read the traits more than the score.

## 4. Post

1. **On the pull request:** one comment-type review on the head SHA with the body of `review.md` and the footer below. GitHub MCP `pull_request_review_write` (method `create`, event `COMMENT`, `commitID` the head SHA, the body). Never approve or request changes: the verdict is advice.
2. **In the thread:** the verdict line, the main thing to change, and the `beside-*.png` sheets attached, with the pictures of the pass.
3. **Copy guard blocks:** say so first in both places; the pull request does not merge until a repaint clears it.

Footer, at the end of every review body:

```

---
_Generated by [Claude Code](https://claude.ai/code)_
```

## 5. After

- The maintainer's verdict is the one that counts. When it differs from the review, write the verdict as a plain rule where `paint-a-scene` says (art-direction section 5, step 6) and note in `projects/painter/vocabulary/review-notes.md` what the review missed or overrated, so the next review learns.
- When the maintainer gives numbers on a calibration sheet, `refcat.py calibrate` fits the dial (study-a-picture section 9); the reviews read calibrated from then on.
