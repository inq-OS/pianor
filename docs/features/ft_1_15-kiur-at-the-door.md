---
id: "ft_1_15"
title: "Kiur at the door (key bashing)"
scope: "When more than ten keys are held at once on the practice screen, the piece pauses and Kiur flies in, stands firm and points a wing at the door; two picture buttons: back to the piece (where the cursor was) or out the door to the room; the bash keys are not judged or logged and nothing earned is taken away"
effort: "medium"
status: "built (in review); the maintainer's look and the real EZ-220 are open"
completeness: 90
depends_on: ["ft_0_09", "ft_1_12"]
---
# ft_1_15: Kiur at the door (key bashing)

Axiom call by the architect. Index: [FEATURES.md](FEATURES.md).

In a lesson a student who fools around is sent to reflect. Here, when the student bashes the keys, the piece pauses and
Kiur points at the door: a boundary, never a penalty (AX-1, AX-2). Bashing is not playing, and stopping it brings the
student back to reading (AX-0).

## Rules

1. **Detection (objective, AX-2.1).** More than ten keys held at once (`KEY_BASH_LIMIT`, `src/core/judge/keyBash.ts`):
   two hands have ten fingers, so eleven keys down together can only be palms or arms. The rule never looks at wrong notes
   or slowness, so a struggling beginner cannot trigger it. One burst counts (AX-3 provisional: no repeat threshold).
2. **Not judged, not logged.** A guard (`KeyBashGuard`) stands between the keyboard and the judge. Keys pass at once while
   at most twice the piece's largest chord is down (a right play never waits); a key beyond that waits 80 ms
   (`KEY_BASH_SETTLE_MS`) and goes on unless an eleventh key comes down meanwhile. After a bash every key is dropped until
   all of them are up. So a bash leaves no wrong notes, no tricky spots and nothing in the practice log; only the keys
   down before it could be told from playing (two for a melody) are judged (AX-3 provisional). A clock-driven judge
   (Tempo mode) is never moved past a waiting key, so its timing stays right.
3. **What happens.** The practice screen pauses and an overlay (`KiurDoorScene`, the first `openOverlay` user, d070) dims
   it. Kiur flies in, stands firm (feet apart, brows straight, no frown) and points a wing at the door. No words: two
   picture buttons, a play arrow (back to the piece) and the door (out). Esc is back to the piece. Keys pressed while
   Kiur is there do nothing.
4. **Back to the piece.** Wait mode goes on where the cursor was, with the click if it was on. Tempo mode starts the
   pass again, as its clock cannot pause (AX-3 provisional).
5. **The door.** Out to the player's room, after the pass being saved is saved. A draft preview goes back where it came
   from. Nothing earned is taken away and nothing is shown as a fail.
6. **Only on the practice screen**, and not while the game plays the piece (Kuula) or a pass is ending.

7. Not now: detecting random notes far from the awaited ones (needs a fair, tested threshold; could hit beginners).

## Acceptance criteria

- **ft_1_15.AC1** Playing, chords and a legato overlap reach the judge unchanged; ten keys held at once are not a bash.
- **ft_1_15.AC2** The keys of a bash are not judged (beyond those down before it could be told) and keys stay dropped until all are up.
- **ft_1_15.AC3** The overlay goes through `openOverlay` (d070): the caller is paused, and resumed with the typed choice or `cancelled`.
- **ft_1_15.AC4** Eleven keys at once pause the piece and show Kiur at the door; Back goes on where the cursor was.
- **ft_1_15.AC5** The door leads to the room; Esc is back to the piece.
- **ft_1_15.AC6** [human] The maintainer checks the look of Kiur's pose and how a bash on the real EZ-220 feels (key timing of palms is unverified).
