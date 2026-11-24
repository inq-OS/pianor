# Axioms: the rules every Pianor decision follows

The base principles ([d000](decisions/workflow.md#d000)). They rank above every decision file, feature file and design doc: those are choices made under the axioms, and a choice that breaks an axiom is a bug. Read this page before you ask the maintainer anything; most questions are answered here.

## AX-0 is the source of truth

**If anything feels like a conflict, AX-0 decides.** That holds between the axioms, between an axiom and a corollary, and between an axiom and any decision, feature or habit in the repository. AX-1, AX-2 and AX-3 exist only to serve AX-0; none of them can override it. Constraints outside game design stay as they are: licences and copyright, privacy of the players' data, and the maintainer's explicit approvals (for example only a human approves a piece).

The **student** is whoever plays: the design target is a young beginner, and adults play too.

## AX-0 "The Core": learning music is above everything

**Rule.** Every detail, feature and decision must make the student a better musician: read staff notation, play the right keys, and keep practising. If Pianor does not teach piano and music, the project has failed, whatever else it does well.

**Why.** It is the only reason Pianor exists. Proficiency comes from rigorous training through sheer repetition, so the game must make repetition happen and must never offer a way around it.

**Test.** "Does this option make the student read and play more, or better?" An option that trades learning for anything else (fun, looks, speed of building) loses. If two options are equal for learning, take the simpler one (AX-3).

Corollaries:
- AX-0.1 Staff notation is the main view, and the student reads every note from it.
- AX-0.2 Pitch is judged first; a wrong note carries a reason (wrong octave, neighbour key, wrong letter), so the student learns from it.
- AX-0.3 Real music: a whole piece of any length must be playable, including classics a student may already practise elsewhere.
- AX-0.4 Pianor is agnostic to any method or teacher outside the game. A request from outside enters the game as an ordinary feature or improvement that stands on AX-0 alone.

## AX-1 "The Grind": prefer the harder option

**Rule.** When a gameplay question has an easier and a harder answer, take the harder one.

**Why.** Content is finite and the student is fast. An easy game is finished in days, gives a false sense of achievement and ends the repetition AX-0 needs; a demanding one turns the same content into many repetitions. It also buys time to build.

**Test.** "Which option needs more correct repetitions for the same reward?" Pick it, then check the calibration line: a student playing well (about 90 % right first try) succeeds, one playing so-so (about 85 %) has a close call, and careless play fails and has to repeat; stars are stricter than this line (three from 95 %, two from 75 %).

Harder means more and better repetitions, not punishment. Corollaries:
- AX-1.1 A loss still earns XP; nothing earned is ever taken away.
- AX-1.2 Wait mode is the MVP play mode: difficulty comes from windows and thresholds, not from a clock that pushes notes past the student.
- AX-1.3 This is the standing rule that the harder option is the default (the maintainer, decision log B3), now part of AX-1.

## AX-2 "The Attraction": just enough game

**Rule.** Pianor is a game only slightly above learning: the minimum stimulation that makes the student come back by choice, with a minimalistic, approachable look and feel.

**Why.** AX-2 exists only to maximise AX-0. Too much stimulation bites off attention from the music; too little and the student does not come back, which fails AX-0 too.

**Test.** "Is this reward tied to something the student actually played, and is it the smallest thing that works?" Stimulation and complexity may be added later, gradually, but are never removed once given.

Corollaries:
- AX-2.1 Objective feedback: say what happened ("wrong octave in bar 4", "3 of 4 bars right first try"). No unearned praise and no celebration without a basis in real performance; a bigger moment only for a real milestone (a new level, a first three-star piece). Stoic, not harsh: no shaming sounds or words either.
- AX-2.2 Every number the game shows (stars, XP, damage) comes from what was played.
- AX-2.3 Pixel-art look with minimal original assets.
- AX-2.4 Big, readable notes for a young student.

## AX-3 "The Scaffold": when the axioms do not decide, build the simplest thing and mark it

**Rule.** If an agent cannot settle a question from the axioms, it does not stop and wait. It builds the smallest version that satisfies all the axioms, keeps it modular and easy to extend or replace, marks it as provisional and tells the architect.

**Why.** A thread that waits for the maintainer is a stalled thread. A simple, modular choice is cheap to change once the maintainer or a playtest says otherwise, and each such choice shows where the axioms need to grow.

**Test.** "If this choice turns out wrong, how much has to change?" Prefer the option behind one interface, one data value or one file; avoid options that spread through many files or a saved format.

How:
1. Write the choice down where the work is reviewed: the pull request body (or the issue) gets a line `AX-3 provisional: <question>; chose <option> because <axioms>`. Where the choice sits in code, a one-line comment starting `AX-3 provisional:` makes it findable with `grep`.
2. Write the question as a `TODO(architect)` tag in the feature file and one line in the pull request description (d153).
3. Not for a step that cannot be undone (a saved-format bump, a deletion, anything outside the repository): those still wait for the maintainer.

## AX-4 "The Master": Kiur is secretly the absolute master of music

**Rule.** Kiur is secretly the absolute master of music ([d161](decisions/workflow.md#d161)). He never has to show it in full; everything musical is effortless to him.

**Why.** The student's companion is someone whose musicianship is never in doubt. When he plays with the student, he is teaching them, never struggling.

**Test.** "Would a master who never needs to show off say or do this?"

Corollaries:
- When Kiur plays, he plays every note right and in time. He never fumbles, guesses or is surprised by music.
- His play is never a struggle: his lines never say he tried hard, was lucky or was surprised. A tug with him is still decided only by what the student played (AX-2.1), never rigged either way.
- He never shows his mastery in full: no solos or display pieces, and he never boasts. A rare small sign of it, at most one, such as a passing remark, is enough.
- He knows every piece, style and rule of music without having to look anything up. What he says about music is always right.
- AX-0 still decides. His mastery serves the student's reading and playing, and is never a show that the student only watches.

## Asking the maintainer: the escalation loop

A question that reaches the maintainer means the axioms were not enough. So:

1. **Agents** apply the axioms, then AX-3. They do not ask the maintainer directly, except for a step that cannot be undone.
2. **The architect** answers AX-3 messages from the axioms where it can. A question it passes on to the maintainer names the axioms checked and why none decided it.
3. **Every answer from the maintainer** is weighed once: `missed` (an axiom answered it; make the wording or the pointer clearer), `new rule` (the answer generalises; the architect proposes a corollary in a `TODO(architect)` tag here) or `taste` (a one-off preference, written where the work is). A lasting answer gets a ledger entry ([log-decision](../.claude/skills/log-decision/SKILL.md)).
4. **Changes to this page** come as one pull request that names them. Only the maintainer approves a change to this page, and each change gets a ledger entry.

Over time the corollaries become the decision tree, and fewer questions reach the maintainer.
