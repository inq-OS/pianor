---
id: "ft_1_31"
title: "First-run intro: Kiur's tour and the teacher's first lesson"
scope: "Every new player is shown the game once: Kiur shows the room and the practice screen one thing at a time under a spotlight (the rest darkened, an arrow, his line), then the teacher visits and walks the student through learn, practise and the tug on the first four bars of Twinkle"
effort: "medium"
status: "built: the spotlight, the room's and the map's tour, the practice screen's tour, the teacher's lesson (learn, practise, tug) and the world flags, with unit and end-to-end tests; open: the maintainer's look and wording, the painter's arrow and the teacher's figure"
completeness: 80
depends_on: ["ft_1_27", "ft_1_21", "ft_1_06", "core_03"]
---
# ft_1_31: First-run intro: Kiur's tour and the teacher's first lesson

An intro and walkthrough introduces the gameplay and features, and every new profile sees it. Kiur introduces the game with overlays (the object of interest shown, the rest of the screen darkened), arrows and text on how every stage of the game is played. The final part is the teacher visiting and going through the stages of learning, practicing and tugging a very simple piece (a 4-bar Twinkle Twinkle). Index: [FEATURES.md](FEATURES.md).

AX-0: the intro ends with the student having read and played a piece three times and played it back from memory; it shows where everything is so the next visit is spent playing, not searching. AX-2.1: every line says what a thing does, none praises.

## Rules

- **Who gets it.** A new player, on the first visit to the room: `introDue` (`src/core/intro/intro.ts`) is true while the player's world has no `intro.done` flag and the player has played nothing, or began the intro (`intro.started`) and left half way, who then gets it again from the start. A player from before the intro who has played never gets it. Nothing new is saved: the two flags are strings in the world document's `flags` list, which already holds any flag (no save format change). A world that cannot be read never starts it. `?intro=1` plays it whatever was played, `?intro=0` never (the end-to-end tests, whose every page starts with a new player); the self-playing demo never.
- **The spotlight** (`IntroScene`, an overlay through `openOverlay`, d070; layout `src/core/layout/spotlight.ts`): the screen under it is paused and its keys muted; all of it is darkened in the room's dusk shade but the one thing shown, which is framed in gold with a bobbing arrow pointing at it; Kiur stands on the side away from it, his wing pointing its way, and says his line over the dark as the conversations do. A press, Space or Enter goes on; Esc skips.
- **The skip button**: on screen through the whole intro, "Jäta vahele". On every spotlight it stands in the first free corner (top right, else bottom right, top left, bottom left: never over the light, the arrow, Kiur or his line); over the teacher's talk and the tug in the room, top right; in the lesson's play, last in the band ("Lõpeta", the cell's room). A press ends the intro where it is, kept as done, and the room is the player's again.
- **The stages** (content `content/intro/intro.json`, the order `afterRoom` and `afterPlay`):
  1. **Tour** (room): Kiur shows the piano, his shield, the stand, the door to the island and himself on the bed, then takes the student out.
  2. **Map** (the map of Keri; the same intro stage for the map as for the room, so no functionality stays obscure): Kiur shows the island, the first place the student's level has opened (where a character lives, what to do there, more places opening with the level) and the house, the way back. Esc there skips the rest of the intro.
  3. **Knock** (room): back home, someone knocks; the teacher stands in the doorway and says the lesson's three steps.
  4. **Learn** (room, then the practice screen): the teacher says how; the piano opens with the lesson's bars as a section (core_03: Wait mode at the written tempo, no XP, its bars kept in the practice log under the piece), only Listen and Start over in the band. Before the first lap Kiur shows the staff, the lit next note, Listen and the way back. One lap to the end.
  5. **Practise**: back in the room the teacher asks for `practisePasses` more laps (2); Kiur shows Start over. One play to learn and two to practise are the three plays the tug's gate asks for (ft_1_06.AC15).
  6. **Tug** (room): the teacher explains and tugs the lesson with the student over the room, level 1 (keys only, no staff, d100), Kiur's practice tug rules (ft_1_21.AC14: won and lost at 2, nothing kept, no XP).
  7. **End**: the teacher says every piece goes this way; Kiur points at the piano. `intro.done` is kept.
- **Back and Esc.** Back on the practice screen returns to the room's stage that opened the play, said again. The lesson's play has no tools strip, and its mode, tempo and section keys do nothing, as at the check-up. Esc in the tug ends the tug as any tug's end does and goes on to the end stage: the tug keeps nothing, so it is not played again (AX-3 provisional). Esc in a spotlight or a talk in the room skips the rest of the intro, kept as done. On the practice screen Esc in the spotlight skips only Kiur's tour there; the play goes on.
- **Without the lesson's piece** (a build that left it out; Twinkle is the intro's piece), the tour runs and ends with Kiur's last line; the teacher does not come.
- AX-3 provisional: the skip button's places and words ("Lõpeta" in the band, where "Jäta vahele" does not fit), the lines, the order of the tour, the lesson (Twinkle bars 1 to 4, 2 practise laps), Esc skipping the whole intro in the room, and the arrow (own art) are first versions.

