---
id: "ft_1_26"
title: "The teacher's screen behind the academic hat"
scope: "A hat button on the main menu opens, behind a password gate, the screen for parents and the teacher: the players, each one's curriculum pieces with deadline and priority, a calendar with notes, statistics (level, median, standard deviation, histogram, last plays) and the extrapolation with its colour and medal; requests to the developer through GitHub's new-issue form or mail"
effort: "large"
status: "ft_1_26 built (AC1, AC2, AC3 without the calendar, AC8), and the test days and times (AC9); statistics, calendar and requests to come"
completeness: 50
depends_on: ["core_12", "ft_1_07", "ft_1_16", "ft_1_20"]
---
# ft_1_26: The teacher's screen behind the academic hat

Parents and the teacher get a screen, behind a password gate, to set each player's curriculum pieces with deadline and priority and to read how they are doing. Stage 1 or 2 of the [programme](../architect/program-characters-teacher.md); the model is [d139](../decisions/game.md#d139), the role [d140](../decisions/game.md#d140). The model is core_12; this feature is the screens. Index: [FEATURES.md](FEATURES.md).

## Rules

- **Gate:** a painted academic hat (`hatPicture` in `menuArt.ts`, `mainMenuLayout().hat`, d145) sits at the main menu's scroll head between the keyboard and the gear. It opens `TeacherGateScene` on the teacher's own record (`core/admin/teacherRecord.ts`, key `pianor-teacher/record`, default `pianor`, d140), with the d082 hashing and the admin's 30-minute window (`io/admin/passwordLock.ts`). A child lock, said so on the screen. `TeacherPasswordScene` changes the password; the lock closes the screen.
- **List** (`TeacherScene`): the players, and the chosen player's curriculum pieces, most urgent first: colour, piece, deadline, priority, level, expected, predicted, delta, medal. Statuses are queries over the practice log (`game/teacher/teacherStatuses.ts`, `ProfileService.practiceLogOf`).
- **Piece form:** Add picks a piece not yet on the curriculum; a piece's name opens `TeacherPieceScene`: deadline (from today on, ±1 and ±7 days), priority 1 to 10, and under More the base expectation and X, Y, Z, B (kept as overrides only when changed, `game/teacher/curriculumForm.ts`); Save, Remove, Back.
- **Tests (when the teacher comes):** Tests on the list's toolbar opens `TeacherTestsScene` (ft_1_26.AC9): the weekly test days (a box a weekday, Monday first; Sunday and Wednesday by default), the time of day from which the teacher comes on them and on a deadline (±10 min, ±1 h, round the clock; from the day's start by default), and a test ordered for hours and minutes from now (±5 min, ±1 h; an hour by default; Order test on the toolbar), the ordered tests to come under them. Each press is saved in the curriculum at once (`testWeekdays`, `testTime`, a `test` calendar entry with `time`; optional fields of the curriculum document version 1, read as the defaults when absent, d069.3). The rules: `core/island/teacher.ts` (`isTestDay`, `checkupsDue` from the time on, `nextTestTime`, `orderTest`) and `game/teacher/testsForm.ts`. On a test day the teacher checks the most urgent piece not yet passed; the room waits for that time and the teacher comes in while the student is there (ft_1_27).
- **Characters** on the list's toolbar opens the cast page of [ft_1_37](ft_1_37-teacher-runs-the-cast.md) for the chosen player.
- **Storage:** each player's curriculum is their `curriculum` save document (d136), read and written alone through `ProfileService.curriculumOf` and `saveCurriculum`; a failed read or save says so and changes nothing. AX-3 provisional (architect): new pieces are due in two weeks with priority 5.
- **Look:** the four screens (gate, list, piece, password) keep the toolbar and draw no band (administrative, no gameplay; `keepsToolbar`). They are written in the teacher's register (d145: a register with a painted hat): `PixelScene.register`, `core/layout/register.ts`, `REGISTER_PALETTE` (song book in green cloth, faint blue-grey ruling, red margin; `paint/register.ts`). The list puts the players along the head of the left page (chosen one ringed in red), then a ruled line a piece: status dot, name (opens it), date on the left, marks on the right, a medal's dot after the name. The picker runs down the left page and on down the right; the form writes a field a line with its steps in inked boxes on the right; the gate and password write boxes on the left and the hint on the right (`inRegister`). A heading is big when it fits its page on one line (`registerTitle`); every page is ruled to its foot (`ruleToFoot`); gate and password use `ruledField`.
- **Demo:** `npm run demo` with `?scenario=teacher` puts Au Clair de la Lune on the curriculum (priority 7), plays it cleanly three times, then opens the teacher's screen through the default password.
- **Tests:** `src/core/admin/teacherRecord.test.ts`, `src/io/teacher/teacherDesk.test.ts`, `src/game/teacher/*.test.ts`, `src/core/curriculum/bookMark.test.ts` (AC8), `src/core/island/teacher.test.ts` (AC9), `tests/progression/profile-service.test.ts`, `tests/e2e/player-screens.spec.ts` (AC1 to AC3, AC8, AC9), `tests/e2e/room.spec.ts` (AC9), `tests/e2e/autoplay.spec.ts`, `register.test.ts`, `mainMenu.test.ts`. Not verified: the Windows screenshot run.

