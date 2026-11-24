# The painter project: instructions

For the painter role (d153), which paints Pianor's screens in the agreed MI2-like style. These instructions live in the architect's folder because the architect keeps this page true.

**Status: running.** Nothing here gives a label, a routine or a right to merge.

## 1. What the project is for

One project for the look of the game: every screen painted in one manner, the one agreed while the room, the map of Keri and the grassy knoll were made. The manner, its rules and the way to study examples are in [art-direction.md](../art-direction.md). That file is the painter's handbook; this page says how the project works.

## 2. What it owns, and what it does not

| Owns (may change in its own pull requests) | Does not own (ask first) |
|---|---|
| [art-direction.md](../art-direction.md), [sprites.md](../sprites.md), [assets.md](../assets.md), the scene and map notes under [docs/keri/](../keri/map.md), the input log in [keri.md](../keri.md) | the axioms, `CLAUDE.md`, the features' acceptance criteria |
| painting code: `src/game/ui/pixel/paint/`, `src/game/ui/pixel/keri/`, the art files in `src/game/ui/pixel/` | game rules: everything in `src/core/` except a picture's plan in `src/core/layout/` |
| how a screen looks: what its scene draws in `draw()` | what a screen does: its buttons, their order, where they lead, the text |
| the build step `tools/vite-keri.ts` and the tool `tools/art/` | the save format, content schemas, dependencies |
| the world model's looks (roof, wall, landmark entries in `content/world/keri.json`) | the world model's places and its schema (d108): measured, never moved to suit a picture |

A change on the right side goes to the builder or the architect as a tag in the feature file (d153).

## 3. Read first, in this order

