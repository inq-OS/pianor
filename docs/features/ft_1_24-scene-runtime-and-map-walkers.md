---
id: "ft_1_24"
title: "Scenes as data on a world base scene, actors, and characters walking the map"
scope: "One data-driven adventure scene runs every painted place (picture per hour, hotspots, standing places, exits) on a world base scene with sprites instead of a full redraw; actors with states and facing; a small script interpreter for cut-scenes; pathfinding over the map of Keri's paths so characters and visitors walk between the landing, the houses and the scenes; loading per scene"
effort: "large"
status: "in progress (stage 1): AdventureScene runs the knoll, docks and crossroads from content/scenes; actors runtime, template character, per-scene loading and the script interpreter, hotspots and exits built; map walkers open"
completeness: 40
depends_on: ["ft_1_18", "ft_1_19", "ft_1_20"]
---
# ft_1_24: Scenes as data on a world base scene, actors, and characters walking the map

Stage 1 or 2 of the [characters and teacher programme](../architect/program-characters-teacher.md). Index: [FEATURES.md](FEATURES.md).

Plan F1, F2 (map only for the MVP: characters walk on the map to give the island some life), F3, F4, F6, F17. Nobody walks in a scene yet; pressing a character opens its conversation.

## Rules

- **Scenes as data:** `content/scenes/{knoll,docks,crossroads}.json` (`SceneData`) run on one `AdventureScene` (`src/game/adventure/`); what belongs to a picture and not to the data (view, wind, clouds, embers, smoke, lamp, the beings' spots) is its life in `sceneLife.ts`. Looks as before.
- **Actors runtime:** pure rules in `src/core/scene/actorRuntime.ts` (state fallback, frame stepping, feet on a place, mirrored to face left, z-order by the feet); sheets in `actorSheets.ts` (Kiur idle and talking); the template character (`ActorDef.template`, d142, d144) is built by the painter in `src/game/ui/pixel/actors/` from features per state and lit by the scene's hour (`content/actors/villager.json`, numbers checked against `templateActorNumbers`; sheet: `npm run art:render -- figures`); an actor with no art is a labelled box. One body on MI2's grid, swappable layers, five-tone ramps, states idle, talk, play, listen, walk. A child (`age: child`, d154) is the same template on the student's body, about three heads; the student's actor is `content/actors/student.json`, not yet stood in a scene. Kiur stays his own figure. `?actors=1` (dev) stands Kiur, the villager and the placeholder on a scene's first three places.
- **Loading per scene and hour** (WP-16, d143): the boot file holds no painted pictures; each scene loads its own per hour.
- **World base scene** (AX-3 provisional): it is `AdventureScene` on `PixelScene`, which draws only on a resize or a change and moves everything by animators; actors are sprites stepped every frame by those animators, never by redrawing the scene. A separate base without `PixelScene` waits until a scene scrolls or a figure walks in it.

## Acceptance criteria

All AX-3 provisional until built and tried; numbers are content, not code.

- **ft_1_24.AC1** A scene is data (`scenes` in the world model or one file per scene): picture per hour, hotspots, standing places for actors, exits, its music tie; one `AdventureScene` runs the knoll, the docks and the crossroads with the same look and behaviour as today (screenshots and end-to-end tests unchanged).
- **ft_1_24.AC2** The scene runs on a world base scene with sprites and a fixed art resolution, not on PixelScene's full redraw; the band (ft_1_20) is unchanged. [human]
- **ft_1_24.AC3** Actors (characters, Kiur, the teacher) have states (idle, talk, play, walk on the map), a facing and a z-order by their feet; their sprites and timing are data.
- **ft_1_24.AC4** Pressing an actor or hotspot does the band's action on it (talk opens the conversation of ft_1_22).
- **ft_1_24.AC5** Pathfinding on the map: A* over the graph of the traced paths (`content/world/keri.json`), property-tested (a path follows the graph, no shorter path exists in the test graph); characters walk to and from the scene where they are today (ft_1_25) and stand still while the student watches.
- **ft_1_24.AC6** A script is a list of commands as data (walk to, face, say, wait, play a phrase, give, fade), stepped by a pure interpreter and executed by the scene; the teacher's boat arriving is the first script.
- **ft_1_24.AC7** Pictures and actors load when a scene opens, not at start; the boot file loses the painted pictures (7 MB).
- **ft_1_24.AC8** A dev overlay (`?walk=1`) shows the map's path graph, hotspots and standing places.

## Work packages

WP-nn names a part of the plan ([parts and contracts](../architect/program-characters-teacher.md#3-parts), d153).

- WP-05 hotspots and exits: a scene's hotspots and exits are press areas over the picture (`AdventureScene.spots`, fine pixels in the scene file). Pressing a hotspot looks at it: the student says its `look` line over it in the student's colour (`spokenLine`, `lineSpot`), for its reading time or until it is pressed again; a character standing over a hotspot takes the press. Pressing an exit leaves to its scene, the map (`map`) or the room (`room`); the scene files' test checks every exit's target. The knoll has the first hotspot, its fire place (`scene.knoll.fire`). AX-3 provisional: every hotspot is looked at until the band's verbs come with ft_1_20's items; no exit in the scene files yet (where a path leaves a picture is the maintainer's to tell, KERI-TODO). Tests: `src/core/scene/content.test.ts`, `tests/e2e/hotspots.spec.ts`.
  - KERI-TODO: where each scene's paths leave the picture, for its exits (the knoll, the docks, the crossroads).
  - TODO(painter, R3): WP-05/WP-06 the template's small map version (a walker on the map of Keri), when WP-06 starts.
- WP-06 Characters walking the map (held, stage 3): path graph from the world model, A*, walkers on the map, the overlay; the painter's small walking figures; who walks from `Presence`.
  - A walker is a dot on the map only while it goes between scenes, never while it stands in one; most walk the map's paths and pavement (`paths` in `content/world/keri.json`), some, like the fisherman, may walk along the coast (`coast`): a walker's way over the paths graph plus, for those, the coastline as more edges.
- WP-07 the script interpreter and the boat arriving with a placeholder boat [CT-R4]: built, see Built.
  - A script's line is WP-09's spoken line (`talkArt.spokenLine`, `lineSpot`) in the speaker's colour (Kiur's gold, a character's own, the fallback for anyone else), placed by `lineSpot` inside the picture; a line longer than a page turns its pages evenly over its reading time. AX-3 provisional: the even turning. Test: `tests/e2e/adventure-script.spec.ts`.

## Built

- **WP-16** (d143): pictures load per scene and hour (AC7).
- **WP-05 slice 1**: `content/scenes/{knoll,docks,crossroads}.json` (`SceneData`) run on one `AdventureScene` (`src/game/adventure/`); what is a picture's and not the data's (its view, wind, clouds, the embers, smoke and lamp, the beings' spots) is its life in `sceneLife.ts`. The three scenes look as before (screenshots of main and the branch compared at the same hour: the same within the animation's own run-to-run difference). The actors runtime: the pure rules in `src/core/scene/actorRuntime.ts` (state fallback, frame stepping, feet on a place, mirrored to face left, z-order by the feet), the sheets in `actorSheets.ts` (Kiur idle and talking), the template character (`ActorDef.template`, d142) cast from its features by the painter's `figureFrames` per state and lit by the scene's hour (`content/actors/villager.json`, its numbers checked against `templateActorNumbers`), and a labelled box for an actor with no art. `?actors=1` (dev) stands Kiur, the villager and the placeholder on a scene's first three places.
- **WP-07**: scripts (AC6). `content/scripts/<id>.json` (`Script`, contract A.7) is stepped by the pure interpreter `src/core/scene/scriptRunner.ts` (`startScript`, `stepScript`, `pressScript`, `skipScript`, `scriptView`): the same total time in any number of steps gives the same stage (a property test), a walk moves the feet and the scale from place to place at the walking speed, faces the way it goes and shows `walk`; a line shows its speaker `talk` for its reading time (`readingMs`) and a press ends it (MI2); a phrase is announced once and shows `play` for its length; `give` is announced once; a fade darkens the picture from or to black; Esc skips a skippable script to its end (actors where it leaves them, items given, no phrase). `scriptProblems` names a place the scene lacks and an actor used off the stage; every script in `content/scripts/` is checked in `content.test.ts`. The scene side is `src/game/adventure/sceneScript.ts` (time per frame, the phrase through `ChartPlayer`, not judged; each item given handed to the scene, which puts it in the player's world by the `give` effect and saves it, so it stands in the band) and `AdventureScene.stage`; a scene opened with `{ script }` runs it (`scriptState` for tests and the demo). The first script is the interpreter's demo, not the teacher's arrival (she lands at the southern docks, ft_1_27): the placeholder boat (`content/actors/boat.json`, a labelled box) sailing from the far sea to the pier at the north docks, where Kiur says `script.boat.arrives` and plays *Au clair de la lune*; the docks have three standing places now. Demo: `?autoplay=1&scenario=boat-arrives`. AX-3 provisional: the walking speed (40 fine pixels a second), the reading time (2.5 s at least, 80 ms a letter), the places.
- AC2, AX-3 provisional: the "world base scene" is `AdventureScene` on `PixelScene`, which already draws only on a resize or a change and moves everything by animators; actors are sprites stepped every frame by those animators, never by drawing the scene again. A separate base without `PixelScene` waits until a scene scrolls or a figure walks in it.