## Acceptance criteria

All AX-3 provisional until built and tried; numbers are content, not code.

- **ft_1_26.AC1** The main menu has an academic-hat button; it opens a gate on the d082 record (the teacher's own password, separate from the admin page's, default `pianor` and changeable); a child lock, said so on the screen.
- **ft_1_26.AC2** The teacher picks a player and sees their curriculum pieces with colour, medal, level, expected level, predicted level at the deadline and delta, sorted by urgency (core_12).
- **ft_1_26.AC3** The teacher adds a piece to a player's curriculum (the tag "curriculum", only here), sets its deadline, priority 1 to 10 and, under "more", the numbers X, Y, Z, B and the base expectation.
- **ft_1_26.AC4** A calendar per player shows deadlines and the teacher's dated notes and lessons; entries are added and edited here.
- **ft_1_26.AC5** Statistics per piece: median, mean, standard deviation, a histogram of play scores with filters (last N plays or days, mode, tempo), the trend and its band to the deadline.
- **ft_1_26.AC6** Requests: a form with kind (bug, improvement, feature, contact), title and text opens GitHub's new-issue page filled in (as ft_1_16), or the mail program for contact with a contact address from the device settings, never from the repository.
- **ft_1_26.AC7** Every text through string keys; the screens are written in the teacher's register on the desk (d145; they keep the toolbar and have no band).
- **ft_1_26.AC8** In the piece book (the player's piece list) a piece on the active player's curriculum shows the main menu's academic hat at the right of its title line, and no other piece does; beside the hat the days left to its deadline and a bar of how near its level is to the expected level; a finished piece (retained at its expected level, d139's strong green) shows the hat alone, in its medal's colours (gold, silver, bronze) or strong green without a medal.
- **ft_1_26.AC9** The teacher sets when to come to test: the weekly test days (default Sunday and Wednesday), the time of day from which the teacher comes on them, and a test ordered for hours and minutes from now; on a test day, from that time, the teacher checks the most urgent piece not yet passed, also while the student is already in the room.

## Parts

- ft_1_26's queries: `curriculumStatuses(curriculum, plays, today, rules, window?)` gives every curriculum piece's `PieceStatus` (colour, medal, level, prediction, urgency), most urgent first; `pieceStatus` gives one; `playResultsFromLog(log, piece, barCount, dayOf, rules)` turns a player's practice log into the plays they read; `DEFAULT_EVALUATION_RULES` or `parseEvaluationRules(content/curriculum/evaluation.json)` the numbers. All in `src/core/curriculum/`.
- TODO(painter, R3): the register's list shows a status as a coloured dot (d139) with no key on the page. Write a key on the right page's foot (a dot and its word for purple, green and strong green), through string keys with Estonian. The art review asked for it; it was left out of ft_1_26's pass 2 to keep the pull request to its look.
- TODO(builder, R4): the teacher's statistics, the trend chart, the calendar and requests (held until players and a parent have used the first screen); the painter the chart's look.
- TODO(architect, R3): AX-3 provisional (ft_1_26.AC8): the bar beside a curriculum piece's hat shows the measured level over the expected level, not the trend's predicted level at the deadline; and a piece not yet finished keeps the hat's usual colours (no purple or scaled green on the hat). Confirm with the maintainer.