1. `CLAUDE.md` and [axioms.md](../axioms.md). AX-0 decides every conflict: learning music is above the look.
2. [art-direction.md](../art-direction.md), whole. Section 8 lists what was already turned down.
3. [d111](../decisions/art.md#d111) (the record behind the rules), [d110](../decisions/art.md#d110) (the 640 x 360 fine grid and layout cells), [d108](../decisions/game.md#d108) (the world model), [d112](../decisions/game.md#d112) and [d113](../decisions/game.md#d113) (scenes).
4. [keri.md](../keri.md) (the island, what is known, what waits for the maintainer) and the three files under [docs/keri/](../keri/scene-knoll.md).
5. The code of one finished picture, as the model: `src/core/layout/knoll.ts`, `src/game/ui/pixel/keri/knollPicture.ts` with its test, its life in `src/game/adventure/sceneLife.ts` and its data in `content/scenes/knoll.json`.
6. The skills `paint-a-scene` (the order of work and the measured rules), `use-free-art-packs`, `write-ui-text`, `before-pr`.

## 4. Rules of work

1. **Scaffold and wait.** Scaffold and wait for the maintainer's input, and never invent information that must come from the maintainer (maps, pictures). What a place looks like, what a being looks like, where a thing stands on Keri: asked, never invented. Write `KERI-TODO` where the answer is missing.
2. **Every picture goes to the maintainer's eye** before it counts as done. Show it at 1920 x 1080, at each hour of the day it has, next to the picture it replaces. Write each verdict as a plain rule (no date, no quote, d165) into the decision it belongs to and into art-direction.md section 8.
3. **One screen, one pull request.** A screen's behaviour, buttons and text do not change in a repaint. A wish to change them is a separate question for the maintainer.
4. **The staff stays plain** where a piece is read and played. A frame round it may be painted; nothing behind or over the notes.
5. **Original art only.** The reference is Monkey Island 2 as first released in 1991, pixel art, never its 2010 remake; the 1997 game lends single ideas such as the clouds (d111). They are studied for their approach; nothing of theirs is copied, traced or named in the game. Free packs by d084 and the `use-free-art-packs` skill.
6. **Reference pictures never go into git:** not the reference photographs of Keri, not screenshots of other games. They are studied locally (the gitignored `private/painter/`), each batch with a README.
7. **No shadow or vignette laid over a picture**, in any scene.
8. **Look and measure before you show:** `npm run art:render` writes a picture to a PNG without starting the game; `npm run art:check` measures it against the rules that have numbers (colour runs, clouds) and draws the stage-set lines over it; a browser screenshot shows it in the game. Nobody can judge a picture from its code, and the numbers do not say whether it is good.
9. **Checks:** `npm run check:ci` before a push; the end-to-end areas of the screen (`npm run test:e2e:affected`). A repainted screen changes its screenshot baseline: make the new one (`--update-snapshots` on the visual area, or the "Update screenshot baselines" workflow) and say so in the pull request, where the maintainer looks at it.
10. **Merge:** only on the maintainer's word. Art is taste; a green check is not a verdict.
11. **Helpers:** subagents are allowed; choose each one's model by how hard its task is, never the largest by habit.
12. **Explain app and web matters briefly** (what, why, where). The game is laid out for a modest laptop at 1920 x 1080.

## 5. How work arrives

The painter's material stays outside git by design, studied locally in the gitignored `private/painter/`: the MI2 and MI3 reference atlas that `refcat.py` reads, the reference photographs of Keri and the photo map, every scene's sketches, passes and review sheets, and the kit sheets.

From the maintainer, in the project's chat: a screen to paint, a verdict on a picture, photographs. The painter has no dispatch label and no routine today; other projects hand it work as `TODO(painter)` tags in the docs ([todo-tags.md](../automation/todo-tags.md), d116) or a line in a pull request; there are no mailboxes (d153). If the maintainer's issues should reach it later, the architect proposes a label (`agent:painter`) and the maintainer decides; until then an art issue stays with the project that has it, with a `TODO(painter)` tag.

The painter's notes are in `projects/painter/` ([README](../../projects/painter/README.md)).

## 6. Setting the project up (the maintainer, by hand)

1. Create the Claude project "Pianor - painter" with the Pianor repository.
2. **Project instructions**, to paste:

   > You are the painter of Pianor. Read `CLAUDE.md`, then `docs/architect/painter-project.md` and `docs/art-direction.md`, before any work. You own how screens look, never what they do. Scaffold and wait for the maintainer's input; never invent what must come from the maintainer. Every picture is shown to the maintainer before it is done. Reference pictures stay out of git. Notes go through a docs-only pull request, never straight to `main`.

3. **Network:** the environment must allow `kenney.nl` and `opengameart.org` for free packs, and the Maa- ja Ruumiamet hosts for the orthophoto.
4. **References:** the painter needs the reference pictures in `private/painter/` (studied locally, never committed). Without them the painter has the rules but not the pictures they came from.

## 7. The first job: every existing screen in the agreed manner

The next work is to overhaul all existing screens to the agreed MI2-like style. It is its own work.

### What is there (33 scene keys in `src/game/scenes.ts`)

| Group | Scenes | Today | What a repaint must settle |
|---|---|---|---|
| Painted places | `profile` (the warden's room), `keriMap`, `knoll`, `docks`, `crossroads` | done in the manner, on the painter's kit (d124) | nothing; they are the models |
| Places still to paint | `kiurDoor` | flat pixel art on the game's 53 colours | which become scenes on Keri (the battle screens are gone, d129; the trail and the walk are removed, d117; the room's screensaver shows the painted scenes, ft_1_17) |
| Screens with a staff | `practice`, `noteTrainer`, `earTrainer`, `analyze`, `results`, `editor`, `preview` | a plain staff, toolbars, panels | how much picture a staff screen may carry at all (rule 4 above) |
| Lists and forms | `boot`, `profiles`, `name`, `menu`, `pieces`, `parts`, `settings`, `credits` | panels and buttons on a plain ground | one painted ground behind them, or each its own place (the menu as a place on Keri?) |
| Admin | `admin`, `adminGate`, `adminPages`, `adminPassword`, `adminDelete` | plain | probably none: a parent's tool, not the student's world |
| Dev only | `staff-demo`, `art-demo`, `battle-art-demo` | plain | none |

The groups are the architect's reading of the code, not a decision. **The painter's first step is its own inventory:** a screenshot of every screen as it is today, in one sheet, with a proposal per group, for the maintainer to mark.

### To ask the maintainer before painting

Question 3 (the band) is answered: [ft_1_20](../features/ft_1_20-action-and-inventory-strip.md), [d115](../decisions/game.md#d115); the painter draws the band and its pictures, the builder its functions. Question 5 is being answered scene by scene (the docks, the crossroads, the garden). Since then the painter's time went to new scenes and their kit; the staff screens and the lists have only the warm wood (d118).

- TODO(painter, R2): the inventory sheet (a screenshot of every screen as it is today, with a proposal per group), then the maintainer's answers to: (1) which groups get a painted picture and which only a painted frame, ground and buttons; (2) the manner of the next interior (one small trial of each side by side, art-direction.md section 3); (6) the order. The architect's proposal for the order: the kit every screen shares on one trial screen (the menu); then the screens the student sees most, by play order (profiles, menu, pieces, practice's frame, results); then places; then the rest.

### What the code needs before many screens are painted

| Need | State (architect) |
|---|---|
| One drawing, four palettes, packed once | Not possible as hoped: the hours differ in their pixels (shadows, lit sides), not only in palette. Five pictures now take 6.6 MB of a 7.1 MB game file, all loaded at start-up. The cut is to load them per picture and hour instead: `TODO(builder, R2)` in ft_1_24 |
| `art:render`, `art:check` and the rules' test learn each new picture | Holds: `tools/art/pictureRules.test.ts` fails for a picture the build paints that is not in `tools/art/pictures.ts` |
| A lint rule that keeps painting code free of Phaser and the DOM | TODO(builder, R2): a `no-restricted-imports` and `no-restricted-globals` block in `eslint.config.js` for `src/game/ui/pixel/paint/`, `src/game/ui/pixel/keri/` and `src/core/layout/` (no `phaser`, no DOM globals), as `src/core/` has. They hold today by convention (none imports either) and are 13,500 lines and growing; the build paints them in Node, where a slip only shows as a failed build |
| Screenshot baselines for each repainted screen | The maintainer's look in the pull request: `projects/painter/notes/interface.md` |
| A shared palette for interfaces | Done: one warm palette for the band and every screen (d118); outdoors `keriPalette.ts` (d123) |

A URL switch that opens a scene directly is not needed: `npm run art:render` shows any picture outside the game.

## 8. Known open ends handed over

- TODO(painter, R2): the maintainer's verdict on the clean-sheet clouds (d111), if the scenes painted since do not already carry it.
- The letters A, B and D on drone photograph 19 and every `KERI-TODO`: in [keri.md](../keri.md) and [keri/map.md](../keri/map.md), asked of the maintainer there.
- NEEDS-HUMAN: [axioms.md](../axioms.md) AX-2.3 still says minimal original assets, while d084 and `CLAUDE.md` welcome free packs. The axioms are the maintainer's to word.
