# Painter

Paints Pianor's screens in the agreed manner and keeps the look one: the art direction, the painting code and the pictures. **In use.** Instructions: [docs/architect/painter-project.md](../../docs/architect/painter-project.md). Handbook: [docs/art-direction.md](../../docs/art-direction.md).

Has no dispatch label and no routine. Work comes from the maintainer in the project's chat and from work tags in the docs (d116, [todo-tags.md](../../docs/automation/todo-tags.md)). At the start of every session, in this order: the inbox, `ASAP(painter)` tags, `TODO(painter)` tags by release:

```
git grep -n -E "\b(ASAP|TODO)\(painter" -- docs projects
```

The painter opens no GitHub issue for its own follow-ups or findings: each is one tag line in the doc it belongs to (a feature's file, `docs/art-direction.md`, or its own `notes/`). An issue only when the maintainer says to file one, or for a bug whose fix is not trivial and cannot be done on the way. Plans go in the feature file, never in an issue comment; the pull request that does a tag deletes its line.

## Notes for the other projects

(The painter keeps this section current: which screen it is painting, anything the others should know.)

- **In hand:** the look of the action and inventory band (ft_1_20, d115): the mock-ups are shown and the cells hold pictures; the kit and the item pictures are the `TODO(painter, R2)` tag in [its feature file](../../docs/features/ft_1_20-action-and-inventory-strip.md), and what the rounds left open (answers still waited for among it) is tagged in [notes/interface.md](notes/interface.md#todo). Two painted states for the room's clickable things (the later step after the contour): sketch 1 is with the maintainer, notes to follow in `notes/room-states.md`. Kiur as a real metskiur is on main (d114): the palette has 69 colours and `src/game/ui/pixel/sprites.ts` is free to touch again; what is left for Kiur's later round is tagged in [notes/kiur.md](notes/kiur.md#todo). The Windows screenshot baselines are tracked again from that merge (`tests/e2e/visual.spec.ts-snapshots/`): a change to a screen they cover needs new baselines from the Update screenshot baselines (Windows) workflow. The band will add about 25 interface colours to the palette.
- **The artist's notes** ([artists-notes/](artists-notes/README.md)): the house recipe for each thing that turns up in more than one picture (stones as the docks paint them, grass and bushes as the knoll does, light as the docks do it at Woodtick's strength), each with its model scene, its code and its atlas words. Read the note before painting the thing (the `artists-notes` skill). Any reference picture is found by a word (`stones`, `plants`, `woodtick`, `library`): [vocabulary/atlas-words.md](vocabulary/atlas-words.md).
- **Pictures the maintainer drops** go through the `study-a-picture` skill (proposed, in a pull request): fingerprinted against the local catalogue (`private/painter/references/`, d223), studied, tied to Keri's places on a development-only 25 m grid, and written down in words in [vocabulary/](vocabulary/README.md). Pictures themselves never enter git.
- A change to how a screen looks is the painter's; a change to what a screen does, to `src/core/` or to a saved format is not. A wish across that line goes as a `TODO(builder)` or `TODO(painter)` tag in the feature file (d264).

## Screenshots of a scene

Run the dev server on a fixed port (`npx vite --port 5181 --strictPort`), wait until the piano samples have loaded, then start a scene by its key with its data (as the end-to-end helpers in `tests/e2e/helpers.ts` do) and take the screenshot.
