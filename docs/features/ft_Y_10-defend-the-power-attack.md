---
id: "ft_Y_10"
title: "Defend the power attack"
scope: "Red-aura power attack: a popup counts in one bar, the student plays a short riff; good blocks, perfect counterattacks, a miss lets it land"
effort: "large"
status: "on hold (d129): waits on the maintainer's answer on what carries over into challenges. Was: idea, refined; answers recorded"
completeness: 0
depends_on: ["core_01"]
---
# ft_Y_10: Defend the power attack

**On hold (d129: no battles, challenges with characters instead):** this was designed as part of a fight. What of it carries over into the challenges of [ft_1_21](ft_1_21-challenges-with-characters.md) waits on the maintainer (see the section What must come from the maintainer in ft_1_21); do not build it until then. The answer: it folds into challenges, health becomes ego, heal a boast, defence a comeback; it stays on hold until R4 is redesigned.

Phase: on hold (the iteration is not decided yet). Status: idea, refined; not scheduled; the numbers are provisional and the points under "Open questions" are for the maintainer. Index: [FEATURES.md](FEATURES.md).

The idea: the monster powers up an attack (a red aura or similar), which triggers a small popup that counts down one bar, then the student plays a riff to defend the attack if it is good, and a perfect play counterattacks.

## Why

In today's battle the monster only reacts to mistakes, so a student who plays well never sees it do anything. A power-up gives the fight a rhythm of its own: a short moment of danger, a short challenge, a reward. The riff is a second, very small reading and timing task at the student's level, which is also good practice, and it is the first use of "a riff is a spell" (ft_Y_01) in a battle. It builds on the health bar and the graded attacks of the battle and on Tempo mode (core_01).

## The loop