## Acceptance criteria

- **ft_1_31.AC1** A new player's first visit to the room starts the intro; a player who finished or skipped it, and one from before it who has played, do not get it; one who left it half way gets it again from the start; `?intro=0` and `?intro=1` turn it off and on.
- **ft_1_31.AC2** Kiur's tour of the room shows each object (piano, shield, stand, door, Kiur) under the spotlight: the rest of the screen darkened, the thing framed, an arrow pointing at it, Kiur and his line beside it and not over it.
- **ft_1_31.AC3** On the practice screen Kiur shows the staff, the next note, Listen and the way back before the first lap; the lesson plays in Wait mode with only Listen and Start over.
- **ft_1_31.AC4** The teacher walks the student through learn (one lap), practise (two more) and the tug on Twinkle's first four bars, in that order, each from the room; Back from a play says its stage again.
- **ft_1_31.AC5** Esc skips the intro in the room and keeps it as done; a skip button on screen through the whole intro (every spotlight, the teacher's talk, the tug, the lesson's play) ends it from anywhere, kept as done.
- **ft_1_31.AC6** Between the room's tour and the teacher's knock Kiur shows the map of Keri: a place the student can visit and the house, the way back.
- **ft_1_31.AC7** [human] The maintainer checks the look (darkness, frame, arrow, where Kiur stands), the wording in Estonian, and that a young student follows it on the laptop.

## TODO

- TODO(painter, R2): the arrow (own art in `src/game/IntroScene.ts`) and the frame round the light in the kit's look; the teacher is still the placeholder box of ft_1_27.
- TODO(builder, R2): when the redesign of how a piece is learned lands ([ft_1_32](ft_1_32-learn-a-piece-bar-by-bar.md): bar by bar, its learning view on the practice screen), change the learn and practise stages in `content/intro/intro.json` (and `afterRoom` if a stage is added) so the intro teaches the new way.
- TODO(architect): AX-3 provisional choices above; whether the intro should also visit a scene and its talk, and whether a player can watch it again (today only `?intro=1`).
- IDEA(builder): should the piece maker's keys tour get its own "Close tour" button?
- TODO(builder, R2): a test that the piece maker's keys tour has no skip button.
- NEEDS-HUMAN: look at the intro on the laptop and check its Estonian wording, the lesson bar's label LÕPETA among it.
- TODO(painter, R2): the final arrow in the kit's style with a gold frame, and the teacher's figure (still a placeholder box).
- TODO(painter, R2): layout: the teacher's line sits under the skip button, and the button covers the end of the hint bar.
- TODO(builder, R2): decide whether the intro's learn and practise stages teach bar by bar ([ft_1_32](ft_1_32-learn-a-piece-bar-by-bar.md)), and change `content/intro/intro.json` to match.
- AX-3 provisional: the lines, the tour order, the lesson length, what Esc does, where the skip button sits, whether the intro visits a scene, and the replay (today only the URL switch `?intro=1`).
- TODO(architect, R2): the working copy once ended on a detached HEAD after long end-to-end runs; check whether `npm run test:e2e:affected` checks out a ref and, if it does, say so in [testing.md](../testing.md).
