---
id: "ft_1_25"
title: "World state and who is where today"
scope: "Per player: flags, items, characters met and taught, cool-downs, the teacher's visits, as one versioned document; one pure function gives every character's presence today (scene, path on the map, arriving or leaving) from practice, eligibility, cool-downs, the curriculum and a seeded daily draw; Kiur's heads-ups; a simulator that runs 30 days of a made-up student"
effort: "medium"
status: "in progress: world document, presence, cool-down, teacher's boat, simulator and Kiur's heads-ups built (ft_1_27); places in scenes wait on ft_1_24"
completeness: 85
depends_on: ["core_11", "ft_1_21", "ft_1_22"]
---
# ft_1_25: World state and who is where today

Per player one versioned world document; one pure function says where every character is today. Stage 1 or 2 of the [characters and teacher programme](../architect/program-characters-teacher.md); d132.

## Rules

- `src/core/island/presenceRules.ts`: `presence(input, rules)` (contract A.9) with `eligible` (practice threshold `meet.practiceMinutes`; after a lost tug `meet.cooldownCleanPlays` clean plays of its piece since, from `cleanPlaysSinceLostTug`; never the teacher), `turnsUp` (seeded draw per character and day, `appearChance`; never more than `maxDaysAway` days in a row away), the scene on its own seeded stream, and `teacherBoat` (on the map `boatDays` before the next curriculum deadline, 1 on the day). The boat also comes for every `test` entry in the calendar (`teacherDays`), so `askForTest` brings her that day (AC4).
- `meetCharacter` and `recordTug` (a lost tug keeps `lastLostTug { piece, at }`) keep the world document (A.8, core_11's `world` document, still version 1).
- `cleanPlaysSince` (`src/core/curriculum/fromLog.ts`) counts clean whole-piece plays after the tug; `src/core/progression/practiceTime.ts` gives practice minutes from the log's bars (a pause over two minutes counts nothing).
- `presence` fills `headsUps`: the teacher's boat first (`kiur.headsUp.teacher.boat`, `.landed` on the day), then each character in a scene by `kiur.headsUp.<character>.<scene>` (`headsUpKey`); a content test fails a character whose scene has no such key. Which one Kiur says: `kiurSays` (ft_1_27).
- Numbers in `content/world/presence.json`. Simulator: `npx tsx tools/presence/simulate-cli.ts [seed] [days]`.
- AX-3 provisional (architect): chance 0.5, three days, seven boat days, two-minute session gap; every character is `present` (arriving and leaving come with the walkers, ft_1_24).

## Acceptance criteria

All AX-3 provisional until built and tried; numbers are content, not code.

- **ft_1_25.AC1** The world document (core_11) holds flags, items, characters met with what they taught, cool-down starts and the teacher's visits; what can be derived from the logs is not stored.
- **ft_1_25.AC2** Presence is a pure function of (player, date, practice records, world document, curriculum) to each character's place today; the same day gives the same answer; a character appears only after its practice threshold and at most three days in a row without appearing once eligible.
- **ft_1_25.AC3** After a lost tug the character is absent until the piece has been played clean three more times in the room (practice records, never hours).
- **ft_1_25.AC4** The teacher's boat has a place on the map from the next curriculum deadline; she lands on the deadline day (or the day the student asks for the test).
- **ft_1_25.AC5** Kiur gives one heads-up per visit to the room about a present character and the scene ("I saw someone with a guitar case at the docks"), through string keys.
- **ft_1_25.AC6** A simulator (`tools/`) runs 30 days of a made-up student's practice and prints who appeared where, to tune the numbers.

## Parts

- TODO(builder, R3): a character's place in its scene once scenes are data (ft_1_24); until then the place is named after the scene.
- TODO(builder, R3): the game reads `presence` (today a character stands in its scene only for the tester profile and `?actors=1`): a character stands in its scene on the days presence picks it, and its boat is moored at the port (the scene-port TODO). No dot on the map while a character is in a scene, only while it goes from one scene to another (as on the map of the early adventure games); the arriving boat is seen on the map; their comings are organic, not every day, and some come only on their own days (once a week, on Sundays): a character's own visiting days and chance in its file, instead of the one `appearChance` for all. The fisherman first, then his morning: he lands at the port's gangway, stays the morning and rows home, as a script (ft_1_24.AC6).