1. **Telegraph.** Every so often (see Pace) the monster starts to charge. A red aura grows round it, and a row of pips (one per bar of charge, two in the proposal) fills as the student completes bars of the piece. The student keeps playing; nothing changes on the staff. The charge is counted in bars played, not in seconds, so it is the same in Wait and Tempo mode and a slow reader gets the same warning. It cannot be ignored (the popup always follows), but it asks for nothing until then.
2. **The popup.** When the pips are full, at the next bar line, the main piece stops where it is and a panel opens over the staff area (the strip with Kiur, the monster, and both health bars stays visible; the piece's own staff is dimmed behind the panel and stays where it was). The panel shows the riff on a one-line staff at the size the player chose (ft_0_16), a short title ("Block it!"), and four beat dots.
3. **One-bar count-in.** The popup does not wait for a key. After a short moment (about 0.6 s, so the panel is seen) the existing Transport counts in one bar of the riff's own tempo and metre (the Transport reads the first bar and tempo of the chart it is given, so a riff in 3/4 at 72 gets three beats at 72), with the metronome click and the beat dots lighting 1, 2, 3, 4. The student reads the riff during the count; that bar is the warning and the reading time. A riff is slow and short (see Riffs), so a bar is 3 to 4 seconds at the first levels.
4. **The riff.** The student plays it. In Tempo mode it runs on the clock (a second TempoMode on the riff chart, started by the popup rather than by the first key); in Wait mode it waits for each key (see Wait or Tempo).
5. **The verdict** (next section), a short animation, and the main piece comes back: the panel closes, the staff is as it was, and the piece resumes after its own one-bar count-in ("back to the song"), so there is never a scramble.

If the student presses nothing, the count-in carries on, the riff runs by and every note is missed: it is a miss, the attack lands at full strength, and the fight goes on. Nothing waits for a key in Tempo mode and nothing needs a button.

## The verdict

The riff is judged like any piece: its result (`PieceResult`) already has the accuracy (notes right first try over notes), the mistakes, the timing statistics in Tempo mode (a score from 0 to 100 per note, missed ones as 0, so `NoteMissed` is already inside the mean) and the both-hands count. One number turns that into the verdict, the **defend score** from 0 to 100:

- **Tempo mode:** the mean timing score of the notes (core_01; a missed note is 0, a note within the perfect window is 100) times a share for wrong keys, half plus half the accuracy (so a riff with every note right first try keeps its timing score, and one where every note needed a second try keeps half of it).
- **Wait mode:** the accuracy alone, times 100 (there is no timing to judge).

| Verdict | Tempo mode (provisional) | Wait mode (provisional) | What happens |
|---|---|---|---|
| Perfect | score 90 or more (every note right first try, and on the beat) | accuracy 100 (every note right first try) | The attack is blocked and the player counterattacks |
| Good | score 50 or more | accuracy 75 or more | The attack is blocked, no damage |
| Not yet | below the good line | below the good line | The attack lands, softened by how close the student got |

- **Block:** the player takes no damage, the monster's lunge stops short ("bounces off") and the player's bar does not move.
- **Counterattack (perfect):** Kiur lunges (a lunge, no bullets) and the monster loses a share of its maximum HP (proposal 30 percent, 6 of Wobble's 20, about one clean four-note bar of the piece), times the both-hands multiplier when the riff has two hands that were played together. It counts as HP taken off the monster, so it also raises the XP of a lost battle. It may finish the monster; that is a good way to win.
- **The attack lands:** a power attack is a battle attack with a bigger top: `max(1, round(maxAttack x powerFactor x extent))`, where the extent is `1 - score / goodLine` (so a score at the good line gives 0, a score of 0 gives 1: one smooth line, no cliff at the threshold) and `powerFactor` is 1.5 (proposal): at most 30 of the player's 100 HP (a full-size battle attack is 20), a bit more than a quarter of the bar. The player's bar drains with the same lunge animation as any attack, only bigger. **A power attack never takes the player below 1 HP**: a battle is lost through the notes of the piece, never through the event (proposal, **confirm**).
- **Never punishing:** nothing here takes XP away, nothing resets progress, and a miss is not called a failure; the wording is "Ouch! Next time you can block it" (string keys, wording to confirm). A better defend score never gives a worse outcome (a property test).

All numbers live in validated content, content/battle/defend.json (planned, with a `schemaVersion`; the file beside content/battle/rules.json): the charge length and pace, the good and perfect lines for each mode, `powerFactor`, `counterShare`, the count-in length, the minimum HP left. The defend score and the verdict are a pure function in src/core/battle/, so the thresholds can be tuned without code.

## Wait or Tempo

The idea needs timing, but Wait mode is the MVP's play mode, and a student who chose Wait must not lose the feature. Options: (a) the defend exists only in Tempo mode; (b) it exists in both, with Wait as a gentler variant. **Recommendation: (b).** In Wait mode the popup, the count-in bar (a calm "ready" pulse with the metronome and the beat dots) and the riff are the same; the riff then waits for each key with no clock, "perfect" means every note right first try, "good" means at most one wrong note in four, and a silent student is not punished by time: the panel simply stays until the student plays or presses a "Not now" button, which counts as a miss. The pure rules take a defend score, so the two variants differ only in where the score comes from, and the pace, the animations and the rewards are shared.

## Where the riffs come from

Options: (1) generated at run time; (2) a library of riffs per level, made by a generator and approved by a person; (3) the next bars of the piece being fought; (4) a part of one of the player's pieces (core_06). **Recommendation: (2) now, (4) later.**

- A **riff is a tiny piece in the usual two files** (ABC plus meta, au01), kept in its own folder (`content/riffs/`, planned) so it never shows in the menu. It is **2 bars**, 3 to 6 notes a bar, in a slow tempo (proposal 60 to 72 beats a minute), quarter and half notes first, inside the range and hand position of the level and the hands the fighting piece uses. It passes the same compiler and linter, with a riff profile (the level table's rule of 4 to 16 bars does not fit one bar; the rest of the level's limits apply).
- **Later: made by a new generator kind**, `riff`, a sixth beside five-finger, scale, reading-drill, echo and phrase (au06): a seeded two-bar motif cut from the existing motif and echo code (same seed, same riff; no stored melodies). Eight to twelve per level means the student does not see the same riff every time. It is chosen at battle time by a seeded pick for the piece's level, never the same one twice in a row.
- **Status and approval as for every piece** (`docs/authoring/au08-approval.md`): generated riffs are drafts, a person approves them in the preview tool before a production build has them. This is also the guard for the no-copyright rule: the generator's check against known tunes works on runs of eight notes and cannot protect a riff of four, so a human looks at each riff for a famous opening.
- **Not the next bars of the piece** (3): the student would be reading what they were about to play anyway, and it tests nothing new. **Not generated in the browser** (1): drafts need approval and the generator is a Node tool.
- **Ties to the spellbook (ft_Y_01):** its spells are riffs of 2 to 4 bars. The riff library and the picker are the first half of that: later a spell is a riff the player chose and levelled, and a "part" of a piece (core_06) can serve as a riff by the same picker. Today there is no choice and no spellbook.

## Pace: an event, not a nag

Provisional, in `defend.json`:

- Never in the first two battles a player fights, so Fight is learned first; the **first** power-up a player meets is a free practice (the riff plays as usual, the verdict is shown, but the attack never lands).
- Not before 6 bars of the fight have been played; then one charge every 8 to 14 bars (a seeded draw), at most 3 per battle. A short piece repeated in rounds still spaces them by bars played.
- A charge only starts when at least the charge length plus 1 bars of the piece remain, so the popup never lands on the last bar. If the piece ends anyway (for example a very short piece), a charge in progress is dropped without a popup, and the aura fades. If the monster is defeated during a charge, the aura goes with it.
- A per-player setting, **Power attacks: on or off** (default on, with the other settings of ft_0_16); off means a battle as in the battle. It is also a candidate difficulty modifier (core_07).

## Fit for young students

- **The staff stays the main view.** The popup is a staff, not falling notes. It sits over the staff area but never over the strip, the health bars or the student's hands on the keys, and the piece's staff comes back unchanged.
- **Reading speed cannot lose it.** The riff is on screen from the moment the popup opens, a bar before the first note; the telegraph came two bars earlier; riffs are slow and short; in Wait mode there is no clock at all.
- **Accessibility.** The aura is not colour alone: a pulsing outline of the monster's own shape with a few flame spikes, a "!" mark and the filling pips carry the message without red; the outline has a light and a dark ring so it reads on any monster colour and for colour-blind players. With reduced motion (`config.theme.reducedMotion`, ft_0_13) the outline is steady, nothing pulses or flashes, and the pips still fill. The count-in is shown (dots and numbers) and heard (metronome click), never sound only.
- **Gentle by design:** the worst case is 30 percent of the bar in one blow, never lethal; a miss lets the fight go on; a lost battle still pays half XP for the share of HP taken ; the wording never says "failed".
- **Pressing keys by accident** during the telegraph changes nothing; during the count-in, keys are ignored; in the riff, a wrong key is a wrong note with the usual reason ("wrong octave", "neighbour key") shown gently.

## Interaction with the main piece

**Chosen flow: pause the piece, play the riff on its own judge, resume.** The main piece's judge is not touched: it is simply not given any keys while the popup is open, and the riff gets a second judge (Tempo or Wait) on the riff chart, so the two never mix and the riff's notes are never counted as the piece's. After the verdict the piece comes back with its own one-bar count-in. The seams:

- **Battle rules (src/core/battle/):** the battle listens to the main piece's bar events to count the charge, and to the riff's result for the verdict. The riff's events never reach the normal "note right" damage path.
- **Controller (`src/game/practice/PracticeController.ts`):** it needs to be switched off and on without losing its judge (today it can only be disposed), and a second controller for the riff listens to the same keyboard.
- **Transport (`src/core/transport/transport.ts`):** it has no pause. The piece's transport needs a "hold at this moment, then resume after a count-in" that shifts its time base by the length of the pause; nothing else in Tempo mode changes, because the judge reads its times from the transport. The same piece of work is what a section repeat (core_03) needs.
- **Screen:** src/game/BattleScene.ts is already large and the battle adds Tempo to it, so the popup and the aura live in a helper under src/game/battle/, not in the scene.

The alternative (swap the staff content to the riff and back) is the same thing drawn differently; the judge-level separation above is what matters, not how the panel is drawn.

## Art and animation

- **Aura:** an outline pulse on the monster's existing picture. The outline comes from the silhouette of its pixel picture and the pulse is a palette cycle of that outline (the pixel kit's recolor already does this), a beat per piece beat in Tempo and a calm fixed rate in Wait. It works on any monster, including the composed ones of ft_Y_02 (whose permanent "aura" part is a different thing: a look, not a state). A "!" and the pips are drawn in the strip. Original pixel art only, noted in `docs/assets.md` when built.
- **Popup:** a panel from the pixel kit (the same frames as the speech bubble), the riff staff drawn by the existing staff view, four beat dots. All text through string keys.
- **No bullets:** the power attack is the monster's lunge, bigger and slower than a normal one, then the player's bar drains; the counterattack is Kiur's lunge . A block is the lunge stopping short with a small spark.
- A soft rising sound for the charge is an extra, not required (sound for attacks is not decided in the battle).

## Rewards and stats

- **Counterattack damage** as above. **XP:** the XP rule of the battle stands, unchanged; defending earns no XP of its own (the counter's damage counts as HP taken, so it already helps a lost fight). **Confirm** if the maintainer wants a small XP for a perfect defend.
- The riff is not a piece in the menu: it has no stars and no practice history. The finished battle's log entry gets the defends (tried, good, perfect, the damage blocked and dealt), which is a profile format change with a migration (see slices). Per riff, the accuracy and timing score are kept, so piece stats (core_04) can later show how the student does on riffs, and the difficulty estimator (core_08) can power a riff by its difficulty.

## Testing

- **Pure rules, no screen** (src/core/battle/, written failing first): the schedule is a seeded pure function, tested with scripted bar events (never more than the maximum; never twice within the gap; never when too few bars remain; the first two battles have none; the same seed gives the same schedule; a charge dropped at the end of the piece). The defend score and the verdict are tested with scripted judge events: `NoteJudged` (on time, early, late, a wrong key first) and `NoteMissed` in a riff, in both modes. Property tests: a better play never gives a worse outcome (a note with a better timing score, a note right first try instead of second, a missed note answered: the defend score never falls, the damage taken never rises, the counter never falls); the player's HP stays between 1 and its maximum after a power attack; a block is exactly 0 damage; a perfect never hurts; XP is never negative.
- **Content:** a test over `content/riffs/` (planned) like the one for pieces: every riff compiles, passes the riff profile, stays in its level's range and hands, and every level has enough riffs; the defend rules file is validated and versioned.
- **End to end** with the virtual EZ-220 and the scripted player (`src/io/mock`): the same pattern as core_01's tests, on the game's clock. A developer switch forces the first power-up after N bars (in `src/config.ts`, dev builds only) so a test does not wait for the seed. Three scripted fights: a perfect riff (the monster loses its counter share, the player's bar does not move), a half-right riff (the bar drains by the softened attack), and no key at all in Tempo mode (the riff runs by, full attack, the piece resumes and ends). A screenshot of the popup with the aura at 1366x768.
- **Demo director (ft_Y_09):** its "battle" scenario gains a scripted defend outcome (perfect, good or miss) and the forced power-up, so the maintainer can watch the telegraph, the popup and the verdict without playing.

## Slices

| Slice | Content | Effort |
|---|---|---|
| a | Pure rules in src/core/battle/: the seeded charge schedule, the defend score and verdict for both modes, the power attack and the counter on top of the battle's attack and health bar; `defend.json` (schema, version, content tests); property tests. Needs the battle's slice a | simple |
| b | Riff supply. **First version (answer 1): pre-set riffs**, a few hand-written two-bar ABC riffs per level in content/riffs (planned), with the riff lint profile (2 bars), a loader, and one fixed pick per power-up (not a choice), approved by a person. **Later:** the `riff` generator kind and the seeded picker, and the spellbook's choice (ft_Y_01) | simple (pre-set), medium (generator) |
| c | The Wait variant in the battle screen: aura and pips, the popup helper with the riff staff, a second controller, the suspend and resume of the main controller, the count-in with beat dots, lunges and animations, strings, the setting, tests and screenshots. Needs the battle's slice c | medium |
| d | The Tempo variant: the transport hold and resume (shared with core_03), a TempoMode on the riff started by the popup, the piece resuming with a count-in, an end-to-end test on the clock. Needs the battle's slice d | medium |
| e | Save and tuning: the battle log keeps the defends (profile version up with a migration, a fixture and a decision file; coordinate with the battle's slice b, which also changes the battle log), then a playtest and tuning of the numbers | simple, then human |

Slices a to c leave a playable Wait-mode feature; d adds the timing. Each is shippable behind the setting.

## Acceptance criteria

- **ft_Y_10.AC1** The charge schedule is seeded and bounded: the same seed gives the same schedule, never more than the maximum per battle, never within the gap, never when too few bars remain, none in a player's first battles (scripted bar events).
- **ft_Y_10.AC2** The defend score follows the riff's result: in Tempo mode from the mean timing score (`NoteMissed` as 0) and the accuracy; in Wait mode from the accuracy alone; a better play never gives a lower score, more damage taken or a smaller counter (a property test).
- **ft_Y_10.AC3** A perfect blocks the attack and counterattacks for the share of the monster's maximum HP from the rules file; a good blocks with no damage; below the good line the attack lands, scaled to 0 at the good line and to the full power attack at a score of 0; the player's HP stays between 1 and its maximum after a power attack; a loss still pays the XP of the battle and nothing takes XP away.
- **ft_Y_10.AC4** Every number (charge pace, lines, power factor, counter share, count-in) comes from a validated, versioned rules file; every riff in the library compiles, passes the riff lint profile, stays within its level's range and hands, and has status approved before a production build.
- **ft_Y_10.AC5** The popup counts in one bar of the riff's own tempo and metre with the Transport; with no key pressed in Tempo mode the riff runs by, the attack lands and the piece resumes and finishes; the main piece's judge saw no key while the popup was open and is where it was after.
- **ft_Y_10.AC6** End-to-end tests with the virtual player play a perfect, a half-right and a silent defend in Tempo mode and a perfect and a half-right one in Wait mode, and check the monster's and the player's bars; the setting off gives the battle of the battle unchanged.
- **ft_Y_10.AC7** The aura is readable without colour and calm with reduced motion (a screenshot with each); the popup never covers the strip or the health bars (a screenshot at 1366x768). [human]
- **ft_Y_10.AC8** Is the warning long enough for the student to read the riff, is the event welcome and not a nag, is a miss gentle, and is the riff at the right level. [human]
- **ft_Y_10.AC9** The generated riffs are musical enough and none copies a known tune. [human]

## Effort

**Large** with Tempo, **medium** for the Wait variant alone (slices a, b, c and e).

**Already there:**
- The Transport counts in a bar and plans the metronome from the first bar and tempo of the chart it is given, so a riff chart gets its own bar for free.
- TempoMode and WaitMode judge any chart; `PieceResult` already carries accuracy, timing statistics with missed notes as 0, and the both-hands count; `bothHandsMultiplier` exists.
- `Battle` is pure and driven by judge events, with rules in content JSON and a zod schema pattern; `src/core/random.ts` gives seeded draws; the generators and the echo and phrase motif code are reusable; the pixel kit can recolor a picture; the staff view draws any chart at the player's size; `reducedMotion` is in the config; the virtual player and the clock-based end-to-end pattern of core_01 exist.

**Friction:**
1. The battle (attack formula, player bar, Tempo in the battle screen in slice d); this feature stands on it and should wait for its slices a to c, and d for the Tempo variant.
2. The Transport has no hold and resume (shared with core_03), and the practice controller cannot be switched off without being disposed.
3. The linter's piece-length rule is the level's 4 to 16 bars; a riff needs its own profile. Riffs are a new content type with its own folder, loader and human approval of every one.
4. The battle log in the save changes again (together with the battle's slice b), which touches the locked seam of versioned saves, so a decision file is due when slice e is built.
5. `BattleScene.ts` is growing with each feature; the popup and aura must go into helpers.

## Decided

The questions of the refinement are answered; the recommended defaults were accepted except where noted.

1. **One forced riff, no choice.** The first version (the MVP of this feature) uses a **pre-set riff**: hand-written, approved like any piece, one per power-up. A choice of riffs comes with the spellbook (ft_Y_01), and so does generating riffs.
2. **Wait-mode players get the defend with no clock**, graded by mistakes only. Yes.
3. **A power attack never takes the last HP**; it leaves at least 1 HP. Yes.
4. **The counterattack** is 30 percent of the monster's maximum HP and may finish the monster. Yes.
5. **Introduction:** none in a player's first two battles, and the first power-up is free (never lands). Yes.
6. **The student does not hear the riff first**; it is read from the staff. A costed "Listen" hint is a later idea.
7. **Riff size: two bars** (not one). The count-in before it is still one bar of the riff's own tempo and metre; the rest of the proposal (3 to 6 notes a bar, slow tempo, reviewed in the preview tool) stands, to be checked in the first playtest. Two bars double the reading and the playing time (about 6 to 8 seconds at 60 to 72 beats a minute), so the pace numbers (a charge every 8 to 14 bars) are to be tried against that.
8. **No XP of its own for defending**; the counterattack's damage already counts toward a lost fight's XP. Yes.

Not asked, decided in the refinement: the aura is red plus a shape (so it is not colour only); a power-up can be turned off in the settings.

## Design update (step 1 of the RPG MVP)

The design page rpg-battle-mvp.md changes this file in four places:

- **The defence is a 4-bar cast** from the spellbook's Shield slot, not a 2-bar riff with good and perfect thresholds. Each clean bar takes 25 % off the power attack; the first slip ends it with what was earned.
- **The counterattack belongs to the knight alone**, and only in the defence (it replaces the minigame for that attack). Other classes never counterattack.
- **The charge is in beats:** pips 3, 3, 2 by monster level, the first charge not before turn 2, then one more student turn before the power attack.
- **The power attack takes 30 % of the player's max HP and never the last HP.**

Built so far: the numbers and the pure rules in src/core/battle/turns.ts (`defenceDamage`, `chargeBeat`, `powerAttackDamage`). The aura, the defence panel and the screen are not built.

Built (both closed): the defence cast and the knight's counterattack are pure rules in src/core/battle/classes.ts, and the turn loop in src/core/battle/turnBattle.ts runs the charge and the power attack. The charge pips and first charge turn are the values in content/battle/turns.json (`chargePips` 3, 3, 2 by level; `firstChargeTurn` 2). The earlier issue text said 4, 3, 3 and turn 3; the code keeps the harder defaults (AX-1), and the file is the truth. Still not built: the aura, the defence panel and any screen.
